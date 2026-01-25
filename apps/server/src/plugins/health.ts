/**
 * Health check endpoints plugin
 * Provides /health for liveness and readiness probes
 * @module plugins/health
 */

import { Elysia, t } from 'elysia';

const startTime = Date.now();
let isReady = false;

/**
 * Mark the server as ready to accept traffic
 * Call this after all initialization is complete
 */
export function setReady(ready = true): void {
  isReady = ready;
}

/**
 * Health check response schema
 */
const healthResponseSchema = t.Object({
  status: t.Union([t.Literal('healthy'), t.Literal('degraded'), t.Literal('unhealthy')]),
  version: t.String(),
  uptime_seconds: t.Number(),
  timestamp: t.String(),
});

/**
 * Liveness response schema
 */
const livenessResponseSchema = t.Object({
  status: t.Literal('ok'),
  uptime_seconds: t.Number(),
});

/**
 * Readiness response schema
 */
const readinessResponseSchema = t.Object({
  status: t.Union([t.Literal('ready'), t.Literal('not_ready')]),
  checks: t.Record(t.String(), t.Boolean()),
});

/**
 * Health check plugin for Elysia
 * Endpoints:
 * - GET /health - Full health status with version and uptime
 * - GET /live - Kubernetes liveness probe (always returns 200 if server is running)
 * - GET /ready - Kubernetes readiness probe (returns 503 if not ready)
 */
export const healthPlugin = new Elysia({ name: 'health' })
  .get(
    '/health',
    () => ({
      status: 'healthy' as const,
      version: '0.1.0',
      uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
    }),
    {
      response: healthResponseSchema,
      detail: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Returns the health status of the service',
      },
    },
  )
  .get(
    '/live',
    () => ({
      status: 'ok' as const,
      uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    }),
    {
      response: livenessResponseSchema,
      detail: {
        tags: ['Health'],
        summary: 'Liveness probe',
        description: 'Kubernetes liveness probe - returns 200 if the process is alive',
      },
    },
  )
  .get(
    '/ready',
    ({ set }) => {
      const checks = {
        initialized: isReady,
        // Future: add database, redis checks here
        // database: await checkDatabase(),
        // redis: await checkRedis(),
      };

      const allPassing = Object.values(checks).every(Boolean);

      if (!allPassing) {
        set.status = 503;
      }

      return {
        status: allPassing ? ('ready' as const) : ('not_ready' as const),
        checks,
      };
    },
    {
      response: {
        200: readinessResponseSchema,
        503: readinessResponseSchema,
      },
      detail: {
        tags: ['Health'],
        summary: 'Readiness probe',
        description: 'Kubernetes readiness probe - returns 503 if not ready to accept traffic',
      },
    },
  );
