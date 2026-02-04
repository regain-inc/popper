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
import { getIncidentsStore, isIncidentsStoreInitialized } from '../lib/incidents';
import { logger } from '../lib/logger';
import { getRlhfAggregator, isRlhfAggregatorInitialized } from '../lib/rlhf';
import { getSafeModeManager } from '../lib/safe-mode';
import {
  acknowledgeIncidentRequestSchema,
  effectiveSettingsResponseSchema,
  errorResponseSchema,
  incidentListResponseSchema,
  incidentSchema,
  incidentUpdateResponseSchema,
  operationalSettingSchema,
  resolveIncidentRequestSchema,
  safeModeChangeRequestSchema,
  safeModeHistoryResponseSchema,
  safeModeStateSchema,
  settingsChangeRequestSchema,
  settingsHistoryResponseSchema,
  settingsKeySchema,
  singleSettingResponseSchema,
} from '../lib/schemas';
import { getSettingsManager } from '../lib/settings';
import { getDriftTriggersManager, isDriftTriggersManagerInitialized } from '../lib/triggers';
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
  )
  // Drift Triggers endpoints - require control:read scope
  .guard(createAuthGuard('control:read'), (app) =>
    app.guard(createRateLimitGuard(), (app) =>
      app
        .get(
          '/triggers/rules',
          async ({ set }) => {
            if (!isDriftTriggersManagerInitialized()) {
              set.status = 503;
              return {
                error: 'service_unavailable',
                message: 'Drift triggers not initialized.',
              };
            }

            const manager = getDriftTriggersManager();
            const rules = manager.getRules();

            return {
              rules: rules.map((r) => ({
                signal: r.signal,
                warning_multiplier: r.warningMultiplier,
                critical_multiplier: r.criticalMultiplier,
                warning_action: r.warningAction,
                critical_action: r.criticalAction,
                cooldown_seconds: r.cooldownSeconds,
              })),
            };
          },
          {
            response: {
              200: t.Object({
                rules: t.Array(
                  t.Object({
                    signal: t.String(),
                    warning_multiplier: t.Number(),
                    critical_multiplier: t.Number(),
                    warning_action: t.String(),
                    critical_action: t.String(),
                    cooldown_seconds: t.Number(),
                  }),
                ),
              }),
              401: errorResponseSchema,
              403: errorResponseSchema,
              429: errorResponseSchema,
              503: errorResponseSchema,
            },
            detail: {
              summary: 'Get trigger rules',
              description: 'Get configured drift trigger rules',
              tags: ['Control Plane'],
            },
          },
        )
        .get(
          '/triggers/cooldowns',
          async ({ query, set }) => {
            if (!isDriftTriggersManagerInitialized()) {
              set.status = 503;
              return {
                error: 'service_unavailable',
                message: 'Drift triggers not initialized.',
              };
            }

            const manager = getDriftTriggersManager();
            const orgId = query.organization_id ?? SYSTEM_ORG_ID;
            const rules = manager.getRules();

            const cooldowns: Record<string, boolean> = {};
            for (const rule of rules) {
              cooldowns[rule.signal] = await manager.isInCooldown(orgId, rule.signal);
            }

            return {
              organization_id: orgId,
              cooldowns,
            };
          },
          {
            query: t.Object({
              organization_id: t.Optional(t.String()),
            }),
            response: {
              200: t.Object({
                organization_id: t.String(),
                cooldowns: t.Record(t.String(), t.Boolean()),
              }),
              401: errorResponseSchema,
              403: errorResponseSchema,
              429: errorResponseSchema,
              503: errorResponseSchema,
            },
            detail: {
              summary: 'Get trigger cooldowns',
              description: 'Check which signals are currently in cooldown',
              tags: ['Control Plane'],
            },
          },
        ),
    ),
  )
  // Drift Triggers POST endpoints - require control:write scope
  .guard(createAuthGuard('control:write'), (app) =>
    app.guard(createRateLimitGuard(), (app) =>
      app.post(
        '/triggers/evaluate',
        async ({ query, set }) => {
          if (!isDriftTriggersManagerInitialized()) {
            set.status = 503;
            return {
              error: 'service_unavailable',
              message: 'Drift triggers not initialized.',
            };
          }

          const manager = getDriftTriggersManager();
          const orgId = query.organization_id ?? SYSTEM_ORG_ID;

          logger.info`Trigger evaluation requested: org=${orgId}`;

          try {
            const result = await manager.evaluate(orgId);

            logger.info`Trigger evaluation complete: org=${orgId} criticals=${result.evaluation.criticals.length} warnings=${result.evaluation.warnings.length} safe_mode_triggered=${result.safeModeTriggered}`;

            return {
              organization_id: result.organizationId,
              evaluated_at: result.evaluatedAt.toISOString(),
              summary: result.evaluation.summary,
              warnings: result.evaluation.warnings.map((w) => ({
                signal: w.signal,
                current_value: w.currentValue,
                baseline_value: w.baselineValue,
                threshold: w.warningThreshold,
                multiplier: w.multiplier,
                action: w.action,
              })),
              criticals: result.evaluation.criticals.map((c) => ({
                signal: c.signal,
                current_value: c.currentValue,
                baseline_value: c.baselineValue,
                threshold: c.criticalThreshold,
                multiplier: c.multiplier,
                action: c.action,
              })),
              incidents_created: result.incidentsCreated,
              safe_mode_triggered: result.safeModeTriggered,
              ops_alerted: result.opsAlerted,
            };
          } catch (error) {
            logger.error`Trigger evaluation failed: ${error}`;
            set.status = 500;
            return {
              error: 'evaluation_failed',
              message: `Failed to evaluate triggers: ${error}`,
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
              evaluated_at: t.String(),
              summary: t.String(),
              warnings: t.Array(
                t.Object({
                  signal: t.String(),
                  current_value: t.Number(),
                  baseline_value: t.Number(),
                  threshold: t.Number(),
                  multiplier: t.Number(),
                  action: t.String(),
                }),
              ),
              criticals: t.Array(
                t.Object({
                  signal: t.String(),
                  current_value: t.Number(),
                  baseline_value: t.Number(),
                  threshold: t.Number(),
                  multiplier: t.Number(),
                  action: t.String(),
                }),
              ),
              incidents_created: t.Array(t.String()),
              safe_mode_triggered: t.Boolean(),
              ops_alerted: t.Boolean(),
            }),
            401: errorResponseSchema,
            403: errorResponseSchema,
            429: errorResponseSchema,
            500: errorResponseSchema,
            503: errorResponseSchema,
          },
          detail: {
            summary: 'Evaluate triggers',
            description:
              'Manually trigger drift evaluation. Checks current rates against baselines.',
            tags: ['Control Plane'],
          },
        },
      ),
    ),
  )
  // RLHF Bundles GET endpoints - require control:read scope
  .guard(createAuthGuard('control:read'), (app) =>
    app.guard(createRateLimitGuard(), (app) =>
      app
        .get(
          '/rlhf/bundles',
          async ({ query, set }) => {
            if (!isRlhfAggregatorInitialized()) {
              set.status = 503;
              return {
                error: 'service_unavailable',
                message: 'RLHF aggregator not initialized.',
              };
            }

            const aggregator = getRlhfAggregator();
            const orgId = query.organization_id ?? null;
            const limit = query.limit ?? 10;

            const bundles = await aggregator.listBundles(orgId, limit);

            return {
              organization_id: orgId,
              bundles: bundles.map((b) => ({
                id: b.id,
                organization_id: b.organizationId,
                period_start: b.periodStart.toISOString(),
                period_end: b.periodEnd.toISOString(),
                generated_at: b.generatedAt.toISOString(),
                triggered_by: b.triggeredBy,
                status: b.status,
                recommendations_count: b.bundleData.recommendations.length,
                override_signals_count: b.bundleData.overrideSignals.length,
              })),
            };
          },
          {
            query: t.Object({
              organization_id: t.Optional(t.String()),
              limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
            }),
            response: {
              200: t.Object({
                organization_id: t.Nullable(t.String()),
                bundles: t.Array(
                  t.Object({
                    id: t.String(),
                    organization_id: t.Nullable(t.String()),
                    period_start: t.String(),
                    period_end: t.String(),
                    generated_at: t.String(),
                    triggered_by: t.String(),
                    status: t.String(),
                    recommendations_count: t.Number(),
                    override_signals_count: t.Number(),
                  }),
                ),
              }),
              401: errorResponseSchema,
              403: errorResponseSchema,
              429: errorResponseSchema,
              503: errorResponseSchema,
            },
            detail: {
              summary: 'List RLHF bundles',
              description: 'List feedback bundles for an organization',
              tags: ['Control Plane'],
            },
          },
        )
        .get(
          '/rlhf/bundles/:id',
          async ({ params, set }) => {
            if (!isRlhfAggregatorInitialized()) {
              set.status = 503;
              return {
                error: 'service_unavailable',
                message: 'RLHF aggregator not initialized.',
              };
            }

            const aggregator = getRlhfAggregator();
            const bundle = await aggregator.getBundle(params.id);

            if (!bundle) {
              set.status = 404;
              return {
                error: 'not_found',
                message: `Bundle not found: ${params.id}`,
              };
            }

            return {
              id: bundle.id,
              organization_id: bundle.organizationId,
              period_start: bundle.periodStart.toISOString(),
              period_end: bundle.periodEnd.toISOString(),
              generated_at: bundle.generatedAt.toISOString(),
              triggered_by: bundle.triggeredBy,
              status: bundle.status,
              bundle_data: bundle.bundleData,
            };
          },
          {
            params: t.Object({
              id: t.String(),
            }),
            response: {
              200: t.Object({
                id: t.String(),
                organization_id: t.Nullable(t.String()),
                period_start: t.String(),
                period_end: t.String(),
                generated_at: t.String(),
                triggered_by: t.String(),
                status: t.String(),
                bundle_data: t.Unknown(),
              }),
              401: errorResponseSchema,
              403: errorResponseSchema,
              404: errorResponseSchema,
              429: errorResponseSchema,
              503: errorResponseSchema,
            },
            detail: {
              summary: 'Get RLHF bundle',
              description: 'Get a specific feedback bundle by ID',
              tags: ['Control Plane'],
            },
          },
        ),
    ),
  )
  // RLHF Bundles POST endpoints - require control:write scope
  .guard(createAuthGuard('control:write'), (app) =>
    app.guard(createRateLimitGuard(), (app) =>
      app
        .post(
          '/rlhf/bundles/generate',
          async ({ body, query, set }) => {
            if (!isRlhfAggregatorInitialized()) {
              set.status = 503;
              return {
                error: 'service_unavailable',
                message: 'RLHF aggregator not initialized.',
              };
            }

            const aggregator = getRlhfAggregator();
            const orgId = query.organization_id ?? null;

            logger.info`RLHF bundle generation requested: org=${orgId ?? 'global'} triggered_by=${body.triggered_by}`;

            try {
              const bundle = await aggregator.generateBundle({
                organizationId: orgId,
                triggeredBy: body.triggered_by,
                periodStart: body.period_start ? new Date(body.period_start) : undefined,
                periodEnd: body.period_end ? new Date(body.period_end) : undefined,
                notes: body.notes,
              });

              logger.info`RLHF bundle generated: id=${bundle.id} recommendations=${bundle.bundleData.recommendations.length}`;

              return {
                id: bundle.id,
                organization_id: bundle.organizationId,
                period_start: bundle.periodStart.toISOString(),
                period_end: bundle.periodEnd.toISOString(),
                generated_at: bundle.generatedAt.toISOString(),
                triggered_by: bundle.triggeredBy,
                status: bundle.status,
                bundle_data: bundle.bundleData,
              };
            } catch (error) {
              logger.error`RLHF bundle generation failed: ${error}`;
              set.status = 500;
              return {
                error: 'generation_failed',
                message: `Failed to generate bundle: ${error}`,
              };
            }
          },
          {
            body: t.Object({
              triggered_by: t.Union([
                t.Literal('drift_detected'),
                t.Literal('scheduled'),
                t.Literal('manual'),
                t.Literal('sample_threshold'),
              ]),
              period_start: t.Optional(t.String()),
              period_end: t.Optional(t.String()),
              notes: t.Optional(t.String()),
            }),
            query: t.Object({
              organization_id: t.Optional(t.String()),
            }),
            response: {
              200: t.Object({
                id: t.String(),
                organization_id: t.Nullable(t.String()),
                period_start: t.String(),
                period_end: t.String(),
                generated_at: t.String(),
                triggered_by: t.String(),
                status: t.String(),
                bundle_data: t.Unknown(),
              }),
              401: errorResponseSchema,
              403: errorResponseSchema,
              429: errorResponseSchema,
              500: errorResponseSchema,
              503: errorResponseSchema,
            },
            detail: {
              summary: 'Generate RLHF bundle',
              description: 'Generate a new feedback bundle for RLHF loop closure',
              tags: ['Control Plane'],
            },
          },
        )
        .post(
          '/rlhf/bundles/:id/process',
          async ({ params, set }) => {
            if (!isRlhfAggregatorInitialized()) {
              set.status = 503;
              return {
                error: 'service_unavailable',
                message: 'RLHF aggregator not initialized.',
              };
            }

            const aggregator = getRlhfAggregator();
            const bundle = await aggregator.markProcessed(params.id);

            if (!bundle) {
              set.status = 404;
              return {
                error: 'not_found',
                message: `Bundle not found: ${params.id}`,
              };
            }

            logger.info`RLHF bundle marked as processed: id=${bundle.id}`;

            return {
              id: bundle.id,
              status: bundle.status,
              updated_at: bundle.updatedAt.toISOString(),
            };
          },
          {
            params: t.Object({
              id: t.String(),
            }),
            response: {
              200: t.Object({
                id: t.String(),
                status: t.String(),
                updated_at: t.String(),
              }),
              401: errorResponseSchema,
              403: errorResponseSchema,
              404: errorResponseSchema,
              429: errorResponseSchema,
              503: errorResponseSchema,
            },
            detail: {
              summary: 'Mark bundle as processed',
              description: 'Mark a feedback bundle as processed (sent to Deutsch/TA1)',
              tags: ['Control Plane'],
            },
          },
        )
        .post(
          '/rlhf/bundles/:id/archive',
          async ({ params, set }) => {
            if (!isRlhfAggregatorInitialized()) {
              set.status = 503;
              return {
                error: 'service_unavailable',
                message: 'RLHF aggregator not initialized.',
              };
            }

            const aggregator = getRlhfAggregator();
            const bundle = await aggregator.archiveBundle(params.id);

            if (!bundle) {
              set.status = 404;
              return {
                error: 'not_found',
                message: `Bundle not found: ${params.id}`,
              };
            }

            logger.info`RLHF bundle archived: id=${bundle.id}`;

            return {
              id: bundle.id,
              status: bundle.status,
              updated_at: bundle.updatedAt.toISOString(),
            };
          },
          {
            params: t.Object({
              id: t.String(),
            }),
            response: {
              200: t.Object({
                id: t.String(),
                status: t.String(),
                updated_at: t.String(),
              }),
              401: errorResponseSchema,
              403: errorResponseSchema,
              404: errorResponseSchema,
              429: errorResponseSchema,
              503: errorResponseSchema,
            },
            detail: {
              summary: 'Archive bundle',
              description: 'Archive a feedback bundle after processing',
              tags: ['Control Plane'],
            },
          },
        ),
    ),
  )
  // Incidents GET endpoints - require control:read scope
  .guard(createAuthGuard('control:read'), (app) =>
    app.guard(createRateLimitGuard(), (app) =>
      app
        .get(
          '/incidents',
          async ({ query, set }) => {
            if (!isIncidentsStoreInitialized()) {
              set.status = 503;
              return {
                error: 'service_unavailable',
                message: 'Incidents store not initialized. Requires PostgreSQL.',
              };
            }

            const store = getIncidentsStore();
            const orgId = query.organization_id;

            const incidents =
              query.status === 'open' && orgId
                ? await store.getOpen(orgId)
                : orgId
                  ? await store.getHistory(orgId, query.limit ?? 100)
                  : [];

            return {
              organization_id: orgId ?? null,
              incidents: incidents.map((i) => ({
                id: i.id,
                organization_id: i.organizationId,
                type: i.type,
                status: i.status,
                trigger_signal: i.triggerSignal,
                trigger_level: i.triggerLevel,
                trigger_value: i.triggerValue,
                threshold_value: i.thresholdValue,
                baseline_value: i.baselineValue,
                title: i.title,
                description: i.description,
                metadata: i.metadata,
                safe_mode_enabled: i.safeModeEnabled?.toISOString() ?? null,
                resolved_at: i.resolvedAt?.toISOString() ?? null,
                resolved_by: i.resolvedBy,
                resolution_notes: i.resolutionNotes,
                cooldown_until: i.cooldownUntil?.toISOString() ?? null,
                created_at: i.createdAt.toISOString(),
                updated_at: i.updatedAt.toISOString(),
              })),
              total: incidents.length,
            };
          },
          {
            query: t.Object({
              organization_id: t.Optional(t.String()),
              status: t.Optional(t.Union([t.Literal('open'), t.Literal('all')])),
              limit: t.Optional(t.Number({ minimum: 1, maximum: 1000 })),
            }),
            response: {
              200: incidentListResponseSchema,
              401: errorResponseSchema,
              403: errorResponseSchema,
              429: errorResponseSchema,
              503: errorResponseSchema,
            },
            detail: {
              summary: 'List incidents',
              description: 'List incidents for an organization',
              tags: ['Control Plane'],
            },
          },
        )
        .get(
          '/incidents/:id',
          async ({ params, set }) => {
            if (!isIncidentsStoreInitialized()) {
              set.status = 503;
              return {
                error: 'service_unavailable',
                message: 'Incidents store not initialized. Requires PostgreSQL.',
              };
            }

            const store = getIncidentsStore();
            const incident = await store.getById(params.id);

            if (!incident) {
              set.status = 404;
              return {
                error: 'not_found',
                message: `Incident not found: ${params.id}`,
              };
            }

            return {
              id: incident.id,
              organization_id: incident.organizationId,
              type: incident.type,
              status: incident.status,
              trigger_signal: incident.triggerSignal,
              trigger_level: incident.triggerLevel,
              trigger_value: incident.triggerValue,
              threshold_value: incident.thresholdValue,
              baseline_value: incident.baselineValue,
              title: incident.title,
              description: incident.description,
              metadata: incident.metadata,
              safe_mode_enabled: incident.safeModeEnabled?.toISOString() ?? null,
              resolved_at: incident.resolvedAt?.toISOString() ?? null,
              resolved_by: incident.resolvedBy,
              resolution_notes: incident.resolutionNotes,
              cooldown_until: incident.cooldownUntil?.toISOString() ?? null,
              created_at: incident.createdAt.toISOString(),
              updated_at: incident.updatedAt.toISOString(),
            };
          },
          {
            params: t.Object({
              id: t.String(),
            }),
            response: {
              200: incidentSchema,
              401: errorResponseSchema,
              403: errorResponseSchema,
              404: errorResponseSchema,
              429: errorResponseSchema,
              503: errorResponseSchema,
            },
            detail: {
              summary: 'Get incident',
              description: 'Get incident details by ID',
              tags: ['Control Plane'],
            },
          },
        ),
    ),
  )
  // Incidents POST endpoints - require control:write scope
  .guard(createAuthGuard('control:write'), (app) =>
    app.guard(createRateLimitGuard(), (app) =>
      app
        .post(
          '/incidents/:id/acknowledge',
          async ({ params, set }) => {
            if (!isIncidentsStoreInitialized()) {
              set.status = 503;
              return {
                error: 'service_unavailable',
                message: 'Incidents store not initialized. Requires PostgreSQL.',
              };
            }

            const store = getIncidentsStore();
            const incident = await store.updateStatus(params.id, 'acknowledged');

            if (!incident) {
              set.status = 404;
              return {
                error: 'not_found',
                message: `Incident not found: ${params.id}`,
              };
            }

            logger.info`Incident acknowledged: id=${incident.id}`;

            return {
              id: incident.id,
              status: incident.status,
              updated_at: incident.updatedAt.toISOString(),
            };
          },
          {
            params: t.Object({
              id: t.String(),
            }),
            body: t.Optional(acknowledgeIncidentRequestSchema),
            response: {
              200: incidentUpdateResponseSchema,
              401: errorResponseSchema,
              403: errorResponseSchema,
              404: errorResponseSchema,
              429: errorResponseSchema,
              503: errorResponseSchema,
            },
            detail: {
              summary: 'Acknowledge incident',
              description: 'Mark an incident as acknowledged',
              tags: ['Control Plane'],
            },
          },
        )
        .post(
          '/incidents/:id/resolve',
          async ({ params, body, apiKey, set }) => {
            if (!isIncidentsStoreInitialized()) {
              set.status = 503;
              return {
                error: 'service_unavailable',
                message: 'Incidents store not initialized. Requires PostgreSQL.',
              };
            }

            const store = getIncidentsStore();
            const resolvedBy = apiKey?.keyName ?? 'system';

            const incident = await store.updateStatus(
              params.id,
              'resolved',
              resolvedBy,
              body.resolution_notes,
            );

            if (!incident) {
              set.status = 404;
              return {
                error: 'not_found',
                message: `Incident not found: ${params.id}`,
              };
            }

            logger.info`Incident resolved: id=${incident.id} by=${resolvedBy}`;

            return {
              id: incident.id,
              status: incident.status,
              updated_at: incident.updatedAt.toISOString(),
            };
          },
          {
            params: t.Object({
              id: t.String(),
            }),
            body: resolveIncidentRequestSchema,
            response: {
              200: incidentUpdateResponseSchema,
              401: errorResponseSchema,
              403: errorResponseSchema,
              404: errorResponseSchema,
              429: errorResponseSchema,
              503: errorResponseSchema,
            },
            detail: {
              summary: 'Resolve incident',
              description: 'Mark an incident as resolved with resolution notes',
              tags: ['Control Plane'],
            },
          },
        )
        .post(
          '/incidents',
          async ({ body, set }) => {
            if (!isIncidentsStoreInitialized()) {
              set.status = 503;
              return {
                error: 'service_unavailable',
                message: 'Incidents store not initialized. Requires PostgreSQL.',
              };
            }

            const store = getIncidentsStore();
            const incident = await store.create({
              organizationId: body.organization_id,
              type: body.type,
              title: body.title,
              description: body.description ?? null,
              triggerSignal: body.trigger_signal ?? null,
              metadata: body.metadata ?? null,
            });

            logger.info`Incident created: id=${incident.id} type=${incident.type}`;

            set.status = 201;
            return {
              id: incident.id,
              organization_id: incident.organizationId,
              type: incident.type,
              status: incident.status,
              trigger_signal: incident.triggerSignal,
              trigger_level: incident.triggerLevel,
              trigger_value: incident.triggerValue,
              threshold_value: incident.thresholdValue,
              baseline_value: incident.baselineValue,
              title: incident.title,
              description: incident.description,
              metadata: incident.metadata,
              safe_mode_enabled: incident.safeModeEnabled?.toISOString() ?? null,
              resolved_at: incident.resolvedAt?.toISOString() ?? null,
              resolved_by: incident.resolvedBy,
              resolution_notes: incident.resolutionNotes,
              cooldown_until: incident.cooldownUntil?.toISOString() ?? null,
              created_at: incident.createdAt.toISOString(),
              updated_at: incident.updatedAt.toISOString(),
            };
          },
          {
            body: t.Object({
              organization_id: t.String(),
              type: t.Union([
                t.Literal('drift_threshold_breach'),
                t.Literal('manual'),
                t.Literal('model_update'),
              ]),
              title: t.String({ minLength: 1, maxLength: 500 }),
              description: t.Optional(t.String()),
              trigger_signal: t.Optional(t.String()),
              metadata: t.Optional(t.Record(t.String(), t.Unknown())),
            }),
            response: {
              201: incidentSchema,
              401: errorResponseSchema,
              403: errorResponseSchema,
              429: errorResponseSchema,
              503: errorResponseSchema,
            },
            detail: {
              summary: 'Create incident',
              description: 'Create a new incident for an organization',
              tags: ['Control Plane'],
            },
          },
        ),
    ),
  );
