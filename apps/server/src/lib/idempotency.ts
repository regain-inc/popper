/**
 * Global idempotency cache instance management
 *
 * Similar to audit emitter pattern - allows setting cache at startup
 * and accessing it from plugins without passing through context.
 *
 * @module lib/idempotency
 */

import type { IIdempotencyCache } from '@popper/cache';
import { InMemoryIdempotencyCache } from '@popper/cache';
import type { SupervisionResponse } from '@popper/core';

/** Global idempotency cache instance */
let globalCache: IIdempotencyCache<SupervisionResponse> = new InMemoryIdempotencyCache();

/**
 * Set the global idempotency cache instance
 */
export function setIdempotencyCache(cache: IIdempotencyCache<SupervisionResponse>): void {
  globalCache = cache;
}

/**
 * Get the global idempotency cache instance
 */
export function getIdempotencyCache(): IIdempotencyCache<SupervisionResponse> {
  return globalCache;
}
