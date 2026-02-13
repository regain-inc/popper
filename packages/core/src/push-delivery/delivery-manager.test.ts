/**
 * DeliveryManager Tests
 */

import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { AuditEmitter, InMemoryAuditStorage, setDefaultEmitter } from '../audit/emitter';
import type { ControlCommandV2 } from '../control-v2/types';
import type { DeadLetterQueue } from './dead-letter-queue';
import { DeliveryManager, type DeliveryManagerConfig } from './delivery-manager';
import type { ControlHttpClient, ControlTarget, DeliveryResult } from './http-client';

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
    retryDelaysMs: [1, 1, 1, 1, 1], // Fast retries for tests
    ...configOverrides,
  });
}

// =============================================================================
// Tests: deliver()
// =============================================================================

describe('DeliveryManager.deliver', () => {
  test('delivers command successfully to registered target', async () => {
    const dm = createManager();
    dm.registerTarget(makeTarget());

    const result = await dm.deliver(makeCommand());

    expect(result.success).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  test('returns error for unregistered target', async () => {
    const dm = createManager();

    const result = await dm.deliver(makeCommand());

    expect(result.success).toBe(false);
    expect(result.error).toContain('No registered target');
  });

  test('retries retryable failures with exponential backoff', async () => {
    // Fail twice, then succeed
    let callCount = 0;
    sendMock.mockImplementation(() => {
      callCount++;
      if (callCount <= 2) return Promise.resolve(failResult(true));
      return Promise.resolve(successResult());
    });

    const dm = createManager();
    dm.registerTarget(makeTarget());

    const result = await dm.deliver(makeCommand());

    expect(result.success).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(3);
  });

  test('dead-letters non-retryable failures immediately', async () => {
    sendMock.mockImplementation(() => Promise.resolve(failResult(false, 'Bad request')));

    const dm = createManager();
    dm.registerTarget(makeTarget());

    const result = await dm.deliver(makeCommand());

    expect(result.success).toBe(false);
    expect(dlqAddMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledTimes(1); // No retries
  });

  test('dead-letters after all retries exhausted', async () => {
    sendMock.mockImplementation(() => Promise.resolve(failResult(true, 'Server error')));

    const dm = createManager();
    dm.registerTarget(makeTarget());

    const result = await dm.deliver(makeCommand());

    expect(result.success).toBe(false);
    expect(dlqAddMock).toHaveBeenCalledTimes(1);
    // 1 initial + 5 retries = 6 total attempts
    expect(sendMock).toHaveBeenCalledTimes(6);
  });
});

// =============================================================================
// Tests: Circuit breaker integration
// =============================================================================

describe('DeliveryManager circuit breaker', () => {
  test('queues commands when circuit is open', async () => {
    // Trip the circuit breaker by sending 5 consecutive failures
    sendMock.mockImplementation(() => Promise.resolve(failResult(true, 'Server error')));

    const dm = createManager({
      circuitBreakerConfig: { consecutiveFailureThreshold: 2 },
    });
    dm.registerTarget(makeTarget());

    // First delivery — will fail and trip breaker after retries
    await dm.deliver(makeCommand());

    // Circuit should be open now — next ROUTINE command gets queued
    const result = await dm.deliver(makeCommand());

    expect(result.error).toContain('circuit breaker');
  });

  test('EMERGENCY commands bypass open circuit', async () => {
    sendMock.mockImplementation(() => Promise.resolve(failResult(true)));

    const dm = createManager({
      circuitBreakerConfig: { consecutiveFailureThreshold: 2 },
    });
    dm.registerTarget(makeTarget());

    // Trip the breaker
    await dm.deliver(makeCommand());

    // Now send EMERGENCY — should bypass (even though it will fail too)
    sendMock.mockImplementation(() => Promise.resolve(successResult()));
    const emergencyCmd = makeCommand({ priority: 'EMERGENCY' });
    const result = await dm.deliver(emergencyCmd);

    // EMERGENCY should have been sent (not queued)
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Tests: Target registration
// =============================================================================

describe('DeliveryManager target registration', () => {
  test('registers target and creates circuit breaker', () => {
    const dm = createManager();
    dm.registerTarget(makeTarget());

    expect(dm.getCircuitBreakerState('deutsch-1:org-1')).toBe('CLOSED');
    expect(dm.getCircuitBreakerQueueDepth('deutsch-1:org-1')).toBe(0);
  });

  test('returns UNKNOWN for unregistered target', () => {
    const dm = createManager();
    expect(dm.getCircuitBreakerState('unknown')).toBe('UNKNOWN');
  });

  test('getTargetIds returns registered targets', () => {
    const dm = createManager();
    dm.registerTarget(makeTarget());
    dm.registerTarget(makeTarget({ instance_id: 'deutsch-2' }));

    expect(dm.getTargetIds()).toHaveLength(2);
  });
});

// =============================================================================
// Tests: Reconciliation
// =============================================================================

describe('DeliveryManager reconciliation', () => {
  test('triggerReconciliation sends GET_OPERATIONAL_STATE', async () => {
    sendMock.mockImplementation(() =>
      Promise.resolve(successResult({ mode: 'NORMAL', settings: {} })),
    );

    const dm = createManager();
    dm.registerTarget(makeTarget());

    await dm.triggerReconciliation('deutsch-1', 'org-1');

    expect(sendMock).toHaveBeenCalledTimes(1);
    // Should have called updateActualState
    expect(mockDesiredStateManager.updateActualState).toHaveBeenCalledTimes(1);
  });

  test('triggerReconciliation processes auto-reverts', async () => {
    sendMock.mockImplementation(() =>
      Promise.resolve(successResult({ mode: 'NORMAL', settings: {} })),
    );

    const dm = createManager();
    dm.registerTarget(makeTarget());

    await dm.triggerReconciliation('deutsch-1', 'org-1');

    expect(mockDesiredStateManager.processAutoReverts).toHaveBeenCalledTimes(1);
  });

  test('startupReconciliation reconciles all targets', async () => {
    sendMock.mockImplementation(() =>
      Promise.resolve(successResult({ mode: 'NORMAL', settings: {} })),
    );

    const dm = createManager();
    dm.registerTarget(makeTarget());
    dm.registerTarget(makeTarget({ instance_id: 'deutsch-2' }));

    await dm.startupReconciliation();

    // Should have sent 2 GET_OPERATIONAL_STATE commands
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  test('emits P1 alert after max reconciliation failures', async () => {
    sendMock.mockImplementation(() => Promise.resolve(failResult(false, 'Unreachable')));

    const dm = createManager({ maxReconciliationRetries: 2 });
    dm.registerTarget(makeTarget());

    // First failure
    await dm.triggerReconciliation('deutsch-1', 'org-1');
    // Second failure — should trigger P1
    await dm.triggerReconciliation('deutsch-1', 'org-1');

    await new Promise((resolve) => setTimeout(resolve, 10));

    const events = auditStorage.getEvents();
    const p1Event = events.find((e) => e.eventType === 'CONTROL_RECONCILIATION_FAILED');
    expect(p1Event).toBeDefined();
    expect(p1Event?.payload?.severity).toBe('P1');
  });
});

// =============================================================================
// Tests: Shutdown
// =============================================================================

describe('DeliveryManager shutdown', () => {
  test('shutdown stops all reconciliation timers', () => {
    const dm = createManager({ reconciliationIntervalMs: 100_000 });
    dm.registerTarget(makeTarget());

    dm.startReconciliationLoop('deutsch-1', 'org-1');
    dm.shutdown();

    // Should not throw — timers cleared
    expect(dm.getTargetIds()).toHaveLength(1);
  });

  test('startReconciliationLoop is idempotent', () => {
    const dm = createManager({ reconciliationIntervalMs: 100_000 });
    dm.registerTarget(makeTarget());

    dm.startReconciliationLoop('deutsch-1', 'org-1');
    dm.startReconciliationLoop('deutsch-1', 'org-1'); // Should not create duplicate

    dm.shutdown();
  });
});
