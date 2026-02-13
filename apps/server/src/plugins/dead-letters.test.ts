/**
 * Dead-Letter API Plugin Tests
 */

import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { Elysia } from 'elysia';
import { deadLetterPlugin, setDeadLetterDeps } from './dead-letters';

// =============================================================================
// Mock DLQ and DeliveryManager
// =============================================================================

const mockEntries = [
  {
    id: 1,
    commandId: 'cmd-1',
    idempotencyKey: 'idem-1',
    targetInstanceId: 'deutsch-1',
    organizationId: 'org-1',
    priority: 'ROUTINE',
    commandPayload: {
      hermes_version: '2.0.0',
      message_type: 'control_command_v2',
      command_id: 'cmd-1',
      kind: 'SET_OPERATIONAL_SETTINGS',
      priority: 'ROUTINE',
      target: { system: 'deutsch', instance_id: 'deutsch-1', organization_id: 'org-1' },
      idempotency_key: 'idem-1',
    },
    failureReason: 'Server error',
    retryCount: 5,
    lastAttemptAt: new Date(),
    resolvedAt: null,
    createdAt: new Date(),
  },
  {
    id: 2,
    commandId: 'cmd-2',
    idempotencyKey: 'idem-2',
    targetInstanceId: 'deutsch-2',
    organizationId: 'org-2',
    priority: 'EMERGENCY',
    commandPayload: {
      hermes_version: '2.0.0',
      message_type: 'control_command_v2',
      command_id: 'cmd-2',
      kind: 'SET_SAFE_MODE',
      priority: 'EMERGENCY',
      target: { system: 'deutsch', instance_id: 'deutsch-2', organization_id: 'org-2' },
      idempotency_key: 'idem-2',
    },
    failureReason: 'Connection refused',
    retryCount: 6,
    lastAttemptAt: new Date(),
    resolvedAt: null,
    createdAt: new Date(),
  },
];

let mockDlq: {
  getUnresolved: ReturnType<typeof mock>;
  retry: ReturnType<typeof mock>;
  resolve: ReturnType<typeof mock>;
};

let mockDm: {
  deliver: ReturnType<typeof mock>;
};

let app: Elysia;

beforeAll(() => {
  mockDlq = {
    getUnresolved: mock(() => Promise.resolve(mockEntries)),
    retry: mock(() => Promise.resolve(mockEntries[0].commandPayload)),
    resolve: mock(() => Promise.resolve()),
  };

  mockDm = {
    deliver: mock(() => Promise.resolve({ success: true, latency_ms: 10 })),
  };

  setDeadLetterDeps(mockDlq, mockDm);
  app = new Elysia().use(deadLetterPlugin);
});

beforeEach(() => {
  mockDlq.getUnresolved.mockClear();
  mockDlq.retry.mockClear();
  mockDlq.resolve.mockClear();
  mockDm.deliver.mockClear();

  // Reset to defaults
  mockDlq.getUnresolved.mockImplementation(() => Promise.resolve(mockEntries));
  mockDlq.retry.mockImplementation(() => Promise.resolve(mockEntries[0].commandPayload));
  mockDm.deliver.mockImplementation(() => Promise.resolve({ success: true, latency_ms: 10 }));
});

// =============================================================================
// Helpers
// =============================================================================

async function get(path: string) {
  return app.handle(new Request(`http://localhost${path}`));
}

async function post(path: string, body?: unknown) {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : '{}',
    }),
  );
}

// =============================================================================
// Tests: GET /v2/popper/control/dead-letters/
// =============================================================================

describe('GET /v2/popper/control/dead-letters/', () => {
  test('returns unresolved entries', async () => {
    const response = await get('/v2/popper/control/dead-letters/');
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.entries).toHaveLength(2);
    expect(body.total).toBe(2);
  });

  test('passes target_instance_id filter', async () => {
    mockDlq.getUnresolved.mockImplementation((targetId?: string) => {
      if (targetId === 'deutsch-1') {
        return Promise.resolve([mockEntries[0]]);
      }
      return Promise.resolve(mockEntries);
    });

    const response = await get('/v2/popper/control/dead-letters/?target_instance_id=deutsch-1');
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.entries).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(mockDlq.getUnresolved).toHaveBeenCalledWith('deutsch-1');
  });

  test('returns empty list when no entries', async () => {
    mockDlq.getUnresolved.mockImplementation(() => Promise.resolve([]));

    const response = await get('/v2/popper/control/dead-letters/');
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.entries).toHaveLength(0);
    expect(body.total).toBe(0);
  });
});

// =============================================================================
// Tests: POST /v2/popper/control/dead-letters/:id/retry
// =============================================================================

describe('POST /v2/popper/control/dead-letters/:id/retry', () => {
  test('retries and resolves a dead-letter entry on successful delivery', async () => {
    const response = await post('/v2/popper/control/dead-letters/1/retry');
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('redelivered');
    expect(body.id).toBe(1);

    expect(mockDlq.retry).toHaveBeenCalledWith(1);
    expect(mockDm.deliver).toHaveBeenCalledTimes(1);
    expect(mockDlq.resolve).toHaveBeenCalledWith(1);
  });

  test('returns failed status on delivery failure', async () => {
    mockDm.deliver.mockImplementation(() =>
      Promise.resolve({ success: false, error: 'Still down', latency_ms: 10 }),
    );

    const response = await post('/v2/popper/control/dead-letters/1/retry');
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('failed');
    expect(mockDlq.resolve).not.toHaveBeenCalled();
  });

  test('returns not_found for non-existent entry', async () => {
    mockDlq.retry.mockImplementation(() => Promise.resolve(null));

    const response = await post('/v2/popper/control/dead-letters/999/retry');
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('not_found');
    expect(body.id).toBe(999);
  });

  test('returns no_delivery_manager when dm is not set', async () => {
    // Temporarily clear dm
    setDeadLetterDeps(mockDlq, null);

    const response = await post('/v2/popper/control/dead-letters/1/retry');
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('no_delivery_manager');

    // Restore dm
    setDeadLetterDeps(mockDlq, mockDm);
  });
});
