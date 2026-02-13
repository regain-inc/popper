/**
 * Dead-Letter API Plugin
 *
 * Elysia plugin exposing dead-letter queue management endpoints.
 * Allows listing unresolved entries and retrying failed commands.
 *
 * Endpoints (prefix: /v2/popper/control/dead-letters):
 * - GET  /                — List unresolved dead-letter entries
 * - POST /:id/retry       — Retry a dead-letter entry
 *
 * @module plugins/dead-letters
 */

import { Elysia, t } from 'elysia';
import { createAuthGuard } from './api-key-auth';
import { createRateLimitGuard } from './rate-limit';

// biome-ignore lint/suspicious/noExplicitAny: Dependencies injected at runtime
let dlq: any;
// biome-ignore lint/suspicious/noExplicitAny: Dependencies injected at runtime
let dm: any;

/**
 * Inject dependencies for the dead-letter plugin.
 * Must be called before the plugin handles requests.
 */
// biome-ignore lint/suspicious/noExplicitAny: injected deps typed at call site
export function setDeadLetterDeps(deadLetterQueue: any, deliveryManager: any): void {
  dlq = deadLetterQueue;
  dm = deliveryManager;
}

export const deadLetterPlugin = new Elysia({
  name: 'dead-letters',
  prefix: '/v2/popper/control/dead-letters',
})
  // ─── Read endpoints (control:read) ───
  .guard(createAuthGuard('control:read'), (app) =>
    app.guard(createRateLimitGuard(), (app) =>
      app.get(
        '/',
        async ({ query }) => {
          const entries = await dlq.getUnresolved(query.target_instance_id);
          return { entries, total: entries.length };
        },
        {
          query: t.Object({
            target_instance_id: t.Optional(t.String()),
          }),
          detail: {
            summary: 'List unresolved dead-letter entries',
            tags: ['Control v2'],
          },
        },
      ),
    ),
  )
  // ─── Write endpoints (control:write) ───
  .guard(createAuthGuard('control:write'), (app) =>
    app.guard(createRateLimitGuard(), (app) =>
      app.post(
        '/:id/retry',
        async ({ params }) => {
          const id = Number(params.id);
          const command = await dlq.retry(id);
          if (!command) {
            return { status: 'not_found', id };
          }
          if (dm) {
            const result = await dm.deliver(command);
            if (result.success) {
              await dlq.resolve(id);
            }
            return { status: result.success ? 'redelivered' : 'failed', id, result };
          }
          return { status: 'no_delivery_manager', id };
        },
        {
          params: t.Object({ id: t.String() }),
          detail: {
            summary: 'Retry a dead-letter entry',
            tags: ['Control v2'],
          },
        },
      ),
    ),
  );
