import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';

const app = new Elysia().get('/health', () => ({
  status: 'healthy',
  version: '0.1.0',
  uptime_seconds: Math.floor(process.uptime()),
}));

describe('server', () => {
  beforeAll(() => {
    app.listen(3001);
  });

  afterAll(() => {
    app.stop();
  });

  test('GET /health returns healthy status', async () => {
    const response = await app.handle(new Request('http://localhost/health'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.version).toBe('0.1.0');
    expect(typeof data.uptime_seconds).toBe('number');
  });
});
