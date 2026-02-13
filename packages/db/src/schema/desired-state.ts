/**
 * Desired State schema for control plane v2
 *
 * Stores the desired configuration state for each instance/organization pair
 * and an append-only log of all state changes for audit.
 *
 * @module schema/desired-state
 */

import { index, integer, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Desired state for an instance within an organization.
 *
 * Uses optimistic concurrency via the version column.
 * Composite PK: (instance_id, organization_id).
 */
export const popperDesiredState = pgTable(
  'popper_desired_state',
  {
    instanceId: text('instance_id').notNull(),
    organizationId: text('organization_id').notNull(),
    desiredSettings: jsonb('desired_settings')
      .notNull()
      .$type<Record<string, unknown>>()
      .default({}),
    desiredMode: text('desired_mode').notNull().default('NORMAL'),
    lastActualState: jsonb('last_actual_state').$type<Record<string, unknown>>(),
    lastReconciliationAt: timestamp('last_reconciliation_at', { withTimezone: true }),
    version: integer('version').notNull().default(1),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.instanceId, table.organizationId] }),
    index('desired_state_org_idx').on(table.organizationId),
  ],
);

export type PopperDesiredState = typeof popperDesiredState.$inferSelect;
export type NewPopperDesiredState = typeof popperDesiredState.$inferInsert;

/**
 * Append-only log of desired state changes.
 *
 * Every mutation to popperDesiredState is recorded here for audit.
 */
export const popperDesiredStateLog = pgTable(
  'popper_desired_state_log',
  {
    id: text('id')
      .notNull()
      .$defaultFn(() => crypto.randomUUID()),
    instanceId: text('instance_id').notNull(),
    organizationId: text('organization_id').notNull(),
    changeType: text('change_type').notNull(),
    changes: jsonb('changes').notNull().$type<Record<string, unknown>>(),
    triggeredBy: text('triggered_by').notNull(),
    commandId: text('command_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.createdAt, table.id] }),
    index('desired_state_log_instance_idx').on(table.instanceId),
    index('desired_state_log_command_idx').on(table.commandId),
  ],
);

export type PopperDesiredStateLog = typeof popperDesiredStateLog.$inferSelect;
export type NewPopperDesiredStateLog = typeof popperDesiredStateLog.$inferInsert;
