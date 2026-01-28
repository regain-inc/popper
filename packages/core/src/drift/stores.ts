/**
 * In-memory stores for drift baselines
 *
 * Used for testing and development when PostgreSQL is not available.
 *
 * @module drift/stores
 */

import type {
  BaselineSignal,
  DailyAuditAggregate,
  IBaselineStore,
  IDailyAggregateReader,
  NewBaseline,
  StoredBaseline,
} from './types';

/**
 * In-memory baseline store for testing
 */
export class InMemoryBaselineStore implements IBaselineStore {
  private baselines: Map<string, StoredBaseline[]> = new Map();

  private getKey(organizationId: string, signalName: string): string {
    return `${organizationId}:${signalName}`;
  }

  async getLatest(
    organizationId: string,
    signalName: BaselineSignal,
  ): Promise<StoredBaseline | null> {
    const key = this.getKey(organizationId, signalName);
    const list = this.baselines.get(key);
    if (!list || list.length === 0) {
      return null;
    }
    // Return most recent
    return list[list.length - 1];
  }

  async getAllLatest(organizationId: string): Promise<StoredBaseline[]> {
    const latestBySignal = new Map<string, StoredBaseline>();

    for (const [key, list] of this.baselines) {
      if (key.startsWith(`${organizationId}:`)) {
        const latest = list[list.length - 1];
        if (latest) {
          latestBySignal.set(latest.signalName, latest);
        }
      }
    }

    return Array.from(latestBySignal.values());
  }

  async save(baseline: NewBaseline): Promise<StoredBaseline> {
    const stored: StoredBaseline = {
      organizationId: baseline.organizationId,
      calculatedAt: baseline.calculatedAt ?? new Date(),
      signalName: baseline.signalName,
      baselineValue: baseline.baselineValue,
      warningThreshold: baseline.warningThreshold,
      criticalThreshold: baseline.criticalThreshold,
      sampleCount: baseline.sampleCount,
      metadata: baseline.metadata,
    };

    const key = this.getKey(baseline.organizationId, baseline.signalName);
    const list = this.baselines.get(key) ?? [];
    list.push(stored);
    this.baselines.set(key, list);

    return stored;
  }

  async saveBatch(baselines: NewBaseline[]): Promise<StoredBaseline[]> {
    const results: StoredBaseline[] = [];
    for (const baseline of baselines) {
      const stored = await this.save(baseline);
      results.push(stored);
    }
    return results;
  }

  async getHistory(
    organizationId: string,
    signalName: BaselineSignal,
    limit = 100,
  ): Promise<StoredBaseline[]> {
    const key = this.getKey(organizationId, signalName);
    const list = this.baselines.get(key) ?? [];
    // Return in reverse chronological order
    return list.slice(-limit).reverse();
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.baselines.clear();
  }
}

/**
 * In-memory daily aggregate reader for testing
 *
 * Allows setting test data directly.
 */
export class InMemoryDailyAggregateReader implements IDailyAggregateReader {
  private aggregates: Map<string, DailyAuditAggregate[]> = new Map();

  /**
   * Set test data for an organization
   */
  setAggregates(organizationId: string, data: DailyAuditAggregate[]): void {
    this.aggregates.set(organizationId, data);
  }

  async getRange(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DailyAuditAggregate[]> {
    const all = this.aggregates.get(organizationId) ?? [];
    return all.filter((agg) => agg.bucket >= startDate && agg.bucket <= endDate);
  }

  async getLastNDays(organizationId: string, days: number): Promise<DailyAuditAggregate[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    return this.getRange(organizationId, startDate, endDate);
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.aggregates.clear();
  }

  /**
   * Generate random test data for an organization
   */
  generateTestData(organizationId: string, days: number): void {
    const aggregates: DailyAuditAggregate[] = [];
    const now = new Date();

    for (let i = days; i >= 0; i--) {
      const bucket = new Date(now);
      bucket.setDate(bucket.getDate() - i);
      bucket.setHours(0, 0, 0, 0);

      // Base request count with some variation
      const requestCount = 100 + Math.floor(Math.random() * 50);

      // Generate realistic distribution
      const approvedPct = 0.85 + Math.random() * 0.1; // 85-95%
      const hardStopPct = 0.01 + Math.random() * 0.02; // 1-3%
      const routeToClinicianPct = 0.05 + Math.random() * 0.05; // 5-10%

      const approvedCount = Math.floor(requestCount * approvedPct);
      const hardStopCount = Math.floor(requestCount * hardStopPct);
      const routeToClinicianCount = Math.floor(requestCount * routeToClinicianPct);
      const requestMoreInfoCount =
        requestCount - approvedCount - hardStopCount - routeToClinicianCount;

      aggregates.push({
        bucket,
        organizationId,
        requestCount,
        approvedCount,
        hardStopCount,
        routeToClinicianCount,
        requestMoreInfoCount,
        validationFailureCount: Math.floor(Math.random() * 3),
        highUncertaintyCount: Math.floor(requestCount * (0.02 + Math.random() * 0.03)),
        missingEvidenceCount: Math.floor(Math.random() * 2),
        htvBelowThresholdCount: Math.floor(requestCount * (0.01 + Math.random() * 0.02)),
        policyViolationCount: Math.floor(Math.random() * 2),
        avgLatencyMs: 50 + Math.random() * 30,
        p95LatencyMs: 100 + Math.random() * 50,
        p99LatencyMs: 200 + Math.random() * 100,
      });
    }

    this.aggregates.set(organizationId, aggregates);
  }
}
