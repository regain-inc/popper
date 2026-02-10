/**
 * Clinical Acuity Scoring Types
 *
 * Acuity scoring determines patient risk level from a SupervisionRequest.
 * Used by policy rules (acuity_at_least condition) to drive routing decisions.
 *
 * @see SAL-1018
 * @module acuity/types
 */

// =============================================================================
// Acuity Levels
// =============================================================================

/**
 * Clinical acuity levels from lowest to highest risk.
 */
export type AcuityLevel = 'low' | 'moderate' | 'high' | 'critical';

/**
 * Ordered acuity levels for comparison.
 */
export const ACUITY_LEVELS: readonly AcuityLevel[] = [
  'low',
  'moderate',
  'high',
  'critical',
] as const;

/**
 * Numeric precedence for acuity level comparison.
 */
export const ACUITY_PRECEDENCE: Record<AcuityLevel, number> = {
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

// =============================================================================
// Acuity Score
// =============================================================================

/**
 * Individual dimension score (0.0 – 1.0).
 */
export interface AcuityDimensionScore {
  /** Dimension name */
  dimension: string;
  /** Score from 0.0 (lowest risk) to 1.0 (highest risk) */
  score: number;
  /** Brief explanation for audit trail */
  rationale: string;
}

/**
 * Complete acuity score result.
 */
export interface AcuityScore {
  /** Overall acuity level */
  level: AcuityLevel;
  /** Composite score (0.0 – 1.0), weighted average of dimensions */
  composite: number;
  /** Individual dimension scores */
  dimensions: AcuityDimensionScore[];
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Weights for each scoring dimension (must sum to 1.0).
 */
export interface AcuityWeights {
  /** Weight for proposal risk dimension */
  proposal_risk: number;
  /** Weight for data quality dimension */
  data_quality: number;
  /** Weight for epistemological quality dimension */
  epistemological_quality: number;
  /** Weight for conflict severity dimension */
  conflict_severity: number;
}

/**
 * Thresholds for mapping composite score to acuity level.
 */
export interface AcuityThresholds {
  /** Below this → low */
  moderate: number;
  /** Below this → moderate */
  high: number;
  /** At or above this → critical */
  critical: number;
}

/**
 * Full acuity scorer configuration.
 */
export interface AcuityConfig {
  weights: AcuityWeights;
  thresholds: AcuityThresholds;
}

/**
 * Default acuity configuration.
 */
export const DEFAULT_ACUITY_CONFIG: AcuityConfig = {
  weights: {
    proposal_risk: 0.35,
    data_quality: 0.25,
    epistemological_quality: 0.25,
    conflict_severity: 0.15,
  },
  thresholds: {
    moderate: 0.25,
    high: 0.5,
    critical: 0.75,
  },
};

// =============================================================================
// Proposal Risk Mapping
// =============================================================================

/**
 * Risk score for each proposal kind (0.0 – 1.0).
 */
export const PROPOSAL_KIND_RISK: Record<string, number> = {
  MEDICATION_ORDER_PROPOSAL: 1.0,
  TRIAGE_ROUTE: 0.9,
  CARE_NAVIGATION: 0.5,
  BEHAVIORAL_INTERVENTION_PROPOSAL: 0.4,
  NUTRITION_PLAN_PROPOSAL: 0.25,
  LIFESTYLE_MODIFICATION_PROPOSAL: 0.2,
  PATIENT_MESSAGE: 0.15,
  OTHER: 0.1,
};
