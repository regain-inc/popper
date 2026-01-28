/**
 * Redis-based cooldown tracker for drift triggers
 *
 * Tracks cooldown periods for drift signal triggers to prevent
 * alert flooding and safe-mode flapping.
 *
 * Key format: cooldown:{org_id}:{signal}
 * Value: Unix timestamp when cooldown expires
 *
 * @module cooldown-tracker
 */

import type { Redis } from 'ioredis';

/** Key prefix for cooldown entries */
const COOLDOWN_KEY_PREFIX = 'cooldown';

/**
 * Cooldown tracker interface
 */
export interface ICooldownTracker {
  /** Check if signal is in cooldown */
  isInCooldown(organizationId: string, signal: string): Promise<boolean>;
  /** Set cooldown for a signal */
  setCooldown(organizationId: string, signal: string, until: Date): Promise<void>;
  /** Clear cooldown */
  clearCooldown(organizationId: string, signal: string): Promise<void>;
  /** Get cooldown expiry time */
  getCooldownUntil(organizationId: string, signal: string): Promise<Date | null>;
}

/**
 * Sanitize organization ID for Redis key safety
 */
function sanitizeOrgId(orgId: string): string {
  return orgId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
}

/**
 * Build Redis key for cooldown entry
 */
function buildKey(organizationId: string, signal: string): string {
  return `${COOLDOWN_KEY_PREFIX}:${sanitizeOrgId(organizationId)}:${signal}`;
}

/**
 * Redis-based cooldown tracker
 */
export class CooldownTracker implements ICooldownTracker {
  constructor(private readonly redis: Redis) {}

  async isInCooldown(organizationId: string, signal: string): Promise<boolean> {
    const key = buildKey(organizationId, signal);
    const value = await this.redis.get(key);

    if (!value) return false;

    const expiresAt = Number.parseInt(value, 10);
    if (Number.isNaN(expiresAt)) return false;

    return expiresAt > Date.now();
  }

  async setCooldown(organizationId: string, signal: string, until: Date): Promise<void> {
    const key = buildKey(organizationId, signal);
    const expiresAt = until.getTime();
    const ttlSeconds = Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));

    await this.redis.setex(key, ttlSeconds, expiresAt.toString());
  }

  async clearCooldown(organizationId: string, signal: string): Promise<void> {
    const key = buildKey(organizationId, signal);
    await this.redis.del(key);
  }

  async getCooldownUntil(organizationId: string, signal: string): Promise<Date | null> {
    const key = buildKey(organizationId, signal);
    const value = await this.redis.get(key);

    if (!value) return null;

    const expiresAt = Number.parseInt(value, 10);
    if (Number.isNaN(expiresAt)) return null;

    if (expiresAt <= Date.now()) return null;

    return new Date(expiresAt);
  }
}

/**
 * In-memory cooldown tracker for testing
 */
export class InMemoryCooldownTracker implements ICooldownTracker {
  private cooldowns = new Map<string, number>();

  private buildKey(organizationId: string, signal: string): string {
    return `${organizationId}:${signal}`;
  }

  async isInCooldown(organizationId: string, signal: string): Promise<boolean> {
    const key = this.buildKey(organizationId, signal);
    const expiresAt = this.cooldowns.get(key);
    if (!expiresAt) return false;
    if (expiresAt < Date.now()) {
      this.cooldowns.delete(key);
      return false;
    }
    return true;
  }

  async setCooldown(organizationId: string, signal: string, until: Date): Promise<void> {
    const key = this.buildKey(organizationId, signal);
    this.cooldowns.set(key, until.getTime());
  }

  async clearCooldown(organizationId: string, signal: string): Promise<void> {
    const key = this.buildKey(organizationId, signal);
    this.cooldowns.delete(key);
  }

  async getCooldownUntil(organizationId: string, signal: string): Promise<Date | null> {
    const key = this.buildKey(organizationId, signal);
    const expiresAt = this.cooldowns.get(key);
    if (!expiresAt || expiresAt <= Date.now()) return null;
    return new Date(expiresAt);
  }

  /** Clear all cooldowns (for testing) */
  clear(): void {
    this.cooldowns.clear();
  }
}
