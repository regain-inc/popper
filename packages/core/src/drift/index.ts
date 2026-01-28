/**
 * Drift module
 *
 * Provides drift baseline calculation and threshold checking
 * for anomaly detection and safe-mode triggers.
 *
 * @module drift
 */

export { BaselineCalculator, type BaselineCalculatorConfig } from './calculator';
export {
  DriftTriggersManager,
  type DriftTriggersManagerConfig,
  type IDriftCountersReader,
  type TriggerRunResult,
} from './manager';
export { InMemoryBaselineStore, InMemoryDailyAggregateReader } from './stores';
export {
  DEFAULT_TRIGGER_RULES,
  DriftTriggers,
  type DriftTriggersConfig,
  type ICooldownTracker,
  type IncidentRecord,
  InMemoryCooldownTracker,
  type SignalEvaluation,
  type TriggerAction,
  type TriggerEvaluationResult,
  type TriggerRule,
} from './triggers';
export {
  BASELINE_SIGNALS,
  type BaselineConfig,
  type BaselineSignal,
  type BaselineSnapshot,
  type CachedBaseline,
  type DailyAuditAggregate,
  DEFAULT_BASELINE_CONFIG,
  type IBaselineCache,
  type IBaselineStore,
  type IDailyAggregateReader,
  isValidBaselineSignal,
  type NewBaseline,
  RATE_SIGNALS,
  type RateSignal,
  type SignalBaseline,
  type StoredBaseline,
  SYSTEM_ORG_ID,
} from './types';
