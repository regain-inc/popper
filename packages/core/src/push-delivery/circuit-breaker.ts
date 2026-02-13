/**
 * Circuit Breaker
 *
 * Per-target circuit breaker for push delivery to Deutsch instances.
 * Implements CLOSED → OPEN → HALF_OPEN → CLOSED state machine with
 * consecutive failure and failure-rate trip conditions.
 *
 * @module push-delivery/circuit-breaker
 */

import type { ControlCommandV2 } from '../control-v2/types';

/** Circuit breaker states */
export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/** Circuit breaker configuration */
export interface CircuitBreakerConfig {
  /** Consecutive failures before tripping (default 5) */
  consecutiveFailureThreshold: number;
  /** Failure rate (0-1) before tripping (default 0.5) */
  failureRateThreshold: number;
  /** Window for failure rate calculation in ms (default 30000) */
  failureRateWindowMs: number;
  /** Time in OPEN state before transitioning to HALF_OPEN (default 30000) */
  recoveryTimeoutMs: number;
  /** Maximum commands to queue while OPEN (default 100) */
  maxQueueSize: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  consecutiveFailureThreshold: 5,
  failureRateThreshold: 0.5,
  failureRateWindowMs: 30000,
  recoveryTimeoutMs: 30000,
  maxQueueSize: 100,
};

/** Timestamped result for failure rate window */
interface TimestampedResult {
  success: boolean;
  timestamp: number;
}

/**
 * Per-target circuit breaker for ControlCommandV2 delivery.
 *
 * State machine:
 * - CLOSED: all traffic flows normally
 * - OPEN: failures exceeded threshold, commands queued (EMERGENCY bypasses)
 * - HALF_OPEN: probe sent to test recovery
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED';
  private consecutiveFailures = 0;
  private readonly results: TimestampedResult[] = [];
  private openedAt: number | null = null;
  private readonly queue: ControlCommandV2[] = [];
  private readonly config: CircuitBreakerConfig;

  constructor(
    public readonly targetId: string,
    config?: Partial<CircuitBreakerConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Determine whether a command should be sent, queued, or used as a probe.
   */
  shouldSend(priority: string): 'send' | 'queue' | 'probe' {
    if (this.state === 'CLOSED') {
      return 'send';
    }

    if (this.state === 'OPEN') {
      // EMERGENCY commands always bypass the circuit breaker
      if (priority === 'EMERGENCY') {
        return 'send';
      }

      // Check if recovery timeout has elapsed
      if (this.openedAt !== null) {
        const elapsed = Date.now() - this.openedAt;
        if (elapsed >= this.config.recoveryTimeoutMs) {
          this.state = 'HALF_OPEN';
          return 'probe';
        }
      }

      return 'queue';
    }

    // HALF_OPEN
    return 'probe';
  }

  /**
   * Record the result of a delivery attempt.
   * Updates state machine based on success/failure.
   */
  recordResult(success: boolean): void {
    const now = Date.now();
    this.results.push({ success, timestamp: now });

    if (success) {
      this.consecutiveFailures = 0;

      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.openedAt = null;
      }
      return;
    }

    // Failure
    this.consecutiveFailures++;

    if (this.state === 'HALF_OPEN') {
      this.trip();
      return;
    }

    if (this.state === 'CLOSED') {
      // Check consecutive failure threshold
      if (this.consecutiveFailures >= this.config.consecutiveFailureThreshold) {
        this.trip();
        return;
      }

      // Check failure rate in window (min 5 samples)
      this.pruneOldResults(now);
      if (this.results.length >= 5) {
        const failures = this.results.filter((r) => !r.success).length;
        const rate = failures / this.results.length;
        if (rate > this.config.failureRateThreshold) {
          this.trip();
        }
      }
    }
  }

  /**
   * Enqueue a command for later delivery.
   * If queue is full, drops the oldest ROUTINE command.
   */
  enqueue(command: ControlCommandV2): { queued: boolean; dropped?: string } {
    if (this.queue.length < this.config.maxQueueSize) {
      this.queue.push(command);
      return { queued: true };
    }

    // Queue full — try to drop oldest ROUTINE command
    const routineIndex = this.queue.findIndex((cmd) => cmd.priority === 'ROUTINE');
    if (routineIndex !== -1) {
      const [dropped] = this.queue.splice(routineIndex, 1);
      this.queue.push(command);
      return { queued: true, dropped: dropped.command_id };
    }

    // No ROUTINE command to drop
    return { queued: false };
  }

  /**
   * Drain all queued commands, sorted by created_at.
   * Clears the internal queue.
   */
  drainQueue(): ControlCommandV2[] {
    const commands = this.queue.splice(0);
    commands.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return commands;
  }

  /** Get the current circuit breaker state */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /** Get the number of consecutive failures */
  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  /** Get the current queue depth */
  getQueueDepth(): number {
    return this.queue.length;
  }

  // ===========================================================================
  // Private methods
  // ===========================================================================

  /** Trip the circuit breaker to OPEN state */
  private trip(): void {
    this.state = 'OPEN';
    this.openedAt = Date.now();
  }

  /** Remove results outside the failure rate window */
  private pruneOldResults(now: number): void {
    const cutoff = now - this.config.failureRateWindowMs;
    while (this.results.length > 0 && this.results[0].timestamp < cutoff) {
      this.results.shift();
    }
  }
}
