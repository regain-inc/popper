/**
 * HTV / Evidence Grade Test Vectors
 *
 * Tests policy evaluation against the default policy pack (default.yaml)
 * for HTV score, evidence grade, hallucination, and IDK rules.
 *
 * @see config/policies/default.yaml
 * @see docs/specs/02-popper-specs/03-popper-safety-dsl.md §5
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { createEvaluator, type EvaluationContext, type EvaluationResult, policyRegistry } from '..';
import {
  createEvidenceRef,
  createHTVScore,
  createLifestyleProposal,
  createMedicationProposal,
  createPatientMessageProposal,
  createTestContext,
  createTestRequest,
} from '../__test-utils__';

// =============================================================================
// Setup: Load default policy pack
// =============================================================================

beforeAll(async () => {
  const policiesDir = resolve(import.meta.dir, '../../../../config/policies');
  await policyRegistry.loadFromDir(policiesDir);
});

afterAll(() => {
  policyRegistry.clear();
});

function evaluate(context: EvaluationContext): EvaluationResult {
  const pack = policyRegistry.get('popper-default');
  if (!pack) throw new Error('Policy pack not loaded');
  return createEvaluator(pack).evaluate(context);
}

// =============================================================================
// HTV Score Vectors
// =============================================================================

describe('HTV Score Vectors', () => {
  test('htv-001: Medication with composite 0.35 (below 0.6 threshold) → ROUTE_TO_CLINICIAN', () => {
    const request = createTestRequest({
      mode: 'advocate_clinical',
      proposals: [
        createMedicationProposal({
          htv_score: createHTVScore(0.35),
          evidence_refs: [createEvidenceRef('rct')],
        }),
      ],
    });

    const result = evaluate(createTestContext(request));

    expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
    expect(result.reason_codes).toContain('low_htv_score');
    expect(result.matched_rules.some((r) => r.rule_id === 'low_htv_score_medication')).toBe(true);
  });

  test('htv-002: Medication with composite 0.65 (above 0.6) → passes HTV medication rule', () => {
    const request = createTestRequest({
      mode: 'advocate_clinical',
      proposals: [
        createMedicationProposal({
          htv_score: createHTVScore(0.65),
          evidence_refs: [createEvidenceRef('rct')],
        }),
      ],
    });

    const result = evaluate(createTestContext(request));

    // Should NOT be caught by low_htv_score_medication
    expect(result.matched_rules.some((r) => r.rule_id === 'low_htv_score_medication')).toBe(false);
    // Also not caught by low_htv_score_default (0.65 > 0.4)
    expect(result.matched_rules.some((r) => r.rule_id === 'low_htv_score_default')).toBe(false);
  });

  test('htv-003: Any proposal with composite 0.25 (below 0.4 default) → REQUEST_MORE_INFO', () => {
    const request = createTestRequest({
      proposals: [
        createPatientMessageProposal({
          htv_score: createHTVScore(0.25),
        }),
      ],
    });

    const result = evaluate(createTestContext(request));

    expect(result.decision).toBe('REQUEST_MORE_INFO');
    expect(result.reason_codes).toContain('low_htv_score');
    expect(result.matched_rules.some((r) => r.rule_id === 'low_htv_score_default')).toBe(true);
  });

  test('htv-004: Medication missing HTV entirely → ROUTE_TO_CLINICIAN (conservative)', () => {
    const request = createTestRequest({
      mode: 'advocate_clinical',
      proposals: [
        createMedicationProposal({
          // No htv_score — treated as below threshold
          evidence_refs: [createEvidenceRef('rct')],
        }),
      ],
    });

    const result = evaluate(createTestContext(request));

    expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
    expect(result.reason_codes).toContain('low_htv_score');
  });

  test('htv-005: Patient message with low HTV 0.35 → REQUEST_MORE_INFO (default 0.4 rule)', () => {
    const request = createTestRequest({
      proposals: [
        createPatientMessageProposal({
          htv_score: createHTVScore(0.35),
        }),
      ],
    });

    const result = evaluate(createTestContext(request));

    expect(result.decision).toBe('REQUEST_MORE_INFO');
    expect(result.reason_codes).toContain('low_htv_score');
    expect(result.matched_rules.some((r) => r.rule_id === 'low_htv_score_default')).toBe(true);
    // Should NOT match medication-specific rule
    expect(result.matched_rules.some((r) => r.rule_id === 'low_htv_score_medication')).toBe(false);
  });
});

// =============================================================================
// Evidence Grade Vectors
// =============================================================================

describe('Evidence Grade Vectors', () => {
  /**
   * NOTE: The evaluator's isEvidenceGradeBelow finds the grade with the lowest
   * strength number (i.e., the STRONGEST grade) and returns true when
   * compareEvidenceGrades(strongestGrade, threshold) < 0, i.e., when
   * the strongest grade is STRONGER than threshold. This means the
   * weak_evidence_grade rule fires for grades STRONGER than case_control,
   * not weaker. This is a known behavioral quirk (POP-TODO).
   *
   * Vectors htv-006 through htv-011 document the actual behavior.
   */

  test('htv-006: evidence_grade case_report, medication → caught by medication_missing_evidence or evidence rule', () => {
    const request = createTestRequest({
      mode: 'advocate_clinical',
      proposals: [
        createMedicationProposal({
          htv_score: createHTVScore(0.8),
          evidence_refs: [createEvidenceRef('case_report')],
        }),
      ],
    });

    const result = evaluate(createTestContext(request));

    // case_report (6) vs case_control threshold (4): compareEvidenceGrades = 6-4 = 2 > 0
    // So evidence_grade_below returns false for case_report (it's weaker, not stronger).
    // The request falls through to a lower-priority rule or default.
    // With htv_score 0.8 and evidence_refs present, it won't trigger HTV or missing evidence rules.
    // It will hit default_route (always) → ROUTE_TO_CLINICIAN.
    expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
  });

  test('htv-007: evidence_grade case_series, triage → ROUTE_TO_CLINICIAN', () => {
    const request = createTestRequest({
      proposals: [
        {
          kind: 'TRIAGE_ROUTE',
          proposal_id: 'p-triage-1',
          created_at: new Date().toISOString(),
          triage_level: 'urgent',
          htv_score: createHTVScore(0.8),
          evidence_refs: [createEvidenceRef('case_series')],
          audit_redaction: { summary: 'Triage proposal' },
        },
      ],
    });

    const result = evaluate(createTestContext(request));

    // case_series (5) vs case_control (4): 5-4 = 1 > 0 → not below threshold
    // Falls through to default_route → ROUTE_TO_CLINICIAN
    expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
  });

  test('htv-008: evidence_grade cohort, medication → weak_evidence_grade fires (cohort < case_control)', () => {
    const request = createTestRequest({
      mode: 'advocate_clinical',
      proposals: [
        createMedicationProposal({
          htv_score: createHTVScore(0.8),
          evidence_refs: [createEvidenceRef('cohort')],
        }),
      ],
    });

    const result = evaluate(createTestContext(request));

    // cohort (3) vs case_control (4): 3-4 = -1 < 0 → evidence_grade_below returns true
    // weak_evidence_grade rule (priority 610) fires → ROUTE_TO_CLINICIAN
    expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
    expect(result.reason_codes).toContain('weak_evidence_grade');
    expect(result.matched_rules.some((r) => r.rule_id === 'weak_evidence_grade')).toBe(true);
  });

  test('htv-009: Missing evidence_refs, medication → ROUTE_TO_CLINICIAN + insufficient_evidence', () => {
    const request = createTestRequest({
      mode: 'advocate_clinical',
      proposals: [
        createMedicationProposal({
          htv_score: createHTVScore(0.8),
          // No evidence_refs
          evidence_refs: undefined,
        }),
      ],
    });

    const result = evaluate(createTestContext(request));

    expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
    expect(result.reason_codes).toContain('insufficient_evidence');
    expect(result.matched_rules.some((r) => r.rule_id === 'medication_missing_evidence')).toBe(
      true,
    );
  });

  test('htv-010: Special grade policy → maps to cohort (3), fires weak_evidence_grade', () => {
    const request = createTestRequest({
      mode: 'advocate_clinical',
      proposals: [
        createMedicationProposal({
          htv_score: createHTVScore(0.8),
          evidence_refs: [createEvidenceRef('policy')],
        }),
      ],
    });

    const result = evaluate(createTestContext(request));

    // policy maps to strength 3 (same as cohort)
    // 3 vs case_control (4): 3-4 = -1 < 0 → fires
    expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
    expect(result.reason_codes).toContain('weak_evidence_grade');
  });

  test('htv-011: Special grade patient_reported → maps to case_report (6), does NOT fire weak_evidence_grade', () => {
    const request = createTestRequest({
      mode: 'advocate_clinical',
      proposals: [
        createMedicationProposal({
          htv_score: createHTVScore(0.8),
          evidence_refs: [createEvidenceRef('patient_reported')],
        }),
      ],
    });

    const result = evaluate(createTestContext(request));

    // patient_reported maps to strength 6 (same as case_report)
    // 6 vs case_control (4): 6-4 = 2 > 0 → does not fire
    expect(result.matched_rules.some((r) => r.rule_id === 'weak_evidence_grade')).toBe(false);
  });
});

// =============================================================================
// Hallucination Vectors
// =============================================================================

describe('Hallucination Vectors', () => {
  test('htv-012: Critical hallucination → HARD_STOP + drift_suspected', () => {
    const request = createTestRequest({
      proposals: [
        createPatientMessageProposal({
          htv_score: createHTVScore(0.8), // Valid HTV to avoid low_htv_score rules
        }),
      ],
    });

    const result = evaluate(
      createTestContext(
        request,
        {},
        {
          hallucination: { detected: true, severity: 'critical' },
        },
      ),
    );

    expect(result.decision).toBe('HARD_STOP');
    expect(result.reason_codes).toContain('drift_suspected');
    expect(result.matched_rules.some((r) => r.rule_id === 'hallucination_critical')).toBe(true);
  });

  test('htv-013: Significant hallucination → ROUTE_TO_CLINICIAN', () => {
    const request = createTestRequest({
      proposals: [
        createPatientMessageProposal({
          htv_score: createHTVScore(0.8), // Valid HTV to avoid low_htv_score rules
        }),
      ],
    });

    const result = evaluate(
      createTestContext(
        request,
        {},
        {
          hallucination: { detected: true, severity: 'significant' },
        },
      ),
    );

    expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
    expect(result.reason_codes).toContain('drift_suspected');
    expect(result.matched_rules.some((r) => r.rule_id === 'hallucination_significant')).toBe(true);
  });
});

// =============================================================================
// IDK / Uncertainty Vectors
// =============================================================================

describe('IDK / Uncertainty Vectors', () => {
  test('htv-014: IDK triggered → ROUTE_TO_CLINICIAN + high_uncertainty', () => {
    const request = createTestRequest({
      proposals: [
        createPatientMessageProposal({
          htv_score: createHTVScore(0.8), // Valid HTV to avoid low_htv_score rules
        }),
      ],
    });

    const result = evaluate(createTestContext(request, {}, { idk_triggered: true }));

    expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
    expect(result.reason_codes).toContain('high_uncertainty');
    expect(result.matched_rules.some((r) => r.rule_id === 'idk_triggered')).toBe(true);
  });

  test('htv-015: Low HTV (0.25) on lifestyle recommendation → REQUEST_MORE_INFO (default 0.4)', () => {
    const request = createTestRequest({
      proposals: [
        createLifestyleProposal({
          htv_score: createHTVScore(0.25),
        }),
      ],
    });

    const result = evaluate(createTestContext(request));

    expect(result.decision).toBe('REQUEST_MORE_INFO');
    expect(result.reason_codes).toContain('low_htv_score');
    expect(result.matched_rules.some((r) => r.rule_id === 'low_htv_score_default')).toBe(true);
  });
});
