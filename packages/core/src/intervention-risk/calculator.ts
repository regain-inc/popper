/**
 * Intervention Risk Calculator
 *
 * Per-proposal deterministic risk scoring. Each proposal gets its own
 * risk level based on kind, epistemological quality, data sufficiency,
 * clinical context, and (for medications) drug-specific factors.
 *
 * No LLM calls — pure computation from request data.
 *
 * @see SAL-1020
 * @module intervention-risk/calculator
 */

import { PROPOSAL_KIND_RISK } from '../acuity/types';
import type { ProposedIntervention, SupervisionRequest } from '../hermes';
import type {
  InterventionRiskConfig,
  InterventionRiskContext,
  InterventionRiskFactor,
  InterventionRiskLevel,
  InterventionRiskScore,
} from './types';
import {
  DEFAULT_INTERVENTION_RISK_CONFIG,
  MEDICATION_CHANGE_RISK,
  RISK_LEVEL_PRECEDENCE,
} from './types';

// =============================================================================
// Public API
// =============================================================================

/**
 * Calculate risk score for a single proposal.
 */
export function calculateInterventionRisk(
  proposal: ProposedIntervention,
  request: SupervisionRequest,
  riskContext: InterventionRiskContext = {},
  config: InterventionRiskConfig = DEFAULT_INTERVENTION_RISK_CONFIG,
): InterventionRiskScore {
  const isMedication = proposal.kind === 'MEDICATION_ORDER_PROPOSAL';

  const factors: InterventionRiskFactor[] = [
    scoreProposalKind(proposal),
    scoreEpistemological(proposal),
    scoreDataSufficiency(request),
    scoreClinicalContext(request, riskContext),
    scoreMedicationFactors(proposal),
  ];

  // For non-medication proposals, redistribute medication_factors weight to proposal_kind
  const weights = isMedication
    ? [
        config.weights.proposal_kind,
        config.weights.epistemological,
        config.weights.data_sufficiency,
        config.weights.clinical_context,
        config.weights.medication_factors,
      ]
    : [
        config.weights.proposal_kind + config.weights.medication_factors,
        config.weights.epistemological,
        config.weights.data_sufficiency,
        config.weights.clinical_context,
        0, // medication_factors weight → 0 for non-medication
      ];

  const composite = factors.reduce((sum, f, i) => sum + f.score * weights[i], 0);
  const level = compositeToLevel(composite, config);

  return {
    proposal_id: proposal.proposal_id,
    proposal_kind: proposal.kind,
    level,
    composite,
    factors,
  };
}

/**
 * Calculate risk scores for all proposals in a request.
 */
export function calculateAllInterventionRisks(
  request: SupervisionRequest,
  riskContext: InterventionRiskContext = {},
  config: InterventionRiskConfig = DEFAULT_INTERVENTION_RISK_CONFIG,
): InterventionRiskScore[] {
  const proposals = request.proposals ?? [];
  return proposals.map((p) => calculateInterventionRisk(p, request, riskContext, config));
}

/**
 * Compare two intervention risk levels.
 * @returns negative if a < b, 0 if equal, positive if a > b
 */
export function compareRiskLevels(a: InterventionRiskLevel, b: InterventionRiskLevel): number {
  return RISK_LEVEL_PRECEDENCE[a] - RISK_LEVEL_PRECEDENCE[b];
}

/**
 * Get the highest risk level from a set of scores.
 */
export function getMaxRiskLevel(scores: InterventionRiskScore[]): InterventionRiskLevel {
  if (scores.length === 0) return 'low';
  return scores.reduce<InterventionRiskLevel>((max, s) => {
    return RISK_LEVEL_PRECEDENCE[s.level] > RISK_LEVEL_PRECEDENCE[max] ? s.level : max;
  }, 'low');
}

// =============================================================================
// Factor Scorers
// =============================================================================

function scoreProposalKind(proposal: ProposedIntervention): InterventionRiskFactor {
  const score = PROPOSAL_KIND_RISK[proposal.kind] ?? 0.1;
  return {
    factor: 'proposal_kind',
    score: clamp(score),
    rationale: `${proposal.kind} base risk`,
  };
}

function scoreEpistemological(proposal: ProposedIntervention): InterventionRiskFactor {
  let score = 0;
  const reasons: string[] = [];

  // HTV score — lower = higher risk
  const htvScore = (proposal as Record<string, unknown>).htv_score as
    | { composite?: number }
    | undefined;

  if (htvScore?.composite !== undefined) {
    if (htvScore.composite < 0.3) {
      score += 0.5;
      reasons.push(`Very low HTV (${htvScore.composite.toFixed(2)})`);
    } else if (htvScore.composite < 0.6) {
      score += 0.25;
      reasons.push(`Low HTV (${htvScore.composite.toFixed(2)})`);
    }
  } else {
    // Missing HTV = conservative
    score += 0.35;
    reasons.push('No HTV score');
  }

  // Evidence refs
  const evidenceRefs = proposal.evidence_refs ?? [];
  if (evidenceRefs.length === 0) {
    score += 0.3;
    reasons.push('No evidence refs');
  }

  // Uncertainty calibration
  const uncertainty = (proposal as Record<string, unknown>).uncertainty_calibration as
    | { overall_level?: string }
    | undefined;

  if (uncertainty?.overall_level === 'high') {
    score += 0.25;
    reasons.push('High uncertainty');
  } else if (!uncertainty) {
    // Missing uncertainty = treat as elevated
    score += 0.15;
    reasons.push('No uncertainty calibration');
  }

  return {
    factor: 'epistemological',
    score: clamp(score),
    rationale: reasons.length > 0 ? reasons.join('; ') : 'Good epistemological quality',
  };
}

function scoreDataSufficiency(request: SupervisionRequest): InterventionRiskFactor {
  const snapshot = request.snapshot as
    | {
        created_at?: string;
        sources?: Array<{ source_type?: string }>;
        quality?: { missing_signals?: string[]; conflicting_signals?: string[] };
      }
    | undefined;

  if (!snapshot?.created_at) {
    return { factor: 'data_sufficiency', score: 1.0, rationale: 'Snapshot missing' };
  }

  let score = 0;
  const reasons: string[] = [];

  // Staleness
  const ageHours = (Date.now() - new Date(snapshot.created_at).getTime()) / (1000 * 60 * 60);
  const isClinical = request.mode === 'advocate_clinical';
  const staleThreshold = isClinical ? 4 : 24;

  if (ageHours > staleThreshold) {
    score += 0.5;
    reasons.push(`Stale (${Math.round(ageHours)}h)`);
  }

  // Source coverage
  const sources = snapshot.sources ?? [];
  if (sources.length === 0) {
    score += 0.3;
    reasons.push('No sources');
  }

  // Quality flags
  const quality = snapshot.quality;
  if (quality?.missing_signals && quality.missing_signals.length > 0) {
    const missingCount = quality.missing_signals.length;
    score += Math.min(0.3, missingCount * 0.1);
    reasons.push(`${missingCount} missing signals`);
  }
  if (quality?.conflicting_signals && quality.conflicting_signals.length > 0) {
    score += 0.2;
    reasons.push(`${quality.conflicting_signals.length} conflicting signals`);
  }

  return {
    factor: 'data_sufficiency',
    score: clamp(score),
    rationale: reasons.length > 0 ? reasons.join('; ') : 'Good data sufficiency',
  };
}

function scoreClinicalContext(
  request: SupervisionRequest,
  riskContext: InterventionRiskContext,
): InterventionRiskFactor {
  let score = 0;
  const reasons: string[] = [];

  // Mode: clinical mode inherently higher risk context
  if (request.mode === 'advocate_clinical') {
    score += 0.3;
    reasons.push('Clinical mode');
  }

  // Patient acuity amplifies risk
  if (riskContext.patientAcuity) {
    const acuityScore = acuityToRiskContribution(riskContext.patientAcuity);
    score += acuityScore;
    if (acuityScore > 0) {
      reasons.push(`Patient acuity: ${riskContext.patientAcuity}`);
    }
  }

  return {
    factor: 'clinical_context',
    score: clamp(score),
    rationale: reasons.length > 0 ? reasons.join('; ') : 'Standard clinical context',
  };
}

function scoreMedicationFactors(proposal: ProposedIntervention): InterventionRiskFactor {
  if (proposal.kind !== 'MEDICATION_ORDER_PROPOSAL') {
    return { factor: 'medication_factors', score: 0, rationale: 'Not a medication proposal' };
  }

  const medProposal = proposal as {
    medication?: { name?: string; rxnorm_code?: string };
    change?: { change_type?: string; from_dose?: string; to_dose?: string };
    clinician_protocol_ref?: string;
  };

  let score = 0;
  const reasons: string[] = [];

  // Change type risk
  const changeType = medProposal.change?.change_type;
  if (changeType) {
    const changeRisk = MEDICATION_CHANGE_RISK[changeType] ?? 0.5;
    score += changeRisk * 0.5; // Scale to 0-0.5 range
    reasons.push(`${changeType} change`);
  } else {
    score += 0.3;
    reasons.push('Unknown change type');
  }

  // Missing protocol reference in medication orders = higher risk
  if (!medProposal.clinician_protocol_ref) {
    score += 0.3;
    reasons.push('No clinician protocol ref');
  }

  // Missing RxNorm code = can't verify interactions
  if (!medProposal.medication?.rxnorm_code) {
    score += 0.15;
    reasons.push('No RxNorm code');
  }

  return {
    factor: 'medication_factors',
    score: clamp(score),
    rationale: reasons.join('; '),
  };
}

// =============================================================================
// Helpers
// =============================================================================

function compositeToLevel(
  composite: number,
  config: InterventionRiskConfig,
): InterventionRiskLevel {
  if (composite >= config.thresholds.critical) return 'critical';
  if (composite >= config.thresholds.high) return 'high';
  if (composite >= config.thresholds.moderate) return 'moderate';
  return 'low';
}

function acuityToRiskContribution(acuity: AcuityLevel): number {
  const map: Record<AcuityLevel, number> = {
    low: 0,
    moderate: 0.15,
    high: 0.35,
    critical: 0.55,
  };
  return map[acuity] ?? 0;
}

function clamp(value: number): number {
  return Math.min(1.0, Math.max(0.0, value));
}
