/**
 * Rate Limit Cache for per-tenant request throttling
 *
 * Uses fixed-window counters with minute and hour granularity.
 * Keys expire automatically with TTL matching the time window.
 *
 * Redis key format:
 *   rate_limit:{org_id}:minute:{minute_ts}
 *   rate_limit:{org_id}:hour:{hour_ts}
 *
 * @module rate-limit-cache
 */

import type { Redis } from 'ioredis';

/** Rate limit configuration for an organization or API key */
export interface RateLimitConfig {
  /** Maximum requests per minute */
  perMinute: number;
  /** Maximum requests per hour */
  perHour: number;
}

/** Current rate limit counters */
export interface RateLimitCounts {
  /** Requests made in the current minute window */
  currentMinute: number;
  /** Requests made in the current hour window */
  currentHour: number;
  /** Timestamp when minute counter resets (Unix seconds) */
  minuteResetAt: number;
  /** Timestamp when hour counter resets (Unix seconds) */
  hourResetAt: number;
}

/** Result of rate limit check */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Current counts after increment (if allowed) */
  counts: RateLimitCounts;
  /** Configured limits */
  limits: RateLimitConfig;
  /** Remaining requests in minute window */
  remainingMinute: number;
  /** Remaining requests in hour window */
  remainingHour: number;
  /** Which limit was exceeded (if any) */
  exceededLimit?: 'minute' | 'hour';
  /** Seconds until the exceeded limit resets */
  retryAfterSeconds?: number;
}

/** Key prefix for rate limit counters */
const KEY_PREFIX = 'rate_limit';

/** TTL for minute counters (65 seconds to handle clock drift) */
const MINUTE_TTL_SECONDS = 65;

/** TTL for hour counters (3665 seconds to handle clock drift) */
const HOUR_TTL_SECONDS = 3665;

/**
 * Common interface for rate limit cache implementations
 */
export interface IRateLimitCache {
  /**
   * Check rate limits and atomically increment counters if allowed
   *
   * @param orgId - Organization ID
   * @param limits - Rate limit configuration
   * @returns Rate limit check result
   */
  checkAndIncrement(orgId: string, limits: RateLimitConfig): Promise<RateLimitResult>;

  /**
   * Get current rate limit counts without incrementing
   *
   * @param orgId - Organization ID
   * @returns Current counts
   */
  getCounts(orgId: string): Promise<RateLimitCounts>;
}

/**
 * Get current minute timestamp (floor to minute)
 */
function getCurrentMinuteTs(): number {
  return Math.floor(Date.now() / 60000) * 60;
}

/**
 * Get current hour timestamp (floor to hour)
 */
function getCurrentHourTs(): number {
  return Math.floor(Date.now() / 3600000) * 3600;
}

/**
 * Redis-based rate limit cache
 *
 * Uses atomic INCR operations with TTL for efficient rate limiting.
 */
export class RateLimitCache implements IRateLimitCache {
  constructor(private readonly redis: Redis) {}

  /**
   * Build Redis key for minute counter
   */
  private buildMinuteKey(orgId: string, minuteTs: number): string {
    return `${KEY_PREFIX}:${orgId}:minute:${minuteTs}`;
  }

  /**
   * Build Redis key for hour counter
   */
  private buildHourKey(orgId: string, hourTs: number): string {
    return `${KEY_PREFIX}:${orgId}:hour:${hourTs}`;
  }

  async checkAndIncrement(orgId: string, limits: RateLimitConfig): Promise<RateLimitResult> {
    const minuteTs = getCurrentMinuteTs();
    const hourTs = getCurrentHourTs();
    const minuteKey = this.buildMinuteKey(orgId, minuteTs);
    const hourKey = this.buildHourKey(orgId, hourTs);

    // Get current counts first
    const [minuteCount, hourCount] = await Promise.all([
      this.redis.get(minuteKey).then((v) => Number.parseInt(v ?? '0', 10)),
      this.redis.get(hourKey).then((v) => Number.parseInt(v ?? '0', 10)),
    ]);

    const minuteResetAt = minuteTs + 60;
    const hourResetAt = hourTs + 3600;

    // Check if already at limit
    if (minuteCount >= limits.perMinute) {
      return {
        allowed: false,
        counts: {
          currentMinute: minuteCount,
          currentHour: hourCount,
          minuteResetAt,
          hourResetAt,
        },
        limits,
        remainingMinute: 0,
        remainingHour: Math.max(0, limits.perHour - hourCount),
        exceededLimit: 'minute',
        retryAfterSeconds: minuteResetAt - Math.floor(Date.now() / 1000),
      };
    }

    if (hourCount >= limits.perHour) {
      return {
        allowed: false,
        counts: {
          currentMinute: minuteCount,
          currentHour: hourCount,
          minuteResetAt,
          hourResetAt,
        },
        limits,
        remainingMinute: Math.max(0, limits.perMinute - minuteCount),
        remainingHour: 0,
        exceededLimit: 'hour',
        retryAfterSeconds: hourResetAt - Math.floor(Date.now() / 1000),
      };
    }

    // Atomically increment both counters using a pipeline
    const pipeline = this.redis.pipeline();
    pipeline.incr(minuteKey);
    pipeline.expire(minuteKey, MINUTE_TTL_SECONDS);
    pipeline.incr(hourKey);
    pipeline.expire(hourKey, HOUR_TTL_SECONDS);

    const results = await pipeline.exec();

    // Extract new counts from pipeline results
    // Results are: [incr minute, expire minute, incr hour, expire hour]
    const newMinuteCount = results?.[0]?.[1] as number;
    const newHourCount = results?.[2]?.[1] as number;

    return {
      allowed: true,
      counts: {
        currentMinute: newMinuteCount,
        currentHour: newHourCount,
        minuteResetAt,
        hourResetAt,
      },
      limits,
      remainingMinute: Math.max(0, limits.perMinute - newMinuteCount),
      remainingHour: Math.max(0, limits.perHour - newHourCount),
    };
  }

  async getCounts(orgId: string): Promise<RateLimitCounts> {
    const minuteTs = getCurrentMinuteTs();
    const hourTs = getCurrentHourTs();
    const minuteKey = this.buildMinuteKey(orgId, minuteTs);
    const hourKey = this.buildHourKey(orgId, hourTs);

    const [minuteCount, hourCount] = await Promise.all([
      this.redis.get(minuteKey).then((v) => Number.parseInt(v ?? '0', 10)),
      this.redis.get(hourKey).then((v) => Number.parseInt(v ?? '0', 10)),
    ]);

    return {
      currentMinute: minuteCount,
      currentHour: hourCount,
      minuteResetAt: minuteTs + 60,
      hourResetAt: hourTs + 3600,
    };
  }
}

/**
 * In-memory rate limit cache for testing/development without Redis
 */
export class InMemoryRateLimitCache implements IRateLimitCache {
  private readonly minuteCounters = new Map<string, { count: number; expiresAt: number }>();
  private readonly hourCounters = new Map<string, { count: number; expiresAt: number }>();

  /**
   * Build key for minute counter
   */
  private buildMinuteKey(orgId: string, minuteTs: number): string {
    return `${orgId}:minute:${minuteTs}`;
  }

  /**
   * Build key for hour counter
   */
  private buildHourKey(orgId: string, hourTs: number): string {
    return `${orgId}:hour:${hourTs}`;
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();

    for (const [key, value] of this.minuteCounters) {
      if (value.expiresAt < now) {
        this.minuteCounters.delete(key);
      }
    }

    for (const [key, value] of this.hourCounters) {
      if (value.expiresAt < now) {
        this.hourCounters.delete(key);
      }
    }
  }

  async checkAndIncrement(orgId: string, limits: RateLimitConfig): Promise<RateLimitResult> {
    this.cleanup();

    const now = Date.now();
    const minuteTs = getCurrentMinuteTs();
    const hourTs = getCurrentHourTs();
    const minuteKey = this.buildMinuteKey(orgId, minuteTs);
    const hourKey = this.buildHourKey(orgId, hourTs);

    const minuteResetAt = minuteTs + 60;
    const hourResetAt = hourTs + 3600;

    // Get current counts
    const minuteEntry = this.minuteCounters.get(minuteKey);
    const hourEntry = this.hourCounters.get(hourKey);

    const minuteCount =
      minuteEntry?.expiresAt && minuteEntry.expiresAt > now ? minuteEntry.count : 0;
    const hourCount = hourEntry?.expiresAt && hourEntry.expiresAt > now ? hourEntry.count : 0;

    // Check if already at limit
    if (minuteCount >= limits.perMinute) {
      return {
        allowed: false,
        counts: {
          currentMinute: minuteCount,
          currentHour: hourCount,
          minuteResetAt,
          hourResetAt,
        },
        limits,
        remainingMinute: 0,
        remainingHour: Math.max(0, limits.perHour - hourCount),
        exceededLimit: 'minute',
        retryAfterSeconds: minuteResetAt - Math.floor(now / 1000),
      };
    }

    if (hourCount >= limits.perHour) {
      return {
        allowed: false,
        counts: {
          currentMinute: minuteCount,
          currentHour: hourCount,
          minuteResetAt,
          hourResetAt,
        },
        limits,
        remainingMinute: Math.max(0, limits.perMinute - minuteCount),
        remainingHour: 0,
        exceededLimit: 'hour',
        retryAfterSeconds: hourResetAt - Math.floor(now / 1000),
      };
    }

    // Increment counters
    const newMinuteCount = minuteCount + 1;
    const newHourCount = hourCount + 1;

    this.minuteCounters.set(minuteKey, {
      count: newMinuteCount,
      expiresAt: now + MINUTE_TTL_SECONDS * 1000,
    });

    this.hourCounters.set(hourKey, {
      count: newHourCount,
      expiresAt: now + HOUR_TTL_SECONDS * 1000,
    });

    return {
      allowed: true,
      counts: {
        currentMinute: newMinuteCount,
        currentHour: newHourCount,
        minuteResetAt,
        hourResetAt,
      },
      limits,
      remainingMinute: Math.max(0, limits.perMinute - newMinuteCount),
      remainingHour: Math.max(0, limits.perHour - newHourCount),
    };
  }

  async getCounts(orgId: string): Promise<RateLimitCounts> {
    this.cleanup();

    const now = Date.now();
    const minuteTs = getCurrentMinuteTs();
    const hourTs = getCurrentHourTs();
    const minuteKey = this.buildMinuteKey(orgId, minuteTs);
    const hourKey = this.buildHourKey(orgId, hourTs);

    const minuteEntry = this.minuteCounters.get(minuteKey);
    const hourEntry = this.hourCounters.get(hourKey);

    return {
      currentMinute: minuteEntry?.expiresAt && minuteEntry.expiresAt > now ? minuteEntry.count : 0,
      currentHour: hourEntry?.expiresAt && hourEntry.expiresAt > now ? hourEntry.count : 0,
      minuteResetAt: minuteTs + 60,
      hourResetAt: hourTs + 3600,
    };
  }

  /** Clear all counters (for testing) */
  clear(): void {
    this.minuteCounters.clear();
    this.hourCounters.clear();
  }

  /** Get total counter entries (for testing) */
  get size(): number {
    this.cleanup();
    return this.minuteCounters.size + this.hourCounters.size;
  }
}
