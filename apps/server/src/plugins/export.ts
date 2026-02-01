/**
 * Export Plugin
 *
 * Provides endpoints for generating and downloading de-identified export bundles.
 * Protected by API Key authentication with control:read/control:write scopes.
 *
 * @module plugins/export
 */

import { createExportAuditEvent, getDefaultEmitter } from '@popper/core';
import { Elysia, t } from 'elysia';
import { getExportGenerator, isExportGeneratorInitialized } from '../lib/export';
import { logger } from '../lib/logger';
import { errorResponseSchema } from '../lib/schemas';
import { type ApiKeyContext, createAuthGuard } from './api-key-auth';
import { createRateLimitGuard } from './rate-limit';

/** Elysia schema for TEFCA/USCDI compliance metadata in API responses */
const complianceSchema = t.Optional(
  t.Object({
    uscdi_v3: t.Optional(
      t.Object({
        version: t.String(),
        data_classes: t.Array(
          t.Object({
            class: t.String(),
            status: t.Union([t.Literal('present'), t.Literal('partial'), t.Literal('missing')]),
            source_fields: t.Array(t.String()),
            gaps: t.Optional(t.Array(t.String())),
          }),
        ),
        coverage_score: t.Number(),
        gaps_summary: t.String(),
      }),
    ),
    tefca: t.Optional(
      t.Object({
        framework_version: t.String(),
        exchange_purposes: t.Array(t.String()),
        document_format: t.String(),
        ccda_convertible: t.Boolean(),
        qhin_ready: t.Boolean(),
        push_capable: t.Boolean(),
        pull_queryable: t.Boolean(),
      }),
    ),
    interop_refs: t.Optional(
      t.Array(
        t.Object({
          interop_id: t.String(),
          standard: t.String(),
          content_type: t.String(),
          message_type: t.Optional(t.String()),
          uri: t.String(),
          content_hash: t.Optional(t.String()),
          audit_redaction: t.Object({ summary: t.String() }),
        }),
      ),
    ),
  }),
);

/** System organization ID that has access to all organizations */
const SYSTEM_ORG_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Check if API key has access to the requested organization
 * Returns error response if access denied, undefined if allowed
 */
function checkTenantAccess(
  apiKey: ApiKeyContext | null,
  requestedOrgId: string,
  set: { status: number },
): { error: string; message: string } | undefined {
  if (!apiKey) {
    set.status = 401;
    return { error: 'unauthorized', message: 'Missing API key context' };
  }

  // System org has access to all organizations
  if (apiKey.organizationId === SYSTEM_ORG_ID) {
    return undefined;
  }

  // Check if API key org matches requested org
  if (apiKey.organizationId !== requestedOrgId) {
    logger.warning`Tenant isolation violation: key_org=${apiKey.organizationId} requested_org=${requestedOrgId}`;
    set.status = 403;
    return {
      error: 'forbidden',
      message: 'Access denied: API key does not have access to this organization',
    };
  }

  return undefined;
}

/**
 * Export Plugin
 *
 * Endpoints:
 * - POST /v1/popper/export - Generate a new export bundle
 * - GET  /v1/popper/export - List export bundles for organization
 * - GET  /v1/popper/export/:id - Get export bundle metadata
 * - GET  /v1/popper/export/:id/download - Download export bundle
 */
export const exportPlugin = new Elysia({ name: 'export', prefix: '/v1/popper/export' })
  // POST endpoint - generate bundle (requires control:write)
  .guard(createAuthGuard('control:write'), (app) =>
    app.guard(createRateLimitGuard(), (app) =>
      app.post(
        '/',
        async ({ body, query, set, apiKey }) => {
          // Check tenant isolation
          const tenantError = checkTenantAccess(apiKey, query.organization_id, set);
          if (tenantError) return tenantError;

          if (!isExportGeneratorInitialized()) {
            set.status = 503;
            return {
              error: 'service_unavailable',
              message: 'Export generator not initialized.',
            };
          }

          const generator = getExportGenerator();

          logger.info`Export bundle generation requested: org=${query.organization_id} from=${body.from} to=${body.to} by=${apiKey?.keyId}`;

          try {
            const bundle = await generator.generate({
              organization_id: query.organization_id,
              from: new Date(body.from),
              to: new Date(body.to),
              mode: body.mode,
              trace_ids: body.trace_ids,
              include_snapshot_uris: body.include_snapshot_uris,
              triggered_by: body.triggered_by,
              notes: body.notes,
            });

            logger.info`Export bundle generated: id=${bundle.id} events=${bundle.event_count} incidents=${bundle.incident_count}`;

            // Emit audit event for generation
            const auditEmitter = getDefaultEmitter();
            auditEmitter.emit(
              createExportAuditEvent({
                eventType: 'EXPORT_GENERATED',
                bundleId: bundle.id,
                organizationId: bundle.organization_id,
                actor: apiKey?.keyName ?? 'unknown',
                actorKeyId: apiKey?.keyId,
                bundleSize: bundle.size_bytes,
                eventCount: bundle.event_count,
                incidentCount: bundle.incident_count,
                timeWindow: {
                  from: bundle.time_window.from.toISOString(),
                  to: bundle.time_window.to.toISOString(),
                },
              }),
            );

            return {
              id: bundle.id,
              organization_id: bundle.organization_id,
              time_window: {
                from: bundle.time_window.from.toISOString(),
                to: bundle.time_window.to.toISOString(),
              },
              generated_at: bundle.generated_at.toISOString(),
              triggered_by: bundle.triggered_by,
              storage_uri: bundle.storage_uri,
              size_bytes: bundle.size_bytes,
              content_hash: bundle.content_hash,
              event_count: bundle.event_count,
              incident_count: bundle.incident_count,
              status: bundle.status,
              expires_at: bundle.expires_at?.toISOString(),
              compliance: bundle.compliance,
            };
          } catch (error) {
            logger.error`Export bundle generation failed: ${error}`;
            set.status = 500;
            return {
              error: 'generation_failed',
              message: `Failed to generate export bundle: ${error}`,
            };
          }
        },
        {
          body: t.Object({
            from: t.String({ description: 'Start of time window (ISO 8601)' }),
            to: t.String({ description: 'End of time window (ISO 8601)' }),
            mode: t.Optional(t.Union([t.Literal('wellness'), t.Literal('advocate_clinical')])),
            trace_ids: t.Optional(t.Array(t.String())),
            include_snapshot_uris: t.Optional(t.Boolean()),
            triggered_by: t.Union([
              t.Literal('manual'),
              t.Literal('incident'),
              t.Literal('scheduled'),
            ]),
            notes: t.Optional(t.String()),
          }),
          query: t.Object({
            organization_id: t.String(),
          }),
          response: {
            200: t.Object({
              id: t.String(),
              organization_id: t.String(),
              time_window: t.Object({
                from: t.String(),
                to: t.String(),
              }),
              generated_at: t.String(),
              triggered_by: t.String(),
              storage_uri: t.String(),
              size_bytes: t.Number(),
              content_hash: t.String(),
              event_count: t.Number(),
              incident_count: t.Number(),
              status: t.String(),
              expires_at: t.Optional(t.String()),
              compliance: complianceSchema,
            }),
            401: errorResponseSchema,
            403: errorResponseSchema,
            429: errorResponseSchema,
            500: errorResponseSchema,
            503: errorResponseSchema,
          },
          detail: {
            summary: 'Generate export bundle',
            description: 'Generate a de-identified export bundle for regulatory compliance',
            tags: ['Export'],
          },
        },
      ),
    ),
  )
  // GET endpoints - require control:read scope
  .guard(createAuthGuard('control:read'), (app) =>
    app.guard(createRateLimitGuard(), (app) =>
      app
        .get(
          '/',
          async ({ query, set, apiKey }) => {
            // Check tenant isolation
            const tenantError = checkTenantAccess(apiKey, query.organization_id, set);
            if (tenantError) return tenantError;

            if (!isExportGeneratorInitialized()) {
              set.status = 503;
              return {
                error: 'service_unavailable',
                message: 'Export generator not initialized.',
              };
            }

            const generator = getExportGenerator();

            const result = await generator.listBundles(query.organization_id, {
              limit: query.limit,
              cursor: query.cursor,
            });

            return {
              organization_id: query.organization_id,
              bundles: result.bundles.map((b) => ({
                id: b.id,
                time_window: {
                  from: b.time_window.from.toISOString(),
                  to: b.time_window.to.toISOString(),
                },
                generated_at: b.generated_at.toISOString(),
                triggered_by: b.triggered_by,
                size_bytes: b.size_bytes,
                event_count: b.event_count,
                incident_count: b.incident_count,
                status: b.status,
                expires_at: b.expires_at?.toISOString(),
              })),
              next_cursor: result.next_cursor,
              has_more: result.has_more,
            };
          },
          {
            query: t.Object({
              organization_id: t.String(),
              limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
              cursor: t.Optional(t.String({ description: 'Cursor for pagination (bundle ID)' })),
            }),
            response: {
              200: t.Object({
                organization_id: t.String(),
                bundles: t.Array(
                  t.Object({
                    id: t.String(),
                    time_window: t.Object({
                      from: t.String(),
                      to: t.String(),
                    }),
                    generated_at: t.String(),
                    triggered_by: t.String(),
                    size_bytes: t.Number(),
                    event_count: t.Number(),
                    incident_count: t.Number(),
                    status: t.String(),
                    expires_at: t.Optional(t.String()),
                  }),
                ),
                next_cursor: t.Nullable(t.String()),
                has_more: t.Boolean(),
              }),
              401: errorResponseSchema,
              403: errorResponseSchema,
              429: errorResponseSchema,
              503: errorResponseSchema,
            },
            detail: {
              summary: 'List export bundles',
              description: 'List export bundles for an organization with cursor-based pagination',
              tags: ['Export'],
            },
          },
        )
        .get(
          '/:id',
          async ({ params, set, apiKey }) => {
            if (!isExportGeneratorInitialized()) {
              set.status = 503;
              return {
                error: 'service_unavailable',
                message: 'Export generator not initialized.',
              };
            }

            const generator = getExportGenerator();
            const bundle = await generator.getBundle(params.id);

            if (!bundle) {
              set.status = 404;
              return {
                error: 'not_found',
                message: `Bundle not found: ${params.id}`,
              };
            }

            // Check tenant isolation against bundle's organization
            const tenantError = checkTenantAccess(apiKey, bundle.organization_id, set);
            if (tenantError) return tenantError;

            return {
              id: bundle.id,
              organization_id: bundle.organization_id,
              time_window: {
                from: bundle.time_window.from.toISOString(),
                to: bundle.time_window.to.toISOString(),
              },
              generated_at: bundle.generated_at.toISOString(),
              triggered_by: bundle.triggered_by,
              storage_uri: bundle.storage_uri,
              size_bytes: bundle.size_bytes,
              content_hash: bundle.content_hash,
              event_count: bundle.event_count,
              incident_count: bundle.incident_count,
              status: bundle.status,
              expires_at: bundle.expires_at?.toISOString(),
              compliance: bundle.compliance,
            };
          },
          {
            params: t.Object({
              id: t.String(),
            }),
            response: {
              200: t.Object({
                id: t.String(),
                organization_id: t.String(),
                time_window: t.Object({
                  from: t.String(),
                  to: t.String(),
                }),
                generated_at: t.String(),
                triggered_by: t.String(),
                storage_uri: t.String(),
                size_bytes: t.Number(),
                content_hash: t.String(),
                event_count: t.Number(),
                incident_count: t.Number(),
                status: t.String(),
                expires_at: t.Optional(t.String()),
                compliance: complianceSchema,
              }),
              401: errorResponseSchema,
              403: errorResponseSchema,
              404: errorResponseSchema,
              429: errorResponseSchema,
              503: errorResponseSchema,
            },
            detail: {
              summary: 'Get export bundle',
              description: 'Get export bundle metadata by ID',
              tags: ['Export'],
            },
          },
        )
        .get(
          '/:id/download',
          async ({ params, set, apiKey }) => {
            if (!isExportGeneratorInitialized()) {
              set.status = 503;
              return {
                error: 'service_unavailable',
                message: 'Export generator not initialized.',
              };
            }

            const generator = getExportGenerator();

            // First check if bundle exists and get its org_id
            const bundleMeta = await generator.getBundle(params.id);
            if (!bundleMeta) {
              set.status = 404;
              return {
                error: 'not_found',
                message: `Bundle not found: ${params.id}`,
              };
            }

            // Check tenant isolation
            const tenantError = checkTenantAccess(apiKey, bundleMeta.organization_id, set);
            if (tenantError) return tenantError;

            try {
              const result = await generator.downloadBundle(params.id);

              if (!result) {
                set.status = 404;
                return {
                  error: 'not_found',
                  message: `Bundle not found: ${params.id}`,
                };
              }

              logger.info`Export bundle downloaded: id=${params.id} by=${apiKey?.keyId}`;

              // Emit audit event for download
              const auditEmitter = getDefaultEmitter();
              auditEmitter.emit(
                createExportAuditEvent({
                  eventType: 'EXPORT_DOWNLOADED',
                  bundleId: params.id,
                  organizationId: result.bundle.organization_id,
                  actor: apiKey?.keyName ?? 'unknown',
                  actorKeyId: apiKey?.keyId,
                  bundleSize: result.data.length,
                  eventCount: result.bundle.event_count,
                  incidentCount: result.bundle.incident_count,
                  timeWindow: {
                    from: result.bundle.time_window.from.toISOString(),
                    to: result.bundle.time_window.to.toISOString(),
                  },
                }),
              );

              // Return as gzip file
              set.headers['Content-Type'] = 'application/gzip';
              set.headers['Content-Disposition'] =
                `attachment; filename="export-${params.id}.json.gz"`;
              set.headers['Content-Length'] = String(result.data.length);
              set.headers['X-Content-Hash'] = result.bundle.content_hash;

              return result.data;
            } catch (error) {
              logger.error`Export bundle download failed: ${error}`;
              set.status = 500;
              return {
                error: 'download_failed',
                message: `Failed to download bundle: ${error}`,
              };
            }
          },
          {
            params: t.Object({
              id: t.String(),
            }),
            response: {
              401: errorResponseSchema,
              403: errorResponseSchema,
              404: errorResponseSchema,
              429: errorResponseSchema,
              500: errorResponseSchema,
              503: errorResponseSchema,
            },
            detail: {
              summary: 'Download export bundle',
              description: 'Download the export bundle file (gzip compressed)',
              tags: ['Export'],
            },
          },
        ),
    ),
  );
