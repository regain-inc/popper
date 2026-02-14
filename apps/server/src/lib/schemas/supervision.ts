/**
 * Elysia request/response schemas for Supervision API
 *
 * @module plugins/schemas
 */

import { t } from 'elysia';

/**
 * Minimal request body schema for Elysia validation.
 * Full Hermes validation happens after body parsing.
 */
export const supervisionRequestSchema = t.Object(
  {
    hermes_version: t.String(),
    message_type: t.Literal('supervision_request'),
    mode: t.Union([t.Literal('wellness'), t.Literal('advocate_clinical')]),
    trace: t.Object(
      {
        trace_id: t.String(),
        created_at: t.String(),
        producer: t.Object(
          {
            system: t.String(),
            service_version: t.Optional(t.String()),
          },
          { additionalProperties: true },
        ),
      },
      { additionalProperties: true },
    ),
    subject: t.Object(
      {
        subject_id: t.String(),
        subject_type: t.String(),
        organization_id: t.Optional(t.String()),
      },
      { additionalProperties: true },
    ),
    snapshot: t.Object(
      {
        snapshot_id: t.String(),
        created_at: t.Optional(t.String()),
        sources: t.Optional(t.Array(t.String())),
      },
      { additionalProperties: true },
    ),
    proposals: t.Array(t.Any()),
    audit_redaction: t.Object(
      {
        summary: t.String(),
        proposal_summaries: t.Optional(t.Array(t.String())),
      },
      { additionalProperties: true },
    ),
    request_timestamp: t.Optional(t.String()),
    idempotency_key: t.Optional(t.String()),
  },
  { additionalProperties: true },
);

/**
 * Response schema for Elysia.
 */
export const supervisionResponseSchema = t.Object(
  {
    hermes_version: t.String(),
    message_type: t.Literal('supervision_response'),
    trace: t.Any(),
    mode: t.String(),
    subject: t.Any(),
    snapshot: t.Any(),
    decision: t.Union([
      t.Literal('APPROVED'),
      t.Literal('REQUEST_MORE_INFO'),
      t.Literal('ROUTE_TO_CLINICIAN'),
      t.Literal('HARD_STOP'),
    ]),
    reason_codes: t.Array(t.String()),
    explanation: t.String(),
    audit_redaction: t.Any(),
    response_timestamp: t.Optional(t.String()),
    per_proposal_decisions: t.Optional(
      t.Array(
        t.Object({
          proposal_id: t.String(),
          decision: t.Union([
            t.Literal('APPROVED'),
            t.Literal('REQUEST_MORE_INFO'),
            t.Literal('ROUTE_TO_CLINICIAN'),
            t.Literal('HARD_STOP'),
          ]),
          reason_codes: t.Array(t.String()),
        }),
      ),
    ),
  },
  { additionalProperties: true },
);
