/**
 * Drift Baseline types
 *
 * Types for drift baseline calculation and storage.
 * Used for anomaly detection and safe-mode triggers.
 *
 * @module drift/types
 */

/**
 * Drift signal names matching the drift counters
 */
export const BASELINE_SIGNALS = [
  'request_count',
  'approved_count',
  'hard_stop_count',
  'route_to_clinician_count',
  'request_more_info_count',
  'validation_failure_count',
  'high_uncertainty_count',
  'missing_evidence_count',
  'htv_below_threshold_count',
  'policy_violation_count',
] as const;

export type BaselineSignal = (typeof BASELINE_SIGNALS)[number];

/**
 * Rate signals (calculated as ratio of signal to request_count)
 */
export const RATE_SIGNALS = [
  'approved_rate',
  'hard_stop_rate',
  'route_to_clinician_rate',
  'request_more_info_rate',
  'high_uncertainty_rate',
  'validation_failure_rate',
] as const;

export type RateSignal = (typeof RATE_SIGNALS)[number];

/**
 * Daily aggregated audit event data from continuous aggregate
 */
export interface DailyAuditAggregate {
  bucket: Date;
  organizationId: string;
  requestCount: number;
  approvedCount: number;
  hardStopCount: number;
  routeToClinicianCount: number;
  requestMoreInfoCount: number;
  validationFailureCount: number;
  highUncertaintyCount: number;
  missingEvidenceCount: number;
  htvBelowThresholdCount: number;
  policyViolationCount: number;
  avgLatencyMs: number | null;
  p95LatencyMs: number | null;
  p99LatencyMs: number | null;
}

/**
 * Calculated baseline for a single signal
 */
export interface SignalBaseline {
  /** Signal name */
  signalName: BaselineSignal;
  /** Baseline value (mean over window) */
  baselineValue: number;
  /** Warning threshold (2x baseline by default) */
  warningThreshold: number;
  /** Critical threshold (5x baseline by default) */
  criticalThreshold: number;
  /** Number of samples used */
  sampleCount: number;
  /** Standard deviation */
  stdDev: number;
}

/**
 * Complete baseline snapshot for an organization
 */
export interface BaselineSnapshot {
  /** Organization ID (SYSTEM_ORG_ID for global) */
  organizationId: string;
  /** When baseline was calculated */
  calculatedAt: Date;
  /** Start of the baseline window */
  windowStart: Date;
  /** End of the baseline window */
  windowEnd: Date;
  /** Days included in calculation */
  daysIncluded: number;
  /** Baselines for each signal */
  signals: Record<BaselineSignal, SignalBaseline>;
  /** Rate baselines */
  rates: Partial<Record<RateSignal, SignalBaseline>>;
  /** Metadata */
  metadata: {
    calculationMethod: 'rolling_7day' | 'manual';
    triggeredBy: 'scheduled' | 'manual' | 'model_update';
    notes?: string;
  };
}

/**
 * Stored baseline record (matches drift_baselines table)
 */
export interface StoredBaseline {
  organizationId: string;
  calculatedAt: Date;
  signalName: string;
  baselineValue: number;
  warningThreshold: number;
  criticalThreshold: number;
  sampleCount: number;
  metadata?: Record<string, unknown>;
}

/**
 * Input for creating a new baseline
 */
export interface NewBaseline {
  organizationId: string;
  signalName: string;
  baselineValue: number;
  warningThreshold: number;
  criticalThreshold: number;
  sampleCount: number;
  calculatedAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Interface for baseline storage (PostgreSQL)
 */
export interface IBaselineStore {
  /**
   * Get the latest baseline for a signal
   */
  getLatest(organizationId: string, signalName: BaselineSignal): Promise<StoredBaseline | null>;

  /**
   * Get all latest baselines for an organization
   */
  getAllLatest(organizationId: string): Promise<StoredBaseline[]>;

  /**
   * Save a baseline record
   */
  save(baseline: NewBaseline): Promise<StoredBaseline>;

  /**
   * Save multiple baselines in batch
   */
  saveBatch(baselines: NewBaseline[]): Promise<StoredBaseline[]>;

  /**
   * Get baseline history for a signal
   */
  getHistory(
    organizationId: string,
    signalName: BaselineSignal,
    limit?: number,
  ): Promise<StoredBaseline[]>;
}

/**
 * Cached baseline data
 */
export interface CachedBaseline {
  organizationId: string;
  signalName: string;
  baselineValue: number;
  warningThreshold: number;
  criticalThreshold: number;
  sampleCount: number;
  calculatedAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * Interface for baseline cache (Redis)
 */
export interface IBaselineCache {
  /**
   * Get cached baseline for a signal
   */
  get(organizationId: string, signalName: string): Promise<CachedBaseline | null>;

  /**
   * Get all cached baselines for an organization
   */
  getAll(organizationId: string): Promise<CachedBaseline[]>;

  /**
   * Cache a baseline
   */
  set(baseline: CachedBaseline, ttlSeconds?: number): Promise<void>;

  /**
   * Cache multiple baselines
   */
  setAll(baselines: CachedBaseline[], ttlSeconds?: number): Promise<void>;

  /**
   * Invalidate cached baseline
   */
  delete(organizationId: string, signalName: string): Promise<void>;

  /**
   * Invalidate all baselines for an organization
   */
  deleteAll(organizationId: string): Promise<void>;
}

/**
 * Interface for reading daily aggregates (from continuous aggregate)
 */
export interface IDailyAggregateReader {
  /**
   * Get daily aggregates for a date range
   */
  getRange(organizationId: string, startDate: Date, endDate: Date): Promise<DailyAuditAggregate[]>;

  /**
   * Get aggregates for the last N days
   */
  getLastNDays(organizationId: string, days: number): Promise<DailyAuditAggregate[]>;
}

/**
 * Configuration for baseline calculation
 */
export interface BaselineConfig {
  /** Number of days for rolling window (default: 7) */
  windowDays: number;
  /** Minimum days required for valid baseline (default: 3) */
  minDaysRequired: number;
  /** Warning threshold multiplier (default: 2.0) */
  warningMultiplier: number;
  /** Critical threshold multiplier (default: 5.0) */
  criticalMultiplier: number;
  /** Days before org gets its own baseline (default: 30) */
  orgStabilizationDays: number;
}

/** Default baseline configuration */
export const DEFAULT_BASELINE_CONFIG: BaselineConfig = {
  windowDays: 7,
  minDaysRequired: 3,
  warningMultiplier: 2.0,
  criticalMultiplier: 5.0,
  orgStabilizationDays: 30,
};

/** System organization ID for global baselines */
export const SYSTEM_ORG_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Check if a string is a valid baseline signal
 */
export function isValidBaselineSignal(signal: string): signal is BaselineSignal {
  return BASELINE_SIGNALS.includes(signal as BaselineSignal);
}
