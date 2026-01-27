/**
 * Elysia application configuration
 * @module app
 */

import { Elysia } from 'elysia';
import { controlPlugin } from './plugins/control';
import { healthPlugin } from './plugins/health';
import { httpLoggerPlugin } from './plugins/http-logger';
import { metricsPlugin } from './plugins/metrics';
import { supervisionPlugin } from './plugins/supervision';
import { tracingPlugin } from './plugins/tracing';

/**
 * Create and configure the Elysia application
 * Plugins are applied in order:
 * 1. Tracing (OpenTelemetry) - wraps all requests
 * 2. Metrics (Prometheus) - collects metrics
 * 3. HTTP Logger - logs requests
 * 4. Health - health check endpoints
 * 5. Control - safe-mode management (protected by API key)
 * 6. Supervision - main supervision API
 */
export function createApp() {
  return new Elysia({ name: 'popper' })
    .use(tracingPlugin)
    .use(metricsPlugin)
    .use(httpLoggerPlugin)
    .use(healthPlugin)
    .use(controlPlugin)
    .use(supervisionPlugin);
}

export type App = ReturnType<typeof createApp>;
