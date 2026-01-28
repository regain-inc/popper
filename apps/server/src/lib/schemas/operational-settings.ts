/**
 * Elysia schemas for Operational Settings API
 *
 * @module lib/schemas/operational-settings
 */

import { t } from 'elysia';

/**
 * Available settings keys
 */
export const settingsKeySchema = t.Union([
  t.Literal('staleness.wellness_hours'),
  t.Literal('staleness.clinical_hours'),
  t.Literal('rate_limit.per_minute'),
  t.Literal('rate_limit.per_hour'),
  t.Literal('policy_pack'),
]);

/**
 * Operational setting record
 */
export const operationalSettingSchema = t.Object({
  id: t.String({ format: 'uuid' }),
  organization_id: t.Nullable(t.String()),
  key: settingsKeySchema,
  value: t.Unknown({ description: 'Setting value (type depends on key)' }),
  effective_at: t.String({ description: 'ISO 8601 timestamp' }),
  created_by: t.String(),
  reason: t.Nullable(t.String()),
  created_at: t.String({ description: 'ISO 8601 timestamp' }),
});

/**
 * Request to change a setting
 */
export const settingsChangeRequestSchema = t.Object({
  key: settingsKeySchema,
  value: t.Unknown({
    description: 'Setting value (number for staleness/rate_limit, string for policy_pack)',
  }),
  reason: t.Optional(t.String({ description: 'Reason for the change' })),
  effective_at: t.Optional(
    t.String({ description: 'When change takes effect (ISO 8601), defaults to now' }),
  ),
});

/**
 * Response for getting all settings
 */
export const allSettingsResponseSchema = t.Object({
  organization_id: t.Nullable(t.String()),
  settings: t.Record(settingsKeySchema, t.Unknown()),
});

/**
 * Response for getting effective settings
 */
export const effectiveSettingsResponseSchema = t.Object({
  organization_id: t.Nullable(t.String()),
  values: t.Record(settingsKeySchema, t.Unknown()),
  sources: t.Record(
    settingsKeySchema,
    t.Union([t.Literal('global'), t.Literal('organization'), t.Literal('default')]),
  ),
  snapshot_at: t.String({ description: 'ISO 8601 timestamp' }),
});

/**
 * Response for getting a single setting
 */
export const singleSettingResponseSchema = t.Object({
  organization_id: t.Nullable(t.String()),
  key: settingsKeySchema,
  value: t.Unknown(),
  source: t.Union([t.Literal('global'), t.Literal('organization'), t.Literal('default')]),
});

/**
 * Settings history response
 */
export const settingsHistoryResponseSchema = t.Object({
  organization_id: t.Nullable(t.String()),
  key: settingsKeySchema,
  entries: t.Array(operationalSettingSchema),
});
