/**
 * API Key types and interfaces
 *
 * @module api-keys/types
 */

/**
 * Available API key scopes
 *
 * - supervision:write - Create supervision requests
 * - control:read - Read safe-mode state
 * - control:write - Modify safe-mode state
 * - admin:keys:read - List API keys
 * - admin:keys:write - Create/revoke API keys
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
 * API key environment (determines prefix)
 */
export type ApiKeyEnvironment = 'live' | 'test';

/**
 * Generated API key result (returned only once at creation)
 */
export interface GeneratedApiKey {
  /** Full plaintext key (only shown once!) */
  plaintextKey: string;
  /** First 12 characters for identification (e.g., "pk_live_ab12") */
  keyPrefix: string;
  /** SHA-256 hash of the full key */
  keyHash: string;
}

/**
 * API key context available after successful authentication
 * Attached to request context by auth middleware
 */
export interface ApiKeyContext {
  /** API key database ID */
  keyId: string;
  /** Organization ID that owns this key */
  organizationId: string;
  /** Human-readable key name */
  keyName: string;
  /** Granted scopes */
  scopes: ApiKeyScope[];
  /** Rate limit in requests per minute (null = unlimited) */
  rateLimitRpm: number | null;
}

/**
 * Options for creating a new API key
 */
export interface CreateApiKeyOptions {
  /** Organization ID that will own this key */
  organizationId: string;
  /** Human-readable name for the key */
  name: string;
  /** Array of scopes to grant */
  scopes: ApiKeyScope[];
  /** Rate limit in requests per minute (optional) */
  rateLimitRpm?: number;
  /** When the key expires (optional) */
  expiresAt?: Date;
  /** Who is creating this key (user ID or system identifier) */
  createdBy: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
  /** Key environment (default: based on NODE_ENV) */
  environment?: ApiKeyEnvironment;
}

/**
 * Stored API key data (from database)
 */
export interface StoredApiKey {
  id: string;
  organizationId: string;
  keyPrefix: string;
  keyHash: string;
  name: string;
  scopes: ApiKeyScope[];
  rateLimitRpm: number | null;
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  createdBy: string;
  metadata: Record<string, unknown>;
}

/**
 * API key validation result
 */
export type ApiKeyValidationResult =
  | { valid: true; context: ApiKeyContext }
  | { valid: false; error: 'invalid_key' | 'expired' | 'revoked' | 'not_found' };
