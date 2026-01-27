/**
 * Global Organization service instance management
 *
 * Follows the same pattern as api-keys.ts and safe-mode.ts -
 * allows setting instances at startup and accessing from plugins.
 *
 * @module lib/organizations
 */

import type { OrganizationService } from '@popper/db';

/** Global Organization service instance */
let globalService: OrganizationService | null = null;

/**
 * Initialize the global Organization service
 *
 * Must be called at startup with the database connection.
 */
export function initOrganizationService(service: OrganizationService): void {
  globalService = service;
}

/**
 * Get the global Organization service instance
 *
 * @throws Error if service not initialized
 */
export function getOrganizationService(): OrganizationService {
  if (!globalService) {
    throw new Error('OrganizationService not initialized. Call initOrganizationService() first.');
  }
  return globalService;
}

/**
 * Check if Organization service is initialized
 */
export function isOrganizationServiceInitialized(): boolean {
  return globalService !== null;
}
