/**
 * Elysia schemas for Incidents API
 *
 * @module lib/schemas/incidents
 */

import { t } from 'elysia';

/**
 * Incident type
 */
export const incidentTypeSchema = t.Union([
  t.Literal('drift_threshold_breach'),
  t.Literal('manual'),
  t.Literal('model_update'),
]);

/**
 * Incident status
 */
export const incidentStatusSchema = t.Union([
  t.Literal('open'),
  t.Literal('acknowledged'),
  t.Literal('resolved'),
]);

/**
 * Incident trigger level
 */
export const incidentTriggerLevelSchema = t.Union([t.Literal('warning'), t.Literal('critical')]);

/**
 * Incident response schema
 */
export const incidentSchema = t.Object({
  id: t.String(),
  organization_id: t.String(),
  type: incidentTypeSchema,
  status: incidentStatusSchema,
  trigger_signal: t.Nullable(t.String()),
  trigger_level: t.Nullable(incidentTriggerLevelSchema),
  trigger_value: t.Nullable(t.String()),
  threshold_value: t.Nullable(t.String()),
  baseline_value: t.Nullable(t.String()),
  title: t.String(),
  description: t.Nullable(t.String()),
  metadata: t.Nullable(t.Unknown()),
  safe_mode_enabled: t.Nullable(t.String()),
  resolved_at: t.Nullable(t.String()),
  resolved_by: t.Nullable(t.String()),
  resolution_notes: t.Nullable(t.String()),
  cooldown_until: t.Nullable(t.String()),
  created_at: t.String(),
  updated_at: t.String(),
});

/**
 * Incident list response
 */
export const incidentListResponseSchema = t.Object({
  organization_id: t.Nullable(t.String()),
  incidents: t.Array(incidentSchema),
  total: t.Number(),
});

/**
 * Acknowledge incident request
 */
export const acknowledgeIncidentRequestSchema = t.Object({
  notes: t.Optional(t.String({ description: 'Optional notes for acknowledgement' })),
});

/**
 * Resolve incident request
 */
export const resolveIncidentRequestSchema = t.Object({
  resolution_notes: t.String({
    description: 'Notes describing how the incident was resolved',
    minLength: 1,
  }),
});

/**
 * Incident update response
 */
export const incidentUpdateResponseSchema = t.Object({
  id: t.String(),
  status: incidentStatusSchema,
  updated_at: t.String(),
});
