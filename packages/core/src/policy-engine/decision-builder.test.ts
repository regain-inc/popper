/**
 * Decision Builder Tests
 */

import { describe, expect, test } from 'bun:test';
import type { SupervisionRequest } from '../hermes';
import { CURRENT_HERMES_VERSION } from '../hermes';
import {
  buildPerProposalDecisions,
  createDecisionBuilder,
  DecisionBuilder,
  defaultDecisionBuilder,
  getMoreConservativeDecision,
  isMoreConservative,
} from './decision-builder';
import type { EvaluationResult } from './evaluator';
import type { StalenessResult } from './staleness';

// =============================================================================
// Test Helpers
// =============================================================================

const createRequest = (): SupervisionRequest =>
  ({
    hermes_version: '1.6.0',
    message_type: 'supervision_request',
    mode: 'wellness',
    trace: {
      trace_id: 'req-123',
      created_at: new Date().toISOString(),
      producer: {
        system: 'deutsch',
        service_version: '1.0.0',
      },
    },
    subject: {
      subject_id: 'patient-789',
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
        proposal_id: 'p1',
        created_at: new Date().toISOString(),
        message_markdown: 'Hello patient',
        audit_redaction: { summary: 'Patient message' },
      },
    ],
    audit_redaction: {
      summary: 'Test request',
      proposal_summaries: ['Patient message'],
    },
  }) as SupervisionRequest;

const createEvaluationResult = (overrides: Partial<EvaluationResult> = {}): EvaluationResult => ({
  decision: 'APPROVED',
  reason_codes: ['approved_with_constraints'],
  explanation: 'Request approved within normal parameters.',
  matched_rules: [],
  policy_version: '1.0.0',
  evaluation_time_ms: 5,
  ...overrides,
});

const createStalenessResult = (overrides: Partial<StalenessResult> = {}): StalenessResult => ({
  is_stale: false,
  is_missing: false,
  age_hours: 12,
  threshold_hours: 24,
  mode: 'wellness',
  explanation: 'Snapshot is fresh.',
  ...overrides,
});

// =============================================================================
// Tests
// =============================================================================

describe('DecisionBuilder', () => {
  describe('Basic Response Building', () => {
    test('builds complete SupervisionResponse', () => {
      const builder = new DecisionBuilder();
      const request = createRequest();
      const evalResult = createEvaluationResult();

      const response = builder.build({ request, evaluationResult: evalResult });

      expect(response.hermes_version).toBe(CURRENT_HERMES_VERSION);
      expect(response.message_type).toBe('supervision_response');
      expect(response.decision).toBe('APPROVED');
      expect(response.reason_codes).toContain('approved_with_constraints');
      expect(response.explanation).toBe('Request approved within normal parameters.');
      expect(response.mode).toBe('wellness');
      expect(response.subject.subject_id).toBe('patient-789');
      expect(response.snapshot.snapshot_id).toBe('snap-001');
    });

    test('includes trace context with parent reference', () => {
      const builder = new DecisionBuilder();
      const request = createRequest();
      const evalResult = createEvaluationResult();

      const response = builder.build({ request, evaluationResult: evalResult });

      expect(response.trace.parent_span_id).toBe('req-123');
      expect(response.trace.producer.system).toBe('popper');
      expect(response.trace.producer.ruleset_version).toBe('1.0.0');
    });

    test('includes response timestamp', () => {
      const builder = new DecisionBuilder();
      const request = createRequest();
      const evalResult = createEvaluationResult();

      const before = new Date();
      const response = builder.build({ request, evaluationResult: evalResult });
      const after = new Date();

      expect(response.response_timestamp).toBeDefined();
      const responseTime = new Date(response.response_timestamp as string);
      expect(responseTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(responseTime.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    test('includes audit redaction', () => {
      const builder = new DecisionBuilder();
      const request = createRequest();
      const evalResult = createEvaluationResult();

      const response = builder.build({ request, evaluationResult: evalResult });

      expect(response.audit_redaction.decision).toBe('APPROVED');
      expect(response.audit_redaction.reason_codes).toContain('approved_with_constraints');
      expect(response.audit_redaction.summary).toContain('APPROVED');
    });
  });

  describe('Conservatism Principle', () => {
    test('uses evaluation result decision by default', () => {
      const builder = new DecisionBuilder();
      const request = createRequest();
      const evalResult = createEvaluationResult({ decision: 'ROUTE_TO_CLINICIAN' });

      const response = builder.build({ request, evaluationResult: evalResult });

      expect(response.decision).toBe('ROUTE_TO_CLINICIAN');
    });

    test('staleness missing overrides to HARD_STOP', () => {
      const builder = new DecisionBuilder();
      const request = createRequest();
      const evalResult = createEvaluationResult({ decision: 'APPROVED' });
      const stalenessResult = createStalenessResult({
        is_missing: true,
        explanation: 'No snapshot provided.',
      });

      const response = builder.build({
        request,
        evaluationResult: evalResult,
        stalenessResult,
      });

      expect(response.decision).toBe('HARD_STOP');
      expect(response.reason_codes).toContain('schema_invalid');
      expect(response.reason_codes).toContain('data_quality_warning');
    });

    test('staleness stale adds data_quality_warning', () => {
      const builder = new DecisionBuilder();
      const request = createRequest();
      const evalResult = createEvaluationResult({ decision: 'APPROVED' });
      const stalenessResult = createStalenessResult({
        is_stale: true,
        explanation: 'Snapshot is 25 hours old.',
      });

      const response = builder.build({
        request,
        evaluationResult: evalResult,
        stalenessResult,
      });

      expect(response.reason_codes).toContain('data_quality_warning');
    });

    test('keeps more conservative decision from evaluation', () => {
      const builder = new DecisionBuilder();
      const request = createRequest();
      const evalResult = createEvaluationResult({ decision: 'HARD_STOP' });
      const stalenessResult = createStalenessResult({ is_stale: false });

      const response = builder.build({
        request,
        evaluationResult: evalResult,
        stalenessResult,
      });

      expect(response.decision).toBe('HARD_STOP');
    });
  });

  describe('Optional Fields', () => {
    test('includes idempotency key when present', () => {
      const builder = new DecisionBuilder();
      const request = createRequest();
      (request as Record<string, unknown>).idempotency_key = 'idem-123';
      const evalResult = createEvaluationResult();

      const response = builder.build({ request, evaluationResult: evalResult });

      expect((response as Record<string, unknown>).request_idempotency_key).toBe('idem-123');
    });

    test('includes approved constraints when APPROVED', () => {
      const builder = new DecisionBuilder();
      const request = createRequest();
      const evalResult = createEvaluationResult({
        decision: 'APPROVED',
        approved_constraints: {
          must_route_after: 'P7D',
          allowed_actions: ['dose_adjust'],
        },
      });

      const response = builder.build({ request, evaluationResult: evalResult });

      expect((response as Record<string, unknown>).approved_constraints).toBeDefined();
    });

    test('omits approved constraints when not APPROVED', () => {
      const builder = new DecisionBuilder();
      const request = createRequest();
      const evalResult = createEvaluationResult({
        decision: 'ROUTE_TO_CLINICIAN',
        approved_constraints: {
          must_route_after: 'P7D',
        },
      });

      const response = builder.build({ request, evaluationResult: evalResult });

      expect((response as Record<string, unknown>).approved_constraints).toBeUndefined();
    });

    test('includes control commands when present', () => {
      const builder = new DecisionBuilder();
      const request = createRequest();
      const evalResult = createEvaluationResult({
        control_commands: [{ kind: 'SET_SAFE_MODE', safe_mode: { enabled: true, reason: 'Test' } }],
      });

      const response = builder.build({ request, evaluationResult: evalResult });

      const commands = (response as Record<string, unknown>).control_commands as unknown[];
      expect(commands).toHaveLength(1);
      expect((commands[0] as Record<string, unknown>).kind).toBe('SET_SAFE_MODE');
    });

    test('merges additional control commands', () => {
      const builder = new DecisionBuilder();
      const request = createRequest();
      const evalResult = createEvaluationResult({
        control_commands: [{ kind: 'SET_SAFE_MODE', safe_mode: { enabled: true, reason: 'R1' } }],
      });

      const response = builder.build({
        request,
        evaluationResult: evalResult,
        additionalControlCommands: [
          { kind: 'SET_OPERATIONAL_SETTING', setting: { key: 'test', value: 'value' } },
        ],
      });

      const commands = (response as Record<string, unknown>).control_commands as unknown[];
      expect(commands).toHaveLength(2);
    });

    test('includes safe mode state when provided', () => {
      const builder = new DecisionBuilder();
      const request = createRequest();
      const evalResult = createEvaluationResult();

      const response = builder.build({
        request,
        evaluationResult: evalResult,
        safeModeState: {
          enabled: true,
          reason: 'Emergency mode',
        },
      });

      const safeModeState = (response as Record<string, unknown>).safe_mode_state_used as Record<
        string,
        unknown
      >;
      expect(safeModeState.enabled).toBe(true);
      expect(safeModeState.reason).toBe('Emergency mode');
    });

    test('includes per-proposal decisions when provided', () => {
      const builder = new DecisionBuilder();
      const request = createRequest();
      const evalResult = createEvaluationResult();

      const response = builder.build({
        request,
        evaluationResult: evalResult,
        perProposalDecisions: [
          { proposal_id: 'p1', decision: 'APPROVED', reason_codes: ['approved_with_constraints'] },
        ],
      });

      const perProposal = (response as Record<string, unknown>).per_proposal_decisions as unknown[];
      expect(perProposal).toHaveLength(1);
    });
  });

  describe('Error Response Building', () => {
    test('builds error response for schema validation failure', () => {
      const builder = new DecisionBuilder();
      const partialRequest = { mode: 'wellness' as const };

      const response = builder.buildErrorResponse(partialRequest, 'Schema validation failed', [
        'schema_invalid',
      ]);

      expect(response.decision).toBe('HARD_STOP');
      expect(response.reason_codes).toContain('schema_invalid');
      expect(response.explanation).toBe('Schema validation failed');
    });

    test('handles missing request fields gracefully', () => {
      const builder = new DecisionBuilder();

      const response = builder.buildErrorResponse({}, 'Invalid request');

      expect(response.decision).toBe('HARD_STOP');
      expect(response.mode).toBe('wellness'); // Default
      expect(response.subject.subject_id).toBe('unknown');
    });
  });

  describe('Factory Functions', () => {
    test('createDecisionBuilder creates builder with custom IDs', () => {
      const builder = createDecisionBuilder('popper', '2.0.0');
      const request = createRequest();
      const evalResult = createEvaluationResult();

      const response = builder.build({ request, evaluationResult: evalResult });

      expect(response.trace.producer.system).toBe('popper');
      expect(response.trace.producer.service_version).toBe('2.0.0');
    });

    test('defaultDecisionBuilder is available', () => {
      expect(defaultDecisionBuilder).toBeInstanceOf(DecisionBuilder);
    });
  });
});

describe('Utility Functions', () => {
  describe('getMoreConservativeDecision', () => {
    test('HARD_STOP is most conservative', () => {
      expect(getMoreConservativeDecision('HARD_STOP', 'APPROVED')).toBe('HARD_STOP');
      expect(getMoreConservativeDecision('APPROVED', 'HARD_STOP')).toBe('HARD_STOP');
    });

    test('ROUTE_TO_CLINICIAN > REQUEST_MORE_INFO > APPROVED', () => {
      expect(getMoreConservativeDecision('ROUTE_TO_CLINICIAN', 'APPROVED')).toBe(
        'ROUTE_TO_CLINICIAN',
      );
      expect(getMoreConservativeDecision('REQUEST_MORE_INFO', 'APPROVED')).toBe(
        'REQUEST_MORE_INFO',
      );
      expect(getMoreConservativeDecision('ROUTE_TO_CLINICIAN', 'REQUEST_MORE_INFO')).toBe(
        'ROUTE_TO_CLINICIAN',
      );
    });

    test('same decision returns itself', () => {
      expect(getMoreConservativeDecision('APPROVED', 'APPROVED')).toBe('APPROVED');
      expect(getMoreConservativeDecision('HARD_STOP', 'HARD_STOP')).toBe('HARD_STOP');
    });
  });

  describe('isMoreConservative', () => {
    test('returns true when candidate is more conservative', () => {
      expect(isMoreConservative('HARD_STOP', 'APPROVED')).toBe(true);
      expect(isMoreConservative('ROUTE_TO_CLINICIAN', 'APPROVED')).toBe(true);
      expect(isMoreConservative('REQUEST_MORE_INFO', 'APPROVED')).toBe(true);
    });

    test('returns false when candidate is less conservative', () => {
      expect(isMoreConservative('APPROVED', 'HARD_STOP')).toBe(false);
      expect(isMoreConservative('REQUEST_MORE_INFO', 'ROUTE_TO_CLINICIAN')).toBe(false);
    });

    test('returns false when decisions are equal', () => {
      expect(isMoreConservative('APPROVED', 'APPROVED')).toBe(false);
    });
  });

  describe('buildPerProposalDecisions', () => {
    test('creates per-proposal decisions with defaults', () => {
      const proposals = [
        { kind: 'PATIENT_MESSAGE' as const, proposal_id: 'p1', message_markdown: 'Hello' },
        { kind: 'PATIENT_MESSAGE' as const, proposal_id: 'p2', message_markdown: 'World' },
      ];

      const decisions = buildPerProposalDecisions(proposals, 'APPROVED', [
        'approved_with_constraints',
      ]);

      expect(decisions).toHaveLength(2);
      expect(decisions[0].proposal_id).toBe('p1');
      expect(decisions[0].decision).toBe('APPROVED');
      expect(decisions[1].proposal_id).toBe('p2');
    });

    test('applies overrides to specific proposals', () => {
      const proposals = [
        { kind: 'PATIENT_MESSAGE' as const, proposal_id: 'p1', message_markdown: 'Hello' },
        {
          kind: 'MEDICATION_ORDER_PROPOSAL' as const,
          proposal_id: 'p2',
          medication: { name: 'Test' },
          change: { change_type: 'titrate' as const },
        },
      ];

      const overrides = new Map([
        [
          'p2',
          { decision: 'ROUTE_TO_CLINICIAN' as const, reason_codes: ['risk_too_high' as const] },
        ],
      ]);

      const decisions = buildPerProposalDecisions(
        proposals,
        'APPROVED',
        ['approved_with_constraints'],
        overrides,
      );

      expect(decisions[0].decision).toBe('APPROVED');
      expect(decisions[1].decision).toBe('ROUTE_TO_CLINICIAN');
      expect(decisions[1].reason_codes).toContain('risk_too_high');
    });
  });
});
