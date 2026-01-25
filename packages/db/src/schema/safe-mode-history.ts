import { boolean, index, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Safe mode history hypertable for audit trail
 *
 * TimescaleDB config (applied via SQL migration):
 * - partition_column: created_at
 * - chunk_interval: 1 week (lower volume)
 * - segment_by: organization_id
 * - order_by: created_at DESC
 * - compression: after 7 days
 * - retention: 7 years
 */
export const safeModeHistory = pgTable(
  'safe_mode_history',
  {
    // Composite PK with partition column
    // Use SYSTEM_ORG_ID for global safe mode
    organizationId: uuid('organization_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    id: uuid('id').notNull().defaultRandom(),

    // Safe mode state
    enabled: boolean('enabled').notNull(),
    reason: text('reason').notNull(),
    triggeredBy: text('triggered_by').notNull(), // 'manual', 'drift_breach', 'incident'

    // Actor info
    actorId: uuid('actor_id'), // user who triggered (null if automatic)
    incidentId: uuid('incident_id'), // linked incident if any

    // Effective time (when safe mode actually takes effect)
    effectiveAt: timestamp('effective_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.createdAt, table.id] }),
    index('safe_mode_history_triggered_by_idx').on(table.triggeredBy),
    index('safe_mode_history_effective_at_idx').on(table.effectiveAt),
  ],
);

export type SafeModeHistoryEntry = typeof safeModeHistory.$inferSelect;
export type NewSafeModeHistoryEntry = typeof safeModeHistory.$inferInsert;
