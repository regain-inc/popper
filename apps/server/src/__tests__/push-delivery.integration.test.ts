/**
 * E2E Push Delivery Integration Tests
 *
 * Tests the full push delivery pipeline:
 * API endpoint -> DeliveryManager -> HTTP client -> circuit breaker -> dead-letter queue
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { ControlCommandV2, DeadLetterQueue, ReconfigureEffect } from '@popper/core';
import {
  AuditEmitter,
  type BuildCommandOptions,
  buildControlCommandV2,
  type ControlHttpClient,
  type ControlTarget,
  DeliveryManager,
  type DeliveryManagerConfig,
  type DeliveryResult,
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

function makeCommandOptions(overrides?: Partial<BuildCommandOptions>): BuildCommandOptions {
  return {
    organizationId: 'org-1',
    instanceId: 'deutsch-1',
    serviceVersion: '1.0.0',
    operatorId: 'test-operator',
    ...overrides,
  };
}

function makeSettingsEffect(overrides?: Partial<ReconfigureEffect>): ReconfigureEffect {
  return {
    settings: [{ key: 'autonomy.max_risk_level', value: 'low', reason: 'Test change' }],
    priority: 'ROUTINE',
    ...overrides,
  };
}

function successResult(response?: unknown): DeliveryResult {
  return {
    success: true,
    status_code: 200,
    response: response ?? { status: 'APPLIED' },
    latency_ms: 10,
    retryable: false,
  };
}

function failResult(retryable: boolean, error?: string): DeliveryResult {
  return {
    success: false,
    status_code: retryable ? 500 : 400,
    error: error ?? 'Server error',
    latency_ms: 10,
    retryable,
  };
}

// =============================================================================
// Mock setup
// =============================================================================

let auditStorage: InMemoryAuditStorage;
let sendMock: ReturnType<typeof mock>;
let dlqAddMock: ReturnType<typeof mock>;
let dlqGetDepthMock: ReturnType<typeof mock>;

let mockHttpClient: ControlHttpClient;
let mockDlq: DeadLetterQueue;
// biome-ignore lint/suspicious/noExplicitAny: mock object
let mockDesiredStateManager: any;

beforeEach(() => {
  auditStorage = new InMemoryAuditStorage();
  setDefaultEmitter(new AuditEmitter(auditStorage, { batchEnabled: false, asyncWrites: false }));

  sendMock = mock(() => Promise.resolve(successResult()));
  dlqAddMock = mock(() => Promise.resolve());
  dlqGetDepthMock = mock(() => Promise.resolve(0));

  // biome-ignore lint/suspicious/noExplicitAny: mock object
  mockHttpClient = { send: sendMock } as any;
  mockDlq = {
    add: dlqAddMock,
    getUnresolved: mock(() => Promise.resolve([])),
    retry: mock(() => Promise.resolve(null)),
    resolve: mock(() => Promise.resolve()),
    getDepth: dlqGetDepthMock,
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

function createManager(configOverrides?: Partial<DeliveryManagerConfig>): DeliveryManager {
  return new DeliveryManager(mockHttpClient, mockDlq, mockDesiredStateManager, {
    serviceVersion: '1.0.0',
    reconciliationIntervalMs: 60_000,
    idleReconciliationIntervalMs: 300_000,
    maxReconciliationRetries: 3,
    retryDelaysMs: [1, 1, 1, 1, 1],
    ...configOverrides,
  });
}

// =============================================================================
// Tests
// =============================================================================

describe('E2E Push Delivery', () => {
  afterEach(() => {
    sendMock.mockClear();
    dlqAddMock.mockClear();
    dlqGetDepthMock.mockClear();
  });

  test('delivers settings command to target successfully', async () => {
    const dm = createManager();
    dm.registerTarget(makeTarget());

    const effect = makeSettingsEffect();
    const command = buildControlCommandV2(effect, makeCommandOptions());

    const result = await dm.deliver(command);

    expect(result.success).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(1);

    // Verify the mock was called with the correct command structure
    // ControlHttpClient.send(command, target) — command is first arg, target is second
    const callArgs = sendMock.mock.calls[0];
    const sentCommand = callArgs[0] as ControlCommandV2;
    const sentTarget = callArgs[1] as ControlTarget;

    expect(sentTarget.instance_id).toBe('deutsch-1');
    expect(sentTarget.organization_id).toBe('org-1');
    expect(sentCommand.kind).toBe('SET_OPERATIONAL_SETTINGS');
    expect(sentCommand.priority).toBe('ROUTINE');
    expect(sentCommand.target.instance_id).toBe('deutsch-1');
    expect(sentCommand.settings).toBeDefined();
    expect(sentCommand.settings?.length).toBe(1);
    expect(sentCommand.settings?.[0].key).toBe('autonomy.max_risk_level');
  });

  test('retries on retryable failures and succeeds', async () => {
    let callCount = 0;
    sendMock.mockImplementation(() => {
      callCount++;
      if (callCount <= 2) return Promise.resolve(failResult(true));
      return Promise.resolve(successResult());
    });

    const dm = createManager();
    dm.registerTarget(makeTarget());

    const command = buildControlCommandV2(makeSettingsEffect(), makeCommandOptions());
    const result = await dm.deliver(command);

    expect(result.success).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(3);
  });

  test('dead-letters non-retryable failures', async () => {
    sendMock.mockImplementation(() => Promise.resolve(failResult(false, 'Bad request')));

    const dm = createManager();
    dm.registerTarget(makeTarget());

    const command = buildControlCommandV2(makeSettingsEffect(), makeCommandOptions());
    const result = await dm.deliver(command);

    expect(result.success).toBe(false);
    expect(dlqAddMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledTimes(1); // No retries for non-retryable
  });

  test('circuit breaker opens after consecutive failures', async () => {
    sendMock.mockImplementation(() => Promise.resolve(failResult(true, 'Server error')));

    const dm = createManager({
      circuitBreakerConfig: { consecutiveFailureThreshold: 2 },
    });
    dm.registerTarget(makeTarget());

    // First delivery fails and trips the breaker after exhausting retries
    await dm.deliver(buildControlCommandV2(makeSettingsEffect(), makeCommandOptions()));

    // Circuit should be open now — next ROUTINE command gets queued
    const result = await dm.deliver(
      buildControlCommandV2(makeSettingsEffect(), makeCommandOptions()),
    );

    expect(result.error).toContain('circuit breaker');
  });

  test('EMERGENCY commands bypass open circuit', async () => {
    sendMock.mockImplementation(() => Promise.resolve(failResult(true, 'Server error')));

    const dm = createManager({
      circuitBreakerConfig: { consecutiveFailureThreshold: 2 },
    });
    dm.registerTarget(makeTarget());

    // Trip the breaker
    await dm.deliver(buildControlCommandV2(makeSettingsEffect(), makeCommandOptions()));

    // Now send EMERGENCY — should bypass circuit breaker
    sendMock.mockImplementation(() => Promise.resolve(successResult()));
    const emergencyEffect = makeSettingsEffect({ priority: 'EMERGENCY' });
    const emergencyCmd = buildControlCommandV2(emergencyEffect, makeCommandOptions());
    const result = await dm.deliver(emergencyCmd);

    // EMERGENCY should have been sent (not queued)
    expect(result.success).toBe(true);
  });

  test('dead-letters after all retries exhausted', async () => {
    sendMock.mockImplementation(() => Promise.resolve(failResult(true, 'Server error')));

    const dm = createManager({
      retryDelaysMs: [1, 1, 1, 1, 1],
    });
    dm.registerTarget(makeTarget());

    const command = buildControlCommandV2(makeSettingsEffect(), makeCommandOptions());
    const result = await dm.deliver(command);

    expect(result.success).toBe(false);
    expect(dlqAddMock).toHaveBeenCalledTimes(1);
    // 1 initial + 5 retries = 6 total attempts
    expect(sendMock).toHaveBeenCalledTimes(6);
  });
});
