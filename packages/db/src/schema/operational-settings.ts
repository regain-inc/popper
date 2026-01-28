/**
 * Operational Settings schema for versioned configuration management
 *
 * Regular PostgreSQL table (not hypertable - low volume, need random access by key).
 * Stores versioned settings for staleness thresholds, rate limits, and policy packs.
 * Supports both global (NULL organization_id) and per-organization settings.
 *
 * Version history is maintained by keeping all records - latest by effective_at wins.
 *
 * @module schema/operational-settings
 */

import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * Available settings keys
 */
export const SETTINGS_KEYS = [
  'staleness.wellness_hours',
  'staleness.clinical_hours',
  'rate_limit.per_minute',
  'rate_limit.per_hour',
  'policy_pack',
] as const;

export type SettingsKey = (typeof SETTINGS_KEYS)[number];

/**
 * Default values for settings
 */
export const SETTINGS_DEFAULTS: Record<SettingsKey, unknown> = {
  'staleness.wellness_hours': 24,
  'staleness.clinical_hours': 4,
  'rate_limit.per_minute': 1000,
  'rate_limit.per_hour': 50000,
  policy_pack: 'popper-default',
} as const;

/**
 * Operational Settings table
 *
 * Stores versioned configuration with full audit trail.
 * To get current value: SELECT WHERE org_id + key ORDER BY effective_at DESC LIMIT 1
 */
export const operationalSettings = pgTable(
  'operational_settings',
  {
    /** Unique identifier (UUID v4) */
    id: uuid('id').primaryKey().defaultRandom(),

    /** Organization ID (NULL = global default) */
    organizationId: text('organization_id'),

    /** Setting key from SETTINGS_KEYS */
    key: text('key').notNull(),

    /** Setting value (type depends on key) */
    value: jsonb('value').notNull(),

    /** When this setting becomes effective */
    effectiveAt: timestamp('effective_at', { withTimezone: true, mode: 'date' }).notNull(),

    /** Who made this change (user ID or system identifier) */
    createdBy: text('created_by').notNull(),

    /** Reason for the change */
    reason: text('reason'),

    /** When this record was created */
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    // Unique constraint for version lookup (org + key + effective_at)
    uniqueIndex('idx_settings_org_key_effective').on(
      table.organizationId,
      table.key,
      table.effectiveAt,
    ),

    // Fast lookup by organization
    index('idx_settings_organization_id').on(table.organizationId),

    // Fast lookup by key
    index('idx_settings_key').on(table.key),

    // History queries (ordered by effective_at)
    index('idx_settings_effective_at').on(table.effectiveAt),
  ],
);

export type OperationalSetting = typeof operationalSettings.$inferSelect;
export type NewOperationalSetting = typeof operationalSettings.$inferInsert;
