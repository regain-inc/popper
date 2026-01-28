/**
 * Policy Pack Cache Implementations
 *
 * Redis and in-memory cache implementations for policy pack lookups.
 *
 * @module policy-lifecycle/stores
 */

import type { Redis } from 'ioredis';
import type { IPolicyPackCache, StoredPolicyPack } from './types';
import {
  GLOBAL_POLICY_ORG_ID,
  POLICY_PACK_CACHE_PREFIX,
  POLICY_PACK_CACHE_TTL_SECONDS,
} from './types';

// =============================================================================
// Helpers
// =============================================================================

/**
 * Build cache key for active policy pack
 */
function buildActiveKey(organizationId: string | null, policyId: string): string {
  const orgPart = organizationId ?? GLOBAL_POLICY_ORG_ID;
  return `${POLICY_PACK_CACHE_PREFIX}:active:${orgPart}:${policyId}`;
}

/**
 * Serialize StoredPolicyPack for cache
 * Converts Date objects to ISO strings for JSON serialization
 */
function serialize(pack: StoredPolicyPack): string {
  return JSON.stringify({
    ...pack,
    submitted_at: pack.submitted_at?.toISOString() ?? null,
    approved_at: pack.approved_at?.toISOString() ?? null,
    activated_at: pack.activated_at?.toISOString() ?? null,
    archived_at: pack.archived_at?.toISOString() ?? null,
    created_at: pack.created_at.toISOString(),
    updated_at: pack.updated_at.toISOString(),
  });
}

/**
 * Deserialize StoredPolicyPack from cache
 * Converts ISO strings back to Date objects
 */
function deserialize(data: string): StoredPolicyPack | null {
  try {
    const parsed = JSON.parse(data);
    return {
      ...parsed,
      submitted_at: parsed.submitted_at ? new Date(parsed.submitted_at) : null,
      approved_at: parsed.approved_at ? new Date(parsed.approved_at) : null,
      activated_at: parsed.activated_at ? new Date(parsed.activated_at) : null,
      archived_at: parsed.archived_at ? new Date(parsed.archived_at) : null,
      created_at: new Date(parsed.created_at),
      updated_at: new Date(parsed.updated_at),
    };
  } catch {
    return null;
  }
}

// =============================================================================
// Redis Cache
// =============================================================================

/**
 * Redis-based policy pack cache
 *
 * Provides fast reads for active policy lookups.
 */
export class RedisPolicyPackCache implements IPolicyPackCache {
  constructor(
    private readonly redis: Redis,
    private readonly defaultTtl: number = POLICY_PACK_CACHE_TTL_SECONDS,
  ) {}

  async getActive(
    organizationId: string | null,
    policyId: string,
  ): Promise<StoredPolicyPack | null> {
    const key = buildActiveKey(organizationId, policyId);
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    return deserialize(data);
  }

  async setActive(pack: StoredPolicyPack, ttlSeconds?: number): Promise<void> {
    const key = buildActiveKey(pack.organization_id, pack.policy_id);
    const ttl = ttlSeconds ?? this.defaultTtl;
    await this.redis.setex(key, ttl, serialize(pack));
  }

  async deleteActive(organizationId: string | null, policyId: string): Promise<void> {
    const key = buildActiveKey(organizationId, policyId);
    await this.redis.del(key);
  }

  async deleteAll(organizationId: string | null): Promise<void> {
    const orgPart = organizationId ?? GLOBAL_POLICY_ORG_ID;
    const pattern = `${POLICY_PACK_CACHE_PREFIX}:*:${orgPart}:*`;
    const keys = await this.redis.keys(pattern);

    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

// =============================================================================
// In-Memory Cache
// =============================================================================

/**
 * In-memory policy pack cache for testing/development
 */
export class InMemoryPolicyPackCache implements IPolicyPackCache {
  private readonly cache = new Map<string, { pack: StoredPolicyPack; expiresAt: number }>();

  async getActive(
    organizationId: string | null,
    policyId: string,
  ): Promise<StoredPolicyPack | null> {
    const key = buildActiveKey(organizationId, policyId);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check expiration
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry.pack;
  }

  async setActive(pack: StoredPolicyPack, ttlSeconds?: number): Promise<void> {
    const key = buildActiveKey(pack.organization_id, pack.policy_id);
    const ttl = ttlSeconds ?? POLICY_PACK_CACHE_TTL_SECONDS;
    this.cache.set(key, {
      pack,
      expiresAt: Date.now() + ttl * 1000,
    });
  }

  async deleteActive(organizationId: string | null, policyId: string): Promise<void> {
    const key = buildActiveKey(organizationId, policyId);
    this.cache.delete(key);
  }

  async deleteAll(organizationId: string | null): Promise<void> {
    const orgPart = organizationId ?? GLOBAL_POLICY_ORG_ID;
    const prefix = `${POLICY_PACK_CACHE_PREFIX}:`;
    const orgPattern = `:${orgPart}:`;

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix) && key.includes(orgPattern)) {
        this.cache.delete(key);
      }
    }
  }

  /** Clear all entries (for testing) */
  clear(): void {
    this.cache.clear();
  }

  /** Get cache size (for testing) */
  size(): number {
    return this.cache.size;
  }
}
