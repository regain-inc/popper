/**
 * RLHF In-Memory Stores
 *
 * In-memory implementations for testing and development.
 *
 * @module rlhf/stores
 */

import type { IAuditEventReader } from './aggregator';
import type {
  AccuracyMetrics,
  AlertFatigueMetrics,
  BiasSignal,
  IFeedbackBundleStore,
  OverrideSignal,
  StoredFeedbackBundle,
} from './types';

/**
 * In-memory feedback bundle store
 */
export class InMemoryFeedbackBundleStore implements IFeedbackBundleStore {
  private bundles: Map<string, StoredFeedbackBundle> = new Map();

  async save(bundle: StoredFeedbackBundle): Promise<StoredFeedbackBundle> {
    this.bundles.set(bundle.id, bundle);
    return bundle;
  }

  async getById(id: string): Promise<StoredFeedbackBundle | null> {
    return this.bundles.get(id) ?? null;
  }

  async list(organizationId: string | null, limit = 10): Promise<StoredFeedbackBundle[]> {
    const filtered = Array.from(this.bundles.values())
      .filter((b) => b.organizationId === organizationId)
      .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());

    return filtered.slice(0, limit);
  }

  async updateStatus(
    id: string,
    status: 'pending' | 'processed' | 'archived',
  ): Promise<StoredFeedbackBundle | null> {
    const bundle = this.bundles.get(id);
    if (!bundle) return null;

    bundle.status = status;
    bundle.updatedAt = new Date();
    this.bundles.set(id, bundle);
    return bundle;
  }

  async getLatest(organizationId: string | null): Promise<StoredFeedbackBundle | null> {
    const bundles = await this.list(organizationId, 1);
    return bundles[0] ?? null;
  }

  /**
   * Clear all bundles (for testing)
   */
  clear(): void {
    this.bundles.clear();
  }
}

/**
 * Mock audit event reader for testing
 *
 * Returns empty/default data. Replace with real implementation
 * that queries the audit_events table.
 */
export class MockAuditEventReader implements IAuditEventReader {
  private overrideSignals: OverrideSignal[] = [];
  private accuracyMetrics: AccuracyMetrics = {
    totalValidated: 0,
    accurateCount: 0,
    hallucinationCount: 0,
    missingEvidenceCount: 0,
    accuracyRate: 0,
  };
  private alertFatigueMetrics: AlertFatigueMetrics | null = null;
  private biasSignals: BiasSignal[] = [];
  private eventCount = 0;

  /**
   * Set override signals for testing
   */
  setOverrideSignals(signals: OverrideSignal[]): void {
    this.overrideSignals = signals;
  }

  /**
   * Set accuracy metrics for testing
   */
  setAccuracyMetrics(metrics: AccuracyMetrics): void {
    this.accuracyMetrics = metrics;
  }

  /**
   * Set alert fatigue metrics for testing
   */
  setAlertFatigueMetrics(metrics: AlertFatigueMetrics | null): void {
    this.alertFatigueMetrics = metrics;
  }

  /**
   * Set bias signals for testing
   */
  setBiasSignals(signals: BiasSignal[]): void {
    this.biasSignals = signals;
  }

  /**
   * Set event count for testing
   */
  setEventCount(count: number): void {
    this.eventCount = count;
  }

  async getOverrideCounts(): Promise<OverrideSignal[]> {
    return this.overrideSignals;
  }

  async getAccuracyMetrics(): Promise<AccuracyMetrics> {
    return this.accuracyMetrics;
  }

  async getAlertFatigueMetrics(): Promise<AlertFatigueMetrics | null> {
    return this.alertFatigueMetrics;
  }

  async getBiasSignals(): Promise<BiasSignal[]> {
    return this.biasSignals;
  }

  async getEventCount(): Promise<number> {
    return this.eventCount;
  }
}
