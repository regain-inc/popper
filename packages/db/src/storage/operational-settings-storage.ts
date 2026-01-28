/**
 * Drizzle-based operational settings storage for PostgreSQL
 *
 * Implements the ISettingsStore interface from @popper/core
 * for production use with PostgreSQL.
 *
 * @module storage/operational-settings-storage
 */

import { and, desc, eq, isNull, lte } from 'drizzle-orm';
import type { DrizzleDB } from '../db';
import { operationalSettings, type SettingsKey } from '../schema/operational-settings';

/**
 * Operational setting record matching @popper/core interface
 */
export interface ApiOperationalSetting {
  id: string;
  organization_id: string | null;
  key: SettingsKey;
  value: unknown;
  effective_at: Date;
  created_by: string;
  reason: string | null;
  created_at: Date;
}

/**
 * DrizzleOperationalSettingsStorage - Production operational settings storage
 *
 * Implements ISettingsStore from @popper/core
 */
export class DrizzleOperationalSettingsStorage {
  constructor(private readonly db: DrizzleDB) {}

  /**
   * Get the latest effective setting for a key
   */
  async getLatest(
    organizationId: string | null,
    key: SettingsKey,
  ): Promise<ApiOperationalSetting | null> {
    const now = new Date();

    const condition =
      organizationId === null
        ? and(
            isNull(operationalSettings.organizationId),
            eq(operationalSettings.key, key),
            lte(operationalSettings.effectiveAt, now),
          )
        : and(
            eq(operationalSettings.organizationId, organizationId),
            eq(operationalSettings.key, key),
            lte(operationalSettings.effectiveAt, now),
          );

    const [row] = await this.db
      .select()
      .from(operationalSettings)
      .where(condition)
      .orderBy(desc(operationalSettings.effectiveAt))
      .limit(1);

    if (!row) {
      return null;
    }

    return this.toApiSetting(row);
  }

  /**
   * Get all latest effective settings for an organization
   */
  async getAllLatest(organizationId: string | null): Promise<ApiOperationalSetting[]> {
    const now = new Date();

    const condition =
      organizationId === null
        ? and(isNull(operationalSettings.organizationId), lte(operationalSettings.effectiveAt, now))
        : and(
            eq(operationalSettings.organizationId, organizationId),
            lte(operationalSettings.effectiveAt, now),
          );

    // Get all settings for org that are currently effective
    const rows = await this.db
      .select()
      .from(operationalSettings)
      .where(condition)
      .orderBy(desc(operationalSettings.effectiveAt));

    // Deduplicate by key, keeping only the latest
    const settingsByKey = new Map<string, (typeof rows)[0]>();
    for (const row of rows) {
      if (!settingsByKey.has(row.key)) {
        settingsByKey.set(row.key, row);
      }
    }

    return Array.from(settingsByKey.values()).map((row) => this.toApiSetting(row));
  }

  /**
   * Create a new setting record (append-only versioning)
   */
  async create(
    setting: Omit<ApiOperationalSetting, 'id' | 'created_at'>,
  ): Promise<ApiOperationalSetting> {
    const [inserted] = await this.db
      .insert(operationalSettings)
      .values({
        organizationId: setting.organization_id,
        key: setting.key,
        value: setting.value,
        effectiveAt: setting.effective_at,
        createdBy: setting.created_by,
        reason: setting.reason,
      })
      .returning();

    return this.toApiSetting(inserted);
  }

  /**
   * Get history of setting changes for a key
   */
  async getHistory(
    organizationId: string | null,
    key: SettingsKey,
    limit = 100,
  ): Promise<ApiOperationalSetting[]> {
    const condition =
      organizationId === null
        ? and(isNull(operationalSettings.organizationId), eq(operationalSettings.key, key))
        : and(
            eq(operationalSettings.organizationId, organizationId),
            eq(operationalSettings.key, key),
          );

    const rows = await this.db
      .select()
      .from(operationalSettings)
      .where(condition)
      .orderBy(desc(operationalSettings.effectiveAt))
      .limit(limit);

    return rows.map((row) => this.toApiSetting(row));
  }

  /**
   * Convert database row to API format
   */
  private toApiSetting(row: typeof operationalSettings.$inferSelect): ApiOperationalSetting {
    return {
      id: row.id,
      organization_id: row.organizationId,
      key: row.key as SettingsKey,
      value: row.value,
      effective_at: row.effectiveAt,
      created_by: row.createdBy,
      reason: row.reason,
      created_at: row.createdAt,
    };
  }
}
