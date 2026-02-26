/**
 * E2E Supervision Vector Tests
 *
 * API-level tests through the full HTTP pipeline:
 * request → policy eval → decision → audit → response
 *
 * These tests use a subset of key vectors to validate the entire
 * supervision flow end-to-end.
 *
 * @see config/policies/default.yaml
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { InMemoryIdempotencyCache } from '@popper/cache';
import {
  AuditEmitter,
  InMemoryAuditStorage,
  policyRegistry,
  type SupervisionResponse,
  setDefaultEmitter,
} from '@popper/core';
import { Elysia } from 'elysia';
import { setIdempotencyCache } from '../lib/idempotency';
import { supervisionPlugin } from './supervision';

// =============================================================================
// Test Setup
// =============================================================================

let app: Elysia;
let auditStorage: InMemoryAuditStorage;

beforeAll(async () => {
  const policiesDir = resolve(import.meta.dir, '../../../../config/policies');
  await policyRegistry.loadFromDir(policiesDir);

  app = new Elysia().use(supervisionPlugin);
});

afterAll(() => {
  policyRegistry.clear();
});

auditStorage = new InMemoryAuditStorage();
const testEmitter = new AuditEmitter(auditStorage, { batchEnabled: false, asyncWrites: false });
setDefaultEmitter(testEmitter);

let idempotencyCache: InMemoryIdempotencyCache<SupervisionResponse>;

beforeEach(() => {
  idempotencyCache = new InMemoryIdempotencyCache();
  setIdempotencyCache(idempotencyCache);
});

afterEach(() => {
  auditStorage.clear();
  idempotencyCache.clear();
});

// =============================================================================
// Helpers
// =============================================================================

function createBaseRequest(overrides: Record<string, unknown> = {}) {
  return {
    hermes_version: '2.0.0',
    message_type: 'supervision_request',
    mode: 'wellness',
    trace: {
      trace_id: `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      created_at: new Date().toISOString(),
      producer: {
        system: 'deutsch',
        service_version: '1.0.0',
      },
    },
    subject: {
      subject_id: 'patient-e2e',
      subject_type: 'patient',
    },
    snapshot: {
      snapshot_id: 'snap-e2e',
      created_at: new Date().toISOString(),
      sources: ['ehr'],
    },
    proposals: [
      {
        kind: 'PATIENT_MESSAGE',
        proposal_id: 'p-e2e-1',
        created_at: new Date().toISOString(),
        message_markdown: 'E2E test message',
        audit_redaction: { summary: 'E2E test' },
      },
    ],
    audit_redaction: {
      summary: 'E2E test request',
      proposal_summaries: ['E2E test'],
    },
    ...overrides,
  };
}

async function postSupervise(body: unknown) {
  return app.handle(
    new Request('http://localhost/v1/popper/supervise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

// =============================================================================
// E2E Vector Tests
// =============================================================================

describe('E2E Supervision Vectors', () => {
  test('e2e-001: Wellness request with PATIENT_MESSAGE → APPROVED', async () => {
    const request = createBaseRequest({
      proposals: [
        {
          kind: 'PATIENT_MESSAGE',
          proposal_id: 'p-wellness-1',
          created_at: new Date().toISOString(),
          message_markdown: 'How are you doing today?',
          htv_score: {
            interdependence: 0.8,
            specificity: 0.8,
            parsimony: 0.8,
            falsifiability: 0.8,
            composite: 0.8,
          },
          audit_redaction: { summary: 'Wellness message' },
        },
      ],
    });

    const response = await postSupervise(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.decision).toBe('APPROVED');
    expect(body.reason_codes).toContain('approved_with_constraints');
  });

  test('e2e-002: Medication with low HTV → ROUTE_TO_CLINICIAN', async () => {
    const request = createBaseRequest({
      mode: 'advocate_clinical',
      idempotency_key: `idem-e2e-002-${Date.now()}`,
      request_timestamp: new Date().toISOString(),
      subject: {
        subject_id: 'patient-e2e',
        subject_type: 'patient',
        organization_id: '00000000-0000-0000-0000-000000000000',
      },
      proposals: [
        {
          kind: 'MEDICATION_ORDER_PROPOSAL',
          proposal_id: 'p-med-e2e',
          created_at: new Date().toISOString(),
          medication: { name: 'lisinopril' },
          change: { change_type: 'titrate' },
          clinician_protocol_ref: 'protocol://test/v1',
          htv_score: {
            interdependence: 0.3,
            specificity: 0.3,
            parsimony: 0.3,
            falsifiability: 0.3,
            composite: 0.3,
          },
          evidence_refs: [
            {
              evidence_id: 'ev-1',
              evidence_type: 'study',
              citation: 'Test RCT',
              evidence_grade: 'rct',
            },
          ],
          audit_redaction: { summary: 'Med proposal with low HTV' },
        },
      ],
    });

    const response = await postSupervise(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.decision).toBe('ROUTE_TO_CLINICIAN');
    expect(body.reason_codes).toContain('low_htv_score');
  });

  test('e2e-003: Stale snapshot (30h old) → REQUEST_MORE_INFO with data_quality_warning', async () => {
    const staleTime = new Date(Date.now() - 30 * 60 * 60 * 1000); // 30 hours ago

    const request = createBaseRequest({
      snapshot: {
        snapshot_id: 'snap-stale',
        created_at: staleTime.toISOString(),
        sources: ['ehr'],
      },
    });

    const response = await postSupervise(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.reason_codes).toContain('data_quality_warning');
  });

  test('e2e-004: Missing snapshot → HARD_STOP', async () => {
    const request = createBaseRequest({
      snapshot: undefined,
    });

    // Note: Elysia schema validation may catch missing snapshot.
    // If it does, we expect a 422 or 400.
    const response = await postSupervise(request);

    const body = await response.json();
    // Either schema validation rejects it or policy evaluator returns HARD_STOP
    if (response.status === 200) {
      expect(body.decision).toBe('HARD_STOP');
    } else {
      expect([400, 422]).toContain(response.status);
    }
  });

  test('e2e-005: Response is valid Hermes format', async () => {
    const request = createBaseRequest();

    const response = await postSupervise(request);
    expect(response.status).toBe(200);

    const body = await response.json();

    // Check required Hermes response fields
    expect(body.hermes_version).toBe('2.0.0');
    expect(body.message_type).toBe('supervision_response');
    expect(body.mode).toBe('wellness');
    expect(body.trace).toBeDefined();
    expect(body.trace.trace_id).toBeDefined();
    expect(body.trace.created_at).toBeDefined();
    expect(body.trace.producer).toBeDefined();
    expect(body.trace.producer.system).toBe('popper');
    expect(body.decision).toBeDefined();
    expect(['APPROVED', 'REQUEST_MORE_INFO', 'ROUTE_TO_CLINICIAN', 'HARD_STOP']).toContain(
      body.decision,
    );
    expect(body.reason_codes).toBeInstanceOf(Array);
    expect(body.explanation).toBeDefined();
    expect(body.response_timestamp).toBeDefined();
    expect(body.subject).toBeDefined();
    expect(body.audit_redaction).toBeDefined();
  });

  test('e2e-006: Audit event emitted with correct trace_id and decision', async () => {
    const traceId = `e2e-audit-${Date.now()}`;
    const request = createBaseRequest({
      trace: {
        trace_id: traceId,
        created_at: new Date().toISOString(),
        producer: { system: 'deutsch', service_version: '1.0.0' },
      },
    });

    const response = await postSupervise(request);
    expect(response.status).toBe(200);

    const body = await response.json();

    // Verify audit event
    const events = auditStorage.getEvents();
    const decisionEvent = events.find(
      (e) => e.eventType === 'SUPERVISION_DECISION' && e.traceId === traceId,
    );

    expect(decisionEvent).toBeDefined();
    expect(decisionEvent?.decision).toBe(body.decision);
    expect(decisionEvent?.latencyMs).toBeGreaterThan(0);
    expect(decisionEvent?.payload?.staleness).toBeDefined();
    expect(decisionEvent?.payload?.evaluation).toBeDefined();
  });

  test('e2e-007: Trace parent reference links request and response', async () => {
    const requestTraceId = `e2e-trace-${Date.now()}`;
    const request = createBaseRequest({
      trace: {
        trace_id: requestTraceId,
        created_at: new Date().toISOString(),
        producer: { system: 'deutsch', service_version: '1.0.0' },
      },
    });

    const response = await postSupervise(request);
    expect(response.status).toBe(200);

    const body = await response.json();

    // Response trace should reference the request trace as parent
    expect(body.trace.parent_span_id).toBe(requestTraceId);
  });
});
