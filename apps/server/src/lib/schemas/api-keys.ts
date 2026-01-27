/**
 * Elysia schemas for API Key Admin endpoints
 *
 * @module lib/schemas/api-keys
 */

import { t } from 'elysia';

/**
 * API key scopes enum
 */
export const apiKeyScopeSchema = t.Union([
  t.Literal('supervision:write'),
  t.Literal('control:read'),
  t.Literal('control:write'),
  t.Literal('admin:keys:read'),
  t.Literal('admin:keys:write'),
  t.Literal('admin:orgs:read'),
  t.Literal('admin:orgs:write'),
]);

/**
 * Request to create a new API key
 */
export const createApiKeyRequestSchema = t.Object({
  name: t.String({ description: 'Human-readable name for the key', minLength: 1, maxLength: 255 }),
  scopes: t.Array(apiKeyScopeSchema, {
    description: 'Array of scopes to grant',
    minItems: 1,
  }),
  rate_limit_rpm: t.Optional(
    t.Number({ description: 'Rate limit in requests per minute', minimum: 1 }),
  ),
  expires_at: t.Optional(
    t.String({ description: 'Expiration date (ISO 8601)', format: 'date-time' }),
  ),
  metadata: t.Optional(t.Record(t.String(), t.Unknown(), { description: 'Optional metadata' })),
});

/**
 * Response when creating a new API key
 * Note: plaintext_key is only returned once at creation time!
 */
export const createApiKeyResponseSchema = t.Object({
  id: t.String({ description: 'Key ID' }),
  plaintext_key: t.String({ description: 'Full API key (only shown once!)' }),
  key_prefix: t.String({ description: 'Key prefix for identification' }),
  name: t.String(),
  scopes: t.Array(apiKeyScopeSchema),
  rate_limit_rpm: t.Nullable(t.Number()),
  created_at: t.String({ format: 'date-time' }),
  expires_at: t.Nullable(t.String({ format: 'date-time' })),
});

/**
 * API key list item (no sensitive data)
 */
export const apiKeyListItemSchema = t.Object({
  id: t.String(),
  key_prefix: t.String(),
  name: t.String(),
  scopes: t.Array(apiKeyScopeSchema),
  rate_limit_rpm: t.Nullable(t.Number()),
  created_at: t.String({ format: 'date-time' }),
  expires_at: t.Nullable(t.String({ format: 'date-time' })),
  revoked_at: t.Nullable(t.String({ format: 'date-time' })),
  last_used_at: t.Nullable(t.String({ format: 'date-time' })),
  created_by: t.String(),
});

/**
 * Response for listing API keys
 */
export const listApiKeysResponseSchema = t.Object({
  organization_id: t.String(),
  keys: t.Array(apiKeyListItemSchema),
});

/**
 * Response for revoking an API key
 */
export const revokeApiKeyResponseSchema = t.Object({
  id: t.String(),
  revoked: t.Boolean(),
  revoked_at: t.Nullable(t.String({ format: 'date-time' })),
});
