/**
 * Baseline Calculator
 *
 * Calculates drift baselines using 7-day rolling windows from
 * the audit_events_daily continuous aggregate.
 *
 * @module drift/calculator
 */

import {
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
  type NewBaseline,
  type SignalBaseline,
  type StoredBaseline,
  SYSTEM_ORG_ID,
} from './types';

export interface BaselineCalculatorConfig {
  /** Baseline storage (PostgreSQL) */
  store: IBaselineStore;
  /** Daily aggregate reader (continuous aggregate) */
  aggregateReader: IDailyAggregateReader;
  /** Baseline cache (Redis) - optional */
  cache?: IBaselineCache;
  /** Calculation configuration */
  config?: Partial<BaselineConfig>;
}

/**
 * Baseline Calculator
 *
 * Provides:
 * - 7-day rolling baseline calculation per signal
 * - Per-org baselines after 30-day stabilization period
 * - Global baselines as fallback
 * - Threshold calculation (warning = 2x, critical = 5x)
 * - Redis caching for fast reads
 */
export class BaselineCalculator {
  private readonly store: IBaselineStore;
  private readonly aggregateReader: IDailyAggregateReader;
  private readonly cache?: IBaselineCache;
  private readonly config: BaselineConfig;

  constructor(options: BaselineCalculatorConfig) {
    this.store = options.store;
    this.aggregateReader = options.aggregateReader;
    this.cache = options.cache;
    this.config = { ...DEFAULT_BASELINE_CONFIG, ...options.config };
  }

  /**
   * Calculate baseline for a specific organization
   *
   * If org doesn't have enough data (< stabilization period),
   * returns global baseline instead.
   */
  async calculateBaseline(
    organizationId: string,
    triggeredBy: 'scheduled' | 'manual' | 'model_update' = 'scheduled',
  ): Promise<BaselineSnapshot> {
    const now = new Date();
    const windowEnd = new Date(now);
    windowEnd.setHours(0, 0, 0, 0); // Start of today

    const windowStart = new Date(windowEnd);
    windowStart.setDate(windowStart.getDate() - this.config.windowDays);

    // Get aggregates for the window
    const aggregates = await this.aggregateReader.getRange(organizationId, windowStart, windowEnd);

    // Check if org has enough data
    if (aggregates.length < this.config.minDaysRequired && organizationId !== SYSTEM_ORG_ID) {
      // Fall back to global baseline
      return this.calculateBaseline(SYSTEM_ORG_ID, triggeredBy);
    }

    // Calculate baselines for each signal
    const signals: Record<BaselineSignal, SignalBaseline> = {} as Record<
      BaselineSignal,
      SignalBaseline
    >;

    for (const signal of BASELINE_SIGNALS) {
      const values = this.extractSignalValues(aggregates, signal);
      signals[signal] = this.calculateSignalBaseline(signal, values);
    }

    // Calculate rate baselines
    const rates = this.calculateRateBaselines(aggregates);

    const snapshot: BaselineSnapshot = {
      organizationId,
      calculatedAt: now,
      windowStart,
      windowEnd,
      daysIncluded: aggregates.length,
      signals,
      rates,
      metadata: {
        calculationMethod: 'rolling_7day',
        triggeredBy,
      },
    };

    // Save to storage
    await this.saveSnapshot(snapshot);

    return snapshot;
  }

  /**
   * Get effective baseline for an organization
   *
   * Resolution order:
   * 1. Cache (if available)
   * 2. Org-specific baseline from DB (if exists)
   * 3. Global baseline from DB
   * 4. Computed on-the-fly if no stored baseline
   */
  async getEffectiveBaseline(organizationId: string): Promise<BaselineSnapshot | null> {
    // Try cache first
    if (this.cache) {
      const cached = await this.cache.getAll(organizationId);
      if (cached.length > 0) {
        return this.snapshotFromCached(organizationId, cached);
      }

      // Try global cache
      if (organizationId !== SYSTEM_ORG_ID) {
        const globalCached = await this.cache.getAll(SYSTEM_ORG_ID);
        if (globalCached.length > 0) {
          return this.snapshotFromCached(SYSTEM_ORG_ID, globalCached);
        }
      }
    }

    // Check if org has its own baselines in DB
    const orgBaselines = await this.store.getAllLatest(organizationId);

    if (orgBaselines.length > 0) {
      const snapshot = this.snapshotFromStored(organizationId, orgBaselines);
      // Cache for future reads (fire and forget)
      this.cacheSnapshot(snapshot).catch(() => {});
      return snapshot;
    }

    // Fall back to global
    if (organizationId !== SYSTEM_ORG_ID) {
      const globalBaselines = await this.store.getAllLatest(SYSTEM_ORG_ID);
      if (globalBaselines.length > 0) {
        const snapshot = this.snapshotFromStored(SYSTEM_ORG_ID, globalBaselines);
        // Cache for future reads (fire and forget)
        this.cacheSnapshot(snapshot).catch(() => {});
        return snapshot;
      }
    }

    // No stored baselines - calculate on-the-fly
    return this.calculateBaseline(organizationId, 'manual');
  }

  /**
   * Check if current value exceeds baseline thresholds
   */
  async checkThreshold(
    organizationId: string,
    signalName: BaselineSignal,
    currentValue: number,
  ): Promise<{ status: 'normal' | 'warning' | 'critical'; baseline: StoredBaseline | null }> {
    const baseline = await this.store.getLatest(organizationId, signalName);

    if (!baseline) {
      // Try global
      const globalBaseline = await this.store.getLatest(SYSTEM_ORG_ID, signalName);
      if (!globalBaseline) {
        return { status: 'normal', baseline: null };
      }
      return this.evaluateThreshold(currentValue, globalBaseline);
    }

    return this.evaluateThreshold(currentValue, baseline);
  }

  /**
   * Recalculate baselines for all organizations
   *
   * Typically called by scheduled job (weekly) or after model update.
   */
  async recalculateAll(
    organizationIds: string[],
    triggeredBy: 'scheduled' | 'manual' | 'model_update',
  ): Promise<Map<string, BaselineSnapshot>> {
    const results = new Map<string, BaselineSnapshot>();

    // Always calculate global first
    const globalSnapshot = await this.calculateBaseline(SYSTEM_ORG_ID, triggeredBy);
    results.set(SYSTEM_ORG_ID, globalSnapshot);

    // Calculate for each org
    for (const orgId of organizationIds) {
      if (orgId === SYSTEM_ORG_ID) continue;

      try {
        const snapshot = await this.calculateBaseline(orgId, triggeredBy);
        results.set(orgId, snapshot);
      } catch (error) {
        // Log error but continue with other orgs
        console.error(`Failed to calculate baseline for org ${orgId}:`, error);
      }
    }

    return results;
  }

  /**
   * Check if organization is stabilized (has enough historical data)
   */
  async isOrgStabilized(organizationId: string): Promise<boolean> {
    const stabilizationStart = new Date();
    stabilizationStart.setDate(stabilizationStart.getDate() - this.config.orgStabilizationDays);

    const aggregates = await this.aggregateReader.getRange(
      organizationId,
      stabilizationStart,
      new Date(),
    );

    return aggregates.length >= this.config.orgStabilizationDays * 0.7; // 70% fill rate
  }

  // =========================================================================
  // Private Methods
  // =========================================================================

  private extractSignalValues(aggregates: DailyAuditAggregate[], signal: BaselineSignal): number[] {
    return aggregates.map((agg) => {
      switch (signal) {
        case 'request_count':
          return agg.requestCount;
        case 'approved_count':
          return agg.approvedCount;
        case 'hard_stop_count':
          return agg.hardStopCount;
        case 'route_to_clinician_count':
          return agg.routeToClinicianCount;
        case 'request_more_info_count':
          return agg.requestMoreInfoCount;
        case 'validation_failure_count':
          return agg.validationFailureCount;
        case 'high_uncertainty_count':
          return agg.highUncertaintyCount;
        case 'missing_evidence_count':
          return agg.missingEvidenceCount;
        case 'htv_below_threshold_count':
          return agg.htvBelowThresholdCount;
        case 'policy_violation_count':
          return agg.policyViolationCount;
        default:
          return 0;
      }
    });
  }

  private calculateSignalBaseline(signalName: BaselineSignal, values: number[]): SignalBaseline {
    if (values.length === 0) {
      return {
        signalName,
        baselineValue: 0,
        warningThreshold: 0,
        criticalThreshold: 0,
        sampleCount: 0,
        stdDev: 0,
      };
    }

    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;

    // Calculate standard deviation
    const squaredDiffs = values.map((v) => (v - mean) ** 2);
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(avgSquaredDiff);

    return {
      signalName,
      baselineValue: mean,
      warningThreshold: mean * this.config.warningMultiplier,
      criticalThreshold: mean * this.config.criticalMultiplier,
      sampleCount: values.length,
      stdDev,
    };
  }

  private calculateRateBaselines(
    aggregates: DailyAuditAggregate[],
  ): Partial<Record<string, SignalBaseline>> {
    const rates: Partial<Record<string, SignalBaseline>> = {};

    // Calculate rate for each day, then average
    const rateArrays: Record<string, number[]> = {
      approved_rate: [],
      hard_stop_rate: [],
      route_to_clinician_rate: [],
      request_more_info_rate: [],
      high_uncertainty_rate: [],
      validation_failure_rate: [],
    };

    for (const agg of aggregates) {
      if (agg.requestCount === 0) continue;

      rateArrays.approved_rate.push(agg.approvedCount / agg.requestCount);
      rateArrays.hard_stop_rate.push(agg.hardStopCount / agg.requestCount);
      rateArrays.route_to_clinician_rate.push(agg.routeToClinicianCount / agg.requestCount);
      rateArrays.request_more_info_rate.push(agg.requestMoreInfoCount / agg.requestCount);
      rateArrays.high_uncertainty_rate.push(agg.highUncertaintyCount / agg.requestCount);
      rateArrays.validation_failure_rate.push(agg.validationFailureCount / agg.requestCount);
    }

    for (const [rateName, values] of Object.entries(rateArrays)) {
      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        const mean = sum / values.length;
        const squaredDiffs = values.map((v) => (v - mean) ** 2);
        const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
        const stdDev = Math.sqrt(avgSquaredDiff);

        rates[rateName] = {
          signalName: rateName as BaselineSignal,
          baselineValue: mean,
          // For rates, thresholds are additive, not multiplicative
          warningThreshold: Math.min(1, mean + stdDev * 2),
          criticalThreshold: Math.min(1, mean + stdDev * 3),
          sampleCount: values.length,
          stdDev,
        };
      }
    }

    return rates;
  }

  private async saveSnapshot(snapshot: BaselineSnapshot): Promise<void> {
    const baselines: NewBaseline[] = [];
    const now = snapshot.calculatedAt;

    // Save signal baselines
    for (const [signal, baseline] of Object.entries(snapshot.signals)) {
      baselines.push({
        organizationId: snapshot.organizationId,
        signalName: signal,
        baselineValue: baseline.baselineValue,
        warningThreshold: baseline.warningThreshold,
        criticalThreshold: baseline.criticalThreshold,
        sampleCount: baseline.sampleCount,
        calculatedAt: now,
        metadata: {
          stdDev: baseline.stdDev,
          windowDays: this.config.windowDays,
          ...snapshot.metadata,
        },
      });
    }

    // Save rate baselines
    for (const [rate, baseline] of Object.entries(snapshot.rates)) {
      if (baseline) {
        baselines.push({
          organizationId: snapshot.organizationId,
          signalName: rate,
          baselineValue: baseline.baselineValue,
          warningThreshold: baseline.warningThreshold,
          criticalThreshold: baseline.criticalThreshold,
          sampleCount: baseline.sampleCount,
          calculatedAt: now,
          metadata: {
            stdDev: baseline.stdDev,
            isRate: true,
            ...snapshot.metadata,
          },
        });
      }
    }

    await this.store.saveBatch(baselines);

    // Invalidate and update cache
    await this.cacheSnapshot(snapshot);
  }

  /**
   * Cache a baseline snapshot
   */
  private async cacheSnapshot(snapshot: BaselineSnapshot): Promise<void> {
    if (!this.cache) return;

    // Invalidate old cache first
    await this.cache.deleteAll(snapshot.organizationId);

    const cached: CachedBaseline[] = [];

    // Cache signal baselines
    for (const [signal, baseline] of Object.entries(snapshot.signals)) {
      cached.push({
        organizationId: snapshot.organizationId,
        signalName: signal,
        baselineValue: baseline.baselineValue,
        warningThreshold: baseline.warningThreshold,
        criticalThreshold: baseline.criticalThreshold,
        sampleCount: baseline.sampleCount,
        calculatedAt: snapshot.calculatedAt.toISOString(),
        metadata: { stdDev: baseline.stdDev },
      });
    }

    // Cache rate baselines
    for (const [rate, baseline] of Object.entries(snapshot.rates)) {
      if (baseline) {
        cached.push({
          organizationId: snapshot.organizationId,
          signalName: rate,
          baselineValue: baseline.baselineValue,
          warningThreshold: baseline.warningThreshold,
          criticalThreshold: baseline.criticalThreshold,
          sampleCount: baseline.sampleCount,
          calculatedAt: snapshot.calculatedAt.toISOString(),
          metadata: { stdDev: baseline.stdDev, isRate: true },
        });
      }
    }

    await this.cache.setAll(cached);
  }

  /**
   * Build snapshot from cached baselines
   */
  private snapshotFromCached(organizationId: string, cached: CachedBaseline[]): BaselineSnapshot {
    const signals: Record<BaselineSignal, SignalBaseline> = {} as Record<
      BaselineSignal,
      SignalBaseline
    >;
    const rates: Partial<Record<string, SignalBaseline>> = {};

    let latestCalculatedAt: Date | null = null;

    for (const baseline of cached) {
      const calculatedAt = new Date(baseline.calculatedAt);
      if (!latestCalculatedAt || calculatedAt > latestCalculatedAt) {
        latestCalculatedAt = calculatedAt;
      }

      const signalBaseline: SignalBaseline = {
        signalName: baseline.signalName as BaselineSignal,
        baselineValue: baseline.baselineValue,
        warningThreshold: baseline.warningThreshold,
        criticalThreshold: baseline.criticalThreshold,
        sampleCount: baseline.sampleCount,
        stdDev: (baseline.metadata?.stdDev as number) ?? 0,
      };

      if (BASELINE_SIGNALS.includes(baseline.signalName as BaselineSignal)) {
        signals[baseline.signalName as BaselineSignal] = signalBaseline;
      } else {
        rates[baseline.signalName] = signalBaseline;
      }
    }

    const calculatedAt = latestCalculatedAt ?? new Date();
    const windowEnd = new Date(calculatedAt);
    const windowStart = new Date(windowEnd);
    windowStart.setDate(windowStart.getDate() - this.config.windowDays);

    return {
      organizationId,
      calculatedAt,
      windowStart,
      windowEnd,
      daysIncluded: this.config.windowDays,
      signals,
      rates,
      metadata: {
        calculationMethod: 'rolling_7day',
        triggeredBy: 'scheduled',
      },
    };
  }

  private snapshotFromStored(
    organizationId: string,
    baselines: StoredBaseline[],
  ): BaselineSnapshot {
    const signals: Record<BaselineSignal, SignalBaseline> = {} as Record<
      BaselineSignal,
      SignalBaseline
    >;
    const rates: Partial<Record<string, SignalBaseline>> = {};

    let latestCalculatedAt: Date | null = null;

    for (const baseline of baselines) {
      if (!latestCalculatedAt || baseline.calculatedAt > latestCalculatedAt) {
        latestCalculatedAt = baseline.calculatedAt;
      }

      const signalBaseline: SignalBaseline = {
        signalName: baseline.signalName as BaselineSignal,
        baselineValue: baseline.baselineValue,
        warningThreshold: baseline.warningThreshold,
        criticalThreshold: baseline.criticalThreshold,
        sampleCount: baseline.sampleCount,
        stdDev: (baseline.metadata?.stdDev as number) ?? 0,
      };

      if (BASELINE_SIGNALS.includes(baseline.signalName as BaselineSignal)) {
        signals[baseline.signalName as BaselineSignal] = signalBaseline;
      } else {
        // It's a rate
        rates[baseline.signalName] = signalBaseline;
      }
    }

    const calculatedAt = latestCalculatedAt ?? new Date();
    const windowEnd = new Date(calculatedAt);
    const windowStart = new Date(windowEnd);
    windowStart.setDate(windowStart.getDate() - this.config.windowDays);

    return {
      organizationId,
      calculatedAt,
      windowStart,
      windowEnd,
      daysIncluded: this.config.windowDays,
      signals,
      rates,
      metadata: {
        calculationMethod: 'rolling_7day',
        triggeredBy: 'scheduled',
      },
    };
  }

  private evaluateThreshold(
    currentValue: number,
    baseline: StoredBaseline,
  ): { status: 'normal' | 'warning' | 'critical'; baseline: StoredBaseline } {
    if (currentValue >= baseline.criticalThreshold) {
      return { status: 'critical', baseline };
    }
    if (currentValue >= baseline.warningThreshold) {
      return { status: 'warning', baseline };
    }
    return { status: 'normal', baseline };
  }
}
