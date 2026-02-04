/**
 * Drizzle-based audit event export reader
 *
 * Implements IAuditEventExportReader from @popper/core for production use.
 * Reads individual audit events from the raw audit_events hypertable
 * for regulatory export bundle generation.
 *
 * Performance: chunk exclusion via created_at (partition column) +
 * segment exclusion via organization_id (segment_by column).
 *
 * @module storage/audit-event-export-reader
 */

import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import type { DrizzleDB } from '../db';
import { auditEvents } from '../schema/audit-events';

/**
 * DrizzleAuditEventExportReader — Reads audit events for export bundles
 *
 * Queries the raw audit_events hypertable because export bundles
 * need individual events (not aggregates).
 */
export class DrizzleAuditEventExportReader {
  constructor(private readonly db: DrizzleDB) {}

  async getEventsForExport(
    organizationId: string,
    from: Date,
    to: Date,
    traceIds?: string[],
  ): Promise<
    Array<{
      event_id: string;
      event_type: string;
      timestamp: Date;
      trace_id: string;
      organization_id: string;
      subject_id?: string;
      decision?: string;
      reason_codes?: string[];
      mode?: string;
      validation_result?: { is_valid: boolean; issues?: string[] };
      safe_mode?: { enabled: boolean; reason?: string };
      metadata?: Record<string, unknown>;
    }>
  > {
    const conditions = [
      eq(auditEvents.organizationId, organizationId),
      gte(auditEvents.createdAt, from),
      lte(auditEvents.createdAt, to),
    ];

    if (traceIds && traceIds.length > 0) {
      conditions.push(inArray(auditEvents.traceId, traceIds));
    }

    const rows = await this.db
      .select()
      .from(auditEvents)
      .where(and(...conditions))
      .orderBy(asc(auditEvents.createdAt))
      .limit(100_000);

    return rows.map((row) => {
      const payload = (row.payload ?? {}) as Record<string, unknown>;
      const reasonCodes = row.reasonCodes as string[] | null;

      return {
        event_id: row.id,
        event_type: row.eventType,
        timestamp: row.createdAt,
        trace_id: row.traceId,
        organization_id: row.organizationId,
        subject_id: row.subjectId || undefined,
        decision: row.decision || undefined,
        reason_codes: reasonCodes && reasonCodes.length > 0 ? reasonCodes : undefined,
        mode: (payload.mode as string) || undefined,
        validation_result: payload.validation_result
          ? (payload.validation_result as { is_valid: boolean; issues?: string[] })
          : undefined,
        safe_mode: row.safeModeActive
          ? {
              enabled: row.safeModeActive,
              reason: (payload.safe_mode_reason as string) || undefined,
            }
          : undefined,
        metadata: Object.keys(payload).length > 0 ? payload : undefined,
      };
    });
  }
}
