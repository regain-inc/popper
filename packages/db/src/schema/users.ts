import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Users table for ops dashboard authentication
 *
 * Invite-only model: users are created via invite by an admin.
 * No public signup allowed.
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull().default('viewer'), // 'admin' | 'viewer'
  isActive: boolean('is_active').notNull().default(true),
  invitedBy: uuid('invited_by'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true, mode: 'date' }),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
