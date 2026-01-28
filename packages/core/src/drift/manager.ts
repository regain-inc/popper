/**
 * Drift Triggers Manager
 *
 * Coordinates drift evaluation, incident creation, and safe-mode triggers.
 * This is the main entry point for the auto-trigger system.
 *
 * @see docs/specs/02-popper-specs/01-popper-system-spec.md §6
 * @module drift/manager
 */

import type { SafeModeManager } from '../safe-mode/manager';
import type { BaselineCalculator } from './calculator';
import type {
  DriftTriggers,
  ICooldownTracker,
  IncidentRecord,
  TriggerEvaluationResult,
} from './triggers';
import type { RateSignal } from './types';

/**
 * Interface for drift counters (from @popper/cache)
 */
export interface IDriftCountersReader {
  getSnapshot(organizationId: string): Promise<{
    organizationId: string;
    counters: {
      request_count: number;
      approved_count: number;
      hard_stop_count: number;
      route_to_clinician_count: number;
      request_more_info_count: number;
      validation_failure_count: number;
      high_uncertainty_count: number;
      missing_evidence_count: number;
      htv_below_threshold_count: number;
      policy_violation_count: number;
    };
    rates: {
      hardStopRate: number;
      routeToClinicianRate: number;
      approvalRate: number;
      validationFailureRate: number;
      highUncertaintyRate: number;
      missingEvidenceRate: number;
      htvBelowThresholdRate: number;
      policyViolationRate: number;
    };
  }>;
}

/**
 * Interface for incidents storage
 */
export interface IIncidentsStore {
  create(incident: {
    organizationId: string;
    type: string;
    status?: string;
    triggerSignal?: string;
    triggerLevel?: string;
    triggerValue?: string;
    thresholdValue?: string;
    baselineValue?: string;
    title: string;
    description?: string;
    metadata?: Record<string, unknown>;
    safeModeEnabled?: Date;
    cooldownUntil?: Date;
  }): Promise<{ id: string }>;
  hasActiveIncident(organizationId: string, triggerSignal: string): Promise<boolean>;
}

/**
 * Configuration for DriftTriggersManager
 */
export interface DriftTriggersManagerConfig {
  /** Drift triggers evaluator */
  triggers: DriftTriggers;
  /** Baseline calculator */
  baselineCalculator: BaselineCalculator;
  /** Drift counters reader */
  driftCounters: IDriftCountersReader;
  /** Safe-mode manager */
  safeModeManager: SafeModeManager;
  /** Incidents storage */
  incidentsStore: IIncidentsStore;
  /** Cooldown tracker */
  cooldownTracker: ICooldownTracker;
  /** Logger (optional) */
  logger?: {
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
  };
}

/**
 * Result of running trigger evaluation
 */
export interface TriggerRunResult {
  organizationId: string;
  evaluatedAt: Date;
  evaluation: TriggerEvaluationResult;
  incidentsCreated: string[];
  safeModeTriggered: boolean;
  opsAlerted: boolean;
}

/**
 * Drift Triggers Manager
 *
 * Coordinates the full trigger evaluation flow:
 * 1. Get current drift snapshot from counters
 * 2. Get effective baseline for comparison
 * 3. Evaluate signals against thresholds
 * 4. Create incidents for breaches
 * 5. Enable safe-mode if critical thresholds exceeded
 * 6. Set cooldowns to prevent alert flooding
 */
export class DriftTriggersManager {
  private readonly triggers: DriftTriggers;
  private readonly baselineCalculator: BaselineCalculator;
  private readonly driftCounters: IDriftCountersReader;
  private readonly safeModeManager: SafeModeManager;
  private readonly incidentsStore: IIncidentsStore;
  private readonly cooldownTracker: ICooldownTracker;
  private readonly logger?: DriftTriggersManagerConfig['logger'];

  constructor(config: DriftTriggersManagerConfig) {
    this.triggers = config.triggers;
    this.baselineCalculator = config.baselineCalculator;
    this.driftCounters = config.driftCounters;
    this.safeModeManager = config.safeModeManager;
    this.incidentsStore = config.incidentsStore;
    this.cooldownTracker = config.cooldownTracker;
    this.logger = config.logger;
  }

  /**
   * Run trigger evaluation for an organization
   *
   * This is the main entry point. Call this:
   * - After each supervision decision (real-time)
   * - On a schedule (e.g., every minute)
   * - Manually for testing
   */
  async evaluate(organizationId: string): Promise<TriggerRunResult> {
    const evaluatedAt = new Date();

    // Get current drift snapshot
    const snapshot = await this.driftCounters.getSnapshot(organizationId);

    // Convert rates to the format expected by triggers
    const currentRates: Record<RateSignal, number> = {
      approved_rate: snapshot.rates.approvalRate,
      hard_stop_rate: snapshot.rates.hardStopRate,
      route_to_clinician_rate: snapshot.rates.routeToClinicianRate,
      request_more_info_rate: 0, // Not in snapshot rates
      high_uncertainty_rate: snapshot.rates.highUncertaintyRate,
      validation_failure_rate: snapshot.rates.validationFailureRate,
    };

    // Get effective baseline
    const baseline = await this.baselineCalculator.getEffectiveBaseline(organizationId);

    if (!baseline) {
      this.logger?.warn(`No baseline available for org ${organizationId}, skipping evaluation`);
      return {
        organizationId,
        evaluatedAt,
        evaluation: {
          organizationId,
          evaluatedAt,
          evaluations: [],
          warnings: [],
          criticals: [],
          shouldEnableSafeMode: false,
          shouldAlertOps: false,
          summary: 'Skipped: no baseline available',
        },
        incidentsCreated: [],
        safeModeTriggered: false,
        opsAlerted: false,
      };
    }

    // Evaluate triggers
    const evaluation = await this.triggers.evaluate(
      organizationId,
      currentRates,
      baseline,
      snapshot.counters.request_count,
    );

    const incidentsCreated: string[] = [];
    let safeModeTriggered = false;

    // Process critical triggers
    for (const critical of evaluation.criticals) {
      // Check if there's already an active incident for this signal
      const hasActive = await this.incidentsStore.hasActiveIncident(
        organizationId,
        critical.signal,
      );

      if (!hasActive) {
        // Create incident record
        const incidentRecord = this.triggers.createIncidentRecord(evaluation, critical);
        const incident = await this.createIncident(incidentRecord, evaluation.shouldEnableSafeMode);
        incidentsCreated.push(incident.id);

        // Set cooldown
        await this.cooldownTracker.setCooldown(
          organizationId,
          critical.signal,
          incidentRecord.cooldownUntil,
        );
      }
    }

    // Process warning triggers (create incidents but don't enable safe-mode)
    for (const warning of evaluation.warnings) {
      const hasActive = await this.incidentsStore.hasActiveIncident(organizationId, warning.signal);

      if (!hasActive) {
        const incidentRecord = this.triggers.createIncidentRecord(evaluation, warning);
        const incident = await this.createIncident(incidentRecord, false);
        incidentsCreated.push(incident.id);

        await this.cooldownTracker.setCooldown(
          organizationId,
          warning.signal,
          incidentRecord.cooldownUntil,
        );
      }
    }

    // Enable safe-mode if needed
    if (evaluation.shouldEnableSafeMode) {
      const safeModeEnabled = await this.safeModeManager.isEnabled(organizationId);

      if (!safeModeEnabled) {
        const primaryTrigger = evaluation.criticals[0];
        const reason = `Auto-triggered: ${primaryTrigger.signal} at ${primaryTrigger.multiplier.toFixed(1)}x baseline`;

        await this.safeModeManager.enable(reason, {
          organization_id: organizationId,
          triggered_by: 'drift_breach',
          incident_id: incidentsCreated[0],
        });

        safeModeTriggered = true;
        this.logger?.info(`Safe-mode enabled for org ${organizationId}: ${reason}`);
      }
    }

    // Log results
    if (evaluation.criticals.length > 0) {
      this.logger?.warn(`Drift triggers fired for org ${organizationId}: ${evaluation.summary}`);
    } else if (evaluation.warnings.length > 0) {
      this.logger?.info(`Drift warnings for org ${organizationId}: ${evaluation.summary}`);
    }

    return {
      organizationId,
      evaluatedAt,
      evaluation,
      incidentsCreated,
      safeModeTriggered,
      opsAlerted: evaluation.shouldAlertOps,
    };
  }

  /**
   * Create an incident record
   */
  private async createIncident(
    record: IncidentRecord,
    safeModeEnabled: boolean,
  ): Promise<{ id: string }> {
    return this.incidentsStore.create({
      organizationId: record.organizationId,
      type: record.type,
      status: 'open',
      triggerSignal: record.triggerSignal,
      triggerLevel: record.triggerLevel,
      triggerValue: record.triggerValue,
      thresholdValue: record.thresholdValue,
      baselineValue: record.baselineValue,
      title: record.title,
      description: record.description,
      metadata: record.metadata,
      safeModeEnabled: safeModeEnabled ? new Date() : undefined,
      cooldownUntil: record.cooldownUntil,
    });
  }

  /**
   * Get configured trigger rules
   */
  getRules() {
    return this.triggers.getRules();
  }

  /**
   * Check if a signal is currently in cooldown
   */
  async isInCooldown(organizationId: string, signal: string): Promise<boolean> {
    return this.cooldownTracker.isInCooldown(organizationId, signal);
  }
}
