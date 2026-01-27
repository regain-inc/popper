/**
 * Control Plane Plugin
 *
 * Provides administrative endpoints for safe-mode management.
 * Protected by API Key authentication with control:read/control:write scopes.
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
import { createAuthGuard } from './api-key-auth';

/**
 * Control Plane Plugin
 *
 * Endpoints:
 * - GET  /v1/popper/control/safe-mode - Get current safe-mode state (requires control:read)
 * - POST /v1/popper/control/safe-mode - Change safe-mode state (requires control:write)
 * - GET  /v1/popper/control/safe-mode/history - Get safe-mode history (requires control:read)
 */
export const controlPlugin = new Elysia({ name: 'control', prefix: '/v1/popper/control' })
  // GET endpoints - require control:read scope
  .guard(createAuthGuard('control:read'), (app) =>
    app
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
            403: errorResponseSchema,
          },
          detail: {
            summary: 'Get safe-mode state',
            description: 'Returns current safe-mode state for organization (or global)',
            tags: ['Control Plane'],
          },
        },
      )
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
            403: errorResponseSchema,
          },
          detail: {
            summary: 'Get safe-mode history',
            description: 'Returns history of safe-mode changes for organization',
            tags: ['Control Plane'],
          },
        },
      ),
  )
  // POST endpoints - require control:write scope
  .guard(createAuthGuard('control:write'), (app) =>
    app.post(
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
          403: errorResponseSchema,
        },
        detail: {
          summary: 'Change safe-mode state',
          description: 'Enable or disable safe-mode for organization (or global)',
          tags: ['Control Plane'],
        },
      },
    ),
  );
