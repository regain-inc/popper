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
  pack_type?: 'core' | 'domain' | 'site' | 'modality';
  depends_on?: Array<{
    pack_id: string;
    version_constraint: string;
  }>;
  clinical_reviewer?: string;
  approved_at?: string;
  review_interval_days?: number;
  jurisdiction?: string;
}

/**
 * Source reference for policy rules.
 */
export interface PolicySource {
  kind: 'policy' | 'guideline' | 'medication_label' | 'governance' | 'other';
  citation: string;
}

/**
 * Structured provenance for a policy rule.
 * Every clinically grounded rule MUST have a provenance record.
 * Core safety rules MAY have provenance with source_type: 'internal_policy'.
 *
 * @see 01-clinical-grounding-and-supervision/05-rule-provenance-and-evidence-model.md
 */
export interface RuleProvenance {
  source_type:
    | 'medication_label'
    | 'black_box_warning'
    | 'contraindication'
    | 'drug_interaction'
    | 'rems_requirement'
    | 'society_guideline'
    | 'expert_consensus'
    | 'site_protocol'
    | 'formulary_rule'
    | 'governance_requirement'
    | 'emerging_evidence'
    | 'internal_policy';

  source_layer: 1 | 2 | 3 | 4 | 5;

  citation: string;
  citation_subsection?: string;
  source_url?: string;
  doi?: string;

  evidence_grade: EvidenceGrade;

  /** Source-native grading. Import NativeGrading from @regain/hermes when available. */
  native_grading?: {
    system: 'AHA_ACC' | 'ADA' | 'KDIGO' | 'GRADE' | 'FDA_LABEL' | 'other';
    aha_acc_cor?: 'I' | 'IIa' | 'IIb' | 'III_no_benefit' | 'III_harm';
    aha_acc_loe?: 'A' | 'B_R' | 'B_NR' | 'C_LD' | 'C_EO';
    ada_grade?: 'A' | 'B' | 'C' | 'E';
    kdigo_strength?: '1' | '2';
    kdigo_quality?: 'A' | 'B' | 'C' | 'D';
    kdigo_practice_point?: boolean;
    fda_label_section?: string;
    other_grade?: string;
  };

  jurisdiction: string;
  clinical_domain: string;
  applicable_population?: string;
  local_protocol_dependency?: string;

  approved_by: string;
  effective_date: string;
  review_interval_days: number;
  review_due: string;
  superseded_by?: string;

  emergency?: boolean;
  ratification_due?: string;

  additional_sources?: Array<{
    source_type: RuleProvenance['source_type'];
    source_layer: RuleProvenance['source_layer'];
    citation: string;
    citation_subsection?: string;
    source_url?: string;
    doi?: string;
    evidence_grade: EvidenceGrade;
    native_grading?: RuleProvenance['native_grading'];
    jurisdiction?: string;
  }>;
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

  /** Structured provenance for clinically grounded rules */
  provenance?: RuleProvenance;

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

  // Mode conditions
  | ModeIsCondition

  // Acuity conditions (SAL-1018)
  | AcuityAtLeastCondition

  // Intervention risk conditions (SAL-1020)
  | InterventionRiskAtLeastCondition

  // Clinical grounding conditions (v2.1)
  | MedicationClassInCondition
  | MedicationNameInCondition
  | SnapshotLabBelowCondition
  | SnapshotLabAboveCondition
  | SnapshotLabMissingCondition
  | SnapshotConditionPresentCondition
  | SnapshotFieldMissingCondition
  | CombinationPresentCondition
  | AllergyMatchCondition
  | DoseExceedsMaxCondition

  // Medication history conditions (v2.2)
  | RecentMedicationClassCondition

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

// Mode conditions
export interface ModeIsCondition {
  kind: 'mode_is';
  mode: 'wellness' | 'advocate_clinical';
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

// Clinical grounding conditions (v2.1)

export interface MedicationClassInCondition {
  kind: 'medication_class_in';
  classes: string[]; // ATC 4th-level codes
}

export interface MedicationNameInCondition {
  kind: 'medication_name_in';
  names: string[]; // normalized generic names
}

export interface SnapshotLabBelowCondition {
  kind: 'snapshot_lab_below';
  lab: string; // lab_id or LOINC
  threshold: number;
}

export interface SnapshotLabAboveCondition {
  kind: 'snapshot_lab_above';
  lab: string;
  threshold: number;
}

export interface SnapshotLabMissingCondition {
  kind: 'snapshot_lab_missing';
  lab: string;
}

export interface SnapshotConditionPresentCondition {
  kind: 'snapshot_condition_present';
  condition: string; // condition_id or SNOMED
}

export interface SnapshotFieldMissingCondition {
  kind: 'snapshot_field_missing';
  field: string; // e.g., "active_medications", "medication_allergies"
}

export interface CombinationPresentCondition {
  kind: 'combination_present';
  class_a: string; // ATC code
  class_b: string; // ATC code
}

export interface AllergyMatchCondition {
  kind: 'allergy_match';
  match_on: 'atc_class' | 'substance' | 'either';
}

export interface DoseExceedsMaxCondition {
  kind: 'dose_exceeds_max';
  medication: string; // name or ATC
  max_value: number;
  max_unit: string;
}

// Medication history conditions (v2.2)

export interface RecentMedicationClassCondition {
  kind: 'recent_medication_class';
  classes: string[]; // ATC 4th-level codes
  within_hours: number; // time window in hours
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

  /** Optional reconfigure side-effect (v2) */
  reconfigure?: ReconfigureEffect;

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
// Reconfigure Effects (v2)
// =============================================================================

/** A single setting change in a reconfigure effect */
export interface ReconfigureSettingChange {
  key: string;
  value: unknown;
  reason?: string;
}

/** Reconfigure side-effect that a rule can trigger */
export interface ReconfigureEffect {
  settings?: ReconfigureSettingChange[];
  mode_transition?: {
    target_mode: 'NORMAL' | 'RESTRICTED' | 'SAFE_MODE' | 'MAINTENANCE';
    reason: string;
  };
  priority?: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  auto_revert?: boolean;
  revert_after_minutes?: number;
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
  'mode_is',
  'acuity_at_least',
  'intervention_risk_at_least',
  'medication_class_in',
  'medication_name_in',
  'snapshot_lab_below',
  'snapshot_lab_above',
  'snapshot_lab_missing',
  'snapshot_condition_present',
  'snapshot_field_missing',
  'combination_present',
  'allergy_match',
  'dose_exceeds_max',
  'recent_medication_class',
  'other',
] as const;
