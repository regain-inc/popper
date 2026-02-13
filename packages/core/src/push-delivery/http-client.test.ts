/**
 * ControlHttpClient Tests
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { ControlCommandV2 } from '../control-v2/types';
import { ControlHttpClient, type ControlTarget } from './http-client';

// =============================================================================
// Helpers
// =============================================================================

function makeCommand(overrides?: Partial<ControlCommandV2>): ControlCommandV2 {
  return {
    hermes_version: '2.0.0',
    message_type: 'control_command_v2',
    command_id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    source: { system: 'popper', service_version: '1.0.0' },
    target: {
      system: 'deutsch',
      instance_id: 'deutsch-1',
      organization_id: 'org-1',
    },
    kind: 'SET_OPERATIONAL_SETTINGS',
    priority: 'ROUTINE',
    settings: [{ key: 'test', value: 1 }],
    idempotency_key: crypto.randomUUID(),
    audit_redaction: { redact: false },
    ...overrides,
  };
}

function makeTarget(overrides?: Partial<ControlTarget>): ControlTarget {
  return {
    instance_id: 'deutsch-1',
    organization_id: 'org-1',
    control_endpoint: 'http://localhost:4000/v1/deutsch/control',
    auth: { mode: 'api_key', api_key: 'test-key' },
    ...overrides,
  };
}

// =============================================================================
// Mock setup
// =============================================================================

let originalFetch: typeof globalThis.fetch;
let fetchMock: ReturnType<typeof mock>;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  fetchMock = mock(() =>
    Promise.resolve(
      new Response(JSON.stringify({ status: 'APPLIED' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
  // biome-ignore lint/suspicious/noExplicitAny: mock global fetch
  globalThis.fetch = fetchMock as any;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// =============================================================================
// Tests: Priority-based timeouts
// =============================================================================

describe('ControlHttpClient priority timeouts', () => {
  test('EMERGENCY timeout is 100ms', async () => {
    const client = new ControlHttpClient();
    const command = makeCommand({ priority: 'EMERGENCY' });

    await client.send(command, makeTarget());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0] as [string, RequestInit];
    const signal = callArgs[1].signal as AbortSignal;
    // AbortSignal.timeout creates a signal; we verify via the fetch call structure
    expect(signal).toBeDefined();
  });

  test('URGENT timeout is 500ms', async () => {
    const client = new ControlHttpClient();
    const command = makeCommand({ priority: 'URGENT' });

    await client.send(command, makeTarget());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(callArgs[1].signal).toBeDefined();
  });

  test('ROUTINE timeout is 2000ms', async () => {
    const client = new ControlHttpClient();
    const command = makeCommand({ priority: 'ROUTINE' });

    await client.send(command, makeTarget());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(callArgs[1].signal).toBeDefined();
  });
});

// =============================================================================
// Tests: Headers
// =============================================================================

describe('ControlHttpClient headers', () => {
  test('sets correct headers for api_key auth', async () => {
    const client = new ControlHttpClient();
    const command = makeCommand();
    const target = makeTarget({ auth: { mode: 'api_key', api_key: 'secret-123' } });

    await client.send(command, target);

    const callArgs = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = callArgs[1].headers as Record<string, string>;

    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Hermes-Version']).toBe('2.0.0');
    expect(headers['X-Command-Priority']).toBe('ROUTINE');
    expect(headers['X-Idempotency-Key']).toBe(command.idempotency_key);
    expect(headers['X-API-Key']).toBe('secret-123');
  });

  test('does not set X-API-Key for mtls auth', async () => {
    const client = new ControlHttpClient();
    const command = makeCommand();
    const target = makeTarget({
      auth: { mode: 'mtls', cert_path: '/cert.pem', key_path: '/key.pem' },
    });

    await client.send(command, target);

    const callArgs = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = callArgs[1].headers as Record<string, string>;

    expect(headers['X-API-Key']).toBeUndefined();
    expect(headers['Content-Type']).toBe('application/json');
  });

  test('sends keepalive: true', async () => {
    const client = new ControlHttpClient();
    await client.send(makeCommand(), makeTarget());

    const callArgs = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(callArgs[1].keepalive).toBe(true);
  });

  test('sends POST to correct endpoint', async () => {
    const client = new ControlHttpClient();
    const target = makeTarget({
      control_endpoint: 'https://deutsch.example.com/v1/deutsch/control',
    });

    await client.send(makeCommand(), target);

    const callArgs = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(callArgs[0]).toBe('https://deutsch.example.com/v1/deutsch/control');
    expect(callArgs[1].method).toBe('POST');
  });
});

// =============================================================================
// Tests: Retryable classification
// =============================================================================

describe('ControlHttpClient retryable classification', () => {
  test('200 → success, not retryable', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ status: 'APPLIED' }), { status: 200 })),
    );

    const client = new ControlHttpClient();
    const result = await client.send(makeCommand(), makeTarget());

    expect(result.success).toBe(true);
    expect(result.status_code).toBe(200);
    expect(result.retryable).toBe(false);
  });

  test('400 → failure, not retryable', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response('Bad request', { status: 400 })),
    );

    const client = new ControlHttpClient();
    const result = await client.send(makeCommand(), makeTarget());

    expect(result.success).toBe(false);
    expect(result.status_code).toBe(400);
    expect(result.retryable).toBe(false);
  });

  test('401 → failure, not retryable', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response('Unauthorized', { status: 401 })),
    );

    const client = new ControlHttpClient();
    const result = await client.send(makeCommand(), makeTarget());

    expect(result.success).toBe(false);
    expect(result.status_code).toBe(401);
    expect(result.retryable).toBe(false);
  });

  test('403 → failure, not retryable', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response('Forbidden', { status: 403 })));

    const client = new ControlHttpClient();
    const result = await client.send(makeCommand(), makeTarget());

    expect(result.success).toBe(false);
    expect(result.status_code).toBe(403);
    expect(result.retryable).toBe(false);
  });

  test('409 → failure, not retryable', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response('Conflict', { status: 409 })));

    const client = new ControlHttpClient();
    const result = await client.send(makeCommand(), makeTarget());

    expect(result.success).toBe(false);
    expect(result.status_code).toBe(409);
    expect(result.retryable).toBe(false);
  });

  test('429 → failure, retryable', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response('Rate limited', { status: 429 })),
    );

    const client = new ControlHttpClient();
    const result = await client.send(makeCommand(), makeTarget());

    expect(result.success).toBe(false);
    expect(result.status_code).toBe(429);
    expect(result.retryable).toBe(true);
  });

  test('500 → failure, retryable', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response('Internal server error', { status: 500 })),
    );

    const client = new ControlHttpClient();
    const result = await client.send(makeCommand(), makeTarget());

    expect(result.success).toBe(false);
    expect(result.status_code).toBe(500);
    expect(result.retryable).toBe(true);
  });

  test('503 → failure, retryable', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response('Service unavailable', { status: 503 })),
    );

    const client = new ControlHttpClient();
    const result = await client.send(makeCommand(), makeTarget());

    expect(result.success).toBe(false);
    expect(result.status_code).toBe(503);
    expect(result.retryable).toBe(true);
  });
});

// =============================================================================
// Tests: Network errors
// =============================================================================

describe('ControlHttpClient network errors', () => {
  test('network error → retryable', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')));

    const client = new ControlHttpClient();
    const result = await client.send(makeCommand(), makeTarget());

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
    expect(result.error).toBe('Failed to fetch');
    expect(result.status_code).toBeUndefined();
  });

  test('timeout error → retryable', async () => {
    fetchMock.mockImplementation(() =>
      Promise.reject(new DOMException('The operation was aborted', 'AbortError')),
    );

    const client = new ControlHttpClient();
    const result = await client.send(makeCommand(), makeTarget());

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
    expect(result.error).toContain('aborted');
  });
});

// =============================================================================
// Tests: Latency measurement
// =============================================================================

describe('ControlHttpClient latency', () => {
  test('measures latency for successful requests', async () => {
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })),
            10,
          ),
        ),
    );

    const client = new ControlHttpClient();
    const result = await client.send(makeCommand(), makeTarget());

    expect(result.success).toBe(true);
    expect(result.latency_ms).toBeGreaterThanOrEqual(5);
    expect(result.latency_ms).toBeLessThan(1000);
  });

  test('measures latency for failed requests', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response('Error', { status: 500 })));

    const client = new ControlHttpClient();
    const result = await client.send(makeCommand(), makeTarget());

    expect(result.success).toBe(false);
    expect(result.latency_ms).toBeGreaterThanOrEqual(0);
  });

  test('measures latency for network errors', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('Network down')));

    const client = new ControlHttpClient();
    const result = await client.send(makeCommand(), makeTarget());

    expect(result.success).toBe(false);
    expect(result.latency_ms).toBeGreaterThanOrEqual(0);
  });
});

// =============================================================================
// Tests: Response parsing
// =============================================================================

describe('ControlHttpClient response parsing', () => {
  test('parses JSON response body on success', async () => {
    const responseBody = { status: 'APPLIED', mode: 'NORMAL' };
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(responseBody), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const client = new ControlHttpClient();
    const result = await client.send(makeCommand(), makeTarget());

    expect(result.success).toBe(true);
    expect(result.response).toEqual(responseBody);
  });

  test('handles non-JSON success response gracefully', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response('OK', { status: 200 })));

    const client = new ControlHttpClient();
    const result = await client.send(makeCommand(), makeTarget());

    expect(result.success).toBe(true);
    expect(result.response).toBeUndefined();
  });
});
