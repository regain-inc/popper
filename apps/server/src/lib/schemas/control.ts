/**
 * Elysia schemas for Control Plane API
 *
 * @module lib/schemas/control
 */

import { t } from 'elysia';

/**
 * Safe-mode trigger types
 */
export const safeModeTriggersSchema = t.Union([
  t.Literal('manual'),
  t.Literal('drift_breach'),
  t.Literal('incident'),
]);

/**
 * Request to change safe-mode state
 */
export const safeModeChangeRequestSchema = t.Object({
  enabled: t.Boolean({ description: 'Enable or disable safe-mode' }),
  reason: t.String({ description: 'Reason for the change', minLength: 1 }),
  triggered_by: t.Optional(safeModeTriggersSchema),
  organization_id: t.Optional(t.String({ description: 'Organization ID (defaults to global)' })),
  actor_id: t.Optional(t.String({ description: 'ID of actor making the change' })),
  incident_id: t.Optional(t.String({ description: 'Linked incident ID' })),
  effective_at: t.Optional(t.String({ description: 'When change takes effect (ISO 8601)' })),
});

/**
 * Safe-mode state response
 */
export const safeModeStateSchema = t.Object({
  enabled: t.Boolean(),
  reason: t.String(),
  triggered_by: safeModeTriggersSchema,
  organization_id: t.String(),
  actor_id: t.Nullable(t.String()),
  incident_id: t.Nullable(t.String()),
  effective_at: t.String(),
  updated_at: t.String(),
});

/**
 * Safe-mode history entry
 */
export const safeModeHistoryEntrySchema = t.Object({
  enabled: t.Boolean(),
  reason: t.String(),
  triggered_by: safeModeTriggersSchema,
  organization_id: t.String(),
  actor_id: t.Nullable(t.String()),
  incident_id: t.Nullable(t.String()),
  effective_at: t.String(),
  updated_at: t.String(),
});

/**
 * Safe-mode history response
 */
export const safeModeHistoryResponseSchema = t.Object({
  organization_id: t.String(),
  entries: t.Array(safeModeHistoryEntrySchema),
});

/**
 * Error response schema
 */
export const errorResponseSchema = t.Object({
  error: t.String(),
  message: t.String(),
});
