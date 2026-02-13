/**
 * Signal Aggregator - Redis-based sliding-window signal aggregation
 *
 * Tracks per-instance supervision signals using Redis sorted sets with
 * timestamp scores. Supports configurable sliding windows and computes
 * aggregate metrics including approval rates, HTV trends, and prescription
 * rejection rates.
 *
 * Key format: signals:{org_id}:{instance_id}
 * Score: epoch milliseconds
 * Member: JSON-encoded SignalEvent
 *
 * @module signal-aggregator
 */

import type { Redis } from 'ioredis';

/** A single supervision signal event */
export interface SignalEvent {
  organization_id: string;
  instance_id: string;
  timestamp: number; // epoch ms
  decision: string; // APPROVED | HARD_STOP | ROUTE_TO_CLINICIAN | REQUEST_MORE_INFO
  htv_score?: number;
  hallucination_detected: boolean;
  idk_triggered: boolean;
  risk_score?: number;
  high_risk_proposal: boolean;
  prescription_proposed: boolean;
  prescription_rejected: boolean;
  triage_escalated: boolean;
  stale_snapshot: boolean;
  missing_sources: string[];
}

/** Aggregated signals computed over a sliding window */
export interface AggregatedSignals {
  /** APPROVED / total */
  approval_rate: number;
  /** HARD_STOP / total */
  hard_stop_rate: number;
  /** Linear regression trend of HTV scores */
  htv_trend: 'improving' | 'stable' | 'declining';
  /** Count of events where hallucination_detected=true */
  hallucination_detections: number;
  /** idk_triggered / total */
  idk_rate: number;
  /** Average risk_score across events with a risk_score */
  avg_risk_score: number;
  /** prescription_rejected / prescription_proposed */
  prescription_rejection_rate: number;
  /** Total events in window */
  total_requests: number;
  /** ISO string of window start */
  window_start: string;
  /** ISO string of window end */
  window_end: string;
}

/** Common interface for signal aggregator implementations */
export interface ISignalAggregator {
  record(event: SignalEvent): Promise<void>;
  getSignals(
    organizationId: string,
    instanceId: string,
    windowMinutes?: number,
  ): Promise<AggregatedSignals>;
}

/** Key prefix for signal aggregator */
const SIGNAL_KEY_PREFIX = 'signals';

/** Default sliding window in minutes */
const DEFAULT_WINDOW_MINUTES = 60;

/** Auto-expire entries older than 24 hours (in ms) */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Compute HTV trend via simple linear regression on scores.
 *
 * @param scores - Array of { timestamp, value } pairs
 * @returns 'improving' | 'stable' | 'declining'
 */
export function computeHtvTrend(
  scores: Array<{ timestamp: number; value: number }>,
): 'improving' | 'stable' | 'declining' {
  if (scores.length < 5) return 'stable';

  const n = scores.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  // Use sequential indices (0,1,2,...) instead of raw timestamps
  // so the slope magnitude is independent of timestamp scale.
  for (let i = 0; i < n; i++) {
    const x = i;
    const y = scores[i].value;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return 'stable';

  const slope = (n * sumXY - sumX * sumY) / denominator;

  if (slope > 0.01) return 'improving';
  if (slope < -0.01) return 'declining';
  return 'stable';
}

/**
 * Compute aggregated signals from a list of events.
 */
export function computeAggregates(
  events: SignalEvent[],
  windowStart: number,
  windowEnd: number,
): AggregatedSignals {
  const total = events.length;

  if (total === 0) {
    return {
      approval_rate: 0,
      hard_stop_rate: 0,
      htv_trend: 'stable',
      hallucination_detections: 0,
      idk_rate: 0,
      avg_risk_score: 0,
      prescription_rejection_rate: 0,
      total_requests: 0,
      window_start: new Date(windowStart).toISOString(),
      window_end: new Date(windowEnd).toISOString(),
    };
  }

  let approved = 0;
  let hardStop = 0;
  let hallucinationDetections = 0;
  let idkCount = 0;
  let riskScoreSum = 0;
  let riskScoreCount = 0;
  let prescriptionProposed = 0;
  let prescriptionRejected = 0;
  const htvScores: Array<{ timestamp: number; value: number }> = [];

  for (const event of events) {
    if (event.decision === 'APPROVED') approved++;
    if (event.decision === 'HARD_STOP') hardStop++;
    if (event.hallucination_detected) hallucinationDetections++;
    if (event.idk_triggered) idkCount++;
    if (event.risk_score != null) {
      riskScoreSum += event.risk_score;
      riskScoreCount++;
    }
    if (event.prescription_proposed) prescriptionProposed++;
    if (event.prescription_rejected) prescriptionRejected++;
    if (event.htv_score != null) {
      htvScores.push({ timestamp: event.timestamp, value: event.htv_score });
    }
  }

  // Sort HTV scores by timestamp for regression
  htvScores.sort((a, b) => a.timestamp - b.timestamp);

  return {
    approval_rate: approved / total,
    hard_stop_rate: hardStop / total,
    htv_trend: computeHtvTrend(htvScores),
    hallucination_detections: hallucinationDetections,
    idk_rate: idkCount / total,
    avg_risk_score: riskScoreCount > 0 ? riskScoreSum / riskScoreCount : 0,
    prescription_rejection_rate:
      prescriptionProposed > 0 ? prescriptionRejected / prescriptionProposed : 0,
    total_requests: total,
    window_start: new Date(windowStart).toISOString(),
    window_end: new Date(windowEnd).toISOString(),
  };
}

/**
 * Build Redis key for signal storage
 */
function buildKey(organizationId: string, instanceId: string): string {
  return `${SIGNAL_KEY_PREFIX}:${organizationId}:${instanceId}`;
}

/**
 * Redis-backed signal aggregator using sorted sets.
 *
 * Events are stored as JSON members with timestamp as score.
 * Old entries beyond 24h are pruned on each record() call.
 */
export class SignalAggregator implements ISignalAggregator {
  constructor(private readonly redis: Redis) {}

  async record(event: SignalEvent): Promise<void> {
    const key = buildKey(event.organization_id, event.instance_id);
    const member = JSON.stringify(event);

    const pipeline = this.redis.pipeline();
    // Add event with timestamp as score
    pipeline.zadd(key, event.timestamp, member);
    // Prune entries older than 24 hours
    const cutoff = Date.now() - MAX_AGE_MS;
    pipeline.zremrangebyscore(key, '-inf', cutoff);
    // Set key expiry as safety net (25 hours)
    pipeline.expire(key, 25 * 60 * 60);

    await pipeline.exec();
  }

  async getSignals(
    organizationId: string,
    instanceId: string,
    windowMinutes: number = DEFAULT_WINDOW_MINUTES,
  ): Promise<AggregatedSignals> {
    const key = buildKey(organizationId, instanceId);
    const now = Date.now();
    const windowStart = now - windowMinutes * 60 * 1000;

    const members = await this.redis.zrangebyscore(key, windowStart, now);

    const events: SignalEvent[] = members.map((m) => JSON.parse(m));

    return computeAggregates(events, windowStart, now);
  }
}
