/**
 * Drift Counters singleton for server
 *
 * Provides access to drift signal tracking for monitoring
 * and safe-mode trigger evaluation.
 *
 * @module lib/drift
 */

import { DriftCounters, type IDriftCounters, InMemoryDriftCounters } from '@popper/cache';

let driftCounters: IDriftCounters | null = null;

/**
 * Get the drift counters instance
 *
 * @throws Error if drift counters not initialized
 */
export function getDriftCounters(): IDriftCounters {
  if (!driftCounters) {
    throw new Error('Drift counters not initialized. Call setDriftCounters() first.');
  }
  return driftCounters;
}

/**
 * Set the drift counters instance
 *
 * @param counters - Drift counters implementation to use
 */
export function setDriftCounters(counters: IDriftCounters): void {
  driftCounters = counters;
}

/**
 * Check if drift counters are initialized
 */
export function isDriftCountersInitialized(): boolean {
  return driftCounters !== null;
}

export { DriftCounters, InMemoryDriftCounters };
