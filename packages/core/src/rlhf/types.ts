/**
 * RLHF Feedback Loop Types
 *
 * Types for RLHF (Reinforcement Learning from Human Feedback) implementation.
 * Enables continuous learning through clinician feedback aggregation.
 *
 * Per spec §5.9.6: Popper MUST support continuous learning and
 * human-in-the-loop feedback (RLHF) per ARPA-H TA2 requirements (§2.F).
 *
 * @see docs/specs/02-popper-specs/01-popper-system-spec.md §5.9.6
 * @module rlhf/types
 */

/**
 * Override signal types
 */
export type OverrideAction = 'accepted' | 'rejected';

/**
 * Policy tuning recommendation types
 */
export type RecommendedChange = 'increase_threshold' | 'decrease_threshold' | 'review';

/**
 * Aggregated override signal (de-identified)
 */
export interface OverrideSignal {
  /** Type of proposal that was overridden */
  proposalKind: string;
  /** Whether override was accepted or rejected */
  overrideAction: OverrideAction;
  /** Categorized rationale from clinician */
  rationaleCategory: string;
  /** Count of this signal type in the period */
  count: number;
}

/**
 * Accuracy metrics from validation
 */
export interface AccuracyMetrics {
  /** Total proposals validated */
  totalValidated: number;
  /** Proposals marked accurate */
  accurateCount: number;
  /** Proposals with hallucinations detected */
  hallucinationCount: number;
  /** Proposals with missing evidence */
  missingEvidenceCount: number;
  /** Overall accuracy rate (0-1) */
  accuracyRate: number;
}

/**
 * Alert fatigue metrics
 */
export interface AlertFatigueMetrics {
  /** 30-day override rate */
  overrideRate30d: number;
  /** Average clinician response time in seconds */
  avgResponseTimeSeconds: number;
  /** Proposals auto-dismissed after timeout */
  autoDismissedCount: number;
}

/**
 * Bias detection signal
 */
export interface BiasSignal {
  /** Type of bias detected */
  biasType: 'age' | 'gender' | 'ethnicity' | 'insurance' | 'other';
  /** Description of the affected group */
  affectedGroup: string;
  /** Override rate deviation from baseline */
  rateDeviation: number;
  /** Count of affected proposals */
  affectedCount: number;
}

/**
 * Policy tuning recommendation
 */
export interface PolicyRecommendation {
  /** Rule ID in the policy pack */
  ruleId: string;
  /** Suggested change type */
  suggestedChange: RecommendedChange;
  /** Confidence level (0-1) */
  confidence: number;
  /** Number of evidence samples supporting this recommendation */
  evidenceCount: number;
  /** Explanation for the recommendation */
  rationale: string;
}

/**
 * Complete RLHF Feedback Bundle (de-identified)
 *
 * Per spec: Must contain NO PHI (no subject_id, only aggregate counts)
 */
export interface RLHFFeedbackBundle {
  /** Unique bundle identifier */
  bundleId: string;
  /** Organization ID (or null for global) */
  organizationId: string | null;
  /** Period covered by this bundle */
  period: {
    start: string;
    end: string;
  };
  /** When bundle was generated */
  generatedAt: string;
  /** Trigger for this export */
  triggeredBy: 'drift_detected' | 'scheduled' | 'manual' | 'sample_threshold';

  /** Aggregated override signals (no PHI) */
  overrideSignals: OverrideSignal[];

  /** Accuracy metrics from validation */
  accuracyMetrics: AccuracyMetrics;

  /** Alert fatigue metrics */
  alertFatigueMetrics?: AlertFatigueMetrics;

  /** Bias detection signals */
  biasSignals?: BiasSignal[];

  /** Policy tuning recommendations (advisory only) */
  recommendations: PolicyRecommendation[];

  /** Bundle metadata */
  metadata: {
    /** Total audit events analyzed */
    totalEventsAnalyzed: number;
    /** Policy pack version used */
    policyPackVersion?: string;
    /** Baseline snapshot used for comparison */
    baselineSnapshotId?: string;
    /** Notes */
    notes?: string;
  };
}

/**
 * Stored feedback bundle record
 */
export interface StoredFeedbackBundle {
  id: string;
  organizationId: string | null;
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
  triggeredBy: string;
  bundleData: RLHFFeedbackBundle;
  status: 'pending' | 'processed' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Request to generate a feedback bundle
 */
export interface GenerateBundleRequest {
  /** Organization ID (null for global) */
  organizationId?: string | null;
  /** Start of period (defaults to 7 days ago) */
  periodStart?: Date;
  /** End of period (defaults to now) */
  periodEnd?: Date;
  /** Trigger reason */
  triggeredBy: 'drift_detected' | 'scheduled' | 'manual' | 'sample_threshold';
  /** Optional notes */
  notes?: string;
}

/**
 * Interface for feedback bundle storage
 */
export interface IFeedbackBundleStore {
  /** Save a new bundle */
  save(bundle: StoredFeedbackBundle): Promise<StoredFeedbackBundle>;
  /** Get bundle by ID */
  getById(id: string): Promise<StoredFeedbackBundle | null>;
  /** List bundles for organization */
  list(organizationId: string | null, limit?: number): Promise<StoredFeedbackBundle[]>;
  /** Update bundle status */
  updateStatus(
    id: string,
    status: 'pending' | 'processed' | 'archived',
  ): Promise<StoredFeedbackBundle | null>;
  /** Get latest bundle for organization */
  getLatest(organizationId: string | null): Promise<StoredFeedbackBundle | null>;
}

/**
 * Configuration for RLHF feedback aggregator
 */
export interface RLHFAggregatorConfig {
  /** Minimum samples before generating recommendations */
  minSamplesForRecommendation: number;
  /** Confidence threshold for recommendations */
  confidenceThreshold: number;
  /** Override rate deviation threshold for alerts */
  overrideRateDeviationThreshold: number;
  /** Default export period in days */
  defaultPeriodDays: number;
  /** Sample threshold to trigger auto-export */
  sampleThresholdForAutoExport: number;
}

/**
 * Default RLHF aggregator configuration
 */
export const DEFAULT_RLHF_CONFIG: RLHFAggregatorConfig = {
  minSamplesForRecommendation: 50,
  confidenceThreshold: 0.7,
  overrideRateDeviationThreshold: 0.2,
  defaultPeriodDays: 7,
  sampleThresholdForAutoExport: 100,
};
