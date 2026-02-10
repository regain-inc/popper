/**
 * Intervention Risk Calculator Types
 *
 * Per-proposal risk assessment for clinical interventions.
 * Each proposal gets its own risk score based on proposal kind,
 * epistemological quality, data sufficiency, and clinical context.
 *
 * @see SAL-1020
 * @module intervention-risk/types
 */

import type { AcuityLevel } from '../acuity/types';

// =============================================================================
// Risk Levels
// =============================================================================

/**
 * Intervention risk levels (aligned with acuity levels for consistency).
 */
export type InterventionRiskLevel = 'low' | 'moderate' | 'high' | 'critical';

/**
 * Numeric precedence for risk level comparison.
 */
export const RISK_LEVEL_PRECEDENCE: Record<InterventionRiskLevel, number> = {
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

// =============================================================================
// Risk Score
// =============================================================================

/**
 * Individual risk factor contributing to the total score.
 */
export interface InterventionRiskFactor {
  /** Factor name */
  factor: string;
  /** Score from 0.0 (no risk) to 1.0 (maximum risk) */
  score: number;
  /** Brief explanation for audit trail */
  rationale: string;
}

/**
 * Complete risk score for a single proposal.
 */
export interface InterventionRiskScore {
  /** The proposal this score applies to */
  proposal_id: string;
  /** Proposal kind for reference */
  proposal_kind: string;
  /** Overall risk level */
  level: InterventionRiskLevel;
  /** Composite score (0.0 – 1.0), weighted average of factors */
  composite: number;
  /** Individual contributing factors */
  factors: InterventionRiskFactor[];
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Weights for each risk factor (must sum to 1.0).
 */
export interface InterventionRiskWeights {
  /** Base risk from proposal kind */
  proposal_kind: number;
  /** Epistemological quality (HTV, evidence, uncertainty) */
  epistemological: number;
  /** Data sufficiency (snapshot quality, missing signals) */
  data_sufficiency: number;
  /** Clinical context (mode, patient acuity) */
  clinical_context: number;
  /** Medication-specific factors (only applies to medication proposals) */
  medication_factors: number;
}

/**
 * Thresholds for mapping composite score to risk level.
 */
export interface InterventionRiskThresholds {
  /** Below this → low */
  moderate: number;
  /** Below this → moderate */
  high: number;
  /** At or above this → critical */
  critical: number;
}

/**
 * Full intervention risk calculator configuration.
 */
export interface InterventionRiskConfig {
  weights: InterventionRiskWeights;
  thresholds: InterventionRiskThresholds;
}

/**
 * Default configuration.
 *
 * Weights are designed so medication_factors only contributes
 * for medication proposals (other proposals get 0 on that dimension,
 * and its weight is redistributed to proposal_kind).
 */
export const DEFAULT_INTERVENTION_RISK_CONFIG: InterventionRiskConfig = {
  weights: {
    proposal_kind: 0.25,
    epistemological: 0.25,
    data_sufficiency: 0.2,
    clinical_context: 0.15,
    medication_factors: 0.15,
  },
  thresholds: {
    moderate: 0.25,
    high: 0.5,
    critical: 0.75,
  },
};

// =============================================================================
// Medication Risk Constants
// =============================================================================

/**
 * Risk multiplier for medication change types.
 * 'start' and 'titrate' are higher risk than 'hold' or 'stop'.
 */
export const MEDICATION_CHANGE_RISK: Record<string, number> = {
  start: 1.0,
  titrate: 0.8,
  stop: 0.5,
  hold: 0.3,
};

/**
 * Context for computing intervention risks.
 * Passed alongside the request to provide patient-level context.
 */
export interface InterventionRiskContext {
  /** Patient acuity level (from acuity scorer) */
  patientAcuity?: AcuityLevel;
}
