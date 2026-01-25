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
});
