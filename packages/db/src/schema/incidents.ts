import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Incidents table for drift-triggered safety incidents
 *
 * Records created when automatic safe-mode triggers fire.
 * Regular PostgreSQL table (not hypertable - low volume, need fast access by ID).
 *
 * @see docs/specs/02-popper-specs/01-popper-system-spec.md §6.2
 */
export const incidents = pgTable(
  'incidents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),

    // Incident type and status
    type: text('type').notNull(), // 'drift_threshold_breach', 'manual', 'model_update'
    status: text('status').notNull().default('open'), // 'open', 'acknowledged', 'resolved'

    // Trigger details
    triggerSignal: text('trigger_signal'), // e.g., 'validation_failure_rate', 'hard_stop_rate'
    triggerLevel: text('trigger_level'), // 'warning' or 'critical'
    triggerValue: text('trigger_value'), // actual value that triggered
    thresholdValue: text('threshold_value'), // threshold that was exceeded
    baselineValue: text('baseline_value'), // baseline value for context

    // Description and context
    title: text('title').notNull(),
    description: text('description'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),

    // Actions taken
    safeModeEnabled: timestamp('safe_mode_enabled', { withTimezone: true, mode: 'date' }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'date' }),
    resolvedBy: uuid('resolved_by'),
    resolutionNotes: text('resolution_notes'),

    // Cooldown tracking
    cooldownUntil: timestamp('cooldown_until', { withTimezone: true, mode: 'date' }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('incidents_org_id_idx').on(table.organizationId),
    index('incidents_status_idx').on(table.status),
    index('incidents_type_idx').on(table.type),
    index('incidents_created_at_idx').on(table.createdAt),
  ],
);

export type Incident = typeof incidents.$inferSelect;
export type NewIncident = typeof incidents.$inferInsert;
