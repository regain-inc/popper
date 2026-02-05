/**
 * Rate Limit Guard Plugin
 *
 * Enforces per-tenant rate limiting using Redis counters.
 * Must be applied AFTER auth guard to have access to apiKey context.
 *
 * Rate limit priority:
 * 1. API key override (rateLimitRpm if set)
 * 2. Organization defaults (rateLimitPerMinute, rateLimitPerHour)
 *
 * Failure mode: Fail-open (allow request if Redis unavailable)
 *
 * @module plugins/rate-limit
 */

import type { RateLimitConfig } from '@popper/cache';
import type { ApiKeyContext } from '@popper/core';
import { logger } from '../lib/logger';
import { getOrganizationService, isOrganizationServiceInitialized } from '../lib/organizations';
import { getRateLimitCache } from '../lib/rate-limit';

/** Default rate limits (fallback if org service unavailable) */
const DEFAULT_LIMITS: RateLimitConfig = {
  perMinute: 1000,
  perHour: 50000,
};

/**
 * Get rate limits for a request
 *
 * Priority:
 * 1. API key override (rateLimitRpm converts to perMinute, perHour calculated)
 * 2. Organization defaults
 * 3. System defaults
 */
async function getRateLimits(apiKey: ApiKeyContext): Promise<RateLimitConfig> {
  // Check for API key override first
  if (apiKey.rateLimitRpm !== null && apiKey.rateLimitRpm !== undefined) {
    // API key has RPM override - calculate hourly as 60x the minute limit
    return {
      perMinute: apiKey.rateLimitRpm,
      perHour: apiKey.rateLimitRpm * 60,
    };
  }

  // Try to get organization limits
  if (isOrganizationServiceInitialized()) {
    try {
      const orgService = getOrganizationService();
      const org = await orgService.getById(apiKey.organizationId);

      if (org) {
        return {
          perMinute: org.rateLimitPerMinute,
          perHour: org.rateLimitPerHour,
        };
      }
    } catch (error) {
      logger.warning`Failed to get org limits for rate limiting: ${error}`;
    }
  }

  // Fall back to defaults
  return DEFAULT_LIMITS;
}

/**
 * Create a rate limit guard configuration
 *
 * The guard:
 * 1. Gets rate limits from API key override or org defaults
 * 2. Atomically checks and increments Redis counters
 * 3. Sets X-RateLimit-* headers on all responses
 * 4. Returns 429 with Retry-After header if limit exceeded
 *
 * IMPORTANT: Must be applied AFTER createAuthGuard() so apiKey is available.
 *
 * @example
 * ```typescript
 * export const myPlugin = new Elysia()
 *   .guard(createAuthGuard('supervision:write'), (app) =>
 *     app.guard(createRateLimitGuard(), (app) =>
 *       app.post('/endpoint', ...)
 *     )
 *   );
 * ```
 */
// biome-ignore lint/suspicious/noExplicitAny: Elysia guard types are incompatible with resolved context
export function createRateLimitGuard(): any {
  return {
    beforeHandle: async ({
      apiKey,
      set,
    }: {
      apiKey: ApiKeyContext | null;
      set: { status: number; headers: Record<string, string> };
    }) => {
      // Skip rate limiting if no API key (shouldn't happen after auth guard)
      if (!apiKey) {
        return undefined;
      }

      const cache = getRateLimitCache();
      const limits = await getRateLimits(apiKey);

      try {
        const result = await cache.checkAndIncrement(apiKey.organizationId, limits);

        // Always set rate limit headers (using minute window as primary)
        set.headers['X-RateLimit-Limit'] = String(limits.perMinute);
        set.headers['X-RateLimit-Remaining'] = String(result.remainingMinute);
        set.headers['X-RateLimit-Reset'] = String(result.counts.minuteResetAt);

        if (!result.allowed) {
          set.status = 429;
          set.headers['Retry-After'] = String(result.retryAfterSeconds ?? 60);

          logger.warning`Rate limit exceeded for org=${apiKey.organizationId} limit=${result.exceededLimit}`;

          return {
            error: 'rate_limited',
            message: `Rate limit exceeded. Try again in ${result.retryAfterSeconds ?? 60} seconds.`,
          };
        }
      } catch (error) {
        // Fail-open: allow request if rate limiting fails (e.g., Redis unavailable)
        logger.warning`Rate limit check failed, allowing request: ${error}`;
      }

      return undefined;
    },
  };
}
