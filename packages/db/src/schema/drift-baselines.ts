import {
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
 * Drift baselines hypertable for monitoring signal thresholds
 *
 * TimescaleDB config (applied via SQL migration):
 * - partition_column: calculated_at
 * - chunk_interval: 1 week (lower volume)
 * - segment_by: organization_id
 * - order_by: signal_name, calculated_at DESC
 * - compression: after 7 days
 * - retention: 7 years
 */
export const driftBaselines = pgTable(
  'drift_baselines',
  {
    // Composite PK with partition column
    // Use SYSTEM_ORG_ID for global baselines
    organizationId: uuid('organization_id').notNull(),
    calculatedAt: timestamp('calculated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    signalName: text('signal_name').notNull(),

    // Baseline values
    baselineValue: doublePrecision('baseline_value').notNull(),
    warningThreshold: doublePrecision('warning_threshold').notNull(), // 2x baseline
    criticalThreshold: doublePrecision('critical_threshold').notNull(), // 5x baseline
    sampleCount: doublePrecision('sample_count').notNull(),

    // Metadata
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.calculatedAt, table.signalName] }),
    index('drift_baselines_signal_name_idx').on(table.signalName),
  ],
);

export type DriftBaseline = typeof driftBaselines.$inferSelect;
export type NewDriftBaseline = typeof driftBaselines.$inferInsert;
