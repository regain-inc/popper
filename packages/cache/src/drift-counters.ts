/**
 * Drift Counters - Redis-based signal tracking for drift monitoring
 *
 * Implements sliding window counters for drift detection signals.
 * Each signal is tracked per-organization with a 1-hour TTL.
 *
 * Signals tracked:
 * - request_count: Total supervision requests
 * - approved_count: APPROVED decisions
 * - hard_stop_count: HARD_STOP decisions
 * - route_to_clinician_count: ROUTE_TO_CLINICIAN decisions
 * - request_more_info_count: REQUEST_MORE_INFO decisions
 * - validation_failure_count: Schema/validation failures
 * - high_uncertainty_count: High uncertainty flags
 * - missing_evidence_count: Missing evidence_refs
 * - htv_below_threshold_count: HTV scores below threshold
 * - policy_violation_count: Policy violations detected
 *
 * Key format: drift:{org_id}:{signal}:{hour_ts}
 *
 * @see docs/specs/02-popper-specs/01-popper-system-spec.md §5.2, §6
 * @module drift-counters
 */

import type { Redis } from 'ioredis';

/** Drift signal types */
export type DriftSignal =
  | 'request_count'
  | 'approved_count'
  | 'hard_stop_count'
  | 'route_to_clinician_count'
  | 'request_more_info_count'
  | 'validation_failure_count'
  | 'high_uncertainty_count'
  | 'missing_evidence_count'
  | 'htv_below_threshold_count'
  | 'policy_violation_count';

/** All drift signals */
export const DRIFT_SIGNALS: DriftSignal[] = [
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
];

/** Drift counter values for a specific time window */
export interface DriftCounterValues {
  /** Total supervision requests */
  request_count: number;
  /** APPROVED decisions */
  approved_count: number;
  /** HARD_STOP decisions */
  hard_stop_count: number;
  /** ROUTE_TO_CLINICIAN decisions */
  route_to_clinician_count: number;
  /** REQUEST_MORE_INFO decisions */
  request_more_info_count: number;
  /** Schema/validation failures */
  validation_failure_count: number;
  /** High uncertainty flags */
  high_uncertainty_count: number;
  /** Missing evidence_refs */
  missing_evidence_count: number;
  /** HTV scores below threshold */
  htv_below_threshold_count: number;
  /** Policy violations detected */
  policy_violation_count: number;
}

/** Drift rates calculated from counters */
export interface DriftRates {
  /** Hard stop rate (hard_stop_count / request_count) */
  hardStopRate: number;
  /** Route to clinician rate */
  routeToClinicianRate: number;
  /** Approval rate */
  approvalRate: number;
  /** Validation failure rate */
  validationFailureRate: number;
  /** High uncertainty rate */
  highUncertaintyRate: number;
  /** Missing evidence rate */
  missingEvidenceRate: number;
  /** HTV below threshold rate */
  htvBelowThresholdRate: number;
  /** Policy violation rate */
  policyViolationRate: number;
}

/** Drift snapshot with counters, rates, and metadata */
export interface DriftSnapshot {
  /** Organization ID (or 'global' for aggregate) */
  organizationId: string;
  /** Counter values */
  counters: DriftCounterValues;
  /** Calculated rates (0-1) */
  rates: DriftRates;
  /** Timestamp of the hour window start */
  windowStartAt: number;
  /** Timestamp of the hour window end */
  windowEndAt: number;
  /** When this snapshot was captured */
  capturedAt: Date;
}

/** Key prefix for drift counters */
export const DRIFT_KEY_PREFIX = 'drift';

/** Default TTL for drift counters (1 hour + 5 min buffer) */
export const DRIFT_COUNTER_TTL_SECONDS = 3900;

/**
 * Drift counters interface
 */
export interface IDriftCounters {
  /**
   * Increment a signal counter
   *
   * @param organizationId - Organization ID (or 'global')
   * @param signal - Signal to increment
   * @param amount - Amount to increment (default: 1)
   * @returns New counter value
   */
  increment(organizationId: string, signal: DriftSignal, amount?: number): Promise<number>;

  /**
   * Increment multiple signals at once
   *
   * @param organizationId - Organization ID
   * @param signals - Array of signals to increment
   * @returns New counter values
   */
  incrementMany(
    organizationId: string,
    signals: DriftSignal[],
  ): Promise<Partial<DriftCounterValues>>;

  /**
   * Get current counter value for a signal
   *
   * @param organizationId - Organization ID
   * @param signal - Signal to query
   * @returns Current counter value
   */
  get(organizationId: string, signal: DriftSignal): Promise<number>;

  /**
   * Get all counter values for an organization
   *
   * @param organizationId - Organization ID
   * @returns All counter values
   */
  getAll(organizationId: string): Promise<DriftCounterValues>;

  /**
   * Get a complete drift snapshot with rates
   *
   * @param organizationId - Organization ID
   * @returns Drift snapshot with counters and rates
   */
  getSnapshot(organizationId: string): Promise<DriftSnapshot>;

  /**
   * Record a supervision decision (increments relevant counters)
   *
   * @param params - Decision parameters
   */
  recordDecision(params: {
    organizationId: string;
    decision: 'APPROVED' | 'HARD_STOP' | 'ROUTE_TO_CLINICIAN' | 'REQUEST_MORE_INFO';
    reasonCodes?: string[];
    htvBelowThreshold?: boolean;
    validationFailed?: boolean;
  }): Promise<void>;
}

/**
 * Get current hour timestamp (floor to hour)
 */
function getCurrentHourTs(): number {
  return Math.floor(Date.now() / 3600000) * 3600;
}

/**
 * Sanitize organization ID to prevent Redis key injection
 * Only allows alphanumeric, hyphens, and underscores
 */
function sanitizeOrgId(orgId: string): string {
  // Replace any non-safe characters with underscore
  return orgId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
}

/**
 * Calculate rates from counter values
 */
function calculateRates(counters: DriftCounterValues): DriftRates {
  const total = counters.request_count || 1; // Avoid division by zero
  return {
    hardStopRate: counters.hard_stop_count / total,
    routeToClinicianRate: counters.route_to_clinician_count / total,
    approvalRate: counters.approved_count / total,
    validationFailureRate: counters.validation_failure_count / total,
    highUncertaintyRate: counters.high_uncertainty_count / total,
    missingEvidenceRate: counters.missing_evidence_count / total,
    htvBelowThresholdRate: counters.htv_below_threshold_count / total,
    policyViolationRate: counters.policy_violation_count / total,
  };
}

/**
 * Create empty counter values
 */
function emptyCounters(): DriftCounterValues {
  return {
    request_count: 0,
    approved_count: 0,
    hard_stop_count: 0,
    route_to_clinician_count: 0,
    request_more_info_count: 0,
    validation_failure_count: 0,
    high_uncertainty_count: 0,
    missing_evidence_count: 0,
    htv_below_threshold_count: 0,
    policy_violation_count: 0,
  };
}

/**
 * Redis-based drift counters
 *
 * Uses atomic INCR operations with TTL for efficient drift signal tracking.
 */
export class DriftCounters implements IDriftCounters {
  constructor(private readonly redis: Redis) {}

  /**
   * Build Redis key for a signal counter
   */
  private buildKey(organizationId: string, signal: DriftSignal, hourTs: number): string {
    return `${DRIFT_KEY_PREFIX}:${sanitizeOrgId(organizationId)}:${signal}:${hourTs}`;
  }

  async increment(organizationId: string, signal: DriftSignal, amount = 1): Promise<number> {
    const hourTs = getCurrentHourTs();
    const key = this.buildKey(organizationId, signal, hourTs);

    const pipeline = this.redis.pipeline();
    pipeline.incrby(key, amount);
    pipeline.expire(key, DRIFT_COUNTER_TTL_SECONDS);

    const results = await pipeline.exec();
    return (results?.[0]?.[1] as number) ?? 0;
  }

  async incrementMany(
    organizationId: string,
    signals: DriftSignal[],
  ): Promise<Partial<DriftCounterValues>> {
    const hourTs = getCurrentHourTs();
    const pipeline = this.redis.pipeline();

    for (const signal of signals) {
      const key = this.buildKey(organizationId, signal, hourTs);
      pipeline.incr(key);
      pipeline.expire(key, DRIFT_COUNTER_TTL_SECONDS);
    }

    const results = await pipeline.exec();
    const values: Partial<DriftCounterValues> = {};

    for (let i = 0; i < signals.length; i++) {
      const signal = signals[i];
      const resultIndex = i * 2; // Each signal has 2 commands (incr + expire)
      values[signal] = (results?.[resultIndex]?.[1] as number) ?? 0;
    }

    return values;
  }

  async get(organizationId: string, signal: DriftSignal): Promise<number> {
    const hourTs = getCurrentHourTs();
    const key = this.buildKey(organizationId, signal, hourTs);
    const value = await this.redis.get(key);
    return value ? Number.parseInt(value, 10) : 0;
  }

  async getAll(organizationId: string): Promise<DriftCounterValues> {
    const hourTs = getCurrentHourTs();
    const pipeline = this.redis.pipeline();

    for (const signal of DRIFT_SIGNALS) {
      const key = this.buildKey(organizationId, signal, hourTs);
      pipeline.get(key);
    }

    const results = await pipeline.exec();
    const counters = emptyCounters();

    for (let i = 0; i < DRIFT_SIGNALS.length; i++) {
      const signal = DRIFT_SIGNALS[i];
      const value = results?.[i]?.[1];
      counters[signal] = value ? Number.parseInt(value as string, 10) : 0;
    }

    return counters;
  }

  async getSnapshot(organizationId: string): Promise<DriftSnapshot> {
    const counters = await this.getAll(organizationId);
    const hourTs = getCurrentHourTs();

    return {
      organizationId,
      counters,
      rates: calculateRates(counters),
      windowStartAt: hourTs,
      windowEndAt: hourTs + 3600,
      capturedAt: new Date(),
    };
  }

  async recordDecision(params: {
    organizationId: string;
    decision: 'APPROVED' | 'HARD_STOP' | 'ROUTE_TO_CLINICIAN' | 'REQUEST_MORE_INFO';
    reasonCodes?: string[];
    htvBelowThreshold?: boolean;
    validationFailed?: boolean;
  }): Promise<void> {
    const signals: DriftSignal[] = ['request_count'];

    // Decision-based signals
    switch (params.decision) {
      case 'APPROVED':
        signals.push('approved_count');
        break;
      case 'HARD_STOP':
        signals.push('hard_stop_count');
        break;
      case 'ROUTE_TO_CLINICIAN':
        signals.push('route_to_clinician_count');
        break;
      case 'REQUEST_MORE_INFO':
        signals.push('request_more_info_count');
        break;
    }

    // Reason code based signals
    const reasonCodes = params.reasonCodes ?? [];
    if (reasonCodes.includes('high_uncertainty')) {
      signals.push('high_uncertainty_count');
    }
    if (reasonCodes.includes('insufficient_evidence') || reasonCodes.includes('missing_evidence')) {
      signals.push('missing_evidence_count');
    }
    if (reasonCodes.includes('policy_violation')) {
      signals.push('policy_violation_count');
    }

    // Additional flags
    if (params.htvBelowThreshold) {
      signals.push('htv_below_threshold_count');
    }
    if (params.validationFailed) {
      signals.push('validation_failure_count');
    }

    await this.incrementMany(params.organizationId, signals);
  }
}

/**
 * In-memory drift counters for testing/development
 */
export class InMemoryDriftCounters implements IDriftCounters {
  private readonly counters = new Map<string, { value: number; expiresAt: number }>();

  /**
   * Build key for a counter
   */
  private buildKey(organizationId: string, signal: DriftSignal, hourTs: number): string {
    return `${sanitizeOrgId(organizationId)}:${signal}:${hourTs}`;
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.counters) {
      if (entry.expiresAt < now) {
        this.counters.delete(key);
      }
    }
  }

  async increment(organizationId: string, signal: DriftSignal, amount = 1): Promise<number> {
    this.cleanup();

    const now = Date.now();
    const hourTs = getCurrentHourTs();
    const key = this.buildKey(organizationId, signal, hourTs);

    const existing = this.counters.get(key);
    const currentValue = existing?.expiresAt && existing.expiresAt > now ? existing.value : 0;
    const newValue = currentValue + amount;

    this.counters.set(key, {
      value: newValue,
      expiresAt: now + DRIFT_COUNTER_TTL_SECONDS * 1000,
    });

    return newValue;
  }

  async incrementMany(
    organizationId: string,
    signals: DriftSignal[],
  ): Promise<Partial<DriftCounterValues>> {
    const values: Partial<DriftCounterValues> = {};
    for (const signal of signals) {
      values[signal] = await this.increment(organizationId, signal);
    }
    return values;
  }

  async get(organizationId: string, signal: DriftSignal): Promise<number> {
    this.cleanup();

    const now = Date.now();
    const hourTs = getCurrentHourTs();
    const key = this.buildKey(organizationId, signal, hourTs);

    const entry = this.counters.get(key);
    return entry?.expiresAt && entry.expiresAt > now ? entry.value : 0;
  }

  async getAll(organizationId: string): Promise<DriftCounterValues> {
    const counters = emptyCounters();
    for (const signal of DRIFT_SIGNALS) {
      counters[signal] = await this.get(organizationId, signal);
    }
    return counters;
  }

  async getSnapshot(organizationId: string): Promise<DriftSnapshot> {
    const counters = await this.getAll(organizationId);
    const hourTs = getCurrentHourTs();

    return {
      organizationId,
      counters,
      rates: calculateRates(counters),
      windowStartAt: hourTs,
      windowEndAt: hourTs + 3600,
      capturedAt: new Date(),
    };
  }

  async recordDecision(params: {
    organizationId: string;
    decision: 'APPROVED' | 'HARD_STOP' | 'ROUTE_TO_CLINICIAN' | 'REQUEST_MORE_INFO';
    reasonCodes?: string[];
    htvBelowThreshold?: boolean;
    validationFailed?: boolean;
  }): Promise<void> {
    const signals: DriftSignal[] = ['request_count'];

    switch (params.decision) {
      case 'APPROVED':
        signals.push('approved_count');
        break;
      case 'HARD_STOP':
        signals.push('hard_stop_count');
        break;
      case 'ROUTE_TO_CLINICIAN':
        signals.push('route_to_clinician_count');
        break;
      case 'REQUEST_MORE_INFO':
        signals.push('request_more_info_count');
        break;
    }

    const reasonCodes = params.reasonCodes ?? [];
    if (reasonCodes.includes('high_uncertainty')) {
      signals.push('high_uncertainty_count');
    }
    if (reasonCodes.includes('insufficient_evidence') || reasonCodes.includes('missing_evidence')) {
      signals.push('missing_evidence_count');
    }
    if (reasonCodes.includes('policy_violation')) {
      signals.push('policy_violation_count');
    }

    if (params.htvBelowThreshold) {
      signals.push('htv_below_threshold_count');
    }
    if (params.validationFailed) {
      signals.push('validation_failure_count');
    }

    await this.incrementMany(params.organizationId, signals);
  }

  /** Clear all counters (for testing) */
  clear(): void {
    this.counters.clear();
  }

  /** Get total counter entries (for testing) */
  get size(): number {
    this.cleanup();
    return this.counters.size;
  }
}

/**
 * Prometheus-compatible metrics output
 */
export interface PrometheusMetric {
  name: string;
  help: string;
  type: 'counter' | 'gauge';
  labels: Record<string, string>;
  value: number;
}

/**
 * Convert drift snapshot to Prometheus metrics format
 *
 * @param snapshot - Drift snapshot
 * @returns Array of Prometheus-compatible metrics
 */
export function toPrometheusMetrics(snapshot: DriftSnapshot): PrometheusMetric[] {
  const metrics: PrometheusMetric[] = [];
  const labels = { organization_id: snapshot.organizationId };

  // Counter metrics
  for (const signal of DRIFT_SIGNALS) {
    metrics.push({
      name: `popper_drift_${signal}`,
      help: `Drift signal: ${signal.replace(/_/g, ' ')}`,
      type: 'counter',
      labels,
      value: snapshot.counters[signal],
    });
  }

  // Rate metrics (gauges)
  const rateMetrics: [string, number, string][] = [
    ['hard_stop_rate', snapshot.rates.hardStopRate, 'Hard stop rate (0-1)'],
    ['route_to_clinician_rate', snapshot.rates.routeToClinicianRate, 'Route to clinician rate'],
    ['approval_rate', snapshot.rates.approvalRate, 'Approval rate'],
    ['validation_failure_rate', snapshot.rates.validationFailureRate, 'Validation failure rate'],
    ['high_uncertainty_rate', snapshot.rates.highUncertaintyRate, 'High uncertainty rate'],
    ['missing_evidence_rate', snapshot.rates.missingEvidenceRate, 'Missing evidence rate'],
    ['htv_below_threshold_rate', snapshot.rates.htvBelowThresholdRate, 'HTV below threshold rate'],
    ['policy_violation_rate', snapshot.rates.policyViolationRate, 'Policy violation rate'],
  ];

  for (const [name, value, help] of rateMetrics) {
    metrics.push({
      name: `popper_drift_${name}`,
      help,
      type: 'gauge',
      labels,
      value,
    });
  }

  return metrics;
}

/**
 * Format metrics in Prometheus exposition format
 *
 * @param metrics - Array of metrics
 * @returns Prometheus text format
 */
export function formatPrometheusText(metrics: PrometheusMetric[]): string {
  const lines: string[] = [];
  const seen = new Set<string>();

  for (const metric of metrics) {
    // Add HELP and TYPE only once per metric name
    if (!seen.has(metric.name)) {
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);
      seen.add(metric.name);
    }

    // Format labels
    const labelStr = Object.entries(metric.labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    lines.push(`${metric.name}{${labelStr}} ${metric.value}`);
  }

  return lines.join('\n');
}
