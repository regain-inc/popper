/**
 * ReconfigureEffect merging and evaluation tests
 */

import { describe, expect, test } from 'bun:test';
import type { SupervisionRequest } from '../hermes';
import type { EvaluationContext } from './evaluator';
import { createEvaluator, mergeReconfigureEffects } from './evaluator';
import type { PolicyPack, PolicyRule, ReconfigureEffect, RuleAction } from './types';

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
// Tests: mergeReconfigureEffects
// =============================================================================

describe('mergeReconfigureEffects', () => {
  test('returns single effect unchanged', () => {
    const effect: ReconfigureEffect = {
      settings: [{ key: 'max_autonomy', value: 2, reason: 'drift' }],
      priority: 'URGENT',
    };
    const merged = mergeReconfigureEffects([effect]);
    expect(merged).toBe(effect); // identity — same reference
  });

  test('highest priority wins across effects', () => {
    const merged = mergeReconfigureEffects([
      { priority: 'ROUTINE' },
      { priority: 'EMERGENCY' },
      { priority: 'URGENT' },
    ]);
    expect(merged.priority).toBe('EMERGENCY');
  });

  test('defaults to ROUTINE when priority is omitted', () => {
    const merged = mergeReconfigureEffects([{}, {}]);
    expect(merged.priority).toBe('ROUTINE');
  });

  test('accumulates settings from multiple effects', () => {
    const merged = mergeReconfigureEffects([
      { settings: [{ key: 'a', value: 1 }], priority: 'ROUTINE' },
      { settings: [{ key: 'b', value: 2 }], priority: 'ROUTINE' },
    ]);
    expect(merged.settings).toHaveLength(2);
    expect(merged.settings?.find((s) => s.key === 'a')?.value).toBe(1);
    expect(merged.settings?.find((s) => s.key === 'b')?.value).toBe(2);
  });

  test('same key → higher priority wins', () => {
    const merged = mergeReconfigureEffects([
      { settings: [{ key: 'max_autonomy', value: 3, reason: 'routine' }], priority: 'ROUTINE' },
      { settings: [{ key: 'max_autonomy', value: 1, reason: 'emergency' }], priority: 'EMERGENCY' },
    ]);
    expect(merged.settings).toHaveLength(1);
    expect(merged.settings?.[0].value).toBe(1);
    expect(merged.settings?.[0].reason).toBe('emergency');
  });

  test('same key same priority → last writer wins (stable)', () => {
    const merged = mergeReconfigureEffects([
      { settings: [{ key: 'k', value: 'first' }], priority: 'URGENT' },
      { settings: [{ key: 'k', value: 'second' }], priority: 'URGENT' },
    ]);
    expect(merged.settings).toHaveLength(1);
    // Second effect at same priority does NOT overwrite first (first holds because ">" not ">=")
    expect(merged.settings?.[0].value).toBe('first');
  });

  test('mode transition → highest priority wins', () => {
    const merged = mergeReconfigureEffects([
      {
        mode_transition: { target_mode: 'RESTRICTED', reason: 'drift' },
        priority: 'URGENT',
      },
      {
        mode_transition: { target_mode: 'SAFE_MODE', reason: 'hallucination' },
        priority: 'EMERGENCY',
      },
    ]);
    expect(merged.mode_transition?.target_mode).toBe('SAFE_MODE');
    expect(merged.mode_transition?.reason).toBe('hallucination');
  });

  test('auto_revert → shortest timer wins', () => {
    const merged = mergeReconfigureEffects([
      { auto_revert: true, revert_after_minutes: 60, priority: 'ROUTINE' },
      { auto_revert: true, revert_after_minutes: 15, priority: 'URGENT' },
      { auto_revert: true, revert_after_minutes: 30, priority: 'ROUTINE' },
    ]);
    expect(merged.auto_revert).toBe(true);
    expect(merged.revert_after_minutes).toBe(15);
  });

  test('auto_revert only from effects that set it', () => {
    const merged = mergeReconfigureEffects([
      { priority: 'ROUTINE' },
      { auto_revert: true, revert_after_minutes: 30, priority: 'URGENT' },
    ]);
    expect(merged.auto_revert).toBe(true);
    expect(merged.revert_after_minutes).toBe(30);
  });

  test('no auto_revert when none set', () => {
    const merged = mergeReconfigureEffects([{ priority: 'ROUTINE' }, { priority: 'URGENT' }]);
    expect(merged.auto_revert).toBeUndefined();
    expect(merged.revert_after_minutes).toBeUndefined();
  });

  test('no settings when none provided', () => {
    const merged = mergeReconfigureEffects([{ priority: 'ROUTINE' }, { priority: 'URGENT' }]);
    expect(merged.settings).toBeUndefined();
  });

  test('full merge with all fields', () => {
    const merged = mergeReconfigureEffects([
      {
        settings: [
          { key: 'max_autonomy', value: 3 },
          { key: 'rate_limit', value: 100 },
        ],
        mode_transition: { target_mode: 'RESTRICTED', reason: 'drift' },
        priority: 'ROUTINE',
        auto_revert: true,
        revert_after_minutes: 60,
      },
      {
        settings: [{ key: 'max_autonomy', value: 1 }],
        mode_transition: { target_mode: 'SAFE_MODE', reason: 'critical' },
        priority: 'EMERGENCY',
        auto_revert: true,
        revert_after_minutes: 10,
      },
    ]);
    expect(merged.priority).toBe('EMERGENCY');
    expect(merged.settings).toHaveLength(2);
    expect(merged.settings?.find((s) => s.key === 'max_autonomy')?.value).toBe(1); // EMERGENCY wins
    expect(merged.settings?.find((s) => s.key === 'rate_limit')?.value).toBe(100); // only in ROUTINE
    expect(merged.mode_transition?.target_mode).toBe('SAFE_MODE'); // EMERGENCY wins
    expect(merged.auto_revert).toBe(true);
    expect(merged.revert_after_minutes).toBe(10); // shortest timer
  });
});

// =============================================================================
// Tests: Evaluator integration with ReconfigureEffect
// =============================================================================

describe('PolicyEvaluator ReconfigureEffect integration', () => {
  test('single rule with reconfigure effect is included in result', () => {
    const pack = createPolicyPack([
      createRule(
        'reconfig-rule',
        100,
        { kind: 'always' },
        {
          decision: 'APPROVED',
          reconfigure: {
            settings: [{ key: 'max_autonomy', value: 2, reason: 'policy compliance' }],
            priority: 'URGENT',
          },
        },
      ),
    ]);
    const evaluator = createEvaluator(pack);
    const result = evaluator.evaluate(createContext(createMinimalRequest()));

    expect(result.reconfigure_effect).toBeDefined();
    expect(result.reconfigure_effect?.priority).toBe('URGENT');
    expect(result.reconfigure_effect?.settings).toHaveLength(1);
    expect(result.reconfigure_effect?.settings?.[0].key).toBe('max_autonomy');
  });

  test('no reconfigure_effect when no rules have reconfigure', () => {
    const pack = createPolicyPack([
      createRule('basic-rule', 100, { kind: 'always' }, { decision: 'APPROVED' }),
    ]);
    const evaluator = createEvaluator(pack);
    const result = evaluator.evaluate(createContext(createMinimalRequest()));

    expect(result.reconfigure_effect).toBeUndefined();
  });

  test('reconfigure effects are merged across continue rules', () => {
    const pack = createPolicyPack([
      createRule(
        'rule-1',
        100,
        { kind: 'always' },
        {
          decision: 'APPROVED',
          continue: true,
          reconfigure: {
            settings: [{ key: 'rate_limit', value: 50 }],
            priority: 'ROUTINE',
            auto_revert: true,
            revert_after_minutes: 60,
          },
        },
      ),
      createRule(
        'rule-2',
        90,
        { kind: 'always' },
        {
          decision: 'ROUTE_TO_CLINICIAN',
          reconfigure: {
            settings: [
              { key: 'rate_limit', value: 10 },
              { key: 'mode_flag', value: 'restricted' },
            ],
            priority: 'EMERGENCY',
            auto_revert: true,
            revert_after_minutes: 15,
          },
        },
      ),
    ]);
    const evaluator = createEvaluator(pack);
    const result = evaluator.evaluate(createContext(createMinimalRequest()));

    expect(result.reconfigure_effect).toBeDefined();
    expect(result.reconfigure_effect?.priority).toBe('EMERGENCY');
    // rate_limit: EMERGENCY wins
    expect(result.reconfigure_effect?.settings?.find((s) => s.key === 'rate_limit')?.value).toBe(
      10,
    );
    // mode_flag: only in rule-2
    expect(result.reconfigure_effect?.settings?.find((s) => s.key === 'mode_flag')?.value).toBe(
      'restricted',
    );
    // shortest timer wins
    expect(result.reconfigure_effect?.revert_after_minutes).toBe(15);
  });

  test('reconfigure from non-matching rules is excluded', () => {
    const pack = createPolicyPack([
      createRule(
        'matching',
        100,
        { kind: 'always' },
        {
          decision: 'APPROVED',
          reconfigure: {
            settings: [{ key: 'a', value: 1 }],
            priority: 'ROUTINE',
          },
        },
      ),
      // This rule won't match because the first rule stops (no continue)
      createRule(
        'non-matching',
        90,
        { kind: 'always' },
        {
          decision: 'HARD_STOP',
          reconfigure: {
            settings: [{ key: 'b', value: 2 }],
            priority: 'EMERGENCY',
          },
        },
      ),
    ]);
    const evaluator = createEvaluator(pack);
    const result = evaluator.evaluate(createContext(createMinimalRequest()));

    expect(result.reconfigure_effect).toBeDefined();
    expect(result.reconfigure_effect?.settings).toHaveLength(1);
    expect(result.reconfigure_effect?.settings?.[0].key).toBe('a');
    expect(result.reconfigure_effect?.priority).toBe('ROUTINE');
  });

  test('reconfigure coexists with control_commands (backwards compat)', () => {
    const pack = createPolicyPack([
      createRule(
        'dual-rule',
        100,
        { kind: 'always' },
        {
          decision: 'HARD_STOP',
          control_commands: [
            { kind: 'SET_SAFE_MODE', safe_mode: { enabled: true, reason: 'v1 command' } },
          ],
          reconfigure: {
            mode_transition: { target_mode: 'SAFE_MODE', reason: 'v2 effect' },
            priority: 'EMERGENCY',
          },
        },
      ),
    ]);
    const evaluator = createEvaluator(pack);
    const result = evaluator.evaluate(createContext(createMinimalRequest()));

    // Both v1 control_commands and v2 reconfigure_effect present
    expect(result.control_commands).toHaveLength(1);
    expect(result.control_commands?.[0].kind).toBe('SET_SAFE_MODE');
    expect(result.reconfigure_effect).toBeDefined();
    expect(result.reconfigure_effect?.mode_transition?.target_mode).toBe('SAFE_MODE');
  });

  test('reconfigure with mode_transition from single rule', () => {
    const pack = createPolicyPack([
      createRule(
        'mode-rule',
        100,
        { kind: 'always' },
        {
          decision: 'ROUTE_TO_CLINICIAN',
          reconfigure: {
            mode_transition: { target_mode: 'MAINTENANCE', reason: 'scheduled maintenance' },
            priority: 'ROUTINE',
          },
        },
      ),
    ]);
    const evaluator = createEvaluator(pack);
    const result = evaluator.evaluate(createContext(createMinimalRequest()));

    expect(result.reconfigure_effect?.mode_transition?.target_mode).toBe('MAINTENANCE');
    expect(result.reconfigure_effect?.mode_transition?.reason).toBe('scheduled maintenance');
  });

  test('no rules match → no reconfigure_effect', () => {
    const pack = createPolicyPack([
      createRule(
        'never-match',
        100,
        { kind: 'safe_mode_enabled' },
        {
          decision: 'HARD_STOP',
          reconfigure: {
            settings: [{ key: 'a', value: 1 }],
            priority: 'EMERGENCY',
          },
        },
      ),
    ]);
    const evaluator = createEvaluator(pack);
    const result = evaluator.evaluate(createContext(createMinimalRequest()));

    expect(result.reconfigure_effect).toBeUndefined();
    expect(result.decision).toBe('ROUTE_TO_CLINICIAN'); // default fallback
  });
});
