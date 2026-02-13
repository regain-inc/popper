/**
 * Shared test fixtures and factories for Popper test suites.
 *
 * Usage:
 *   import { createTestRequest, SYSTEM_ORG_ID } from '@popper/core/__test-utils__';
 *
 * @module __test-utils__/fixtures
 */

import type { SupervisionRequest } from '../hermes';
import type { DerivedSignals, EvaluationContext } from '../policy-engine/evaluator';

// =============================================================================
// Constants
// =============================================================================

/** System org ID used by dev-mode auth — matches supervision.ts SYSTEM_ORG_ID */
export const SYSTEM_ORG_ID = '00000000-0000-0000-0000-000000000000';

/** Stable trace ID for deterministic test output */
export const TEST_TRACE_ID = 'test-trace-00000000';

// =============================================================================
// Request Factories
// =============================================================================

/**
 * Create a minimal valid SupervisionRequest for testing.
 * Defaults to wellness mode with a PATIENT_MESSAGE proposal.
 */
export function createTestRequest(overrides: Record<string, unknown> = {}): SupervisionRequest {
  return {
    hermes_version: '2.0.0',
    message_type: 'supervision_request',
    mode: 'wellness',
    trace: {
      trace_id: TEST_TRACE_ID,
      created_at: new Date().toISOString(),
      producer: {
        system: 'deutsch',
        service_version: '1.0.0',
      },
    },
    subject: {
      subject_id: 'patient-123',
      subject_type: 'patient',
    },
    snapshot: {
      snapshot_id: 'snap-001',
      created_at: new Date().toISOString(),
      sources: ['ehr'],
    },
    proposals: [
      {
        kind: 'PATIENT_MESSAGE',
        proposal_id: 'p-test-1',
        created_at: new Date().toISOString(),
        message_markdown: 'Hello, how are you feeling today?',
        audit_redaction: {
          summary: 'Test patient message',
        },
      },
    ],
    audit_redaction: {
      summary: 'Test supervision request',
      proposal_summaries: ['Test patient message'],
    },
    ...overrides,
  } as SupervisionRequest;
}

/**
 * Create a MEDICATION_ORDER_PROPOSAL with optional HTV score and evidence refs.
 */
export function createMedicationProposal(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'MEDICATION_ORDER_PROPOSAL',
    proposal_id: 'p-med-1',
    created_at: new Date().toISOString(),
    medication: { name: 'lisinopril' },
    change: { change_type: 'titrate', from_dose: '10 mg', to_dose: '20 mg' },
    clinician_protocol_ref: 'protocol://test/cvd/v1',
    audit_redaction: { summary: 'Medication proposal' },
    ...overrides,
  };
}

/**
 * Create a TRIAGE_ROUTE proposal.
 */
export function createTriageProposal(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'TRIAGE_ROUTE',
    proposal_id: 'p-triage-1',
    created_at: new Date().toISOString(),
    triage_level: 'urgent',
    audit_redaction: { summary: 'Triage proposal' },
    ...overrides,
  };
}

/**
 * Create a PATIENT_MESSAGE proposal.
 */
export function createPatientMessageProposal(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'PATIENT_MESSAGE',
    proposal_id: 'p-msg-1',
    created_at: new Date().toISOString(),
    message_markdown: 'Test patient message',
    audit_redaction: { summary: 'Patient message' },
    ...overrides,
  };
}

/**
 * Create a LIFESTYLE_MODIFICATION_PROPOSAL.
 */
export function createLifestyleProposal(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'LIFESTYLE_MODIFICATION_PROPOSAL',
    proposal_id: 'p-lifestyle-1',
    created_at: new Date().toISOString(),
    recommendation_markdown: 'Walk 30 minutes daily',
    audit_redaction: { summary: 'Lifestyle recommendation' },
    ...overrides,
  };
}

// =============================================================================
// HTV / Evidence Factories
// =============================================================================

/**
 * Create an HTV score object.
 */
export function createHTVScore(composite: number, overrides: Record<string, unknown> = {}) {
  return {
    interdependence: composite,
    specificity: composite,
    parsimony: composite,
    falsifiability: composite,
    composite,
    ...overrides,
  };
}

/**
 * Create an evidence reference.
 */
export function createEvidenceRef(grade: string, overrides: Record<string, unknown> = {}) {
  return {
    evidence_id: `ev-${grade}`,
    evidence_type: 'study',
    citation: `Test ${grade} study`,
    evidence_grade: grade,
    ...overrides,
  };
}

// =============================================================================
// Conflict Factories
// =============================================================================

/**
 * Create a cross-domain conflict.
 */
export function createConflict(overrides: Record<string, unknown> = {}) {
  return {
    conflict_id: 'conflict-1',
    conflict_type: 'medication_interaction',
    domain_a: 'cardiovascular',
    domain_b: 'renal',
    resolution_strategy: 'defer',
    resolution_confidence: 'medium',
    evidence_refs: [createEvidenceRef('cohort')],
    ...overrides,
  };
}

// =============================================================================
// Context Factories
// =============================================================================

/**
 * Create an EvaluationContext for policy evaluator tests.
 */
export function createTestContext(
  request: SupervisionRequest,
  controlPlane: EvaluationContext['controlPlane'] = {},
  derivedSignals: DerivedSignals = {},
): EvaluationContext {
  return {
    request,
    controlPlane,
    derivedSignals,
  };
}
