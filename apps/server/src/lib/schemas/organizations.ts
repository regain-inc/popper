/**
 * Elysia schemas for Organization Admin endpoints
 *
 * @module lib/schemas/organizations
 */

import { t } from 'elysia';

/**
 * Supervision mode enum
 */
export const supervisionModeSchema = t.Union([
  t.Literal('wellness'),
  t.Literal('advocate_clinical'),
]);

/**
 * Request to create a new organization
 */
export const createOrganizationRequestSchema = t.Object({
  id: t.String({
    description: 'Unique organization identifier (e.g., "org_abc123")',
    minLength: 1,
    maxLength: 255,
  }),
  name: t.String({ description: 'Human-readable organization name', minLength: 1, maxLength: 255 }),
  allowed_modes: t.Optional(
    t.Array(supervisionModeSchema, { description: 'Allowed supervision modes' }),
  ),
  rate_limit_per_minute: t.Optional(
    t.Number({ description: 'Rate limit in requests per minute', minimum: 1 }),
  ),
  rate_limit_per_hour: t.Optional(
    t.Number({ description: 'Rate limit in requests per hour', minimum: 1 }),
  ),
  default_policy_pack: t.Optional(
    t.String({ description: 'Default policy pack ID', minLength: 1 }),
  ),
  staleness_wellness_hours: t.Optional(
    t.Nullable(
      t.Number({ description: 'Staleness threshold for wellness mode (hours)', minimum: 1 }),
    ),
  ),
  staleness_clinical_hours: t.Optional(
    t.Nullable(
      t.Number({ description: 'Staleness threshold for clinical mode (hours)', minimum: 1 }),
    ),
  ),
  is_active: t.Optional(t.Boolean({ description: 'Whether the organization is active' })),
  metadata: t.Optional(t.Record(t.String(), t.Unknown(), { description: 'Optional metadata' })),
});

/**
 * Request to update an organization
 */
export const updateOrganizationRequestSchema = t.Object({
  name: t.Optional(
    t.String({ description: 'Human-readable organization name', minLength: 1, maxLength: 255 }),
  ),
  allowed_modes: t.Optional(
    t.Array(supervisionModeSchema, { description: 'Allowed supervision modes' }),
  ),
  rate_limit_per_minute: t.Optional(
    t.Number({ description: 'Rate limit in requests per minute', minimum: 1 }),
  ),
  rate_limit_per_hour: t.Optional(
    t.Number({ description: 'Rate limit in requests per hour', minimum: 1 }),
  ),
  default_policy_pack: t.Optional(
    t.String({ description: 'Default policy pack ID', minLength: 1 }),
  ),
  staleness_wellness_hours: t.Optional(
    t.Nullable(
      t.Number({ description: 'Staleness threshold for wellness mode (hours)', minimum: 1 }),
    ),
  ),
  staleness_clinical_hours: t.Optional(
    t.Nullable(
      t.Number({ description: 'Staleness threshold for clinical mode (hours)', minimum: 1 }),
    ),
  ),
  is_active: t.Optional(t.Boolean({ description: 'Whether the organization is active' })),
  metadata: t.Optional(t.Record(t.String(), t.Unknown(), { description: 'Optional metadata' })),
});

/**
 * Organization response schema
 */
export const organizationResponseSchema = t.Object({
  id: t.String({ description: 'Unique organization identifier' }),
  name: t.String({ description: 'Human-readable organization name' }),
  allowed_modes: t.Array(supervisionModeSchema),
  rate_limit_per_minute: t.Number(),
  rate_limit_per_hour: t.Number(),
  default_policy_pack: t.String(),
  staleness_wellness_hours: t.Nullable(t.Number()),
  staleness_clinical_hours: t.Nullable(t.Number()),
  is_active: t.Boolean(),
  created_at: t.String({ format: 'date-time' }),
  updated_at: t.String({ format: 'date-time' }),
  metadata: t.Record(t.String(), t.Unknown()),
});

/**
 * Response for listing organizations
 */
export const listOrganizationsResponseSchema = t.Object({
  organizations: t.Array(organizationResponseSchema),
});
