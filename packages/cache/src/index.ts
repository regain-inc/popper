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
  BASELINE_CACHE_TTL_SECONDS,
  BASELINE_KEY_PREFIX,
  BaselineCache,
  type CachedBaseline,
  type IBaselineCache,
  InMemoryBaselineCache,
} from './baseline-cache';
export {
  CooldownTracker,
  type ICooldownTracker,
  InMemoryCooldownTracker,
} from './cooldown-tracker';
export {
  DRIFT_COUNTER_TTL_SECONDS,
  DRIFT_KEY_PREFIX,
  DRIFT_SIGNALS,
  DriftCounters,
  type DriftCounterValues,
  type DriftRates,
  type DriftSignal,
  type DriftSnapshot,
  formatPrometheusText,
  type IDriftCounters,
  InMemoryDriftCounters,
  type PrometheusMetric,
  toPrometheusMetrics,
} from './drift-counters';
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
export {
  InMemoryRateLimitCache,
  type IRateLimitCache,
  RateLimitCache,
  type RateLimitConfig,
  type RateLimitCounts,
  type RateLimitResult,
} from './rate-limit-cache';
