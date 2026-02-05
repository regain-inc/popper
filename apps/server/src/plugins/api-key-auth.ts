/**
 * API Key Authentication Plugin
 *
 * Elysia plugin that validates API keys from the X-API-Key header.
 * Uses Redis cache for fast validation with database fallback.
 *
 * Features:
 * - SHA-256 hashed key validation
 * - 5-minute cache TTL
 * - Scope-based authorization guards
 * - Development bypass when NODE_ENV !== 'production'
 *
 * @module plugins/api-key-auth
 */

import type { CachedApiKeyContext } from '@popper/cache';
import { type ApiKeyContext, type ApiKeyScope, hashApiKey, isValidKeyFormat } from '@popper/core';
import { getApiKeyCache, getApiKeyService, isApiKeyServiceInitialized } from '../lib/api-keys';
import { logger } from '../lib/logger';

/** Header name for API key */
const API_KEY_HEADER = 'x-api-key';

/** System organization ID that has access to all organizations */
const SYSTEM_ORG_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Development mode context for bypassing auth
 * Uses SYSTEM_ORG_ID to allow access to all organizations in development
 */
const DEV_CONTEXT: ApiKeyContext = {
  keyId: 'dev-key',
  organizationId: SYSTEM_ORG_ID,
  keyName: 'Development Key',
  scopes: [
    'supervision:write',
    'control:read',
    'control:write',
    'admin:keys:read',
    'admin:keys:write',
    'admin:orgs:read',
    'admin:orgs:write',
  ],
  rateLimitRpm: null,
};

/**
 * Convert cached context to ApiKeyContext
 */
function cachedContextToApiKeyContext(cached: CachedApiKeyContext): ApiKeyContext {
  return {
    keyId: cached.keyId,
    organizationId: cached.organizationId,
    keyName: cached.keyName,
    scopes: cached.scopes as ApiKeyScope[],
    rateLimitRpm: cached.rateLimitRpm,
  };
}

/**
 * Validate API key and return context or error
 */
async function validateApiKey(headers: Record<string, string | undefined>): Promise<{
  apiKey: ApiKeyContext | null;
  apiKeyError: { error: string; message: string } | null;
}> {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const providedKey = headers[API_KEY_HEADER];

  // Development bypass: allow requests without API key
  if (nodeEnv !== 'production' && !providedKey) {
    return {
      apiKey: DEV_CONTEXT,
      apiKeyError: null,
    };
  }

  // Production or key provided: validate the key
  if (!providedKey) {
    return {
      apiKey: null,
      apiKeyError: { error: 'unauthorized', message: 'Missing API key' },
    };
  }

  // Validate key format
  if (!isValidKeyFormat(providedKey)) {
    return {
      apiKey: null,
      apiKeyError: { error: 'unauthorized', message: 'Invalid API key format' },
    };
  }

  const keyHash = hashApiKey(providedKey);

  // Check cache first
  const cache = getApiKeyCache();
  const cachedContext = await cache.get(keyHash);

  if (cachedContext) {
    return {
      apiKey: cachedContextToApiKeyContext(cachedContext),
      apiKeyError: null,
    };
  }

  // Cache miss - validate against database
  if (!isApiKeyServiceInitialized()) {
    logger.warning`API key service not initialized, rejecting request`;
    return {
      apiKey: null,
      apiKeyError: { error: 'unauthorized', message: 'API key validation unavailable' },
    };
  }

  const service = getApiKeyService();
  const validationResult = await service.validate(providedKey);

  if (!validationResult.valid) {
    const errorMessages: Record<string, string> = {
      invalid_key: 'Invalid API key',
      expired: 'API key expired',
      revoked: 'API key revoked',
      not_found: 'API key not found',
    };

    return {
      apiKey: null,
      apiKeyError: {
        error: 'unauthorized',
        message: errorMessages[validationResult.error] ?? 'Invalid API key',
      },
    };
  }

  // Valid key - cache the context
  const contextToCache: CachedApiKeyContext = {
    keyId: validationResult.context.keyId,
    organizationId: validationResult.context.organizationId,
    keyName: validationResult.context.keyName,
    scopes: validationResult.context.scopes,
    rateLimitRpm: validationResult.context.rateLimitRpm,
    cachedAt: new Date().toISOString(),
  };

  // Fire-and-forget: cache the context and update last used
  cache.set(keyHash, contextToCache).catch((err) => {
    logger.warning`Failed to cache API key context: ${err}`;
  });

  service.updateLastUsed(validationResult.context.keyId).catch((err) => {
    logger.warning`Failed to update API key last_used_at: ${err}`;
  });

  return {
    apiKey: validationResult.context,
    apiKeyError: null,
  };
}

/**
 * Create a guard configuration that validates API keys and checks scopes
 *
 * The guard:
 * 1. Resolves apiKey and apiKeyError from the X-API-Key header
 * 2. Checks authentication in beforeHandle, returning 401 if key is invalid
 * 3. Checks required scopes, returning 403 if scope is missing
 *
 * IMPORTANT: Use `resolve` (not `derive`) because we need the values in `beforeHandle`.
 * Elysia's lifecycle order: beforeHandle -> resolve -> handler
 * Guard's resolve runs BEFORE its beforeHandle, making values available.
 *
 * @param requiredScopes - Scopes that must be present on the API key
 * @returns A guard configuration object for use with .guard()
 *
 * @example
 * ```typescript
 * export const myPlugin = new Elysia()
 *   .guard(
 *     createAuthGuard('supervision:write'),
 *     (app) => app.post('/endpoint', ({ apiKey }) => {
 *       // apiKey is guaranteed to be valid with supervision:write scope
 *     })
 *   );
 * ```
 */
// biome-ignore lint/suspicious/noExplicitAny: Elysia guard types are incompatible with resolved context
export function createAuthGuard(...requiredScopes: ApiKeyScope[]): any {
  return {
    async resolve({ headers }: { headers: Record<string, string | undefined> }) {
      return await validateApiKey(headers);
    },
    beforeHandle({
      apiKey,
      apiKeyError,
      set,
    }: {
      apiKey: ApiKeyContext | null;
      apiKeyError: { error: string; message: string } | null;
      set: { status: number };
    }) {
      // Check authentication
      if (!apiKey) {
        set.status = 401;
        return apiKeyError ?? { error: 'unauthorized', message: 'Invalid or missing API key' };
      }

      // Check scopes if required
      if (requiredScopes.length > 0) {
        const missingScopes = requiredScopes.filter((scope) => !apiKey.scopes.includes(scope));

        if (missingScopes.length > 0) {
          set.status = 403;
          return {
            error: 'forbidden',
            message: `Missing required scopes: ${missingScopes.join(', ')}`,
          };
        }
      }

      return undefined;
    },
  };
}

// Re-export types for consumers
export type { ApiKeyContext, ApiKeyScope };
