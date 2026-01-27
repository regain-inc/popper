/**
 * API Keys schema for authentication
 *
 * Regular PostgreSQL table (not hypertable - not time-series data).
 * Stores hashed API keys for organization-level authentication.
 *
 * Key format: pk_live_<64-hex-chars> (production) or pk_test_<64-hex-chars> (development)
 *
 * @module schema/api-keys
 */

import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Available API key scopes
 */
export const API_KEY_SCOPES = [
  'supervision:write',
  'control:read',
  'control:write',
  'admin:keys:read',
  'admin:keys:write',
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

/**
 * API Keys table
 *
 * Stores hashed API keys with organization ownership and scope-based permissions.
 * Keys are never stored in plaintext - only SHA-256 hash is persisted.
 */
export const apiKeys = pgTable(
  'api_keys',
  {
    /** Unique identifier (UUID v4) */
    id: uuid('id').primaryKey().defaultRandom(),

    /** Organization that owns this key */
    organizationId: text('organization_id').notNull(),

    /** First 8 characters of the key for identification (e.g., "pk_live_") */
    keyPrefix: text('key_prefix').notNull(),

    /** SHA-256 hash of the full API key */
    keyHash: text('key_hash').notNull().unique(),

    /** Human-readable name for the key */
    name: text('name').notNull(),

    /** Array of granted scopes */
    scopes: jsonb('scopes').$type<ApiKeyScope[]>().notNull().default([]),

    /** Rate limit in requests per minute (null = unlimited) */
    rateLimitRpm: integer('rate_limit_rpm'),

    /** When the key was created */
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),

    /** When the key expires (null = never) */
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),

    /** When the key was revoked (null = active) */
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),

    /** When the key was last used */
    lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'date' }),

    /** Who created this key (user ID or system identifier) */
    createdBy: text('created_by').notNull(),

    /** Optional metadata (JSON) */
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  },
  (table) => [
    // Primary lookup by key hash
    index('api_keys_key_hash_idx').on(table.keyHash),

    // List keys by organization
    index('api_keys_organization_id_idx').on(table.organizationId),

    // Lookup by prefix (for identification in logs)
    index('api_keys_key_prefix_idx').on(table.keyPrefix),
  ],
);

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
