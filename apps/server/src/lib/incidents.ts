/**
 * Global incidents manager instance
 *
 * Provides singleton access to the incidents storage for the application.
 *
 * @module lib/incidents
 */

import { type IIncidentsStore, InMemoryIncidentsStorage } from '@popper/db';

// Default to in-memory store (replaced at startup if DB available)
let globalStore: IIncidentsStore = new InMemoryIncidentsStorage();
let initialized = false;

/**
 * Set the global incidents store
 *
 * Called at startup to configure the store with proper database connection.
 */
export function setIncidentsStore(store: IIncidentsStore): void {
  globalStore = store;
  initialized = true;
}

/**
 * Get the global incidents store
 */
export function getIncidentsStore(): IIncidentsStore {
  return globalStore;
}

/**
 * Check if incidents store has been initialized with a real store
 */
export function isIncidentsStoreInitialized(): boolean {
  return initialized;
}
