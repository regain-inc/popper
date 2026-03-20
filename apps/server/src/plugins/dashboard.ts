/**
 * Dashboard Plugin
 *
 * Provides endpoints for the ops dashboard:
 * - GET /v1/popper/dashboard/status — service status, counters, drift, safe-mode
 * - GET /v1/popper/dashboard/audit-events — paginated audit event list
 * - GET /v1/popper/dashboard/audit-events/timeseries — time_bucket aggregation
 *
 * Protected by API Key authentication with control:read scope.
 *
 * @module plugins/dashboard
 */

import { policyRegistry, SYSTEM_ORG_ID } from '@popper/core';
import { Elysia, t } from 'elysia';
import { getAuditReader, isAuditReaderInitialized } from '../lib/audit-reader';
import { getDriftCounters, isDriftCountersInitialized } from '../lib/drift';
import { getSafeModeManager } from '../lib/safe-mode';
import {
  auditEventsResponseSchema,
  auditTimeseriesResponseSchema,
  errorResponseSchema,
  statusResponseSchema,
} from '../lib/schemas';
import { createAuthGuard } from './api-key-auth';
import { createRateLimitGuard } from './rate-limit';
import { getComposedPolicyPackError, getComposedPolicyPackInfo } from './supervision';

const startTime = Date.now();
const DEFAULT_POLICY_PACK = 'popper-default';

/**
 * Build a summary string for an audit event
 */
function buildEventSummary(eventType: string, decision: string | null): string {
  if (decision) {
    return `${eventType}: ${decision}`;
  }
  return eventType;
}

/**
 * Dashboard Plugin
 *
 * Endpoints:
 * - GET /v1/popper/dashboard/status
 * - GET /v1/popper/dashboard/audit-events
 * - GET /v1/popper/dashboard/audit-events/timeseries
 */
export const dashboardPlugin = new Elysia({
  name: 'dashboard',
  prefix: '/v1/popper/dashboard',
}).guard(createAuthGuard('control:read'), (app) =>
  app.guard(createRateLimitGuard(), (app) =>
    app
      .get(
        '/status',
        async ({ query }) => {
          const orgId = query.organization_id ?? SYSTEM_ORG_ID;

          // Safe mode
          const safeModeState = await getSafeModeManager().snapshot(orgId);

          // Policy — prefer composed pack info from supervision plugin
          const composedPackInfo = getComposedPolicyPackInfo();
          const composedPackError = getComposedPolicyPackError();
          const policyPack = policyRegistry.get(DEFAULT_POLICY_PACK);

          // Drift counters (current hour from Redis)
          const snapshot = isDriftCountersInitialized()
            ? await getDriftCounters().getSnapshot(orgId)
            : null;

          // Determine drift status from rates
          let driftStatus: 'normal' | 'warning' | 'critical' = 'normal';
          if (snapshot) {
            const { rates } = snapshot;
            if (
              rates.hardStopRate > 0.15 ||
              rates.validationFailureRate > 0.2 ||
              rates.policyViolationRate > 0.1
            ) {
              driftStatus = 'critical';
            } else if (
              rates.hardStopRate > 0.08 ||
              rates.validationFailureRate > 0.1 ||
              rates.policyViolationRate > 0.05
            ) {
              driftStatus = 'warning';
            }
          }

          return {
            organization: { id: orgId, name: null },
            service: {
              name: 'popper' as const,
              version: '0.1.0',
              uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
              healthy: true,
            },
            safe_mode: {
              enabled: safeModeState.enabled,
              reason: safeModeState.reason || null,
              effective_at: safeModeState.effective_at || null,
              effective_until: null,
              enabled_by: safeModeState.actor_id || null,
              scope: orgId === SYSTEM_ORG_ID ? ('global' as const) : ('organization' as const),
              organization_id: orgId,
            },
            policy: {
              active_pack:
                composedPackInfo?.policy_id ?? policyPack?.policy_id ?? DEFAULT_POLICY_PACK,
              version: composedPackInfo?.policy_version ?? policyPack?.policy_version ?? '0.0.0',
              rules_count: composedPackInfo?.rules_count ?? policyPack?.rules?.length ?? 0,
              composed: composedPackInfo
                ? {
                    pack_count: composedPackInfo.pack_count,
                    component_packs: composedPackInfo.component_packs,
                    loaded_at: composedPackInfo.loaded_at,
                  }
                : null,
              error: composedPackError,
            },
            counters: {
              requests_total: snapshot?.counters.request_count ?? 0,
              decisions: {
                approved: snapshot?.counters.approved_count ?? 0,
                hard_stop: snapshot?.counters.hard_stop_count ?? 0,
                route_to_clinician: snapshot?.counters.route_to_clinician_count ?? 0,
                request_more_info: snapshot?.counters.request_more_info_count ?? 0,
              },
              validation_failures: snapshot?.counters.validation_failure_count ?? 0,
            },
            drift: {
              status: driftStatus,
              signals: snapshot
                ? [
                    {
                      name: 'hard_stop_rate',
                      current_value: snapshot.rates.hardStopRate,
                      baseline_value: 0,
                      threshold_warning: 0.08,
                      threshold_critical: 0.15,
                      status:
                        snapshot.rates.hardStopRate > 0.15
                          ? ('critical' as const)
                          : snapshot.rates.hardStopRate > 0.08
                            ? ('warning' as const)
                            : ('normal' as const),
                    },
                    {
                      name: 'validation_failure_rate',
                      current_value: snapshot.rates.validationFailureRate,
                      baseline_value: 0,
                      threshold_warning: 0.1,
                      threshold_critical: 0.2,
                      status:
                        snapshot.rates.validationFailureRate > 0.2
                          ? ('critical' as const)
                          : snapshot.rates.validationFailureRate > 0.1
                            ? ('warning' as const)
                            : ('normal' as const),
                    },
                    {
                      name: 'policy_violation_rate',
                      current_value: snapshot.rates.policyViolationRate,
                      baseline_value: 0,
                      threshold_warning: 0.05,
                      threshold_critical: 0.1,
                      status:
                        snapshot.rates.policyViolationRate > 0.1
                          ? ('critical' as const)
                          : snapshot.rates.policyViolationRate > 0.05
                            ? ('warning' as const)
                            : ('normal' as const),
                    },
                  ]
                : [],
            },
          };
        },
        {
          query: t.Object({
            organization_id: t.Optional(t.String()),
          }),
          response: {
            200: statusResponseSchema,
            401: errorResponseSchema,
            403: errorResponseSchema,
            429: errorResponseSchema,
          },
          detail: {
            summary: 'Dashboard status',
            description:
              'Get service status including safe-mode, active policy, counters, and drift signals',
            tags: ['Dashboard'],
          },
        },
      )
      .get(
        '/audit-events',
        async ({ query, set }) => {
          if (!isAuditReaderInitialized()) {
            set.status = 503;
            return {
              error: 'service_unavailable',
              message: 'Audit reader not initialized. Requires PostgreSQL.',
            };
          }

          const reader = getAuditReader();
          const limit = query.limit ?? 50;
          const offset = query.offset ?? 0;

          const result = await reader.listEvents({
            organizationId: query.organization_id,
            eventType: query.event_type,
            decision: query.decision,
            traceId: query.trace_id,
            since: query.since ? new Date(query.since) : undefined,
            until: query.until ? new Date(query.until) : undefined,
            limit,
            offset,
          });

          return {
            events: result.events.map((e) => ({
              id: e.id,
              event_type: e.event_type,
              occurred_at: e.occurred_at.toISOString(),
              trace: { trace_id: e.trace_id },
              mode: (e.payload?.mode as string) ?? null,
              subject: {
                subject_id: e.subject_id,
                organization_id: e.organization_id,
              },
              summary: buildEventSummary(e.event_type, e.decision),
              tags: e.tags,
            })),
            pagination: {
              total: result.total,
              limit,
              offset,
              has_more: offset + limit < result.total,
            },
          };
        },
        {
          query: t.Object({
            organization_id: t.Optional(t.String()),
            event_type: t.Optional(t.String()),
            decision: t.Optional(t.String()),
            trace_id: t.Optional(t.String()),
            since: t.Optional(t.String()),
            until: t.Optional(t.String()),
            limit: t.Optional(t.Number({ minimum: 1, maximum: 1000 })),
            offset: t.Optional(t.Number({ minimum: 0 })),
          }),
          response: {
            200: auditEventsResponseSchema,
            401: errorResponseSchema,
            403: errorResponseSchema,
            429: errorResponseSchema,
            503: errorResponseSchema,
          },
          detail: {
            summary: 'List audit events',
            description: 'List audit events with pagination and filters',
            tags: ['Dashboard'],
          },
        },
      )
      .get(
        '/audit-events/timeseries',
        async ({ query, set }) => {
          if (!isAuditReaderInitialized()) {
            set.status = 503;
            return {
              error: 'service_unavailable',
              message: 'Audit reader not initialized. Requires PostgreSQL.',
            };
          }

          const reader = getAuditReader();
          const now = new Date();

          let since: Date;
          if (query.since) {
            since = new Date(query.since);
          } else if (query.hours) {
            const hoursNum = Number(query.hours);
            since = new Date(now.getTime() - hoursNum * 60 * 60 * 1000);
          } else {
            set.status = 400;
            return {
              error: 'bad_request',
              message: 'Either "since" or "hours" query parameter is required.',
            };
          }

          const until = query.until ? new Date(query.until) : now;

          const bucketMap: Record<string, string> = {
            hour: '1 hour',
            day: '1 day',
            week: '1 week',
          };
          const bucket = (bucketMap[query.bucket ?? 'day'] ?? '1 day') as
            | '1 hour'
            | '1 day'
            | '1 week';

          const result = await reader.getTimeseries({
            organizationId: query.organization_id,
            since,
            until,
            bucket,
            groupBy: query.group_by ?? 'decision',
          });

          return {
            buckets: result.buckets.map((b) => ({
              timestamp: b.timestamp.toISOString(),
              counts: b.counts,
              total: b.total,
            })),
            total_events: result.totalEvents,
          };
        },
        {
          query: t.Object({
            organization_id: t.Optional(t.String()),
            since: t.Optional(t.String()),
            hours: t.Optional(t.String()),
            until: t.Optional(t.String()),
            bucket: t.Optional(t.Union([t.Literal('hour'), t.Literal('day'), t.Literal('week')])),
            group_by: t.Optional(t.Union([t.Literal('decision'), t.Literal('event_type')])),
          }),
          response: {
            200: auditTimeseriesResponseSchema,
            400: errorResponseSchema,
            401: errorResponseSchema,
            403: errorResponseSchema,
            429: errorResponseSchema,
            503: errorResponseSchema,
          },
          detail: {
            summary: 'Audit events timeseries',
            description:
              'Get audit events aggregated into time buckets with grouping by decision or event_type',
            tags: ['Dashboard'],
          },
        },
      ),
  ),
);
