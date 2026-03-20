/**
 * Policy Engine Evaluator Tests
 */

import { describe, expect, test } from 'bun:test';
import type { SupervisionRequest } from '../hermes';
import type { EvaluationContext } from './evaluator';
import { createEvaluator, PolicyEvaluator } from './evaluator';
import type { PolicyPack, PolicyRule, RuleAction } from './types';

// =============================================================================
// Test Helpers
// =============================================================================

const createMinimalRequest = (overrides: Partial<SupervisionRequest> = {}): SupervisionRequest => ({
  hermes_version: '2.0.0',
  mode: 'wellness',
  trace: {
    request_id: 'test-request-1',
    created_at: new Date().toISOString(),
    producer: {
      system_id: 'test-system',
      system_version: '1.0.0',
    },
  },
  subject: {
    subject_id: 'patient-123',
    subject_type: 'patient',
  },
  proposals: [],
  ...overrides,
});

const createContext = (
  request: SupervisionRequest,
  controlPlane: EvaluationContext['controlPlane'] = {},
  derivedSignals: EvaluationContext['derivedSignals'] = {},
): EvaluationContext => ({
  request,
  controlPlane,
  derivedSignals,
});

const createRule = (
  id: string,
  priority: number,
  when: PolicyRule['when'],
  thenAction: Partial<RuleAction> = {},
): PolicyRule => ({
  rule_id: id,
  description: `Test rule ${id}`,
  priority,
  when,
  // biome-ignore lint/suspicious/noThenProperty: Safety DSL spec
  then: {
    decision: 'APPROVED',
    reason_codes: ['approved_with_constraints'],
    explanation: `Explanation for ${id}`,
    ...thenAction,
  },
});

const createPolicyPack = (rules: PolicyRule[]): PolicyPack => ({
  policy_id: 'test-policy',
  policy_version: '1.0.0',
  rules,
});

// =============================================================================
// Tests
// =============================================================================

describe('PolicyEvaluator', () => {
  describe('Basic Evaluation', () => {
    test('returns default ROUTE_TO_CLINICIAN when no rules match', () => {
      const pack = createPolicyPack([createRule('rule-1', 100, { kind: 'safe_mode_enabled' })]);
      const evaluator = createEvaluator(pack);
      const context = createContext(createMinimalRequest());

      const result = evaluator.evaluate(context);

      expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
      expect(result.reason_codes).toEqual(['other']);
      expect(result.matched_rules).toHaveLength(0);
    });

    test('matches always condition', () => {
      const pack = createPolicyPack([
        createRule('always-rule', 100, { kind: 'always' }, { decision: 'APPROVED' }),
      ]);
      const evaluator = createEvaluator(pack);
      const context = createContext(createMinimalRequest());

      const result = evaluator.evaluate(context);

      expect(result.decision).toBe('APPROVED');
      expect(result.matched_rules).toHaveLength(1);
      expect(result.matched_rules[0].rule_id).toBe('always-rule');
    });

    test('evaluates rules in priority order (highest first)', () => {
      const pack = createPolicyPack([
        createRule('low-priority', 10, { kind: 'always' }, { decision: 'APPROVED' }),
        createRule('high-priority', 100, { kind: 'always' }, { decision: 'HARD_STOP' }),
        createRule('mid-priority', 50, { kind: 'always' }, { decision: 'ROUTE_TO_CLINICIAN' }),
      ]);
      const evaluator = createEvaluator(pack);
      const context = createContext(createMinimalRequest());

      const result = evaluator.evaluate(context);

      // First match wins, high-priority rule evaluates first
      expect(result.decision).toBe('HARD_STOP');
      expect(result.matched_rules).toHaveLength(1);
      expect(result.matched_rules[0].rule_id).toBe('high-priority');
    });

    test('includes policy version in result', () => {
      const pack = createPolicyPack([createRule('r1', 100, { kind: 'always' })]);
      pack.policy_version = '2.3.4';
      const evaluator = createEvaluator(pack);

      const result = evaluator.evaluate(createContext(createMinimalRequest()));

      expect(result.policy_version).toBe('2.3.4');
    });

    test('tracks evaluation time', () => {
      const pack = createPolicyPack([createRule('r1', 100, { kind: 'always' })]);
      const evaluator = createEvaluator(pack);

      const result = evaluator.evaluate(createContext(createMinimalRequest()));

      expect(result.evaluation_time_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Boolean Conditions', () => {
    test('all_of matches when ALL conditions match', () => {
      const pack = createPolicyPack([
        createRule(
          'all-of-rule',
          100,
          {
            kind: 'all_of',
            conditions: [{ kind: 'always' }, { kind: 'always' }],
          },
          { decision: 'HARD_STOP' },
        ),
      ]);
      const evaluator = createEvaluator(pack);

      const result = evaluator.evaluate(createContext(createMinimalRequest()));

      expect(result.decision).toBe('HARD_STOP');
    });

    test('all_of fails when ANY condition fails', () => {
      const pack = createPolicyPack([
        createRule('all-of-rule', 100, {
          kind: 'all_of',
          conditions: [{ kind: 'always' }, { kind: 'safe_mode_enabled' }],
        }),
      ]);
      const evaluator = createEvaluator(pack);
      const context = createContext(createMinimalRequest());

      const result = evaluator.evaluate(context);

      expect(result.decision).toBe('ROUTE_TO_CLINICIAN'); // Default fallback
      expect(result.matched_rules).toHaveLength(0);
    });

    test('any_of matches when ANY condition matches', () => {
      const pack = createPolicyPack([
        createRule(
          'any-of-rule',
          100,
          {
            kind: 'any_of',
            conditions: [{ kind: 'safe_mode_enabled' }, { kind: 'always' }],
          },
          { decision: 'APPROVED' },
        ),
      ]);
      const evaluator = createEvaluator(pack);

      const result = evaluator.evaluate(createContext(createMinimalRequest()));

      expect(result.decision).toBe('APPROVED');
    });

    test('any_of fails when NO conditions match', () => {
      const pack = createPolicyPack([
        createRule('any-of-rule', 100, {
          kind: 'any_of',
          conditions: [{ kind: 'safe_mode_enabled' }, { kind: 'schema_invalid' }],
        }),
      ]);
      const evaluator = createEvaluator(pack);
      const context = createContext(createMinimalRequest());

      const result = evaluator.evaluate(context);

      expect(result.matched_rules).toHaveLength(0);
    });

    test('not inverts condition result', () => {
      const pack = createPolicyPack([
        createRule(
          'not-safe-mode',
          100,
          {
            kind: 'not',
            condition: { kind: 'safe_mode_enabled' },
          },
          { decision: 'APPROVED' },
        ),
      ]);
      const evaluator = createEvaluator(pack);
      const context = createContext(createMinimalRequest());

      const result = evaluator.evaluate(context);

      expect(result.decision).toBe('APPROVED');
    });

    test('nested boolean conditions work correctly', () => {
      const pack = createPolicyPack([
        createRule(
          'nested-rule',
          100,
          {
            kind: 'all_of',
            conditions: [
              { kind: 'always' },
              {
                kind: 'any_of',
                conditions: [{ kind: 'safe_mode_enabled' }, { kind: 'always' }],
              },
            ],
          },
          { decision: 'HARD_STOP' },
        ),
      ]);
      const evaluator = createEvaluator(pack);

      const result = evaluator.evaluate(createContext(createMinimalRequest()));

      expect(result.decision).toBe('HARD_STOP');
    });
  });

  describe('Continue Semantics', () => {
    test('stops at first match when continue is false', () => {
      const pack = createPolicyPack([
        createRule('rule-1', 100, { kind: 'always' }, { decision: 'APPROVED', continue: false }),
        createRule('rule-2', 90, { kind: 'always' }, { decision: 'HARD_STOP' }),
      ]);
      const evaluator = createEvaluator(pack);

      const result = evaluator.evaluate(createContext(createMinimalRequest()));

      expect(result.decision).toBe('APPROVED');
      expect(result.matched_rules).toHaveLength(1);
    });

    test('continues evaluation when continue is true', () => {
      const pack = createPolicyPack([
        createRule(
          'rule-1',
          100,
          { kind: 'always' },
          { decision: 'APPROVED', reason_codes: ['approved_with_constraints'], continue: true },
        ),
        createRule(
          'rule-2',
          90,
          { kind: 'always' },
          { decision: 'ROUTE_TO_CLINICIAN', reason_codes: ['needs_human_review'] },
        ),
      ]);
      const evaluator = createEvaluator(pack);

      const result = evaluator.evaluate(createContext(createMinimalRequest()));

      expect(result.matched_rules).toHaveLength(2);
    });

    test('chooses most conservative decision with continue', () => {
      const pack = createPolicyPack([
        createRule(
          'approved-rule',
          100,
          { kind: 'always' },
          { decision: 'APPROVED', continue: true },
        ),
        createRule(
          'route-rule',
          90,
          { kind: 'always' },
          { decision: 'ROUTE_TO_CLINICIAN', continue: true },
        ),
        createRule('stop-rule', 80, { kind: 'always' }, { decision: 'HARD_STOP' }),
      ]);
      const evaluator = createEvaluator(pack);

      const result = evaluator.evaluate(createContext(createMinimalRequest()));

      expect(result.decision).toBe('HARD_STOP');
      expect(result.matched_rules).toHaveLength(3);
    });

    test('aggregates reason codes with continue', () => {
      const pack = createPolicyPack([
        createRule(
          'rule-1',
          100,
          { kind: 'always' },
          {
            decision: 'APPROVED',
            reason_codes: ['approved_with_constraints'],
            continue: true,
          },
        ),
        createRule(
          'rule-2',
          90,
          { kind: 'always' },
          {
            decision: 'ROUTE_TO_CLINICIAN',
            reason_codes: ['needs_human_review', 'high_uncertainty'],
          },
        ),
      ]);
      const evaluator = createEvaluator(pack);

      const result = evaluator.evaluate(createContext(createMinimalRequest()));

      expect(result.reason_codes).toContain('approved_with_constraints');
      expect(result.reason_codes).toContain('needs_human_review');
      expect(result.reason_codes).toContain('high_uncertainty');
    });

    test('deduplicates reason codes', () => {
      const pack = createPolicyPack([
        createRule(
          'rule-1',
          100,
          { kind: 'always' },
          { decision: 'APPROVED', reason_codes: ['high_uncertainty'], continue: true },
        ),
        createRule(
          'rule-2',
          90,
          { kind: 'always' },
          { decision: 'ROUTE_TO_CLINICIAN', reason_codes: ['high_uncertainty'] },
        ),
      ]);
      const evaluator = createEvaluator(pack);

      const result = evaluator.evaluate(createContext(createMinimalRequest()));

      const uncertaintyCount = result.reason_codes.filter((c) => c === 'high_uncertainty').length;
      expect(uncertaintyCount).toBe(1);
    });
  });

  describe('Control Plane Conditions', () => {
    test('safe_mode_enabled matches when safe mode is on', () => {
      const pack = createPolicyPack([
        createRule('safe-mode-rule', 100, { kind: 'safe_mode_enabled' }, { decision: 'HARD_STOP' }),
      ]);
      const evaluator = createEvaluator(pack);
      const context = createContext(createMinimalRequest(), {
        safe_mode: { enabled: true },
      });

      const result = evaluator.evaluate(context);

      expect(result.decision).toBe('HARD_STOP');
    });

    test('safe_mode_enabled respects effective window', () => {
      const pack = createPolicyPack([
        createRule('safe-mode-rule', 100, { kind: 'safe_mode_enabled' }, { decision: 'HARD_STOP' }),
      ]);
      const evaluator = createEvaluator(pack);

      const now = new Date();
      const future = new Date(now.getTime() + 60000); // 1 minute in future

      const context = createContext(createMinimalRequest(), {
        safe_mode: {
          enabled: true,
          effective_at: future.toISOString(),
        },
        current_time: now,
      });

      const result = evaluator.evaluate(context);

      // Safe mode not yet effective
      expect(result.decision).toBe('ROUTE_TO_CLINICIAN'); // Default fallback
    });
  });

  describe('Derived Signal Conditions', () => {
    test('schema_invalid matches when signal is set', () => {
      const pack = createPolicyPack([
        createRule('schema-rule', 100, { kind: 'schema_invalid' }, { decision: 'HARD_STOP' }),
      ]);
      const evaluator = createEvaluator(pack);
      const context = createContext(createMinimalRequest(), {}, { schema_invalid: true });

      const result = evaluator.evaluate(context);

      expect(result.decision).toBe('HARD_STOP');
    });

    test('snapshot_stale matches when signal is set', () => {
      const pack = createPolicyPack([
        createRule(
          'stale-rule',
          100,
          { kind: 'snapshot_stale' },
          { decision: 'REQUEST_MORE_INFO' },
        ),
      ]);
      const evaluator = createEvaluator(pack);
      const context = createContext(createMinimalRequest(), {}, { snapshot_stale: true });

      const result = evaluator.evaluate(context);

      expect(result.decision).toBe('REQUEST_MORE_INFO');
    });

    test('snapshot_missing matches when signal is set', () => {
      const pack = createPolicyPack([
        createRule('missing-rule', 100, { kind: 'snapshot_missing' }, { decision: 'HARD_STOP' }),
      ]);
      const evaluator = createEvaluator(pack);
      const context = createContext(createMinimalRequest(), {}, { snapshot_missing: true });

      const result = evaluator.evaluate(context);

      expect(result.decision).toBe('HARD_STOP');
    });

    test('hallucination_detected matches any severity', () => {
      const pack = createPolicyPack([
        createRule(
          'hallucination-rule',
          100,
          { kind: 'hallucination_detected' },
          { decision: 'ROUTE_TO_CLINICIAN' },
        ),
      ]);
      const evaluator = createEvaluator(pack);
      const context = createContext(
        createMinimalRequest(),
        {},
        { hallucination: { detected: true, severity: 'minor' } },
      );

      const result = evaluator.evaluate(context);

      expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
    });

    test('hallucination_detected with severity filter', () => {
      const pack = createPolicyPack([
        createRule(
          'critical-hallucination',
          100,
          { kind: 'hallucination_detected', severity: 'critical' },
          { decision: 'HARD_STOP' },
        ),
      ]);
      const evaluator = createEvaluator(pack);

      // Minor severity should not match critical filter
      const minorContext = createContext(
        createMinimalRequest(),
        {},
        { hallucination: { detected: true, severity: 'minor' } },
      );
      expect(evaluator.evaluate(minorContext).matched_rules).toHaveLength(0);

      // Critical severity should match
      const criticalContext = createContext(
        createMinimalRequest(),
        {},
        { hallucination: { detected: true, severity: 'critical' } },
      );
      expect(evaluator.evaluate(criticalContext).decision).toBe('HARD_STOP');
    });

    test('idk_triggered matches when signal is set', () => {
      const pack = createPolicyPack([
        createRule('idk-rule', 100, { kind: 'idk_triggered' }, { decision: 'ROUTE_TO_CLINICIAN' }),
      ]);
      const evaluator = createEvaluator(pack);
      const context = createContext(createMinimalRequest(), {}, { idk_triggered: true });

      const result = evaluator.evaluate(context);

      expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
    });
  });

  describe('Proposal Conditions', () => {
    test('proposal_kind_in matches proposal kinds', () => {
      const pack = createPolicyPack([
        createRule(
          'med-rule',
          100,
          { kind: 'proposal_kind_in', kinds: ['MEDICATION_ORDER_PROPOSAL'] },
          { decision: 'ROUTE_TO_CLINICIAN' },
        ),
      ]);
      const evaluator = createEvaluator(pack);
      const request = createMinimalRequest({
        proposals: [
          {
            kind: 'MEDICATION_ORDER_PROPOSAL',
            proposal_id: 'p1',
            medication: { name: 'Test Med' },
            change: { change_type: 'titrate' },
          },
        ],
      });

      const result = evaluator.evaluate(createContext(request));

      expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
    });

    test('proposal_kind_in does not match when kind absent', () => {
      const pack = createPolicyPack([
        createRule(
          'med-rule',
          100,
          { kind: 'proposal_kind_in', kinds: ['MEDICATION_ORDER_PROPOSAL'] },
          { decision: 'HARD_STOP' },
        ),
      ]);
      const evaluator = createEvaluator(pack);
      const request = createMinimalRequest({
        proposals: [
          {
            kind: 'PATIENT_MESSAGE',
            proposal_id: 'p1',
            message_markdown: 'Hello',
          },
        ],
      });

      const result = evaluator.evaluate(createContext(request));

      expect(result.decision).toBe('ROUTE_TO_CLINICIAN'); // Default fallback
    });
  });

  describe('Input Risk Conditions', () => {
    test('input_risk_flag_in matches when flags present', () => {
      const pack = createPolicyPack([
        createRule(
          'risk-rule',
          100,
          { kind: 'input_risk_flag_in', flags: ['prompt_injection_suspected'] },
          { decision: 'HARD_STOP' },
        ),
      ]);
      const evaluator = createEvaluator(pack);
      const request = createMinimalRequest();
      (request as Record<string, unknown>).input_risk = {
        flags: ['prompt_injection_suspected', 'other_flag'],
      };

      const result = evaluator.evaluate(createContext(request));

      expect(result.decision).toBe('HARD_STOP');
    });
  });

  describe('HTV Score Conditions', () => {
    test('htv_score_below matches when score is below threshold', () => {
      const pack = createPolicyPack([
        createRule(
          'htv-rule',
          100,
          { kind: 'htv_score_below', threshold: 0.5 },
          { decision: 'ROUTE_TO_CLINICIAN' },
        ),
      ]);
      const evaluator = createEvaluator(pack);
      const request = createMinimalRequest({
        proposals: [
          {
            kind: 'MEDICATION_ORDER_PROPOSAL',
            proposal_id: 'p1',
            medication: { name: 'Test' },
            change: { change_type: 'titrate' },
            htv_score: {
              interdependence: 0.3,
              specificity: 0.3,
              parsimony: 0.3,
              falsifiability: 0.3,
              composite: 0.3,
            },
          },
        ],
      });

      const result = evaluator.evaluate(createContext(request));

      expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
    });

    test('htv_score_below treats missing HTV as below threshold', () => {
      const pack = createPolicyPack([
        createRule(
          'htv-rule',
          100,
          { kind: 'htv_score_below', threshold: 0.5 },
          { decision: 'ROUTE_TO_CLINICIAN' },
        ),
      ]);
      const evaluator = createEvaluator(pack);
      const request = createMinimalRequest({
        proposals: [
          {
            kind: 'MEDICATION_ORDER_PROPOSAL',
            proposal_id: 'p1',
            medication: { name: 'Test' },
            change: { change_type: 'titrate' },
            // No htv_score
          },
        ],
      });

      const result = evaluator.evaluate(createContext(request));

      expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
    });

    test('htv_score_below filters by proposal_kinds', () => {
      const pack = createPolicyPack([
        createRule(
          'htv-med-rule',
          100,
          {
            kind: 'htv_score_below',
            threshold: 0.5,
            proposal_kinds: ['MEDICATION_ORDER_PROPOSAL'],
          },
          { decision: 'HARD_STOP' },
        ),
      ]);
      const evaluator = createEvaluator(pack);

      // Low HTV on non-medication proposal should not match
      const request = createMinimalRequest({
        proposals: [
          {
            kind: 'PATIENT_MESSAGE',
            proposal_id: 'p1',
            message_markdown: 'Hello',
            htv_score: {
              interdependence: 0.3,
              specificity: 0.3,
              parsimony: 0.3,
              falsifiability: 0.3,
              composite: 0.3,
            },
          },
        ],
      });

      const result = evaluator.evaluate(createContext(request));

      expect(result.decision).toBe('ROUTE_TO_CLINICIAN'); // Default, not HARD_STOP
    });
  });

  describe('Evidence Grade Conditions', () => {
    test('evidence_grade_below matches when grade is below threshold', () => {
      const pack = createPolicyPack([
        createRule(
          'evidence-rule',
          100,
          { kind: 'evidence_grade_below', threshold: 'cohort' },
          { decision: 'ROUTE_TO_CLINICIAN' },
        ),
      ]);
      const evaluator = createEvaluator(pack);
      const request = createMinimalRequest({
        proposals: [
          {
            kind: 'MEDICATION_ORDER_PROPOSAL',
            proposal_id: 'p1',
            medication: { name: 'Test' },
            change: { change_type: 'titrate' },
            evidence_refs: [
              {
                evidence_id: 'e1',
                evidence_type: 'study',
                citation: 'Test',
                evidence_grade: 'case_report',
              },
            ],
          },
        ],
      });

      const result = evaluator.evaluate(createContext(request));

      expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
    });

    test('evidence_grade_below treats missing evidence as below threshold', () => {
      const pack = createPolicyPack([
        createRule(
          'evidence-rule',
          100,
          { kind: 'evidence_grade_below', threshold: 'cohort' },
          { decision: 'ROUTE_TO_CLINICIAN' },
        ),
      ]);
      const evaluator = createEvaluator(pack);
      const request = createMinimalRequest({
        proposals: [
          {
            kind: 'MEDICATION_ORDER_PROPOSAL',
            proposal_id: 'p1',
            medication: { name: 'Test' },
            change: { change_type: 'titrate' },
            // No evidence_refs
          },
        ],
      });

      const result = evaluator.evaluate(createContext(request));

      expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
    });
  });

  describe('Control Commands', () => {
    test('collects control commands from matched rules', () => {
      const pack = createPolicyPack([
        createRule(
          'command-rule',
          100,
          { kind: 'always' },
          {
            decision: 'HARD_STOP',
            control_commands: [
              {
                kind: 'SET_SAFE_MODE',
                safe_mode: { enabled: true, reason: 'Test reason' },
              },
            ],
          },
        ),
      ]);
      const evaluator = createEvaluator(pack);

      const result = evaluator.evaluate(createContext(createMinimalRequest()));

      expect(result.control_commands).toHaveLength(1);
      expect(result.control_commands?.[0].kind).toBe('SET_SAFE_MODE');
    });

    test('aggregates control commands from multiple rules', () => {
      const pack = createPolicyPack([
        createRule(
          'rule-1',
          100,
          { kind: 'always' },
          {
            decision: 'APPROVED',
            continue: true,
            control_commands: [
              { kind: 'SET_SAFE_MODE', safe_mode: { enabled: true, reason: 'R1' } },
            ],
          },
        ),
        createRule(
          'rule-2',
          90,
          { kind: 'always' },
          {
            decision: 'ROUTE_TO_CLINICIAN',
            control_commands: [
              { kind: 'SET_OPERATIONAL_SETTING', setting: { key: 'test', value: 'value' } },
            ],
          },
        ),
      ]);
      const evaluator = createEvaluator(pack);

      const result = evaluator.evaluate(createContext(createMinimalRequest()));

      expect(result.control_commands).toHaveLength(2);
    });
  });

  describe('Approved Constraints', () => {
    test('includes approved constraints from matching rule', () => {
      const pack = createPolicyPack([
        createRule(
          'constrained-approval',
          100,
          { kind: 'always' },
          {
            decision: 'APPROVED',
            approved_constraints: {
              must_route_after: 'P7D',
              allowed_actions: ['dose_adjust'],
            },
          },
        ),
      ]);
      const evaluator = createEvaluator(pack);

      const result = evaluator.evaluate(createContext(createMinimalRequest()));

      expect(result.approved_constraints?.must_route_after).toBe('P7D');
      expect(result.approved_constraints?.allowed_actions).toContain('dose_adjust');
    });
  });

  describe('createEvaluator helper', () => {
    test('creates PolicyEvaluator instance', () => {
      const pack = createPolicyPack([]);
      const evaluator = createEvaluator(pack);

      expect(evaluator).toBeInstanceOf(PolicyEvaluator);
    });
  });

  describe('Acuity Conditions (SAL-1018)', () => {
    test('acuity_at_least matches when acuity is at or above level', () => {
      const pack = createPolicyPack([
        createRule(
          'acuity-rule',
          100,
          { kind: 'acuity_at_least', level: 'high' },
          { decision: 'ROUTE_TO_CLINICIAN' },
        ),
      ]);
      const evaluator = createEvaluator(pack);
      const context = createContext(
        createMinimalRequest(),
        {},
        {
          acuity: {
            level: 'critical',
            composite: 0.85,
            dimensions: [],
          },
        },
      );

      const result = evaluator.evaluate(context);

      expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
    });

    test('acuity_at_least does not match when acuity is below level', () => {
      const pack = createPolicyPack([
        createRule(
          'acuity-rule',
          100,
          { kind: 'acuity_at_least', level: 'high' },
          { decision: 'HARD_STOP' },
        ),
      ]);
      const evaluator = createEvaluator(pack);
      const context = createContext(
        createMinimalRequest(),
        {},
        {
          acuity: {
            level: 'moderate',
            composite: 0.35,
            dimensions: [],
          },
        },
      );

      const result = evaluator.evaluate(context);

      expect(result.decision).toBe('ROUTE_TO_CLINICIAN'); // Default fallback
      expect(result.matched_rules).toHaveLength(0);
    });

    test('acuity_at_least does not match when acuity is missing', () => {
      const pack = createPolicyPack([
        createRule(
          'acuity-rule',
          100,
          { kind: 'acuity_at_least', level: 'low' },
          { decision: 'HARD_STOP' },
        ),
      ]);
      const evaluator = createEvaluator(pack);
      const context = createContext(createMinimalRequest(), {}, {});

      const result = evaluator.evaluate(context);

      expect(result.matched_rules).toHaveLength(0);
    });

    test('acuity_at_least matches exact level', () => {
      const pack = createPolicyPack([
        createRule(
          'acuity-rule',
          100,
          { kind: 'acuity_at_least', level: 'high' },
          { decision: 'ROUTE_TO_CLINICIAN' },
        ),
      ]);
      const evaluator = createEvaluator(pack);
      const context = createContext(
        createMinimalRequest(),
        {},
        {
          acuity: {
            level: 'high',
            composite: 0.55,
            dimensions: [],
          },
        },
      );

      const result = evaluator.evaluate(context);

      expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
    });
  });

  describe('Intervention Risk Conditions (SAL-1020)', () => {
    test('intervention_risk_at_least matches when any proposal meets threshold', () => {
      const pack = createPolicyPack([
        createRule(
          'risk-rule',
          100,
          { kind: 'intervention_risk_at_least', level: 'high' },
          { decision: 'ROUTE_TO_CLINICIAN' },
        ),
      ]);
      const evaluator = createEvaluator(pack);
      const context = createContext(
        createMinimalRequest(),
        {},
        {
          intervention_risks: [
            {
              proposal_id: 'p1',
              proposal_kind: 'PATIENT_MESSAGE',
              level: 'low',
              composite: 0.1,
              factors: [],
            },
            {
              proposal_id: 'p2',
              proposal_kind: 'MEDICATION_ORDER_PROPOSAL',
              level: 'high',
              composite: 0.6,
              factors: [],
            },
          ],
        },
      );

      const result = evaluator.evaluate(context);

      expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
    });

    test('intervention_risk_at_least does not match when all below threshold', () => {
      const pack = createPolicyPack([
        createRule(
          'risk-rule',
          100,
          { kind: 'intervention_risk_at_least', level: 'high' },
          { decision: 'HARD_STOP' },
        ),
      ]);
      const evaluator = createEvaluator(pack);
      const context = createContext(
        createMinimalRequest(),
        {},
        {
          intervention_risks: [
            {
              proposal_id: 'p1',
              proposal_kind: 'PATIENT_MESSAGE',
              level: 'low',
              composite: 0.1,
              factors: [],
            },
            {
              proposal_id: 'p2',
              proposal_kind: 'LIFESTYLE_MODIFICATION_PROPOSAL',
              level: 'moderate',
              composite: 0.3,
              factors: [],
            },
          ],
        },
      );

      const result = evaluator.evaluate(context);

      expect(result.matched_rules).toHaveLength(0);
    });

    test('intervention_risk_at_least does not match when risks are empty', () => {
      const pack = createPolicyPack([
        createRule(
          'risk-rule',
          100,
          { kind: 'intervention_risk_at_least', level: 'low' },
          { decision: 'HARD_STOP' },
        ),
      ]);
      const evaluator = createEvaluator(pack);
      const context = createContext(
        createMinimalRequest(),
        {},
        {
          intervention_risks: [],
        },
      );

      const result = evaluator.evaluate(context);

      expect(result.matched_rules).toHaveLength(0);
    });

    test('intervention_risk_at_least does not match when risks undefined', () => {
      const pack = createPolicyPack([
        createRule(
          'risk-rule',
          100,
          { kind: 'intervention_risk_at_least', level: 'low' },
          { decision: 'HARD_STOP' },
        ),
      ]);
      const evaluator = createEvaluator(pack);
      const context = createContext(createMinimalRequest(), {}, {});

      const result = evaluator.evaluate(context);

      expect(result.matched_rules).toHaveLength(0);
    });

    test('combined acuity and intervention risk rules', () => {
      const pack = createPolicyPack([
        createRule(
          'critical-acuity',
          200,
          {
            kind: 'all_of',
            conditions: [
              { kind: 'acuity_at_least', level: 'critical' },
              { kind: 'intervention_risk_at_least', level: 'high' },
            ],
          },
          { decision: 'HARD_STOP' },
        ),
        createRule(
          'high-acuity',
          100,
          { kind: 'acuity_at_least', level: 'high' },
          { decision: 'ROUTE_TO_CLINICIAN' },
        ),
      ]);
      const evaluator = createEvaluator(pack);
      const context = createContext(
        createMinimalRequest(),
        {},
        {
          acuity: {
            level: 'critical',
            composite: 0.85,
            dimensions: [],
          },
          intervention_risks: [
            {
              proposal_id: 'p1',
              proposal_kind: 'MEDICATION_ORDER_PROPOSAL',
              level: 'high',
              composite: 0.6,
              factors: [],
            },
          ],
        },
      );

      const result = evaluator.evaluate(context);

      expect(result.decision).toBe('HARD_STOP');
      expect(result.matched_rules[0].rule_id).toBe('critical-acuity');
    });
  });

  describe('Conservatism Order', () => {
    test('HARD_STOP > ROUTE_TO_CLINICIAN > REQUEST_MORE_INFO > APPROVED', () => {
      // Test that when multiple rules match with continue=true,
      // the most conservative decision wins
      const decisions: Array<{ decision: SupervisionDecision; expected: number }> = [
        { decision: 'APPROVED', expected: 1 },
        { decision: 'REQUEST_MORE_INFO', expected: 2 },
        { decision: 'ROUTE_TO_CLINICIAN', expected: 3 },
        { decision: 'HARD_STOP', expected: 4 },
      ];

      for (let i = 0; i < decisions.length; i++) {
        for (let j = i + 1; j < decisions.length; j++) {
          const pack = createPolicyPack([
            createRule(
              'rule-1',
              100,
              { kind: 'always' },
              { decision: decisions[i].decision, continue: true },
            ),
            createRule('rule-2', 90, { kind: 'always' }, { decision: decisions[j].decision }),
          ]);
          const evaluator = createEvaluator(pack);
          const result = evaluator.evaluate(createContext(createMinimalRequest()));

          // Higher expected = more conservative
          expect(result.decision).toBe(decisions[j].decision);
        }
      }
    });
  });

  // ===========================================================================
  // recent_medication_class condition
  // ===========================================================================

  describe('recent_medication_class condition', () => {
    const NOW = '2026-03-20T12:00:00Z';

    const makeRequest = (activeMedications: any[] | null | undefined) =>
      createMinimalRequest({
        trace: {
          request_id: 'test-washout',
          created_at: NOW,
          producer: { system_id: 'test', system_version: '1.0.0' },
        },
        ...(activeMedications !== undefined
          ? { snapshot_payload: { active_medications: activeMedications } }
          : {}),
      } as any);

    const recentMedClassCondition = {
      kind: 'recent_medication_class' as const,
      classes: ['C09AA'],
      within_hours: 36,
    };

    test('matches when ACEi stopped <36h ago', () => {
      // Stopped 10 hours ago
      const stoppedAt = new Date(new Date(NOW).getTime() - 10 * 60 * 60 * 1000).toISOString();
      const request = makeRequest([
        { name: 'lisinopril', atc_class: 'C09AA01', status: 'discontinued', stopped_at: stoppedAt },
      ]);
      const pack = createPolicyPack([
        createRule('washout-rule', 100, recentMedClassCondition, { decision: 'HARD_STOP' }),
      ]);
      const evaluator = createEvaluator(pack);

      const result = evaluator.evaluate(createContext(request));

      expect(result.decision).toBe('HARD_STOP');
      expect(result.matched_rules).toHaveLength(1);
    });

    test('does NOT match when ACEi stopped >36h ago', () => {
      // Stopped 48 hours ago
      const stoppedAt = new Date(new Date(NOW).getTime() - 48 * 60 * 60 * 1000).toISOString();
      const request = makeRequest([
        { name: 'lisinopril', atc_class: 'C09AA01', status: 'discontinued', stopped_at: stoppedAt },
      ]);
      const pack = createPolicyPack([
        createRule('washout-rule', 100, recentMedClassCondition, { decision: 'HARD_STOP' }),
      ]);
      const evaluator = createEvaluator(pack);

      const result = evaluator.evaluate(createContext(request));

      // Rule should not match — default fallback
      expect(result.matched_rules).toHaveLength(0);
      expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
    });

    test('matches (fail-safe) when ACEi has no stopped_at or last_dose_at', () => {
      const request = makeRequest([
        { name: 'lisinopril', atc_class: 'C09AA01', status: 'discontinued' },
      ]);
      const pack = createPolicyPack([
        createRule('washout-rule', 100, recentMedClassCondition, { decision: 'HARD_STOP' }),
      ]);
      const evaluator = createEvaluator(pack);

      const result = evaluator.evaluate(createContext(request));

      expect(result.decision).toBe('HARD_STOP');
      expect(result.matched_rules).toHaveLength(1);
    });

    test('does NOT match when no ACEi in medications at all', () => {
      const request = makeRequest([
        { name: 'metoprolol', atc_class: 'C07AB02', status: 'active' },
      ]);
      const pack = createPolicyPack([
        createRule('washout-rule', 100, recentMedClassCondition, { decision: 'HARD_STOP' }),
      ]);
      const evaluator = createEvaluator(pack);

      const result = evaluator.evaluate(createContext(request));

      expect(result.matched_rules).toHaveLength(0);
    });

    test('matches (fail-safe) when medications is null', () => {
      const request = makeRequest(null);
      const pack = createPolicyPack([
        createRule('washout-rule', 100, recentMedClassCondition, { decision: 'HARD_STOP' }),
      ]);
      const evaluator = createEvaluator(pack);

      const result = evaluator.evaluate(createContext(request));

      expect(result.decision).toBe('HARD_STOP');
    });

    test('uses last_dose_at when stopped_at is absent', () => {
      // last_dose_at 10 hours ago
      const lastDoseAt = new Date(new Date(NOW).getTime() - 10 * 60 * 60 * 1000).toISOString();
      const request = makeRequest([
        { name: 'enalapril', atc_class: 'C09AA02', status: 'on_hold', last_dose_at: lastDoseAt },
      ]);
      const pack = createPolicyPack([
        createRule('washout-rule', 100, recentMedClassCondition, { decision: 'HARD_STOP' }),
      ]);
      const evaluator = createEvaluator(pack);

      const result = evaluator.evaluate(createContext(request));

      expect(result.decision).toBe('HARD_STOP');
    });

    test('ignores active medications (only checks discontinued/on_hold)', () => {
      const request = makeRequest([
        { name: 'lisinopril', atc_class: 'C09AA01', status: 'active' },
      ]);
      const pack = createPolicyPack([
        createRule('washout-rule', 100, recentMedClassCondition, { decision: 'HARD_STOP' }),
      ]);
      const evaluator = createEvaluator(pack);

      const result = evaluator.evaluate(createContext(request));

      expect(result.matched_rules).toHaveLength(0);
    });
  });

  // ===========================================================================
  // ARNI washout full rule composition
  // ===========================================================================

  describe('ARNI washout full rule composition', () => {
    const NOW = '2026-03-20T12:00:00Z';

    const arniWashoutRule = createRule(
      'acei_to_arni_washout_check',
      770,
      {
        kind: 'all_of',
        conditions: [
          { kind: 'medication_class_in', classes: ['C09DX'] },
          { kind: 'recent_medication_class', classes: ['C09AA'], within_hours: 36 },
        ],
      },
      {
        decision: 'HARD_STOP',
        reason_codes: ['risk_too_high', 'policy_violation'],
        explanation: 'ARNI washout required',
      },
    );

    test('ARNI proposal + recent ACEi → HARD_STOP', () => {
      const stoppedAt = new Date(new Date(NOW).getTime() - 12 * 60 * 60 * 1000).toISOString();
      const request = createMinimalRequest({
        trace: {
          request_id: 'test-arni',
          created_at: NOW,
          producer: { system_id: 'test', system_version: '1.0.0' },
        },
        proposals: [
          {
            proposal_id: 'p1',
            kind: 'MEDICATION_ORDER_PROPOSAL',
            source_domain: 'cardiometabolic',
            medication: { name: 'sacubitril/valsartan', atc_class: 'C09DX04' },
          },
        ],
        snapshot_payload: {
          active_medications: [
            { name: 'lisinopril', atc_class: 'C09AA01', status: 'discontinued', stopped_at: stoppedAt },
          ],
        },
      } as any);

      const pack = createPolicyPack([arniWashoutRule]);
      const evaluator = createEvaluator(pack);
      const result = evaluator.evaluate(createContext(request));

      expect(result.decision).toBe('HARD_STOP');
      expect(result.matched_rules).toHaveLength(1);
      expect(result.matched_rules[0].rule_id).toBe('acei_to_arni_washout_check');
      expect(result.reason_codes).toContain('risk_too_high');
      expect(result.reason_codes).toContain('policy_violation');
    });

    test('ARNI proposal + no recent ACEi → rule does not fire', () => {
      // ACEi stopped 48 hours ago — outside 36h window
      const stoppedAt = new Date(new Date(NOW).getTime() - 48 * 60 * 60 * 1000).toISOString();
      const request = createMinimalRequest({
        trace: {
          request_id: 'test-arni-clear',
          created_at: NOW,
          producer: { system_id: 'test', system_version: '1.0.0' },
        },
        proposals: [
          {
            proposal_id: 'p2',
            kind: 'MEDICATION_ORDER_PROPOSAL',
            source_domain: 'cardiometabolic',
            medication: { name: 'sacubitril/valsartan', atc_class: 'C09DX04' },
          },
        ],
        snapshot_payload: {
          active_medications: [
            { name: 'lisinopril', atc_class: 'C09AA01', status: 'discontinued', stopped_at: stoppedAt },
          ],
        },
      } as any);

      const pack = createPolicyPack([arniWashoutRule]);
      const evaluator = createEvaluator(pack);
      const result = evaluator.evaluate(createContext(request));

      // Rule should NOT fire — fallback to default
      expect(result.matched_rules).toHaveLength(0);
      expect(result.decision).toBe('ROUTE_TO_CLINICIAN'); // default
    });
  });
});
