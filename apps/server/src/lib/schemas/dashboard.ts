/**
 * Dashboard endpoint schemas
 *
 * TypeBox schemas for GET /status, GET /audit-events, GET /audit-events/timeseries
 *
 * @module lib/schemas/dashboard
 */

import { t } from 'elysia';

// --- Status endpoint ---

export const driftSignalSchema = t.Object({
  name: t.String(),
  current_value: t.Number(),
  baseline_value: t.Number(),
  threshold_warning: t.Number(),
  threshold_critical: t.Number(),
  status: t.Union([t.Literal('normal'), t.Literal('warning'), t.Literal('critical')]),
});

export const statusResponseSchema = t.Object({
  organization: t.Object({
    id: t.Union([t.String(), t.Null()]),
    name: t.Union([t.String(), t.Null()]),
  }),
  service: t.Object({
    name: t.Literal('popper'),
    version: t.String(),
    uptime_seconds: t.Number(),
    healthy: t.Boolean(),
  }),
  safe_mode: t.Object({
    enabled: t.Boolean(),
    reason: t.Union([t.String(), t.Null()]),
    effective_at: t.Union([t.String(), t.Null()]),
    effective_until: t.Union([t.String(), t.Null()]),
    enabled_by: t.Union([t.String(), t.Null()]),
    scope: t.Union([t.Literal('global'), t.Literal('organization')]),
    organization_id: t.Optional(t.Union([t.String(), t.Null()])),
  }),
  policy: t.Object({
    active_pack: t.String(),
    version: t.String(),
    rules_count: t.Number(),
    composed: t.Union([
      t.Object({
        pack_count: t.Number(),
        component_packs: t.Array(t.String()),
        loaded_at: t.String(),
      }),
      t.Null(),
    ]),
    error: t.Union([t.String(), t.Null()]),
  }),
  counters: t.Object({
    requests_total: t.Number(),
    decisions: t.Object({
      approved: t.Number(),
      hard_stop: t.Number(),
      route_to_clinician: t.Number(),
      request_more_info: t.Number(),
    }),
    validation_failures: t.Number(),
  }),
  drift: t.Object({
    status: t.Union([t.Literal('normal'), t.Literal('warning'), t.Literal('critical')]),
    signals: t.Array(driftSignalSchema),
  }),
});

// --- Audit events endpoint ---

export const auditEventSchema = t.Object({
  id: t.String(),
  event_type: t.String(),
  occurred_at: t.String(),
  trace: t.Object({
    trace_id: t.String(),
  }),
  mode: t.Union([t.String(), t.Null()]),
  subject: t.Object({
    subject_id: t.String(),
    organization_id: t.String(),
  }),
  summary: t.String(),
  tags: t.Optional(t.Union([t.Array(t.String()), t.Null()])),
});

export const auditEventsResponseSchema = t.Object({
  events: t.Array(auditEventSchema),
  pagination: t.Object({
    total: t.Number(),
    limit: t.Number(),
    offset: t.Number(),
    has_more: t.Boolean(),
  }),
});

// --- Timeseries endpoint ---

export const timeseriesBucketSchema = t.Object({
  timestamp: t.String(),
  counts: t.Record(t.String(), t.Number()),
  total: t.Number(),
});

export const auditTimeseriesResponseSchema = t.Object({
  buckets: t.Array(timeseriesBucketSchema),
  total_events: t.Number(),
});
