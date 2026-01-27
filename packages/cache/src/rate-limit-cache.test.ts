import { beforeEach, describe, expect, it } from 'bun:test';
import { InMemoryRateLimitCache, type RateLimitConfig } from './rate-limit-cache';

describe('InMemoryRateLimitCache', () => {
  let cache: InMemoryRateLimitCache;
  const orgId = 'org-123';
  const defaultLimits: RateLimitConfig = {
    perMinute: 10,
    perHour: 100,
  };

  beforeEach(() => {
    cache = new InMemoryRateLimitCache();
  });

  describe('checkAndIncrement', () => {
    it('should allow first request and increment counter', async () => {
      const result = await cache.checkAndIncrement(orgId, defaultLimits);

      expect(result.allowed).toBe(true);
      expect(result.counts.currentMinute).toBe(1);
      expect(result.counts.currentHour).toBe(1);
      expect(result.remainingMinute).toBe(9);
      expect(result.remainingHour).toBe(99);
    });

    it('should track multiple requests', async () => {
      await cache.checkAndIncrement(orgId, defaultLimits);
      await cache.checkAndIncrement(orgId, defaultLimits);
      const result = await cache.checkAndIncrement(orgId, defaultLimits);

      expect(result.allowed).toBe(true);
      expect(result.counts.currentMinute).toBe(3);
      expect(result.counts.currentHour).toBe(3);
      expect(result.remainingMinute).toBe(7);
      expect(result.remainingHour).toBe(97);
    });

    it('should reject when minute limit exceeded', async () => {
      const lowLimits: RateLimitConfig = { perMinute: 3, perHour: 100 };

      // Use up the limit
      await cache.checkAndIncrement(orgId, lowLimits);
      await cache.checkAndIncrement(orgId, lowLimits);
      await cache.checkAndIncrement(orgId, lowLimits);

      // Next request should be rejected
      const result = await cache.checkAndIncrement(orgId, lowLimits);

      expect(result.allowed).toBe(false);
      expect(result.exceededLimit).toBe('minute');
      expect(result.remainingMinute).toBe(0);
      expect(result.retryAfterSeconds).toBeDefined();
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
      expect(result.retryAfterSeconds).toBeLessThanOrEqual(60);
    });

    it('should reject when hour limit exceeded', async () => {
      const lowLimits: RateLimitConfig = { perMinute: 100, perHour: 3 };

      // Use up the hour limit
      await cache.checkAndIncrement(orgId, lowLimits);
      await cache.checkAndIncrement(orgId, lowLimits);
      await cache.checkAndIncrement(orgId, lowLimits);

      // Next request should be rejected
      const result = await cache.checkAndIncrement(orgId, lowLimits);

      expect(result.allowed).toBe(false);
      expect(result.exceededLimit).toBe('hour');
      expect(result.remainingHour).toBe(0);
      expect(result.retryAfterSeconds).toBeDefined();
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('should isolate counts by organization', async () => {
      await cache.checkAndIncrement('org-1', defaultLimits);
      await cache.checkAndIncrement('org-1', defaultLimits);

      // org-2 should start fresh
      const result = await cache.checkAndIncrement('org-2', defaultLimits);

      expect(result.counts.currentMinute).toBe(1);
      expect(result.counts.currentHour).toBe(1);
    });

    it('should return correct limits in result', async () => {
      const customLimits: RateLimitConfig = { perMinute: 50, perHour: 500 };
      const result = await cache.checkAndIncrement(orgId, customLimits);

      expect(result.limits.perMinute).toBe(50);
      expect(result.limits.perHour).toBe(500);
    });

    it('should include reset timestamps', async () => {
      const result = await cache.checkAndIncrement(orgId, defaultLimits);

      const now = Math.floor(Date.now() / 1000);

      // Minute reset should be within ~60 seconds
      expect(result.counts.minuteResetAt).toBeGreaterThan(now);
      expect(result.counts.minuteResetAt).toBeLessThanOrEqual(now + 65);

      // Hour reset should be within ~3600 seconds
      expect(result.counts.hourResetAt).toBeGreaterThan(now);
      expect(result.counts.hourResetAt).toBeLessThanOrEqual(now + 3665);
    });
  });

  describe('getCounts', () => {
    it('should return zero for new organization', async () => {
      const counts = await cache.getCounts('new-org');

      expect(counts.currentMinute).toBe(0);
      expect(counts.currentHour).toBe(0);
    });

    it('should return current counts without incrementing', async () => {
      await cache.checkAndIncrement(orgId, defaultLimits);
      await cache.checkAndIncrement(orgId, defaultLimits);

      const counts = await cache.getCounts(orgId);
      expect(counts.currentMinute).toBe(2);
      expect(counts.currentHour).toBe(2);

      // Verify getCounts doesn't increment
      const countsAgain = await cache.getCounts(orgId);
      expect(countsAgain.currentMinute).toBe(2);
      expect(countsAgain.currentHour).toBe(2);
    });
  });

  describe('clear', () => {
    it('should remove all counters', async () => {
      await cache.checkAndIncrement('org-1', defaultLimits);
      await cache.checkAndIncrement('org-2', defaultLimits);

      expect(cache.size).toBeGreaterThan(0);

      cache.clear();

      expect(cache.size).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle limit of 1', async () => {
      const limits: RateLimitConfig = { perMinute: 1, perHour: 1 };

      const first = await cache.checkAndIncrement(orgId, limits);
      expect(first.allowed).toBe(true);

      const second = await cache.checkAndIncrement(orgId, limits);
      expect(second.allowed).toBe(false);
    });

    it('should handle very high limits', async () => {
      const limits: RateLimitConfig = { perMinute: 1_000_000, perHour: 10_000_000 };

      const result = await cache.checkAndIncrement(orgId, limits);

      expect(result.allowed).toBe(true);
      expect(result.remainingMinute).toBe(999_999);
      expect(result.remainingHour).toBe(9_999_999);
    });

    it('should not return negative remaining', async () => {
      const limits: RateLimitConfig = { perMinute: 2, perHour: 100 };

      await cache.checkAndIncrement(orgId, limits);
      await cache.checkAndIncrement(orgId, limits);

      // At limit now
      const atLimit = await cache.getCounts(orgId);
      expect(atLimit.currentMinute).toBe(2);

      // Try to exceed - should be rejected
      const exceeded = await cache.checkAndIncrement(orgId, limits);
      expect(exceeded.allowed).toBe(false);
      expect(exceeded.remainingMinute).toBe(0);
      // Remaining should never be negative
      expect(exceeded.remainingMinute).toBeGreaterThanOrEqual(0);
      expect(exceeded.remainingHour).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Rate limiting behavior', () => {
  it('should enforce minute limit before hour limit', async () => {
    const cache = new InMemoryRateLimitCache();
    const limits: RateLimitConfig = { perMinute: 5, perHour: 1000 };

    // Exhaust minute limit
    for (let i = 0; i < 5; i++) {
      await cache.checkAndIncrement('org', limits);
    }

    const result = await cache.checkAndIncrement('org', limits);

    expect(result.allowed).toBe(false);
    expect(result.exceededLimit).toBe('minute');
  });

  it('should respect different limits for different orgs', async () => {
    const cache = new InMemoryRateLimitCache();
    const org1Limits: RateLimitConfig = { perMinute: 2, perHour: 100 };
    const org2Limits: RateLimitConfig = { perMinute: 100, perHour: 1000 };

    // org-1 hits its limit quickly
    await cache.checkAndIncrement('org-1', org1Limits);
    await cache.checkAndIncrement('org-1', org1Limits);
    const org1Result = await cache.checkAndIncrement('org-1', org1Limits);

    expect(org1Result.allowed).toBe(false);

    // org-2 with higher limits should still be allowed
    const org2Result = await cache.checkAndIncrement('org-2', org2Limits);
    expect(org2Result.allowed).toBe(true);
  });
});
