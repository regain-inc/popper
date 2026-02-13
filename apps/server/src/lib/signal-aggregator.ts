/**
 * Global signal aggregator instance
 *
 * Provides singleton access to the ISignalAggregator for the application.
 * Used by supervision plugin to record per-request signals, and by
 * the reconfigure policy engine to evaluate threshold-based policies.
 *
 * @module lib/signal-aggregator
 */

import type { ISignalAggregator } from '@popper/cache';

let globalAggregator: ISignalAggregator | null = null;

/**
 * Set the global SignalAggregator instance
 *
 * Called at startup to configure with Redis or in-memory aggregator.
 */
export function setSignalAggregator(aggregator: ISignalAggregator): void {
  globalAggregator = aggregator;
}

/**
 * Get the global SignalAggregator instance
 */
export function getSignalAggregator(): ISignalAggregator {
  if (!globalAggregator) {
    throw new Error('SignalAggregator not initialized. Call setSignalAggregator() at startup.');
  }
  return globalAggregator;
}

/**
 * Check if signal aggregator has been initialized
 */
export function isSignalAggregatorInitialized(): boolean {
  return globalAggregator !== null;
}
