/**
 * Reconfigure Policy Types
 *
 * Types for signal-driven reconfiguration policies that evaluate
 * aggregated supervision signals and produce ReconfigureEffects.
 *
 * @module reconfigure-policy/types
 */

import type { ReconfigureEffect } from '../policy-engine/types';

/**
 * Trigger conditions for reconfigure policies.
 * Evaluated against AggregatedSignals from the signal aggregator.
 */
export interface ReconfigureTrigger {
  kind:
    | 'approval_rate_below'
    | 'hard_stop_rate_above'
    | 'htv_trend_declining'
    | 'hallucination_spike'
    | 'idk_rate_above'
    | 'prescription_rejection_rate_above'
    | 'risk_score_above'
    | 'all_of'
    | 'any_of';
  /** Numeric threshold for comparison triggers */
  threshold?: number;
  /** Window in minutes for time-scoped triggers */
  window_minutes?: number;
  /** Nested triggers for all_of / any_of */
  triggers?: ReconfigureTrigger[];
}

/**
 * A reconfigure policy definition.
 * Loaded from YAML config, evaluated against aggregated signals.
 */
export interface ReconfigurePolicy {
  policy_id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: ReconfigureTrigger;
  effect: ReconfigureEffect;
  cooldown_minutes: number;
  auto_revert?: boolean;
  revert_after_minutes?: number;
}

/**
 * Result of evaluating a single reconfigure policy.
 */
export interface ReconfigurePolicyResult {
  policy_id: string;
  triggered: boolean;
  effect?: ReconfigureEffect;
  trigger_details?: Record<string, unknown>;
}
