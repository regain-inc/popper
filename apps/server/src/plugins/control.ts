/**
 * Control Plane Plugin
 *
 * Provides administrative endpoints for safe-mode management.
 * Protected by API Key authentication.
 *
 * @module plugins/control
 */

import { GLOBAL_ORG_ID } from '@popper/core';
import { Elysia, t } from 'elysia';
import { logger } from '../lib/logger';
import { getSafeModeManager } from '../lib/safe-mode';
import {
  errorResponseSchema,
  safeModeChangeRequestSchema,
  safeModeHistoryResponseSchema,
  safeModeStateSchema,
} from '../lib/schemas';

/**
 * API Key authentication guard
 *
 * Validates X-Popper-Admin-Key header against configured key.
 * Returns 401 if key is missing or invalid.
 *
 * Note: Reads from process.env directly for testability.
 */
function validateApiKey(headers: Record<string, string | undefined>): boolean {
  const configuredKey = process.env.POPPER_ADMIN_API_KEY;
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  if (!configuredKey) {
    // No key configured - deny all requests in production
    if (nodeEnv === 'production') {
      return false;
    }
    // Allow in development/test without key
    return true;
  }

  const providedKey = headers['x-popper-admin-key'];
  return providedKey === configuredKey;
}

/**
 * Control Plane Plugin
 *
 * Endpoints:
 * - GET  /v1/popper/control/safe-mode - Get current safe-mode state
 * - POST /v1/popper/control/safe-mode - Change safe-mode state
 * - GET  /v1/popper/control/safe-mode/history - Get safe-mode history
 */
export const controlPlugin = new Elysia({ name: 'control', prefix: '/v1/popper/control' })
  // Apply API Key guard to all routes in this plugin
  .derive(({ headers, set }) => {
    if (!validateApiKey(headers)) {
      set.status = 401;
      return {
        authorized: false,
        authError: { error: 'unauthorized', message: 'Invalid or missing API key' },
      };
    }
    return { authorized: true, authError: null };
  })
  // Guard middleware - check authorization
  .onBeforeHandle(({ authorized, authError, set }) => {
    if (!authorized) {
      set.status = 401;
      return authError;
    }
  })
  // GET /safe-mode - Get current state
  .get(
    '/safe-mode',
    async ({ query }) => {
      const manager = getSafeModeManager();
      const state = await manager.snapshot(query.organization_id);

      return state;
    },
    {
      query: t.Object({
        organization_id: t.Optional(t.String()),
      }),
      response: {
        200: safeModeStateSchema,
        401: errorResponseSchema,
      },
      detail: {
        summary: 'Get safe-mode state',
        description: 'Returns current safe-mode state for organization (or global)',
        tags: ['Control Plane'],
      },
    },
  )
  // POST /safe-mode - Change state
  .post(
    '/safe-mode',
    async ({ body }) => {
      const manager = getSafeModeManager();

      logger.info`Safe-mode change requested: enabled=${body.enabled} reason="${body.reason}" org=${body.organization_id ?? GLOBAL_ORG_ID}`;

      const state = await manager.setState({
        enabled: body.enabled,
        reason: body.reason,
        triggered_by: body.triggered_by ?? 'manual',
        organization_id: body.organization_id,
        actor_id: body.actor_id,
        incident_id: body.incident_id,
        effective_at: body.effective_at,
      });

      logger.info`Safe-mode ${state.enabled ? 'enabled' : 'disabled'} for org=${state.organization_id}`;

      return state;
    },
    {
      body: safeModeChangeRequestSchema,
      response: {
        200: safeModeStateSchema,
        401: errorResponseSchema,
      },
      detail: {
        summary: 'Change safe-mode state',
        description: 'Enable or disable safe-mode for organization (or global)',
        tags: ['Control Plane'],
      },
    },
  )
  // GET /safe-mode/history - Get history
  .get(
    '/safe-mode/history',
    async ({ query }) => {
      const manager = getSafeModeManager();
      const orgId = query.organization_id ?? GLOBAL_ORG_ID;
      const limit = query.limit ?? 100;

      const entries = await manager.getHistory(orgId, limit);

      return {
        organization_id: orgId,
        entries,
      };
    },
    {
      query: t.Object({
        organization_id: t.Optional(t.String()),
        limit: t.Optional(t.Number({ minimum: 1, maximum: 1000 })),
      }),
      response: {
        200: safeModeHistoryResponseSchema,
        401: errorResponseSchema,
      },
      detail: {
        summary: 'Get safe-mode history',
        description: 'Returns history of safe-mode changes for organization',
        tags: ['Control Plane'],
      },
    },
  );
