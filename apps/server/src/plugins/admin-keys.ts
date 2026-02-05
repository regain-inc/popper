/**
 * Admin Keys Plugin
 *
 * Provides endpoints for API key management:
 * - POST /v1/popper/admin/keys - Create a new API key
 * - GET /v1/popper/admin/keys - List keys for organization
 * - POST /v1/popper/admin/keys/:id/revoke - Revoke a key
 *
 * All endpoints require admin:keys:read or admin:keys:write scope.
 *
 * @module plugins/admin-keys
 */

import type { ApiKeyContext, ApiKeyScope } from '@popper/core';
import { Elysia, t } from 'elysia';
import { getApiKeyService, isApiKeyServiceInitialized } from '../lib/api-keys';
import { logger } from '../lib/logger';
import {
  createApiKeyRequestSchema,
  createApiKeyResponseSchema,
  errorResponseSchema,
  listApiKeysResponseSchema,
  revokeApiKeyResponseSchema,
} from '../lib/schemas';
import { createAuthGuard } from './api-key-auth';
import { createRateLimitGuard } from './rate-limit';

/**
 * Context with authenticated API key
 * Used for type assertions in handlers protected by auth guard
 */
interface AuthenticatedContext {
  apiKey: ApiKeyContext | null;
}

/**
 * Admin Keys Plugin
 *
 * Requires API key authentication with appropriate scopes.
 */
export const adminKeysPlugin = new Elysia({ name: 'admin-keys', prefix: '/v1/popper/admin' })
  // GET /keys - List API keys (requires admin:keys:read)
  .guard(createAuthGuard('admin:keys:read'), (app) =>
    app.guard(createRateLimitGuard(), (app) =>
      app.get(
        '/keys',
        async (ctx) => {
          const { apiKey } = ctx as unknown as AuthenticatedContext;
          const { query, set } = ctx;
          if (!isApiKeyServiceInitialized()) {
            logger.error`API key service not initialized`;
            set.status = 500;
            return { error: 'internal_error', message: 'API key service not available' };
          }

          const service = getApiKeyService();

          try {
            // apiKey is guaranteed non-null by guard's beforeHandle
            if (!apiKey) throw new Error('Unreachable: apiKey is null after auth guard');
            const authenticatedKey = apiKey;
            // Type assertion needed because ctx destructuring loses query schema types
            const typedQuery = query as { include_revoked?: boolean; limit?: number };
            const keys = await service.listByOrganization(authenticatedKey.organizationId, {
              includeRevoked: typedQuery.include_revoked ?? false,
              limit: typedQuery.limit ?? 100,
            });

            return {
              organization_id: authenticatedKey.organizationId,
              keys: keys.map((k) => ({
                id: k.id,
                key_prefix: k.keyPrefix,
                name: k.name,
                scopes: k.scopes,
                rate_limit_rpm: k.rateLimitRpm,
                created_at: k.createdAt.toISOString(),
                expires_at: k.expiresAt?.toISOString() ?? null,
                revoked_at: k.revokedAt?.toISOString() ?? null,
                last_used_at: k.lastUsedAt?.toISOString() ?? null,
                created_by: k.createdBy,
              })),
            };
          } catch (error) {
            logger.error`Failed to list API keys: ${error}`;
            set.status = 500;
            return { error: 'internal_error', message: 'Failed to list API keys' };
          }
        },
        {
          query: t.Object({
            include_revoked: t.Optional(t.Boolean({ description: 'Include revoked keys' })),
            limit: t.Optional(
              t.Number({ description: 'Max keys to return', minimum: 1, maximum: 1000 }),
            ),
          }),
          response: {
            200: listApiKeysResponseSchema,
            401: errorResponseSchema,
            403: errorResponseSchema,
            429: errorResponseSchema,
            500: errorResponseSchema,
          },
          detail: {
            summary: 'List API keys',
            description: 'List all API keys for the organization',
            tags: ['Admin - API Keys'],
          },
        },
      ),
    ),
  )
  // POST /keys - Create a new API key (requires admin:keys:write)
  // POST /keys/:id/revoke - Revoke a key (requires admin:keys:write)
  .guard(createAuthGuard('admin:keys:write'), (app) =>
    app.guard(createRateLimitGuard(), (app) =>
      app
        .post(
          '/keys',
          async (ctx) => {
            const { apiKey } = ctx as unknown as AuthenticatedContext;
            const { body, set } = ctx;
            if (!isApiKeyServiceInitialized()) {
              logger.error`API key service not initialized`;
              set.status = 500;
              return { error: 'internal_error', message: 'API key service not available' };
            }

            const service = getApiKeyService();

            try {
              // apiKey is guaranteed non-null by guard's beforeHandle
              if (!apiKey) throw new Error('Unreachable: apiKey is null after auth guard');
              const authenticatedKey = apiKey;
              const result = await service.create({
                organizationId: authenticatedKey.organizationId,
                name: body.name,
                scopes: body.scopes as ApiKeyScope[],
                rateLimitRpm: body.rate_limit_rpm,
                expiresAt: body.expires_at ? new Date(body.expires_at) : undefined,
                createdBy: authenticatedKey.keyId,
                metadata: body.metadata,
              });

              logger.info`API key created: id=${result.id} name="${body.name}" org=${authenticatedKey.organizationId}`;

              return {
                id: result.id,
                plaintext_key: result.plaintextKey,
                key_prefix: result.keyPrefix,
                name: body.name,
                scopes: body.scopes,
                rate_limit_rpm: body.rate_limit_rpm ?? null,
                created_at: result.createdAt.toISOString(),
                expires_at: body.expires_at ?? null,
              };
            } catch (error) {
              logger.error`Failed to create API key: ${error}`;
              set.status = 500;
              return { error: 'internal_error', message: 'Failed to create API key' };
            }
          },
          {
            body: createApiKeyRequestSchema,
            response: {
              200: createApiKeyResponseSchema,
              401: errorResponseSchema,
              403: errorResponseSchema,
              429: errorResponseSchema,
              500: errorResponseSchema,
            },
            detail: {
              summary: 'Create API key',
              description:
                'Create a new API key for the organization. The plaintext key is only returned once!',
              tags: ['Admin - API Keys'],
            },
          },
        )
        .post(
          '/keys/:id/revoke',
          async (ctx) => {
            const { apiKey } = ctx as unknown as AuthenticatedContext;
            const { params, set } = ctx;
            if (!isApiKeyServiceInitialized()) {
              logger.error`API key service not initialized`;
              set.status = 500;
              return { error: 'internal_error', message: 'API key service not available' };
            }

            const service = getApiKeyService();

            try {
              const existingKey = await service.getById(params.id);

              if (!existingKey) {
                set.status = 404;
                return { error: 'not_found', message: 'API key not found' };
              }

              // apiKey is guaranteed non-null by guard's beforeHandle
              if (!apiKey) throw new Error('Unreachable: apiKey is null after auth guard');
              const authenticatedKey = apiKey;
              if (existingKey.organizationId !== authenticatedKey.organizationId) {
                set.status = 404;
                return { error: 'not_found', message: 'API key not found' };
              }

              const revoked = await service.revoke(params.id);

              if (!revoked) {
                return {
                  id: params.id,
                  revoked: false,
                  revoked_at: existingKey.revokedAt?.toISOString() ?? null,
                };
              }

              logger.info`API key revoked: id=${params.id} org=${authenticatedKey.organizationId}`;

              return {
                id: params.id,
                revoked: true,
                revoked_at: new Date().toISOString(),
              };
            } catch (error) {
              logger.error`Failed to revoke API key: ${error}`;
              set.status = 500;
              return { error: 'internal_error', message: 'Failed to revoke API key' };
            }
          },
          {
            params: t.Object({
              id: t.String({ description: 'API key ID to revoke' }),
            }),
            response: {
              200: revokeApiKeyResponseSchema,
              401: errorResponseSchema,
              403: errorResponseSchema,
              404: errorResponseSchema,
              429: errorResponseSchema,
              500: errorResponseSchema,
            },
            detail: {
              summary: 'Revoke API key',
              description: 'Revoke an API key. The key will be immediately invalidated.',
              tags: ['Admin - API Keys'],
            },
          },
        ),
    ),
  );
