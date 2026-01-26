/**
 * Supervision API endpoint tests
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { policyRegistry } from '@popper/core';
import { Elysia } from 'elysia';
import { supervisionPlugin } from './supervision';

// =============================================================================
// Test Setup
// =============================================================================

let app: Elysia;

beforeAll(async () => {
  // Load policy packs for testing
  const policiesDir = resolve(process.cwd(), '../../config/policies');
  await policyRegistry.loadFromDir(policiesDir);

  // Create test app
  app = new Elysia().use(supervisionPlugin);
});

afterAll(() => {
  policyRegistry.clear();
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
          organization_id: 'org-456',
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
});
