/**
 * Global rate limit cache instance management
 *
 * Follows the same pattern as api-keys.ts and idempotency.ts -
 * allows setting instances at startup and accessing from plugins.
 *
 * @module lib/rate-limit
 */

import type { IRateLimitCache } from '@popper/cache';
import { InMemoryRateLimitCache } from '@popper/cache';

/** Global rate limit cache instance */
let globalCache: IRateLimitCache = new InMemoryRateLimitCache();

/**
 * Set the global rate limit cache instance
 *
 * Should be called at startup with either Redis or in-memory cache.
 */
export function setRateLimitCache(cache: IRateLimitCache): void {
  globalCache = cache;
}

/**
 * Get the global rate limit cache instance
 */
export function getRateLimitCache(): IRateLimitCache {
  return globalCache;
}
