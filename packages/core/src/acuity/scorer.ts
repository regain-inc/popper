/**
 * Clinical Acuity Scorer
 *
 * Deterministic scoring of patient risk from a SupervisionRequest.
 * No LLM calls — pure computation from request data.
 *
 * Dimensions:
 * 1. Proposal Risk — based on proposal kinds (medication > lifestyle)
 * 2. Data Quality — based on snapshot freshness and source coverage
 * 3. Epistemological Quality — based on HTV scores, evidence grades, uncertainty
 * 4. Conflict Severity — based on cross-domain conflict count and type
 *
 * @see SAL-1018
 * @module acuity/scorer
 */

import type { EvidenceGrade, SupervisionRequest } from '../hermes';
import { compareEvidenceGrades } from '../hermes';
import type { AcuityConfig, AcuityDimensionScore, AcuityLevel, AcuityScore } from './types';
import { ACUITY_PRECEDENCE, DEFAULT_ACUITY_CONFIG, PROPOSAL_KIND_RISK } from './types';

// =============================================================================
// Scorer
// =============================================================================

/**
 * Compute acuity score from a SupervisionRequest.
 *
 * @param request - Hermes SupervisionRequest
 * @param config - Optional scoring configuration (defaults to DEFAULT_ACUITY_CONFIG)
 * @returns AcuityScore with level, composite, and per-dimension breakdown
 */
export function computeAcuity(
  request: SupervisionRequest,
  config: AcuityConfig = DEFAULT_ACUITY_CONFIG,
): AcuityScore {
  const dimensions: AcuityDimensionScore[] = [
    scoreProposalRisk(request),
    scoreDataQuality(request),
    scoreEpistemologicalQuality(request),
    scoreConflictSeverity(request),
  ];

  const weights = [
    config.weights.proposal_risk,
    config.weights.data_quality,
    config.weights.epistemological_quality,
    config.weights.conflict_severity,
  ];

  // Weighted average
  const composite = dimensions.reduce((sum, dim, i) => sum + dim.score * weights[i], 0);

  const level = compositeToLevel(composite, config);

  return { level, composite, dimensions };
}

/**
 * Compare two acuity levels.
 * @returns negative if a < b, 0 if equal, positive if a > b
 */
export function compareAcuityLevels(a: AcuityLevel, b: AcuityLevel): number {
  return ACUITY_PRECEDENCE[a] - ACUITY_PRECEDENCE[b];
}

// =============================================================================
// Dimension Scorers
// =============================================================================

function scoreProposalRisk(request: SupervisionRequest): AcuityDimensionScore {
  const proposals = request.proposals ?? [];
  if (proposals.length === 0) {
    return { dimension: 'proposal_risk', score: 0, rationale: 'No proposals' };
  }

  // Take the max risk across all proposals
  let maxRisk = 0;
  let maxKind = 'unknown';
  for (const p of proposals) {
    const risk = PROPOSAL_KIND_RISK[p.kind] ?? 0.1;
    if (risk > maxRisk) {
      maxRisk = risk;
      maxKind = p.kind;
    }
  }

  return {
    dimension: 'proposal_risk',
    score: clamp(maxRisk),
    rationale: `Highest-risk proposal: ${maxKind} (${proposals.length} total)`,
  };
}

function scoreDataQuality(request: SupervisionRequest): AcuityDimensionScore {
  const snapshot = request.snapshot as
    | { created_at?: string; sources?: Array<{ source_type?: string }> }
    | undefined;

  // Missing snapshot → max risk
  if (!snapshot?.created_at) {
    return { dimension: 'data_quality', score: 1.0, rationale: 'Snapshot missing' };
  }

  let score = 0;
  const reasons: string[] = [];

  // Staleness: hours since snapshot
  const ageHours = (Date.now() - new Date(snapshot.created_at).getTime()) / (1000 * 60 * 60);
  const isClinicaMode = request.mode === 'advocate_clinical';
  const staleThreshold = isClinicaMode ? 4 : 24;

  if (ageHours > staleThreshold) {
    score += 0.6;
    reasons.push(`Stale (${Math.round(ageHours)}h, threshold ${staleThreshold}h)`);
  } else if (ageHours > staleThreshold / 2) {
    score += 0.2;
    reasons.push(`Aging (${Math.round(ageHours)}h)`);
  }

  // Source coverage
  const sources = snapshot.sources ?? [];
  const sourceTypes = new Set(sources.map((s) => s.source_type));

  if (!sourceTypes.has('ehr')) {
    score += 0.25;
    reasons.push('Missing EHR source');
  }
  if (!sourceTypes.has('patient_reported')) {
    score += 0.1;
    reasons.push('Missing patient-reported source');
  }

  return {
    dimension: 'data_quality',
    score: clamp(score),
    rationale: reasons.length > 0 ? reasons.join('; ') : 'Good data quality',
  };
}

function scoreEpistemologicalQuality(request: SupervisionRequest): AcuityDimensionScore {
  const proposals = request.proposals ?? [];
  if (proposals.length === 0) {
    return {
      dimension: 'epistemological_quality',
      score: 0,
      rationale: 'No proposals to evaluate',
    };
  }

  let score = 0;
  const reasons: string[] = [];

  // HTV scores — lower HTV = higher risk
  const htvScores = proposals
    .map((p) => (p as Record<string, unknown>).htv_score as { composite?: number } | undefined)
    .filter((h): h is { composite: number } => h?.composite !== undefined);

  if (htvScores.length > 0) {
    const minHTV = Math.min(...htvScores.map((h) => h.composite));
    if (minHTV < 0.3) {
      score += 0.5;
      reasons.push(`Very low HTV (${minHTV.toFixed(2)})`);
    } else if (minHTV < 0.7) {
      score += 0.2;
      reasons.push(`Moderate HTV (${minHTV.toFixed(2)})`);
    }
  } else {
    // Missing HTV = conservative
    score += 0.3;
    reasons.push('No HTV scores');
  }

  // Evidence grades — lower grade = higher risk
  const allGrades = proposals.flatMap((p) => {
    const refs = (p as Record<string, unknown>).evidence_refs as
      | Array<{ evidence_grade?: string }>
      | undefined;
    return (refs ?? []).map((r) => r.evidence_grade).filter(Boolean) as string[];
  });

  if (allGrades.length > 0) {
    // Find weakest grade
    const weakest = allGrades.reduce((min, g) => {
      try {
        return compareEvidenceGrades(g as EvidenceGrade, min as EvidenceGrade) < 0 ? g : min;
      } catch {
        return min;
      }
    });

    // Map grade to risk contribution
    const gradeRisk: Record<string, number> = {
      systematic_review: 0,
      rct: 0,
      meta_analysis: 0,
      cohort_study: 0.1,
      case_control: 0.15,
      case_series: 0.2,
      case_report: 0.25,
      expert_opinion: 0.3,
      preclinical: 0.35,
      insufficient: 0.4,
    };
    const gradeScore = gradeRisk[weakest] ?? 0.3;
    score += gradeScore;
    if (gradeScore > 0.2) {
      reasons.push(`Weak evidence (${weakest})`);
    }
  } else {
    score += 0.2;
    reasons.push('No evidence refs');
  }

  // Uncertainty
  const uncertainties = proposals
    .map(
      (p) =>
        (p as Record<string, unknown>).uncertainty_calibration as
          | { overall_level?: string }
          | undefined,
    )
    .filter(Boolean);

  const hasHighUncertainty = uncertainties.some((u) => u?.overall_level === 'high');
  if (hasHighUncertainty) {
    score += 0.3;
    reasons.push('High uncertainty');
  }

  return {
    dimension: 'epistemological_quality',
    score: clamp(score),
    rationale: reasons.length > 0 ? reasons.join('; ') : 'Good epistemological quality',
  };
}

function scoreConflictSeverity(request: SupervisionRequest): AcuityDimensionScore {
  const conflicts = (request as Record<string, unknown>).cross_domain_conflicts as
    | Array<{
        resolution_strategy?: string;
        evidence_refs?: unknown[];
      }>
    | undefined;

  if (!conflicts || conflicts.length === 0) {
    return { dimension: 'conflict_severity', score: 0, rationale: 'No conflicts' };
  }

  let score = 0;
  const reasons: string[] = [];

  // Count-based
  if (conflicts.length >= 3) {
    score += 0.6;
    reasons.push(`${conflicts.length} conflicts`);
  } else if (conflicts.length >= 2) {
    score += 0.4;
    reasons.push(`${conflicts.length} conflicts`);
  } else {
    score += 0.2;
    reasons.push('1 conflict');
  }

  // Escalated conflicts
  const escalated = conflicts.filter((c) => c.resolution_strategy === 'escalate');
  if (escalated.length > 0) {
    score += 0.3;
    reasons.push(`${escalated.length} escalated`);
  }

  // Missing evidence in conflicts
  const missingEvidence = conflicts.filter((c) => !c.evidence_refs || c.evidence_refs.length === 0);
  if (missingEvidence.length > 0) {
    score += 0.15;
    reasons.push(`${missingEvidence.length} without evidence`);
  }

  return {
    dimension: 'conflict_severity',
    score: clamp(score),
    rationale: reasons.join('; '),
  };
}

// =============================================================================
// Helpers
// =============================================================================

function compositeToLevel(composite: number, config: AcuityConfig): AcuityLevel {
  if (composite >= config.thresholds.critical) return 'critical';
  if (composite >= config.thresholds.high) return 'high';
  if (composite >= config.thresholds.moderate) return 'moderate';
  return 'low';
}

function clamp(value: number): number {
  return Math.min(1.0, Math.max(0.0, value));
}
