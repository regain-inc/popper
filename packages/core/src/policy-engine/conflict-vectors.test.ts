/**
 * Conflict Test Vectors
 *
 * Tests policy evaluation against the default policy pack (default.yaml)
 * for cross-domain conflict, domain status, and rule engine rules.
 *
 * @see config/policies/default.yaml
 * @see docs/specs/02-popper-specs/03-popper-safety-dsl.md §5
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { createEvaluator, type EvaluationContext, type EvaluationResult, policyRegistry } from '..';
import {
  createConflict,
  createEvidenceRef,
  createHTVScore,
  createLifestyleProposal,
  createMedicationProposal,
  createTestContext,
  createTestRequest,
} from '../__test-utils__';

/**
 * Helper: create a "clean" medication proposal that won't trigger
 * HTV, evidence, or missing-field rules. Uses high HTV and case_control
 * evidence grade which does NOT trigger weak_evidence_grade
 * (since case_control strength=4, threshold case_control=4, compare=0, not <0).
 */
function createCleanMedicationProposal(overrides: Record<string, unknown> = {}) {
  return createMedicationProposal({
    htv_score: createHTVScore(0.8),
    evidence_refs: [createEvidenceRef('case_control')],
    ...overrides,
  });
}

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
// Conflict Vectors
// =============================================================================

describe('Conflict Vectors', () => {
  test('conflict-001: Clinical domain status failed → HARD_STOP', () => {
    const request = createTestRequest({
      proposals: [createCleanMedicationProposal()],
      contributing_domains: [
        {
          domain_category: 'clinical',
          domain_name: 'cardiovascular',
          status: 'failed',
        },
      ],
    });

    const result = evaluate(createTestContext(request));

    expect(result.decision).toBe('HARD_STOP');
    expect(result.reason_codes).toContain('policy_violation');
    expect(result.matched_rules.some((r) => r.rule_id === 'domain_failed')).toBe(true);
  });

  test('conflict-002: Rule engine failed → ROUTE_TO_CLINICIAN', () => {
    const request = createTestRequest({
      proposals: [createCleanMedicationProposal()],
    });

    const result = evaluate(createTestContext(request, {}, { rule_engine_failed: true }));

    expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
    expect(result.reason_codes).toContain('policy_violation');
    expect(result.matched_rules.some((r) => r.rule_id === 'rule_engine_failed')).toBe(true);
  });

  test('conflict-003: Conflict missing evidence → ROUTE_TO_CLINICIAN + insufficient_evidence', () => {
    const request = createTestRequest({
      proposals: [createCleanMedicationProposal()],
      cross_domain_conflicts: [
        createConflict({
          evidence_refs: [], // No evidence for conflict resolution
        }),
      ],
    });

    const result = evaluate(createTestContext(request));

    expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
    expect(result.reason_codes).toContain('insufficient_evidence');
    expect(result.matched_rules.some((r) => r.rule_id === 'conflict_missing_evidence')).toBe(true);
  });

  test('conflict-004: Conflict resolution confidence low → ROUTE_TO_CLINICIAN', () => {
    const request = createTestRequest({
      proposals: [createCleanMedicationProposal()],
      cross_domain_conflicts: [
        createConflict({
          resolution_confidence: 'low',
        }),
      ],
    });

    const result = evaluate(createTestContext(request));

    expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
    expect(result.reason_codes).toContain('high_uncertainty');
    expect(result.matched_rules.some((r) => r.rule_id === 'conflict_low_confidence')).toBe(true);
  });

  test('conflict-005: Conflict escalated → ROUTE_TO_CLINICIAN', () => {
    const request = createTestRequest({
      proposals: [createCleanMedicationProposal()],
      cross_domain_conflicts: [
        createConflict({
          resolution_strategy: 'escalate',
        }),
      ],
    });

    const result = evaluate(createTestContext(request));

    expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
    expect(result.reason_codes).toContain('needs_human_review');
    expect(result.matched_rules.some((r) => r.rule_id === 'conflict_escalated')).toBe(true);
  });

  test('conflict-006: >5 conflicts → ROUTE_TO_CLINICIAN (conflict_count_too_high)', () => {
    const conflicts = Array.from({ length: 6 }, (_, i) =>
      createConflict({
        conflict_id: `conflict-${i + 1}`,
        resolution_confidence: 'high',
      }),
    );

    const request = createTestRequest({
      proposals: [createCleanMedicationProposal()],
      cross_domain_conflicts: conflicts,
    });

    const result = evaluate(createTestContext(request));

    expect(result.decision).toBe('ROUTE_TO_CLINICIAN');
    expect(result.reason_codes).toContain('policy_violation');
    expect(result.matched_rules.some((r) => r.rule_id === 'conflict_count_too_high')).toBe(true);
  });

  test('conflict-007: Lifestyle domain degraded, clinical OK → APPROVED (default_approve_wellness)', () => {
    const request = createTestRequest({
      proposals: [
        createLifestyleProposal({
          htv_score: createHTVScore(0.8),
        }),
      ],
      contributing_domains: [
        {
          domain_category: 'lifestyle',
          domain_name: 'nutrition',
          status: 'degraded',
        },
        {
          domain_category: 'clinical',
          domain_name: 'cardiovascular',
          status: 'success',
        },
      ],
    });

    const result = evaluate(createTestContext(request));

    // domain_failed only matches clinical + failed, not lifestyle + degraded
    // Lifestyle proposal falls through to default_approve_wellness → APPROVED
    expect(result.decision).toBe('APPROVED');
    expect(result.reason_codes).toContain('approved_with_constraints');
    expect(result.matched_rules.some((r) => r.rule_id === 'default_approve_wellness')).toBe(true);
  });
});
