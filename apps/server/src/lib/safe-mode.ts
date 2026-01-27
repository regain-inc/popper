/**
 * Global safe-mode manager instance
 *
 * Provides singleton access to the SafeModeManager for the application.
 *
 * @module lib/safe-mode
 */

import {
  InMemorySafeModeHistoryStore,
  InMemorySafeModeStateStore,
  SafeModeManager,
} from '@popper/core';

// Default to in-memory stores (replaced at startup if Redis/DB available)
let globalManager: SafeModeManager = new SafeModeManager({
  stateStore: new InMemorySafeModeStateStore(),
  historyStore: new InMemorySafeModeHistoryStore(),
});

/**
 * Set the global SafeModeManager instance
 *
 * Called at startup to configure the manager with proper stores.
 */
export function setSafeModeManager(manager: SafeModeManager): void {
  globalManager = manager;
}

/**
 * Get the global SafeModeManager instance
 */
export function getSafeModeManager(): SafeModeManager {
  return globalManager;
}
