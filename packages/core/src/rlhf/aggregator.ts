/**
 * RLHF Feedback Aggregator
 *
 * Aggregates clinician feedback for RLHF loop closure.
 * Per spec §5.9.6: Produces de-identified feedback bundles.
 *
 * @see docs/specs/02-popper-specs/01-popper-system-spec.md §5.9.6
 * @module rlhf/aggregator
 */

import { randomUUID } from 'node:crypto';
import {
  type AccuracyMetrics,
  type AlertFatigueMetrics,
  type BiasSignal,
  DEFAULT_RLHF_CONFIG,
  type GenerateBundleRequest,
  type IFeedbackBundleStore,
  type OverrideSignal,
  type PolicyRecommendation,
  type RLHFAggregatorConfig,
  type RLHFFeedbackBundle,
  type StoredFeedbackBundle,
} from './types';

/**
 * Interface for audit event store (for reading aggregation data)
 */
export interface IAuditEventReader {
  /**
   * Get override counts by proposal kind and action
   */
  getOverrideCounts(
    organizationId: string | null,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<OverrideSignal[]>;

  /**
   * Get accuracy metrics from validation results
   */
  getAccuracyMetrics(
    organizationId: string | null,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<AccuracyMetrics>;

  /**
   * Get alert fatigue metrics
   */
  getAlertFatigueMetrics(
    organizationId: string | null,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<AlertFatigueMetrics | null>;

  /**
   * Get bias detection signals
   */
  getBiasSignals(
    organizationId: string | null,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<BiasSignal[]>;

  /**
   * Get total event count for the period
   */
  getEventCount(organizationId: string | null, periodStart: Date, periodEnd: Date): Promise<number>;
}

/**
 * Interface for baseline reader (for policy recommendations)
 */
export interface IBaselineReader {
  /**
   * Get current baselines for comparison
   */
  getBaselines(organizationId: string): Promise<{
    rates: Record<string, number>;
    signals: Record<string, number>;
  } | null>;
}

/**
 * RLHF Feedback Aggregator
 *
 * Collects clinician feedback signals and generates de-identified
 * feedback bundles for policy tuning and model improvement.
 */
export class RLHFFeedbackAggregator {
  private readonly config: RLHFAggregatorConfig;
  private readonly bundleStore: IFeedbackBundleStore;
  private readonly auditReader: IAuditEventReader;
  private readonly baselineReader: IBaselineReader | null;

  constructor(params: {
    config?: Partial<RLHFAggregatorConfig>;
    bundleStore: IFeedbackBundleStore;
    auditReader: IAuditEventReader;
    baselineReader?: IBaselineReader;
  }) {
    this.config = { ...DEFAULT_RLHF_CONFIG, ...params.config };
    this.bundleStore = params.bundleStore;
    this.auditReader = params.auditReader;
    this.baselineReader = params.baselineReader ?? null;
  }

  /**
   * Generate a new RLHF feedback bundle
   *
   * Per spec §5.9.6: Aggregates signals from the period and
   * produces de-identified bundle with recommendations.
   */
  async generateBundle(request: GenerateBundleRequest): Promise<StoredFeedbackBundle> {
    const now = new Date();
    const periodEnd = request.periodEnd ?? now;
    const periodStart =
      request.periodStart ??
      new Date(now.getTime() - this.config.defaultPeriodDays * 24 * 60 * 60 * 1000);
    const organizationId = request.organizationId ?? null;

    // Collect all signals in parallel
    const [overrideSignals, accuracyMetrics, alertFatigueMetrics, biasSignals, totalEvents] =
      await Promise.all([
        this.auditReader.getOverrideCounts(organizationId, periodStart, periodEnd),
        this.auditReader.getAccuracyMetrics(organizationId, periodStart, periodEnd),
        this.auditReader.getAlertFatigueMetrics(organizationId, periodStart, periodEnd),
        this.auditReader.getBiasSignals(organizationId, periodStart, periodEnd),
        this.auditReader.getEventCount(organizationId, periodStart, periodEnd),
      ]);

    // Generate policy recommendations based on collected signals
    const recommendations = await this.generateRecommendations(
      organizationId,
      overrideSignals,
      accuracyMetrics,
      biasSignals,
    );

    // Build the bundle
    const bundleId = randomUUID();
    const bundle: RLHFFeedbackBundle = {
      bundleId,
      organizationId,
      period: {
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
      },
      generatedAt: now.toISOString(),
      triggeredBy: request.triggeredBy,
      overrideSignals,
      accuracyMetrics,
      alertFatigueMetrics: alertFatigueMetrics ?? undefined,
      biasSignals: biasSignals.length > 0 ? biasSignals : undefined,
      recommendations,
      metadata: {
        totalEventsAnalyzed: totalEvents,
        notes: request.notes,
      },
    };

    // Store the bundle
    const storedBundle: StoredFeedbackBundle = {
      id: bundleId,
      organizationId,
      periodStart,
      periodEnd,
      generatedAt: now,
      triggeredBy: request.triggeredBy,
      bundleData: bundle,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    return this.bundleStore.save(storedBundle);
  }

  /**
   * Generate policy tuning recommendations
   *
   * Per spec §5.9.6: Recommendations are advisory only.
   * Human review is required before policy changes.
   */
  private async generateRecommendations(
    _organizationId: string | null,
    overrideSignals: OverrideSignal[],
    accuracyMetrics: AccuracyMetrics,
    biasSignals: BiasSignal[],
  ): Promise<PolicyRecommendation[]> {
    const recommendations: PolicyRecommendation[] = [];

    // Skip if not enough samples
    const totalSamples = overrideSignals.reduce((sum, s) => sum + s.count, 0);
    if (totalSamples < this.config.minSamplesForRecommendation) {
      return recommendations;
    }

    // Analyze override patterns by proposal kind
    const overridesByKind = new Map<string, { accepted: number; rejected: number }>();
    for (const signal of overrideSignals) {
      const current = overridesByKind.get(signal.proposalKind) ?? { accepted: 0, rejected: 0 };
      if (signal.overrideAction === 'accepted') {
        current.accepted += signal.count;
      } else {
        current.rejected += signal.count;
      }
      overridesByKind.set(signal.proposalKind, current);
    }

    // Generate recommendations based on override rates
    for (const [proposalKind, counts] of overridesByKind) {
      const total = counts.accepted + counts.rejected;
      if (total < 10) continue; // Need minimum samples per kind

      const overrideRate = counts.rejected / total;

      // High rejection rate suggests threshold is too strict
      if (overrideRate > this.config.overrideRateDeviationThreshold + 0.3) {
        recommendations.push({
          ruleId: `${proposalKind}_threshold`,
          suggestedChange: 'decrease_threshold',
          confidence: Math.min(0.9, overrideRate),
          evidenceCount: total,
          rationale: `High override rejection rate (${(overrideRate * 100).toFixed(1)}%) suggests threshold may be too strict`,
        });
      }
      // Very low rejection rate with high acceptance might mean threshold is too loose
      else if (overrideRate < 0.05 && counts.accepted > 50) {
        recommendations.push({
          ruleId: `${proposalKind}_threshold`,
          suggestedChange: 'review',
          confidence: 0.6,
          evidenceCount: total,
          rationale: `Very low override rejection rate with high volume - consider reviewing threshold effectiveness`,
        });
      }
    }

    // Add recommendation if accuracy is low
    if (
      accuracyMetrics.totalValidated >= this.config.minSamplesForRecommendation &&
      accuracyMetrics.accuracyRate < 0.8
    ) {
      recommendations.push({
        ruleId: 'validation_accuracy',
        suggestedChange: 'review',
        confidence: 1 - accuracyMetrics.accuracyRate,
        evidenceCount: accuracyMetrics.totalValidated,
        rationale: `Accuracy rate (${(accuracyMetrics.accuracyRate * 100).toFixed(1)}%) below 80% threshold`,
      });
    }

    // Add recommendations for detected bias
    for (const bias of biasSignals) {
      if (Math.abs(bias.rateDeviation) > this.config.overrideRateDeviationThreshold) {
        recommendations.push({
          ruleId: `bias_${bias.biasType}_${bias.affectedGroup.replace(/\s+/g, '_').toLowerCase()}`,
          suggestedChange: 'review',
          confidence: Math.min(0.95, Math.abs(bias.rateDeviation) * 2),
          evidenceCount: bias.affectedCount,
          rationale: `Detected ${bias.biasType} bias affecting ${bias.affectedGroup} (${(bias.rateDeviation * 100).toFixed(1)}% deviation)`,
        });
      }
    }

    // Sort by confidence descending
    return recommendations.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get the latest bundle for an organization
   */
  async getLatestBundle(organizationId: string | null): Promise<StoredFeedbackBundle | null> {
    return this.bundleStore.getLatest(organizationId);
  }

  /**
   * List bundles for an organization
   */
  async listBundles(
    organizationId: string | null,
    limit?: number,
  ): Promise<StoredFeedbackBundle[]> {
    return this.bundleStore.list(organizationId, limit);
  }

  /**
   * Get a specific bundle by ID
   */
  async getBundle(bundleId: string): Promise<StoredFeedbackBundle | null> {
    return this.bundleStore.getById(bundleId);
  }

  /**
   * Mark a bundle as processed
   */
  async markProcessed(bundleId: string): Promise<StoredFeedbackBundle | null> {
    return this.bundleStore.updateStatus(bundleId, 'processed');
  }

  /**
   * Archive a bundle
   */
  async archiveBundle(bundleId: string): Promise<StoredFeedbackBundle | null> {
    return this.bundleStore.updateStatus(bundleId, 'archived');
  }

  /**
   * Check if auto-export should be triggered
   *
   * Per spec §5.9.6: Triggers when >100 validation samples collected
   */
  async shouldAutoExport(organizationId: string | null): Promise<boolean> {
    const lastBundle = await this.bundleStore.getLatest(organizationId);
    const since = lastBundle?.periodEnd ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const eventCount = await this.auditReader.getEventCount(organizationId, since, new Date());

    return eventCount >= this.config.sampleThresholdForAutoExport;
  }
}
