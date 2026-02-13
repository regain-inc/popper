/**
 * Reconciliation Integration Tests
 *
 * Tests reconciliation loop and drift detection.
 */

import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type {
  ControlCommandV2,
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
// Tests: Reconciliation and drift detection
// =============================================================================

describe('Reconciliation Integration', () => {
  test('startup reconciliation queries all registered targets', async () => {
    sendMock.mockImplementation(() =>
      Promise.resolve(successResult({ mode: 'NORMAL', settings: {} })),
    );

    const dm = createManager();
    dm.registerTarget(makeTarget());
    dm.registerTarget(makeTarget({ instance_id: 'deutsch-2' }));

    await dm.startupReconciliation();

    // Should have sent GET_OPERATIONAL_STATE to each target (one per target)
    expect(sendMock).toHaveBeenCalledTimes(2);

    // Verify both calls were GET_OPERATIONAL_STATE commands
    const call1Command = sendMock.mock.calls[0][0] as ControlCommandV2;
    const call2Command = sendMock.mock.calls[1][0] as ControlCommandV2;
    expect(call1Command.kind).toBe('GET_OPERATIONAL_STATE');
    expect(call2Command.kind).toBe('GET_OPERATIONAL_STATE');
  });

  test('reconciliation detects state divergence', async () => {
    // Configure desired state: mode=NORMAL with settings
    mockDesiredStateManager.getDesiredState.mockImplementation(() =>
      Promise.resolve({
        instance_id: 'deutsch-1',
        organization_id: 'org-1',
        desired_settings: { max_risk: 'low' },
        desired_mode: 'NORMAL',
        last_actual_state: null,
        last_reconciliation_at: null,
        version: 1,
        updated_at: new Date(),
        created_at: new Date(),
      }),
    );

    // Mock HTTP client returns actual state with mode=RESTRICTED (divergent)
    sendMock.mockImplementation(() =>
      Promise.resolve(successResult({ mode: 'RESTRICTED', max_risk: 'low' })),
    );

    // Configure computeDivergence to detect the mode mismatch
    mockDesiredStateManager.computeDivergence.mockImplementation(() => ({
      divergent_settings: [],
      mode_divergence: { desired: 'NORMAL', actual: 'RESTRICTED' },
    }));

    const dm = createManager();
    dm.registerTarget(makeTarget());

    await dm.triggerReconciliation('deutsch-1', 'org-1');

    // Allow async audit events to settle
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify computeDivergence was called
    expect(mockDesiredStateManager.computeDivergence).toHaveBeenCalled();

    // Verify divergence audit event was emitted
    const events = auditStorage.getEvents();
    const divergenceEvent = events.find((e) => e.eventType === 'CONTROL_STATE_DIVERGENCE');
    expect(divergenceEvent).toBeDefined();
    expect(divergenceEvent?.payload?.mode_divergence).toEqual({
      desired: 'NORMAL',
      actual: 'RESTRICTED',
    });
  });

  test('reconciliation emits P1 after max failures', async () => {
    // Mock HTTP client always fails with non-retryable error
    sendMock.mockImplementation(() => Promise.resolve(failResult(false, 'Unreachable')));

    const dm = createManager({ maxReconciliationRetries: 2 });
    dm.registerTarget(makeTarget());

    // First failure
    await dm.triggerReconciliation('deutsch-1', 'org-1');
    // Second failure — should trigger P1
    await dm.triggerReconciliation('deutsch-1', 'org-1');

    // Allow async audit events to settle
    await new Promise((resolve) => setTimeout(resolve, 10));

    const events = auditStorage.getEvents();
    const p1Event = events.find((e) => e.eventType === 'CONTROL_RECONCILIATION_FAILED');
    expect(p1Event).toBeDefined();
    expect(p1Event?.payload?.severity).toBe('P1');
  });

  test('dead-letter retry redelivers via delivery manager', async () => {
    // Create a command that would be in the DLQ
    const command = buildControlCommandV2(
      {
        settings: [{ key: 'max_risk', value: 'low' }],
        priority: 'ROUTINE',
      },
      {
        organizationId: 'org-1',
        instanceId: 'deutsch-1',
        serviceVersion: '1.0.0',
        operatorId: 'test-operator',
      },
    );

    // Create a mock DLQ that returns the command from retry()
    const retryMock = mock(() => Promise.resolve(command));
    const mockDlqWithRetry: DeadLetterQueue = {
      add: mock(() => Promise.resolve()),
      getUnresolved: mock(() => Promise.resolve([])),
      retry: retryMock,
      resolve: mock(() => Promise.resolve()),
      getDepth: mock(() => Promise.resolve(0)),
      // biome-ignore lint/suspicious/noExplicitAny: mock object
    } as any;

    // Set up delivery manager with successful HTTP client
    sendMock.mockImplementation(() => Promise.resolve(successResult()));

    const dm = new DeliveryManager(mockHttpClient, mockDlqWithRetry, mockDesiredStateManager, {
      serviceVersion: '1.0.0',
      reconciliationIntervalMs: 60_000,
      idleReconciliationIntervalMs: 300_000,
      maxReconciliationRetries: 3,
      retryDelaysMs: [1, 1, 1, 1, 1],
    });
    dm.registerTarget(makeTarget());

    // Simulate DLQ retry: retrieve command from DLQ, then redeliver
    const retriedCommand = await mockDlqWithRetry.retry(1);
    expect(retriedCommand).not.toBeNull();

    const result = await dm.deliver(retriedCommand!);

    // Verify end-to-end: DLQ retry + delivery manager delivery succeeded
    expect(retryMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(1);

    // Verify the correct command was sent
    const sentCommand = sendMock.mock.calls[0][0] as ControlCommandV2;
    expect(sentCommand.command_id).toBe(command.command_id);
    expect(sentCommand.kind).toBe('SET_OPERATIONAL_SETTINGS');
  });
});
