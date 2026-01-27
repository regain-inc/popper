/**
 * Drizzle-based audit event storage for TimescaleDB
 *
 * Implements the AuditStorage interface from @popper/core
 * for production use with PostgreSQL/TimescaleDB.
 *
 * @module storage/audit-storage
 */

import type { DrizzleDB } from '../db';
import { auditEvents, type NewAuditEvent } from '../schema/audit-events';

/**
 * Stored audit event type matching the database schema
 */
export interface StoredAuditEvent {
  id: string;
  traceId: string;
  eventType: string;
  subjectId: string;
  organizationId: string;
  decision?: string;
  reasonCodes?: string[];
  policyPackVersion: string;
  safeModeActive?: boolean;
  latencyMs?: number;
  proposalCount?: number;
  payload?: Record<string, unknown>;
  tags?: string[];
  createdAt: Date;
}

/**
 * DrizzleAuditStorage - Production audit storage using Drizzle ORM
 *
 * Features:
 * - Batch inserts for efficiency
 * - Automatic UUID validation
 * - Works with TimescaleDB hypertables
 */
export class DrizzleAuditStorage {
  constructor(private readonly db: DrizzleDB) {}

  /**
   * Insert a single audit event
   */
  async insert(event: StoredAuditEvent): Promise<void> {
    const record = this.toRecord(event);
    await this.db.insert(auditEvents).values(record);
  }

  /**
   * Insert multiple audit events in a batch
   */
  async insertBatch(events: StoredAuditEvent[]): Promise<void> {
    if (events.length === 0) return;

    const records = events.map((e) => this.toRecord(e));
    await this.db.insert(auditEvents).values(records);
  }

  /**
   * Convert StoredAuditEvent to database record format
   */
  private toRecord(event: StoredAuditEvent): NewAuditEvent {
    return {
      id: event.id,
      traceId: event.traceId,
      eventType: event.eventType,
      subjectId: event.subjectId,
      organizationId: event.organizationId,
      decision: event.decision,
      reasonCodes: event.reasonCodes ?? [],
      policyPackVersion: event.policyPackVersion,
      safeModeActive: event.safeModeActive ?? false,
      latencyMs: event.latencyMs,
      proposalCount: event.proposalCount,
      payload: event.payload ?? {},
      tags: event.tags ?? [],
      createdAt: event.createdAt,
    };
  }
}
