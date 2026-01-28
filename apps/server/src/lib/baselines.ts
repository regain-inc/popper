/**
 * Baseline calculator singleton
 *
 * Provides global access to the baseline calculator instance.
 *
 * @module lib/baselines
 */

import type { BaselineCalculator } from '@popper/core';

let baselineCalculator: BaselineCalculator | null = null;

/**
 * Get the baseline calculator instance
 * @throws Error if not initialized
 */
export function getBaselineCalculator(): BaselineCalculator {
  if (!baselineCalculator) {
    throw new Error('Baseline calculator not initialized. Call setBaselineCalculator first.');
  }
  return baselineCalculator;
}

/**
 * Set the baseline calculator instance
 */
export function setBaselineCalculator(calculator: BaselineCalculator): void {
  baselineCalculator = calculator;
}

/**
 * Check if baseline calculator is initialized
 */
export function isBaselineCalculatorInitialized(): boolean {
  return baselineCalculator !== null;
}
