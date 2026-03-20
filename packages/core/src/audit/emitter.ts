/**
 * AuditEmitter - Async audit event emission with batching
 *
 * Features:
 * - Non-blocking async writes (<3ms overhead)
 * - Batch insert optimization
 * - PHI redaction before storage
 * - Event correlation via trace_id
 *
 * @see docs/specs/02-popper-specs/01-popper-system-spec.md §7
 * @module audit/emitter
 */

import { randomUUID } from 'node:crypto';
import { redactPHI } from './redaction';
import type {
  AuditEmitterConfig,
  AuditEventInput,
  AuditEventPayload,
  AuditEventTag,
  StoredAuditEvent,
} from './types';
import { DEFAULT_AUDIT_EMITTER_CONFIG } from './types';

/**
 * Storage backend interface for audit events
 */
export interface AuditStorage {
  /**
   * Insert a single audit event
   */
  insert(event: StoredAuditEvent): Promise<void>;

  /**
   * Insert multiple audit events in a batch
   */
  insertBatch(events: StoredAuditEvent[]): Promise<void>;
}

/**
 * In-memory storage for testing and development
 */
export class InMemoryAuditStorage implements AuditStorage {
  private events: StoredAuditEvent[] = [];

  async insert(event: StoredAuditEvent): Promise<void> {
    this.events.push(event);
  }

  async insertBatch(events: StoredAuditEvent[]): Promise<void> {
    this.events.push(...events);
  }

  getEvents(): StoredAuditEvent[] {
    return [...this.events];
  }

  getEventsByTraceId(traceId: string): StoredAuditEvent[] {
    return this.events.filter((e) => e.traceId === traceId);
  }

  clear(): void {
    this.events = [];
  }
}

/**
 * AuditEmitter - Main class for emitting audit events
 *
 * Provides async, non-blocking event emission with optional batching.
 * All events are PHI-redacted before storage.
 */
export class AuditEmitter {
  private readonly config: Required<AuditEmitterConfig>;
  private readonly storage: AuditStorage;
  private batch: StoredAuditEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(storage: AuditStorage, config: AuditEmitterConfig = {}) {
    this.storage = storage;
    this.config = { ...DEFAULT_AUDIT_EMITTER_CONFIG, ...config };
  }

  /**
   * Emit a single audit event
   *
   * If async writes are enabled, this returns immediately and the write
   * happens in the background. If batching is enabled, the event is queued.
   *
   * @param event - The audit event to emit
   * @returns Promise that resolves when the event is queued (not necessarily written)
   */
  async emit(event: AuditEventInput): Promise<void> {
    const storedEvent = this.prepareEvent(event);

    if (this.config.batchEnabled) {
      this.addToBatch(storedEvent);
    } else if (this.config.asyncWrites) {
      // Fire and forget
      this.storage.insert(storedEvent).catch((err) => {
        console.error('[AuditEmitter] Failed to write event:', err);
      });
    } else {
      await this.storage.insert(storedEvent);
    }
  }

  /**
   * Emit multiple audit events at once
   *
   * @param events - Array of audit events to emit
   */
  async emitBatch(events: AuditEventInput[]): Promise<void> {
    const storedEvents = events.map((e) => this.prepareEvent(e));

    if (this.config.batchEnabled) {
      for (const event of storedEvents) {
        this.addToBatch(event);
      }
    } else if (this.config.asyncWrites) {
      this.storage.insertBatch(storedEvents).catch((err) => {
        console.error('[AuditEmitter] Failed to write batch:', err);
      });
    } else {
      await this.storage.insertBatch(storedEvents);
    }
  }

  /**
   * Force flush any pending batched events
   *
   * @returns Promise that resolves when all pending events are written
   */
  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.batch.length === 0) {
      return;
    }

    const eventsToFlush = this.batch;
    this.batch = [];

    try {
      await this.storage.insertBatch(eventsToFlush);
    } catch (err) {
      console.error('[AuditEmitter] Failed to flush batch:', err);
      throw err;
    }
  }

  /**
   * Get pending event count (for testing/monitoring)
   */
  getPendingCount(): number {
    return this.batch.length;
  }

  /**
   * Prepare an event for storage
   */
  private prepareEvent(event: AuditEventInput): StoredAuditEvent {
    // Redact any PHI from payload
    const redactedPayload = event.payload ? redactPHI(event.payload) : undefined;

    return {
      ...event,
      id: randomUUID(),
      createdAt: new Date(),
      payload: redactedPayload,
    };
  }

  /**
   * Add an event to the batch queue
   */
  private addToBatch(event: StoredAuditEvent): void {
    this.batch.push(event);

    // Check if batch is full
    if (this.batch.length >= this.config.batchSize) {
      this.triggerFlush();
      return;
    }

    // Start flush timer if not already running
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.triggerFlush();
      }, this.config.batchFlushInterval);
    }
  }

  /**
   * Trigger an async flush
   */
  private triggerFlush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // Don't block on flush - fire and forget
    this.flush().catch((err) => {
      console.error('[AuditEmitter] Background flush failed:', err);
    });
  }
}

/**
 * Create a supervision decision audit event
 */
export function createSupervisionDecisionEvent(params: {
  traceId: string;
  subjectId: string;
  organizationId: string;
  decision: AuditEventInput['decision'];
  reasonCodes: AuditEventInput['reasonCodes'];
  policyPackVersion: string;
  safeModeActive?: boolean;
  latencyMs?: number;
  proposalCount?: number;
  payload?: AuditEventPayload;
  tags?: AuditEventTag[];
  /** v2.1: Rule provenance for clinically grounded decision traceability */
  ruleProvenance?: AuditEventInput['ruleProvenance'];
}): AuditEventInput {
  return {
    eventType: 'SUPERVISION_DECISION',
    traceId: params.traceId,
    subjectId: params.subjectId,
    organizationId: params.organizationId,
    decision: params.decision,
    reasonCodes: params.reasonCodes,
    policyPackVersion: params.policyPackVersion,
    safeModeActive: params.safeModeActive ?? false,
    latencyMs: params.latencyMs,
    proposalCount: params.proposalCount,
    payload: params.payload,
    tags: params.tags,
    ruleProvenance: params.ruleProvenance,
  };
}

/**
 * Create a validation failed audit event
 */
export function createValidationFailedEvent(params: {
  traceId: string;
  subjectId: string;
  organizationId: string;
  errorMessage: string;
  errorCode?: string;
  policyPackVersion: string;
  tags?: AuditEventTag[];
}): AuditEventInput {
  return {
    eventType: 'VALIDATION_FAILED',
    traceId: params.traceId,
    subjectId: params.subjectId,
    organizationId: params.organizationId,
    decision: 'HARD_STOP',
    reasonCodes: ['schema_invalid'],
    policyPackVersion: params.policyPackVersion,
    payload: {
      error: {
        message: params.errorMessage,
        code: params.errorCode,
      },
    },
    tags: params.tags ?? ['schema_invalid'],
  };
}

/**
 * Create a policy lifecycle audit event
 *
 * @param params - Policy lifecycle event parameters
 * @returns AuditEventInput for emission
 */
export function createPolicyLifecycleEvent(params: {
  traceId?: string;
  eventType: string;
  policyPackId: string;
  policyId: string;
  version: string;
  organizationId: string | null;
  actor: string;
  previousState?: string;
  newState?: string;
  metadata?: Record<string, unknown>;
}): AuditEventInput {
  // Map policy lifecycle event types to audit tags
  const tagMap: Record<string, AuditEventTag> = {
    POLICY_CREATED: 'policy_created',
    POLICY_SUBMITTED_FOR_REVIEW: 'policy_submitted',
    POLICY_APPROVED: 'policy_approved',
    POLICY_REJECTED: 'policy_rejected',
    POLICY_ACTIVATED: 'policy_activated',
    POLICY_ARCHIVED: 'policy_archived',
    POLICY_ROLLBACK: 'policy_rollback',
  };

  return {
    eventType: 'POLICY_LIFECYCLE',
    traceId: params.traceId ?? crypto.randomUUID(),
    subjectId: 'system', // No patient subject for policy events
    organizationId: params.organizationId ?? 'global',
    policyPackVersion: params.version,
    payload: {
      policy_pack_id: params.policyPackId,
      policy_id: params.policyId,
      version: params.version,
      actor: params.actor,
      previous_state: params.previousState,
      new_state: params.newState,
      ...params.metadata,
    },
    tags: [tagMap[params.eventType] ?? 'policy_violation'],
  };
}

/**
 * Create an export bundle audit event
 *
 * Used to track export bundle generation and downloads for compliance.
 *
 * @param params - Export audit event parameters
 * @returns AuditEventInput for emission
 */
export function createExportAuditEvent(params: {
  traceId?: string;
  eventType: 'EXPORT_GENERATED' | 'EXPORT_DOWNLOADED' | 'EXPORT_ACCESSED';
  bundleId: string;
  organizationId: string;
  actor: string;
  actorKeyId?: string;
  actorIp?: string;
  bundleSize?: number;
  eventCount?: number;
  incidentCount?: number;
  timeWindow?: { from: string; to: string };
}): AuditEventInput {
  const tagMap: Record<string, AuditEventTag> = {
    EXPORT_GENERATED: 'export_generated',
    EXPORT_DOWNLOADED: 'export_downloaded',
    EXPORT_ACCESSED: 'export_accessed',
  };

  return {
    eventType: params.eventType,
    traceId: params.traceId ?? crypto.randomUUID(),
    subjectId: 'system', // No patient subject for export events
    organizationId: params.organizationId,
    policyPackVersion: 'N/A',
    payload: {
      bundle_id: params.bundleId,
      actor: params.actor,
      actor_key_id: params.actorKeyId,
      actor_ip: params.actorIp,
      bundle_size: params.bundleSize,
      event_count: params.eventCount,
      incident_count: params.incidentCount,
      time_window: params.timeWindow,
    },
    tags: [tagMap[params.eventType] ?? 'export_accessed'],
  };
}

// Default in-memory emitter for testing
let defaultEmitter: AuditEmitter | null = null;

/**
 * Get or create the default audit emitter (in-memory for dev/test)
 */
export function getDefaultEmitter(): AuditEmitter {
  if (!defaultEmitter) {
    defaultEmitter = new AuditEmitter(new InMemoryAuditStorage());
  }
  return defaultEmitter;
}

/**
 * Set the default audit emitter
 */
export function setDefaultEmitter(emitter: AuditEmitter): void {
  defaultEmitter = emitter;
}

/**
 * Create an AuditEmitter with custom storage
 */
export function createAuditEmitter(
  storage: AuditStorage,
  config?: AuditEmitterConfig,
): AuditEmitter {
  return new AuditEmitter(storage, config);
}
