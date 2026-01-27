/**
 * API Key Service
 *
 * Handles API key lifecycle management:
 * - Create new keys (returns plaintext once)
 * - Validate keys (hash comparison)
 * - Revoke keys
 * - List keys by organization
 * - Track last used timestamp
 *
 * @module services/api-key-service
 */

import { and, desc, eq, isNull } from 'drizzle-orm';
import type { DrizzleDB } from '../db';
import { apiKeys } from '../schema';
import type { ApiKeyScope } from '../schema/api-keys';

// Re-export types for convenience
export type { ApiKeyScope } from '../schema/api-keys';

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

// =============================================================================
// Key Generation Utilities
// =============================================================================

import { createHash, randomBytes } from 'node:crypto';

/** Key prefix pattern */
const KEY_PREFIX_REGEX = /^pk_(live|test)_[a-f0-9]{64}$/;

/** Prefix length for identification (e.g., "pk_live_ab12") */
const DISPLAY_PREFIX_LENGTH = 12;

/**
 * Generate a new API key
 */
export function generateApiKey(environment: ApiKeyEnvironment = 'test'): GeneratedApiKey {
  const randomPart = randomBytes(32).toString('hex');
  const plaintextKey = `pk_${environment}_${randomPart}`;

  return {
    plaintextKey,
    keyPrefix: plaintextKey.substring(0, DISPLAY_PREFIX_LENGTH),
    keyHash: hashApiKey(plaintextKey),
  };
}

/**
 * Hash an API key using SHA-256
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Validate API key format
 */
export function isValidKeyFormat(key: string): boolean {
  return KEY_PREFIX_REGEX.test(key);
}

// =============================================================================
// API Key Service
// =============================================================================

/**
 * API Key Service
 *
 * Manages API key lifecycle with database storage.
 */
export class ApiKeyService {
  constructor(private readonly db: DrizzleDB) {}

  /**
   * Create a new API key
   *
   * @returns Generated key with plaintext (only returned once!)
   */
  async create(options: CreateApiKeyOptions): Promise<{
    id: string;
    plaintextKey: string;
    keyPrefix: string;
    createdAt: Date;
  }> {
    const environment =
      options.environment ?? (process.env.NODE_ENV === 'production' ? 'live' : 'test');

    const generated = generateApiKey(environment);

    const [inserted] = await this.db
      .insert(apiKeys)
      .values({
        organizationId: options.organizationId,
        keyPrefix: generated.keyPrefix,
        keyHash: generated.keyHash,
        name: options.name,
        scopes: options.scopes,
        rateLimitRpm: options.rateLimitRpm ?? null,
        expiresAt: options.expiresAt ?? null,
        createdBy: options.createdBy,
        metadata: options.metadata ?? {},
      })
      .returning({ id: apiKeys.id, createdAt: apiKeys.createdAt });

    return {
      id: inserted.id,
      plaintextKey: generated.plaintextKey,
      keyPrefix: generated.keyPrefix,
      createdAt: inserted.createdAt,
    };
  }

  /**
   * Validate an API key
   */
  async validate(plaintextKey: string): Promise<ApiKeyValidationResult> {
    if (!isValidKeyFormat(plaintextKey)) {
      return { valid: false, error: 'invalid_key' };
    }

    const keyHash = hashApiKey(plaintextKey);

    const key = await this.db.query.apiKeys.findFirst({
      where: eq(apiKeys.keyHash, keyHash),
    });

    if (!key) {
      return { valid: false, error: 'not_found' };
    }

    if (key.revokedAt !== null) {
      return { valid: false, error: 'revoked' };
    }

    if (key.expiresAt !== null && key.expiresAt < new Date()) {
      return { valid: false, error: 'expired' };
    }

    return {
      valid: true,
      context: {
        keyId: key.id,
        organizationId: key.organizationId,
        keyName: key.name,
        scopes: key.scopes as ApiKeyScope[],
        rateLimitRpm: key.rateLimitRpm,
      },
    };
  }

  /**
   * Update last_used_at timestamp
   */
  async updateLastUsed(keyId: string): Promise<void> {
    await this.db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, keyId));
  }

  /**
   * Revoke an API key
   */
  async revoke(keyId: string): Promise<boolean> {
    const result = await this.db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeys.id, keyId), isNull(apiKeys.revokedAt)))
      .returning({ id: apiKeys.id });

    return result.length > 0;
  }

  /**
   * List API keys for an organization
   */
  async listByOrganization(
    organizationId: string,
    options: { includeRevoked?: boolean; limit?: number } = {},
  ): Promise<
    Array<{
      id: string;
      keyPrefix: string;
      name: string;
      scopes: ApiKeyScope[];
      rateLimitRpm: number | null;
      createdAt: Date;
      expiresAt: Date | null;
      revokedAt: Date | null;
      lastUsedAt: Date | null;
      createdBy: string;
    }>
  > {
    const { includeRevoked = false, limit = 100 } = options;

    const conditions = [eq(apiKeys.organizationId, organizationId)];

    if (!includeRevoked) {
      conditions.push(isNull(apiKeys.revokedAt));
    }

    const keys = await this.db
      .select({
        id: apiKeys.id,
        keyPrefix: apiKeys.keyPrefix,
        name: apiKeys.name,
        scopes: apiKeys.scopes,
        rateLimitRpm: apiKeys.rateLimitRpm,
        createdAt: apiKeys.createdAt,
        expiresAt: apiKeys.expiresAt,
        revokedAt: apiKeys.revokedAt,
        lastUsedAt: apiKeys.lastUsedAt,
        createdBy: apiKeys.createdBy,
      })
      .from(apiKeys)
      .where(and(...conditions))
      .orderBy(desc(apiKeys.createdAt))
      .limit(limit);

    return keys.map((k) => ({
      ...k,
      scopes: k.scopes as ApiKeyScope[],
    }));
  }

  /**
   * Get a single API key by ID
   */
  async getById(keyId: string): Promise<StoredApiKey | null> {
    const key = await this.db.query.apiKeys.findFirst({
      where: eq(apiKeys.id, keyId),
    });

    if (!key) {
      return null;
    }

    return {
      id: key.id,
      organizationId: key.organizationId,
      keyPrefix: key.keyPrefix,
      keyHash: key.keyHash,
      name: key.name,
      scopes: key.scopes as ApiKeyScope[],
      rateLimitRpm: key.rateLimitRpm,
      createdAt: key.createdAt,
      expiresAt: key.expiresAt,
      revokedAt: key.revokedAt,
      lastUsedAt: key.lastUsedAt,
      createdBy: key.createdBy,
      metadata: (key.metadata ?? {}) as Record<string, unknown>,
    };
  }
}
