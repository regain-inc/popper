/**
 * Redis-based baseline cache
 *
 * Caches drift baselines for fast reads during threshold checks.
 * Invalidated when baselines are recalculated.
 *
 * @module baseline-cache
 */

import type { Redis } from 'ioredis';

/** Redis key prefix for baseline cache */
export const BASELINE_KEY_PREFIX = 'baseline';

/** Default cache TTL in seconds (1 hour) */
export const BASELINE_CACHE_TTL_SECONDS = 3600;

/**
 * Cached baseline data
 */
export interface CachedBaseline {
  organizationId: string;
  signalName: string;
  baselineValue: number;
  warningThreshold: number;
  criticalThreshold: number;
  sampleCount: number;
  calculatedAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * Interface for baseline cache
 */
export interface IBaselineCache {
  /**
   * Get cached baseline for a signal
   */
  get(organizationId: string, signalName: string): Promise<CachedBaseline | null>;

  /**
   * Get all cached baselines for an organization
   */
  getAll(organizationId: string): Promise<CachedBaseline[]>;

  /**
   * Cache a baseline
   */
  set(baseline: CachedBaseline, ttlSeconds?: number): Promise<void>;

  /**
   * Cache multiple baselines
   */
  setAll(baselines: CachedBaseline[], ttlSeconds?: number): Promise<void>;

  /**
   * Invalidate cached baseline
   */
  delete(organizationId: string, signalName: string): Promise<void>;

  /**
   * Invalidate all baselines for an organization
   */
  deleteAll(organizationId: string): Promise<void>;
}

/**
 * Build Redis key for baseline cache
 */
function buildKey(organizationId: string, signalName?: string): string {
  if (signalName) {
    return `${BASELINE_KEY_PREFIX}:${organizationId}:${signalName}`;
  }
  return `${BASELINE_KEY_PREFIX}:${organizationId}:*`;
}

/**
 * Redis-based baseline cache implementation
 */
export class BaselineCache implements IBaselineCache {
  constructor(
    private readonly redis: Redis,
    private readonly defaultTtlSeconds: number = BASELINE_CACHE_TTL_SECONDS,
  ) {}

  async get(organizationId: string, signalName: string): Promise<CachedBaseline | null> {
    const key = buildKey(organizationId, signalName);
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data) as CachedBaseline;
    } catch {
      return null;
    }
  }

  async getAll(organizationId: string): Promise<CachedBaseline[]> {
    const pattern = buildKey(organizationId);
    const keys = await this.redis.keys(pattern);

    if (keys.length === 0) {
      return [];
    }

    const values = await this.redis.mget(...keys);
    const baselines: CachedBaseline[] = [];

    for (const value of values) {
      if (value) {
        try {
          baselines.push(JSON.parse(value) as CachedBaseline);
        } catch {
          // Skip invalid entries
        }
      }
    }

    return baselines;
  }

  async set(baseline: CachedBaseline, ttlSeconds?: number): Promise<void> {
    const key = buildKey(baseline.organizationId, baseline.signalName);
    const ttl = ttlSeconds ?? this.defaultTtlSeconds;
    await this.redis.setex(key, ttl, JSON.stringify(baseline));
  }

  async setAll(baselines: CachedBaseline[], ttlSeconds?: number): Promise<void> {
    if (baselines.length === 0) return;

    const ttl = ttlSeconds ?? this.defaultTtlSeconds;
    const pipeline = this.redis.pipeline();

    for (const baseline of baselines) {
      const key = buildKey(baseline.organizationId, baseline.signalName);
      pipeline.setex(key, ttl, JSON.stringify(baseline));
    }

    await pipeline.exec();
  }

  async delete(organizationId: string, signalName: string): Promise<void> {
    const key = buildKey(organizationId, signalName);
    await this.redis.del(key);
  }

  async deleteAll(organizationId: string): Promise<void> {
    const pattern = buildKey(organizationId);
    const keys = await this.redis.keys(pattern);

    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

/**
 * In-memory baseline cache for testing
 */
export class InMemoryBaselineCache implements IBaselineCache {
  private cache = new Map<string, CachedBaseline>();

  async get(organizationId: string, signalName: string): Promise<CachedBaseline | null> {
    const key = buildKey(organizationId, signalName);
    return this.cache.get(key) ?? null;
  }

  async getAll(organizationId: string): Promise<CachedBaseline[]> {
    const prefix = `${BASELINE_KEY_PREFIX}:${organizationId}:`;
    const baselines: CachedBaseline[] = [];

    for (const [key, value] of this.cache) {
      if (key.startsWith(prefix)) {
        baselines.push(value);
      }
    }

    return baselines;
  }

  async set(baseline: CachedBaseline): Promise<void> {
    const key = buildKey(baseline.organizationId, baseline.signalName);
    this.cache.set(key, baseline);
  }

  async setAll(baselines: CachedBaseline[]): Promise<void> {
    for (const baseline of baselines) {
      await this.set(baseline);
    }
  }

  async delete(organizationId: string, signalName: string): Promise<void> {
    const key = buildKey(organizationId, signalName);
    this.cache.delete(key);
  }

  async deleteAll(organizationId: string): Promise<void> {
    const prefix = `${BASELINE_KEY_PREFIX}:${organizationId}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cached data (for testing)
   */
  clear(): void {
    this.cache.clear();
  }
}
