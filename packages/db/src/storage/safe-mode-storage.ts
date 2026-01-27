/**
 * Drizzle-based safe-mode history storage for TimescaleDB
 *
 * Implements the ISafeModeHistoryStore interface from @popper/core
 * for production use with PostgreSQL/TimescaleDB.
 *
 * @module storage/safe-mode-storage
 */

import { desc, eq } from 'drizzle-orm';
import type { DrizzleDB } from '../db';
import { safeModeHistory } from '../schema/safe-mode-history';

/**
 * Safe-mode trigger type
 */
export type SafeModeTrigger = 'manual' | 'drift_breach' | 'incident';

/**
 * Safe-mode history entry matching @popper/core interface
 */
export interface SafeModeHistoryEntry {
  id: string;
  organization_id: string;
  enabled: boolean;
  reason: string;
  triggered_by: SafeModeTrigger;
  actor_id: string | null;
  incident_id: string | null;
  effective_at: Date;
  created_at: Date;
}

/**
 * DrizzleSafeModeHistoryStorage - Production safe-mode history storage
 *
 * Implements ISafeModeHistoryStore from @popper/core
 */
export class DrizzleSafeModeHistoryStorage {
  constructor(private readonly db: DrizzleDB) {}

  /**
   * Record a safe-mode state change
   */
  async record(
    entry: Omit<SafeModeHistoryEntry, 'id' | 'created_at'>,
  ): Promise<SafeModeHistoryEntry> {
    const [inserted] = await this.db
      .insert(safeModeHistory)
      .values({
        organizationId: entry.organization_id,
        enabled: entry.enabled,
        reason: entry.reason,
        triggeredBy: entry.triggered_by,
        actorId: entry.actor_id,
        incidentId: entry.incident_id,
        effectiveAt: entry.effective_at,
      })
      .returning();

    return {
      id: inserted.id,
      organization_id: inserted.organizationId,
      enabled: inserted.enabled,
      reason: inserted.reason,
      triggered_by: inserted.triggeredBy as SafeModeTrigger,
      actor_id: inserted.actorId,
      incident_id: inserted.incidentId,
      effective_at: inserted.effectiveAt,
      created_at: inserted.createdAt,
    };
  }

  /**
   * Get history for organization in reverse chronological order
   */
  async getHistory(organizationId: string, limit = 100): Promise<SafeModeHistoryEntry[]> {
    const rows = await this.db
      .select()
      .from(safeModeHistory)
      .where(eq(safeModeHistory.organizationId, organizationId))
      .orderBy(desc(safeModeHistory.createdAt))
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      organization_id: row.organizationId,
      enabled: row.enabled,
      reason: row.reason,
      triggered_by: row.triggeredBy as SafeModeTrigger,
      actor_id: row.actorId,
      incident_id: row.incidentId,
      effective_at: row.effectiveAt,
      created_at: row.createdAt,
    }));
  }
}
