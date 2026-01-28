/**
 * Drift Triggers
 *
 * Evaluates drift signals against baselines and triggers
 * automatic safe-mode when critical thresholds are exceeded.
 *
 * Per spec §6.1-6.2:
 * - validation_failure_rate >5x baseline → enable safe-mode
 * - hard_stop_rate >5x baseline → enable safe-mode
 * - route_to_clinician_rate >3x baseline → alert ops
 * - high_uncertainty_count >5x baseline → increase sampling
 *
 * @see docs/specs/02-popper-specs/01-popper-system-spec.md §6
 * @module drift/triggers
 */

import type { BaselineSnapshot, RateSignal, SignalBaseline } from './types';

/**
 * Trigger rule configuration
 */
export interface TriggerRule {
  /** Signal name to monitor */
  signal: RateSignal;
  /** Warning threshold multiplier (e.g., 2.0 = 2x baseline) */
  warningMultiplier: number;
  /** Critical threshold multiplier (e.g., 5.0 = 5x baseline) */
  criticalMultiplier: number;
  /** Action on warning */
  warningAction: TriggerAction;
  /** Action on critical */
  criticalAction: TriggerAction;
  /** Cooldown period in seconds before re-triggering */
  cooldownSeconds: number;
}

/**
 * Actions that can be taken when thresholds are exceeded
 */
export type TriggerAction = 'none' | 'alert_ops' | 'enable_safe_mode' | 'increase_sampling';

/**
 * Result of evaluating a single signal
 */
export interface SignalEvaluation {
  signal: RateSignal;
  currentValue: number;
  baselineValue: number;
  warningThreshold: number;
  criticalThreshold: number;
  status: 'normal' | 'warning' | 'critical';
  multiplier: number; // How many times above baseline
  action: TriggerAction;
}

/**
 * Result of evaluating all triggers
 */
export interface TriggerEvaluationResult {
  organizationId: string;
  evaluatedAt: Date;
  evaluations: SignalEvaluation[];
  /** Signals that exceeded warning threshold */
  warnings: SignalEvaluation[];
  /** Signals that exceeded critical threshold */
  criticals: SignalEvaluation[];
  /** Whether safe-mode should be enabled */
  shouldEnableSafeMode: boolean;
  /** Whether ops should be alerted */
  shouldAlertOps: boolean;
  /** Summary for incident record */
  summary: string;
}

/**
 * Incident record to create
 */
export interface IncidentRecord {
  organizationId: string;
  type: 'drift_threshold_breach';
  title: string;
  description: string;
  triggerSignal: string;
  triggerLevel: 'warning' | 'critical';
  triggerValue: string;
  thresholdValue: string;
  baselineValue: string;
  cooldownUntil: Date;
  metadata: Record<string, unknown>;
}

/**
 * Cooldown tracker interface
 */
export interface ICooldownTracker {
  /** Check if signal is in cooldown */
  isInCooldown(organizationId: string, signal: string): Promise<boolean>;
  /** Set cooldown for a signal */
  setCooldown(organizationId: string, signal: string, until: Date): Promise<void>;
  /** Clear cooldown */
  clearCooldown(organizationId: string, signal: string): Promise<void>;
}

/**
 * Default trigger rules per spec §6.1
 */
export const DEFAULT_TRIGGER_RULES: TriggerRule[] = [
  {
    signal: 'validation_failure_rate',
    warningMultiplier: 2.0,
    criticalMultiplier: 5.0,
    warningAction: 'alert_ops',
    criticalAction: 'enable_safe_mode',
    cooldownSeconds: 3600, // 1 hour
  },
  {
    signal: 'hard_stop_rate',
    warningMultiplier: 2.0,
    criticalMultiplier: 5.0,
    warningAction: 'alert_ops',
    criticalAction: 'enable_safe_mode',
    cooldownSeconds: 3600,
  },
  {
    signal: 'route_to_clinician_rate',
    warningMultiplier: 1.5,
    criticalMultiplier: 3.0,
    warningAction: 'none',
    criticalAction: 'alert_ops',
    cooldownSeconds: 1800, // 30 min
  },
  {
    signal: 'high_uncertainty_rate',
    warningMultiplier: 2.0,
    criticalMultiplier: 5.0,
    warningAction: 'none',
    criticalAction: 'increase_sampling',
    cooldownSeconds: 1800,
  },
];

/**
 * Configuration for DriftTriggers
 */
export interface DriftTriggersConfig {
  /** Trigger rules to evaluate */
  rules?: TriggerRule[];
  /** Cooldown tracker implementation */
  cooldownTracker?: ICooldownTracker;
  /** Minimum request count before evaluation (avoid false positives) */
  minRequestCount?: number;
}

/**
 * Drift Triggers evaluator
 *
 * Compares current drift rates against baselines and determines
 * what actions should be taken based on configured rules.
 */
export class DriftTriggers {
  private readonly rules: TriggerRule[];
  private readonly cooldownTracker?: ICooldownTracker;
  private readonly minRequestCount: number;

  constructor(config: DriftTriggersConfig = {}) {
    this.rules = config.rules ?? DEFAULT_TRIGGER_RULES;
    this.cooldownTracker = config.cooldownTracker;
    this.minRequestCount = config.minRequestCount ?? 10;
  }

  /**
   * Evaluate drift signals against baselines
   *
   * @param organizationId - Organization to evaluate
   * @param currentRates - Current drift rates from DriftCounters
   * @param baseline - Baseline snapshot to compare against
   * @param requestCount - Current request count for the window
   * @returns Evaluation result with actions to take
   */
  async evaluate(
    organizationId: string,
    currentRates: Record<RateSignal, number>,
    baseline: BaselineSnapshot,
    requestCount: number,
  ): Promise<TriggerEvaluationResult> {
    const evaluations: SignalEvaluation[] = [];
    const warnings: SignalEvaluation[] = [];
    const criticals: SignalEvaluation[] = [];
    let shouldEnableSafeMode = false;
    let shouldAlertOps = false;

    // Skip evaluation if not enough data
    if (requestCount < this.minRequestCount) {
      return {
        organizationId,
        evaluatedAt: new Date(),
        evaluations: [],
        warnings: [],
        criticals: [],
        shouldEnableSafeMode: false,
        shouldAlertOps: false,
        summary: `Skipped: insufficient data (${requestCount} < ${this.minRequestCount} requests)`,
      };
    }

    for (const rule of this.rules) {
      const currentValue = currentRates[rule.signal] ?? 0;
      const signalBaseline = baseline.rates[rule.signal];

      if (!signalBaseline) {
        // No baseline for this signal, skip
        continue;
      }

      // Check cooldown
      if (this.cooldownTracker) {
        const inCooldown = await this.cooldownTracker.isInCooldown(organizationId, rule.signal);
        if (inCooldown) {
          continue;
        }
      }

      const evaluation = this.evaluateSignal(rule, currentValue, signalBaseline);
      evaluations.push(evaluation);

      if (evaluation.status === 'critical') {
        criticals.push(evaluation);
        if (evaluation.action === 'enable_safe_mode') {
          shouldEnableSafeMode = true;
        }
        if (evaluation.action === 'alert_ops' || evaluation.action === 'enable_safe_mode') {
          shouldAlertOps = true;
        }
      } else if (evaluation.status === 'warning') {
        warnings.push(evaluation);
        if (evaluation.action === 'alert_ops') {
          shouldAlertOps = true;
        }
      }
    }

    // Build summary
    const summaryParts: string[] = [];
    if (criticals.length > 0) {
      summaryParts.push(
        `CRITICAL: ${criticals.map((c) => `${c.signal} at ${(c.multiplier).toFixed(1)}x baseline`).join(', ')}`,
      );
    }
    if (warnings.length > 0) {
      summaryParts.push(
        `WARNING: ${warnings.map((w) => `${w.signal} at ${(w.multiplier).toFixed(1)}x baseline`).join(', ')}`,
      );
    }
    if (summaryParts.length === 0) {
      summaryParts.push('All signals within normal range');
    }

    return {
      organizationId,
      evaluatedAt: new Date(),
      evaluations,
      warnings,
      criticals,
      shouldEnableSafeMode,
      shouldAlertOps,
      summary: summaryParts.join('; '),
    };
  }

  /**
   * Create incident record from evaluation result
   */
  createIncidentRecord(
    result: TriggerEvaluationResult,
    triggerEval: SignalEvaluation,
  ): IncidentRecord {
    const rule = this.rules.find((r) => r.signal === triggerEval.signal);
    const cooldownSeconds = rule?.cooldownSeconds ?? 3600;

    return {
      organizationId: result.organizationId,
      type: 'drift_threshold_breach',
      title: `${triggerEval.status.toUpperCase()}: ${triggerEval.signal} exceeded threshold`,
      description:
        `Signal ${triggerEval.signal} is at ${triggerEval.currentValue.toFixed(4)} ` +
        `(${triggerEval.multiplier.toFixed(1)}x baseline of ${triggerEval.baselineValue.toFixed(4)}). ` +
        `Threshold: ${triggerEval.status === 'critical' ? triggerEval.criticalThreshold.toFixed(4) : triggerEval.warningThreshold.toFixed(4)}.`,
      triggerSignal: triggerEval.signal,
      triggerLevel: triggerEval.status === 'critical' ? 'critical' : 'warning',
      triggerValue: triggerEval.currentValue.toFixed(6),
      thresholdValue:
        triggerEval.status === 'critical'
          ? triggerEval.criticalThreshold.toFixed(6)
          : triggerEval.warningThreshold.toFixed(6),
      baselineValue: triggerEval.baselineValue.toFixed(6),
      cooldownUntil: new Date(Date.now() + cooldownSeconds * 1000),
      metadata: {
        evaluatedAt: result.evaluatedAt.toISOString(),
        multiplier: triggerEval.multiplier,
        allCriticals: result.criticals.map((c) => c.signal),
        allWarnings: result.warnings.map((w) => w.signal),
      },
    };
  }

  /**
   * Set cooldowns for triggered signals
   */
  async setCooldowns(result: TriggerEvaluationResult): Promise<void> {
    if (!this.cooldownTracker) return;

    const triggeredSignals = [...result.criticals, ...result.warnings];

    for (const eval_ of triggeredSignals) {
      const rule = this.rules.find((r) => r.signal === eval_.signal);
      if (rule) {
        const cooldownUntil = new Date(Date.now() + rule.cooldownSeconds * 1000);
        await this.cooldownTracker.setCooldown(result.organizationId, eval_.signal, cooldownUntil);
      }
    }
  }

  /**
   * Get rule for a signal
   */
  getRule(signal: RateSignal): TriggerRule | undefined {
    return this.rules.find((r) => r.signal === signal);
  }

  /**
   * Get all configured rules
   */
  getRules(): TriggerRule[] {
    return [...this.rules];
  }

  // =========================================================================
  // Private Methods
  // =========================================================================

  private evaluateSignal(
    rule: TriggerRule,
    currentValue: number,
    signalBaseline: SignalBaseline,
  ): SignalEvaluation {
    const baselineValue = signalBaseline.baselineValue;

    // Calculate thresholds using multipliers on baseline
    // Note: For rates, we use additive thresholds (baseline + stdDev * multiplier)
    // but spec defines multipliers, so we'll use multiplicative for consistency
    const warningThreshold = baselineValue * rule.warningMultiplier;
    const criticalThreshold = baselineValue * rule.criticalMultiplier;

    // Calculate how many times above baseline
    const multiplier = baselineValue > 0 ? currentValue / baselineValue : 0;

    let status: 'normal' | 'warning' | 'critical' = 'normal';
    let action: TriggerAction = 'none';

    if (currentValue >= criticalThreshold && criticalThreshold > 0) {
      status = 'critical';
      action = rule.criticalAction;
    } else if (currentValue >= warningThreshold && warningThreshold > 0) {
      status = 'warning';
      action = rule.warningAction;
    }

    return {
      signal: rule.signal,
      currentValue,
      baselineValue,
      warningThreshold,
      criticalThreshold,
      status,
      multiplier,
      action,
    };
  }
}

/**
 * In-memory cooldown tracker for testing
 */
export class InMemoryCooldownTracker implements ICooldownTracker {
  private cooldowns = new Map<string, Date>();

  private buildKey(organizationId: string, signal: string): string {
    return `${organizationId}:${signal}`;
  }

  async isInCooldown(organizationId: string, signal: string): Promise<boolean> {
    const key = this.buildKey(organizationId, signal);
    const until = this.cooldowns.get(key);
    if (!until) return false;
    if (until < new Date()) {
      this.cooldowns.delete(key);
      return false;
    }
    return true;
  }

  async setCooldown(organizationId: string, signal: string, until: Date): Promise<void> {
    const key = this.buildKey(organizationId, signal);
    this.cooldowns.set(key, until);
  }

  async clearCooldown(organizationId: string, signal: string): Promise<void> {
    const key = this.buildKey(organizationId, signal);
    this.cooldowns.delete(key);
  }

  /** Clear all cooldowns (for testing) */
  clear(): void {
    this.cooldowns.clear();
  }
}
