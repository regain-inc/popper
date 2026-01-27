/**
 * Admin Organizations Plugin
 *
 * Provides endpoints for organization management:
 * - GET /v1/popper/admin/orgs - List organizations
 * - GET /v1/popper/admin/orgs/:id - Get organization by ID
 * - POST /v1/popper/admin/orgs - Create a new organization
 * - PUT /v1/popper/admin/orgs/:id - Update an organization
 *
 * All endpoints require admin:orgs:read or admin:orgs:write scope.
 *
 * @module plugins/admin-orgs
 */

import type { SupervisionMode } from '@popper/db';
import { Elysia, t } from 'elysia';
import { logger } from '../lib/logger';
import { getOrganizationService, isOrganizationServiceInitialized } from '../lib/organizations';
import {
  createOrganizationRequestSchema,
  errorResponseSchema,
  listOrganizationsResponseSchema,
  organizationResponseSchema,
  updateOrganizationRequestSchema,
} from '../lib/schemas';
import { createAuthGuard } from './api-key-auth';

/**
 * Map stored organization to API response format
 */
function mapOrganizationToResponse(org: {
  id: string;
  name: string;
  allowedModes: SupervisionMode[];
  rateLimitPerMinute: number;
  rateLimitPerHour: number;
  defaultPolicyPack: string;
  stalenessWellnessHours: number | null;
  stalenessClinicalHours: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}) {
  return {
    id: org.id,
    name: org.name,
    allowed_modes: org.allowedModes,
    rate_limit_per_minute: org.rateLimitPerMinute,
    rate_limit_per_hour: org.rateLimitPerHour,
    default_policy_pack: org.defaultPolicyPack,
    staleness_wellness_hours: org.stalenessWellnessHours,
    staleness_clinical_hours: org.stalenessClinicalHours,
    is_active: org.isActive,
    created_at: org.createdAt.toISOString(),
    updated_at: org.updatedAt.toISOString(),
    metadata: org.metadata,
  };
}

/**
 * Admin Organizations Plugin
 *
 * Requires API key authentication with appropriate scopes.
 */
export const adminOrgsPlugin = new Elysia({ name: 'admin-orgs', prefix: '/v1/popper/admin' })
  // GET /orgs - List organizations (requires admin:orgs:read)
  // GET /orgs/:id - Get organization by ID (requires admin:orgs:read)
  .guard(createAuthGuard('admin:orgs:read'), (app) =>
    app
      .get(
        '/orgs',
        async ({ query, set }) => {
          if (!isOrganizationServiceInitialized()) {
            logger.error`Organization service not initialized`;
            set.status = 500;
            return { error: 'internal_error', message: 'Organization service not available' };
          }

          const service = getOrganizationService();

          try {
            const orgs = await service.list({
              includeInactive: query.include_inactive ?? false,
              limit: query.limit ?? 100,
            });

            return {
              organizations: orgs.map(mapOrganizationToResponse),
            };
          } catch (error) {
            logger.error`Failed to list organizations: ${error}`;
            set.status = 500;
            return { error: 'internal_error', message: 'Failed to list organizations' };
          }
        },
        {
          query: t.Object({
            include_inactive: t.Optional(
              t.Boolean({ description: 'Include inactive organizations' }),
            ),
            limit: t.Optional(
              t.Number({ description: 'Max organizations to return', minimum: 1, maximum: 1000 }),
            ),
          }),
          response: {
            200: listOrganizationsResponseSchema,
            401: errorResponseSchema,
            403: errorResponseSchema,
            500: errorResponseSchema,
          },
          detail: {
            summary: 'List organizations',
            description: 'List all organizations',
            tags: ['Admin - Organizations'],
          },
        },
      )
      .get(
        '/orgs/:id',
        async ({ params, set }) => {
          if (!isOrganizationServiceInitialized()) {
            logger.error`Organization service not initialized`;
            set.status = 500;
            return { error: 'internal_error', message: 'Organization service not available' };
          }

          const service = getOrganizationService();

          try {
            const org = await service.getById(params.id);

            if (!org) {
              set.status = 404;
              return { error: 'not_found', message: 'Organization not found' };
            }

            return mapOrganizationToResponse(org);
          } catch (error) {
            logger.error`Failed to get organization: ${error}`;
            set.status = 500;
            return { error: 'internal_error', message: 'Failed to get organization' };
          }
        },
        {
          params: t.Object({
            id: t.String({ description: 'Organization ID' }),
          }),
          response: {
            200: organizationResponseSchema,
            401: errorResponseSchema,
            403: errorResponseSchema,
            404: errorResponseSchema,
            500: errorResponseSchema,
          },
          detail: {
            summary: 'Get organization',
            description: 'Get organization by ID',
            tags: ['Admin - Organizations'],
          },
        },
      ),
  )
  // POST /orgs - Create organization (requires admin:orgs:write)
  // PUT /orgs/:id - Update organization (requires admin:orgs:write)
  .guard(createAuthGuard('admin:orgs:write'), (app) =>
    app
      .post(
        '/orgs',
        async ({ body, set }) => {
          if (!isOrganizationServiceInitialized()) {
            logger.error`Organization service not initialized`;
            set.status = 500;
            return { error: 'internal_error', message: 'Organization service not available' };
          }

          const service = getOrganizationService();

          try {
            // Check if organization with this ID already exists
            const existing = await service.getById(body.id);
            if (existing) {
              set.status = 409;
              return { error: 'conflict', message: 'Organization with this ID already exists' };
            }

            const org = await service.create({
              id: body.id,
              name: body.name,
              allowedModes: body.allowed_modes as SupervisionMode[] | undefined,
              rateLimitPerMinute: body.rate_limit_per_minute,
              rateLimitPerHour: body.rate_limit_per_hour,
              defaultPolicyPack: body.default_policy_pack,
              stalenessWellnessHours: body.staleness_wellness_hours,
              stalenessClinicalHours: body.staleness_clinical_hours,
              isActive: body.is_active,
              metadata: body.metadata,
            });

            logger.info`Organization created: id=${org.id} name="${org.name}"`;

            set.status = 201;
            return mapOrganizationToResponse(org);
          } catch (error) {
            logger.error`Failed to create organization: ${error}`;
            set.status = 500;
            return { error: 'internal_error', message: 'Failed to create organization' };
          }
        },
        {
          body: createOrganizationRequestSchema,
          response: {
            201: organizationResponseSchema,
            401: errorResponseSchema,
            403: errorResponseSchema,
            409: errorResponseSchema,
            500: errorResponseSchema,
          },
          detail: {
            summary: 'Create organization',
            description: 'Create a new organization',
            tags: ['Admin - Organizations'],
          },
        },
      )
      .put(
        '/orgs/:id',
        async ({ params, body, set }) => {
          if (!isOrganizationServiceInitialized()) {
            logger.error`Organization service not initialized`;
            set.status = 500;
            return { error: 'internal_error', message: 'Organization service not available' };
          }

          const service = getOrganizationService();

          try {
            const org = await service.update(params.id, {
              name: body.name,
              allowedModes: body.allowed_modes as SupervisionMode[] | undefined,
              rateLimitPerMinute: body.rate_limit_per_minute,
              rateLimitPerHour: body.rate_limit_per_hour,
              defaultPolicyPack: body.default_policy_pack,
              stalenessWellnessHours: body.staleness_wellness_hours,
              stalenessClinicalHours: body.staleness_clinical_hours,
              isActive: body.is_active,
              metadata: body.metadata,
            });

            if (!org) {
              set.status = 404;
              return { error: 'not_found', message: 'Organization not found' };
            }

            logger.info`Organization updated: id=${org.id}`;

            return mapOrganizationToResponse(org);
          } catch (error) {
            logger.error`Failed to update organization: ${error}`;
            set.status = 500;
            return { error: 'internal_error', message: 'Failed to update organization' };
          }
        },
        {
          params: t.Object({
            id: t.String({ description: 'Organization ID' }),
          }),
          body: updateOrganizationRequestSchema,
          response: {
            200: organizationResponseSchema,
            401: errorResponseSchema,
            403: errorResponseSchema,
            404: errorResponseSchema,
            500: errorResponseSchema,
          },
          detail: {
            summary: 'Update organization',
            description: 'Update an existing organization',
            tags: ['Admin - Organizations'],
          },
        },
      ),
  );
