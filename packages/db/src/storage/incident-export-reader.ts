/**
 * Drizzle-based incident export reader
 *
 * Implements IIncidentExportReader from @popper/core for production use.
 * Reads incidents for regulatory export bundle generation.
 *
 * @module storage/incident-export-reader
 */

import { and, asc, eq, gte, lte } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { incidents } from '../schema/incidents';

/**
 * DrizzleIncidentExportReader — Reads incidents for export bundles
 *
 * Queries the incidents table (regular PG table, not hypertable).
 * Uses indexes: incidents_org_id_idx, incidents_created_at_idx.
 */
export class DrizzleIncidentExportReader {
  constructor(private readonly db: PostgresJsDatabase) {}

  async getIncidentsForExport(
    organizationId: string,
    from: Date,
    to: Date,
  ): Promise<
    Array<{
      id: string;
      created_at: Date;
      type: string;
      status: string;
      trigger_signal?: string;
      title: string;
      description?: string;
      safe_mode_enabled?: Date;
      resolved_at?: Date;
      resolved_by?: string;
      resolution_notes?: string;
      metadata?: Record<string, unknown>;
    }>
  > {
    const rows = await this.db
      .select()
      .from(incidents)
      .where(
        and(
          eq(incidents.organizationId, organizationId),
          gte(incidents.createdAt, from),
          lte(incidents.createdAt, to),
        ),
      )
      .orderBy(asc(incidents.createdAt));

    return rows.map((row) => ({
      id: row.id,
      created_at: row.createdAt,
      type: row.type,
      status: row.status,
      trigger_signal: row.triggerSignal || undefined,
      title: row.title,
      description: row.description || undefined,
      safe_mode_enabled: row.safeModeEnabled || undefined,
      resolved_at: row.resolvedAt || undefined,
      resolved_by: row.resolvedBy || undefined,
      resolution_notes: row.resolutionNotes || undefined,
      metadata: (row.metadata as Record<string, unknown>) || undefined,
    }));
  }
}
