/**
 * Elysia application configuration
 * @module app
 */

import { Elysia } from 'elysia';
import { adminKeysPlugin } from './plugins/admin-keys';
import { adminOrgsPlugin } from './plugins/admin-orgs';
import { controlPlugin } from './plugins/control';
import { dashboardPlugin } from './plugins/dashboard';
import { exportPlugin } from './plugins/export';
import { healthPlugin } from './plugins/health';
import { httpLoggerPlugin } from './plugins/http-logger';
import { metricsPlugin } from './plugins/metrics';
import { policyLifecyclePlugin } from './plugins/policy-lifecycle';
import { supervisionPlugin } from './plugins/supervision';
import { tracingPlugin } from './plugins/tracing';

/**
 * Create and configure the Elysia application
 * Plugins are applied in order:
 * 1. Tracing (OpenTelemetry) - wraps all requests
 * 2. Metrics (Prometheus) - collects metrics
 * 3. HTTP Logger - logs requests
 * 4. Health - health check endpoints (no auth required)
 * 5. Admin Keys - API key management (protected by API key with admin:keys scopes)
 * 6. Admin Orgs - organization management (protected by API key with admin:orgs scopes)
 * 7. Control - safe-mode and settings management (protected by API key with control scopes)
 * 8. Dashboard - ops dashboard status, audit events, timeseries (protected by API key with control:read scope)
 * 9. Export - regulatory export bundle generation (protected by API key with control scopes)
 * 10. Policy Lifecycle - policy pack lifecycle management (protected by API key with control scopes)
 * 11. Supervision - main supervision API (protected by API key with supervision:write scope)
 */
export function createApp() {
  return new Elysia({ name: 'popper' })
    .use(tracingPlugin)
    .use(metricsPlugin)
    .use(httpLoggerPlugin)
    .use(healthPlugin)
    .use(adminKeysPlugin)
    .use(adminOrgsPlugin)
    .use(controlPlugin)
    .use(dashboardPlugin)
    .use(exportPlugin)
    .use(policyLifecyclePlugin)
    .use(supervisionPlugin);
}

export type App = ReturnType<typeof createApp>;
