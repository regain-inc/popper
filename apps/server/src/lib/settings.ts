/**
 * Global settings manager instance
 *
 * Provides singleton access to the SettingsManager for the application.
 *
 * @module lib/settings
 */

import { InMemorySettingsCache, InMemorySettingsStore, SettingsManager } from '@popper/core';

// Default to in-memory stores (replaced at startup if Redis/DB available)
let globalManager: SettingsManager = new SettingsManager({
  store: new InMemorySettingsStore(),
  cache: new InMemorySettingsCache(),
});

/**
 * Set the global SettingsManager instance
 *
 * Called at startup to configure the manager with proper stores.
 */
export function setSettingsManager(manager: SettingsManager): void {
  globalManager = manager;
}

/**
 * Get the global SettingsManager instance
 */
export function getSettingsManager(): SettingsManager {
  return globalManager;
}
