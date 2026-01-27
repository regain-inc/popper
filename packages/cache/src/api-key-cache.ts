/**
 * API Key Cache for fast validation
 *
 * Caches validated API key contexts to avoid database lookups on every request.
 * 5-minute TTL ensures keys can be revoked within a reasonable time.
 *
 * Key format: apikey:{key_hash}
 *
 * @module api-key-cache
 */

import type { Redis } from 'ioredis';

/** Default TTL in seconds (5 minutes) */
export const DEFAULT_API_KEY_CACHE_TTL_SECONDS = 5 * 60;

/** Cache key prefix */
const KEY_PREFIX = 'apikey';

/**
 * Cached API key context
 */
export interface CachedApiKeyContext {
  /** API key database ID */
  keyId: string;
  /** Organization ID that owns this key */
  organizationId: string;
  /** Human-readable key name */
  keyName: string;
  /** Granted scopes */
  scopes: string[];
  /** Rate limit in requests per minute (null = unlimited) */
  rateLimitRpm: number | null;
  /** When the cache entry was created */
  cachedAt: string;
}

/**
 * API Key Cache configuration
 */
export interface ApiKeyCacheConfig {
  /** TTL in seconds (default: 300 = 5 minutes) */
  ttlSeconds?: number;
  /** Key prefix (default: 'apikey') */
  keyPrefix?: string;
}

/**
 * Common interface for API key cache implementations
 */
export interface IApiKeyCache {
  /**
   * Get cached API key context by key hash
   * @returns Cached context or null if not found/expired
   */
  get(keyHash: string): Promise<CachedApiKeyContext | null>;

  /**
   * Store API key context in cache
   * @param keyHash - SHA-256 hash of the API key
   * @param context - Validated API key context
   */
  set(keyHash: string, context: CachedApiKeyContext): Promise<void>;

  /**
   * Invalidate cached entry (e.g., after revocation)
   * @param keyHash - SHA-256 hash of the API key
   */
  invalidate(keyHash: string): Promise<void>;
}

/**
 * Redis-based API key cache
 */
export class ApiKeyCache implements IApiKeyCache {
  private readonly ttlSeconds: number;
  private readonly keyPrefix: string;

  constructor(
    private readonly redis: Redis,
    config: ApiKeyCacheConfig = {},
  ) {
    this.ttlSeconds = config.ttlSeconds ?? DEFAULT_API_KEY_CACHE_TTL_SECONDS;
    this.keyPrefix = config.keyPrefix ?? KEY_PREFIX;
  }

  /**
   * Build cache key from key hash
   */
  private buildKey(keyHash: string): string {
    return `${this.keyPrefix}:${keyHash}`;
  }

  async get(keyHash: string): Promise<CachedApiKeyContext | null> {
    const key = this.buildKey(keyHash);
    const cached = await this.redis.get(key);

    if (!cached) {
      return null;
    }

    try {
      return JSON.parse(cached) as CachedApiKeyContext;
    } catch {
      // Invalid JSON - treat as cache miss
      return null;
    }
  }

  async set(keyHash: string, context: CachedApiKeyContext): Promise<void> {
    const key = this.buildKey(keyHash);
    const entry: CachedApiKeyContext = {
      ...context,
      cachedAt: new Date().toISOString(),
    };

    await this.redis.setex(key, this.ttlSeconds, JSON.stringify(entry));
  }

  async invalidate(keyHash: string): Promise<void> {
    const key = this.buildKey(keyHash);
    await this.redis.del(key);
  }
}

/**
 * In-memory API key cache for testing/development without Redis
 */
export class InMemoryApiKeyCache implements IApiKeyCache {
  private readonly cache = new Map<string, { entry: CachedApiKeyContext; expiresAt: number }>();
  private readonly ttlSeconds: number;
  private readonly keyPrefix: string;

  constructor(config: ApiKeyCacheConfig = {}) {
    this.ttlSeconds = config.ttlSeconds ?? DEFAULT_API_KEY_CACHE_TTL_SECONDS;
    this.keyPrefix = config.keyPrefix ?? KEY_PREFIX;
  }

  private buildKey(keyHash: string): string {
    return `${this.keyPrefix}:${keyHash}`;
  }

  async get(keyHash: string): Promise<CachedApiKeyContext | null> {
    this.cleanup();

    const key = this.buildKey(keyHash);
    const cached = this.cache.get(key);

    if (!cached || cached.expiresAt < Date.now()) {
      return null;
    }

    return cached.entry;
  }

  async set(keyHash: string, context: CachedApiKeyContext): Promise<void> {
    const key = this.buildKey(keyHash);
    const entry: CachedApiKeyContext = {
      ...context,
      cachedAt: new Date().toISOString(),
    };

    this.cache.set(key, {
      entry,
      expiresAt: Date.now() + this.ttlSeconds * 1000,
    });
  }

  async invalidate(keyHash: string): Promise<void> {
    const key = this.buildKey(keyHash);
    this.cache.delete(key);
  }

  /** Remove expired entries */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.cache) {
      if (value.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  /** Clear all entries (for testing) */
  clear(): void {
    this.cache.clear();
  }

  /** Get current cache size (for testing) */
  get size(): number {
    this.cleanup();
    return this.cache.size;
  }
}
