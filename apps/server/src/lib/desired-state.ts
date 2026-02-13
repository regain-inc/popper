/**
 * Global desired-state manager instance
 *
 * Provides singleton access to the DesiredStateManager for the application.
 * Used by control-v2 plugin to read/update desired state, and by
 * the reconciliation loop to detect divergence.
 *
 * @module lib/desired-state
 */

import type { DesiredStateManager } from '@popper/core';

let globalManager: DesiredStateManager | null = null;

/**
 * Set the global DesiredStateManager instance
 *
 * Called at startup to configure with database connection.
 */
export function setDesiredStateManager(manager: DesiredStateManager): void {
  globalManager = manager;
}

/**
 * Get the global DesiredStateManager instance
 */
export function getDesiredStateManager(): DesiredStateManager {
  if (!globalManager) {
    throw new Error(
      'DesiredStateManager not initialized. Call setDesiredStateManager() at startup.',
    );
  }
  return globalManager;
}

/**
 * Check if desired-state manager has been initialized
 */
export function isDesiredStateManagerInitialized(): boolean {
  return globalManager !== null;
}
