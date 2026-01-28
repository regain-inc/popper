/**
 * Policy Lifecycle Schemas
 *
 * Elysia/Typebox schemas for policy lifecycle API validation.
 *
 * @module schemas/policy-lifecycle
 */

import { t } from 'elysia';

// =============================================================================
// Enums
// =============================================================================

export const policyPackStateSchema = t.Union([
  t.Literal('DRAFT'),
  t.Literal('REVIEW'),
  t.Literal('STAGED'),
  t.Literal('ACTIVE'),
  t.Literal('ARCHIVED'),
  t.Literal('REJECTED'),
]);

// =============================================================================
// Nested Types
// =============================================================================

export const validationCheckSchema = t.Object({
  name: t.String(),
  passed: t.Boolean(),
  message: t.Optional(t.String()),
  severity: t.Optional(t.Union([t.Literal('warning'), t.Literal('error'), t.Literal('critical')])),
});

export const validationResultSchema = t.Object({
  passed: t.Boolean(),
  checks: t.Array(validationCheckSchema),
  validated_at: t.String(),
  validated_by: t.String(),
});

export const policyPackContentSchema = t.Object({
  policy_id: t.String(),
  policy_version: t.String(),
  metadata: t.Optional(
    t.Object({
      description: t.Optional(t.String()),
      owner: t.Optional(t.String()),
      created_at: t.Optional(t.String()),
      sources: t.Optional(
        t.Array(
          t.Object({
            kind: t.Union([t.Literal('policy'), t.Literal('guideline'), t.Literal('other')]),
            citation: t.String(),
          }),
        ),
      ),
    }),
  ),
  staleness: t.Optional(
    t.Object({
      thresholds: t.Object({
        wellness_hours: t.Number(),
        clinical_hours: t.Number(),
      }),
      signals: t.Optional(t.Record(t.String(), t.String())),
      behavior: t.Object({
        low_risk_stale: t.Union([t.Literal('REQUEST_MORE_INFO'), t.Literal('ROUTE_TO_CLINICIAN')]),
        high_risk_stale: t.Union([t.Literal('ROUTE_TO_CLINICIAN'), t.Literal('HARD_STOP')]),
      }),
    }),
  ),
  rules: t.Array(t.Unknown()), // Full rule validation is done by core parser
});

// =============================================================================
// Response Schemas
// =============================================================================

export const policyPackResponseSchema = t.Object({
  id: t.String(),
  organization_id: t.Nullable(t.String()),
  policy_id: t.String(),
  version: t.String(),
  state: policyPackStateSchema,
  content: policyPackContentSchema,
  created_by: t.String(),
  reviewed_by: t.Nullable(t.String()),
  validation_result: t.Nullable(validationResultSchema),
  submitted_at: t.Nullable(t.String()),
  approved_at: t.Nullable(t.String()),
  activated_at: t.Nullable(t.String()),
  archived_at: t.Nullable(t.String()),
  rejection_reason: t.Nullable(t.String()),
  change_notes: t.Nullable(t.String()),
  created_at: t.String(),
  updated_at: t.String(),
});

export const policyPackListResponseSchema = t.Object({
  policy_packs: t.Array(policyPackResponseSchema),
});

export const policyPackHistoryResponseSchema = t.Object({
  organization_id: t.Nullable(t.String()),
  policy_id: t.String(),
  versions: t.Array(policyPackResponseSchema),
});

// =============================================================================
// Request Schemas
// =============================================================================

export const createDraftRequestSchema = t.Object({
  policy_id: t.String({ minLength: 1, maxLength: 100 }),
  version: t.String({
    minLength: 1,
    maxLength: 50,
    pattern: '^[0-9]+\\.[0-9]+\\.[0-9]+(-[a-zA-Z0-9.-]+)?$',
  }),
  content: policyPackContentSchema,
  change_notes: t.Optional(t.String({ maxLength: 2000 })),
});

export const submitForReviewRequestSchema = t.Object({
  // No additional fields needed - ID comes from URL
});

export const approveRequestSchema = t.Object({
  validation_result: validationResultSchema,
});

export const rejectRequestSchema = t.Object({
  reason: t.String({ minLength: 1, maxLength: 2000 }),
});

export const activateRequestSchema = t.Object({
  // No additional fields needed - ID comes from URL
});

export const rollbackRequestSchema = t.Object({
  source_policy_pack_id: t.String({ format: 'uuid' }),
  reason: t.String({ minLength: 1, maxLength: 2000 }),
});
