/**
 * Policy Pack Parser Tests
 */

import { describe, expect, test } from 'bun:test';
import {
  PolicyParseError,
  parsePolicyPack,
  parsePolicyPackJson,
  parsePolicyPackYaml,
} from './parser';
import type { PolicyPack } from './types';

describe('Policy Pack Parser', () => {
  describe('parsePolicyPackYaml', () => {
    test('parses valid minimal policy pack', () => {
      const yaml = `
policy_id: test-policy
policy_version: 1.0.0
rules:
  - rule_id: test-rule
    description: Test rule
    priority: 100
    when:
      kind: always
    then:
      decision: APPROVED
      reason_codes:
        - approved_with_constraints
      explanation: Test explanation
`;

      const pack = parsePolicyPackYaml(yaml);

      expect(pack.policy_id).toBe('test-policy');
      expect(pack.policy_version).toBe('1.0.0');
      expect(pack.rules).toHaveLength(1);
      expect(pack.rules[0].rule_id).toBe('test-rule');
      expect(pack.rules[0].priority).toBe(100);
      expect(pack.rules[0].when.kind).toBe('always');
      expect(pack.rules[0].then.decision).toBe('APPROVED');
    });

    test('parses policy pack with metadata', () => {
      const yaml = `
policy_id: test-policy
policy_version: 1.0.0
metadata:
  description: Test description
  owner: Test Owner
  created_at: "2026-01-26"
  sources:
    - kind: policy
      citation: "Test citation"
rules: []
`;

      const pack = parsePolicyPackYaml(yaml);

      expect(pack.metadata?.description).toBe('Test description');
      expect(pack.metadata?.owner).toBe('Test Owner');
      expect(pack.metadata?.sources).toHaveLength(1);
      expect(pack.metadata?.sources?.[0].kind).toBe('policy');
    });

    test('parses policy pack with staleness config', () => {
      const yaml = `
policy_id: test-policy
policy_version: 1.0.0
staleness:
  thresholds:
    wellness_hours: 24
    clinical_hours: 4
  behavior:
    low_risk_stale: REQUEST_MORE_INFO
    high_risk_stale: ROUTE_TO_CLINICIAN
rules: []
`;

      const pack = parsePolicyPackYaml(yaml);

      expect(pack.staleness?.thresholds.wellness_hours).toBe(24);
      expect(pack.staleness?.thresholds.clinical_hours).toBe(4);
      expect(pack.staleness?.behavior.low_risk_stale).toBe('REQUEST_MORE_INFO');
      expect(pack.staleness?.behavior.high_risk_stale).toBe('ROUTE_TO_CLINICIAN');
    });
  });

  describe('parsePolicyPackJson', () => {
    test('parses valid JSON policy pack', () => {
      const json = JSON.stringify({
        policy_id: 'test-policy',
        policy_version: '1.0.0',
        rules: [
          {
            rule_id: 'test-rule',
            description: 'Test rule',
            priority: 100,
            when: { kind: 'always' },
            // biome-ignore lint/suspicious/noThenProperty: Safety DSL spec
            then: {
              decision: 'APPROVED',
              reason_codes: ['approved_with_constraints'],
              explanation: 'Test',
            },
          },
        ],
      });

      const pack = parsePolicyPackJson(json);

      expect(pack.policy_id).toBe('test-policy');
      expect(pack.rules).toHaveLength(1);
    });
  });

  describe('Condition Parsing', () => {
    const createPackWithCondition = (condition: unknown): PolicyPack => {
      return parsePolicyPack({
        policy_id: 'test',
        policy_version: '1.0.0',
        rules: [
          {
            rule_id: 'test-rule',
            description: 'Test',
            priority: 100,
            when: condition,
            // biome-ignore lint/suspicious/noThenProperty: Safety DSL spec
            then: {
              decision: 'APPROVED',
              reason_codes: ['approved_with_constraints'],
              explanation: 'Test',
            },
          },
        ],
      });
    };

    test('parses all_of condition', () => {
      const pack = createPackWithCondition({
        kind: 'all_of',
        conditions: [{ kind: 'always' }, { kind: 'safe_mode_enabled' }],
      });

      const condition = pack.rules[0].when;
      expect(condition.kind).toBe('all_of');
      if (condition.kind === 'all_of') {
        expect(condition.conditions).toHaveLength(2);
        expect(condition.conditions[0].kind).toBe('always');
        expect(condition.conditions[1].kind).toBe('safe_mode_enabled');
      }
    });

    test('parses any_of condition', () => {
      const pack = createPackWithCondition({
        kind: 'any_of',
        conditions: [{ kind: 'snapshot_stale' }, { kind: 'snapshot_missing' }],
      });

      const condition = pack.rules[0].when;
      expect(condition.kind).toBe('any_of');
      if (condition.kind === 'any_of') {
        expect(condition.conditions).toHaveLength(2);
      }
    });

    test('parses not condition', () => {
      const pack = createPackWithCondition({
        kind: 'not',
        condition: { kind: 'safe_mode_enabled' },
      });

      const condition = pack.rules[0].when;
      expect(condition.kind).toBe('not');
      if (condition.kind === 'not') {
        expect(condition.condition.kind).toBe('safe_mode_enabled');
      }
    });

    test('parses nested boolean conditions', () => {
      const pack = createPackWithCondition({
        kind: 'all_of',
        conditions: [
          { kind: 'snapshot_stale' },
          {
            kind: 'any_of',
            conditions: [
              { kind: 'proposal_kind_in', kinds: ['MEDICATION_ORDER_PROPOSAL'] },
              { kind: 'uncertainty_at_least', level: 'high' },
            ],
          },
        ],
      });

      const condition = pack.rules[0].when;
      expect(condition.kind).toBe('all_of');
      if (condition.kind === 'all_of') {
        expect(condition.conditions[1].kind).toBe('any_of');
      }
    });

    test('parses proposal_kind_in condition', () => {
      const pack = createPackWithCondition({
        kind: 'proposal_kind_in',
        kinds: ['MEDICATION_ORDER_PROPOSAL', 'TRIAGE_ROUTE'],
      });

      const condition = pack.rules[0].when;
      expect(condition.kind).toBe('proposal_kind_in');
      if (condition.kind === 'proposal_kind_in') {
        expect(condition.kinds).toContain('MEDICATION_ORDER_PROPOSAL');
        expect(condition.kinds).toContain('TRIAGE_ROUTE');
      }
    });

    test('parses htv_score_below condition', () => {
      const pack = createPackWithCondition({
        kind: 'htv_score_below',
        threshold: 0.6,
        proposal_kinds: ['MEDICATION_ORDER_PROPOSAL'],
      });

      const condition = pack.rules[0].when;
      expect(condition.kind).toBe('htv_score_below');
      if (condition.kind === 'htv_score_below') {
        expect(condition.threshold).toBe(0.6);
        expect(condition.proposal_kinds).toContain('MEDICATION_ORDER_PROPOSAL');
      }
    });

    test('parses evidence_grade_below condition', () => {
      const pack = createPackWithCondition({
        kind: 'evidence_grade_below',
        threshold: 'cohort',
      });

      const condition = pack.rules[0].when;
      expect(condition.kind).toBe('evidence_grade_below');
      if (condition.kind === 'evidence_grade_below') {
        expect(condition.threshold).toBe('cohort');
      }
    });

    test('parses snapshot_stale_by condition', () => {
      const pack = createPackWithCondition({
        kind: 'snapshot_stale_by',
        hours: 6,
      });

      const condition = pack.rules[0].when;
      expect(condition.kind).toBe('snapshot_stale_by');
      if (condition.kind === 'snapshot_stale_by') {
        expect(condition.hours).toBe(6);
      }
    });

    test('parses hallucination_detected condition', () => {
      const pack = createPackWithCondition({
        kind: 'hallucination_detected',
        severity: 'critical',
      });

      const condition = pack.rules[0].when;
      expect(condition.kind).toBe('hallucination_detected');
      if (condition.kind === 'hallucination_detected') {
        expect(condition.severity).toBe('critical');
      }
    });

    test('parses domain_status_in condition', () => {
      const pack = createPackWithCondition({
        kind: 'domain_status_in',
        statuses: ['failed', 'degraded'],
        domain_category: 'clinical',
      });

      const condition = pack.rules[0].when;
      expect(condition.kind).toBe('domain_status_in');
      if (condition.kind === 'domain_status_in') {
        expect(condition.statuses).toContain('failed');
        expect(condition.domain_category).toBe('clinical');
      }
    });
  });

  describe('Action Parsing', () => {
    const createPackWithAction = (action: unknown): PolicyPack => {
      return parsePolicyPack({
        policy_id: 'test',
        policy_version: '1.0.0',
        rules: [
          {
            rule_id: 'test-rule',
            description: 'Test',
            priority: 100,
            when: { kind: 'always' },
            // biome-ignore lint/suspicious/noThenProperty: Safety DSL spec
            then: action,
          },
        ],
      });
    };

    test('parses all decision types', () => {
      for (const decision of ['APPROVED', 'HARD_STOP', 'ROUTE_TO_CLINICIAN', 'REQUEST_MORE_INFO']) {
        const pack = createPackWithAction({
          decision,
          reason_codes: ['other'],
          explanation: 'Test',
        });
        expect(pack.rules[0].then.decision).toBe(decision);
      }
    });

    test('parses action with continue flag', () => {
      const pack = createPackWithAction({
        decision: 'APPROVED',
        reason_codes: ['approved_with_constraints'],
        explanation: 'Test',
        continue: true,
      });

      expect(pack.rules[0].then.continue).toBe(true);
    });

    test('parses action with approved_constraints', () => {
      const pack = createPackWithAction({
        decision: 'APPROVED',
        reason_codes: ['approved_with_constraints'],
        explanation: 'Test',
        approved_constraints: {
          must_route_after: 'P7D',
          allowed_actions: ['dose_adjust'],
        },
      });

      expect(pack.rules[0].then.approved_constraints?.must_route_after).toBe('P7D');
      expect(pack.rules[0].then.approved_constraints?.allowed_actions).toContain('dose_adjust');
    });

    test('parses action with control_commands', () => {
      const pack = createPackWithAction({
        decision: 'HARD_STOP',
        reason_codes: ['policy_violation'],
        explanation: 'Test',
        control_commands: [
          {
            kind: 'SET_SAFE_MODE',
            safe_mode: {
              enabled: true,
              reason: 'Critical issue detected',
            },
          },
        ],
      });

      expect(pack.rules[0].then.control_commands).toHaveLength(1);
      expect(pack.rules[0].then.control_commands?.[0].kind).toBe('SET_SAFE_MODE');
    });
  });

  describe('Validation Errors', () => {
    test('throws on missing policy_id', () => {
      expect(() =>
        parsePolicyPack({
          policy_version: '1.0.0',
          rules: [],
        }),
      ).toThrow(PolicyParseError);
    });

    test('throws on invalid policy_version', () => {
      expect(() =>
        parsePolicyPack({
          policy_id: 'test',
          policy_version: 'invalid',
          rules: [],
        }),
      ).toThrow(PolicyParseError);
    });

    test('throws on missing rules', () => {
      expect(() =>
        parsePolicyPack({
          policy_id: 'test',
          policy_version: '1.0.0',
        }),
      ).toThrow(PolicyParseError);
    });

    test('throws on invalid condition kind', () => {
      expect(() =>
        parsePolicyPack({
          policy_id: 'test',
          policy_version: '1.0.0',
          rules: [
            {
              rule_id: 'test',
              description: 'Test',
              priority: 100,
              when: { kind: 'invalid_kind' },
              // biome-ignore lint/suspicious/noThenProperty: Safety DSL spec
              then: {
                decision: 'APPROVED',
                reason_codes: ['other'],
                explanation: 'Test',
              },
            },
          ],
        }),
      ).toThrow(PolicyParseError);
    });

    test('throws on invalid decision', () => {
      expect(() =>
        parsePolicyPack({
          policy_id: 'test',
          policy_version: '1.0.0',
          rules: [
            {
              rule_id: 'test',
              description: 'Test',
              priority: 100,
              when: { kind: 'always' },
              // biome-ignore lint/suspicious/noThenProperty: Safety DSL spec
              then: {
                decision: 'INVALID',
                reason_codes: ['other'],
                explanation: 'Test',
              },
            },
          ],
        }),
      ).toThrow(PolicyParseError);
    });

    test('throws on invalid reason_code', () => {
      expect(() =>
        parsePolicyPack({
          policy_id: 'test',
          policy_version: '1.0.0',
          rules: [
            {
              rule_id: 'test',
              description: 'Test',
              priority: 100,
              when: { kind: 'always' },
              // biome-ignore lint/suspicious/noThenProperty: Safety DSL spec
              then: {
                decision: 'APPROVED',
                reason_codes: ['invalid_code'],
                explanation: 'Test',
              },
            },
          ],
        }),
      ).toThrow(PolicyParseError);
    });

    test('throws on missing required condition fields', () => {
      expect(() =>
        parsePolicyPack({
          policy_id: 'test',
          policy_version: '1.0.0',
          rules: [
            {
              rule_id: 'test',
              description: 'Test',
              priority: 100,
              when: { kind: 'htv_score_below' }, // missing threshold
              // biome-ignore lint/suspicious/noThenProperty: Safety DSL spec
              then: {
                decision: 'APPROVED',
                reason_codes: ['other'],
                explanation: 'Test',
              },
            },
          ],
        }),
      ).toThrow(PolicyParseError);
    });
  });
});
