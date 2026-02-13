/**
 * CircuitBreaker Tests
 */

import { describe, expect, test } from 'bun:test';
import type { ControlCommandV2 } from '../control-v2/types';
import { CircuitBreaker, type CircuitBreakerConfig } from './circuit-breaker';

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

function createBreaker(config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
  return new CircuitBreaker('deutsch-1:org-1', config);
}

// =============================================================================
// Tests: State transitions
// =============================================================================

describe('CircuitBreaker state transitions', () => {
  test('starts in CLOSED state', () => {
    const breaker = createBreaker();
    expect(breaker.getState()).toBe('CLOSED');
  });

  test('CLOSED → OPEN on consecutive failures', () => {
    const breaker = createBreaker({ consecutiveFailureThreshold: 3 });

    breaker.recordResult(false);
    breaker.recordResult(false);
    expect(breaker.getState()).toBe('CLOSED');

    breaker.recordResult(false);
    expect(breaker.getState()).toBe('OPEN');
  });

  test('CLOSED → OPEN → HALF_OPEN → CLOSED (full cycle)', () => {
    const breaker = createBreaker({
      consecutiveFailureThreshold: 2,
      recoveryTimeoutMs: 0, // immediate recovery for testing
    });

    // CLOSED → OPEN
    breaker.recordResult(false);
    breaker.recordResult(false);
    expect(breaker.getState()).toBe('OPEN');

    // OPEN → HALF_OPEN (recovery timeout = 0, so immediate)
    const action = breaker.shouldSend('ROUTINE');
    expect(action).toBe('probe');
    expect(breaker.getState()).toBe('HALF_OPEN');

    // HALF_OPEN → CLOSED on success
    breaker.recordResult(true);
    expect(breaker.getState()).toBe('CLOSED');
  });

  test('HALF_OPEN → OPEN on failure', () => {
    const breaker = createBreaker({
      consecutiveFailureThreshold: 2,
      recoveryTimeoutMs: 0,
    });

    // Trip to OPEN
    breaker.recordResult(false);
    breaker.recordResult(false);
    expect(breaker.getState()).toBe('OPEN');

    // Transition to HALF_OPEN
    breaker.shouldSend('ROUTINE');
    expect(breaker.getState()).toBe('HALF_OPEN');

    // Probe fails → back to OPEN
    breaker.recordResult(false);
    expect(breaker.getState()).toBe('OPEN');
  });

  test('consecutive failure counter resets on success', () => {
    const breaker = createBreaker({
      consecutiveFailureThreshold: 3,
      failureRateThreshold: 0.99, // Disable failure rate tripping for this test
    });

    breaker.recordResult(false);
    breaker.recordResult(false);
    breaker.recordResult(true); // Reset counter
    breaker.recordResult(false);
    breaker.recordResult(false);

    // Should still be CLOSED — consecutive counter was reset by the success
    expect(breaker.getState()).toBe('CLOSED');
    expect(breaker.getConsecutiveFailures()).toBe(2);
  });
});

// =============================================================================
// Tests: Trip on consecutive failures
// =============================================================================

describe('CircuitBreaker consecutive failure tripping', () => {
  test('trips at exactly the threshold', () => {
    const breaker = createBreaker({ consecutiveFailureThreshold: 5 });

    for (let i = 0; i < 4; i++) {
      breaker.recordResult(false);
    }
    expect(breaker.getState()).toBe('CLOSED');

    breaker.recordResult(false);
    expect(breaker.getState()).toBe('OPEN');
    expect(breaker.getConsecutiveFailures()).toBe(5);
  });

  test('tracks consecutive failures accurately', () => {
    const breaker = createBreaker({ consecutiveFailureThreshold: 5 });

    breaker.recordResult(false);
    expect(breaker.getConsecutiveFailures()).toBe(1);
    breaker.recordResult(false);
    expect(breaker.getConsecutiveFailures()).toBe(2);
    breaker.recordResult(true);
    expect(breaker.getConsecutiveFailures()).toBe(0);
  });
});

// =============================================================================
// Tests: Trip on failure rate
// =============================================================================

describe('CircuitBreaker failure rate tripping', () => {
  test('trips when failure rate exceeds threshold with min 5 samples', () => {
    const breaker = createBreaker({
      consecutiveFailureThreshold: 100, // Disable consecutive tripping
      failureRateThreshold: 0.5,
      failureRateWindowMs: 60000,
    });

    // 3 successes, then 3 failures (rate = 3/6 = 0.5, which is not > 0.5)
    breaker.recordResult(true);
    breaker.recordResult(true);
    breaker.recordResult(true);
    breaker.recordResult(false);
    breaker.recordResult(false);
    expect(breaker.getState()).toBe('CLOSED'); // Only 5 samples, rate = 2/5 = 0.4

    breaker.recordResult(false); // rate = 3/6 = 0.5 — exactly at threshold, not > 0.5
    expect(breaker.getState()).toBe('CLOSED');

    breaker.recordResult(false); // rate = 4/7 = 0.57 — over threshold
    expect(breaker.getState()).toBe('OPEN');
  });

  test('does not trip with fewer than 5 samples even if all fail', () => {
    const breaker = createBreaker({
      consecutiveFailureThreshold: 100, // Disable consecutive tripping
      failureRateThreshold: 0.5,
      failureRateWindowMs: 60000,
    });

    // 4 failures but only 4 samples — rate check requires min 5
    breaker.recordResult(false);
    breaker.recordResult(false);
    breaker.recordResult(false);
    breaker.recordResult(false);

    expect(breaker.getState()).toBe('CLOSED');
  });
});

// =============================================================================
// Tests: EMERGENCY bypass
// =============================================================================

describe('CircuitBreaker EMERGENCY bypass', () => {
  test('EMERGENCY bypasses OPEN circuit', () => {
    const breaker = createBreaker({
      consecutiveFailureThreshold: 2,
      recoveryTimeoutMs: 60000, // Long timeout
    });

    // Trip the breaker
    breaker.recordResult(false);
    breaker.recordResult(false);
    expect(breaker.getState()).toBe('OPEN');

    // EMERGENCY should bypass
    const action = breaker.shouldSend('EMERGENCY');
    expect(action).toBe('send');
    // State should remain OPEN
    expect(breaker.getState()).toBe('OPEN');
  });

  test('ROUTINE is queued when OPEN', () => {
    const breaker = createBreaker({
      consecutiveFailureThreshold: 2,
      recoveryTimeoutMs: 60000,
    });

    breaker.recordResult(false);
    breaker.recordResult(false);

    expect(breaker.shouldSend('ROUTINE')).toBe('queue');
  });

  test('URGENT is queued when OPEN', () => {
    const breaker = createBreaker({
      consecutiveFailureThreshold: 2,
      recoveryTimeoutMs: 60000,
    });

    breaker.recordResult(false);
    breaker.recordResult(false);

    expect(breaker.shouldSend('URGENT')).toBe('queue');
  });
});

// =============================================================================
// Tests: Queue management
// =============================================================================

describe('CircuitBreaker queue', () => {
  test('enqueue adds commands to queue', () => {
    const breaker = createBreaker();
    const cmd = makeCommand();

    const result = breaker.enqueue(cmd);

    expect(result.queued).toBe(true);
    expect(breaker.getQueueDepth()).toBe(1);
  });

  test('drainQueue returns commands sorted by created_at', () => {
    const breaker = createBreaker();

    const old = makeCommand({ created_at: '2025-01-01T00:00:00Z' });
    const mid = makeCommand({ created_at: '2025-01-02T00:00:00Z' });
    const recent = makeCommand({ created_at: '2025-01-03T00:00:00Z' });

    // Enqueue out of order
    breaker.enqueue(recent);
    breaker.enqueue(old);
    breaker.enqueue(mid);

    const drained = breaker.drainQueue();

    expect(drained).toHaveLength(3);
    expect(drained[0].command_id).toBe(old.command_id);
    expect(drained[1].command_id).toBe(mid.command_id);
    expect(drained[2].command_id).toBe(recent.command_id);
    expect(breaker.getQueueDepth()).toBe(0);
  });

  test('drainQueue clears the queue', () => {
    const breaker = createBreaker();
    breaker.enqueue(makeCommand());
    breaker.enqueue(makeCommand());

    breaker.drainQueue();

    expect(breaker.getQueueDepth()).toBe(0);
  });

  test('drops oldest ROUTINE when queue is full', () => {
    const breaker = createBreaker({ maxQueueSize: 3 });

    const routine1 = makeCommand({ priority: 'ROUTINE', created_at: '2025-01-01T00:00:00Z' });
    const urgent1 = makeCommand({ priority: 'URGENT', created_at: '2025-01-02T00:00:00Z' });
    const routine2 = makeCommand({ priority: 'ROUTINE', created_at: '2025-01-03T00:00:00Z' });

    breaker.enqueue(routine1);
    breaker.enqueue(urgent1);
    breaker.enqueue(routine2);
    expect(breaker.getQueueDepth()).toBe(3);

    // Queue full — new URGENT should drop oldest ROUTINE (routine1)
    const newUrgent = makeCommand({ priority: 'URGENT' });
    const result = breaker.enqueue(newUrgent);

    expect(result.queued).toBe(true);
    expect(result.dropped).toBe(routine1.command_id);
    expect(breaker.getQueueDepth()).toBe(3);

    // Verify routine1 was dropped
    const drained = breaker.drainQueue();
    const ids = drained.map((c) => c.command_id);
    expect(ids).not.toContain(routine1.command_id);
    expect(ids).toContain(urgent1.command_id);
    expect(ids).toContain(routine2.command_id);
    expect(ids).toContain(newUrgent.command_id);
  });

  test('returns queued=false when full and no ROUTINE to drop', () => {
    const breaker = createBreaker({ maxQueueSize: 2 });

    breaker.enqueue(makeCommand({ priority: 'URGENT' }));
    breaker.enqueue(makeCommand({ priority: 'EMERGENCY' }));

    const result = breaker.enqueue(makeCommand({ priority: 'URGENT' }));

    expect(result.queued).toBe(false);
    expect(breaker.getQueueDepth()).toBe(2);
  });
});

// =============================================================================
// Tests: Recovery timeout
// =============================================================================

describe('CircuitBreaker recovery timeout', () => {
  test('OPEN → HALF_OPEN after recovery timeout', () => {
    const breaker = createBreaker({
      consecutiveFailureThreshold: 2,
      recoveryTimeoutMs: 50,
    });

    // Trip the breaker
    breaker.recordResult(false);
    breaker.recordResult(false);
    expect(breaker.getState()).toBe('OPEN');

    // Before timeout — should queue
    expect(breaker.shouldSend('ROUTINE')).toBe('queue');

    // Wait for recovery timeout
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        // After timeout — should probe and transition to HALF_OPEN
        const action = breaker.shouldSend('ROUTINE');
        expect(action).toBe('probe');
        expect(breaker.getState()).toBe('HALF_OPEN');
        resolve();
      }, 60);
    });
  });

  test('stays OPEN before recovery timeout elapses', () => {
    const breaker = createBreaker({
      consecutiveFailureThreshold: 2,
      recoveryTimeoutMs: 60000, // Very long
    });

    breaker.recordResult(false);
    breaker.recordResult(false);
    expect(breaker.getState()).toBe('OPEN');

    // Should still be queuing
    expect(breaker.shouldSend('ROUTINE')).toBe('queue');
    expect(breaker.getState()).toBe('OPEN');
  });
});

// =============================================================================
// Tests: Probe behavior
// =============================================================================

describe('CircuitBreaker probe', () => {
  test('probe success → CLOSED', () => {
    const breaker = createBreaker({
      consecutiveFailureThreshold: 2,
      recoveryTimeoutMs: 0,
    });

    breaker.recordResult(false);
    breaker.recordResult(false);
    breaker.shouldSend('ROUTINE'); // Transition to HALF_OPEN

    breaker.recordResult(true);
    expect(breaker.getState()).toBe('CLOSED');
  });

  test('probe failure → OPEN', () => {
    const breaker = createBreaker({
      consecutiveFailureThreshold: 2,
      recoveryTimeoutMs: 0,
    });

    breaker.recordResult(false);
    breaker.recordResult(false);
    breaker.shouldSend('ROUTINE'); // Transition to HALF_OPEN

    breaker.recordResult(false);
    expect(breaker.getState()).toBe('OPEN');
  });

  test('HALF_OPEN returns probe for shouldSend', () => {
    const breaker = createBreaker({
      consecutiveFailureThreshold: 2,
      recoveryTimeoutMs: 0,
    });

    breaker.recordResult(false);
    breaker.recordResult(false);
    breaker.shouldSend('ROUTINE'); // Transition to HALF_OPEN

    // Subsequent calls in HALF_OPEN should also return probe
    expect(breaker.shouldSend('ROUTINE')).toBe('probe');
    expect(breaker.shouldSend('URGENT')).toBe('probe');
  });
});

// =============================================================================
// Tests: shouldSend in CLOSED state
// =============================================================================

describe('CircuitBreaker shouldSend when CLOSED', () => {
  test('returns send for all priorities when CLOSED', () => {
    const breaker = createBreaker();

    expect(breaker.shouldSend('ROUTINE')).toBe('send');
    expect(breaker.shouldSend('URGENT')).toBe('send');
    expect(breaker.shouldSend('EMERGENCY')).toBe('send');
  });
});
