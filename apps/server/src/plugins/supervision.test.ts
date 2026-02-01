/**
 * Supervision API endpoint tests
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

/** System org ID used by dev-mode auth (must match supervision.ts) */
const SYSTEM_ORG_ID = '00000000-0000-0000-0000-000000000000';

// =============================================================================
// Test Setup
// =============================================================================

let app: Elysia;
let auditStorage: InMemoryAuditStorage;

beforeAll(async () => {
  // Load policy packs for testing
  // Use import.meta.dir for path relative to this file, not cwd
  const policiesDir = resolve(import.meta.dir, '../../../../config/policies');
  await policyRegistry.loadFromDir(policiesDir);

  // Create test app
  app = new Elysia().use(supervisionPlugin);
});

afterAll(() => {
  policyRegistry.clear();
});

// Setup in-memory audit storage for tests
auditStorage = new InMemoryAuditStorage();
const testEmitter = new AuditEmitter(auditStorage, { batchEnabled: false, asyncWrites: false });
setDefaultEmitter(testEmitter);

// Setup in-memory idempotency cache for tests
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
// Test Helpers
// =============================================================================

const createValidRequest = (overrides: Record<string, unknown> = {}) => ({
  hermes_version: '1.6.0',
  message_type: 'supervision_request',
  mode: 'wellness',
  trace: {
    trace_id: `test-${Date.now()}`,
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
      proposal_id: 'p1',
      created_at: new Date().toISOString(),
      message_markdown: 'Hello, how are you feeling today?',
      audit_redaction: {
        summary: 'Patient greeting message',
      },
    },
  ],
  audit_redaction: {
    summary: 'Test supervision request',
    proposal_summaries: ['Patient message'],
  },
  ...overrides,
});

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
// Tests
// =============================================================================

describe('POST /v1/popper/supervise', () => {
  describe('Valid Requests', () => {
    test('returns supervision response for valid wellness request', async () => {
      const request = createValidRequest();
      const response = await postSupervise(request);

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.hermes_version).toBe('1.6.0');
      expect(body.message_type).toBe('supervision_response');
      expect(body.mode).toBe('wellness');
      expect(body.decision).toBeDefined();
      expect(['APPROVED', 'REQUEST_MORE_INFO', 'ROUTE_TO_CLINICIAN', 'HARD_STOP']).toContain(
        body.decision,
      );
      expect(body.reason_codes).toBeInstanceOf(Array);
      expect(body.explanation).toBeDefined();
    });

    test('includes trace context with parent reference', async () => {
      const request = createValidRequest({
        trace: { ...createValidRequest().trace, trace_id: 'parent-req-123' },
      });
      const response = await postSupervise(request);

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.trace.parent_span_id).toBe('parent-req-123');
      expect(body.trace.producer.system).toBe('popper');
    });

    test('includes response timestamp', async () => {
      const before = new Date();
      const response = await postSupervise(createValidRequest());
      const after = new Date();

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.response_timestamp).toBeDefined();

      const responseTime = new Date(body.response_timestamp);
      expect(responseTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(responseTime.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    test('handles advocate_clinical mode with required fields', async () => {
      const baseRequest = createValidRequest();
      const request = {
        ...baseRequest,
        mode: 'advocate_clinical',
        idempotency_key: 'idem-123',
        request_timestamp: new Date().toISOString(),
        subject: {
          subject_id: 'patient-123',
          subject_type: 'patient',
          organization_id: SYSTEM_ORG_ID,
        },
      };

      const response = await postSupervise(request);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.mode).toBe('advocate_clinical');
    });
  });

  describe('Schema Validation', () => {
    test('returns 422 for missing required fields', async () => {
      const request = {
        hermes_version: '1.6.0',
        message_type: 'supervision_request',
        // Missing mode, trace, subject, etc.
      };

      const response = await postSupervise(request);
      expect(response.status).toBe(422); // Elysia uses 422 for validation errors
    });

    test('returns 422 for invalid message_type', async () => {
      const request = createValidRequest({ message_type: 'invalid_type' });
      const response = await postSupervise(request);

      expect(response.status).toBe(422); // Elysia uses 422 for validation errors
    });

    test('returns 422 for invalid mode', async () => {
      const request = createValidRequest({ mode: 'invalid_mode' });
      const response = await postSupervise(request);

      expect(response.status).toBe(422); // Elysia uses 422 for validation errors
    });
  });

  describe('Clock Skew Validation', () => {
    test('rejects advocate_clinical request without idempotency_key', async () => {
      const request = createValidRequest({
        mode: 'advocate_clinical',
        request_timestamp: new Date().toISOString(),
        // Missing idempotency_key
      });

      const response = await postSupervise(request);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.decision).toBe('HARD_STOP');
      expect(body.explanation).toContain('idempotency_key');
    });

    test('rejects request with excessive clock skew', async () => {
      const pastTime = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago

      const request = createValidRequest({
        mode: 'advocate_clinical',
        idempotency_key: 'idem-123',
        request_timestamp: pastTime.toISOString(),
      });

      const response = await postSupervise(request);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.decision).toBe('HARD_STOP');
      expect(body.explanation).toContain('Clock skew');
    });

    test('accepts request within clock skew tolerance', async () => {
      const slightlyPast = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago

      const request = createValidRequest({
        mode: 'advocate_clinical',
        idempotency_key: 'idem-123',
        request_timestamp: slightlyPast.toISOString(),
        subject: {
          subject_id: 'patient-123',
          subject_type: 'patient',
          organization_id: SYSTEM_ORG_ID,
        },
      });

      const response = await postSupervise(request);
      expect(response.status).toBe(200);
    });
  });

  describe('Staleness Handling', () => {
    test('handles stale snapshot appropriately', async () => {
      const staleTime = new Date(Date.now() - 30 * 60 * 60 * 1000); // 30 hours ago

      const request = createValidRequest({
        snapshot: {
          snapshot_id: 'snap-stale',
          created_at: staleTime.toISOString(),
          sources: ['ehr'],
        },
      });

      const response = await postSupervise(request);
      expect(response.status).toBe(200);

      const body = await response.json();
      // Stale snapshot should trigger data_quality_warning
      expect(body.reason_codes).toContain('data_quality_warning');
    });
  });

  describe('Response Format', () => {
    test('includes audit_redaction in response', async () => {
      const response = await postSupervise(createValidRequest());
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.audit_redaction).toBeDefined();
      expect(body.audit_redaction.decision).toBeDefined();
      expect(body.audit_redaction.reason_codes).toBeInstanceOf(Array);
    });

    test('includes subject and snapshot from request', async () => {
      const request = createValidRequest({
        subject: {
          subject_id: 'patient-xyz',
          subject_type: 'patient',
        },
        snapshot: {
          snapshot_id: 'snap-abc',
          created_at: new Date().toISOString(),
          sources: ['ehr'],
        },
      });

      const response = await postSupervise(request);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.subject.subject_id).toBe('patient-xyz');
      expect(body.snapshot.snapshot_id).toBe('snap-abc');
    });
  });

  describe('Audit Event Emission', () => {
    test('emits SUPERVISION_DECISION event for valid request', async () => {
      const request = createValidRequest({
        trace: {
          trace_id: 'audit-test-123',
          created_at: new Date().toISOString(),
          producer: { system: 'deutsch', service_version: '1.0.0' },
        },
        subject: {
          subject_id: 'patient-audit',
          subject_type: 'patient',
          organization_id: SYSTEM_ORG_ID,
        },
      });

      const response = await postSupervise(request);
      expect(response.status).toBe(200);

      const events = auditStorage.getEvents();
      expect(events.length).toBeGreaterThanOrEqual(1);

      const decisionEvent = events.find((e) => e.eventType === 'SUPERVISION_DECISION');
      expect(decisionEvent).toBeDefined();
      expect(decisionEvent?.traceId).toBe('audit-test-123');
      expect(decisionEvent?.subjectId).toBe('patient-audit');
      expect(decisionEvent?.organizationId).toBe(SYSTEM_ORG_ID);
      expect(decisionEvent?.decision).toBeDefined();
    });

    test('emits VALIDATION_FAILED event for clock skew rejection', async () => {
      const pastTime = new Date(Date.now() - 10 * 60 * 1000);

      const request = createValidRequest({
        mode: 'advocate_clinical',
        idempotency_key: 'idem-audit',
        request_timestamp: pastTime.toISOString(),
        trace: {
          trace_id: 'audit-clock-skew-123',
          created_at: new Date().toISOString(),
          producer: { system: 'deutsch', service_version: '1.0.0' },
        },
      });

      const response = await postSupervise(request);
      expect(response.status).toBe(400);

      const events = auditStorage.getEvents();
      const failedEvent = events.find((e) => e.eventType === 'VALIDATION_FAILED');
      expect(failedEvent).toBeDefined();
      expect(failedEvent?.traceId).toBe('audit-clock-skew-123');
      expect(failedEvent?.tags).toContain('clock_skew_rejected');
    });

    test('audit event includes latency metrics', async () => {
      const response = await postSupervise(createValidRequest());
      expect(response.status).toBe(200);

      const events = auditStorage.getEvents();
      const decisionEvent = events.find((e) => e.eventType === 'SUPERVISION_DECISION');
      expect(decisionEvent?.latencyMs).toBeDefined();
      expect(decisionEvent?.latencyMs).toBeGreaterThan(0);
    });

    test('audit event includes staleness info in payload', async () => {
      const response = await postSupervise(createValidRequest());
      expect(response.status).toBe(200);

      const events = auditStorage.getEvents();
      const decisionEvent = events.find((e) => e.eventType === 'SUPERVISION_DECISION');
      expect(decisionEvent?.payload?.staleness).toBeDefined();
    });

    test('events are joinable by trace_id', async () => {
      const traceId = 'shared-trace-123';

      // First request
      await postSupervise(
        createValidRequest({
          trace: {
            trace_id: traceId,
            created_at: new Date().toISOString(),
            producer: { system: 'deutsch', service_version: '1.0.0' },
          },
        }),
      );

      // Second request with same trace_id
      await postSupervise(
        createValidRequest({
          trace: {
            trace_id: traceId,
            created_at: new Date().toISOString(),
            producer: { system: 'deutsch', service_version: '1.0.0' },
          },
        }),
      );

      const relatedEvents = auditStorage.getEventsByTraceId(traceId);
      expect(relatedEvents.length).toBe(2);
      expect(relatedEvents.every((e) => e.traceId === traceId)).toBe(true);
    });
  });

  describe('Idempotency Cache', () => {
    const createClinicalRequest = (
      idempotencyKey: string,
      overrides: Record<string, unknown> = {},
    ) => ({
      ...createValidRequest(),
      mode: 'advocate_clinical',
      idempotency_key: idempotencyKey,
      request_timestamp: new Date().toISOString(),
      subject: {
        subject_id: 'patient-123',
        subject_type: 'patient',
        organization_id: SYSTEM_ORG_ID,
      },
      ...overrides,
    });

    test('returns cached response for identical request', async () => {
      const request = createClinicalRequest('idem-001');

      // First request
      const response1 = await postSupervise(request);
      expect(response1.status).toBe(200);
      const body1 = await response1.json();

      // Second identical request (different timestamp is ignored in hash)
      const request2 = {
        ...request,
        request_timestamp: new Date().toISOString(),
      };
      const response2 = await postSupervise(request2);
      expect(response2.status).toBe(200);
      const body2 = await response2.json();

      // Responses should be identical
      expect(body2.decision).toBe(body1.decision);
      expect(body2.trace.span_id).toBe(body1.trace.span_id); // Same cached response
    });

    test('returns HARD_STOP for replay with different payload', async () => {
      const idempotencyKey = 'idem-replay-001';

      // First request
      const request1 = createClinicalRequest(idempotencyKey, {
        proposals: [
          {
            kind: 'PATIENT_MESSAGE',
            proposal_id: 'p1',
            created_at: new Date().toISOString(),
            message_markdown: 'Original message',
            audit_redaction: { summary: 'Message 1' },
          },
        ],
      });
      const response1 = await postSupervise(request1);
      expect(response1.status).toBe(200);

      // Second request with same idempotency_key but different payload
      const request2 = createClinicalRequest(idempotencyKey, {
        proposals: [
          {
            kind: 'PATIENT_MESSAGE',
            proposal_id: 'p2',
            created_at: new Date().toISOString(),
            message_markdown: 'Different message - potential replay attack',
            audit_redaction: { summary: 'Message 2' },
          },
        ],
      });
      const response2 = await postSupervise(request2);
      expect(response2.status).toBe(400);

      const body2 = await response2.json();
      expect(body2.decision).toBe('HARD_STOP');
      expect(body2.reason_codes).toContain('policy_violation');
      expect(body2.explanation).toContain('Replay');
    });

    test('emits VALIDATION_FAILED event for replay detection', async () => {
      const idempotencyKey = 'idem-replay-audit';

      // First request
      await postSupervise(
        createClinicalRequest(idempotencyKey, {
          trace: {
            trace_id: 'trace-replay-1',
            created_at: new Date().toISOString(),
            producer: { system: 'deutsch', service_version: '1.0.0' },
          },
        }),
      );

      // Different payload with same key
      await postSupervise(
        createClinicalRequest(idempotencyKey, {
          trace: {
            trace_id: 'trace-replay-2',
            created_at: new Date().toISOString(),
            producer: { system: 'deutsch', service_version: '1.0.0' },
          },
          proposals: [
            {
              kind: 'LIFESTYLE_RECOMMENDATION',
              proposal_id: 'different',
              created_at: new Date().toISOString(),
              recommendation_markdown: 'Different proposal',
              audit_redaction: { summary: 'Different' },
            },
          ],
        }),
      );

      const events = auditStorage.getEvents();
      const replayEvent = events.find(
        (e) => e.eventType === 'VALIDATION_FAILED' && e.tags?.includes('replay_suspected'),
      );
      expect(replayEvent).toBeDefined();
    });

    test('different idempotency keys are independent', async () => {
      // Two requests with different idempotency keys should both succeed
      const request1 = createClinicalRequest('idem-key-1', {
        subject: {
          subject_id: 'patient-1',
          subject_type: 'patient',
          organization_id: SYSTEM_ORG_ID,
        },
      });
      const response1 = await postSupervise(request1);
      expect(response1.status).toBe(200);

      // Different idempotency_key should not get cached response
      const request2 = createClinicalRequest('idem-key-2', {
        subject: {
          subject_id: 'patient-2',
          subject_type: 'patient',
          organization_id: SYSTEM_ORG_ID,
        },
      });
      const response2 = await postSupervise(request2);
      expect(response2.status).toBe(200);

      // Should have two separate audit events (not replay)
      const events = auditStorage.getEvents();
      const decisionEvents = events.filter((e) => e.eventType === 'SUPERVISION_DECISION');
      expect(decisionEvents.length).toBe(2);
    });

    test('idempotency not applied in wellness mode', async () => {
      // Wellness mode doesn't require idempotency_key
      const request1 = createValidRequest({
        trace: {
          trace_id: 'wellness-1',
          created_at: new Date().toISOString(),
          producer: { system: 'deutsch', service_version: '1.0.0' },
        },
      });
      const response1 = await postSupervise(request1);
      expect(response1.status).toBe(200);

      // Same request again - should process normally (no caching)
      const request2 = createValidRequest({
        trace: {
          trace_id: 'wellness-2',
          created_at: new Date().toISOString(),
          producer: { system: 'deutsch', service_version: '1.0.0' },
        },
      });
      const response2 = await postSupervise(request2);
      expect(response2.status).toBe(200);

      // Both should generate separate events
      const events = auditStorage.getEvents();
      const decisionEvents = events.filter((e) => e.eventType === 'SUPERVISION_DECISION');
      expect(decisionEvents.length).toBe(2);
    });
  });
});
