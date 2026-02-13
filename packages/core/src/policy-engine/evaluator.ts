/**
 * Policy Engine Evaluator
 * Deterministic policy evaluation for Popper supervision
 *
 * @see docs/specs/02-popper-specs/03-popper-safety-dsl.md §4
 * @module policy-engine/evaluator
 */

import type { AcuityLevel, AcuityScore } from '../acuity/types';
import { ACUITY_PRECEDENCE } from '../acuity/types';
import type { EvidenceGrade, ReasonCode, SupervisionDecision, SupervisionRequest } from '../hermes';
import { compareEvidenceGrades, EVIDENCE_GRADES } from '../hermes';
import type { InterventionRiskLevel, InterventionRiskScore } from '../intervention-risk/types';
import { RISK_LEVEL_PRECEDENCE } from '../intervention-risk/types';
import type {
  ApprovedConstraints,
  ControlCommand,
  PolicyPack,
  PolicyRule,
  ReconfigureEffect,
  RuleCondition,
} from './types';

// =============================================================================
// Types
// =============================================================================

/**
 * Decision precedence for conservatism (higher = more conservative).
 * HARD_STOP > ROUTE_TO_CLINICIAN > REQUEST_MORE_INFO > APPROVED
 */
const DECISION_PRECEDENCE: Record<SupervisionDecision, number> = {
  HARD_STOP: 4,
  ROUTE_TO_CLINICIAN: 3,
  REQUEST_MORE_INFO: 2,
  APPROVED: 1,
};

/**
 * Control plane state for policy evaluation.
 */
export interface ControlPlaneState {
  /** Safe mode configuration */
  safe_mode?: {
    enabled: boolean;
    reason?: string;
    effective_at?: string;
    effective_until?: string;
  };
  /** Maximum autonomy level */
  max_autonomy_level?: number;
  /** Current timestamp for staleness evaluation */
  current_time?: Date;
}

/**
 * Derived signals computed by Popper before policy evaluation.
 * These are internal signals, not part of Hermes request.
 */
export interface DerivedSignals {
  /** Schema validation result */
  schema_invalid?: boolean;
  /** Hallucination detection result */
  hallucination?: {
    detected: boolean;
    severity?: 'minor' | 'significant' | 'critical';
  };
  /** Snapshot staleness computed by Popper */
  snapshot_stale?: boolean;
  /** Snapshot missing flag */
  snapshot_missing?: boolean;
  /** IDK protocol triggered */
  idk_triggered?: boolean;
  /** Rule engine failure */
  rule_engine_failed?: boolean;
  /** Computed acuity score (SAL-1018) */
  acuity?: AcuityScore;
  /** Per-proposal intervention risk scores (SAL-1020) */
  intervention_risks?: InterventionRiskScore[];
}

/**
 * Context for policy evaluation.
 */
export interface EvaluationContext {
  /** The Hermes supervision request */
  request: SupervisionRequest;
  /** Control plane state */
  controlPlane: ControlPlaneState;
  /** Derived signals (computed by Popper) */
  derivedSignals?: DerivedSignals;
}

/**
 * Record of a matched rule for audit trace.
 */
export interface MatchedRule {
  /** Rule ID */
  rule_id: string;
  /** Rule priority */
  priority: number;
  /** Decision from this rule */
  decision: SupervisionDecision;
  /** Reason codes from this rule */
  reason_codes: ReasonCode[];
  /** Whether this rule had continue=true */
  continued: boolean;
}

/**
 * Result of policy evaluation.
 */
export interface EvaluationResult {
  /** Final decision */
  decision: SupervisionDecision;
  /** Aggregated reason codes (deduplicated) */
  reason_codes: ReasonCode[];
  /** Human-readable explanation */
  explanation: string;
  /** Rules that matched (for audit trace) */
  matched_rules: MatchedRule[];
  /** Optional approved constraints */
  approved_constraints?: ApprovedConstraints;
  /** Optional control commands to execute */
  control_commands?: ControlCommand[];
  /** Optional merged reconfigure effect (v2) */
  reconfigure_effect?: ReconfigureEffect;
  /** Policy pack version used */
  policy_version: string;
  /** Evaluation duration in milliseconds */
  evaluation_time_ms: number;
}

// =============================================================================
// Policy Evaluator
// =============================================================================

/**
 * PolicyEvaluator implements deterministic policy evaluation.
 *
 * Evaluation semantics (from spec §4):
 * 1. Rules are evaluated in priority order (highest first)
 * 2. Boolean conditions: all_of, any_of, not
 * 3. First-match wins unless rule has continue=true
 * 4. Conservatism: HARD_STOP > ROUTE_TO_CLINICIAN > REQUEST_MORE_INFO > APPROVED
 * 5. Reason codes are aggregated (union, deduplicated)
 * 6. Default: ROUTE_TO_CLINICIAN with reason_codes=["other"]
 */
export class PolicyEvaluator {
  private policyPack: PolicyPack;
  private sortedRules: PolicyRule[];

  constructor(policyPack: PolicyPack) {
    this.policyPack = policyPack;
    // Sort rules by priority descending (highest first)
    this.sortedRules = [...policyPack.rules].sort((a, b) => b.priority - a.priority);
  }

  /**
   * Evaluate policy against a supervision request.
   */
  evaluate(context: EvaluationContext): EvaluationResult {
    const startTime = performance.now();

    const matchedRules: MatchedRule[] = [];
    let finalDecision: SupervisionDecision | null = null;
    let aggregatedReasonCodes: ReasonCode[] = [];
    let finalExplanation = '';
    let finalConstraints: ApprovedConstraints | undefined;
    let allControlCommands: ControlCommand[] = [];
    const reconfigureEffects: ReconfigureEffect[] = [];

    // Evaluate rules in priority order
    for (const rule of this.sortedRules) {
      if (this.evaluateCondition(rule.when, context)) {
        const matched: MatchedRule = {
          rule_id: rule.rule_id,
          priority: rule.priority,
          decision: rule.then.decision,
          reason_codes: rule.then.reason_codes,
          continued: rule.then.continue ?? false,
        };
        matchedRules.push(matched);

        // Aggregate reason codes
        aggregatedReasonCodes = this.mergeReasonCodes(
          aggregatedReasonCodes,
          rule.then.reason_codes,
        );

        // Collect control commands
        if (rule.then.control_commands) {
          allControlCommands = [...allControlCommands, ...rule.then.control_commands];
        }

        // Collect reconfigure effects (v2)
        if (rule.then.reconfigure) {
          reconfigureEffects.push(rule.then.reconfigure);
        }

        // Update decision based on conservatism
        if (finalDecision === null) {
          finalDecision = rule.then.decision;
          finalExplanation = rule.then.explanation;
          finalConstraints = rule.then.approved_constraints;
        } else {
          // Choose more conservative decision
          if (DECISION_PRECEDENCE[rule.then.decision] > DECISION_PRECEDENCE[finalDecision]) {
            finalDecision = rule.then.decision;
            finalExplanation = rule.then.explanation;
            finalConstraints = rule.then.approved_constraints;
          }
        }

        // Stop if rule doesn't have continue flag
        if (!rule.then.continue) {
          break;
        }
      }
    }

    // Default fallback if no rules matched
    if (finalDecision === null) {
      finalDecision = 'ROUTE_TO_CLINICIAN';
      aggregatedReasonCodes = ['other'];
      finalExplanation = 'No specific rule matched. Routing to clinician for review.';
    }

    const endTime = performance.now();

    const mergedReconfigure =
      reconfigureEffects.length > 0 ? mergeReconfigureEffects(reconfigureEffects) : undefined;

    return {
      decision: finalDecision,
      reason_codes: aggregatedReasonCodes,
      explanation: finalExplanation,
      matched_rules: matchedRules,
      approved_constraints: finalConstraints,
      control_commands: allControlCommands.length > 0 ? allControlCommands : undefined,
      reconfigure_effect: mergedReconfigure,
      policy_version: this.policyPack.policy_version,
      evaluation_time_ms: endTime - startTime,
    };
  }

  /**
   * Evaluate a condition against the context.
   */
  private evaluateCondition(condition: RuleCondition, context: EvaluationContext): boolean {
    switch (condition.kind) {
      // Boolean composition
      case 'all_of':
        return condition.conditions.every((c) => this.evaluateCondition(c, context));

      case 'any_of':
        return condition.conditions.some((c) => this.evaluateCondition(c, context));

      case 'not':
        return !this.evaluateCondition(condition.condition, context);

      // Always match
      case 'always':
        return true;

      // Control plane conditions
      case 'safe_mode_enabled':
        return this.isSafeModeEnabled(context);

      // Schema conditions
      case 'schema_invalid':
        return context.derivedSignals?.schema_invalid === true;

      case 'missing_field':
        return this.isFieldMissing(context.request, condition.field_path);

      // Proposal conditions
      case 'proposal_kind_in':
        return this.hasProposalKindIn(context.request, condition.kinds);

      case 'proposal_missing_field':
        return this.isProposalMissingField(
          context.request,
          condition.field_path,
          condition.proposal_kinds,
        );

      // Uncertainty conditions
      case 'uncertainty_at_least':
        return this.isUncertaintyAtLeast(context.request, condition.level);

      // Snapshot conditions
      case 'snapshot_stale':
        return context.derivedSignals?.snapshot_stale === true;

      case 'snapshot_stale_by':
        return this.isSnapshotStaleBy(context, condition.hours);

      case 'snapshot_missing':
        return context.derivedSignals?.snapshot_missing === true;

      case 'snapshot_source_missing':
        return this.isSnapshotSourceMissing(context.request, condition.source);

      // Input risk conditions
      case 'input_risk_flag_in':
        return this.hasInputRiskFlagIn(context.request, condition.flags);

      // Cross-domain conflict conditions
      case 'conflict_count_exceeds':
        return this.conflictCountExceeds(context.request, condition.threshold);

      case 'conflict_type_in':
        return this.hasConflictTypeIn(context.request, condition.types);

      case 'conflict_missing_evidence':
        return this.hasConflictMissingEvidence(context.request);

      case 'conflict_resolution_confidence':
        return this.hasConflictResolutionConfidence(context.request, condition.level);

      case 'conflict_escalated':
        return this.hasConflictEscalated(context.request);

      case 'domain_status_in':
        return this.hasDomainStatusIn(
          context.request,
          condition.statuses,
          condition.domain_category,
        );

      case 'rule_engine_failed':
        return context.derivedSignals?.rule_engine_failed === true;

      // Epistemological quality conditions
      case 'htv_score_below':
        return this.isHTVScoreBelow(context.request, condition.threshold, condition.proposal_kinds);

      case 'evidence_grade_below':
        return this.isEvidenceGradeBelow(
          context.request,
          condition.threshold,
          condition.proposal_kinds,
        );

      case 'hallucination_detected':
        return this.isHallucinationDetected(context, condition.severity);

      case 'idk_triggered':
        return context.derivedSignals?.idk_triggered === true;

      // Acuity conditions (SAL-1018)
      case 'acuity_at_least':
        return this.isAcuityAtLeast(context, condition.level);

      // Intervention risk conditions (SAL-1020)
      case 'intervention_risk_at_least':
        return this.isInterventionRiskAtLeast(context, condition.level);

      // Escape hatch (not implemented in v1)
      case 'other':
        // 'other' conditions with expr are escape hatches
        // In v1, we treat them as false (not evaluated)
        return false;

      default:
        // Unknown condition kind - conservative default is false
        return false;
    }
  }

  // ===========================================================================
  // Condition Matchers
  // ===========================================================================

  private isSafeModeEnabled(context: EvaluationContext): boolean {
    const safeMode = context.controlPlane.safe_mode;
    if (!safeMode?.enabled) return false;

    // Check effective window if specified
    const now = context.controlPlane.current_time ?? new Date();

    if (safeMode.effective_at) {
      const effectiveAt = new Date(safeMode.effective_at);
      if (now < effectiveAt) return false;
    }

    if (safeMode.effective_until) {
      const effectiveUntil = new Date(safeMode.effective_until);
      if (now > effectiveUntil) return false;
    }

    return true;
  }

  private isFieldMissing(request: SupervisionRequest, fieldPath: string): boolean {
    return getNestedValue(request, fieldPath) === undefined;
  }

  private hasProposalKindIn(request: SupervisionRequest, kinds: string[]): boolean {
    const proposals = request.proposals ?? [];
    return proposals.some((p) => kinds.includes(p.kind));
  }

  private isProposalMissingField(
    request: SupervisionRequest,
    fieldPath: string,
    proposalKinds?: string[],
  ): boolean {
    const proposals = request.proposals ?? [];
    const targetProposals = proposalKinds
      ? proposals.filter((p) => proposalKinds.includes(p.kind))
      : proposals;

    return targetProposals.some((p) => getNestedValue(p, fieldPath) === undefined);
  }

  private isUncertaintyAtLeast(
    request: SupervisionRequest,
    level: 'low' | 'medium' | 'high',
  ): boolean {
    const levelOrder = { low: 1, medium: 2, high: 3 };
    const proposals = request.proposals ?? [];

    return proposals.some((p) => {
      const uncertainty = (p as Record<string, unknown>).uncertainty_calibration as
        | { overall_level?: string }
        | undefined;
      if (!uncertainty?.overall_level) return false;
      const proposalLevel = levelOrder[uncertainty.overall_level as keyof typeof levelOrder] ?? 0;
      return proposalLevel >= levelOrder[level];
    });
  }

  private isSnapshotStaleBy(context: EvaluationContext, hours: number): boolean {
    const snapshot = (context.request as Record<string, unknown>).snapshot as
      | { created_at?: string }
      | undefined;
    if (!snapshot?.created_at) return true; // Missing snapshot is considered stale

    const now = context.controlPlane.current_time ?? new Date();
    const snapshotTime = new Date(snapshot.created_at);
    const ageHours = (now.getTime() - snapshotTime.getTime()) / (1000 * 60 * 60);

    return ageHours > hours;
  }

  private isSnapshotSourceMissing(
    request: SupervisionRequest,
    source: 'ehr' | 'wearable' | 'patient_reported' | 'other',
  ): boolean {
    const snapshot = (request as Record<string, unknown>).snapshot as
      | { sources?: Array<{ source_type?: string }> }
      | undefined;
    if (!snapshot?.sources) return true;

    return !snapshot.sources.some((s) => s.source_type === source);
  }

  private hasInputRiskFlagIn(request: SupervisionRequest, flags: string[]): boolean {
    const inputRisk = (request as Record<string, unknown>).input_risk as
      | { flags?: string[] }
      | undefined;
    if (!inputRisk?.flags) return false;

    return inputRisk.flags.some((f) => flags.includes(f));
  }

  private conflictCountExceeds(request: SupervisionRequest, threshold: number): boolean {
    const conflicts = (request as Record<string, unknown>).cross_domain_conflicts as
      | unknown[]
      | undefined;
    return (conflicts?.length ?? 0) > threshold;
  }

  private hasConflictTypeIn(request: SupervisionRequest, types: string[]): boolean {
    const conflicts = (request as Record<string, unknown>).cross_domain_conflicts as
      | Array<{ conflict_type?: string }>
      | undefined;
    if (!conflicts) return false;

    return conflicts.some((c) => c.conflict_type && types.includes(c.conflict_type));
  }

  private hasConflictMissingEvidence(request: SupervisionRequest): boolean {
    const conflicts = (request as Record<string, unknown>).cross_domain_conflicts as
      | Array<{ evidence_refs?: unknown[] }>
      | undefined;
    if (!conflicts) return false;

    return conflicts.some((c) => !c.evidence_refs || c.evidence_refs.length === 0);
  }

  private hasConflictResolutionConfidence(
    request: SupervisionRequest,
    level: 'low' | 'medium' | 'high',
  ): boolean {
    const conflicts = (request as Record<string, unknown>).cross_domain_conflicts as
      | Array<{ resolution_confidence?: string }>
      | undefined;
    if (!conflicts) return false;

    return conflicts.some((c) => c.resolution_confidence === level);
  }

  private hasConflictEscalated(request: SupervisionRequest): boolean {
    const conflicts = (request as Record<string, unknown>).cross_domain_conflicts as
      | Array<{ resolution_strategy?: string }>
      | undefined;
    if (!conflicts) return false;

    return conflicts.some((c) => c.resolution_strategy === 'escalate');
  }

  private hasDomainStatusIn(
    request: SupervisionRequest,
    statuses: Array<'success' | 'degraded' | 'failed'>,
    domainCategory?: string,
  ): boolean {
    const domains = (request as Record<string, unknown>).contributing_domains as
      | Array<{ domain_category?: string; status?: string }>
      | undefined;
    if (!domains) return false;

    return domains.some((d) => {
      const statusMatch = statuses.includes(d.status as 'success' | 'degraded' | 'failed');
      const categoryMatch = !domainCategory || d.domain_category === domainCategory;
      return statusMatch && categoryMatch;
    });
  }

  private isHTVScoreBelow(
    request: SupervisionRequest,
    threshold: number,
    proposalKinds?: string[],
  ): boolean {
    const proposals = request.proposals ?? [];
    const targetProposals = proposalKinds
      ? proposals.filter((p) => proposalKinds.includes(p.kind))
      : proposals;

    return targetProposals.some((p) => {
      const htvScore = (p as Record<string, unknown>).htv_score as
        | { composite?: number }
        | undefined;
      // Missing HTV score is treated as below threshold (conservative)
      if (!htvScore?.composite) return true;
      return htvScore.composite < threshold;
    });
  }

  private isEvidenceGradeBelow(
    request: SupervisionRequest,
    threshold: EvidenceGrade,
    proposalKinds?: string[],
  ): boolean {
    const proposals = request.proposals ?? [];
    const targetProposals = proposalKinds
      ? proposals.filter((p) => proposalKinds.includes(p.kind))
      : proposals;

    return targetProposals.some((p) => {
      const evidenceRefs = (p as Record<string, unknown>).evidence_refs as
        | Array<{ evidence_grade?: EvidenceGrade }>
        | undefined;

      // Missing evidence refs is treated as below threshold (conservative)
      if (!evidenceRefs || evidenceRefs.length === 0) return true;

      // Find minimum evidence grade
      const grades = evidenceRefs
        .map((e) => e.evidence_grade)
        .filter((g): g is EvidenceGrade => g !== undefined && EVIDENCE_GRADES.includes(g));

      if (grades.length === 0) return true;

      // Use the weakest grade
      const minGrade = grades.reduce((min, g) => {
        return compareEvidenceGrades(g, min) < 0 ? g : min;
      });

      // Check if min grade is below threshold
      return compareEvidenceGrades(minGrade, threshold) < 0;
    });
  }

  private isHallucinationDetected(
    context: EvaluationContext,
    severity?: 'minor' | 'significant' | 'critical',
  ): boolean {
    const hallucination = context.derivedSignals?.hallucination;
    if (!hallucination?.detected) return false;

    if (!severity) return true; // Any hallucination matches

    // Match specific severity or higher
    const severityOrder = { minor: 1, significant: 2, critical: 3 };
    const detectedSeverity = hallucination.severity ?? 'minor';
    return severityOrder[detectedSeverity] >= severityOrder[severity];
  }

  private isAcuityAtLeast(
    context: EvaluationContext,
    level: 'low' | 'moderate' | 'high' | 'critical',
  ): boolean {
    const acuity = context.derivedSignals?.acuity;
    if (!acuity) return false; // No acuity computed — condition doesn't match
    return ACUITY_PRECEDENCE[acuity.level] >= ACUITY_PRECEDENCE[level as AcuityLevel];
  }

  /**
   * Check if ANY proposal's intervention risk is at least the given level.
   */
  private isInterventionRiskAtLeast(
    context: EvaluationContext,
    level: 'low' | 'moderate' | 'high' | 'critical',
  ): boolean {
    const risks = context.derivedSignals?.intervention_risks;
    if (!risks || risks.length === 0) return false;
    const threshold = RISK_LEVEL_PRECEDENCE[level as InterventionRiskLevel];
    return risks.some((r) => RISK_LEVEL_PRECEDENCE[r.level] >= threshold);
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private mergeReasonCodes(existing: ReasonCode[], newCodes: ReasonCode[]): ReasonCode[] {
    const set = new Set([...existing, ...newCodes]);
    return Array.from(set);
  }
}

// =============================================================================
// Reconfigure Effect Merging
// =============================================================================

/** Priority ordering for reconfigure effects: EMERGENCY > URGENT > ROUTINE */
const RECONFIGURE_PRIORITY_ORDER: Record<string, number> = {
  ROUTINE: 1,
  URGENT: 2,
  EMERGENCY: 3,
};

/**
 * Merge multiple ReconfigureEffects from matched rules.
 *
 * Merging semantics:
 * - Settings: accumulate all; same key → higher priority wins
 * - Mode transition: highest priority wins
 * - Auto-revert: shortest timer wins
 * - Priority: highest wins
 */
export function mergeReconfigureEffects(effects: ReconfigureEffect[]): ReconfigureEffect {
  if (effects.length === 1) return effects[0];

  const merged: ReconfigureEffect = {};

  // Track the highest priority across all effects
  let highestPriority = 0;
  let highestPriorityLabel: ReconfigureEffect['priority'];

  for (const effect of effects) {
    const p = RECONFIGURE_PRIORITY_ORDER[effect.priority ?? 'ROUTINE'] ?? 1;
    if (p > highestPriority) {
      highestPriority = p;
      highestPriorityLabel = effect.priority ?? 'ROUTINE';
    }
  }
  merged.priority = highestPriorityLabel;

  // Merge settings: same key → higher-priority effect wins
  const settingsMap = new Map<
    string,
    { change: ReconfigureEffect['settings'][0]; priority: number }
  >();
  for (const effect of effects) {
    const effectPriority = RECONFIGURE_PRIORITY_ORDER[effect.priority ?? 'ROUTINE'] ?? 1;
    for (const setting of effect.settings ?? []) {
      const existing = settingsMap.get(setting.key);
      if (!existing || effectPriority > existing.priority) {
        settingsMap.set(setting.key, { change: setting, priority: effectPriority });
      }
    }
  }
  if (settingsMap.size > 0) {
    merged.settings = Array.from(settingsMap.values()).map((v) => v.change);
  }

  // Mode transition: highest priority wins
  let bestModeTransition: ReconfigureEffect['mode_transition'] | undefined;
  let bestModePriority = 0;
  for (const effect of effects) {
    if (effect.mode_transition) {
      const p = RECONFIGURE_PRIORITY_ORDER[effect.priority ?? 'ROUTINE'] ?? 1;
      if (p > bestModePriority) {
        bestModePriority = p;
        bestModeTransition = effect.mode_transition;
      }
    }
  }
  if (bestModeTransition) {
    merged.mode_transition = bestModeTransition;
  }

  // Auto-revert: if any effect has auto_revert, enable it; shortest timer wins
  const revertTimers: number[] = [];
  for (const effect of effects) {
    if (effect.auto_revert) {
      merged.auto_revert = true;
      if (effect.revert_after_minutes !== undefined) {
        revertTimers.push(effect.revert_after_minutes);
      }
    }
  }
  if (revertTimers.length > 0) {
    merged.revert_after_minutes = Math.min(...revertTimers);
  }

  return merged;
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Get nested value from object using dot notation path.
 * Supports array notation like "evidence_refs[].evidence_grade".
 */
function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === undefined || current === null) return undefined;

    // Handle array notation like "evidence_refs[]"
    if (part.endsWith('[]')) {
      const arrayKey = part.slice(0, -2);
      const arr = (current as Record<string, unknown>)[arrayKey];
      if (!Array.isArray(arr)) return undefined;
      // For array paths, we check if ANY element has the remaining path
      // This is used for existence checks
      return arr.length > 0 ? arr : undefined;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Create a PolicyEvaluator from a policy pack.
 */
export function createEvaluator(policyPack: PolicyPack): PolicyEvaluator {
  return new PolicyEvaluator(policyPack);
}
