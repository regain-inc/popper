/**
 * Global delivery manager instance
 *
 * Provides singleton access to the DeliveryManager for the application.
 * Used by supervision plugin to queue reconfigure effects, and by
 * control-v2 plugin for push delivery of settings/mode changes.
 *
 * @module lib/delivery-manager
 */

import type { DeliveryManager } from '@popper/core';

let globalManager: DeliveryManager | null = null;

/**
 * Set the global DeliveryManager instance
 *
 * Called at startup after HTTP client, DLQ, and desired-state manager are ready.
 */
export function setDeliveryManager(manager: DeliveryManager): void {
  globalManager = manager;
}

/**
 * Get the global DeliveryManager instance
 */
export function getDeliveryManager(): DeliveryManager {
  if (!globalManager) {
    throw new Error('DeliveryManager not initialized. Call setDeliveryManager() at startup.');
  }
  return globalManager;
}

/**
 * Check if delivery manager has been initialized
 */
export function isDeliveryManagerInitialized(): boolean {
  return globalManager !== null;
}
