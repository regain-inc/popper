/**
 * Control Plane v2 Plugin
 *
 * Implements v2 control endpoints for managing Deutsch instance operational state.
 * Provides desired-state management, reconciliation, and v2 command generation.
 *
 * Endpoints (prefix: /v2/popper/control):
 * - GET  /state/:instance_id           — Get desired state for a Deutsch instance
 * - GET  /reconciliation/:instance_id  — Get reconciliation status
 * - POST /settings                     — Batch settings change
 * - POST /mode                         — Mode transition
 * - POST /reconciliation/:instance_id  — Trigger manual reconciliation
 *
 * @see 01-popper-control-plane-v2-spec.md §5.1
 * @module plugins/control-v2
 */

import { buildControlCommandV2 } from '@popper/core';
import { Elysia, t } from 'elysia';
import { getDeliveryManager, isDeliveryManagerInitialized } from '../lib/delivery-manager';
import { getDesiredStateManager } from '../lib/desired-state';
import { logger } from '../lib/logger';
import { createAuthGuard } from './api-key-auth';
import { createRateLimitGuard } from './rate-limit';

export const controlV2Plugin = new Elysia({
  name: 'control-v2',
  prefix: '/v2/popper/control',
})
  // ─── Read endpoints (control:read) ───
  .guard(createAuthGuard('control:read'), (app) =>
    app.guard(createRateLimitGuard(), (app) =>
      app
        /**
         * GET /v2/popper/control/state/:instance_id
         * Returns the current desired state for a Deutsch instance.
         */
        .get(
          '/state/:instance_id',
          async ({ params, query }) => {
            const manager = getDesiredStateManager();
            const state = await manager.getDesiredState(params.instance_id, query.organization_id);
            return state;
          },
          {
            params: t.Object({ instance_id: t.String() }),
            query: t.Object({ organization_id: t.String() }),
            detail: {
              summary: 'Get desired state for a Deutsch instance',
              tags: ['Control v2'],
            },
          },
        )

        /**
         * GET /v2/popper/control/reconciliation/:instance_id
         * Returns the last reconciliation result including divergences.
         */
        .get(
          '/reconciliation/:instance_id',
          async ({ params, query }) => {
            const manager = getDesiredStateManager();
            const state = await manager.getDesiredState(params.instance_id, query.organization_id);

            const lastActual = state.last_actual_state;

            if (!lastActual) {
              return {
                instance_id: params.instance_id,
                status: 'no_actual_state',
                last_reconciliation_at: state.last_reconciliation_at,
                divergences: null,
              };
            }

            const divergence = manager.computeDivergence(
              state,
              lastActual as Record<string, unknown>,
            );

            return {
              instance_id: params.instance_id,
              status:
                divergence.divergent_settings.length > 0 || divergence.mode_divergence
                  ? 'diverged'
                  : 'reconciled',
              last_reconciliation_at: state.last_reconciliation_at,
              divergences: divergence,
            };
          },
          {
            params: t.Object({ instance_id: t.String() }),
            query: t.Object({ organization_id: t.String() }),
            detail: {
              summary: 'Get reconciliation status for a Deutsch instance',
              tags: ['Control v2'],
            },
          },
        ),
    ),
  )
  // ─── Write endpoints (control:write) ───
  .guard(createAuthGuard('control:write'), (app) =>
    app.guard(createRateLimitGuard(), (app) =>
      app
        /**
         * POST /v2/popper/control/settings
         * Batch settings change — updates desired state and generates ControlCommandV2.
         */
        .post(
          '/settings',
          async ({ body }) => {
            const manager = getDesiredStateManager();

            // Update desired state
            await manager.updateDesiredState(body.target_instance_id, body.organization_id, {
              settings: body.settings.map((s) => ({
                key: s.key,
                value: s.value,
                reason: body.reason,
              })),
              triggered_by: `operator:${body.operator_id ?? 'api'}`,
            });

            logger.info`Control v2: settings updated for instance=${body.target_instance_id} keys=${body.settings.map((s) => s.key).join(',')}`;

            // Build and deliver ControlCommandV2
            let deliveryStatus = 'pending';
            if (isDeliveryManagerInitialized()) {
              const command = buildControlCommandV2(
                {
                  settings: body.settings.map((s) => ({
                    key: s.key,
                    value: s.value,
                    reason: body.reason,
                  })),
                  priority: (body.priority as 'ROUTINE' | 'URGENT' | 'EMERGENCY') ?? 'ROUTINE',
                },
                {
                  organizationId: body.organization_id,
                  instanceId: body.target_instance_id,
                  serviceVersion: '1.0.0',
                  operatorId: body.operator_id ?? 'api',
                },
              );
              const result = await getDeliveryManager().deliver(command);
              deliveryStatus = result.success ? 'delivered' : 'queued';
            }

            return {
              status: 'accepted',
              instance_id: body.target_instance_id,
              settings_count: body.settings.length,
              delivery_status: deliveryStatus,
            };
          },
          {
            body: t.Object({
              target_instance_id: t.String(),
              organization_id: t.String(),
              settings: t.Array(
                t.Object({
                  key: t.String(),
                  value: t.Unknown(),
                }),
              ),
              priority: t.Optional(t.String()),
              reason: t.String(),
              operator_id: t.Optional(t.String()),
            }),
            detail: {
              summary: 'Batch settings change',
              tags: ['Control v2'],
            },
          },
        )

        /**
         * POST /v2/popper/control/mode
         * Mode transition — updates desired state and generates ControlCommandV2.
         */
        .post(
          '/mode',
          async ({ body }) => {
            const manager = getDesiredStateManager();

            // Update desired state
            await manager.updateDesiredState(body.target_instance_id, body.organization_id, {
              mode: body.target_mode,
              triggered_by: `operator:${body.operator_id ?? 'api'}`,
            });

            logger.info`Control v2: mode transition for instance=${body.target_instance_id} target=${body.target_mode}`;

            // Build and deliver ControlCommandV2
            let deliveryStatus = 'pending';
            if (isDeliveryManagerInitialized()) {
              const command = buildControlCommandV2(
                {
                  mode_transition: {
                    target_mode: body.target_mode,
                    reason: body.reason,
                  },
                  priority: (body.priority as 'ROUTINE' | 'URGENT' | 'EMERGENCY') ?? 'URGENT',
                },
                {
                  organizationId: body.organization_id,
                  instanceId: body.target_instance_id,
                  serviceVersion: '1.0.0',
                  operatorId: body.operator_id ?? 'api',
                },
              );
              const result = await getDeliveryManager().deliver(command);
              deliveryStatus = result.success ? 'delivered' : 'queued';
            }

            return {
              status: 'accepted',
              instance_id: body.target_instance_id,
              target_mode: body.target_mode,
              delivery_status: deliveryStatus,
            };
          },
          {
            body: t.Object({
              target_instance_id: t.String(),
              organization_id: t.String(),
              target_mode: t.String(),
              reason: t.String(),
              operator_id: t.Optional(t.String()),
              priority: t.Optional(t.String()),
            }),
            detail: {
              summary: 'Mode transition',
              tags: ['Control v2'],
            },
          },
        )

        /**
         * POST /v2/popper/control/reconciliation/:instance_id
         * Trigger manual reconciliation.
         */
        .post(
          '/reconciliation/:instance_id',
          async ({ params, body }) => {
            logger.info`Control v2: manual reconciliation triggered for instance=${params.instance_id}`;

            let deliveryStatus = 'pending';
            if (isDeliveryManagerInitialized()) {
              try {
                await getDeliveryManager().triggerReconciliation(
                  params.instance_id,
                  body.organization_id,
                );
                deliveryStatus = 'delivered';
              } catch {
                deliveryStatus = 'failed';
              }
            }

            return {
              instance_id: params.instance_id,
              delivery_status: deliveryStatus,
              message: 'Reconciliation triggered. Command will be delivered via push channel.',
            };
          },
          {
            params: t.Object({ instance_id: t.String() }),
            body: t.Object({ organization_id: t.String() }),
            detail: {
              summary: 'Trigger manual reconciliation',
              tags: ['Control v2'],
            },
          },
        ),
    ),
  );
