/**
 * Push Metrics Plugin
 *
 * In-memory Prometheus metrics for push delivery observability.
 * Exposes 6 metrics covering command lifecycle, latency, retries,
 * circuit breaker state, and dead-letter queue depth.
 *
 * Metrics:
 * - popper_control_commands_sent_total       (counter)
 * - popper_control_commands_acked_total      (counter)
 * - popper_control_delivery_latency_ms       (histogram)
 * - popper_control_retries_total             (counter)
 * - popper_control_circuit_breaker_state     (gauge)
 * - popper_control_dead_letter_depth         (gauge)
 *
 * @module plugins/push-metrics
 */

import { Elysia } from 'elysia';

// =============================================================================
// Metrics storage
// =============================================================================

/** Counter storage: key -> count */
const counters: Record<string, number> = {};

/** Histogram bucket boundaries in milliseconds */
const histogramBuckets = [10, 25, 50, 100, 250, 500, 1000, 2000, 5000];

/** Histogram data: key -> array of observed values */
const histogramData: Record<string, number[]> = {};

/** Gauge storage: key -> value */
const gauges: Record<string, number> = {};

// =============================================================================
// Circuit breaker state mapping
// =============================================================================

const CIRCUIT_STATE_VALUES: Record<string, number> = {
  CLOSED: 0,
  HALF_OPEN: 1,
  OPEN: 2,
};

// =============================================================================
// Recording functions
// =============================================================================

/**
 * Record a command sent event.
 */
export function recordCommandSent(priority: string, target: string): void {
  const key = `sent:${priority}:${target}`;
  counters[key] = (counters[key] ?? 0) + 1;
}

/**
 * Record a command acknowledged event.
 */
export function recordCommandAcked(status: string): void {
  const key = `acked:${status}`;
  counters[key] = (counters[key] ?? 0) + 1;
}

/**
 * Record delivery latency for a target.
 */
export function recordDeliveryLatency(target: string, latencyMs: number): void {
  const key = `latency:${target}`;
  if (!histogramData[key]) {
    histogramData[key] = [];
  }
  histogramData[key].push(latencyMs);
}

/**
 * Record a retry event.
 */
export function recordRetry(): void {
  counters.retries = (counters.retries ?? 0) + 1;
}

/**
 * Update the circuit breaker gauge for a target.
 */
export function updateCircuitBreakerGauge(target: string, state: string): void {
  const key = `cb:${target}`;
  gauges[key] = CIRCUIT_STATE_VALUES[state] ?? -1;
}

/**
 * Update the dead-letter queue depth gauge.
 */
export function updateDeadLetterDepthGauge(depth: number): void {
  gauges.dlq_depth = depth;
}

/**
 * Reset all metrics. Used in tests.
 */
export function resetMetrics(): void {
  for (const key of Object.keys(counters)) {
    delete counters[key];
  }
  for (const key of Object.keys(histogramData)) {
    delete histogramData[key];
  }
  for (const key of Object.keys(gauges)) {
    delete gauges[key];
  }
}

// =============================================================================
// Prometheus text format
// =============================================================================

function formatPrometheus(): string {
  const lines: string[] = [];

  // Commands sent counter
  lines.push('# HELP popper_control_commands_sent_total Total control commands sent');
  lines.push('# TYPE popper_control_commands_sent_total counter');
  for (const [key, value] of Object.entries(counters)) {
    if (key.startsWith('sent:')) {
      const parts = key.split(':');
      const priority = parts[1];
      const target = parts.slice(2).join(':');
      lines.push(
        `popper_control_commands_sent_total{priority="${priority}",target="${target}"} ${value}`,
      );
    }
  }

  // Commands acked counter
  lines.push('# HELP popper_control_commands_acked_total Total control commands acknowledged');
  lines.push('# TYPE popper_control_commands_acked_total counter');
  for (const [key, value] of Object.entries(counters)) {
    if (key.startsWith('acked:')) {
      const status = key.slice(6);
      lines.push(`popper_control_commands_acked_total{status="${status}"} ${value}`);
    }
  }

  // Delivery latency histogram
  lines.push('# HELP popper_control_delivery_latency_ms Delivery latency in milliseconds');
  lines.push('# TYPE popper_control_delivery_latency_ms histogram');
  for (const [key, values] of Object.entries(histogramData)) {
    if (key.startsWith('latency:')) {
      const target = key.slice(8);
      const sorted = [...values].sort((a, b) => a - b);
      let cumulativeCount = 0;

      for (const bucket of histogramBuckets) {
        while (cumulativeCount < sorted.length && sorted[cumulativeCount] <= bucket) {
          cumulativeCount++;
        }
        lines.push(
          `popper_control_delivery_latency_ms_bucket{target="${target}",le="${bucket}"} ${cumulativeCount}`,
        );
      }
      // +Inf bucket
      lines.push(
        `popper_control_delivery_latency_ms_bucket{target="${target}",le="+Inf"} ${values.length}`,
      );
      lines.push(
        `popper_control_delivery_latency_ms_sum{target="${target}"} ${values.reduce((a, b) => a + b, 0)}`,
      );
      lines.push(`popper_control_delivery_latency_ms_count{target="${target}"} ${values.length}`);
    }
  }

  // Retries counter
  lines.push('# HELP popper_control_retries_total Total delivery retries');
  lines.push('# TYPE popper_control_retries_total counter');
  lines.push(`popper_control_retries_total ${counters.retries ?? 0}`);

  // Circuit breaker gauge
  lines.push(
    '# HELP popper_control_circuit_breaker_state Circuit breaker state (0=CLOSED, 1=HALF_OPEN, 2=OPEN)',
  );
  lines.push('# TYPE popper_control_circuit_breaker_state gauge');
  for (const [key, value] of Object.entries(gauges)) {
    if (key.startsWith('cb:')) {
      const target = key.slice(3);
      lines.push(`popper_control_circuit_breaker_state{target="${target}"} ${value}`);
    }
  }

  // Dead-letter depth gauge
  lines.push('# HELP popper_control_dead_letter_depth Current dead-letter queue depth');
  lines.push('# TYPE popper_control_dead_letter_depth gauge');
  lines.push(`popper_control_dead_letter_depth ${gauges.dlq_depth ?? 0}`);

  return `${lines.join('\n')}\n`;
}

// =============================================================================
// Elysia plugin
// =============================================================================

export const pushMetricsPlugin = new Elysia({ name: 'push-metrics' })
  .get(
    '/metrics/push',
    () => {
      return new Response(formatPrometheus(), {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    },
    {
      detail: {
        summary: 'Push delivery Prometheus metrics',
        tags: ['Metrics'],
      },
    },
  )
  .get(
    '/metrics/push/json',
    () => {
      return { counters, gauges, histograms: histogramData };
    },
    {
      detail: {
        summary: 'Push delivery metrics (JSON)',
        tags: ['Metrics'],
      },
    },
  );
