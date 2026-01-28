/**
 * RLHF Aggregator singleton
 *
 * Provides global access to the RLHF feedback aggregator instance.
 *
 * @module lib/rlhf
 */

import type { RLHFFeedbackAggregator } from '@popper/core';

let rlhfAggregator: RLHFFeedbackAggregator | null = null;

/**
 * Check if the RLHF aggregator is initialized
 */
export function isRlhfAggregatorInitialized(): boolean {
  return rlhfAggregator !== null;
}

/**
 * Set the global RLHF aggregator instance
 */
export function setRlhfAggregator(aggregator: RLHFFeedbackAggregator): void {
  rlhfAggregator = aggregator;
}

/**
 * Get the global RLHF aggregator instance
 *
 * @throws Error if not initialized
 */
export function getRlhfAggregator(): RLHFFeedbackAggregator {
  if (!rlhfAggregator) {
    throw new Error('RLHF aggregator not initialized. Call setRlhfAggregator() first.');
  }
  return rlhfAggregator;
}
