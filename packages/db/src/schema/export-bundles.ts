import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Export Bundles table
 *
 * Stores metadata for de-identified regulatory export bundles.
 * Actual bundle data is stored in object storage (Minio/S3).
 *
 * @see docs/specs/02-popper-specs/04-popper-regulatory-export-and-triage.md
 */
export const exportBundles = pgTable(
  'export_bundles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),

    // Time window covered by the bundle
    timeWindowFrom: timestamp('time_window_from', { withTimezone: true, mode: 'date' }).notNull(),
    timeWindowTo: timestamp('time_window_to', { withTimezone: true, mode: 'date' }).notNull(),

    // When the bundle was generated
    generatedAt: timestamp('generated_at', { withTimezone: true, mode: 'date' }).notNull(),

    // What triggered the export: 'manual', 'incident', 'scheduled'
    triggeredBy: text('triggered_by').notNull(),

    // Storage location (e.g., s3://bucket/path or minio://bucket/path)
    storageUri: text('storage_uri').notNull(),

    // File size in bytes
    sizeBytes: integer('size_bytes').notNull(),

    // SHA-256 hash of the bundle content
    contentHash: text('content_hash').notNull(),

    // Number of events included
    eventCount: integer('event_count').notNull().default(0),

    // Number of incidents included
    incidentCount: integer('incident_count').notNull().default(0),

    // Status: 'pending', 'ready', 'downloaded', 'expired'
    status: text('status').notNull().default('pending'),

    // When the bundle expires
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('export_bundles_org_id_idx').on(table.organizationId),
    index('export_bundles_status_idx').on(table.status),
    index('export_bundles_generated_at_idx').on(table.generatedAt),
    index('export_bundles_expires_at_idx').on(table.expiresAt),
  ],
);

export type ExportBundle = typeof exportBundles.$inferSelect;
export type NewExportBundle = typeof exportBundles.$inferInsert;
