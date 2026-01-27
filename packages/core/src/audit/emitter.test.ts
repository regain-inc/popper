/**
 * Tests for AuditEmitter
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import {
  AuditEmitter,
  createAuditEmitter,
  createSupervisionDecisionEvent,
  createValidationFailedEvent,
  getDefaultEmitter,
  InMemoryAuditStorage,
  setDefaultEmitter,
} from './emitter';
import type { AuditEventInput } from './types';

describe('AuditEmitter', () => {
  let storage: InMemoryAuditStorage;
  let emitter: AuditEmitter;

  beforeEach(() => {
    storage = new InMemoryAuditStorage();
    emitter = new AuditEmitter(storage, {
      batchEnabled: false,
      asyncWrites: false,
    });
  });

  describe('Basic Emission', () => {
    it('emits a single event', async () => {
      const event: AuditEventInput = {
        traceId: 'trace-123',
        eventType: 'SUPERVISION_DECISION',
        subjectId: 'subject-456',
        organizationId: 'org-789',
        decision: 'APPROVED',
        reasonCodes: [],
        policyPackVersion: '1.0.0',
      };

      await emitter.emit(event);

      const stored = storage.getEvents();
      expect(stored).toHaveLength(1);
      expect(stored[0].traceId).toBe('trace-123');
      expect(stored[0].eventType).toBe('SUPERVISION_DECISION');
      expect(stored[0].decision).toBe('APPROVED');
    });

    it('generates unique IDs for events', async () => {
      const event: AuditEventInput = {
        traceId: 'trace-123',
        eventType: 'SUPERVISION_DECISION',
        subjectId: 'subject-456',
        organizationId: 'org-789',
        policyPackVersion: '1.0.0',
      };

      await emitter.emit(event);
      await emitter.emit(event);

      const stored = storage.getEvents();
      expect(stored).toHaveLength(2);
      expect(stored[0].id).not.toBe(stored[1].id);
    });

    it('adds createdAt timestamp', async () => {
      const before = new Date();

      await emitter.emit({
        traceId: 'trace-123',
        eventType: 'SUPERVISION_DECISION',
        subjectId: 'subject-456',
        organizationId: 'org-789',
        policyPackVersion: '1.0.0',
      });

      const after = new Date();
      const stored = storage.getEvents()[0];

      expect(stored.createdAt).toBeDefined();
      expect(stored.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(stored.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('Batch Emission', () => {
    it('batches events until flush', async () => {
      const batchEmitter = new AuditEmitter(storage, {
        batchEnabled: true,
        batchSize: 10,
        batchFlushInterval: 10000,
        asyncWrites: false,
      });

      await batchEmitter.emit({
        traceId: 'trace-1',
        eventType: 'SUPERVISION_DECISION',
        subjectId: 'subject-1',
        organizationId: 'org-1',
        policyPackVersion: '1.0.0',
      });

      await batchEmitter.emit({
        traceId: 'trace-2',
        eventType: 'SUPERVISION_DECISION',
        subjectId: 'subject-2',
        organizationId: 'org-1',
        policyPackVersion: '1.0.0',
      });

      // Not flushed yet
      expect(storage.getEvents()).toHaveLength(0);
      expect(batchEmitter.getPendingCount()).toBe(2);

      // Flush
      await batchEmitter.flush();

      expect(storage.getEvents()).toHaveLength(2);
      expect(batchEmitter.getPendingCount()).toBe(0);
    });

    it('auto-flushes when batch size is reached', async () => {
      const batchEmitter = new AuditEmitter(storage, {
        batchEnabled: true,
        batchSize: 2,
        batchFlushInterval: 10000,
        asyncWrites: false,
      });

      await batchEmitter.emit({
        traceId: 'trace-1',
        eventType: 'SUPERVISION_DECISION',
        subjectId: 'subject-1',
        organizationId: 'org-1',
        policyPackVersion: '1.0.0',
      });

      expect(storage.getEvents()).toHaveLength(0);

      await batchEmitter.emit({
        traceId: 'trace-2',
        eventType: 'SUPERVISION_DECISION',
        subjectId: 'subject-2',
        organizationId: 'org-1',
        policyPackVersion: '1.0.0',
      });

      // Wait for async flush
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(storage.getEvents()).toHaveLength(2);
    });

    it('emitBatch adds all events to batch', async () => {
      const batchEmitter = new AuditEmitter(storage, {
        batchEnabled: true,
        batchSize: 100,
        asyncWrites: false,
      });

      await batchEmitter.emitBatch([
        {
          traceId: 'trace-1',
          eventType: 'SUPERVISION_DECISION',
          subjectId: 'subject-1',
          organizationId: 'org-1',
          policyPackVersion: '1.0.0',
        },
        {
          traceId: 'trace-2',
          eventType: 'VALIDATION_FAILED',
          subjectId: 'subject-2',
          organizationId: 'org-1',
          policyPackVersion: '1.0.0',
        },
      ]);

      expect(batchEmitter.getPendingCount()).toBe(2);
      await batchEmitter.flush();
      expect(storage.getEvents()).toHaveLength(2);
    });
  });

  describe('PHI Redaction', () => {
    it('redacts PHI fields from payload', async () => {
      await emitter.emit({
        traceId: 'trace-123',
        eventType: 'SUPERVISION_DECISION',
        subjectId: 'subject-456',
        organizationId: 'org-789',
        policyPackVersion: '1.0.0',
        payload: {
          mode: 'wellness',
          patient_name: 'John Doe',
          email: 'john@example.com',
          proposal_count: 2,
        },
      });

      const stored = storage.getEvents()[0];
      expect(stored.payload?.mode).toBe('wellness');
      expect(stored.payload?.proposal_count).toBe(2);
      expect(stored.payload?.patient_name).toBe('[REDACTED]');
      expect(stored.payload?.email).toBe('[REDACTED]');
    });

    it('redacts nested PHI fields', async () => {
      await emitter.emit({
        traceId: 'trace-123',
        eventType: 'SUPERVISION_DECISION',
        subjectId: 'subject-456',
        organizationId: 'org-789',
        policyPackVersion: '1.0.0',
        payload: {
          mode: 'wellness',
          subject: {
            subject_id: 'sub-123',
            patient_name: 'Jane Doe',
          },
        },
      });

      const stored = storage.getEvents()[0];
      const subject = stored.payload?.subject as Record<string, unknown>;
      expect(subject.subject_id).toBe('sub-123');
      expect(subject.patient_name).toBe('[REDACTED]');
    });
  });

  describe('Event Correlation', () => {
    it('events are joinable by trace_id', async () => {
      const traceId = 'trace-shared-123';

      await emitter.emit({
        traceId,
        eventType: 'SUPERVISION_DECISION',
        subjectId: 'subject-1',
        organizationId: 'org-1',
        policyPackVersion: '1.0.0',
      });

      await emitter.emit({
        traceId,
        eventType: 'VALIDATION_FAILED',
        subjectId: 'subject-1',
        organizationId: 'org-1',
        policyPackVersion: '1.0.0',
      });

      await emitter.emit({
        traceId: 'trace-other',
        eventType: 'SUPERVISION_DECISION',
        subjectId: 'subject-2',
        organizationId: 'org-1',
        policyPackVersion: '1.0.0',
      });

      const relatedEvents = storage.getEventsByTraceId(traceId);
      expect(relatedEvents).toHaveLength(2);
      expect(relatedEvents.every((e) => e.traceId === traceId)).toBe(true);
    });
  });
});

describe('Event Factory Functions', () => {
  describe('createSupervisionDecisionEvent', () => {
    it('creates a complete supervision decision event', () => {
      const event = createSupervisionDecisionEvent({
        traceId: 'trace-123',
        subjectId: 'subject-456',
        organizationId: 'org-789',
        decision: 'APPROVED',
        reasonCodes: ['policy_approved'],
        policyPackVersion: '1.0.0',
        safeModeActive: false,
        latencyMs: 15.5,
        proposalCount: 2,
        tags: ['low_risk'],
      });

      expect(event.eventType).toBe('SUPERVISION_DECISION');
      expect(event.traceId).toBe('trace-123');
      expect(event.decision).toBe('APPROVED');
      expect(event.reasonCodes).toEqual(['policy_approved']);
      expect(event.latencyMs).toBe(15.5);
      expect(event.proposalCount).toBe(2);
      expect(event.tags).toContain('low_risk');
    });

    it('defaults safeModeActive to false', () => {
      const event = createSupervisionDecisionEvent({
        traceId: 'trace-123',
        subjectId: 'subject-456',
        organizationId: 'org-789',
        decision: 'APPROVED',
        reasonCodes: [],
        policyPackVersion: '1.0.0',
      });

      expect(event.safeModeActive).toBe(false);
    });
  });

  describe('createValidationFailedEvent', () => {
    it('creates a validation failed event', () => {
      const event = createValidationFailedEvent({
        traceId: 'trace-123',
        subjectId: 'subject-456',
        organizationId: 'org-789',
        errorMessage: 'Invalid schema',
        errorCode: 'SCHEMA_INVALID',
        policyPackVersion: '1.0.0',
        tags: ['schema_invalid', 'clock_skew_rejected'],
      });

      expect(event.eventType).toBe('VALIDATION_FAILED');
      expect(event.decision).toBe('HARD_STOP');
      expect(event.reasonCodes).toContain('schema_invalid');
      expect(event.payload?.error).toBeDefined();
      expect((event.payload?.error as { message: string }).message).toBe('Invalid schema');
      expect((event.payload?.error as { code: string }).code).toBe('SCHEMA_INVALID');
    });

    it('defaults tags to schema_invalid', () => {
      const event = createValidationFailedEvent({
        traceId: 'trace-123',
        subjectId: 'subject-456',
        organizationId: 'org-789',
        errorMessage: 'Error',
        policyPackVersion: '1.0.0',
      });

      expect(event.tags).toContain('schema_invalid');
    });
  });
});

describe('InMemoryAuditStorage', () => {
  it('stores and retrieves events', async () => {
    const storage = new InMemoryAuditStorage();

    await storage.insert({
      id: 'id-1',
      createdAt: new Date(),
      traceId: 'trace-1',
      eventType: 'SUPERVISION_DECISION',
      subjectId: 'subject-1',
      organizationId: 'org-1',
      policyPackVersion: '1.0.0',
    });

    const events = storage.getEvents();
    expect(events).toHaveLength(1);
  });

  it('clears all events', async () => {
    const storage = new InMemoryAuditStorage();

    await storage.insert({
      id: 'id-1',
      createdAt: new Date(),
      traceId: 'trace-1',
      eventType: 'SUPERVISION_DECISION',
      subjectId: 'subject-1',
      organizationId: 'org-1',
      policyPackVersion: '1.0.0',
    });

    storage.clear();
    expect(storage.getEvents()).toHaveLength(0);
  });
});

describe('Factory Functions', () => {
  it('createAuditEmitter creates emitter with config', () => {
    const storage = new InMemoryAuditStorage();
    const emitter = createAuditEmitter(storage, { batchSize: 50 });

    expect(emitter).toBeInstanceOf(AuditEmitter);
  });

  it('getDefaultEmitter returns singleton', () => {
    const emitter1 = getDefaultEmitter();
    const emitter2 = getDefaultEmitter();

    expect(emitter1).toBe(emitter2);
  });

  it('setDefaultEmitter replaces singleton', () => {
    const storage = new InMemoryAuditStorage();
    const customEmitter = new AuditEmitter(storage);

    setDefaultEmitter(customEmitter);

    expect(getDefaultEmitter()).toBe(customEmitter);
  });
});
