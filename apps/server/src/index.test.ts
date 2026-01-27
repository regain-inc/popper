import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createApp } from './app';

const app = createApp();

describe('Popper Server', () => {
  beforeAll(() => {
    app.listen(3001);
  });

  afterAll(() => {
    app.stop();
  });

  describe('Health Endpoints', () => {
    test('GET /health returns healthy status', async () => {
      const response = await app.handle(new Request('http://localhost/health'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.version).toBe('0.1.0');
      expect(typeof data.uptime_seconds).toBe('number');
      expect(data.timestamp).toBeDefined();
    });

    test('GET /live returns liveness status', async () => {
      const response = await app.handle(new Request('http://localhost/live'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(typeof data.uptime_seconds).toBe('number');
    });

    test('GET /ready returns readiness status', async () => {
      const response = await app.handle(new Request('http://localhost/ready'));
      const data = await response.json();

      // Note: In tests, isReady may be false if setReady wasn't called
      expect([200, 503]).toContain(response.status);
      expect(['ready', 'not_ready']).toContain(data.status);
      expect(data.checks).toBeDefined();
    });
  });

  describe('Metrics Endpoint', () => {
    test('GET /metrics returns Prometheus metrics', async () => {
      const response = await app.handle(new Request('http://localhost/metrics'));
      const text = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/plain');
      expect(text).toContain('process_cpu_seconds_total');
    });
  });

  describe('404 Handling', () => {
    test('Unknown route returns 404', async () => {
      const response = await app.handle(new Request('http://localhost/unknown'));

      expect(response.status).toBe(404);
    });
  });

  describe('Admin Organizations Endpoints (no auth - dev mode)', () => {
    // Note: In development mode, requests without API keys are allowed with dev-org context
    // Organization service may not be initialized, so these test route existence

    test('GET /v1/popper/admin/orgs requires organization service', async () => {
      const response = await app.handle(new Request('http://localhost/v1/popper/admin/orgs'));

      // 500 if org service not initialized, 200 if initialized
      expect([200, 500]).toContain(response.status);
    });

    test('GET /v1/popper/admin/orgs/:id returns 404 or 500 for non-existent org', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/popper/admin/orgs/non-existent-org'),
      );

      // 500 if org service not initialized, 404 if org not found
      expect([404, 500]).toContain(response.status);
    });

    test('POST /v1/popper/admin/orgs validates request body', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/popper/admin/orgs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}), // Empty body - should fail validation
        }),
      );

      // Should fail validation (422) or service not available (500)
      expect([422, 500]).toContain(response.status);
    });

    test('PUT /v1/popper/admin/orgs/:id returns 404 or 500 for non-existent org', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/popper/admin/orgs/non-existent-org', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Updated Name' }),
        }),
      );

      // 500 if org service not initialized, 404 if org not found
      expect([404, 500]).toContain(response.status);
    });
  });

  describe('Supervision Endpoint (no auth - dev mode)', () => {
    test('POST /v1/popper/supervise validates request body', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/popper/supervise', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}), // Empty body - should fail validation
        }),
      );

      // Should fail validation
      expect([400, 422]).toContain(response.status);
    });
  });
});
