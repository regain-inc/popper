/**
 * Settings storage implementations
 *
 * @module settings/stores
 */

import type { Redis } from 'ioredis';
import type { ISettingsCache, ISettingsStore, OperationalSetting, SettingsKey } from './types';
import { GLOBAL_SETTINGS_ORG_ID, SETTINGS_CACHE_TTL_SECONDS, SETTINGS_KEY_PREFIX } from './types';

/**
 * Build cache key for settings
 */
function buildCacheKey(organizationId: string | null, key: SettingsKey): string {
  const orgPart = organizationId ?? GLOBAL_SETTINGS_ORG_ID;
  return `${SETTINGS_KEY_PREFIX}:${orgPart}:${key}`;
}

/**
 * Redis-based settings cache
 *
 * Provides fast reads for the supervision pipeline.
 */
export class RedisSettingsCache implements ISettingsCache {
  constructor(
    private readonly redis: Redis,
    private readonly defaultTtl: number = SETTINGS_CACHE_TTL_SECONDS,
  ) {}

  async get(organizationId: string | null, key: SettingsKey): Promise<unknown | null> {
    const cacheKey = buildCacheKey(organizationId, key);
    const data = await this.redis.get(cacheKey);

    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async set(
    organizationId: string | null,
    key: SettingsKey,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<void> {
    const cacheKey = buildCacheKey(organizationId, key);
    const ttl = ttlSeconds ?? this.defaultTtl;
    await this.redis.setex(cacheKey, ttl, JSON.stringify(value));
  }

  async delete(organizationId: string | null, key: SettingsKey): Promise<void> {
    const cacheKey = buildCacheKey(organizationId, key);
    await this.redis.del(cacheKey);
  }

  async deleteAll(organizationId: string | null): Promise<void> {
    const orgPart = organizationId ?? GLOBAL_SETTINGS_ORG_ID;
    const pattern = `${SETTINGS_KEY_PREFIX}:${orgPart}:*`;
    const keys = await this.redis.keys(pattern);

    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

/**
 * In-memory settings cache for testing/development
 */
export class InMemorySettingsCache implements ISettingsCache {
  private readonly cache = new Map<string, { value: unknown; expiresAt: number }>();

  async get(organizationId: string | null, key: SettingsKey): Promise<unknown | null> {
    const cacheKey = buildCacheKey(organizationId, key);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      return null;
    }

    // Check expiration
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(cacheKey);
      return null;
    }

    return entry.value;
  }

  async set(
    organizationId: string | null,
    key: SettingsKey,
    value: unknown,
    ttlSeconds: number = SETTINGS_CACHE_TTL_SECONDS,
  ): Promise<void> {
    const cacheKey = buildCacheKey(organizationId, key);
    this.cache.set(cacheKey, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async delete(organizationId: string | null, key: SettingsKey): Promise<void> {
    const cacheKey = buildCacheKey(organizationId, key);
    this.cache.delete(cacheKey);
  }

  async deleteAll(organizationId: string | null): Promise<void> {
    const orgPart = organizationId ?? GLOBAL_SETTINGS_ORG_ID;
    const prefix = `${SETTINGS_KEY_PREFIX}:${orgPart}:`;

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
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

/**
 * In-memory settings store for testing/development
 */
export class InMemorySettingsStore implements ISettingsStore {
  private readonly settings: OperationalSetting[] = [];

  async getLatest(
    organizationId: string | null,
    key: SettingsKey,
  ): Promise<OperationalSetting | null> {
    const matching = this.settings
      .filter((s) => s.organization_id === organizationId && s.key === key)
      .filter((s) => s.effective_at <= new Date())
      .sort((a, b) => b.effective_at.getTime() - a.effective_at.getTime());

    return matching[0] ?? null;
  }

  async getAllLatest(organizationId: string | null): Promise<OperationalSetting[]> {
    // Get all settings for org that are currently effective
    const now = new Date();
    const settingsByKey = new Map<SettingsKey, OperationalSetting>();

    // Sort by effective_at desc and take first for each key
    const sorted = [...this.settings]
      .filter((s) => s.organization_id === organizationId && s.effective_at <= now)
      .sort((a, b) => b.effective_at.getTime() - a.effective_at.getTime());

    for (const setting of sorted) {
      if (!settingsByKey.has(setting.key)) {
        settingsByKey.set(setting.key, setting);
      }
    }

    return Array.from(settingsByKey.values());
  }

  async create(
    setting: Omit<OperationalSetting, 'id' | 'created_at'>,
  ): Promise<OperationalSetting> {
    const fullSetting: OperationalSetting = {
      ...setting,
      id: crypto.randomUUID(),
      created_at: new Date(),
    };

    this.settings.push(fullSetting);

    return fullSetting;
  }

  async getHistory(
    organizationId: string | null,
    key: SettingsKey,
    limit = 100,
  ): Promise<OperationalSetting[]> {
    return this.settings
      .filter((s) => s.organization_id === organizationId && s.key === key)
      .sort((a, b) => b.effective_at.getTime() - a.effective_at.getTime())
      .slice(0, limit);
  }

  /** Clear all settings (for testing) */
  clear(): void {
    this.settings.length = 0;
    this.sequence = 0;
  }

  /** Get all settings (for testing) */
  getAll(): OperationalSetting[] {
    return [...this.settings];
  }
}
