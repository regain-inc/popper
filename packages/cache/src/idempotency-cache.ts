/**
 * Redis-based idempotency cache for replay protection
 *
 * Key format: idempotency:{org_id}:{idempotency_key}
 * TTL: 5 minutes (configurable)
 *
 * Behavior:
 * - Cache hit + same payload → return cached response
 * - Cache hit + different payload → replay_suspected (HARD_STOP)
 *
 * @see docs/specs/02-popper-specs/01-popper-system-spec.md §3.3
 * @module idempotency-cache
 */

import { createHash } from 'node:crypto';
import type { Redis } from 'ioredis';

/** Default TTL in seconds (5 minutes per spec) */
export const DEFAULT_IDEMPOTENCY_TTL_SECONDS = 5 * 60;

/** Cache key prefix */
const KEY_PREFIX = 'idempotency';

/**
 * Cached entry stored in Redis
 */
export interface CachedEntry<T = unknown> {
  /** SHA-256 hash of canonicalized request payload */
  request_hash: string;
  /** Cached response */
  response: T;
  /** ISO timestamp when entry was created */
  created_at: string;
}

/**
 * Result of idempotency check
 */
export type IdempotencyCheckResult<T = unknown> =
  | { status: 'new' }
  | { status: 'cached'; response: T }
  | { status: 'replay_suspected'; cached_hash: string; new_hash: string };

/**
 * Idempotency cache configuration
 */
export interface IdempotencyCacheConfig {
  /** TTL in seconds (default: 300 = 5 minutes) */
  ttlSeconds?: number;
  /** Key prefix (default: 'idempotency') */
  keyPrefix?: string;
}

/**
 * Common interface for idempotency cache implementations
 */
export interface IIdempotencyCache<T = unknown> {
  computeRequestHash(request: unknown): string;
  check(
    organizationId: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<IdempotencyCheckResult<T>>;
  store(
    organizationId: string,
    idempotencyKey: string,
    requestHash: string,
    response: T,
  ): Promise<void>;
  delete(organizationId: string, idempotencyKey: string): Promise<void>;
}

/**
 * Canonicalize object for deterministic hashing
 * Sorts keys recursively and removes timestamp fields
 */
function canonicalize(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => canonicalize(item));
  }

  if (typeof obj === 'object') {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj as Record<string, unknown>).sort();

    for (const key of keys) {
      // Skip timestamp fields that don't affect decision
      if (key === 'request_timestamp' || key === 'created_at') {
        continue;
      }
      sorted[key] = canonicalize((obj as Record<string, unknown>)[key]);
    }

    return sorted;
  }

  return obj;
}

/**
 * Compute SHA-256 hash of canonicalized request payload
 */
export function computeRequestHash(request: unknown): string {
  const canonical = canonicalize(request);
  const json = JSON.stringify(canonical);
  return createHash('sha256').update(json).digest('hex');
}

/**
 * Redis-based idempotency cache
 */
export class IdempotencyCache<T = unknown> implements IIdempotencyCache<T> {
  private readonly ttlSeconds: number;
  private readonly keyPrefix: string;

  constructor(
    private readonly redis: Redis,
    config: IdempotencyCacheConfig = {},
  ) {
    this.ttlSeconds = config.ttlSeconds ?? DEFAULT_IDEMPOTENCY_TTL_SECONDS;
    this.keyPrefix = config.keyPrefix ?? KEY_PREFIX;
  }

  /**
   * Build cache key from organization ID and idempotency key
   */
  private buildKey(organizationId: string, idempotencyKey: string): string {
    return `${this.keyPrefix}:${organizationId}:${idempotencyKey}`;
  }

  /**
   * Compute SHA-256 hash of canonicalized request payload
   */
  computeRequestHash(request: unknown): string {
    return computeRequestHash(request);
  }

  /**
   * Check if request is a duplicate within replay window
   *
   * @returns IdempotencyCheckResult indicating:
   *   - 'new': No cached entry, proceed with evaluation
   *   - 'cached': Exact duplicate, return cached response
   *   - 'replay_suspected': Different payload with same key
   */
  async check(
    organizationId: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<IdempotencyCheckResult<T>> {
    const key = this.buildKey(organizationId, idempotencyKey);
    const cached = await this.redis.get(key);

    if (!cached) {
      return { status: 'new' };
    }

    const entry: CachedEntry<T> = JSON.parse(cached);

    if (entry.request_hash === requestHash) {
      return { status: 'cached', response: entry.response };
    }

    return {
      status: 'replay_suspected',
      cached_hash: entry.request_hash,
      new_hash: requestHash,
    };
  }

  /**
   * Store response in cache after successful evaluation
   */
  async store(
    organizationId: string,
    idempotencyKey: string,
    requestHash: string,
    response: T,
  ): Promise<void> {
    const key = this.buildKey(organizationId, idempotencyKey);
    const entry: CachedEntry<T> = {
      request_hash: requestHash,
      response,
      created_at: new Date().toISOString(),
    };

    await this.redis.setex(key, this.ttlSeconds, JSON.stringify(entry));
  }

  /**
   * Delete cached entry (for testing or manual invalidation)
   */
  async delete(organizationId: string, idempotencyKey: string): Promise<void> {
    const key = this.buildKey(organizationId, idempotencyKey);
    await this.redis.del(key);
  }
}

/**
 * In-memory idempotency cache for testing/development without Redis
 */
export class InMemoryIdempotencyCache<T = unknown> implements IIdempotencyCache<T> {
  private readonly cache = new Map<string, { entry: CachedEntry<T>; expiresAt: number }>();
  private readonly ttlSeconds: number;
  private readonly keyPrefix: string;

  constructor(config: IdempotencyCacheConfig = {}) {
    this.ttlSeconds = config.ttlSeconds ?? DEFAULT_IDEMPOTENCY_TTL_SECONDS;
    this.keyPrefix = config.keyPrefix ?? KEY_PREFIX;
  }

  private buildKey(organizationId: string, idempotencyKey: string): string {
    return `${this.keyPrefix}:${organizationId}:${idempotencyKey}`;
  }

  computeRequestHash(request: unknown): string {
    return computeRequestHash(request);
  }

  async check(
    organizationId: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<IdempotencyCheckResult<T>> {
    this.cleanup();

    const key = this.buildKey(organizationId, idempotencyKey);
    const cached = this.cache.get(key);

    if (!cached || cached.expiresAt < Date.now()) {
      return { status: 'new' };
    }

    if (cached.entry.request_hash === requestHash) {
      return { status: 'cached', response: cached.entry.response };
    }

    return {
      status: 'replay_suspected',
      cached_hash: cached.entry.request_hash,
      new_hash: requestHash,
    };
  }

  async store(
    organizationId: string,
    idempotencyKey: string,
    requestHash: string,
    response: T,
  ): Promise<void> {
    const key = this.buildKey(organizationId, idempotencyKey);
    const entry: CachedEntry<T> = {
      request_hash: requestHash,
      response,
      created_at: new Date().toISOString(),
    };

    this.cache.set(key, {
      entry,
      expiresAt: Date.now() + this.ttlSeconds * 1000,
    });
  }

  async delete(organizationId: string, idempotencyKey: string): Promise<void> {
    const key = this.buildKey(organizationId, idempotencyKey);
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
