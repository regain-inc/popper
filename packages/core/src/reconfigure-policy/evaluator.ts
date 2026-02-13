/**
 * Reconfigure Policy Evaluator
 *
 * Evaluates reconfigure policies against aggregated supervision signals.
 * Supports cooldown tracking to prevent alert flooding.
 *
 * @module reconfigure-policy/evaluator
 */

import type { AggregatedSignals, ICooldownTracker } from '@popper/cache';
import type { ReconfigurePolicy, ReconfigurePolicyResult, ReconfigureTrigger } from './types';

/**
 * Context for reconfigure policy evaluation.
 */
export interface ReconfigureEvaluationContext {
  /** Organization ID for cooldown tracking */
  organizationId: string;
  /** Aggregated signals to evaluate against */
  signals: AggregatedSignals;
}

/**
 * Evaluates reconfigure policies against aggregated signals.
 *
 * For each enabled policy:
 * 1. Check cooldown (skip if on cooldown)
 * 2. Evaluate trigger against signals
 * 3. If triggered, produce result with effect and set cooldown
 */
export class ReconfigurePolicyEvaluator {
  constructor(
    private readonly policies: ReconfigurePolicy[],
    private readonly cooldownTracker: ICooldownTracker,
  ) {}

  /**
   * Evaluate all enabled policies against the given context.
   */
  async evaluate(context: ReconfigureEvaluationContext): Promise<ReconfigurePolicyResult[]> {
    const results: ReconfigurePolicyResult[] = [];

    for (const policy of this.policies) {
      if (!policy.enabled) {
        results.push({ policy_id: policy.policy_id, triggered: false });
        continue;
      }

      // Check cooldown
      const onCooldown = await this.cooldownTracker.isInCooldown(
        context.organizationId,
        policy.policy_id,
      );
      if (onCooldown) {
        results.push({ policy_id: policy.policy_id, triggered: false });
        continue;
      }

      // Evaluate trigger
      const triggerDetails: Record<string, unknown> = {};
      const triggered = this.evaluateTrigger(policy.trigger, context.signals, triggerDetails);

      if (triggered) {
        // Set cooldown
        const cooldownUntil = new Date(Date.now() + policy.cooldown_minutes * 60 * 1000);
        await this.cooldownTracker.setCooldown(
          context.organizationId,
          policy.policy_id,
          cooldownUntil,
        );

        // Build effect, inheriting auto_revert from policy if not set on effect
        const effect = { ...policy.effect };
        if (policy.auto_revert && effect.auto_revert === undefined) {
          effect.auto_revert = true;
        }
        if (
          policy.revert_after_minutes !== undefined &&
          effect.revert_after_minutes === undefined
        ) {
          effect.revert_after_minutes = policy.revert_after_minutes;
        }

        results.push({
          policy_id: policy.policy_id,
          triggered: true,
          effect,
          trigger_details: triggerDetails,
        });
      } else {
        results.push({ policy_id: policy.policy_id, triggered: false });
      }
    }

    return results;
  }

  /**
   * Evaluate a trigger condition against aggregated signals.
   */
  private evaluateTrigger(
    trigger: ReconfigureTrigger,
    signals: AggregatedSignals,
    details: Record<string, unknown>,
  ): boolean {
    switch (trigger.kind) {
      case 'approval_rate_below': {
        const threshold = trigger.threshold ?? 0;
        details.approval_rate = signals.approval_rate;
        details.threshold = threshold;
        return signals.approval_rate < threshold;
      }

      case 'hard_stop_rate_above': {
        const threshold = trigger.threshold ?? 1;
        details.hard_stop_rate = signals.hard_stop_rate;
        details.threshold = threshold;
        return signals.hard_stop_rate > threshold;
      }

      case 'htv_trend_declining': {
        details.htv_trend = signals.htv_trend;
        return signals.htv_trend === 'declining';
      }

      case 'hallucination_spike': {
        const threshold = trigger.threshold ?? 1;
        details.hallucination_detections = signals.hallucination_detections;
        details.threshold = threshold;
        return signals.hallucination_detections >= threshold;
      }

      case 'idk_rate_above': {
        const threshold = trigger.threshold ?? 1;
        details.idk_rate = signals.idk_rate;
        details.threshold = threshold;
        return signals.idk_rate > threshold;
      }

      case 'prescription_rejection_rate_above': {
        const threshold = trigger.threshold ?? 1;
        details.prescription_rejection_rate = signals.prescription_rejection_rate;
        details.threshold = threshold;
        return signals.prescription_rejection_rate > threshold;
      }

      case 'risk_score_above': {
        const threshold = trigger.threshold ?? 1;
        details.avg_risk_score = signals.avg_risk_score;
        details.threshold = threshold;
        return signals.avg_risk_score > threshold;
      }

      case 'all_of': {
        if (!trigger.triggers || trigger.triggers.length === 0) return false;
        const subDetails: Record<string, unknown>[] = [];
        const result = trigger.triggers.every((t, _i) => {
          const sub: Record<string, unknown> = {};
          subDetails.push(sub);
          return this.evaluateTrigger(t, signals, sub);
        });
        details.sub_triggers = subDetails;
        return result;
      }

      case 'any_of': {
        if (!trigger.triggers || trigger.triggers.length === 0) return false;
        const subDetails: Record<string, unknown>[] = [];
        const result = trigger.triggers.some((t, _i) => {
          const sub: Record<string, unknown> = {};
          subDetails.push(sub);
          return this.evaluateTrigger(t, signals, sub);
        });
        details.sub_triggers = subDetails;
        return result;
      }

      default:
        return false;
    }
  }
}
