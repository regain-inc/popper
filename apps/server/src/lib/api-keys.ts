/**
 * Global API key service and cache instance management
 *
 * Follows the same pattern as idempotency.ts and safe-mode.ts -
 * allows setting instances at startup and accessing from plugins.
 *
 * @module lib/api-keys
 */

import type { IApiKeyCache } from '@popper/cache';
import { InMemoryApiKeyCache } from '@popper/cache';
import type { ApiKeyService } from '@popper/db';

/** Global API key service instance */
let globalService: ApiKeyService | null = null;

/** Global API key cache instance */
let globalCache: IApiKeyCache = new InMemoryApiKeyCache();

/**
 * Initialize the global API key service
 *
 * Must be called at startup with the database connection.
 */
export function initApiKeyService(service: ApiKeyService): void {
  globalService = service;
}

/**
 * Get the global API key service instance
 *
 * @throws Error if service not initialized
 */
export function getApiKeyService(): ApiKeyService {
  if (!globalService) {
    throw new Error('ApiKeyService not initialized. Call initApiKeyService() first.');
  }
  return globalService;
}

/**
 * Check if API key service is initialized
 */
export function isApiKeyServiceInitialized(): boolean {
  return globalService !== null;
}

/**
 * Set the global API key cache instance
 */
export function setApiKeyCache(cache: IApiKeyCache): void {
  globalCache = cache;
}

/**
 * Get the global API key cache instance
 */
export function getApiKeyCache(): IApiKeyCache {
  return globalCache;
}
