/**
 * Reconfigure Policy Evaluator Tests
 */

import { beforeEach, describe, expect, test } from 'bun:test';
import type { AggregatedSignals } from '@popper/cache';
import { InMemoryCooldownTracker } from '@popper/cache';
import { ReconfigurePolicyEvaluator } from './evaluator';
import type { ReconfigurePolicy } from './types';

// =============================================================================
// Test Helpers
// =============================================================================

const ORG_ID = 'test-org-001';

function createSignals(overrides: Partial<AggregatedSignals> = {}): AggregatedSignals {
  const now = Date.now();
  return {
    approval_rate: 0.85,
    hard_stop_rate: 0.05,
    htv_trend: 'stable',
    hallucination_detections: 0,
    idk_rate: 0.02,
    avg_risk_score: 0.3,
    prescription_rejection_rate: 0.1,
    total_requests: 100,
    window_start: new Date(now - 60 * 60 * 1000).toISOString(),
    window_end: new Date(now).toISOString(),
    ...overrides,
  };
}

function createPolicy(overrides: Partial<ReconfigurePolicy> = {}): ReconfigurePolicy {
  return {
    policy_id: 'test-policy',
    name: 'Test Policy',
    description: 'A test policy',
    enabled: true,
    trigger: { kind: 'approval_rate_below', threshold: 0.7 },
    effect: {
      settings: [{ key: 'max_autonomy', value: 2 }],
      priority: 'URGENT',
    },
    cooldown_minutes: 30,
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('ReconfigurePolicyEvaluator', () => {
  let cooldownTracker: InMemoryCooldownTracker;

  beforeEach(() => {
    cooldownTracker = new InMemoryCooldownTracker();
  });

  // ---------------------------------------------------------------------------
  // Basic trigger kinds
  // ---------------------------------------------------------------------------

  describe('approval_rate_below', () => {
    test('triggers when approval rate is below threshold', async () => {
      const policy = createPolicy({
        trigger: { kind: 'approval_rate_below', threshold: 0.7 },
      });
      const evaluator = new ReconfigurePolicyEvaluator([policy], cooldownTracker);
      const results = await evaluator.evaluate({
        organizationId: ORG_ID,
        signals: createSignals({ approval_rate: 0.5 }),
      });

      expect(results).toHaveLength(1);
      expect(results[0].triggered).toBe(true);
      expect(results[0].effect).toBeDefined();
      expect(results[0].trigger_details?.approval_rate).toBe(0.5);
    });

    test('does not trigger when approval rate is above threshold', async () => {
      const policy = createPolicy({
        trigger: { kind: 'approval_rate_below', threshold: 0.7 },
      });
      const evaluator = new ReconfigurePolicyEvaluator([policy], cooldownTracker);
      const results = await evaluator.evaluate({
        organizationId: ORG_ID,
        signals: createSignals({ approval_rate: 0.85 }),
      });

      expect(results[0].triggered).toBe(false);
      expect(results[0].effect).toBeUndefined();
    });
  });

  describe('hard_stop_rate_above', () => {
    test('triggers when hard stop rate exceeds threshold', async () => {
      const policy = createPolicy({
        trigger: { kind: 'hard_stop_rate_above', threshold: 0.1 },
      });
      const evaluator = new ReconfigurePolicyEvaluator([policy], cooldownTracker);
      const results = await evaluator.evaluate({
        organizationId: ORG_ID,
        signals: createSignals({ hard_stop_rate: 0.2 }),
      });

      expect(results[0].triggered).toBe(true);
    });

    test('does not trigger when at threshold', async () => {
      const policy = createPolicy({
        trigger: { kind: 'hard_stop_rate_above', threshold: 0.1 },
      });
      const evaluator = new ReconfigurePolicyEvaluator([policy], cooldownTracker);
      const results = await evaluator.evaluate({
        organizationId: ORG_ID,
        signals: createSignals({ hard_stop_rate: 0.1 }),
      });

      expect(results[0].triggered).toBe(false);
    });
  });

  describe('htv_trend_declining', () => {
    test('triggers when HTV trend is declining', async () => {
      const policy = createPolicy({
        trigger: { kind: 'htv_trend_declining' },
      });
      const evaluator = new ReconfigurePolicyEvaluator([policy], cooldownTracker);
      const results = await evaluator.evaluate({
        organizationId: ORG_ID,
        signals: createSignals({ htv_trend: 'declining' }),
      });

      expect(results[0].triggered).toBe(true);
    });

    test('does not trigger when HTV trend is stable', async () => {
      const policy = createPolicy({
        trigger: { kind: 'htv_trend_declining' },
      });
      const evaluator = new ReconfigurePolicyEvaluator([policy], cooldownTracker);
      const results = await evaluator.evaluate({
        organizationId: ORG_ID,
        signals: createSignals({ htv_trend: 'stable' }),
      });

      expect(results[0].triggered).toBe(false);
    });

    test('does not trigger when HTV trend is improving', async () => {
      const policy = createPolicy({
        trigger: { kind: 'htv_trend_declining' },
      });
      const evaluator = new ReconfigurePolicyEvaluator([policy], cooldownTracker);
      const results = await evaluator.evaluate({
        organizationId: ORG_ID,
        signals: createSignals({ htv_trend: 'improving' }),
      });

      expect(results[0].triggered).toBe(false);
    });
  });

  describe('hallucination_spike', () => {
    test('triggers when hallucination count meets threshold', async () => {
      const policy = createPolicy({
        trigger: { kind: 'hallucination_spike', threshold: 3 },
      });
      const evaluator = new ReconfigurePolicyEvaluator([policy], cooldownTracker);
      const results = await evaluator.evaluate({
        organizationId: ORG_ID,
        signals: createSignals({ hallucination_detections: 5 }),
      });

      expect(results[0].triggered).toBe(true);
    });

    test('triggers at exact threshold', async () => {
      const policy = createPolicy({
        trigger: { kind: 'hallucination_spike', threshold: 3 },
      });
      const evaluator = new ReconfigurePolicyEvaluator([policy], cooldownTracker);
      const results = await evaluator.evaluate({
        organizationId: ORG_ID,
        signals: createSignals({ hallucination_detections: 3 }),
      });

      expect(results[0].triggered).toBe(true);
    });

    test('does not trigger below threshold', async () => {
      const policy = createPolicy({
        trigger: { kind: 'hallucination_spike', threshold: 3 },
      });
      const evaluator = new ReconfigurePolicyEvaluator([policy], cooldownTracker);
      const results = await evaluator.evaluate({
        organizationId: ORG_ID,
        signals: createSignals({ hallucination_detections: 2 }),
      });

      expect(results[0].triggered).toBe(false);
    });
  });

  describe('idk_rate_above', () => {
    test('triggers when idk rate exceeds threshold', async () => {
      const policy = createPolicy({
        trigger: { kind: 'idk_rate_above', threshold: 0.1 },
      });
      const evaluator = new ReconfigurePolicyEvaluator([policy], cooldownTracker);
      const results = await evaluator.evaluate({
        organizationId: ORG_ID,
        signals: createSignals({ idk_rate: 0.15 }),
      });

      expect(results[0].triggered).toBe(true);
    });
  });

  describe('prescription_rejection_rate_above', () => {
    test('triggers when rejection rate exceeds threshold', async () => {
      const policy = createPolicy({
        trigger: { kind: 'prescription_rejection_rate_above', threshold: 0.5 },
      });
      const evaluator = new ReconfigurePolicyEvaluator([policy], cooldownTracker);
      const results = await evaluator.evaluate({
        organizationId: ORG_ID,
        signals: createSignals({ prescription_rejection_rate: 0.6 }),
      });

      expect(results[0].triggered).toBe(true);
    });
  });

  describe('risk_score_above', () => {
    test('triggers when avg risk score exceeds threshold', async () => {
      const policy = createPolicy({
        trigger: { kind: 'risk_score_above', threshold: 0.7 },
      });
      const evaluator = new ReconfigurePolicyEvaluator([policy], cooldownTracker);
      const results = await evaluator.evaluate({
        organizationId: ORG_ID,
        signals: createSignals({ avg_risk_score: 0.8 }),
      });

      expect(results[0].triggered).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Composite triggers
  // ---------------------------------------------------------------------------

  describe('all_of', () => {
    test('triggers when all sub-triggers match', async () => {
      const policy = createPolicy({
        trigger: {
          kind: 'all_of',
          triggers: [
            { kind: 'approval_rate_below', threshold: 0.7 },
            { kind: 'htv_trend_declining' },
          ],
        },
      });
      const evaluator = new ReconfigurePolicyEvaluator([policy], cooldownTracker);
      const results = await evaluator.evaluate({
        organizationId: ORG_ID,
        signals: createSignals({ approval_rate: 0.5, htv_trend: 'declining' }),
      });

      expect(results[0].triggered).toBe(true);
    });

    test('does not trigger when one sub-trigger fails', async () => {
      const policy = createPolicy({
        trigger: {
          kind: 'all_of',
          triggers: [
            { kind: 'approval_rate_below', threshold: 0.7 },
            { kind: 'htv_trend_declining' },
          ],
        },
      });
      const evaluator = new ReconfigurePolicyEvaluator([policy], cooldownTracker);
      const results = await evaluator.evaluate({
        organizationId: ORG_ID,
        signals: createSignals({ approval_rate: 0.5, htv_trend: 'stable' }),
      });

      expect(results[0].triggered).toBe(false);
    });

    test('does not trigger with empty triggers array', async () => {
      const policy = createPolicy({
        trigger: { kind: 'all_of', triggers: [] },
      });
      const evaluator = new ReconfigurePolicyEvaluator([policy], cooldownTracker);
      const results = await evaluator.evaluate({
        organizationId: ORG_ID,
        signals: createSignals(),
      });

      expect(results[0].triggered).toBe(false);
    });
  });

  describe('any_of', () => {
    test('triggers when any sub-trigger matches', async () => {
      const policy = createPolicy({
        trigger: {
          kind: 'any_of',
          triggers: [
            { kind: 'approval_rate_below', threshold: 0.7 },
            { kind: 'hallucination_spike', threshold: 3 },
          ],
        },
      });
      const evaluator = new ReconfigurePolicyEvaluator([policy], cooldownTracker);
      const results = await evaluator.evaluate({
        organizationId: ORG_ID,
        signals: createSignals({ approval_rate: 0.85, hallucination_detections: 5 }),
      });

      expect(results[0].triggered).toBe(true);
    });

    test('does not trigger when no sub-triggers match', async () => {
      const policy = createPolicy({
        trigger: {
          kind: 'any_of',
          triggers: [
            { kind: 'approval_rate_below', threshold: 0.7 },
            { kind: 'hallucination_spike', threshold: 3 },
          ],
        },
      });
      const evaluator = new ReconfigurePolicyEvaluator([policy], cooldownTracker);
      const results = await evaluator.evaluate({
        organizationId: ORG_ID,
        signals: createSignals({ approval_rate: 0.85, hallucination_detections: 1 }),
      });

      expect(results[0].triggered).toBe(false);
    });

    test('does not trigger with empty triggers array', async () => {
      const policy = createPolicy({
        trigger: { kind: 'any_of', triggers: [] },
      });
      const evaluator = new ReconfigurePolicyEvaluator([policy], cooldownTracker);
      const results = await evaluator.evaluate({
        organizationId: ORG_ID,
        signals: createSignals(),
      });

      expect(results[0].triggered).toBe(false);
    });
  });

  describe('nested composite triggers', () => {
    test('all_of containing any_of works correctly', async () => {
      const policy = createPolicy({
        trigger: {
          kind: 'all_of',
          triggers: [
            { kind: 'approval_rate_below', threshold: 0.7 },
            {
              kind: 'any_of',
              triggers: [
                { kind: 'hallucination_spike', threshold: 3 },
                { kind: 'htv_trend_declining' },
              ],
            },
          ],
        },
      });
      const evaluator = new ReconfigurePolicyEvaluator([policy], cooldownTracker);

      // Both conditions met (approval low + hallucination spike)
      const results1 = await evaluator.evaluate({
        organizationId: ORG_ID,
        signals: createSignals({ approval_rate: 0.5, hallucination_detections: 5 }),
      });
      expect(results1[0].triggered).toBe(true);

      // Reset cooldown
      cooldownTracker.clear();

      // First condition not met
      const results2 = await evaluator.evaluate({
        organizationId: ORG_ID,
        signals: createSignals({ approval_rate: 0.8, hallucination_detections: 5 }),
      });
      expect(results2[0].triggered).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Cooldown tracking
  // ---------------------------------------------------------------------------

  describe('cooldown', () => {
    test('sets cooldown after trigger', async () => {
      const policy = createPolicy({
        trigger: { kind: 'approval_rate_below', threshold: 0.7 },
        cooldown_minutes: 30,
      });
      const evaluator = new ReconfigurePolicyEvaluator([policy], cooldownTracker);
      const signals = createSignals({ approval_rate: 0.5 });

      // First evaluation triggers
      const results1 = await evaluator.evaluate({ organizationId: ORG_ID, signals });
      expect(results1[0].triggered).toBe(true);

      // Second evaluation is on cooldown
      const results2 = await evaluator.evaluate({ organizationId: ORG_ID, signals });
      expect(results2[0].triggered).toBe(false);
    });

    test('cooldown is per-organization', async () => {
      const policy = createPolicy({
        trigger: { kind: 'approval_rate_below', threshold: 0.7 },
      });
      const evaluator = new ReconfigurePolicyEvaluator([policy], cooldownTracker);
      const signals = createSignals({ approval_rate: 0.5 });

      // Org A triggers
      await evaluator.evaluate({ organizationId: 'org-a', signals });

      // Org B should still trigger (different org)
      const results = await evaluator.evaluate({ organizationId: 'org-b', signals });
      expect(results[0].triggered).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Disabled policies
  // ---------------------------------------------------------------------------

  describe('disabled policies', () => {
    test('disabled policy does not trigger', async () => {
      const policy = createPolicy({
        enabled: false,
        trigger: { kind: 'approval_rate_below', threshold: 0.7 },
      });
      const evaluator = new ReconfigurePolicyEvaluator([policy], cooldownTracker);
      const results = await evaluator.evaluate({
        organizationId: ORG_ID,
        signals: createSignals({ approval_rate: 0.5 }),
      });

      expect(results[0].triggered).toBe(false);
      expect(results[0].effect).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Multiple policies
  // ---------------------------------------------------------------------------

  describe('multiple policies', () => {
    test('evaluates all policies independently', async () => {
      const policies = [
        createPolicy({
          policy_id: 'drift-restrict',
          trigger: { kind: 'approval_rate_below', threshold: 0.7 },
        }),
        createPolicy({
          policy_id: 'hallucination-emergency',
          trigger: { kind: 'hallucination_spike', threshold: 3 },
        }),
      ];
      const evaluator = new ReconfigurePolicyEvaluator(policies, cooldownTracker);
      const results = await evaluator.evaluate({
        organizationId: ORG_ID,
        signals: createSignals({ approval_rate: 0.5, hallucination_detections: 5 }),
      });

      expect(results).toHaveLength(2);
      expect(results[0].triggered).toBe(true);
      expect(results[0].policy_id).toBe('drift-restrict');
      expect(results[1].triggered).toBe(true);
      expect(results[1].policy_id).toBe('hallucination-emergency');
    });

    test('only matching policies produce effects', async () => {
      const policies = [
        createPolicy({
          policy_id: 'drift-restrict',
          trigger: { kind: 'approval_rate_below', threshold: 0.7 },
        }),
        createPolicy({
          policy_id: 'hallucination-emergency',
          trigger: { kind: 'hallucination_spike', threshold: 3 },
        }),
      ];
      const evaluator = new ReconfigurePolicyEvaluator(policies, cooldownTracker);
      const results = await evaluator.evaluate({
        organizationId: ORG_ID,
        signals: createSignals({ approval_rate: 0.5, hallucination_detections: 1 }),
      });

      expect(results[0].triggered).toBe(true);
      expect(results[0].effect).toBeDefined();
      expect(results[1].triggered).toBe(false);
      expect(results[1].effect).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Auto-revert inheritance
  // ---------------------------------------------------------------------------

  describe('auto_revert inheritance', () => {
    test('policy auto_revert is applied to effect if not already set', async () => {
      const policy = createPolicy({
        trigger: { kind: 'approval_rate_below', threshold: 0.7 },
        effect: {
          settings: [{ key: 'a', value: 1 }],
          priority: 'URGENT',
        },
        auto_revert: true,
        revert_after_minutes: 45,
      });
      const evaluator = new ReconfigurePolicyEvaluator([policy], cooldownTracker);
      const results = await evaluator.evaluate({
        organizationId: ORG_ID,
        signals: createSignals({ approval_rate: 0.5 }),
      });

      expect(results[0].effect?.auto_revert).toBe(true);
      expect(results[0].effect?.revert_after_minutes).toBe(45);
    });

    test('effect auto_revert takes precedence over policy', async () => {
      const policy = createPolicy({
        trigger: { kind: 'approval_rate_below', threshold: 0.7 },
        effect: {
          settings: [{ key: 'a', value: 1 }],
          priority: 'URGENT',
          auto_revert: false,
          revert_after_minutes: 10,
        },
        auto_revert: true,
        revert_after_minutes: 45,
      });
      const evaluator = new ReconfigurePolicyEvaluator([policy], cooldownTracker);
      const results = await evaluator.evaluate({
        organizationId: ORG_ID,
        signals: createSignals({ approval_rate: 0.5 }),
      });

      // Effect already has auto_revert set, so policy values don't override
      expect(results[0].effect?.auto_revert).toBe(false);
      expect(results[0].effect?.revert_after_minutes).toBe(10);
    });
  });
});
