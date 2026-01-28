/**
 * Policy Lifecycle Plugin
 *
 * Provides endpoints for policy pack lifecycle management.
 * Supports: create draft, review, approve, reject, activate, archive, rollback.
 *
 * Protected by API Key authentication with control:read/control:write scopes.
 *
 * @module plugins/policy-lifecycle
 */

import { PolicyLifecycleError, type PolicyPack } from '@popper/core';
import { Elysia, t } from 'elysia';
import { logger } from '../lib/logger';
import { getPolicyLifecycleManager } from '../lib/policy-lifecycle';
import {
  approveRequestSchema,
  createDraftRequestSchema,
  errorResponseSchema,
  policyPackHistoryResponseSchema,
  policyPackListResponseSchema,
  policyPackResponseSchema,
  policyPackStateSchema,
  rejectRequestSchema,
  rollbackRequestSchema,
} from '../lib/schemas';
import { createAuthGuard } from './api-key-auth';
import { createRateLimitGuard } from './rate-limit';

/**
 * Convert StoredPolicyPack to API response format
 */
function toApiResponse(pack: {
  id: string;
  organization_id: string | null;
  policy_id: string;
  version: string;
  state: string;
  content: unknown;
  created_by: string;
  reviewed_by: string | null;
  validation_result: unknown;
  submitted_at: Date | null;
  approved_at: Date | null;
  activated_at: Date | null;
  archived_at: Date | null;
  rejection_reason: string | null;
  change_notes: string | null;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: pack.id,
    organization_id: pack.organization_id,
    policy_id: pack.policy_id,
    version: pack.version,
    state: pack.state,
    content: pack.content,
    created_by: pack.created_by,
    reviewed_by: pack.reviewed_by,
    validation_result: pack.validation_result,
    submitted_at: pack.submitted_at?.toISOString() ?? null,
    approved_at: pack.approved_at?.toISOString() ?? null,
    activated_at: pack.activated_at?.toISOString() ?? null,
    archived_at: pack.archived_at?.toISOString() ?? null,
    rejection_reason: pack.rejection_reason,
    change_notes: pack.change_notes,
    created_at: pack.created_at.toISOString(),
    updated_at: pack.updated_at.toISOString(),
  };
}

/**
 * Policy Lifecycle Plugin
 *
 * Endpoints:
 * - GET    /v1/popper/policies - List policy packs (requires control:read)
 * - GET    /v1/popper/policies/:id - Get policy pack (requires control:read)
 * - GET    /v1/popper/policies/active/:policyId - Get active policy pack (requires control:read)
 * - GET    /v1/popper/policies/history/:policyId - Get policy history (requires control:read)
 * - POST   /v1/popper/policies - Create draft (requires control:write)
 * - POST   /v1/popper/policies/:id/submit - Submit for review (requires control:write)
 * - POST   /v1/popper/policies/:id/approve - Approve (requires control:write)
 * - POST   /v1/popper/policies/:id/reject - Reject (requires control:write)
 * - POST   /v1/popper/policies/:id/activate - Activate (requires control:write)
 * - POST   /v1/popper/policies/rollback - Rollback to archived version (requires control:write)
 */
export const policyLifecyclePlugin = new Elysia({
  name: 'policy-lifecycle',
  prefix: '/v1/popper/policies',
})
  // GET endpoints - require control:read scope
  .guard(createAuthGuard('control:read'), (app) =>
    app.guard(createRateLimitGuard(), (app) =>
      app
        .get(
          '/',
          async ({ query }) => {
            const manager = getPolicyLifecycleManager();
            const packs = await manager.list({
              organizationId: query.organization_id ?? undefined,
              policyId: query.policy_id,
              state: query.state as
                | 'DRAFT'
                | 'REVIEW'
                | 'STAGED'
                | 'ACTIVE'
                | 'ARCHIVED'
                | 'REJECTED'
                | undefined,
              limit: query.limit,
            });

            return {
              policy_packs: packs.map(toApiResponse),
            };
          },
          {
            query: t.Object({
              organization_id: t.Optional(t.String()),
              policy_id: t.Optional(t.String()),
              state: t.Optional(policyPackStateSchema),
              limit: t.Optional(t.Number({ minimum: 1, maximum: 1000 })),
            }),
            response: {
              200: policyPackListResponseSchema,
              401: errorResponseSchema,
              403: errorResponseSchema,
              429: errorResponseSchema,
            },
            detail: {
              summary: 'List policy packs',
              description: 'List policy packs with optional filters',
              tags: ['Policy Lifecycle'],
            },
          },
        )
        .get(
          '/:id',
          async ({ params, set }) => {
            const manager = getPolicyLifecycleManager();
            const pack = await manager.getById(params.id);

            if (!pack) {
              set.status = 404;
              return {
                error: 'not_found',
                message: `Policy pack ${params.id} not found`,
              };
            }

            return toApiResponse(pack);
          },
          {
            params: t.Object({
              id: t.String(),
            }),
            response: {
              200: policyPackResponseSchema,
              401: errorResponseSchema,
              403: errorResponseSchema,
              404: errorResponseSchema,
              429: errorResponseSchema,
            },
            detail: {
              summary: 'Get policy pack',
              description: 'Get a policy pack by ID',
              tags: ['Policy Lifecycle'],
            },
          },
        )
        .get(
          '/active/:policyId',
          async ({ params, query, set }) => {
            const manager = getPolicyLifecycleManager();
            const pack = await manager.getActive(query.organization_id ?? null, params.policyId);

            if (!pack) {
              set.status = 404;
              return {
                error: 'not_found',
                message: `No active policy pack found for ${params.policyId}`,
              };
            }

            return toApiResponse(pack);
          },
          {
            params: t.Object({
              policyId: t.String(),
            }),
            query: t.Object({
              organization_id: t.Optional(t.String()),
            }),
            response: {
              200: policyPackResponseSchema,
              401: errorResponseSchema,
              403: errorResponseSchema,
              404: errorResponseSchema,
              429: errorResponseSchema,
            },
            detail: {
              summary: 'Get active policy pack',
              description: 'Get the currently active policy pack for a policy ID',
              tags: ['Policy Lifecycle'],
            },
          },
        )
        .get(
          '/history/:policyId',
          async ({ params, query }) => {
            const manager = getPolicyLifecycleManager();
            const packs = await manager.getHistory(
              query.organization_id ?? null,
              params.policyId,
              query.limit,
            );

            return {
              organization_id: query.organization_id ?? null,
              policy_id: params.policyId,
              versions: packs.map(toApiResponse),
            };
          },
          {
            params: t.Object({
              policyId: t.String(),
            }),
            query: t.Object({
              organization_id: t.Optional(t.String()),
              limit: t.Optional(t.Number({ minimum: 1, maximum: 1000 })),
            }),
            response: {
              200: policyPackHistoryResponseSchema,
              401: errorResponseSchema,
              403: errorResponseSchema,
              429: errorResponseSchema,
            },
            detail: {
              summary: 'Get policy pack history',
              description: 'Get version history for a policy ID',
              tags: ['Policy Lifecycle'],
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
          '/',
          async ({ body, query, apiKey, set }) => {
            const manager = getPolicyLifecycleManager();
            const actor = apiKey?.keyName ?? 'system';

            try {
              logger.info`Creating policy draft: policy_id=${body.policy_id} version=${body.version} actor=${actor}`;

              const pack = await manager.createDraft({
                organization_id: query.organization_id ?? null,
                policy_id: body.policy_id,
                version: body.version,
                content: body.content as PolicyPack,
                actor,
                change_notes: body.change_notes,
              });

              logger.info`Policy draft created: id=${pack.id}`;
              set.status = 201;
              return toApiResponse(pack);
            } catch (e) {
              if (e instanceof PolicyLifecycleError) {
                set.status = e.code === 'VERSION_ALREADY_EXISTS' ? 409 : 400;
                return {
                  error: e.code.toLowerCase(),
                  message: e.message,
                };
              }
              throw e;
            }
          },
          {
            body: createDraftRequestSchema,
            query: t.Object({
              organization_id: t.Optional(t.String()),
            }),
            response: {
              201: policyPackResponseSchema,
              400: errorResponseSchema,
              401: errorResponseSchema,
              403: errorResponseSchema,
              409: errorResponseSchema,
              429: errorResponseSchema,
            },
            detail: {
              summary: 'Create policy draft',
              description: 'Create a new policy pack draft',
              tags: ['Policy Lifecycle'],
            },
          },
        )
        .post(
          '/:id/submit',
          async ({ params, apiKey, set }) => {
            const manager = getPolicyLifecycleManager();
            const actor = apiKey?.keyName ?? 'system';

            try {
              logger.info`Submitting policy for review: id=${params.id} actor=${actor}`;

              const pack = await manager.submitForReview({
                policy_pack_id: params.id,
                actor,
              });

              logger.info`Policy submitted for review: id=${pack.id}`;
              return toApiResponse(pack);
            } catch (e) {
              if (e instanceof PolicyLifecycleError) {
                set.status = e.code === 'POLICY_NOT_FOUND' ? 404 : 400;
                return {
                  error: e.code.toLowerCase(),
                  message: e.message,
                };
              }
              throw e;
            }
          },
          {
            params: t.Object({
              id: t.String(),
            }),
            response: {
              200: policyPackResponseSchema,
              400: errorResponseSchema,
              401: errorResponseSchema,
              403: errorResponseSchema,
              404: errorResponseSchema,
              429: errorResponseSchema,
            },
            detail: {
              summary: 'Submit for review',
              description: 'Submit a draft policy pack for review',
              tags: ['Policy Lifecycle'],
            },
          },
        )
        .post(
          '/:id/approve',
          async ({ params, body, apiKey, set }) => {
            const manager = getPolicyLifecycleManager();
            const actor = apiKey?.keyName ?? 'system';

            try {
              logger.info`Approving policy: id=${params.id} actor=${actor}`;

              const pack = await manager.approve({
                policy_pack_id: params.id,
                actor,
                validation_result: body.validation_result,
              });

              logger.info`Policy approved (staged): id=${pack.id}`;
              return toApiResponse(pack);
            } catch (e) {
              if (e instanceof PolicyLifecycleError) {
                if (e.code === 'POLICY_NOT_FOUND') {
                  set.status = 404;
                } else if (e.code === 'VALIDATION_FAILED') {
                  set.status = 422;
                } else {
                  set.status = 400;
                }
                return {
                  error: e.code.toLowerCase(),
                  message: e.message,
                  details: e.details,
                };
              }
              throw e;
            }
          },
          {
            params: t.Object({
              id: t.String(),
            }),
            body: approveRequestSchema,
            response: {
              200: policyPackResponseSchema,
              400: errorResponseSchema,
              401: errorResponseSchema,
              403: errorResponseSchema,
              404: errorResponseSchema,
              422: errorResponseSchema,
              429: errorResponseSchema,
            },
            detail: {
              summary: 'Approve policy',
              description: 'Approve a policy pack and move to STAGED state',
              tags: ['Policy Lifecycle'],
            },
          },
        )
        .post(
          '/:id/reject',
          async ({ params, body, apiKey, set }) => {
            const manager = getPolicyLifecycleManager();
            const actor = apiKey?.keyName ?? 'system';

            try {
              logger.info`Rejecting policy: id=${params.id} reason="${body.reason}" actor=${actor}`;

              const pack = await manager.reject({
                policy_pack_id: params.id,
                actor,
                reason: body.reason,
              });

              logger.info`Policy rejected: id=${pack.id}`;
              return toApiResponse(pack);
            } catch (e) {
              if (e instanceof PolicyLifecycleError) {
                set.status = e.code === 'POLICY_NOT_FOUND' ? 404 : 400;
                return {
                  error: e.code.toLowerCase(),
                  message: e.message,
                };
              }
              throw e;
            }
          },
          {
            params: t.Object({
              id: t.String(),
            }),
            body: rejectRequestSchema,
            response: {
              200: policyPackResponseSchema,
              400: errorResponseSchema,
              401: errorResponseSchema,
              403: errorResponseSchema,
              404: errorResponseSchema,
              429: errorResponseSchema,
            },
            detail: {
              summary: 'Reject policy',
              description: 'Reject a policy pack during review',
              tags: ['Policy Lifecycle'],
            },
          },
        )
        .post(
          '/:id/activate',
          async ({ params, apiKey, set }) => {
            const manager = getPolicyLifecycleManager();
            const actor = apiKey?.keyName ?? 'system';

            try {
              logger.info`Activating policy: id=${params.id} actor=${actor}`;

              const pack = await manager.activate({
                policy_pack_id: params.id,
                actor,
              });

              logger.info`Policy activated: id=${pack.id} version=${pack.version}`;
              return toApiResponse(pack);
            } catch (e) {
              if (e instanceof PolicyLifecycleError) {
                set.status = e.code === 'POLICY_NOT_FOUND' ? 404 : 400;
                return {
                  error: e.code.toLowerCase(),
                  message: e.message,
                };
              }
              throw e;
            }
          },
          {
            params: t.Object({
              id: t.String(),
            }),
            response: {
              200: policyPackResponseSchema,
              400: errorResponseSchema,
              401: errorResponseSchema,
              403: errorResponseSchema,
              404: errorResponseSchema,
              429: errorResponseSchema,
            },
            detail: {
              summary: 'Activate policy',
              description: 'Activate a staged policy pack (archives previous active version)',
              tags: ['Policy Lifecycle'],
            },
          },
        )
        .post(
          '/rollback',
          async ({ body, apiKey, set }) => {
            const manager = getPolicyLifecycleManager();
            const actor = apiKey?.keyName ?? 'system';

            try {
              logger.info`Rolling back policy: source_id=${body.source_policy_pack_id} reason="${body.reason}" actor=${actor}`;

              const pack = await manager.rollback({
                source_policy_pack_id: body.source_policy_pack_id,
                actor,
                reason: body.reason,
              });

              logger.info`Policy rollback complete: id=${pack.id} version=${pack.version}`;
              return toApiResponse(pack);
            } catch (e) {
              if (e instanceof PolicyLifecycleError) {
                set.status = e.code === 'POLICY_NOT_FOUND' ? 404 : 400;
                return {
                  error: e.code.toLowerCase(),
                  message: e.message,
                };
              }
              throw e;
            }
          },
          {
            body: rollbackRequestSchema,
            response: {
              200: policyPackResponseSchema,
              400: errorResponseSchema,
              401: errorResponseSchema,
              403: errorResponseSchema,
              404: errorResponseSchema,
              429: errorResponseSchema,
            },
            detail: {
              summary: 'Rollback policy',
              description: 'Emergency rollback to a previously archived policy version',
              tags: ['Policy Lifecycle'],
            },
          },
        ),
    ),
  );
