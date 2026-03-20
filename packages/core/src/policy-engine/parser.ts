/**
 * Policy Pack Parser
 * Parses and validates YAML/JSON policy packs
 *
 * @see docs/specs/02-popper-specs/03-popper-safety-dsl.md
 * @module policy-engine/parser
 */

import { parse as parseYaml } from 'yaml';
import { EVIDENCE_GRADES, REASON_CODES, SUPERVISION_DECISIONS } from '../hermes';
import type { ConditionKind, PolicyPack, PolicyRule, RuleAction, RuleCondition } from './types';
import { CONDITION_KINDS } from './types';

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error thrown when policy pack parsing or validation fails.
 */
export class PolicyParseError extends Error {
  constructor(
    message: string,
    public readonly path?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'PolicyParseError';
  }
}

// =============================================================================
// Parser
// =============================================================================

/**
 * Parse a policy pack from YAML string.
 *
 * @param yamlContent - YAML content to parse
 * @returns Parsed and validated PolicyPack
 * @throws PolicyParseError if parsing or validation fails
 */
export function parsePolicyPackYaml(yamlContent: string): PolicyPack {
  try {
    const data = parseYaml(yamlContent);
    return validatePolicyPack(data);
  } catch (error) {
    if (error instanceof PolicyParseError) {
      throw error;
    }
    throw new PolicyParseError(
      `Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Parse a policy pack from JSON string.
 *
 * @param jsonContent - JSON content to parse
 * @returns Parsed and validated PolicyPack
 * @throws PolicyParseError if parsing or validation fails
 */
export function parsePolicyPackJson(jsonContent: string): PolicyPack {
  try {
    const data = JSON.parse(jsonContent);
    return validatePolicyPack(data);
  } catch (error) {
    if (error instanceof PolicyParseError) {
      throw error;
    }
    throw new PolicyParseError(
      `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Parse a policy pack from an object (already parsed YAML/JSON).
 *
 * @param data - Object to validate as PolicyPack
 * @returns Validated PolicyPack
 * @throws PolicyParseError if validation fails
 */
export function parsePolicyPack(data: unknown): PolicyPack {
  return validatePolicyPack(data);
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate and transform raw data into a PolicyPack.
 */
function validatePolicyPack(data: unknown): PolicyPack {
  if (!data || typeof data !== 'object') {
    throw new PolicyParseError('Policy pack must be an object');
  }

  const pack = data as Record<string, unknown>;

  // Required fields
  if (typeof pack.policy_id !== 'string' || pack.policy_id.trim() === '') {
    throw new PolicyParseError('policy_id is required and must be a non-empty string');
  }

  if (typeof pack.policy_version !== 'string' || !isValidSemver(pack.policy_version)) {
    throw new PolicyParseError('policy_version is required and must be a valid semver string');
  }

  if (!Array.isArray(pack.rules)) {
    throw new PolicyParseError('rules is required and must be an array');
  }

  // Validate rules
  const rules = pack.rules.map((rule, index) => validatePolicyRule(rule, `rules[${index}]`));

  // Build validated PolicyPack
  const policyPack: PolicyPack = {
    policy_id: pack.policy_id,
    policy_version: pack.policy_version,
    rules,
  };

  // Optional pack_type (v2.1: core | domain | site | modality)
  if (pack.pack_type !== undefined) {
    const validPackTypes = ['core', 'domain', 'site', 'modality'];
    if (!validPackTypes.includes(pack.pack_type as string)) {
      throw new PolicyParseError(`pack_type must be one of: ${validPackTypes.join(', ')}`);
    }
    (policyPack as Record<string, unknown>).pack_type = pack.pack_type;
  }

  // Optional metadata
  if (pack.metadata !== undefined) {
    policyPack.metadata = validateMetadata(pack.metadata);
  }

  // Optional staleness config
  if (pack.staleness !== undefined) {
    policyPack.staleness = validateStalenessConfig(pack.staleness);
  }

  // Optional depends_on (v2.1)
  if (pack.depends_on !== undefined) {
    if (!Array.isArray(pack.depends_on)) {
      throw new PolicyParseError('depends_on must be an array');
    }
    (policyPack as Record<string, unknown>).depends_on = pack.depends_on.map(
      (dep: unknown, i: number) => {
        if (!dep || typeof dep !== 'object') {
          throw new PolicyParseError(`depends_on[${i}] must be an object`);
        }
        const d = dep as Record<string, unknown>;
        if (typeof d.pack_id !== 'string') {
          throw new PolicyParseError(`depends_on[${i}].pack_id must be a string`);
        }
        if (typeof d.version_constraint !== 'string') {
          throw new PolicyParseError(`depends_on[${i}].version_constraint must be a string`);
        }
        return { pack_id: d.pack_id, version_constraint: d.version_constraint };
      },
    );
  }

  return policyPack;
}

/**
 * Validate policy pack metadata.
 */
function validateMetadata(data: unknown): PolicyPack['metadata'] {
  if (!data || typeof data !== 'object') {
    throw new PolicyParseError('metadata must be an object');
  }

  const meta = data as Record<string, unknown>;
  const result: PolicyPack['metadata'] = {};

  if (meta.description !== undefined) {
    if (typeof meta.description !== 'string') {
      throw new PolicyParseError('metadata.description must be a string');
    }
    result.description = meta.description;
  }

  if (meta.owner !== undefined) {
    if (typeof meta.owner !== 'string') {
      throw new PolicyParseError('metadata.owner must be a string');
    }
    result.owner = meta.owner;
  }

  if (meta.created_at !== undefined) {
    if (typeof meta.created_at !== 'string') {
      throw new PolicyParseError('metadata.created_at must be a string');
    }
    result.created_at = meta.created_at;
  }

  if (meta.sources !== undefined) {
    if (!Array.isArray(meta.sources)) {
      throw new PolicyParseError('metadata.sources must be an array');
    }
    result.sources = meta.sources.map((rawSource: unknown, index: number) => {
      if (!rawSource || typeof rawSource !== 'object') {
        throw new PolicyParseError(`metadata.sources[${index}] must be an object`);
      }
      const s = rawSource as Record<string, unknown>;
      const validSourceKinds = ['policy', 'guideline', 'medication_label', 'governance', 'other'];
      if (!validSourceKinds.includes(s.kind as string)) {
        throw new PolicyParseError(
          `metadata.sources[${index}].kind must be one of: ${validSourceKinds.join(', ')}`,
        );
      }
      if (typeof s.citation !== 'string') {
        throw new PolicyParseError(`metadata.sources[${index}].citation must be a string`);
      }
      const parsed: Record<string, unknown> = { kind: s.kind, citation: s.citation };
      if (s.source_url !== undefined) parsed.source_url = s.source_url;
      if (s.doi !== undefined) parsed.doi = s.doi;
      if (s.version_date !== undefined) parsed.version_date = s.version_date;
      return parsed;
    });
  }

  return result;
}

/**
 * Validate staleness configuration.
 */
function validateStalenessConfig(data: unknown): PolicyPack['staleness'] {
  if (!data || typeof data !== 'object') {
    throw new PolicyParseError('staleness must be an object');
  }

  const config = data as Record<string, unknown>;

  // Validate thresholds
  if (!config.thresholds || typeof config.thresholds !== 'object') {
    throw new PolicyParseError('staleness.thresholds is required');
  }

  const thresholds = config.thresholds as Record<string, unknown>;
  if (typeof thresholds.wellness_hours !== 'number' || thresholds.wellness_hours <= 0) {
    throw new PolicyParseError('staleness.thresholds.wellness_hours must be a positive number');
  }
  if (typeof thresholds.clinical_hours !== 'number' || thresholds.clinical_hours <= 0) {
    throw new PolicyParseError('staleness.thresholds.clinical_hours must be a positive number');
  }

  // Validate behavior
  if (!config.behavior || typeof config.behavior !== 'object') {
    throw new PolicyParseError('staleness.behavior is required');
  }

  const behavior = config.behavior as Record<string, unknown>;
  if (!['REQUEST_MORE_INFO', 'ROUTE_TO_CLINICIAN'].includes(behavior.low_risk_stale as string)) {
    throw new PolicyParseError(
      "staleness.behavior.low_risk_stale must be 'REQUEST_MORE_INFO' or 'ROUTE_TO_CLINICIAN'",
    );
  }
  if (!['ROUTE_TO_CLINICIAN', 'HARD_STOP'].includes(behavior.high_risk_stale as string)) {
    throw new PolicyParseError(
      "staleness.behavior.high_risk_stale must be 'ROUTE_TO_CLINICIAN' or 'HARD_STOP'",
    );
  }

  const result: NonNullable<PolicyPack['staleness']> = {
    thresholds: {
      wellness_hours: thresholds.wellness_hours,
      clinical_hours: thresholds.clinical_hours,
    },
    behavior: {
      low_risk_stale: behavior.low_risk_stale as 'REQUEST_MORE_INFO' | 'ROUTE_TO_CLINICIAN',
      high_risk_stale: behavior.high_risk_stale as 'ROUTE_TO_CLINICIAN' | 'HARD_STOP',
    },
  };

  // Optional signals
  if (config.signals !== undefined) {
    if (typeof config.signals !== 'object') {
      throw new PolicyParseError('staleness.signals must be an object');
    }
    result.signals = config.signals as Record<string, string>;
  }

  return result;
}

/**
 * Validate a single policy rule.
 */
function validatePolicyRule(data: unknown, path: string): PolicyRule {
  if (!data || typeof data !== 'object') {
    throw new PolicyParseError(`${path} must be an object`);
  }

  const rule = data as Record<string, unknown>;

  // Required fields
  if (typeof rule.rule_id !== 'string' || rule.rule_id.trim() === '') {
    throw new PolicyParseError(`${path}.rule_id is required and must be a non-empty string`);
  }

  if (typeof rule.description !== 'string') {
    throw new PolicyParseError(`${path}.description is required and must be a string`);
  }

  if (typeof rule.priority !== 'number') {
    throw new PolicyParseError(`${path}.priority is required and must be a number`);
  }

  if (rule.when === undefined) {
    throw new PolicyParseError(`${path}.when is required`);
  }

  if (rule.then === undefined) {
    throw new PolicyParseError(`${path}.then is required`);
  }

  const policyRule: PolicyRule = {
    rule_id: rule.rule_id,
    description: rule.description,
    priority: rule.priority,
    when: validateCondition(rule.when, `${path}.when`),
    // biome-ignore lint/suspicious/noThenProperty: Safety DSL uses 'then' as rule action clause per spec
    then: validateAction(rule.then, `${path}.then`),
  };

  // Optional fields
  if (rule.requires_human_review !== undefined) {
    if (typeof rule.requires_human_review !== 'boolean') {
      throw new PolicyParseError(`${path}.requires_human_review must be a boolean`);
    }
    policyRule.requires_human_review = rule.requires_human_review;
  }

  // Optional provenance (v2.1: clinically grounded rules)
  if (rule.provenance !== undefined) {
    policyRule.provenance = validateProvenance(rule.provenance, `${path}.provenance`);
  }

  return policyRule;
}

/**
 * Validate a rule condition (recursive for boolean composition).
 */
function validateCondition(data: unknown, path: string): RuleCondition {
  if (!data || typeof data !== 'object') {
    throw new PolicyParseError(`${path} must be an object`);
  }

  const condition = data as Record<string, unknown>;

  if (typeof condition.kind !== 'string') {
    throw new PolicyParseError(`${path}.kind is required and must be a string`);
  }

  const kind = condition.kind as ConditionKind;

  if (!CONDITION_KINDS.includes(kind as (typeof CONDITION_KINDS)[number])) {
    throw new PolicyParseError(`${path}.kind '${kind}' is not a valid condition kind`);
  }

  // Validate based on kind
  switch (kind) {
    case 'all_of':
      if (!Array.isArray(condition.conditions)) {
        throw new PolicyParseError(`${path}.conditions is required for 'all_of'`);
      }
      return {
        kind: 'all_of',
        conditions: condition.conditions.map((c, i) =>
          validateCondition(c, `${path}.conditions[${i}]`),
        ),
      };

    case 'any_of':
      if (!Array.isArray(condition.conditions)) {
        throw new PolicyParseError(`${path}.conditions is required for 'any_of'`);
      }
      return {
        kind: 'any_of',
        conditions: condition.conditions.map((c, i) =>
          validateCondition(c, `${path}.conditions[${i}]`),
        ),
      };

    case 'not':
      if (condition.condition === undefined) {
        throw new PolicyParseError(`${path}.condition is required for 'not'`);
      }
      return {
        kind: 'not',
        condition: validateCondition(condition.condition, `${path}.condition`),
      };

    case 'always':
    case 'safe_mode_enabled':
    case 'schema_invalid':
    case 'snapshot_stale':
    case 'snapshot_missing':
    case 'conflict_missing_evidence':
    case 'conflict_escalated':
    case 'rule_engine_failed':
    case 'idk_triggered':
      return { kind } as RuleCondition;

    case 'missing_field':
      if (typeof condition.field_path !== 'string') {
        throw new PolicyParseError(`${path}.field_path is required for 'missing_field'`);
      }
      return { kind: 'missing_field', field_path: condition.field_path };

    case 'proposal_kind_in':
      if (!Array.isArray(condition.kinds)) {
        throw new PolicyParseError(`${path}.kinds is required for 'proposal_kind_in'`);
      }
      return { kind: 'proposal_kind_in', kinds: condition.kinds as string[] };

    case 'proposal_missing_field':
      if (typeof condition.field_path !== 'string') {
        throw new PolicyParseError(`${path}.field_path is required for 'proposal_missing_field'`);
      }
      return {
        kind: 'proposal_missing_field',
        field_path: condition.field_path,
        proposal_kinds: condition.proposal_kinds as string[] | undefined,
      };

    case 'uncertainty_at_least':
      if (!['low', 'medium', 'high'].includes(condition.level as string)) {
        throw new PolicyParseError(
          `${path}.level must be 'low', 'medium', or 'high' for 'uncertainty_at_least'`,
        );
      }
      return {
        kind: 'uncertainty_at_least',
        level: condition.level as 'low' | 'medium' | 'high',
      };

    case 'snapshot_source_missing':
      if (!['ehr', 'wearable', 'patient_reported', 'other'].includes(condition.source as string)) {
        throw new PolicyParseError(
          `${path}.source must be 'ehr', 'wearable', 'patient_reported', or 'other'`,
        );
      }
      return {
        kind: 'snapshot_source_missing',
        source: condition.source as 'ehr' | 'wearable' | 'patient_reported' | 'other',
      };

    case 'snapshot_stale_by':
      if (typeof condition.hours !== 'number' || condition.hours <= 0) {
        throw new PolicyParseError(
          `${path}.hours must be a positive number for 'snapshot_stale_by'`,
        );
      }
      return { kind: 'snapshot_stale_by', hours: condition.hours };

    case 'input_risk_flag_in':
      if (!Array.isArray(condition.flags)) {
        throw new PolicyParseError(`${path}.flags is required for 'input_risk_flag_in'`);
      }
      return { kind: 'input_risk_flag_in', flags: condition.flags as string[] };

    case 'conflict_count_exceeds':
      if (typeof condition.threshold !== 'number') {
        throw new PolicyParseError(`${path}.threshold is required for 'conflict_count_exceeds'`);
      }
      return { kind: 'conflict_count_exceeds', threshold: condition.threshold };

    case 'conflict_type_in':
      if (!Array.isArray(condition.types)) {
        throw new PolicyParseError(`${path}.types is required for 'conflict_type_in'`);
      }
      return { kind: 'conflict_type_in', types: condition.types as string[] };

    case 'conflict_resolution_confidence':
      if (!['low', 'medium', 'high'].includes(condition.level as string)) {
        throw new PolicyParseError(`${path}.level must be 'low', 'medium', or 'high'`);
      }
      return {
        kind: 'conflict_resolution_confidence',
        level: condition.level as 'low' | 'medium' | 'high',
      };

    case 'domain_status_in':
      if (!Array.isArray(condition.statuses)) {
        throw new PolicyParseError(`${path}.statuses is required for 'domain_status_in'`);
      }
      return {
        kind: 'domain_status_in',
        statuses: condition.statuses as Array<'success' | 'degraded' | 'failed'>,
        domain_category: condition.domain_category as string | undefined,
      };

    case 'htv_score_below':
      if (typeof condition.threshold !== 'number') {
        throw new PolicyParseError(`${path}.threshold is required for 'htv_score_below'`);
      }
      return {
        kind: 'htv_score_below',
        threshold: condition.threshold,
        proposal_kinds: condition.proposal_kinds as string[] | undefined,
      };

    case 'evidence_grade_below':
      if (!EVIDENCE_GRADES.includes(condition.threshold as (typeof EVIDENCE_GRADES)[number])) {
        throw new PolicyParseError(
          `${path}.threshold must be a valid EvidenceGrade for 'evidence_grade_below'`,
        );
      }
      return {
        kind: 'evidence_grade_below',
        threshold: condition.threshold as (typeof EVIDENCE_GRADES)[number],
        proposal_kinds: condition.proposal_kinds as string[] | undefined,
      };

    case 'hallucination_detected':
      if (
        condition.severity !== undefined &&
        !['minor', 'significant', 'critical'].includes(condition.severity as string)
      ) {
        throw new PolicyParseError(
          `${path}.severity must be 'minor', 'significant', or 'critical'`,
        );
      }
      return {
        kind: 'hallucination_detected',
        severity: condition.severity as 'minor' | 'significant' | 'critical' | undefined,
      };

    case 'mode_is':
      if (!['wellness', 'advocate_clinical'].includes(condition.mode as string)) {
        throw new PolicyParseError(
          `${path}.mode must be 'wellness' or 'advocate_clinical' for 'mode_is'`,
        );
      }
      return {
        kind: 'mode_is',
        mode: condition.mode as 'wellness' | 'advocate_clinical',
      };

    case 'acuity_at_least':
      if (!['low', 'moderate', 'high', 'critical'].includes(condition.level as string)) {
        throw new PolicyParseError(
          `${path}.level must be 'low', 'moderate', 'high', or 'critical' for 'acuity_at_least'`,
        );
      }
      return {
        kind: 'acuity_at_least',
        level: condition.level as 'low' | 'moderate' | 'high' | 'critical',
      };

    case 'intervention_risk_at_least':
      if (!['low', 'moderate', 'high', 'critical'].includes(condition.level as string)) {
        throw new PolicyParseError(
          `${path}.level must be 'low', 'moderate', 'high', or 'critical' for 'intervention_risk_at_least'`,
        );
      }
      return {
        kind: 'intervention_risk_at_least',
        level: condition.level as 'low' | 'moderate' | 'high' | 'critical',
      };

    // ── Clinical grounding conditions (v2.1) ──

    case 'medication_class_in':
      if (!Array.isArray(condition.classes)) {
        throw new PolicyParseError(`${path}.classes is required for 'medication_class_in'`);
      }
      return { kind: 'medication_class_in', classes: condition.classes as string[] };

    case 'medication_name_in':
      if (!Array.isArray(condition.names)) {
        throw new PolicyParseError(`${path}.names is required for 'medication_name_in'`);
      }
      return { kind: 'medication_name_in', names: condition.names as string[] };

    case 'snapshot_lab_below':
      if (typeof condition.lab !== 'string') {
        throw new PolicyParseError(`${path}.lab is required for 'snapshot_lab_below'`);
      }
      if (typeof condition.threshold !== 'number') {
        throw new PolicyParseError(`${path}.threshold is required for 'snapshot_lab_below'`);
      }
      return { kind: 'snapshot_lab_below', lab: condition.lab, threshold: condition.threshold };

    case 'snapshot_lab_above':
      if (typeof condition.lab !== 'string') {
        throw new PolicyParseError(`${path}.lab is required for 'snapshot_lab_above'`);
      }
      if (typeof condition.threshold !== 'number') {
        throw new PolicyParseError(`${path}.threshold is required for 'snapshot_lab_above'`);
      }
      return { kind: 'snapshot_lab_above', lab: condition.lab, threshold: condition.threshold };

    case 'snapshot_lab_missing':
      if (typeof condition.lab !== 'string') {
        throw new PolicyParseError(`${path}.lab is required for 'snapshot_lab_missing'`);
      }
      return { kind: 'snapshot_lab_missing', lab: condition.lab };

    case 'snapshot_condition_present':
      if (typeof condition.condition !== 'string') {
        throw new PolicyParseError(
          `${path}.condition is required for 'snapshot_condition_present'`,
        );
      }
      return { kind: 'snapshot_condition_present', condition: condition.condition };

    case 'snapshot_field_missing':
      if (typeof condition.field !== 'string') {
        throw new PolicyParseError(`${path}.field is required for 'snapshot_field_missing'`);
      }
      return { kind: 'snapshot_field_missing', field: condition.field };

    case 'combination_present':
      if (typeof condition.class_a !== 'string') {
        throw new PolicyParseError(`${path}.class_a is required for 'combination_present'`);
      }
      if (typeof condition.class_b !== 'string') {
        throw new PolicyParseError(`${path}.class_b is required for 'combination_present'`);
      }
      return {
        kind: 'combination_present',
        class_a: condition.class_a,
        class_b: condition.class_b,
      };

    case 'allergy_match':
      if (!['atc_class', 'substance', 'either'].includes(condition.match_on as string)) {
        throw new PolicyParseError(
          `${path}.match_on must be 'atc_class', 'substance', or 'either'`,
        );
      }
      return {
        kind: 'allergy_match',
        match_on: condition.match_on as 'atc_class' | 'substance' | 'either',
      };

    case 'recent_medication_class':
      if (!Array.isArray(condition.classes)) {
        throw new PolicyParseError(`${path}.classes is required for 'recent_medication_class'`);
      }
      if (typeof condition.within_hours !== 'number' || condition.within_hours <= 0) {
        throw new PolicyParseError(
          `${path}.within_hours must be a positive number for 'recent_medication_class'`,
        );
      }
      return {
        kind: 'recent_medication_class',
        classes: condition.classes as string[],
        within_hours: condition.within_hours,
      };

    case 'dose_exceeds_max':
      if (typeof condition.medication !== 'string') {
        throw new PolicyParseError(`${path}.medication is required for 'dose_exceeds_max'`);
      }
      if (typeof condition.max_value !== 'number') {
        throw new PolicyParseError(`${path}.max_value is required for 'dose_exceeds_max'`);
      }
      if (typeof condition.max_unit !== 'string') {
        throw new PolicyParseError(`${path}.max_unit is required for 'dose_exceeds_max'`);
      }
      return {
        kind: 'dose_exceeds_max',
        medication: condition.medication,
        max_value: condition.max_value,
        max_unit: condition.max_unit,
      };

    // ── Multi-vendor conditions (v2.2) ──

    case 'vendor_id_in':
      if (!Array.isArray(condition.vendor_ids)) {
        throw new PolicyParseError(`${path}.vendor_ids is required for 'vendor_id_in'`);
      }
      return { kind: 'vendor_id_in', vendor_ids: condition.vendor_ids as string[] };

    case 'vendor_risk_tier_at_least':
      if (!['low', 'moderate', 'high', 'unclassified'].includes(condition.level as string)) {
        throw new PolicyParseError(
          `${path}.level must be 'low', 'moderate', 'high', or 'unclassified' for 'vendor_risk_tier_at_least'`,
        );
      }
      return {
        kind: 'vendor_risk_tier_at_least',
        level: condition.level as 'low' | 'moderate' | 'high' | 'unclassified',
      };

    case 'vendor_missing':
      return { kind: 'vendor_missing' } as RuleCondition;

    case 'other':
      if (typeof condition.expr !== 'string') {
        throw new PolicyParseError(`${path}.expr is required for 'other'`);
      }
      return { kind: 'other', expr: condition.expr };

    default:
      throw new PolicyParseError(`${path}.kind '${kind}' is not implemented`);
  }
}

/**
 * Validate a rule action.
 */
function validateAction(data: unknown, path: string): RuleAction {
  if (!data || typeof data !== 'object') {
    throw new PolicyParseError(`${path} must be an object`);
  }

  const action = data as Record<string, unknown>;

  // Validate decision
  if (!SUPERVISION_DECISIONS.includes(action.decision as (typeof SUPERVISION_DECISIONS)[number])) {
    throw new PolicyParseError(
      `${path}.decision must be one of: ${SUPERVISION_DECISIONS.join(', ')}`,
    );
  }

  // Validate reason_codes
  if (!Array.isArray(action.reason_codes)) {
    throw new PolicyParseError(`${path}.reason_codes must be an array`);
  }

  for (const code of action.reason_codes) {
    if (!REASON_CODES.includes(code as (typeof REASON_CODES)[number])) {
      throw new PolicyParseError(`${path}.reason_codes contains invalid code: ${code}`);
    }
  }

  // Validate explanation
  if (typeof action.explanation !== 'string') {
    throw new PolicyParseError(`${path}.explanation is required and must be a string`);
  }

  const ruleAction: RuleAction = {
    decision: action.decision as (typeof SUPERVISION_DECISIONS)[number],
    reason_codes: action.reason_codes as (typeof REASON_CODES)[number][],
    explanation: action.explanation,
  };

  // Optional continue
  if (action.continue !== undefined) {
    if (typeof action.continue !== 'boolean') {
      throw new PolicyParseError(`${path}.continue must be a boolean`);
    }
    ruleAction.continue = action.continue;
  }

  // Optional approved_constraints
  if (action.approved_constraints !== undefined) {
    if (typeof action.approved_constraints !== 'object') {
      throw new PolicyParseError(`${path}.approved_constraints must be an object`);
    }
    const constraints = action.approved_constraints as Record<string, unknown>;
    ruleAction.approved_constraints = {
      must_route_after: constraints.must_route_after as string | undefined,
      allowed_actions: constraints.allowed_actions as string[] | undefined,
    };
  }

  // Optional control_commands
  if (action.control_commands !== undefined) {
    if (!Array.isArray(action.control_commands)) {
      throw new PolicyParseError(`${path}.control_commands must be an array`);
    }
    ruleAction.control_commands = action.control_commands.map((cmd, i) => {
      if (!cmd || typeof cmd !== 'object') {
        throw new PolicyParseError(`${path}.control_commands[${i}] must be an object`);
      }
      const c = cmd as Record<string, unknown>;
      if (!['SET_SAFE_MODE', 'SET_OPERATIONAL_SETTING'].includes(c.kind as string)) {
        throw new PolicyParseError(
          `${path}.control_commands[${i}].kind must be 'SET_SAFE_MODE' or 'SET_OPERATIONAL_SETTING'`,
        );
      }
      return c as RuleAction['control_commands'][number];
    });
  }

  return ruleAction;
}

// =============================================================================
// Provenance Validation (v2.1)
// =============================================================================

const VALID_SOURCE_TYPES = [
  'medication_label',
  'black_box_warning',
  'contraindication',
  'drug_interaction',
  'rems_requirement',
  'society_guideline',
  'expert_consensus',
  'site_protocol',
  'formulary_rule',
  'governance_requirement',
  'emerging_evidence',
  'internal_policy',
];

const VALID_SOURCE_LAYERS = [1, 2, 3, 4, 5];

/**
 * Validate rule provenance block.
 */
function validateProvenance(data: unknown, path: string): import('./types').RuleProvenance {
  if (!data || typeof data !== 'object') {
    throw new PolicyParseError(`${path} must be an object`);
  }

  const p = data as Record<string, unknown>;

  // Required fields
  if (!VALID_SOURCE_TYPES.includes(p.source_type as string)) {
    throw new PolicyParseError(
      `${path}.source_type must be one of: ${VALID_SOURCE_TYPES.join(', ')}`,
    );
  }
  if (!VALID_SOURCE_LAYERS.includes(p.source_layer as number)) {
    throw new PolicyParseError(`${path}.source_layer must be 1, 2, 3, 4, or 5`);
  }
  if (typeof p.citation !== 'string' || p.citation.trim() === '') {
    throw new PolicyParseError(`${path}.citation is required and must be a non-empty string`);
  }
  if (!EVIDENCE_GRADES.includes(p.evidence_grade as (typeof EVIDENCE_GRADES)[number])) {
    throw new PolicyParseError(`${path}.evidence_grade must be a valid EvidenceGrade`);
  }
  if (typeof p.jurisdiction !== 'string') {
    throw new PolicyParseError(`${path}.jurisdiction is required`);
  }
  if (typeof p.clinical_domain !== 'string') {
    throw new PolicyParseError(`${path}.clinical_domain is required`);
  }
  if (typeof p.approved_by !== 'string') {
    throw new PolicyParseError(`${path}.approved_by is required`);
  }
  if (typeof p.effective_date !== 'string') {
    throw new PolicyParseError(`${path}.effective_date is required`);
  }
  if (typeof p.review_interval_days !== 'number' || p.review_interval_days <= 0) {
    throw new PolicyParseError(`${path}.review_interval_days must be a positive number`);
  }
  if (typeof p.review_due !== 'string') {
    throw new PolicyParseError(`${path}.review_due is required`);
  }

  return p as unknown as import('./types').RuleProvenance;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Check if a string is a valid semver version.
 */
function isValidSemver(version: string): boolean {
  return /^\d+\.\d+\.\d+(-[\w.-]+)?(\+[\w.-]+)?$/.test(version);
}
