/**
 * Control Plane Plugin
 *
 * Provides administrative endpoints for safe-mode, settings, and baseline management.
 * Protected by API Key authentication with control:read/control:write scopes.
 *
 * @module plugins/control
 */

import { GLOBAL_ORG_ID, isValidSettingsKey, type SettingsKey, SYSTEM_ORG_ID } from '@popper/core';
import { Elysia, t } from 'elysia';
import { getBaselineCalculator, isBaselineCalculatorInitialized } from '../lib/baselines';
import { logger } from '../lib/logger';
import { getSafeModeManager } from '../lib/safe-mode';
import {
  effectiveSettingsResponseSchema,
  errorResponseSchema,
  operationalSettingSchema,
  safeModeChangeRequestSchema,
  safeModeHistoryResponseSchema,
  safeModeStateSchema,
  settingsChangeRequestSchema,
  settingsHistoryResponseSchema,
  settingsKeySchema,
  singleSettingResponseSchema,
} from '../lib/schemas';
import { getSettingsManager } from '../lib/settings';
import { createAuthGuard } from './api-key-auth';
import { createRateLimitGuard } from './rate-limit';

/**
 * Control Plane Plugin
 *
 * Endpoints:
 * - GET  /v1/popper/control/safe-mode - Get current safe-mode state (requires control:read)
 * - POST /v1/popper/control/safe-mode - Change safe-mode state (requires control:write)
 * - GET  /v1/popper/control/safe-mode/history - Get safe-mode history (requires control:read)
 * - GET  /v1/popper/control/settings - Get all settings for organization (requires control:read)
 * - GET  /v1/popper/control/settings/effective - Get effective settings with inheritance (requires control:read)
 * - GET  /v1/popper/control/settings/:key - Get specific setting (requires control:read)
 * - POST /v1/popper/control/settings - Update a setting (requires control:write)
 * - GET  /v1/popper/control/settings/history - Get settings change history (requires control:read)
 */
export const controlPlugin = new Elysia({ name: 'control', prefix: '/v1/popper/control' })
  // GET endpoints - require control:read scope
  .guard(createAuthGuard('control:read'), (app) =>
    app.guard(createRateLimitGuard(), (app) =>
      app
        // Safe-mode endpoints
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
              429: errorResponseSchema,
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
              429: errorResponseSchema,
            },
            detail: {
              summary: 'Get safe-mode history',
              description: 'Returns history of safe-mode changes for organization',
              tags: ['Control Plane'],
            },
          },
        )
        // Settings endpoints (GET)
        .get(
          '/settings',
          async ({ query }) => {
            const manager = getSettingsManager();
            const orgId = query.organization_id ?? null;
            const settings = await manager.getAllSettings(orgId);

            return {
              organization_id: orgId,
              settings,
            };
          },
          {
            query: t.Object({
              organization_id: t.Optional(t.String()),
            }),
            response: {
              200: t.Object({
                organization_id: t.Nullable(t.String()),
                settings: t.Record(t.String(), t.Unknown()),
              }),
              401: errorResponseSchema,
              403: errorResponseSchema,
              429: errorResponseSchema,
            },
            detail: {
              summary: 'Get all settings',
              description:
                'Returns all settings for organization (direct values only, no inheritance)',
              tags: ['Control Plane'],
            },
          },
        )
        .get(
          '/settings/effective',
          async ({ query }) => {
            const manager = getSettingsManager();
            const orgId = query.organization_id ?? null;
            const effective = await manager.getEffectiveSettings(orgId);

            return effective;
          },
          {
            query: t.Object({
              organization_id: t.Optional(t.String()),
            }),
            response: {
              200: effectiveSettingsResponseSchema,
              401: errorResponseSchema,
              403: errorResponseSchema,
              429: errorResponseSchema,
            },
            detail: {
              summary: 'Get effective settings',
              description: 'Returns effective settings with inheritance (org overrides global)',
              tags: ['Control Plane'],
            },
          },
        )
        .get(
          '/settings/history',
          async ({ query, set }) => {
            if (!query.key || !isValidSettingsKey(query.key)) {
              set.status = 400;
              return {
                error: 'invalid_key',
                message: `Invalid settings key: ${query.key}`,
              };
            }

            const manager = getSettingsManager();
            const orgId = query.organization_id ?? null;
            const limit = query.limit ?? 100;

            const entries = await manager.getHistory(orgId, query.key as SettingsKey, limit);

            return {
              organization_id: orgId,
              key: query.key,
              entries: entries.map((e) => ({
                id: e.id,
                organization_id: e.organization_id,
                key: e.key,
                value: e.value,
                effective_at: e.effective_at.toISOString(),
                created_by: e.created_by,
                reason: e.reason,
                created_at: e.created_at.toISOString(),
              })),
            };
          },
          {
            query: t.Object({
              organization_id: t.Optional(t.String()),
              key: settingsKeySchema,
              limit: t.Optional(t.Number({ minimum: 1, maximum: 1000 })),
            }),
            response: {
              200: settingsHistoryResponseSchema,
              400: errorResponseSchema,
              401: errorResponseSchema,
              403: errorResponseSchema,
              429: errorResponseSchema,
            },
            detail: {
              summary: 'Get settings history',
              description: 'Returns history of changes for a specific setting',
              tags: ['Control Plane'],
            },
          },
        )
        .get(
          '/settings/:key',
          async ({ params, query, set }) => {
            if (!isValidSettingsKey(params.key)) {
              set.status = 400;
              return {
                error: 'invalid_key',
                message: `Invalid settings key: ${params.key}`,
              };
            }

            const manager = getSettingsManager();
            const orgId = query.organization_id ?? null;
            const effective = await manager.getEffectiveSettings(orgId);

            return {
              organization_id: orgId,
              key: params.key,
              value: effective.values[params.key as SettingsKey],
              source: effective.sources[params.key as SettingsKey],
            };
          },
          {
            params: t.Object({
              key: t.String(),
            }),
            query: t.Object({
              organization_id: t.Optional(t.String()),
            }),
            response: {
              200: singleSettingResponseSchema,
              400: errorResponseSchema,
              401: errorResponseSchema,
              403: errorResponseSchema,
              429: errorResponseSchema,
            },
            detail: {
              summary: 'Get specific setting',
              description: 'Returns effective value and source for a specific setting',
              tags: ['Control Plane'],
            },
          },
        ),
    ),
  )
  // POST endpoints - require control:write scope
  .guard(createAuthGuard('control:write'), (app) =>
    app.guard(createRateLimitGuard(), (app) =>
      app
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
              403: errorResponseSchema,
              429: errorResponseSchema,
            },
            detail: {
              summary: 'Change safe-mode state',
              description: 'Enable or disable safe-mode for organization (or global)',
              tags: ['Control Plane'],
            },
          },
        )
        .post(
          '/settings',
          async ({ body, query, apiKey, set }) => {
            if (!isValidSettingsKey(body.key)) {
              set.status = 400;
              return {
                error: 'invalid_key',
                message: `Invalid settings key: ${body.key}`,
              };
            }

            const manager = getSettingsManager();
            const orgId = query.organization_id ?? null;

            // Get actor from API key context
            const createdBy = apiKey?.keyName ?? 'system';

            logger.info`Settings change requested: key=${body.key} org=${orgId ?? 'global'} by=${createdBy}`;

            const setting = await manager.setSetting({
              organization_id: orgId,
              key: body.key as SettingsKey,
              value: body.value,
              created_by: createdBy,
              reason: body.reason,
              effective_at: body.effective_at ? new Date(body.effective_at) : undefined,
            });

            logger.info`Setting ${body.key} updated for org=${orgId ?? 'global'}`;

            return {
              id: setting.id,
              organization_id: setting.organization_id,
              key: setting.key,
              value: setting.value,
              effective_at: setting.effective_at.toISOString(),
              created_by: setting.created_by,
              reason: setting.reason,
              created_at: setting.created_at.toISOString(),
            };
          },
          {
            body: settingsChangeRequestSchema,
            query: t.Object({
              organization_id: t.Optional(t.String()),
            }),
            response: {
              200: operationalSettingSchema,
              400: errorResponseSchema,
              401: errorResponseSchema,
              403: errorResponseSchema,
              429: errorResponseSchema,
            },
            detail: {
              summary: 'Update setting',
              description: 'Create a new version of a setting (append-only)',
              tags: ['Control Plane'],
            },
          },
        )
        // Baseline endpoints (POST)
        .post(
          '/baselines/calculate',
          async ({ query, set }) => {
            if (!isBaselineCalculatorInitialized()) {
              set.status = 503;
              return {
                error: 'service_unavailable',
                message: 'Baseline calculator not initialized. Requires PostgreSQL.',
              };
            }

            const calculator = getBaselineCalculator();
            const orgId = query.organization_id ?? SYSTEM_ORG_ID;
            const triggeredBy =
              (query.triggered_by as 'scheduled' | 'manual' | 'model_update') ?? 'manual';

            logger.info`Baseline calculation requested: org=${orgId} triggered_by=${triggeredBy}`;

            try {
              const snapshot = await calculator.calculateBaseline(orgId, triggeredBy);

              logger.info`Baseline calculated: org=${orgId} days=${snapshot.daysIncluded} signals=${Object.keys(snapshot.signals).length}`;

              return {
                organization_id: snapshot.organizationId,
                calculated_at: snapshot.calculatedAt.toISOString(),
                window_start: snapshot.windowStart.toISOString(),
                window_end: snapshot.windowEnd.toISOString(),
                days_included: snapshot.daysIncluded,
                signals: Object.fromEntries(
                  Object.entries(snapshot.signals).map(([k, v]) => [
                    k,
                    {
                      baseline_value: v.baselineValue,
                      warning_threshold: v.warningThreshold,
                      critical_threshold: v.criticalThreshold,
                      sample_count: v.sampleCount,
                      std_dev: v.stdDev,
                    },
                  ]),
                ),
                rates: Object.fromEntries(
                  Object.entries(snapshot.rates).map(([k, v]) => [
                    k,
                    v
                      ? {
                          baseline_value: v.baselineValue,
                          warning_threshold: v.warningThreshold,
                          critical_threshold: v.criticalThreshold,
                          sample_count: v.sampleCount,
                          std_dev: v.stdDev,
                        }
                      : null,
                  ]),
                ),
                metadata: snapshot.metadata,
              };
            } catch (error) {
              logger.error`Baseline calculation failed: ${error}`;
              set.status = 500;
              return {
                error: 'calculation_failed',
                message: `Failed to calculate baseline: ${error}`,
              };
            }
          },
          {
            query: t.Object({
              organization_id: t.Optional(t.String()),
              triggered_by: t.Optional(
                t.Union([t.Literal('scheduled'), t.Literal('manual'), t.Literal('model_update')]),
              ),
            }),
            response: {
              200: t.Object({
                organization_id: t.String(),
                calculated_at: t.String(),
                window_start: t.String(),
                window_end: t.String(),
                days_included: t.Number(),
                signals: t.Record(
                  t.String(),
                  t.Object({
                    baseline_value: t.Number(),
                    warning_threshold: t.Number(),
                    critical_threshold: t.Number(),
                    sample_count: t.Number(),
                    std_dev: t.Number(),
                  }),
                ),
                rates: t.Record(
                  t.String(),
                  t.Nullable(
                    t.Object({
                      baseline_value: t.Number(),
                      warning_threshold: t.Number(),
                      critical_threshold: t.Number(),
                      sample_count: t.Number(),
                      std_dev: t.Number(),
                    }),
                  ),
                ),
                metadata: t.Object({
                  calculationMethod: t.String(),
                  triggeredBy: t.String(),
                  notes: t.Optional(t.String()),
                }),
              }),
              400: errorResponseSchema,
              401: errorResponseSchema,
              403: errorResponseSchema,
              429: errorResponseSchema,
              500: errorResponseSchema,
              503: errorResponseSchema,
            },
            detail: {
              summary: 'Calculate baselines',
              description:
                'Trigger baseline calculation for an organization. Uses 7-day rolling window.',
              tags: ['Control Plane'],
            },
          },
        ),
    ),
  )
  // Baseline GET endpoints - require control:read scope
  .guard(createAuthGuard('control:read'), (app) =>
    app.guard(createRateLimitGuard(), (app) =>
      app.get(
        '/baselines',
        async ({ query, set }) => {
          if (!isBaselineCalculatorInitialized()) {
            set.status = 503;
            return {
              error: 'service_unavailable',
              message: 'Baseline calculator not initialized. Requires PostgreSQL.',
            };
          }

          const calculator = getBaselineCalculator();
          const orgId = query.organization_id ?? SYSTEM_ORG_ID;

          try {
            const snapshot = await calculator.getEffectiveBaseline(orgId);

            if (!snapshot) {
              set.status = 404;
              return {
                error: 'not_found',
                message: 'No baselines found for organization. Trigger calculation first.',
              };
            }

            return {
              organization_id: snapshot.organizationId,
              calculated_at: snapshot.calculatedAt.toISOString(),
              window_start: snapshot.windowStart.toISOString(),
              window_end: snapshot.windowEnd.toISOString(),
              days_included: snapshot.daysIncluded,
              signals: Object.fromEntries(
                Object.entries(snapshot.signals).map(([k, v]) => [
                  k,
                  {
                    baseline_value: v.baselineValue,
                    warning_threshold: v.warningThreshold,
                    critical_threshold: v.criticalThreshold,
                    sample_count: v.sampleCount,
                    std_dev: v.stdDev,
                  },
                ]),
              ),
              rates: Object.fromEntries(
                Object.entries(snapshot.rates).map(([k, v]) => [
                  k,
                  v
                    ? {
                        baseline_value: v.baselineValue,
                        warning_threshold: v.warningThreshold,
                        critical_threshold: v.criticalThreshold,
                        sample_count: v.sampleCount,
                        std_dev: v.stdDev,
                      }
                    : null,
                ]),
              ),
              metadata: snapshot.metadata,
            };
          } catch (error) {
            logger.error`Failed to get baselines: ${error}`;
            set.status = 500;
            return {
              error: 'fetch_failed',
              message: `Failed to get baselines: ${error}`,
            };
          }
        },
        {
          query: t.Object({
            organization_id: t.Optional(t.String()),
          }),
          response: {
            200: t.Object({
              organization_id: t.String(),
              calculated_at: t.String(),
              window_start: t.String(),
              window_end: t.String(),
              days_included: t.Number(),
              signals: t.Record(
                t.String(),
                t.Object({
                  baseline_value: t.Number(),
                  warning_threshold: t.Number(),
                  critical_threshold: t.Number(),
                  sample_count: t.Number(),
                  std_dev: t.Number(),
                }),
              ),
              rates: t.Record(
                t.String(),
                t.Nullable(
                  t.Object({
                    baseline_value: t.Number(),
                    warning_threshold: t.Number(),
                    critical_threshold: t.Number(),
                    sample_count: t.Number(),
                    std_dev: t.Number(),
                  }),
                ),
              ),
              metadata: t.Object({
                calculationMethod: t.String(),
                triggeredBy: t.String(),
                notes: t.Optional(t.String()),
              }),
            }),
            401: errorResponseSchema,
            403: errorResponseSchema,
            404: errorResponseSchema,
            429: errorResponseSchema,
            500: errorResponseSchema,
            503: errorResponseSchema,
          },
          detail: {
            summary: 'Get baselines',
            description: 'Get effective baselines for an organization (with global fallback)',
            tags: ['Control Plane'],
          },
        },
      ),
    ),
  );
