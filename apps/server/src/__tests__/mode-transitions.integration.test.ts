/**
 * Mode Transitions Integration Tests
 *
 * Tests mode transition commands through the delivery pipeline.
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
  buildSafeModeCommand,
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
// Tests: Mode transitions through delivery pipeline
// =============================================================================

describe('Mode Transitions Integration', () => {
  test('delivers mode transition command to target', async () => {
    // Build a SET_OPERATIONAL_MODE command via buildControlCommandV2
    const command = buildControlCommandV2(
      {
        mode_transition: {
          target_mode: 'RESTRICTED',
          reason: 'High-risk policy triggered',
        },
        priority: 'ROUTINE',
      },
      {
        organizationId: 'org-1',
        instanceId: 'deutsch-1',
        serviceVersion: '1.0.0',
        operatorId: 'test-operator',
      },
    );

    // Verify the command was built correctly
    expect(command.kind).toBe('SET_OPERATIONAL_MODE');
    expect(command.mode_transition).toBeDefined();
    expect(command.mode_transition?.target_mode).toBe('RESTRICTED');

    // Deliver via DeliveryManager
    const dm = createManager();
    dm.registerTarget(makeTarget());

    const result = await dm.deliver(command);

    expect(result.success).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(1);

    // Verify the HTTP client received the correct command with mode_transition
    const sentCommand = sendMock.mock.calls[0][0] as ControlCommandV2;
    expect(sentCommand.kind).toBe('SET_OPERATIONAL_MODE');
    expect(sentCommand.mode_transition).toBeDefined();
    expect(sentCommand.mode_transition?.target_mode).toBe('RESTRICTED');
    expect(sentCommand.mode_transition?.reason).toBe('High-risk policy triggered');
  });

  test('delivers EMERGENCY safe-mode transition even when circuit breaker is half-open', async () => {
    // Trip the circuit breaker by sending consecutive failures
    sendMock.mockImplementation(() => Promise.resolve(failResult(true)));

    const dm = createManager({
      circuitBreakerConfig: { consecutiveFailureThreshold: 2 },
    });
    dm.registerTarget(makeTarget());

    // First delivery will fail and trip breaker after retries
    const failedCommand = buildControlCommandV2(
      {
        settings: [{ key: 'test', value: 1 }],
        priority: 'ROUTINE',
      },
      {
        organizationId: 'org-1',
        instanceId: 'deutsch-1',
        serviceVersion: '1.0.0',
      },
    );
    await dm.deliver(failedCommand);

    // Circuit should be open now; send EMERGENCY safe-mode command which bypasses
    sendMock.mockImplementation(() => Promise.resolve(successResult()));

    const safeModeCmd = buildSafeModeCommand(true, 'Critical safety issue detected', {
      organizationId: 'org-1',
      instanceId: 'deutsch-1',
      serviceVersion: '1.0.0',
      operatorId: 'safety-system',
    });

    // Verify the command was built with EMERGENCY priority
    expect(safeModeCmd.priority).toBe('EMERGENCY');
    expect(safeModeCmd.kind).toBe('SET_SAFE_MODE');

    const result = await dm.deliver(safeModeCmd);

    // EMERGENCY should bypass the open circuit breaker
    expect(result.success).toBe(true);
  });

  test('mode transition updates desired state', async () => {
    // Configure sendMock to return a successful response with mode state
    sendMock.mockImplementation(() =>
      Promise.resolve(
        successResult({
          status: 'APPLIED',
          operational_state: { mode: 'RESTRICTED', settings: {} },
        }),
      ),
    );

    const dm = createManager();
    dm.registerTarget(makeTarget());

    // Build and deliver a mode transition command
    const command = buildControlCommandV2(
      {
        mode_transition: {
          target_mode: 'RESTRICTED',
          reason: 'Policy-driven transition',
        },
        priority: 'ROUTINE',
      },
      {
        organizationId: 'org-1',
        instanceId: 'deutsch-1',
        serviceVersion: '1.0.0',
        operatorId: 'test-operator',
      },
    );

    await dm.deliver(command);

    // Now trigger reconciliation which exercises the desired state manager
    sendMock.mockImplementation(() =>
      Promise.resolve(
        successResult({
          mode: 'RESTRICTED',
          settings: {},
        }),
      ),
    );

    await dm.triggerReconciliation('deutsch-1', 'org-1');

    // Verify the DesiredStateManager was exercised:
    // - updateActualState should have been called with the actual state snapshot
    expect(mockDesiredStateManager.updateActualState).toHaveBeenCalled();

    // - computeDivergence should have been called to compare desired vs actual
    expect(mockDesiredStateManager.computeDivergence).toHaveBeenCalled();

    // - processAutoReverts should have been called during reconciliation
    expect(mockDesiredStateManager.processAutoReverts).toHaveBeenCalled();
  });
});
