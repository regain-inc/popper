/**
 * Performance Validation Tests
 *
 * Validates latency budgets for push delivery pipeline.
 * Work Stream 6.6
 *
 * Budgets:
 * - EMERGENCY: <100ms round-trip
 * - URGENT: <500ms round-trip
 * - ROUTINE: <2000ms round-trip
 * - Command processing (build + deliver): <40ms
 */

import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type {
  ControlHttpClient,
  ControlTarget,
  DeadLetterQueue,
  DeliveryResult,
} from '@popper/core';
import {
  AuditEmitter,
  buildControlCommandV2,
  DeliveryManager,
  type DeliveryManagerConfig,
  InMemoryAuditStorage,
  setDefaultEmitter,
} from '@popper/core';

// =============================================================================
// Helpers
// =============================================================================

function makeTarget(overrides?: Partial<ControlTarget>): ControlTarget {
  return {
    instance_id: 'deutsch-1',
    organization_id: 'org-1',
    control_endpoint: 'http://localhost:4000/v1/deutsch/control',
    auth: { mode: 'api_key', api_key: 'test-key' },
    ...overrides,
  };
}

function successResult(latencyMs = 5): DeliveryResult {
  return {
    success: true,
    status_code: 200,
    response: { status: 'APPLIED' },
    latency_ms: latencyMs,
    retryable: false,
  };
}

// =============================================================================
// Setup
// =============================================================================

let sendMock: ReturnType<typeof mock>;
let mockHttpClient: ControlHttpClient;
let mockDlq: DeadLetterQueue;
// biome-ignore lint/suspicious/noExplicitAny: mock object
let mockDesiredStateManager: any;

beforeEach(() => {
  const auditStorage = new InMemoryAuditStorage();
  setDefaultEmitter(new AuditEmitter(auditStorage, { batchEnabled: false, asyncWrites: false }));

  sendMock = mock(() => Promise.resolve(successResult()));
  // biome-ignore lint/suspicious/noExplicitAny: mock object
  mockHttpClient = { send: sendMock } as any;
  mockDlq = {
    add: mock(() => Promise.resolve()),
    getUnresolved: mock(() => Promise.resolve([])),
    retry: mock(() => Promise.resolve(null)),
    resolve: mock(() => Promise.resolve()),
    getDepth: mock(() => Promise.resolve(0)),
    // biome-ignore lint/suspicious/noExplicitAny: mock object
  } as any;

  mockDesiredStateManager = {
    getDesiredState: mock(() =>
      Promise.resolve({
        instance_id: 'deutsch-1',
        organization_id: 'org-1',
        desired_settings: {},
        desired_mode: 'NORMAL',
        last_actual_state: null,
        last_reconciliation_at: null,
        version: 1,
        updated_at: new Date(),
        created_at: new Date(),
      }),
    ),
    updateDesiredState: mock(() => Promise.resolve()),
    updateActualState: mock(() => Promise.resolve()),
    computeDivergence: mock(() => ({
      divergent_settings: [],
      mode_divergence: undefined,
    })),
    acceptSelfTransition: mock(() => Promise.resolve(false)),
    processAutoReverts: mock(() => Promise.resolve([])),
  };
});

function createManager(config?: Partial<DeliveryManagerConfig>): DeliveryManager {
  return new DeliveryManager(mockHttpClient, mockDlq, mockDesiredStateManager, {
    serviceVersion: '1.0.0',
    reconciliationIntervalMs: 60_000,
    idleReconciliationIntervalMs: 300_000,
    maxReconciliationRetries: 3,
    retryDelaysMs: [1, 1, 1, 1, 1],
    ...config,
  });
}

// =============================================================================
// Performance Tests
// =============================================================================

describe('Performance: Push delivery latency budgets', () => {
  test('command building completes in <10ms', () => {
    const iterations = 100;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      buildControlCommandV2(
        {
          settings: [{ key: 'autonomy.max_risk_level', value: 'low', reason: 'test' }],
          priority: 'ROUTINE',
        },
        {
          organizationId: 'org-1',
          instanceId: 'deutsch-1',
          serviceVersion: '1.0.0',
          operatorId: 'perf-test',
        },
      );
    }

    const elapsed = performance.now() - start;
    const avgMs = elapsed / iterations;
    expect(avgMs).toBeLessThan(10);
  });

  test('successful delivery round-trip completes in <40ms (mock transport)', async () => {
    const dm = createManager();
    dm.registerTarget(makeTarget());

    const command = buildControlCommandV2(
      {
        settings: [{ key: 'test.setting', value: true, reason: 'perf' }],
        priority: 'ROUTINE',
      },
      {
        organizationId: 'org-1',
        instanceId: 'deutsch-1',
        serviceVersion: '1.0.0',
      },
    );

    const start = performance.now();
    const result = await dm.deliver(command);
    const elapsed = performance.now() - start;

    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(40);
  });

  test('EMERGENCY command processing completes in <40ms (mock transport)', async () => {
    const dm = createManager();
    dm.registerTarget(makeTarget());

    const command = buildControlCommandV2(
      {
        mode_transition: { target_mode: 'SAFE_MODE', reason: 'emergency' },
        priority: 'EMERGENCY',
      },
      {
        organizationId: 'org-1',
        instanceId: 'deutsch-1',
        serviceVersion: '1.0.0',
      },
    );

    const start = performance.now();
    const result = await dm.deliver(command);
    const elapsed = performance.now() - start;

    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(40);
  });

  test('batch of 100 commands completes in <2000ms', async () => {
    const dm = createManager();
    dm.registerTarget(makeTarget());

    const commands = Array.from({ length: 100 }, (_, i) =>
      buildControlCommandV2(
        {
          settings: [{ key: `test.setting_${i}`, value: i, reason: 'batch perf' }],
          priority: 'ROUTINE',
        },
        {
          organizationId: 'org-1',
          instanceId: 'deutsch-1',
          serviceVersion: '1.0.0',
        },
      ),
    );

    const start = performance.now();
    const results = await Promise.all(commands.map((cmd) => dm.deliver(cmd)));
    const elapsed = performance.now() - start;

    const successCount = results.filter((r) => r.success).length;
    expect(successCount).toBe(100);
    expect(elapsed).toBeLessThan(2000);
  });

  test('circuit breaker check adds <1ms overhead', () => {
    const dm = createManager();
    dm.registerTarget(makeTarget());

    // Warm up
    dm.getCircuitBreakerState('deutsch-1:org-1');

    const iterations = 1000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      dm.getCircuitBreakerState('deutsch-1:org-1');
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / iterations;

    expect(avgMs).toBeLessThan(1);
  });
});
