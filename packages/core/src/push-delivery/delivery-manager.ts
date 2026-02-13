/**
 * Delivery Manager
 *
 * Orchestrates push delivery of ControlCommandV2 messages to Deutsch instances.
 * Handles retry logic, circuit breaker integration, dead-letter routing,
 * and periodic reconciliation polling.
 *
 * @module push-delivery/delivery-manager
 */

import { getDefaultEmitter } from '../audit/emitter';
import type { AuditEventTag } from '../audit/types';
import { type BuildCommandOptions, buildGetStateCommand } from '../control-v2/builder';
import type { ControlCommandV2 } from '../control-v2/types';
import type { DesiredStateManager, StateDivergence } from '../desired-state/manager';
import { CircuitBreaker, type CircuitBreakerConfig } from './circuit-breaker';
import type { DeadLetterQueue } from './dead-letter-queue';
import type { ControlHttpClient, ControlTarget, DeliveryResult } from './http-client';

/** Default retry delays in ms — exponential backoff (5 attempts) */
const DEFAULT_RETRY_DELAYS_MS = [100, 500, 2_000, 8_000, 30_000];

/** Default configuration for the delivery manager */
export interface DeliveryManagerConfig {
  /** Reconciliation polling interval in ms (default 60s) */
  reconciliationIntervalMs: number;
  /** Idle reconciliation interval in ms (default 300s) */
  idleReconciliationIntervalMs: number;
  /** Max consecutive reconciliation failures before P1 alert (default 3) */
  maxReconciliationRetries: number;
  /** Circuit breaker config override */
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
  /** Service version for command building */
  serviceVersion: string;
  /** Retry delay schedule in ms (default exponential backoff) */
  retryDelaysMs?: number[];
}

const DEFAULT_CONFIG: DeliveryManagerConfig = {
  reconciliationIntervalMs: 60_000,
  idleReconciliationIntervalMs: 300_000,
  maxReconciliationRetries: 3,
  serviceVersion: '1.0.0',
};

/**
 * DeliveryManager orchestrates the full lifecycle of pushing ControlCommandV2
 * messages to registered Deutsch targets.
 *
 * Flow: deliver() → circuit breaker check → sendWithRetry() → ACK processing
 * On exhaustion: dead-letter queue
 * Background: reconciliation loop with divergence detection
 */
export class DeliveryManager {
  private readonly targets = new Map<string, ControlTarget>();
  private readonly circuitBreakers = new Map<string, CircuitBreaker>();
  private readonly reconciliationTimers = new Map<string, ReturnType<typeof setInterval>>();
  private readonly reconciliationRetryCount = new Map<string, number>();
  private readonly config: DeliveryManagerConfig;

  constructor(
    private readonly httpClient: ControlHttpClient,
    private readonly deadLetterQueue: DeadLetterQueue,
    private readonly desiredStateManager: DesiredStateManager,
    config?: Partial<DeliveryManagerConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register a Deutsch target for push delivery.
   * Creates a per-target circuit breaker.
   */
  registerTarget(target: ControlTarget): void {
    const targetId = this.buildTargetId(target);
    this.targets.set(targetId, target);
    this.circuitBreakers.set(
      targetId,
      new CircuitBreaker(targetId, this.config.circuitBreakerConfig),
    );
  }

  /**
   * Deliver a ControlCommandV2 to its target instance.
   *
   * Orchestrates: circuit breaker check → send with retry → queue drain
   */
  async deliver(command: ControlCommandV2): Promise<DeliveryResult> {
    const targetId = this.resolveTargetId(command);
    const target = this.targets.get(targetId);

    if (!target) {
      return {
        success: false,
        error: `No registered target for ${targetId}`,
        latency_ms: 0,
        retryable: false,
      };
    }

    // biome-ignore lint/style/noNonNullAssertion: guaranteed by targets.has check above
    const breaker = this.circuitBreakers.get(targetId)!;
    const action = breaker.shouldSend(command.priority);

    if (action === 'queue') {
      const result = breaker.enqueue(command);
      if (!result.queued) {
        this.emitCommandDroppedAudit(command.command_id, targetId);
      }
      return {
        success: false,
        error: result.queued ? 'Queued: circuit breaker open' : 'Dropped: queue full',
        latency_ms: 0,
        retryable: result.queued,
      };
    }

    // 'send' or 'probe'
    const result = await this.sendWithRetry(command, target, breaker);

    // On success, drain queued commands
    if (result.success && breaker.getQueueDepth() > 0) {
      const queued = breaker.drainQueue();
      // Fire-and-forget: replay in background
      this.replayQueuedCommands(queued, target, breaker).catch((_err) => {
        // Swallow — individual commands will be dead-lettered if they fail
      });
    }

    return result;
  }

  /**
   * Start periodic reconciliation for a target.
   */
  startReconciliationLoop(instanceId: string, organizationId: string): void {
    const key = `${instanceId}:${organizationId}`;
    if (this.reconciliationTimers.has(key)) return;

    const timer = setInterval(
      () => this.triggerReconciliation(instanceId, organizationId).catch(() => {}),
      this.config.reconciliationIntervalMs,
    );
    this.reconciliationTimers.set(key, timer);
  }

  /**
   * Stop periodic reconciliation for a target.
   */
  stopReconciliationLoop(instanceId: string, organizationId: string): void {
    const key = `${instanceId}:${organizationId}`;
    const timer = this.reconciliationTimers.get(key);
    if (timer) {
      clearInterval(timer);
      this.reconciliationTimers.delete(key);
    }
  }

  /**
   * Run startup reconciliation — GET_OPERATIONAL_STATE to all registered targets.
   */
  async startupReconciliation(): Promise<void> {
    for (const [, target] of this.targets) {
      try {
        await this.triggerReconciliation(target.instance_id, target.organization_id);
      } catch {
        // Non-fatal at startup — logged by triggerReconciliation
      }
    }
  }

  /**
   * Trigger a single reconciliation cycle for a target.
   *
   * 1. Process auto-reverts on desired state
   * 2. Send GET_OPERATIONAL_STATE
   * 3. Compare desired vs actual
   * 4. Re-issue correction commands for divergences
   */
  async triggerReconciliation(instanceId: string, organizationId: string): Promise<void> {
    const key = `${instanceId}:${organizationId}`;

    // 1. Process any expired auto-reverts
    try {
      await this.desiredStateManager.processAutoReverts(instanceId, organizationId);
    } catch {
      // Non-fatal
    }

    // 2. Build and send GET_OPERATIONAL_STATE
    const commandOpts: BuildCommandOptions = {
      organizationId,
      instanceId,
      serviceVersion: this.config.serviceVersion,
      operatorId: 'reconciliation-loop',
    };
    const stateCommand = buildGetStateCommand(commandOpts);
    const result = await this.deliver(stateCommand);

    if (!result.success) {
      const retries = (this.reconciliationRetryCount.get(key) ?? 0) + 1;
      this.reconciliationRetryCount.set(key, retries);

      if (retries >= this.config.maxReconciliationRetries) {
        this.emitP1Alert(
          instanceId,
          organizationId,
          `${retries} consecutive GET_OPERATIONAL_STATE failures`,
        );
      }
      return;
    }

    // Reset retry counter on success
    this.reconciliationRetryCount.set(key, 0);

    // 3. Process the ACK response
    if (result.response) {
      await this.processAckResponse(stateCommand, result.response);
    }
  }

  /**
   * Graceful shutdown — stop all reconciliation timers.
   */
  shutdown(): void {
    for (const [_key, timer] of this.reconciliationTimers) {
      clearInterval(timer);
    }
    this.reconciliationTimers.clear();
  }

  /**
   * Get circuit breaker state for a target.
   */
  getCircuitBreakerState(targetId: string): string {
    return this.circuitBreakers.get(targetId)?.getState() ?? 'UNKNOWN';
  }

  /**
   * Get circuit breaker queue depth for a target.
   */
  getCircuitBreakerQueueDepth(targetId: string): number {
    return this.circuitBreakers.get(targetId)?.getQueueDepth() ?? 0;
  }

  /**
   * Get all registered target IDs.
   */
  getTargetIds(): string[] {
    return Array.from(this.targets.keys());
  }

  // ===========================================================================
  // Private methods
  // ===========================================================================

  /**
   * Send command with exponential backoff retry.
   * On exhaustion, routes to dead-letter queue.
   */
  private async sendWithRetry(
    command: ControlCommandV2,
    target: ControlTarget,
    breaker: CircuitBreaker,
  ): Promise<DeliveryResult> {
    let lastResult: DeliveryResult | null = null;

    const delays = this.config.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;

    for (let attempt = 0; attempt <= delays.length; attempt++) {
      lastResult = await this.httpClient.send(command, target);
      breaker.recordResult(lastResult.success);

      if (lastResult.success) {
        return lastResult;
      }

      if (!lastResult.retryable) {
        // Non-retryable failure — dead-letter immediately
        await this.deadLetterQueue.add(
          command,
          lastResult.error ?? 'Non-retryable failure',
          attempt,
        );
        return lastResult;
      }

      // Wait before next retry (skip delay after last attempt)
      if (attempt < delays.length) {
        await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      }
    }

    // All retries exhausted — dead-letter
    await this.deadLetterQueue.add(
      command,
      lastResult?.error ?? 'All retries exhausted',
      delays.length + 1,
    );

    // biome-ignore lint/style/noNonNullAssertion: lastResult is always set after at least one iteration
    return lastResult!;
  }

  /**
   * Process an ACK response from Deutsch.
   *
   * Handles APPLIED, REJECTED, and DEFERRED statuses.
   * Updates desired-state manager with actual state snapshot.
   * Detects and accepts TA1 self-transitions to more conservative modes.
   */
  private async processAckResponse(command: ControlCommandV2, response: unknown): Promise<void> {
    const ack = response as Record<string, unknown>;
    const instanceId = command.target.instance_id;
    const orgId = command.target.organization_id;

    if (!instanceId || !orgId) return;

    // Extract actual state snapshot from response
    const snapshot = (ack.operational_state ?? ack.state ?? ack) as Record<string, unknown>;

    // Update actual state in desired-state manager
    await this.desiredStateManager.updateActualState(instanceId, orgId, snapshot);

    // Check for TA1 self-transitions (instance moved to more conservative mode)
    const actualMode = snapshot.mode as string | undefined;
    if (actualMode) {
      await this.desiredStateManager.acceptSelfTransition(instanceId, orgId, actualMode);
    }

    // Compute divergence
    const desired = await this.desiredStateManager.getDesiredState(instanceId, orgId);
    const divergence = this.desiredStateManager.computeDivergence(desired, snapshot);

    if (divergence.divergent_settings.length > 0 || divergence.mode_divergence) {
      this.emitDivergenceAudit(instanceId, orgId, divergence);
    }
  }

  /**
   * Replay queued commands after circuit breaker recovers.
   */
  private async replayQueuedCommands(
    commands: ControlCommandV2[],
    target: ControlTarget,
    breaker: CircuitBreaker,
  ): Promise<void> {
    for (const cmd of commands) {
      const action = breaker.shouldSend(cmd.priority);
      if (action === 'queue') {
        // Circuit re-opened — re-queue remaining
        breaker.enqueue(cmd);
        break;
      }

      const result = await this.httpClient.send(cmd, target);
      breaker.recordResult(result.success);

      if (!result.success) {
        // Re-queue this and remaining commands
        breaker.enqueue(cmd);
        break;
      }
    }
  }

  /**
   * Build a target ID from instance + org.
   */
  private buildTargetId(target: ControlTarget): string {
    return `${target.instance_id}:${target.organization_id}`;
  }

  /**
   * Resolve target ID from a command's target fields.
   */
  private resolveTargetId(command: ControlCommandV2): string {
    return `${command.target.instance_id ?? 'unknown'}:${command.target.organization_id ?? 'unknown'}`;
  }

  // ===========================================================================
  // Audit helpers
  // ===========================================================================

  private emitCommandDroppedAudit(commandId: string, targetId: string): void {
    getDefaultEmitter()
      .emit({
        eventType: 'CONTROL_COMMAND_TIMEOUT',
        traceId: commandId,
        subjectId: 'system',
        organizationId: targetId.split(':')[1] ?? 'unknown',
        policyPackVersion: 'N/A',
        payload: { command_id: commandId, target_id: targetId, reason: 'queue_full' },
        tags: ['control_v2'] as AuditEventTag[],
      })
      .catch(() => {});
  }

  private emitDivergenceAudit(
    instanceId: string,
    orgId: string,
    divergence: StateDivergence,
  ): void {
    getDefaultEmitter()
      .emit({
        eventType: 'CONTROL_STATE_DIVERGENCE',
        traceId: crypto.randomUUID(),
        subjectId: 'system',
        organizationId: orgId,
        policyPackVersion: 'N/A',
        payload: {
          instance_id: instanceId,
          divergent_settings: divergence.divergent_settings.length,
          mode_divergence: divergence.mode_divergence,
        },
        tags: ['control_v2', 'reconciliation'] as AuditEventTag[],
      })
      .catch(() => {});
  }

  private emitP1Alert(instanceId: string, orgId: string, message: string): void {
    getDefaultEmitter()
      .emit({
        eventType: 'CONTROL_RECONCILIATION_FAILED',
        traceId: crypto.randomUUID(),
        subjectId: 'system',
        organizationId: orgId,
        policyPackVersion: 'N/A',
        payload: { instance_id: instanceId, message, severity: 'P1' },
        tags: ['control_v2', 'reconciliation'] as AuditEventTag[],
      })
      .catch(() => {});
  }
}
