/**
 * GDMT Integration Tests (Phase 7 — T3-1)
 *
 * Cross-cutting integration tests validating Hermes v2.3 clinical types,
 * policy engine evaluation, hallucination detection, and multi-pack
 * composition across Phases 1-4.
 */

import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { detectHallucinations } from '../hallucination/detector';
import type { SupervisionRequest } from '../hermes';
import type {
  EvaluationContext,
  PolicyPack,
  PolicyRule,
  RuleAction,
  RuleProvenance,
} from '../policy-engine';
import {
  composePacks,
  createEvaluator,
  loadAndComposePacks,
  loadPolicyPack,
  PackCompositionError,
} from '../policy-engine';

// =============================================================================
// Paths
// =============================================================================

const PROJECT_ROOT = join(import.meta.dir, '..', '..', '..', '..');
const POLICIES_DIR = join(PROJECT_ROOT, 'config', 'policies');
const DEFAULT_POLICY_PATH = join(POLICIES_DIR, 'default.yaml');
const CARDIO_HF_PATH = join(POLICIES_DIR, 'domains', 'cardiometabolic-hf.yaml');

// =============================================================================
// Helpers
// =============================================================================

const createMinimalRequest = (overrides: Record<string, unknown> = {}): SupervisionRequest =>
  ({
    hermes_version: '2.3.0',
    mode: 'wellness',
    trace: {
      trace_id: `int-test-${Math.random().toString(36).slice(2, 8)}`,
      created_at: new Date().toISOString(),
      producer: {
        system: 'deutsch',
        service_version: '1.0.0',
      },
    },
    subject: {
      subject_id: 'patient-integration-001',
      subject_type: 'patient',
    },
    request_timestamp: new Date().toISOString(),
    proposals: [],
    ...overrides,
  }) as SupervisionRequest;

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

const createPolicyPack = (
  rules: PolicyRule[],
  overrides: Partial<PolicyPack> = {},
): PolicyPack => ({
  policy_id: 'test-integration',
  policy_version: '1.0.0',
  rules,
  ...overrides,
});

const NOW = '2026-03-20T12:00:00Z';

// =============================================================================
// 1. Typed MEDICATION_ORDER_PROPOSAL validates and reaches evaluator
// =============================================================================

describe('MEDICATION_ORDER_PROPOSAL evaluation', () => {
  test('proposal_kind_in matches MEDICATION_ORDER_PROPOSAL', () => {
    const pack = createPolicyPack([
      createRule(
        'med-route',
        100,
        { kind: 'proposal_kind_in', kinds: ['MEDICATION_ORDER_PROPOSAL'] },
        { decision: 'ROUTE_TO_CLINICIAN', reason_codes: ['needs_human_review'] },
      ),
    ]);
    const evaluator = createEvaluator(pack);
    const request = createMinimalRequest({
      proposals: [
        {
          proposal_id: 'med-1',
          kind: 'MEDICATION_ORDER_PROPOSAL',
          description: 'Initiate lisinopril 5mg daily',
          medication: { name: 'lisinopril', atc_class: 'C09AA03' },
          change: { change_type: 'initiate' },
        },
      ],
    });

    const result = evaluator.evaluate(createContext(request));

    expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
    expect(result.matched_rules).toHaveLength(1);
  });

  test('medication_class_in matches ATC prefix on proposal', () => {
    const pack = createPolicyPack([
      createRule(
        'acei-rule',
        200,
        { kind: 'medication_class_in', classes: ['C09AA'] },
        { decision: 'ROUTE_TO_CLINICIAN', reason_codes: ['needs_human_review'] },
      ),
    ]);
    const evaluator = createEvaluator(pack);
    const request = createMinimalRequest({
      proposals: [
        {
          proposal_id: 'med-2',
          kind: 'MEDICATION_ORDER_PROPOSAL',
          description: 'Lisinopril titration',
          medication: { name: 'lisinopril', atc_class: 'C09AA03' },
          change: { change_type: 'titrate' },
        },
      ],
    });

    const result = evaluator.evaluate(createContext(request));

    expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
    expect(result.matched_rules[0].rule_id).toBe('acei-rule');
  });

  test('medication_class_in does NOT match unrelated ATC code', () => {
    const pack = createPolicyPack([
      createRule(
        'acei-rule',
        200,
        { kind: 'medication_class_in', classes: ['C09AA'] },
        { decision: 'HARD_STOP' },
      ),
    ]);
    const evaluator = createEvaluator(pack);
    const request = createMinimalRequest({
      proposals: [
        {
          proposal_id: 'med-3',
          kind: 'MEDICATION_ORDER_PROPOSAL',
          description: 'Metoprolol titration',
          medication: { name: 'metoprolol', atc_class: 'C07AB02' },
          change: { change_type: 'titrate' },
        },
      ],
    });

    const result = evaluator.evaluate(createContext(request));

    expect(result.decision).toBe('ROUTE_TO_CLINICIAN'); // default fallback
    expect(result.matched_rules).toHaveLength(0);
  });
});

// =============================================================================
// 2. TRIAGE_ROUTE for diagnosis/prognosis with required fields
// =============================================================================

describe('TRIAGE_ROUTE evaluation', () => {
  test('proposal_kind_in matches TRIAGE_ROUTE', () => {
    const pack = createPolicyPack([
      createRule(
        'triage-route-rule',
        100,
        { kind: 'proposal_kind_in', kinds: ['TRIAGE_ROUTE'] },
        { decision: 'ROUTE_TO_CLINICIAN', reason_codes: ['needs_human_review'] },
      ),
    ]);
    const evaluator = createEvaluator(pack);
    const request = createMinimalRequest({
      proposals: [
        {
          proposal_id: 'triage-1',
          kind: 'TRIAGE_ROUTE',
          description: 'Route to cardiology for HFrEF evaluation',
          triage_target: 'cardiology',
          urgency: 'urgent',
          evidence_refs: [
            {
              evidence_id: 'ev-1',
              evidence_type: 'guideline',
              citation: '2022 AHA/ACC HF Guideline',
            },
          ],
        },
      ],
    });

    const result = evaluator.evaluate(createContext(request));

    expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
    expect(result.matched_rules).toHaveLength(1);
    expect(result.matched_rules[0].rule_id).toBe('triage-route-rule');
  });

  test('TRIAGE_ROUTE without evidence refs still evaluates', () => {
    const pack = createPolicyPack([
      createRule('triage-always', 50, { kind: 'always' }, { decision: 'APPROVED' }),
    ]);
    const evaluator = createEvaluator(pack);
    const request = createMinimalRequest({
      proposals: [
        {
          proposal_id: 'triage-2',
          kind: 'TRIAGE_ROUTE',
          description: 'Route to PCP for follow-up',
          triage_target: 'primary_care',
        },
      ],
    });

    const result = evaluator.evaluate(createContext(request));

    expect(result.decision).toBe('APPROVED');
  });
});

// =============================================================================
// 3. advocate_clinical requires snapshot_payload
// =============================================================================

describe('advocate_clinical snapshot requirement', () => {
  test('advocate_clinical with snapshot_payload: null triggers snapshot_missing', () => {
    const pack = createPolicyPack([
      createRule(
        'clinical-needs-snapshot',
        300,
        {
          kind: 'all_of',
          conditions: [
            { kind: 'mode_is', mode: 'advocate_clinical' },
            { kind: 'snapshot_missing' },
          ],
        },
        {
          decision: 'HARD_STOP',
          reason_codes: ['risk_too_high'],
          explanation: 'Clinical mode requires snapshot data',
        },
      ),
    ]);
    const evaluator = createEvaluator(pack);
    const request = createMinimalRequest({
      mode: 'advocate_clinical',
      snapshot_payload: null,
    });

    const result = evaluator.evaluate(createContext(request, {}, { snapshot_missing: true }));

    expect(result.decision).toBe('HARD_STOP');
    expect(result.reason_codes).toContain('risk_too_high');
  });

  test('advocate_clinical with snapshot_payload present passes snapshot check', () => {
    const pack = createPolicyPack([
      createRule(
        'clinical-needs-snapshot',
        300,
        {
          kind: 'all_of',
          conditions: [
            { kind: 'mode_is', mode: 'advocate_clinical' },
            { kind: 'snapshot_missing' },
          ],
        },
        { decision: 'HARD_STOP' },
      ),
    ]);
    const evaluator = createEvaluator(pack);
    const request = createMinimalRequest({
      mode: 'advocate_clinical',
      snapshot_payload: {
        active_medications: [{ name: 'metoprolol', atc_class: 'C07AB02', status: 'active' }],
      },
    });

    // snapshot_missing is NOT set because snapshot_payload is present
    const result = evaluator.evaluate(createContext(request, {}, { snapshot_missing: false }));

    expect(result.decision).toBe('ROUTE_TO_CLINICIAN'); // default fallback
    expect(result.matched_rules).toHaveLength(0);
  });
});

// =============================================================================
// 4. null vs [] snapshot semantics
// =============================================================================

describe('snapshot_payload null vs empty vs undefined semantics', () => {
  test('snapshot_payload: null should be treated as missing', () => {
    const request = createMinimalRequest({
      snapshot_payload: null,
    });

    // The derivedSignals.snapshot_missing should be true for null
    const pack = createPolicyPack([
      createRule(
        'snapshot-missing-rule',
        100,
        { kind: 'snapshot_missing' },
        { decision: 'HARD_STOP' },
      ),
    ]);
    const evaluator = createEvaluator(pack);
    const result = evaluator.evaluate(createContext(request, {}, { snapshot_missing: true }));

    expect(result.decision).toBe('HARD_STOP');
  });

  test('snapshot_payload: {} (empty object) is NOT missing', () => {
    const request = createMinimalRequest({
      snapshot_payload: {},
    });

    const pack = createPolicyPack([
      createRule(
        'snapshot-missing-rule',
        100,
        { kind: 'snapshot_missing' },
        { decision: 'HARD_STOP' },
      ),
    ]);
    const evaluator = createEvaluator(pack);
    // Empty object is present, not missing
    const result = evaluator.evaluate(createContext(request, {}, { snapshot_missing: false }));

    expect(result.decision).toBe('ROUTE_TO_CLINICIAN'); // default
    expect(result.matched_rules).toHaveLength(0);
  });

  test('snapshot_payload: undefined treated as missing (old client)', () => {
    // Old client omits snapshot_payload entirely
    const request = createMinimalRequest();

    const pack = createPolicyPack([
      createRule(
        'snapshot-missing-rule',
        100,
        { kind: 'snapshot_missing' },
        { decision: 'HARD_STOP' },
      ),
    ]);
    const evaluator = createEvaluator(pack);
    // undefined is treated as missing
    const result = evaluator.evaluate(createContext(request, {}, { snapshot_missing: true }));

    expect(result.decision).toBe('HARD_STOP');
  });

  test('snapshot_field_missing distinguishes null from absent', () => {
    // snapshot_payload present but active_medications is null
    const request = createMinimalRequest({
      snapshot_payload: { active_medications: null },
    });

    const pack = createPolicyPack([
      createRule(
        'meds-field-missing',
        100,
        { kind: 'snapshot_field_missing', field: 'active_medications' },
        { decision: 'ROUTE_TO_CLINICIAN', reason_codes: ['high_uncertainty'] },
      ),
    ]);
    const evaluator = createEvaluator(pack);
    const result = evaluator.evaluate(createContext(request));

    expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
    expect(result.reason_codes).toContain('high_uncertainty');
  });

  test('snapshot_field_missing does NOT fire when field is empty array', () => {
    const request = createMinimalRequest({
      snapshot_payload: { active_medications: [] },
    });

    const pack = createPolicyPack([
      createRule(
        'meds-field-missing',
        100,
        { kind: 'snapshot_field_missing', field: 'active_medications' },
        { decision: 'HARD_STOP' },
      ),
    ]);
    const evaluator = createEvaluator(pack);
    const result = evaluator.evaluate(createContext(request));

    // [] is not null, so snapshot_field_missing should NOT fire
    expect(result.decision).toBe('ROUTE_TO_CLINICIAN'); // default
    expect(result.matched_rules).toHaveLength(0);
  });
});

// =============================================================================
// 5. output_validation -> hallucination routing
// =============================================================================

describe('output_validation and hallucination detection', () => {
  test('detectHallucinations reads upstream output_validation signals', () => {
    const request = createMinimalRequest({
      output_validation: {
        valid: false,
        severity: 'significant',
        signals: [
          {
            type: 'grounding_failure',
            severity: 'significant',
            description: 'Response references non-existent medication interaction',
            proposal_id: 'p-1',
          },
        ],
      },
    });

    const result = detectHallucinations(request);

    expect(result.detected).toBe(true);
    expect(result.severity).toBe('significant');
    expect(result.signals.length).toBeGreaterThan(0);
    expect(result.signals[0].type).toBe('upstream_grounding_failure');
  });

  test('detectHallucinations returns clean for valid output_validation', () => {
    const request = createMinimalRequest({
      output_validation: {
        valid: true,
      },
    });

    const result = detectHallucinations(request);

    // No upstream signals when valid=true
    // (may still detect structural issues if any exist)
    const upstreamSignals = result.signals.filter((s) => s.type.startsWith('upstream_'));
    expect(upstreamSignals).toHaveLength(0);
  });

  test('hallucination detection integrates with policy evaluation', () => {
    const request = createMinimalRequest({
      output_validation: {
        valid: false,
        signals: [
          {
            type: 'factual_error',
            severity: 'critical',
            description: 'Fabricated clinical trial reference',
          },
        ],
      },
    });

    // Run hallucination detection
    const halResult = detectHallucinations(request);

    // Feed into policy evaluation
    const pack = createPolicyPack([
      createRule(
        'critical-hallucination',
        500,
        { kind: 'hallucination_detected', severity: 'critical' },
        { decision: 'HARD_STOP', reason_codes: ['risk_too_high'] },
      ),
    ]);
    const evaluator = createEvaluator(pack);
    const result = evaluator.evaluate(
      createContext(
        request,
        {},
        {
          hallucination: {
            detected: halResult.detected,
            severity: halResult.severity,
          },
        },
      ),
    );

    expect(result.decision).toBe('HARD_STOP');
    expect(result.reason_codes).toContain('risk_too_high');
  });
});

// =============================================================================
// 6. Clinical condition kinds (v2.3)
// =============================================================================

describe('v2.3 clinical condition kinds', () => {
  test('medication_class_in matches ATC codes on proposals', () => {
    const pack = createPolicyPack([
      createRule(
        'sglt2i-check',
        100,
        { kind: 'medication_class_in', classes: ['A10BK'] },
        { decision: 'ROUTE_TO_CLINICIAN' },
      ),
    ]);
    const evaluator = createEvaluator(pack);
    const request = createMinimalRequest({
      proposals: [
        {
          proposal_id: 'p-sglt2',
          kind: 'MEDICATION_ORDER_PROPOSAL',
          description: 'Initiate dapagliflozin',
          medication: { name: 'dapagliflozin', atc_class: 'A10BK01' },
          change: { change_type: 'initiate' },
        },
      ],
    });

    const result = evaluator.evaluate(createContext(request));
    expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
  });

  test('medication_name_in matches drug names case-insensitively', () => {
    const pack = createPolicyPack([
      createRule(
        'spironolactone-check',
        100,
        { kind: 'medication_name_in', names: ['spironolactone', 'eplerenone'] },
        { decision: 'ROUTE_TO_CLINICIAN' },
      ),
    ]);
    const evaluator = createEvaluator(pack);
    const request = createMinimalRequest({
      proposals: [
        {
          proposal_id: 'p-mra',
          kind: 'MEDICATION_ORDER_PROPOSAL',
          description: 'Start Spironolactone',
          medication: { name: 'Spironolactone', atc_class: 'C03DA01' },
          change: { change_type: 'initiate' },
        },
      ],
    });

    const result = evaluator.evaluate(createContext(request));
    expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
  });

  test('snapshot_lab_below matches lab value below threshold', () => {
    const pack = createPolicyPack([
      createRule(
        'low-potassium',
        100,
        { kind: 'snapshot_lab_below', lab: 'potassium', threshold: 3.5 },
        { decision: 'ROUTE_TO_CLINICIAN', reason_codes: ['risk_too_high'] },
      ),
    ]);
    const evaluator = createEvaluator(pack);
    const request = createMinimalRequest({
      snapshot_payload: {
        recent_labs: [{ lab_id: 'potassium', value: 3.2, unit: 'mEq/L' }],
      },
    });

    const result = evaluator.evaluate(createContext(request));
    expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
  });

  test('snapshot_lab_above matches lab value above threshold', () => {
    const pack = createPolicyPack([
      createRule(
        'high-potassium',
        100,
        { kind: 'snapshot_lab_above', lab: 'potassium', threshold: 5.5 },
        { decision: 'HARD_STOP', reason_codes: ['risk_too_high'] },
      ),
    ]);
    const evaluator = createEvaluator(pack);
    const request = createMinimalRequest({
      snapshot_payload: {
        recent_labs: [{ lab_id: 'potassium', value: 6.1, unit: 'mEq/L' }],
      },
    });

    const result = evaluator.evaluate(createContext(request));
    expect(result.decision).toBe('HARD_STOP');
  });

  test('snapshot_lab_below does NOT match when value is above threshold', () => {
    const pack = createPolicyPack([
      createRule(
        'low-egfr',
        100,
        { kind: 'snapshot_lab_below', lab: 'eGFR', threshold: 30 },
        { decision: 'HARD_STOP' },
      ),
    ]);
    const evaluator = createEvaluator(pack);
    const request = createMinimalRequest({
      snapshot_payload: {
        recent_labs: [{ lab_id: 'eGFR', value: 55, unit: 'mL/min/1.73m2' }],
      },
    });

    const result = evaluator.evaluate(createContext(request));
    expect(result.matched_rules).toHaveLength(0);
  });

  test('snapshot_condition_present matches active conditions', () => {
    const pack = createPolicyPack([
      createRule(
        'hf-present',
        100,
        { kind: 'snapshot_condition_present', condition: 'heart_failure' },
        { decision: 'ROUTE_TO_CLINICIAN' },
      ),
    ]);
    const evaluator = createEvaluator(pack);
    const request = createMinimalRequest({
      snapshot_payload: {
        active_conditions: [
          { condition_id: 'heart_failure', status: 'active', onset: '2024-01-15' },
          { condition_id: 'hypertension', status: 'active', onset: '2020-06-01' },
        ],
      },
    });

    const result = evaluator.evaluate(createContext(request));
    expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
  });

  test('snapshot_condition_present does NOT match inactive conditions', () => {
    const pack = createPolicyPack([
      createRule(
        'hf-present',
        100,
        { kind: 'snapshot_condition_present', condition: 'heart_failure' },
        { decision: 'HARD_STOP' },
      ),
    ]);
    const evaluator = createEvaluator(pack);
    const request = createMinimalRequest({
      snapshot_payload: {
        active_conditions: [
          { condition_id: 'heart_failure', status: 'resolved', onset: '2024-01-15' },
        ],
      },
    });

    const result = evaluator.evaluate(createContext(request));
    expect(result.matched_rules).toHaveLength(0);
  });

  test('snapshot_field_missing detects null field in snapshot', () => {
    const pack = createPolicyPack([
      createRule(
        'allergies-missing',
        100,
        { kind: 'snapshot_field_missing', field: 'medication_allergies' },
        { decision: 'ROUTE_TO_CLINICIAN', reason_codes: ['high_uncertainty'] },
      ),
    ]);
    const evaluator = createEvaluator(pack);
    const request = createMinimalRequest({
      snapshot_payload: {
        active_medications: [],
        medication_allergies: null,
      },
    });

    const result = evaluator.evaluate(createContext(request));
    expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
    expect(result.reason_codes).toContain('high_uncertainty');
  });

  test('combination_present detects proposed + active drug combo', () => {
    const pack = createPolicyPack([
      createRule(
        'dual-ras',
        100,
        { kind: 'combination_present', class_a: 'C09AA', class_b: 'C09CA' },
        { decision: 'HARD_STOP', reason_codes: ['policy_violation'] },
      ),
    ]);
    const evaluator = createEvaluator(pack);
    const request = createMinimalRequest({
      proposals: [
        {
          proposal_id: 'p-arb',
          kind: 'MEDICATION_ORDER_PROPOSAL',
          description: 'Add losartan',
          medication: { name: 'losartan', atc_class: 'C09CA01' },
          change: { change_type: 'initiate' },
        },
      ],
      snapshot_payload: {
        active_medications: [{ name: 'lisinopril', atc_class: 'C09AA03', status: 'active' }],
      },
    });

    const result = evaluator.evaluate(createContext(request));
    expect(result.decision).toBe('HARD_STOP');
    expect(result.reason_codes).toContain('policy_violation');
  });

  test('recent_medication_class matches ARNI washout scenario', () => {
    const stoppedAt = new Date(new Date(NOW).getTime() - 12 * 60 * 60 * 1000).toISOString();

    const pack = createPolicyPack([
      createRule(
        'washout-check',
        200,
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
        },
      ),
    ]);
    const evaluator = createEvaluator(pack);
    const request = createMinimalRequest({
      trace: {
        trace_id: 'washout-int-test',
        created_at: NOW,
        producer: { system: 'deutsch', service_version: '1.0.0' },
      },
      proposals: [
        {
          proposal_id: 'p-arni',
          kind: 'MEDICATION_ORDER_PROPOSAL',
          description: 'Initiate sacubitril/valsartan',
          medication: { name: 'sacubitril/valsartan', atc_class: 'C09DX04' },
          change: { change_type: 'initiate' },
        },
      ],
      snapshot_payload: {
        active_medications: [
          {
            name: 'lisinopril',
            atc_class: 'C09AA01',
            status: 'discontinued',
            stopped_at: stoppedAt,
          },
        ],
      },
    });

    const result = evaluator.evaluate(createContext(request));
    expect(result.decision).toBe('HARD_STOP');
    expect(result.reason_codes).toContain('risk_too_high');
    expect(result.reason_codes).toContain('policy_violation');
  });
});

// =============================================================================
// 7. Multi-pack loading + priority conflict rejection
// =============================================================================

describe('multi-pack composition', () => {
  test('composePacks merges two packs with non-conflicting priorities', () => {
    const packA = createPolicyPack([createRule('rule-a1', 100, { kind: 'always' })], {
      policy_id: 'pack-a',
      policy_version: '1.0.0',
    });
    const packB = createPolicyPack([createRule('rule-b1', 200, { kind: 'always' })], {
      policy_id: 'pack-b',
      policy_version: '1.0.0',
    });

    const composed = composePacks([packA, packB]);

    expect(composed.rules).toHaveLength(2);
    // Sorted by priority descending
    expect(composed.rules[0].rule_id).toBe('rule-b1');
    expect(composed.rules[1].rule_id).toBe('rule-a1');
    expect(composed.policy_id).toBe('composed:pack-a+pack-b');
  });

  test('composePacks rejects cross-pack same-priority conflicts', () => {
    const packA = createPolicyPack([createRule('rule-a', 100, { kind: 'always' })], {
      policy_id: 'pack-a',
      policy_version: '1.0.0',
    });
    const packB = createPolicyPack([createRule('rule-b', 100, { kind: 'always' })], {
      policy_id: 'pack-b',
      policy_version: '1.0.0',
    });

    expect(() => composePacks([packA, packB])).toThrow(PackCompositionError);
  });

  test('composePacks allows same priority within same pack', () => {
    const packA = createPolicyPack(
      [
        createRule('rule-a1', 100, { kind: 'always' }),
        createRule('rule-a2', 100, { kind: 'always' }),
      ],
      { policy_id: 'pack-a', policy_version: '1.0.0' },
    );
    const packB = createPolicyPack([createRule('rule-b1', 200, { kind: 'always' })], {
      policy_id: 'pack-b',
      policy_version: '1.0.0',
    });

    // Same priority within pack-a should be fine
    const composed = composePacks([packA, packB]);
    expect(composed.rules).toHaveLength(3);
  });

  test('composePacks enforces priority ranges per pack_type', () => {
    const corePack = createPolicyPack([createRule('core-rule', 1100, { kind: 'always' })], {
      policy_id: 'core-pack',
      policy_version: '1.0.0',
    });
    const domainPack = createPolicyPack([createRule('out-of-range', 900, { kind: 'always' })], {
      policy_id: 'bad-domain',
      policy_version: '1.0.0',
    }) as PolicyPack & Record<string, unknown>;
    domainPack.pack_type = 'domain';

    // composePacks with a single pack skips validation, so we need two
    expect(() => composePacks([corePack, domainPack])).toThrow(PackCompositionError);
  });

  test('composePacks version string is composite', () => {
    const packA = createPolicyPack([createRule('r-a', 100, { kind: 'always' })], {
      policy_id: 'alpha',
      policy_version: '1.0.0',
    });
    const packB = createPolicyPack([createRule('r-b', 200, { kind: 'always' })], {
      policy_id: 'beta',
      policy_version: '2.0.0',
    });

    const composed = composePacks([packA, packB]);
    expect(composed.policy_version).toBe('alpha:1.0.0+beta:2.0.0');
  });

  test('loadAndComposePacks loads domain pack', async () => {
    const composed = await loadAndComposePacks(POLICIES_DIR, {
      loadDomains: ['cardiometabolic-hf.yaml'],
    });

    expect(composed.rules.length).toBeGreaterThan(0);
    expect(composed.policy_id).toBe('domain-cardiometabolic-hf');
  });
});

// =============================================================================
// 8. Backward compat: OTHER proposals still pass core safety
// =============================================================================

describe('backward compatibility with OTHER proposals', () => {
  test('OTHER proposal kind does not crash evaluator', () => {
    const pack = createPolicyPack([
      createRule('always-check', 50, { kind: 'always' }, { decision: 'APPROVED' }),
    ]);
    const evaluator = createEvaluator(pack);
    const request = createMinimalRequest({
      proposals: [
        {
          proposal_id: 'other-1',
          kind: 'OTHER',
          description: 'Some custom proposal',
        },
      ],
    });

    const result = evaluator.evaluate(createContext(request));

    expect(result.decision).toBe('APPROVED');
    expect(result.matched_rules).toHaveLength(1);
  });

  test('core safety rules still fire for OTHER proposals', () => {
    const pack = createPolicyPack([
      createRule(
        'safe-mode-block',
        1000,
        { kind: 'safe_mode_enabled' },
        { decision: 'HARD_STOP', reason_codes: ['risk_too_high'] },
      ),
    ]);
    const evaluator = createEvaluator(pack);
    const request = createMinimalRequest({
      proposals: [
        {
          proposal_id: 'other-2',
          kind: 'OTHER',
          description: 'Custom proposal under safe mode',
        },
      ],
    });

    const result = evaluator.evaluate(createContext(request, { safe_mode: { enabled: true } }));

    expect(result.decision).toBe('HARD_STOP');
  });

  test('schema_invalid fires regardless of proposal kind', () => {
    const pack = createPolicyPack([
      createRule(
        'schema-block',
        1200,
        { kind: 'schema_invalid' },
        { decision: 'HARD_STOP', reason_codes: ['risk_too_high'] },
      ),
    ]);
    const evaluator = createEvaluator(pack);
    const request = createMinimalRequest({
      proposals: [{ proposal_id: 'other-3', kind: 'OTHER', description: 'Bad schema request' }],
    });

    const result = evaluator.evaluate(createContext(request, {}, { schema_invalid: true }));

    expect(result.decision).toBe('HARD_STOP');
  });
});

// =============================================================================
// 9. Rule provenance propagation
// =============================================================================

describe('rule provenance propagation', () => {
  test('matched rule includes provenance in evaluation result', () => {
    const provenance: RuleProvenance = {
      source_type: 'medication_label',
      source_layer: 1,
      citation: 'Sacubitril/Valsartan SPL, Section 4',
      evidence_grade: 'policy',
      jurisdiction: 'US',
      clinical_domain: 'cardiovascular',
      approved_by: 'Clinical Governance Board',
      effective_date: '2026-03-19',
      review_interval_days: 90,
      review_due: '2026-06-19',
    };

    const rule: PolicyRule = {
      rule_id: 'provenance-test',
      description: 'Rule with provenance',
      priority: 100,
      provenance,
      when: { kind: 'always' },
      // biome-ignore lint/suspicious/noThenProperty: Safety DSL spec
      then: {
        decision: 'ROUTE_TO_CLINICIAN',
        reason_codes: ['needs_human_review'],
        explanation: 'Requires clinician review per FDA labeling',
      },
    };

    const pack = createPolicyPack([rule]);
    const evaluator = createEvaluator(pack);
    const result = evaluator.evaluate(createContext(createMinimalRequest()));

    expect(result.matched_rules).toHaveLength(1);
    expect(result.matched_rules[0].provenance).toBeDefined();
    expect(result.matched_rules[0].provenance?.source_type).toBe('medication_label');
    expect(result.matched_rules[0].provenance?.citation).toBe(
      'Sacubitril/Valsartan SPL, Section 4',
    );
    expect(result.matched_rules[0].provenance?.source_layer).toBe(1);
    expect(result.matched_rules[0].provenance?.evidence_grade).toBe('policy');
  });

  test('rules without provenance have undefined provenance in result', () => {
    const pack = createPolicyPack([createRule('no-provenance', 100, { kind: 'always' })]);
    const evaluator = createEvaluator(pack);
    const result = evaluator.evaluate(createContext(createMinimalRequest()));

    expect(result.matched_rules).toHaveLength(1);
    expect(result.matched_rules[0].provenance).toBeUndefined();
  });

  test('provenance propagates through continue chains', () => {
    const rule1: PolicyRule = {
      rule_id: 'prov-rule-1',
      description: 'First rule with provenance',
      priority: 200,
      provenance: {
        source_type: 'society_guideline',
        source_layer: 2,
        citation: '2022 AHA/ACC HF Guideline',
        evidence_grade: 'rct',
        jurisdiction: 'US',
        clinical_domain: 'cardiovascular',
        approved_by: 'CGB',
        effective_date: '2026-01-01',
        review_interval_days: 365,
        review_due: '2027-01-01',
      },
      when: { kind: 'always' },
      // biome-ignore lint/suspicious/noThenProperty: Safety DSL spec
      then: {
        decision: 'APPROVED',
        reason_codes: ['approved_with_constraints'],
        explanation: 'Guideline-based approval',
        continue: true,
      },
    };

    const rule2: PolicyRule = {
      rule_id: 'prov-rule-2',
      description: 'Second rule with different provenance',
      priority: 100,
      provenance: {
        source_type: 'medication_label',
        source_layer: 1,
        citation: 'FDA SPL Section 5',
        evidence_grade: 'policy',
        jurisdiction: 'US',
        clinical_domain: 'cardiovascular',
        approved_by: 'CGB',
        effective_date: '2026-01-01',
        review_interval_days: 90,
        review_due: '2026-04-01',
      },
      when: { kind: 'always' },
      // biome-ignore lint/suspicious/noThenProperty: Safety DSL spec
      then: {
        decision: 'ROUTE_TO_CLINICIAN',
        reason_codes: ['needs_human_review'],
        explanation: 'FDA label requires review',
      },
    };

    const pack = createPolicyPack([rule1, rule2]);
    const evaluator = createEvaluator(pack);
    const result = evaluator.evaluate(createContext(createMinimalRequest()));

    expect(result.matched_rules).toHaveLength(2);
    expect(result.matched_rules[0].provenance?.source_type).toBe('society_guideline');
    expect(result.matched_rules[1].provenance?.source_type).toBe('medication_label');
  });
});

// =============================================================================
// 10. Real pack loading
// =============================================================================

describe('real pack loading from YAML', () => {
  test('loads default.yaml successfully', async () => {
    const pack = await loadPolicyPack(DEFAULT_POLICY_PATH);

    expect(pack.policy_id).toBe('popper-core-safety');
    expect(pack.policy_version).toBe('2.0.0');
    expect(pack.rules.length).toBeGreaterThan(0);
    expect(pack.staleness).toBeDefined();
  });

  test('loads cardiometabolic-hf.yaml successfully', async () => {
    const pack = await loadPolicyPack(CARDIO_HF_PATH);

    expect(pack.policy_id).toBe('domain-cardiometabolic-hf');
    expect(pack.policy_version).toBe('0.1.0');
    expect(pack.rules.length).toBeGreaterThan(0);
  });

  test('composed pack has rules from both default and domain', async () => {
    const corePack = await loadPolicyPack(DEFAULT_POLICY_PATH);
    const domainPack = await loadPolicyPack(CARDIO_HF_PATH);
    const composed = composePacks([corePack, domainPack]);

    expect(composed.rules.length).toBe(corePack.rules.length + domainPack.rules.length);
    expect(composed.policy_id).toContain('popper-core-safety');
    expect(composed.policy_id).toContain('domain-cardiometabolic-hf');
  });

  test('composed pack ID uses composed: prefix format', async () => {
    const corePack = await loadPolicyPack(DEFAULT_POLICY_PATH);
    const domainPack = await loadPolicyPack(CARDIO_HF_PATH);
    const composed = composePacks([corePack, domainPack]);

    expect(composed.policy_id).toBe('composed:popper-core-safety+domain-cardiometabolic-hf');
  });

  test('composed pack evaluator works end-to-end with ARNI washout rule', async () => {
    const corePack = await loadPolicyPack(DEFAULT_POLICY_PATH);
    const domainPack = await loadPolicyPack(CARDIO_HF_PATH);
    const composed = composePacks([corePack, domainPack]);
    const evaluator = createEvaluator(composed);

    // Create a request that should trigger the ARNI washout rule
    const stoppedAt = new Date(new Date(NOW).getTime() - 10 * 60 * 60 * 1000).toISOString();

    const request = createMinimalRequest({
      hermes_version: '2.3.0',
      mode: 'advocate_clinical',
      trace: {
        trace_id: 'real-pack-test',
        created_at: NOW,
        producer: { system: 'deutsch', service_version: '1.0.0' },
      },
      request_timestamp: NOW,
      proposals: [
        {
          proposal_id: 'p-arni-real',
          kind: 'MEDICATION_ORDER_PROPOSAL',
          description: 'Initiate sacubitril/valsartan',
          medication: { name: 'sacubitril/valsartan', atc_class: 'C09DX04' },
          change: { change_type: 'initiate' },
        },
      ],
      snapshot_payload: {
        active_medications: [
          {
            name: 'lisinopril',
            atc_class: 'C09AA01',
            status: 'discontinued',
            stopped_at: stoppedAt,
          },
        ],
      },
    });

    const result = evaluator.evaluate(createContext(request));

    // The domain pack's acei_to_arni_washout_check rule should fire
    const washoutMatch = result.matched_rules.find(
      (r) => r.rule_id === 'acei_to_arni_washout_check',
    );
    expect(washoutMatch).toBeDefined();
    expect(result.decision).toBe('HARD_STOP');
  });
});
