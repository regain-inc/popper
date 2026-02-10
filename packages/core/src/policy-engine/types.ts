/**
 * Safety DSL Types
 * TypeScript definitions for Popper policy packs
 *
 * @see docs/specs/02-popper-specs/03-popper-safety-dsl.md
 * @module policy-engine/types
 */

import type { EvidenceGrade, ReasonCode, SupervisionDecision } from '../hermes';

// =============================================================================
// Policy Pack
// =============================================================================

/**
 * A complete policy pack definition.
 * Policy packs are versioned, deterministic rule sets for supervision decisions.
 */
export interface PolicyPack {
  /** Unique identifier for this policy pack (e.g., "popper-safety") */
  policy_id: string;

  /** Semantic version (MUST be emitted in TraceContext.producer.ruleset_version) */
  policy_version: string;

  /** Optional metadata for audit/regulatory packages */
  metadata?: PolicyPackMetadata;

  /** Staleness configuration (Popper is AUTHORITATIVE for staleness validation) */
  staleness?: StalenessConfig;

  /** Ordered rule list; first-match wins unless rule says "continue" */
  rules: PolicyRule[];
}

/**
 * Policy pack metadata for audit and documentation.
 */
export interface PolicyPackMetadata {
  description?: string;
  owner?: string;
  created_at?: string;
  sources?: PolicySource[];
}

/**
 * Source reference for policy rules.
 */
export interface PolicySource {
  kind: 'policy' | 'guideline' | 'other';
  citation: string;
}

// =============================================================================
// Staleness Configuration
// =============================================================================

/**
 * Staleness validation configuration.
 * Popper is AUTHORITATIVE - does NOT trust Brain's validation.
 */
export interface StalenessConfig {
  thresholds: StalenessThresholds;
  /** Per-signal overrides (v2 extension, optional) */
  signals?: Record<string, string>;
  behavior: StalenessBehavior;
}

/**
 * Default staleness thresholds by mode.
 */
export interface StalenessThresholds {
  /** Wellness mode threshold in hours (default: 24) */
  wellness_hours: number;
  /** Clinical mode threshold in hours (default: 4) */
  clinical_hours: number;
}

/**
 * Behavior when staleness is detected.
 */
export interface StalenessBehavior {
  /** Decision for low-risk proposals with stale data */
  low_risk_stale: 'REQUEST_MORE_INFO' | 'ROUTE_TO_CLINICIAN';
  /** Decision for high-risk proposals with stale data */
  high_risk_stale: 'ROUTE_TO_CLINICIAN' | 'HARD_STOP';
}

// =============================================================================
// Policy Rules
// =============================================================================

/**
 * A single policy rule with condition and action.
 */
export interface PolicyRule {
  /** Unique identifier for this rule */
  rule_id: string;

  /** Human-readable description */
  description: string;

  /** Higher priority rules evaluated first (descending order) */
  priority: number;

  /** If true, requires manual clinician review even if APPROVED */
  requires_human_review?: boolean;

  /** Condition that triggers this rule */
  when: RuleCondition;

  /** Action to take when condition matches */
  then: RuleAction;
}

// =============================================================================
// Rule Conditions
// =============================================================================

/**
 * All possible rule condition types.
 * Conditions are evaluated against SupervisionRequest and control-plane state.
 */
export type RuleCondition =
  // Boolean composition
  | AllOfCondition
  | AnyOfCondition
  | NotCondition

  // Always match
  | AlwaysCondition

  // Control plane conditions
  | SafeModeEnabledCondition

  // Schema conditions
  | SchemaInvalidCondition
  | MissingFieldCondition

  // Proposal conditions
  | ProposalKindInCondition
  | ProposalMissingFieldCondition

  // Uncertainty conditions
  | UncertaintyAtLeastCondition

  // Snapshot conditions
  | SnapshotSourceMissingCondition
  | SnapshotStaleCondition
  | SnapshotStaleByCondition
  | SnapshotMissingCondition

  // Input risk conditions
  | InputRiskFlagInCondition

  // Cross-domain conflict conditions
  | ConflictCountExceedsCondition
  | ConflictTypeInCondition
  | ConflictMissingEvidenceCondition
  | ConflictResolutionConfidenceCondition
  | ConflictEscalatedCondition
  | DomainStatusInCondition
  | RuleEngineFailedCondition

  // Epistemological quality conditions
  | HTVScoreBelowCondition
  | EvidenceGradeBelowCondition
  | HallucinationDetectedCondition
  | IDKTriggeredCondition

  // Acuity conditions (SAL-1018)
  | AcuityAtLeastCondition

  // Intervention risk conditions (SAL-1020)
  | InterventionRiskAtLeastCondition

  // Escape hatch
  | OtherCondition;

// Boolean composition conditions
export interface AllOfCondition {
  kind: 'all_of';
  conditions: RuleCondition[];
}

export interface AnyOfCondition {
  kind: 'any_of';
  conditions: RuleCondition[];
}

export interface NotCondition {
  kind: 'not';
  condition: RuleCondition;
}

// Simple conditions
export interface AlwaysCondition {
  kind: 'always';
}

export interface SafeModeEnabledCondition {
  kind: 'safe_mode_enabled';
}

export interface SchemaInvalidCondition {
  kind: 'schema_invalid';
}

export interface MissingFieldCondition {
  kind: 'missing_field';
  field_path: string;
}

// Proposal conditions
export interface ProposalKindInCondition {
  kind: 'proposal_kind_in';
  kinds: string[];
}

export interface ProposalMissingFieldCondition {
  kind: 'proposal_missing_field';
  proposal_kinds?: string[];
  field_path: string;
}

// Uncertainty conditions
export interface UncertaintyAtLeastCondition {
  kind: 'uncertainty_at_least';
  level: 'low' | 'medium' | 'high';
}

// Snapshot conditions
export interface SnapshotSourceMissingCondition {
  kind: 'snapshot_source_missing';
  source: 'ehr' | 'wearable' | 'patient_reported' | 'other';
}

export interface SnapshotStaleCondition {
  kind: 'snapshot_stale';
}

export interface SnapshotStaleByCondition {
  kind: 'snapshot_stale_by';
  hours: number;
}

export interface SnapshotMissingCondition {
  kind: 'snapshot_missing';
}

// Input risk conditions
export interface InputRiskFlagInCondition {
  kind: 'input_risk_flag_in';
  flags: string[];
}

// Cross-domain conflict conditions
export interface ConflictCountExceedsCondition {
  kind: 'conflict_count_exceeds';
  threshold: number;
}

export interface ConflictTypeInCondition {
  kind: 'conflict_type_in';
  types: string[];
}

export interface ConflictMissingEvidenceCondition {
  kind: 'conflict_missing_evidence';
}

export interface ConflictResolutionConfidenceCondition {
  kind: 'conflict_resolution_confidence';
  level: 'low' | 'medium' | 'high';
}

export interface ConflictEscalatedCondition {
  kind: 'conflict_escalated';
}

export interface DomainStatusInCondition {
  kind: 'domain_status_in';
  statuses: Array<'success' | 'degraded' | 'failed'>;
  domain_category?: string;
}

export interface RuleEngineFailedCondition {
  kind: 'rule_engine_failed';
}

// Epistemological quality conditions
export interface HTVScoreBelowCondition {
  kind: 'htv_score_below';
  threshold: number;
  proposal_kinds?: string[];
}

export interface EvidenceGradeBelowCondition {
  kind: 'evidence_grade_below';
  threshold: EvidenceGrade;
  proposal_kinds?: string[];
}

export interface HallucinationDetectedCondition {
  kind: 'hallucination_detected';
  severity?: 'minor' | 'significant' | 'critical';
}

export interface IDKTriggeredCondition {
  kind: 'idk_triggered';
}

// Acuity conditions (SAL-1018)
export interface AcuityAtLeastCondition {
  kind: 'acuity_at_least';
  level: 'low' | 'moderate' | 'high' | 'critical';
}

// Intervention risk conditions (SAL-1020)
export interface InterventionRiskAtLeastCondition {
  kind: 'intervention_risk_at_least';
  level: 'low' | 'moderate' | 'high' | 'critical';
}

// Escape hatch
export interface OtherCondition {
  kind: 'other';
  expr: string;
}

// =============================================================================
// Rule Actions
// =============================================================================

/**
 * Action to take when a rule matches.
 */
export interface RuleAction {
  /** The supervision decision */
  decision: SupervisionDecision;

  /** Reason codes explaining the decision */
  reason_codes: ReasonCode[];

  /** Human-readable explanation (shown to clinicians) */
  explanation: string;

  /** Optional constraints for APPROVED decisions */
  approved_constraints?: ApprovedConstraints;

  /** Optional control commands (safe-mode or settings changes) */
  control_commands?: ControlCommand[];

  /** If true, continue evaluating subsequent rules and merge reason_codes */
  continue?: boolean;
}

/**
 * Constraints for approved decisions.
 */
export interface ApprovedConstraints {
  must_route_after?: string;
  allowed_actions?: string[];
}

/**
 * Control command to modify system state.
 */
export interface ControlCommand {
  kind: 'SET_SAFE_MODE' | 'SET_OPERATIONAL_SETTING';
  safe_mode?: {
    enabled: boolean;
    reason: string;
    effective_at?: string;
    effective_until?: string;
  };
  setting?: {
    key: string;
    value: string;
  };
}

// =============================================================================
// Condition Kind Literal Type
// =============================================================================

/**
 * All valid condition kinds as a union type.
 */
export type ConditionKind = RuleCondition['kind'];

/**
 * List of all valid condition kinds for validation.
 */
export const CONDITION_KINDS = [
  'all_of',
  'any_of',
  'not',
  'always',
  'safe_mode_enabled',
  'schema_invalid',
  'missing_field',
  'proposal_kind_in',
  'proposal_missing_field',
  'uncertainty_at_least',
  'snapshot_source_missing',
  'snapshot_stale',
  'snapshot_stale_by',
  'snapshot_missing',
  'input_risk_flag_in',
  'conflict_count_exceeds',
  'conflict_type_in',
  'conflict_missing_evidence',
  'conflict_resolution_confidence',
  'conflict_escalated',
  'domain_status_in',
  'rule_engine_failed',
  'htv_score_below',
  'evidence_grade_below',
  'hallucination_detected',
  'idk_triggered',
  'acuity_at_least',
  'intervention_risk_at_least',
  'other',
] as const;
