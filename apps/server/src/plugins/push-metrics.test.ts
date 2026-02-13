/**
 * Push Metrics Plugin Tests
 */

import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import {
  pushMetricsPlugin,
  recordCommandAcked,
  recordCommandSent,
  recordDeliveryLatency,
  recordRetry,
  resetMetrics,
  updateCircuitBreakerGauge,
  updateDeadLetterDepthGauge,
} from './push-metrics';

// =============================================================================
// Test Setup
// =============================================================================

let app: Elysia;

beforeAll(() => {
  app = new Elysia().use(pushMetricsPlugin);
});

beforeEach(() => {
  resetMetrics();
});

// =============================================================================
// Helpers
// =============================================================================

async function get(path: string) {
  return app.handle(new Request(`http://localhost${path}`));
}

// =============================================================================
// Tests: Counter increments
// =============================================================================

describe('Push metrics recording', () => {
  test('recordCommandSent increments counter', async () => {
    recordCommandSent('ROUTINE', 'deutsch-1');
    recordCommandSent('ROUTINE', 'deutsch-1');
    recordCommandSent('EMERGENCY', 'deutsch-1');

    const response = await get('/metrics/push/json');
    const body = await response.json();

    expect(body.counters['sent:ROUTINE:deutsch-1']).toBe(2);
    expect(body.counters['sent:EMERGENCY:deutsch-1']).toBe(1);
  });

  test('recordCommandAcked increments counter', async () => {
    recordCommandAcked('APPLIED');
    recordCommandAcked('APPLIED');
    recordCommandAcked('REJECTED');

    const response = await get('/metrics/push/json');
    const body = await response.json();

    expect(body.counters['acked:APPLIED']).toBe(2);
    expect(body.counters['acked:REJECTED']).toBe(1);
  });

  test('recordRetry increments counter', async () => {
    recordRetry();
    recordRetry();
    recordRetry();

    const response = await get('/metrics/push/json');
    const body = await response.json();

    expect(body.counters.retries).toBe(3);
  });
});

// =============================================================================
// Tests: Histogram
// =============================================================================

describe('Push metrics histogram', () => {
  test('recordDeliveryLatency stores values', async () => {
    recordDeliveryLatency('deutsch-1', 5);
    recordDeliveryLatency('deutsch-1', 50);
    recordDeliveryLatency('deutsch-1', 500);

    const response = await get('/metrics/push/json');
    const body = await response.json();

    expect(body.histograms['latency:deutsch-1']).toHaveLength(3);
    expect(body.histograms['latency:deutsch-1']).toContain(5);
    expect(body.histograms['latency:deutsch-1']).toContain(50);
    expect(body.histograms['latency:deutsch-1']).toContain(500);
  });

  test('histogram buckets in Prometheus format', async () => {
    recordDeliveryLatency('deutsch-1', 5); // <= 10 bucket
    recordDeliveryLatency('deutsch-1', 15); // <= 25 bucket
    recordDeliveryLatency('deutsch-1', 75); // <= 100 bucket
    recordDeliveryLatency('deutsch-1', 3000); // <= 5000 bucket

    const response = await get('/metrics/push');
    const text = await response.text();

    // 5ms falls in le=10 bucket
    expect(text).toContain(
      'popper_control_delivery_latency_ms_bucket{target="deutsch-1",le="10"} 1',
    );
    // 5ms + 15ms fall in le=25 bucket
    expect(text).toContain(
      'popper_control_delivery_latency_ms_bucket{target="deutsch-1",le="25"} 2',
    );
    // 5ms + 15ms + 75ms fall in le=100 bucket
    expect(text).toContain(
      'popper_control_delivery_latency_ms_bucket{target="deutsch-1",le="100"} 3',
    );
    // All 4 fall in le=5000 bucket
    expect(text).toContain(
      'popper_control_delivery_latency_ms_bucket{target="deutsch-1",le="5000"} 4',
    );
    // +Inf always has all
    expect(text).toContain(
      'popper_control_delivery_latency_ms_bucket{target="deutsch-1",le="+Inf"} 4',
    );
  });
});

// =============================================================================
// Tests: Gauges
// =============================================================================

describe('Push metrics gauges', () => {
  test('updateCircuitBreakerGauge sets state value', async () => {
    updateCircuitBreakerGauge('deutsch-1', 'CLOSED');

    const response = await get('/metrics/push/json');
    const body = await response.json();

    expect(body.gauges['cb:deutsch-1']).toBe(0);
  });

  test('updateCircuitBreakerGauge updates on state change', async () => {
    updateCircuitBreakerGauge('deutsch-1', 'CLOSED');
    updateCircuitBreakerGauge('deutsch-1', 'OPEN');

    const response = await get('/metrics/push/json');
    const body = await response.json();

    expect(body.gauges['cb:deutsch-1']).toBe(2);
  });

  test('updateDeadLetterDepthGauge sets depth', async () => {
    updateDeadLetterDepthGauge(42);

    const response = await get('/metrics/push/json');
    const body = await response.json();

    expect(body.gauges.dlq_depth).toBe(42);
  });
});

// =============================================================================
// Tests: Prometheus text format
// =============================================================================

describe('Push metrics Prometheus format', () => {
  test('GET /metrics/push returns valid Prometheus text', async () => {
    recordCommandSent('ROUTINE', 'deutsch-1');
    recordCommandAcked('APPLIED');
    recordRetry();
    updateCircuitBreakerGauge('deutsch-1', 'CLOSED');
    updateDeadLetterDepthGauge(3);

    const response = await get('/metrics/push');
    expect(response.status).toBe(200);

    const contentType = response.headers.get('content-type');
    expect(contentType).toContain('text/plain');

    const text = await response.text();

    // Check HELP and TYPE lines
    expect(text).toContain('# HELP popper_control_commands_sent_total');
    expect(text).toContain('# TYPE popper_control_commands_sent_total counter');
    expect(text).toContain('# HELP popper_control_commands_acked_total');
    expect(text).toContain('# TYPE popper_control_commands_acked_total counter');
    expect(text).toContain('# HELP popper_control_retries_total');
    expect(text).toContain('# TYPE popper_control_retries_total counter');
    expect(text).toContain('# HELP popper_control_circuit_breaker_state');
    expect(text).toContain('# TYPE popper_control_circuit_breaker_state gauge');
    expect(text).toContain('# HELP popper_control_dead_letter_depth');
    expect(text).toContain('# TYPE popper_control_dead_letter_depth gauge');

    // Check metric values
    expect(text).toContain(
      'popper_control_commands_sent_total{priority="ROUTINE",target="deutsch-1"} 1',
    );
    expect(text).toContain('popper_control_commands_acked_total{status="APPLIED"} 1');
    expect(text).toContain('popper_control_retries_total 1');
    expect(text).toContain('popper_control_circuit_breaker_state{target="deutsch-1"} 0');
    expect(text).toContain('popper_control_dead_letter_depth 3');
  });

  test('GET /metrics/push returns defaults when no metrics recorded', async () => {
    const response = await get('/metrics/push');
    const text = await response.text();

    expect(text).toContain('popper_control_retries_total 0');
    expect(text).toContain('popper_control_dead_letter_depth 0');
  });
});

// =============================================================================
// Tests: JSON format
// =============================================================================

describe('Push metrics JSON format', () => {
  test('GET /metrics/push/json returns structured data', async () => {
    recordCommandSent('ROUTINE', 'deutsch-1');
    recordDeliveryLatency('deutsch-1', 25);
    updateDeadLetterDepthGauge(1);

    const response = await get('/metrics/push/json');
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('counters');
    expect(body).toHaveProperty('gauges');
    expect(body).toHaveProperty('histograms');

    expect(body.counters['sent:ROUTINE:deutsch-1']).toBe(1);
    expect(body.histograms['latency:deutsch-1']).toEqual([25]);
    expect(body.gauges.dlq_depth).toBe(1);
  });
});

// =============================================================================
// Tests: Reset
// =============================================================================

describe('Push metrics reset', () => {
  test('resetMetrics clears all data', async () => {
    recordCommandSent('ROUTINE', 'deutsch-1');
    recordCommandAcked('APPLIED');
    recordDeliveryLatency('deutsch-1', 100);
    recordRetry();
    updateCircuitBreakerGauge('deutsch-1', 'OPEN');
    updateDeadLetterDepthGauge(10);

    resetMetrics();

    const response = await get('/metrics/push/json');
    const body = await response.json();

    expect(Object.keys(body.counters)).toHaveLength(0);
    expect(Object.keys(body.gauges)).toHaveLength(0);
    expect(Object.keys(body.histograms)).toHaveLength(0);
  });
});
