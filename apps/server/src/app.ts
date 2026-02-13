/**
 * Elysia application configuration
 * @module app
 */

import { cors } from '@elysiajs/cors';
import { auth } from '@popper/auth';
import { Elysia } from 'elysia';
import { env } from './config/env';
import { adminKeysPlugin } from './plugins/admin-keys';
import { adminOrgsPlugin } from './plugins/admin-orgs';
import { controlPlugin } from './plugins/control';
import { controlV2Plugin } from './plugins/control-v2';
import { dashboardPlugin } from './plugins/dashboard';
import { deadLetterPlugin } from './plugins/dead-letters';
import { exportPlugin } from './plugins/export';
import { healthPlugin } from './plugins/health';
import { httpLoggerPlugin } from './plugins/http-logger';
import { invitePlugin } from './plugins/invite';
import { metricsPlugin } from './plugins/metrics';
import { policyLifecyclePlugin } from './plugins/policy-lifecycle';
import { pushMetricsPlugin } from './plugins/push-metrics';
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
 * 7. Control v1 - safe-mode and settings management (protected by API key with control scopes)
 * 7b. Control v2 - desired-state management, reconciliation (protected by API key with control scopes)
 * 8. Dashboard - ops dashboard status, audit events, timeseries (protected by API key with control:read scope)
 * 9. Export - regulatory export bundle generation (protected by API key with control scopes)
 * 10. Policy Lifecycle - policy pack lifecycle management (protected by API key with control scopes)
 * 11. Supervision - main supervision API (protected by API key with supervision:write scope)
 */
export function createApp() {
  return (
    new Elysia({
      name: 'popper',
      serve: {
        maxRequestBodySize: 10 * 1024 * 1024, // 10 MB — prevents DoS via large payloads
      },
    })
      .use(
        cors({
          origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
          methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Idempotency-Key'],
          credentials: true,
        }),
      )
      // Security headers
      .onAfterHandle(({ set }) => {
        set.headers['X-Content-Type-Options'] = 'nosniff';
        set.headers['X-Frame-Options'] = 'DENY';
        set.headers['X-XSS-Protection'] = '1; mode=block';
        set.headers['Content-Security-Policy'] = "default-src 'none'";
        if (process.env.NODE_ENV === 'production') {
          set.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
        }
      })
      .use(tracingPlugin)
      .use(metricsPlugin)
      .use(httpLoggerPlugin)
      .use(healthPlugin)
      // Mount Better Auth handler - handles all /api/auth/* routes
      .mount(auth.handler)
      // Invite management (requires auth)
      .use(invitePlugin)
      .use(adminKeysPlugin)
      .use(adminOrgsPlugin)
      .use(controlPlugin)
      .use(controlV2Plugin)
      .use(deadLetterPlugin)
      .use(dashboardPlugin)
      .use(exportPlugin)
      .use(policyLifecyclePlugin)
      .use(supervisionPlugin)
      .use(pushMetricsPlugin)
  );
}

export type App = ReturnType<typeof createApp>;
