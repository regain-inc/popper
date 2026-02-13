import { beforeEach, describe, expect, it } from 'bun:test';
import { InMemorySignalAggregator } from './in-memory-signal-aggregator';
import { computeHtvTrend, type SignalEvent } from './signal-aggregator';

/** Helper to create a SignalEvent with defaults */
function makeEvent(overrides: Partial<SignalEvent> = {}): SignalEvent {
  return {
    organization_id: 'org-1',
    instance_id: 'inst-1',
    timestamp: Date.now(),
    decision: 'APPROVED',
    hallucination_detected: false,
    idk_triggered: false,
    high_risk_proposal: false,
    prescription_proposed: false,
    prescription_rejected: false,
    triage_escalated: false,
    stale_snapshot: false,
    missing_sources: [],
    ...overrides,
  };
}

describe('InMemorySignalAggregator', () => {
  let aggregator: InMemorySignalAggregator;

  beforeEach(() => {
    aggregator = new InMemorySignalAggregator();
  });

  describe('record and getSignals', () => {
    it('should return zeros for empty window', async () => {
      const result = await aggregator.getSignals('org-1', 'inst-1');

      expect(result.total_requests).toBe(0);
      expect(result.approval_rate).toBe(0);
      expect(result.hard_stop_rate).toBe(0);
      expect(result.htv_trend).toBe('stable');
      expect(result.hallucination_detections).toBe(0);
      expect(result.idk_rate).toBe(0);
      expect(result.avg_risk_score).toBe(0);
      expect(result.prescription_rejection_rate).toBe(0);
    });

    it('should record events and compute aggregated signals', async () => {
      const now = Date.now();

      await aggregator.record(makeEvent({ timestamp: now - 1000, decision: 'APPROVED' }));
      await aggregator.record(makeEvent({ timestamp: now - 2000, decision: 'APPROVED' }));
      await aggregator.record(makeEvent({ timestamp: now - 3000, decision: 'HARD_STOP' }));
      await aggregator.record(makeEvent({ timestamp: now - 4000, decision: 'ROUTE_TO_CLINICIAN' }));

      const result = await aggregator.getSignals('org-1', 'inst-1');

      expect(result.total_requests).toBe(4);
      expect(result.approval_rate).toBe(0.5);
      expect(result.hard_stop_rate).toBe(0.25);
    });

    it('should compute idk_rate correctly', async () => {
      const now = Date.now();

      await aggregator.record(makeEvent({ timestamp: now - 1000, idk_triggered: true }));
      await aggregator.record(makeEvent({ timestamp: now - 2000, idk_triggered: false }));
      await aggregator.record(makeEvent({ timestamp: now - 3000, idk_triggered: true }));

      const result = await aggregator.getSignals('org-1', 'inst-1');

      expect(result.idk_rate).toBeCloseTo(2 / 3);
    });

    it('should count hallucination detections', async () => {
      const now = Date.now();

      await aggregator.record(makeEvent({ timestamp: now - 1000, hallucination_detected: true }));
      await aggregator.record(makeEvent({ timestamp: now - 2000, hallucination_detected: true }));
      await aggregator.record(makeEvent({ timestamp: now - 3000, hallucination_detected: false }));

      const result = await aggregator.getSignals('org-1', 'inst-1');

      expect(result.hallucination_detections).toBe(2);
    });

    it('should compute avg_risk_score from events with risk_score', async () => {
      const now = Date.now();

      await aggregator.record(makeEvent({ timestamp: now - 1000, risk_score: 0.8 }));
      await aggregator.record(makeEvent({ timestamp: now - 2000, risk_score: 0.4 }));
      await aggregator.record(makeEvent({ timestamp: now - 3000 })); // no risk_score

      const result = await aggregator.getSignals('org-1', 'inst-1');

      expect(result.avg_risk_score).toBeCloseTo(0.6);
    });
  });

  describe('sliding window filtering', () => {
    it('should exclude events outside the window', async () => {
      const now = Date.now();
      const oneHourAgo = now - 61 * 60 * 1000; // just over 1 hour ago

      await aggregator.record(makeEvent({ timestamp: oneHourAgo, decision: 'HARD_STOP' }));
      await aggregator.record(makeEvent({ timestamp: now - 1000, decision: 'APPROVED' }));

      // Default window is 60 minutes
      const result = await aggregator.getSignals('org-1', 'inst-1');

      expect(result.total_requests).toBe(1);
      expect(result.approval_rate).toBe(1);
      expect(result.hard_stop_rate).toBe(0);
    });

    it('should respect custom window size', async () => {
      const now = Date.now();
      const thirtyMinAgo = now - 30 * 60 * 1000;
      const tenMinAgo = now - 10 * 60 * 1000;

      await aggregator.record(makeEvent({ timestamp: thirtyMinAgo, decision: 'HARD_STOP' }));
      await aggregator.record(makeEvent({ timestamp: tenMinAgo, decision: 'APPROVED' }));

      // 15-minute window should only include the recent event
      const result = await aggregator.getSignals('org-1', 'inst-1', 15);

      expect(result.total_requests).toBe(1);
      expect(result.approval_rate).toBe(1);
    });

    it('should include all events with a large window', async () => {
      const now = Date.now();

      await aggregator.record(makeEvent({ timestamp: now - 50 * 60 * 1000 }));
      await aggregator.record(makeEvent({ timestamp: now - 100 * 60 * 1000 }));
      await aggregator.record(makeEvent({ timestamp: now - 1000 }));

      // 120-minute window
      const result = await aggregator.getSignals('org-1', 'inst-1', 120);

      expect(result.total_requests).toBe(3);
    });
  });

  describe('prescription rejection rate', () => {
    it('should compute rejection rate when prescriptions proposed', async () => {
      const now = Date.now();

      await aggregator.record(
        makeEvent({
          timestamp: now - 1000,
          prescription_proposed: true,
          prescription_rejected: false,
        }),
      );
      await aggregator.record(
        makeEvent({
          timestamp: now - 2000,
          prescription_proposed: true,
          prescription_rejected: true,
        }),
      );
      await aggregator.record(
        makeEvent({
          timestamp: now - 3000,
          prescription_proposed: true,
          prescription_rejected: true,
        }),
      );

      const result = await aggregator.getSignals('org-1', 'inst-1');

      expect(result.prescription_rejection_rate).toBeCloseTo(2 / 3);
    });

    it('should return 0 when no prescriptions proposed', async () => {
      const now = Date.now();

      await aggregator.record(makeEvent({ timestamp: now - 1000 }));
      await aggregator.record(makeEvent({ timestamp: now - 2000 }));

      const result = await aggregator.getSignals('org-1', 'inst-1');

      expect(result.prescription_rejection_rate).toBe(0);
    });
  });

  describe('instance isolation', () => {
    it('should not mix events from different instances', async () => {
      const now = Date.now();

      await aggregator.record(
        makeEvent({ instance_id: 'inst-1', timestamp: now - 1000, decision: 'APPROVED' }),
      );
      await aggregator.record(
        makeEvent({ instance_id: 'inst-2', timestamp: now - 2000, decision: 'HARD_STOP' }),
      );

      const result1 = await aggregator.getSignals('org-1', 'inst-1');
      const result2 = await aggregator.getSignals('org-1', 'inst-2');

      expect(result1.total_requests).toBe(1);
      expect(result1.approval_rate).toBe(1);
      expect(result2.total_requests).toBe(1);
      expect(result2.hard_stop_rate).toBe(1);
    });

    it('should not mix events from different organizations', async () => {
      const now = Date.now();

      await aggregator.record(
        makeEvent({ organization_id: 'org-1', timestamp: now - 1000, decision: 'APPROVED' }),
      );
      await aggregator.record(
        makeEvent({ organization_id: 'org-2', timestamp: now - 2000, decision: 'HARD_STOP' }),
      );

      const result1 = await aggregator.getSignals('org-1', 'inst-1');
      const result2 = await aggregator.getSignals('org-2', 'inst-1');

      expect(result1.total_requests).toBe(1);
      expect(result1.approval_rate).toBe(1);
      expect(result2.total_requests).toBe(1);
      expect(result2.hard_stop_rate).toBe(1);
    });
  });

  describe('window timestamps', () => {
    it('should include ISO timestamps in result', async () => {
      const result = await aggregator.getSignals('org-1', 'inst-1');

      expect(result.window_start).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(result.window_end).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('clear and size', () => {
    it('should clear all events', async () => {
      await aggregator.record(makeEvent());

      expect(aggregator.size).toBe(1);

      aggregator.clear();

      expect(aggregator.size).toBe(0);
    });
  });
});

describe('computeHtvTrend', () => {
  it('should return stable for fewer than 5 data points', () => {
    const scores = [
      { timestamp: 1, value: 0.5 },
      { timestamp: 2, value: 0.6 },
      { timestamp: 3, value: 0.7 },
    ];
    expect(computeHtvTrend(scores)).toBe('stable');
  });

  it('should detect improving trend', () => {
    const scores = [
      { timestamp: 1000, value: 0.1 },
      { timestamp: 2000, value: 0.3 },
      { timestamp: 3000, value: 0.5 },
      { timestamp: 4000, value: 0.7 },
      { timestamp: 5000, value: 0.9 },
    ];
    expect(computeHtvTrend(scores)).toBe('improving');
  });

  it('should detect declining trend', () => {
    const scores = [
      { timestamp: 1000, value: 0.9 },
      { timestamp: 2000, value: 0.7 },
      { timestamp: 3000, value: 0.5 },
      { timestamp: 4000, value: 0.3 },
      { timestamp: 5000, value: 0.1 },
    ];
    expect(computeHtvTrend(scores)).toBe('declining');
  });

  it('should detect stable trend when values are flat', () => {
    const scores = [
      { timestamp: 1000, value: 0.5 },
      { timestamp: 2000, value: 0.5 },
      { timestamp: 3000, value: 0.5 },
      { timestamp: 4000, value: 0.5 },
      { timestamp: 5000, value: 0.5 },
    ];
    expect(computeHtvTrend(scores)).toBe('stable');
  });

  it('should detect stable for small fluctuations', () => {
    const scores = [
      { timestamp: 1000, value: 0.5 },
      { timestamp: 2000, value: 0.51 },
      { timestamp: 3000, value: 0.49 },
      { timestamp: 4000, value: 0.5 },
      { timestamp: 5000, value: 0.5 },
    ];
    expect(computeHtvTrend(scores)).toBe('stable');
  });

  it('should return stable for empty array', () => {
    expect(computeHtvTrend([])).toBe('stable');
  });
});
