/**
 * Dead Letters schema for failed control commands
 *
 * Stores commands that exhausted retries for manual investigation
 * and resolution.
 *
 * @module schema/dead-letters
 */

import { index, integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Dead letter queue for failed control plane commands.
 */
export const popperControlDeadLetters = pgTable(
  'popper_control_dead_letters',
  {
    id: serial('id').primaryKey(),
    commandId: text('command_id').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    targetInstanceId: text('target_instance_id').notNull(),
    organizationId: text('organization_id').notNull(),
    priority: text('priority').notNull(),
    commandPayload: jsonb('command_payload').notNull().$type<Record<string, unknown>>(),
    failureReason: text('failure_reason').notNull(),
    retryCount: integer('retry_count').notNull(),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }).notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('dead_letters_command_id_idx').on(table.commandId),
    index('dead_letters_target_idx').on(table.targetInstanceId),
    index('dead_letters_priority_idx').on(table.priority),
  ],
);

export type PopperControlDeadLetter = typeof popperControlDeadLetters.$inferSelect;
export type NewPopperControlDeadLetter = typeof popperControlDeadLetters.$inferInsert;
