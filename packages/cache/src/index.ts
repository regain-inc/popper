/**
 * @popper/cache - Caching utilities for Popper
 *
 * Provides Redis-based and in-memory caching implementations
 * for idempotency, rate limiting, and general caching needs.
 *
 * @module @popper/cache
 */

export {
  ApiKeyCache,
  type ApiKeyCacheConfig,
  type CachedApiKeyContext,
  DEFAULT_API_KEY_CACHE_TTL_SECONDS,
  type IApiKeyCache,
  InMemoryApiKeyCache,
} from './api-key-cache';

export {
  type CachedEntry,
  computeRequestHash,
  DEFAULT_IDEMPOTENCY_TTL_SECONDS,
  IdempotencyCache,
  type IdempotencyCacheConfig,
  type IdempotencyCheckResult,
  type IIdempotencyCache,
  InMemoryIdempotencyCache,
} from './idempotency-cache';
