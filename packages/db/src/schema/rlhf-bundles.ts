import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * RLHF Feedback Bundles table
 *
 * Stores de-identified feedback bundles for RLHF loop closure.
 * Regular PostgreSQL table (not hypertable - low volume, need fast access by ID).
 *
 * Per spec §5.9.6: Bundles MUST NOT contain PHI (no subject_id, only aggregate counts).
 *
 * @see docs/specs/02-popper-specs/01-popper-system-spec.md §5.9.6
 */
export const rlhfBundles = pgTable(
  'rlhf_bundles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id'), // NULL for global bundles

    // Period covered by this bundle
    periodStart: timestamp('period_start', { withTimezone: true, mode: 'date' }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true, mode: 'date' }).notNull(),

    // When bundle was generated
    generatedAt: timestamp('generated_at', { withTimezone: true, mode: 'date' }).notNull(),

    // Trigger reason: 'drift_detected', 'scheduled', 'manual', 'sample_threshold'
    triggeredBy: text('triggered_by').notNull(),

    // The complete de-identified bundle data (no PHI)
    bundleData: jsonb('bundle_data').notNull(),

    // Processing status: 'pending', 'processed', 'archived'
    status: text('status').notNull().default('pending'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('rlhf_bundles_org_id_idx').on(table.organizationId),
    index('rlhf_bundles_status_idx').on(table.status),
    index('rlhf_bundles_generated_at_idx').on(table.generatedAt),
    index('rlhf_bundles_triggered_by_idx').on(table.triggeredBy),
  ],
);

export type RlhfBundle = typeof rlhfBundles.$inferSelect;
export type NewRlhfBundle = typeof rlhfBundles.$inferInsert;
