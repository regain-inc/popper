import {
  boolean,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Audit events hypertable for supervision decisions
 *
 * TimescaleDB config (applied via SQL migration):
 * - partition_column: created_at
 * - chunk_interval: 1 day (high write volume)
 * - segment_by: organization_id (common filter, >100 rows per chunk expected)
 * - order_by: created_at DESC
 * - compression: after 7 days
 * - retention: 7 years
 */
export const auditEvents = pgTable(
  'audit_events',
  {
    // Composite PK: partition column (created_at) must be in PK
    // Use SYSTEM_ORG_ID for system-level events
    organizationId: uuid('organization_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),

    // Event identification
    id: uuid('id').notNull().defaultRandom(),
    traceId: uuid('trace_id').notNull(),

    // Event data
    eventType: text('event_type').notNull(), // SUPERVISION_DECISION, VALIDATION_FAILED, SAFE_MODE_CHANGED
    subjectId: uuid('subject_id').notNull(),
    decision: text('decision'), // APPROVED, HARD_STOP, ROUTE_TO_CLINICIAN, REQUEST_MORE_INFO
    reasonCodes: jsonb('reason_codes').$type<string[]>().default([]),

    // Context
    policyPackVersion: text('policy_pack_version').notNull(),
    safeModeActive: boolean('safe_mode_active').notNull().default(false),

    // Metrics for drift monitoring
    latencyMs: doublePrecision('latency_ms'),
    proposalCount: doublePrecision('proposal_count'),

    // Flexible data
    payload: jsonb('payload').$type<Record<string, unknown>>().default({}),
    tags: jsonb('tags').$type<string[]>().default([]),
  },
  (table) => [
    // Composite primary key with partition column
    primaryKey({ columns: [table.organizationId, table.createdAt, table.id] }),

    // Indexes for common queries
    index('audit_events_trace_id_idx').on(table.traceId),
    index('audit_events_subject_id_idx').on(table.subjectId),
    index('audit_events_event_type_idx').on(table.eventType),
    index('audit_events_decision_idx').on(table.decision),
  ],
);

export type AuditEvent = typeof auditEvents.$inferSelect;
export type NewAuditEvent = typeof auditEvents.$inferInsert;
