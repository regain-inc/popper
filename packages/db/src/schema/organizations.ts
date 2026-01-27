/**
 * Organizations schema for multi-tenant management
 *
 * Regular PostgreSQL table (not hypertable - not time-series data).
 * Stores organization configuration for multi-tenant isolation.
 *
 * @module schema/organizations
 */

import { boolean, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Supervision modes that can be enabled per organization
 */
export type SupervisionMode = 'wellness' | 'advocate_clinical';

/**
 * Organizations table
 *
 * Stores organization-level configuration for multi-tenant supervisory system.
 * Each organization has its own set of allowed modes, rate limits, and staleness overrides.
 */
export const organizations = pgTable(
  'organizations',
  {
    /** Unique identifier (e.g., "org_abc123") */
    id: text('id').primaryKey(),

    /** Human-readable organization name */
    name: text('name').notNull(),

    /** Array of allowed supervision modes */
    allowedModes: jsonb('allowed_modes').$type<SupervisionMode[]>().notNull().default(['wellness']),

    /** Rate limit in requests per minute */
    rateLimitPerMinute: integer('rate_limit_per_minute').notNull().default(1000),

    /** Rate limit in requests per hour */
    rateLimitPerHour: integer('rate_limit_per_hour').notNull().default(50000),

    /** Default policy pack to use for this organization */
    defaultPolicyPack: text('default_policy_pack').notNull().default('popper-default'),

    /** Staleness threshold for wellness mode in hours (null = use global default) */
    stalenessWellnessHours: integer('staleness_wellness_hours'),

    /** Staleness threshold for clinical mode in hours (null = use global default) */
    stalenessClinicalHours: integer('staleness_clinical_hours'),

    /** Whether the organization is active */
    isActive: boolean('is_active').notNull().default(true),

    /** When the organization was created */
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),

    /** When the organization was last updated */
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),

    /** Optional metadata (JSON) */
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  },
  (table) => [
    // List organizations by active status
    index('organizations_is_active_idx').on(table.isActive),

    // Sort by creation date
    index('organizations_created_at_idx').on(table.createdAt),
  ],
);

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
