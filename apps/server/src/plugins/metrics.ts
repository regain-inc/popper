/**
 * Prometheus metrics plugin
 * Exposes HTTP metrics at /metrics endpoint
 * @module plugins/metrics
 */

import { formatPrometheusText, toPrometheusMetrics } from '@popper/cache';
import { hashApiKey, isValidKeyFormat, SYSTEM_ORG_ID } from '@popper/core';
import { Elysia, t } from 'elysia';
import prometheusPlugin from 'elysia-prometheus';
import { env } from '../config/env';
import { getApiKeyCache, getApiKeyService, isApiKeyServiceInitialized } from '../lib/api-keys';
import { getDriftCounters, isDriftCountersInitialized } from '../lib/drift';

/** Header name for API key */
const API_KEY_HEADER = 'x-api-key';

/**
 * Validate API key for metrics access
 * Returns organizationId if valid, null if invalid
 */
async function validateMetricsApiKey(
  apiKey: string | undefined,
): Promise<{ valid: boolean; organizationId?: string; error?: string }> {
  if (!apiKey) {
    return { valid: false, error: 'Missing API key' };
  }

  // Admin key bypass: matches POPPER_ADMIN_API_KEY env var (for dashboard proxy / bootstrap)
  if (env.POPPER_ADMIN_API_KEY && apiKey === env.POPPER_ADMIN_API_KEY) {
    return { valid: true, organizationId: SYSTEM_ORG_ID };
  }

  if (!isValidKeyFormat(apiKey)) {
    return { valid: false, error: 'Invalid API key format' };
  }

  const keyHash = hashApiKey(apiKey);

  // Try cache first
  const cache = getApiKeyCache();
  const cached = await cache.get(keyHash);
  if (cached) {
    return { valid: true, organizationId: cached.organizationId };
  }

  // Fall back to database
  if (isApiKeyServiceInitialized()) {
    const apiKeyService = getApiKeyService();
    const keyContext = await apiKeyService.validateKey(apiKey);
    if (keyContext) {
      return { valid: true, organizationId: keyContext.organizationId };
    }
  }

  return { valid: false, error: 'Invalid API key' };
}

/**
 * Prometheus metrics plugin for Elysia
 * Exposes:
 * - http_requests_total (Counter)
 * - http_request_duration_seconds (Histogram)
 * - drift metrics (with auth for org-specific)
 */
export const metricsPlugin = new Elysia({ name: 'metrics' })
  .use(
    prometheusPlugin({
      metricsPath: '/metrics',
      staticLabels: {
        service: env.OTEL_SERVICE_NAME,
        env: env.NODE_ENV,
      },
      // Duration buckets in seconds: 3ms, 10ms, 30ms, 100ms, 300ms, 1s, 3s
      durationBuckets: [0.003, 0.01, 0.03, 0.1, 0.3, 1, 3],
    }),
  )
  .get(
    '/metrics/drift',
    async ({ query, set, headers }) => {
      if (!isDriftCountersInitialized()) {
        set.status = 503;
        return '# Drift counters not initialized\n';
      }

      // If org_id is specified, require API key authentication
      // Global metrics are public for Prometheus scraping
      if (query.org_id && query.org_id !== 'global') {
        const apiKey = headers[API_KEY_HEADER];

        // In production, always require auth for org-specific metrics
        // In development, allow without auth
        if (env.NODE_ENV === 'production' || apiKey) {
          const authResult = await validateMetricsApiKey(apiKey);
          if (!authResult.valid) {
            set.status = 401;
            return `# Unauthorized: ${authResult.error}\n# Use global metrics without auth or provide X-API-Key header\n`;
          }

          // Verify the API key belongs to the requested org (SYSTEM_ORG_ID is superuser)
          if (
            authResult.organizationId !== query.org_id &&
            authResult.organizationId !== SYSTEM_ORG_ID
          ) {
            set.status = 403;
            return `# Forbidden: API key not authorized for organization ${query.org_id}\n`;
          }
        }
      }

      const organizationId = query.org_id ?? SYSTEM_ORG_ID;
      const driftCounters = getDriftCounters();

      try {
        const snapshot = await driftCounters.getSnapshot(organizationId);
        const metrics = toPrometheusMetrics(snapshot);
        return formatPrometheusText(metrics);
      } catch (error) {
        set.status = 500;
        return `# Error fetching drift metrics: ${error}\n`;
      }
    },
    {
      query: t.Object({
        org_id: t.Optional(
          t.String({
            description:
              'Organization ID. If specified (and not "global"), requires X-API-Key header.',
          }),
        ),
      }),
      response: {
        200: t.String({ description: 'Prometheus metrics in text format' }),
        401: t.String({ description: 'Unauthorized - API key required for org-specific metrics' }),
        403: t.String({ description: 'Forbidden - API key not authorized for this organization' }),
        500: t.String({ description: 'Error message' }),
        503: t.String({ description: 'Service unavailable' }),
      },
      detail: {
        tags: ['Metrics'],
        summary: 'Get drift metrics',
        description:
          'Returns drift signal metrics in Prometheus exposition format. Global metrics are public; org-specific metrics require X-API-Key header.',
      },
    },
  )
  .get(
    '/metrics/drift/json',
    async ({ query, set, headers }) => {
      if (!isDriftCountersInitialized()) {
        set.status = 503;
        return { error: 'Drift counters not initialized' };
      }

      // If org_id is specified, require API key authentication
      if (query.org_id && query.org_id !== 'global') {
        const apiKey = headers[API_KEY_HEADER];

        if (env.NODE_ENV === 'production' || apiKey) {
          const authResult = await validateMetricsApiKey(apiKey);
          if (!authResult.valid) {
            set.status = 401;
            return { error: 'Unauthorized', message: authResult.error };
          }

          // SYSTEM_ORG_ID is superuser — can access any org's metrics
          if (
            authResult.organizationId !== query.org_id &&
            authResult.organizationId !== SYSTEM_ORG_ID
          ) {
            set.status = 403;
            return {
              error: 'Forbidden',
              message: `API key not authorized for organization ${query.org_id}`,
            };
          }
        }
      }

      const organizationId = query.org_id ?? SYSTEM_ORG_ID;
      const driftCounters = getDriftCounters();

      try {
        const snapshot = await driftCounters.getSnapshot(organizationId);
        return snapshot;
      } catch (error) {
        set.status = 500;
        return { error: `Failed to fetch drift metrics: ${error}` };
      }
    },
    {
      query: t.Object({
        org_id: t.Optional(
          t.String({
            description:
              'Organization ID. If specified (and not "global"), requires X-API-Key header.',
          }),
        ),
      }),
      detail: {
        tags: ['Metrics'],
        summary: 'Get drift metrics (JSON)',
        description:
          'Returns drift signal metrics in JSON format. Global metrics are public; org-specific metrics require X-API-Key header.',
      },
    },
  );
