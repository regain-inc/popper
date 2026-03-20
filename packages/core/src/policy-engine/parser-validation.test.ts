/**
 * Parser validation tests — malformed provenance, pack metadata, condition kinds.
 * Covers T3-2: edge cases the parser should reject.
 */

// biome-ignore-all lint/suspicious/noThenProperty: Safety DSL uses 'then' as rule action clause per spec

import { describe, expect, test } from 'bun:test';
import { PolicyParseError, parsePolicyPackJson, parsePolicyPackYaml } from './parser';

// =============================================================================
// Helpers
// =============================================================================

/** Minimal valid pack YAML with one rule */
function minimalPackYaml(overrides: Record<string, unknown> = {}): string {
  const pack = {
    policy_id: 'test-pack',
    policy_version: '1.0.0',
    rules: [
      {
        rule_id: 'r1',
        description: 'test rule',
        priority: 100,
        when: { kind: 'always' },
        then: {
          decision: 'APPROVED',
          reason_codes: ['schema_invalid'],
          explanation: 'test',
        },
      },
    ],
    ...overrides,
  };
  // Use JSON as YAML since JSON is valid YAML
  return JSON.stringify(pack);
}

function ruleWith(overrides: Record<string, unknown>) {
  return {
    rule_id: 'r1',
    description: 'test rule',
    priority: 100,
    when: { kind: 'always' },
    then: {
      decision: 'APPROVED',
      reason_codes: ['schema_invalid'],
      explanation: 'test',
    },
    ...overrides,
  };
}

function packWith(rules: unknown[]) {
  return JSON.stringify({
    policy_id: 'test-pack',
    policy_version: '1.0.0',
    rules,
  });
}

// =============================================================================
// Pack-level validation
// =============================================================================

describe('pack-level validation', () => {
  test('rejects null input', () => {
    expect(() => parsePolicyPackJson('null')).toThrow(PolicyParseError);
  });

  test('rejects non-object input', () => {
    expect(() => parsePolicyPackJson('"hello"')).toThrow(PolicyParseError);
  });

  test('rejects missing policy_id', () => {
    expect(() =>
      parsePolicyPackJson(
        JSON.stringify({
          policy_version: '1.0.0',
          rules: [],
        }),
      ),
    ).toThrow(/policy_id/);
  });

  test('rejects empty policy_id', () => {
    expect(() =>
      parsePolicyPackJson(
        JSON.stringify({
          policy_id: '',
          policy_version: '1.0.0',
          rules: [],
        }),
      ),
    ).toThrow(/policy_id/);
  });

  test('rejects missing policy_version', () => {
    expect(() =>
      parsePolicyPackJson(
        JSON.stringify({
          policy_id: 'test',
          rules: [],
        }),
      ),
    ).toThrow(/policy_version/);
  });

  test('rejects invalid semver', () => {
    expect(() =>
      parsePolicyPackJson(
        JSON.stringify({
          policy_id: 'test',
          policy_version: 'not-semver',
          rules: [],
        }),
      ),
    ).toThrow(/policy_version/);
  });

  test('rejects rules as non-array', () => {
    expect(() =>
      parsePolicyPackJson(
        JSON.stringify({
          policy_id: 'test',
          policy_version: '1.0.0',
          rules: 'not-an-array',
        }),
      ),
    ).toThrow(/rules/);
  });

  test('rejects invalid pack_type', () => {
    expect(() =>
      parsePolicyPackYaml(
        minimalPackYaml({
          pack_type: 'invalid',
        }),
      ),
    ).toThrow(/pack_type/);
  });

  test('accepts valid pack_type values', () => {
    for (const packType of ['core', 'domain', 'site', 'modality']) {
      const pack = parsePolicyPackYaml(minimalPackYaml({ pack_type: packType }));
      expect(pack.policy_id).toBe('test-pack');
    }
  });
});

// =============================================================================
// Metadata validation
// =============================================================================

describe('metadata validation', () => {
  test('rejects non-object metadata', () => {
    expect(() =>
      parsePolicyPackYaml(
        minimalPackYaml({
          metadata: 'not-an-object',
        }),
      ),
    ).toThrow(/metadata/);
  });

  test('rejects non-string description', () => {
    expect(() =>
      parsePolicyPackYaml(
        minimalPackYaml({
          metadata: { description: 123 },
        }),
      ),
    ).toThrow(/description/);
  });

  test('rejects non-array sources', () => {
    expect(() =>
      parsePolicyPackYaml(
        minimalPackYaml({
          metadata: { sources: 'not-array' },
        }),
      ),
    ).toThrow(/sources/);
  });

  test('rejects source with invalid kind', () => {
    expect(() =>
      parsePolicyPackYaml(
        minimalPackYaml({
          metadata: { sources: [{ kind: 'invalid', citation: 'test' }] },
        }),
      ),
    ).toThrow(/kind/);
  });

  test('rejects source with missing citation', () => {
    expect(() =>
      parsePolicyPackYaml(
        minimalPackYaml({
          metadata: { sources: [{ kind: 'guideline' }] },
        }),
      ),
    ).toThrow(/citation/);
  });

  test('accepts valid metadata', () => {
    const pack = parsePolicyPackYaml(
      minimalPackYaml({
        metadata: {
          description: 'Test pack',
          owner: 'Test Team',
          sources: [{ kind: 'guideline', citation: 'AHA 2022' }],
        },
      }),
    );
    expect(pack.metadata?.description).toBe('Test pack');
  });
});

// =============================================================================
// depends_on validation
// =============================================================================

describe('depends_on validation', () => {
  test('rejects non-array depends_on', () => {
    expect(() =>
      parsePolicyPackYaml(
        minimalPackYaml({
          depends_on: 'not-array',
        }),
      ),
    ).toThrow(/depends_on/);
  });

  test('rejects depends_on entry without pack_id', () => {
    expect(() =>
      parsePolicyPackYaml(
        minimalPackYaml({
          depends_on: [{ version_constraint: '>=1.0.0' }],
        }),
      ),
    ).toThrow(/pack_id/);
  });

  test('rejects depends_on entry without version_constraint', () => {
    expect(() =>
      parsePolicyPackYaml(
        minimalPackYaml({
          depends_on: [{ pack_id: 'core' }],
        }),
      ),
    ).toThrow(/version_constraint/);
  });
});

// =============================================================================
// Staleness config validation
// =============================================================================

describe('staleness config validation', () => {
  test('rejects non-object staleness', () => {
    expect(() =>
      parsePolicyPackYaml(
        minimalPackYaml({
          staleness: 'bad',
        }),
      ),
    ).toThrow(/staleness/);
  });

  test('rejects missing thresholds', () => {
    expect(() =>
      parsePolicyPackYaml(
        minimalPackYaml({
          staleness: {
            behavior: { low_risk_stale: 'REQUEST_MORE_INFO', high_risk_stale: 'HARD_STOP' },
          },
        }),
      ),
    ).toThrow(/thresholds/);
  });

  test('rejects zero wellness_hours', () => {
    expect(() =>
      parsePolicyPackYaml(
        minimalPackYaml({
          staleness: {
            thresholds: { wellness_hours: 0, clinical_hours: 4 },
            behavior: { low_risk_stale: 'REQUEST_MORE_INFO', high_risk_stale: 'HARD_STOP' },
          },
        }),
      ),
    ).toThrow(/wellness_hours/);
  });

  test('rejects invalid low_risk_stale', () => {
    expect(() =>
      parsePolicyPackYaml(
        minimalPackYaml({
          staleness: {
            thresholds: { wellness_hours: 24, clinical_hours: 4 },
            behavior: { low_risk_stale: 'INVALID', high_risk_stale: 'HARD_STOP' },
          },
        }),
      ),
    ).toThrow(/low_risk_stale/);
  });
});

// =============================================================================
// Rule validation
// =============================================================================

describe('rule validation', () => {
  test('rejects rule without rule_id', () => {
    expect(() =>
      parsePolicyPackJson(
        packWith([
          {
            description: 'test',
            priority: 100,
            when: { kind: 'always' },
            then: { decision: 'APPROVED', reason_codes: ['schema_invalid'], explanation: 'test' },
          },
        ]),
      ),
    ).toThrow(/rule_id/);
  });

  test('rejects empty rule_id', () => {
    expect(() => parsePolicyPackJson(packWith([ruleWith({ rule_id: '' })]))).toThrow(/rule_id/);
  });

  test('rejects missing priority', () => {
    expect(() => parsePolicyPackJson(packWith([ruleWith({ priority: undefined })]))).toThrow(
      /priority/,
    );
  });

  test('rejects string priority', () => {
    expect(() => parsePolicyPackJson(packWith([ruleWith({ priority: 'high' })]))).toThrow(
      /priority/,
    );
  });

  test('rejects missing when', () => {
    expect(() => parsePolicyPackJson(packWith([ruleWith({ when: undefined })]))).toThrow(/when/);
  });

  test('rejects missing then', () => {
    expect(() => parsePolicyPackJson(packWith([ruleWith({ then: undefined })]))).toThrow(/then/);
  });

  test('rejects non-boolean requires_human_review', () => {
    expect(() =>
      parsePolicyPackJson(packWith([ruleWith({ requires_human_review: 'yes' })])),
    ).toThrow(/requires_human_review/);
  });
});

// =============================================================================
// Condition kind validation
// =============================================================================

describe('condition kind validation', () => {
  test('rejects unknown condition kind', () => {
    expect(() =>
      parsePolicyPackJson(packWith([ruleWith({ when: { kind: 'nonexistent_condition' } })])),
    ).toThrow(/not a valid condition kind/);
  });

  test('rejects condition without kind', () => {
    expect(() => parsePolicyPackJson(packWith([ruleWith({ when: { field_path: 'x' } })]))).toThrow(
      /kind/,
    );
  });

  test('rejects missing_field without field_path', () => {
    expect(() =>
      parsePolicyPackJson(packWith([ruleWith({ when: { kind: 'missing_field' } })])),
    ).toThrow(/field_path/);
  });

  test('rejects proposal_kind_in without kinds array', () => {
    expect(() =>
      parsePolicyPackJson(packWith([ruleWith({ when: { kind: 'proposal_kind_in' } })])),
    ).toThrow(/kinds/);
  });

  test('rejects snapshot_stale_by with zero hours', () => {
    expect(() =>
      parsePolicyPackJson(packWith([ruleWith({ when: { kind: 'snapshot_stale_by', hours: 0 } })])),
    ).toThrow(/hours/);
  });

  test('rejects snapshot_stale_by with negative hours', () => {
    expect(() =>
      parsePolicyPackJson(packWith([ruleWith({ when: { kind: 'snapshot_stale_by', hours: -1 } })])),
    ).toThrow(/hours/);
  });

  test('rejects uncertainty_at_least with invalid level', () => {
    expect(() =>
      parsePolicyPackJson(
        packWith([ruleWith({ when: { kind: 'uncertainty_at_least', level: 'extreme' } })]),
      ),
    ).toThrow(/level/);
  });

  test('rejects mode_is with invalid mode', () => {
    expect(() =>
      parsePolicyPackJson(packWith([ruleWith({ when: { kind: 'mode_is', mode: 'invalid' } })])),
    ).toThrow(/mode/);
  });

  test('rejects snapshot_lab_below without lab', () => {
    expect(() =>
      parsePolicyPackJson(
        packWith([ruleWith({ when: { kind: 'snapshot_lab_below', threshold: 3.5 } })]),
      ),
    ).toThrow(/lab/);
  });

  test('rejects snapshot_lab_below without threshold', () => {
    expect(() =>
      parsePolicyPackJson(
        packWith([ruleWith({ when: { kind: 'snapshot_lab_below', lab: 'potassium' } })]),
      ),
    ).toThrow(/threshold/);
  });

  test('rejects dose_exceeds_max without medication', () => {
    expect(() =>
      parsePolicyPackJson(
        packWith([ruleWith({ when: { kind: 'dose_exceeds_max', max_value: 40, max_unit: 'mg' } })]),
      ),
    ).toThrow(/medication/);
  });

  test('rejects dose_exceeds_max without max_value', () => {
    expect(() =>
      parsePolicyPackJson(
        packWith([
          ruleWith({
            when: { kind: 'dose_exceeds_max', medication: 'lisinopril', max_unit: 'mg' },
          }),
        ]),
      ),
    ).toThrow(/max_value/);
  });

  test('rejects combination_present without class_a', () => {
    expect(() =>
      parsePolicyPackJson(
        packWith([ruleWith({ when: { kind: 'combination_present', class_b: 'C09AA' } })]),
      ),
    ).toThrow(/class_a/);
  });

  test('rejects allergy_match with invalid match_on', () => {
    expect(() =>
      parsePolicyPackJson(
        packWith([ruleWith({ when: { kind: 'allergy_match', match_on: 'invalid' } })]),
      ),
    ).toThrow(/match_on/);
  });

  test('rejects recent_medication_class without within_hours', () => {
    expect(() =>
      parsePolicyPackJson(
        packWith([ruleWith({ when: { kind: 'recent_medication_class', classes: ['C09CA'] } })]),
      ),
    ).toThrow(/within_hours/);
  });

  test('rejects recent_medication_class with zero within_hours', () => {
    expect(() =>
      parsePolicyPackJson(
        packWith([
          ruleWith({
            when: { kind: 'recent_medication_class', classes: ['C09CA'], within_hours: 0 },
          }),
        ]),
      ),
    ).toThrow(/within_hours/);
  });

  test('rejects all_of without conditions array', () => {
    expect(() => parsePolicyPackJson(packWith([ruleWith({ when: { kind: 'all_of' } })]))).toThrow(
      /conditions/,
    );
  });

  test('rejects any_of without conditions array', () => {
    expect(() => parsePolicyPackJson(packWith([ruleWith({ when: { kind: 'any_of' } })]))).toThrow(
      /conditions/,
    );
  });

  test('rejects not without condition', () => {
    expect(() => parsePolicyPackJson(packWith([ruleWith({ when: { kind: 'not' } })]))).toThrow(
      /condition/,
    );
  });

  test('rejects other without expr', () => {
    expect(() => parsePolicyPackJson(packWith([ruleWith({ when: { kind: 'other' } })]))).toThrow(
      /expr/,
    );
  });

  test('validates nested boolean conditions recursively', () => {
    expect(() =>
      parsePolicyPackJson(
        packWith([
          ruleWith({
            when: {
              kind: 'all_of',
              conditions: [
                { kind: 'always' },
                { kind: 'snapshot_stale_by' }, // missing hours
              ],
            },
          }),
        ]),
      ),
    ).toThrow(/hours/);
  });
});

// =============================================================================
// Action validation
// =============================================================================

describe('action validation', () => {
  test('rejects invalid decision', () => {
    expect(() =>
      parsePolicyPackJson(
        packWith([
          ruleWith({
            then: { decision: 'YOLO', reason_codes: ['schema_invalid'], explanation: 'test' },
          }),
        ]),
      ),
    ).toThrow(/decision/);
  });

  test('rejects non-array reason_codes', () => {
    expect(() =>
      parsePolicyPackJson(
        packWith([
          ruleWith({ then: { decision: 'APPROVED', reason_codes: 'SAFE', explanation: 'test' } }),
        ]),
      ),
    ).toThrow(/reason_codes/);
  });

  test('rejects invalid reason code', () => {
    expect(() =>
      parsePolicyPackJson(
        packWith([
          ruleWith({
            then: { decision: 'APPROVED', reason_codes: ['NOT_A_REAL_CODE'], explanation: 'test' },
          }),
        ]),
      ),
    ).toThrow(/reason_codes/);
  });

  test('rejects missing explanation', () => {
    expect(() =>
      parsePolicyPackJson(
        packWith([ruleWith({ then: { decision: 'APPROVED', reason_codes: ['schema_invalid'] } })]),
      ),
    ).toThrow(/explanation/);
  });

  test('rejects non-boolean continue', () => {
    expect(() =>
      parsePolicyPackJson(
        packWith([
          ruleWith({
            then: {
              decision: 'APPROVED',
              reason_codes: ['schema_invalid'],
              explanation: 'test',
              continue: 'yes',
            },
          }),
        ]),
      ),
    ).toThrow(/continue/);
  });
});

// =============================================================================
// Provenance validation
// =============================================================================

describe('provenance validation', () => {
  const validProvenance = {
    source_type: 'society_guideline',
    source_layer: 2,
    citation: 'aha-acc-hfsa-hf-2022',
    evidence_grade: 'systematic_review',
    jurisdiction: 'US',
    clinical_domain: 'cardiology',
    approved_by: 'Clinical Board',
    effective_date: '2026-01-01',
    review_interval_days: 365,
    review_due: '2027-01-01',
  };

  test('accepts valid provenance', () => {
    const pack = parsePolicyPackJson(packWith([ruleWith({ provenance: validProvenance })]));
    expect(pack.rules[0].provenance?.source_type).toBe('society_guideline');
  });

  test('rejects invalid source_type', () => {
    expect(() =>
      parsePolicyPackJson(
        packWith([ruleWith({ provenance: { ...validProvenance, source_type: 'blog_post' } })]),
      ),
    ).toThrow(/source_type/);
  });

  test('rejects invalid source_layer', () => {
    expect(() =>
      parsePolicyPackJson(
        packWith([ruleWith({ provenance: { ...validProvenance, source_layer: 99 } })]),
      ),
    ).toThrow(/source_layer/);
  });

  test('rejects empty citation', () => {
    expect(() =>
      parsePolicyPackJson(
        packWith([ruleWith({ provenance: { ...validProvenance, citation: '' } })]),
      ),
    ).toThrow(/citation/);
  });

  test('rejects invalid evidence_grade', () => {
    expect(() =>
      parsePolicyPackJson(
        packWith([ruleWith({ provenance: { ...validProvenance, evidence_grade: 'excellent' } })]),
      ),
    ).toThrow(/evidence_grade/);
  });

  test('rejects missing jurisdiction', () => {
    expect(() =>
      parsePolicyPackJson(
        packWith([ruleWith({ provenance: { ...validProvenance, jurisdiction: undefined } })]),
      ),
    ).toThrow(/jurisdiction/);
  });

  test('rejects negative review_interval_days', () => {
    expect(() =>
      parsePolicyPackJson(
        packWith([ruleWith({ provenance: { ...validProvenance, review_interval_days: -1 } })]),
      ),
    ).toThrow(/review_interval_days/);
  });

  test('rejects zero review_interval_days', () => {
    expect(() =>
      parsePolicyPackJson(
        packWith([ruleWith({ provenance: { ...validProvenance, review_interval_days: 0 } })]),
      ),
    ).toThrow(/review_interval_days/);
  });

  test('rejects missing review_due', () => {
    expect(() =>
      parsePolicyPackJson(
        packWith([ruleWith({ provenance: { ...validProvenance, review_due: undefined } })]),
      ),
    ).toThrow(/review_due/);
  });
});

// =============================================================================
// Real YAML pack parsing
// =============================================================================

describe('real pack files', () => {
  const { readFile } = require('node:fs/promises');
  const { join } = require('node:path');

  test('parses default.yaml without errors', async () => {
    const content = await readFile(
      join(import.meta.dir, '../../../../config/policies/default.yaml'),
      'utf-8',
    );
    const pack = parsePolicyPackYaml(content);
    expect(pack.policy_id).toBeDefined();
    expect(pack.rules.length).toBeGreaterThan(0);
  });

  test('parses cardiometabolic-hf.yaml without errors', async () => {
    const content = await readFile(
      join(import.meta.dir, '../../../../config/policies/domains/cardiometabolic-hf.yaml'),
      'utf-8',
    );
    const pack = parsePolicyPackYaml(content);
    expect(pack.policy_id).toBeDefined();
    expect(pack.rules.length).toBeGreaterThan(0);
  });
});
