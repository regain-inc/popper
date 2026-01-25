/**
 * Prometheus metrics plugin
 * Exposes HTTP metrics at /metrics endpoint
 * @module plugins/metrics
 */

import { Elysia } from 'elysia';
import prometheusPlugin from 'elysia-prometheus';
import { env } from '../config/env';

/**
 * Prometheus metrics plugin for Elysia
 * Exposes:
 * - http_requests_total (Counter)
 * - http_request_duration_seconds (Histogram)
 */
export const metricsPlugin = new Elysia({ name: 'metrics' }).use(
  prometheusPlugin({
    metricsPath: '/metrics',
    staticLabels: {
      service: env.OTEL_SERVICE_NAME,
      env: env.NODE_ENV,
    },
    // Duration buckets in seconds: 3ms, 10ms, 30ms, 100ms, 300ms, 1s, 3s
    durationBuckets: [0.003, 0.01, 0.03, 0.1, 0.3, 1, 3],
  }),
);
