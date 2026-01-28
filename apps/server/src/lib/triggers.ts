/**
 * Drift Triggers Manager singleton
 *
 * Provides access to drift trigger evaluation and incident management.
 *
 * @module lib/triggers
 */

import type { DriftTriggersManager } from '@popper/core';

let triggersManager: DriftTriggersManager | null = null;

/**
 * Get the drift triggers manager instance
 *
 * @throws Error if manager not initialized
 */
export function getDriftTriggersManager(): DriftTriggersManager {
  if (!triggersManager) {
    throw new Error('DriftTriggersManager not initialized. Call setDriftTriggersManager() first.');
  }
  return triggersManager;
}

/**
 * Set the drift triggers manager instance
 */
export function setDriftTriggersManager(manager: DriftTriggersManager): void {
  triggersManager = manager;
}

/**
 * Check if drift triggers manager is initialized
 */
export function isDriftTriggersManagerInitialized(): boolean {
  return triggersManager !== null;
}
