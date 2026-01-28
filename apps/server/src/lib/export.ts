/**
 * Export Bundle Generator singleton
 *
 * Provides global access to the export bundle generator instance.
 *
 * @module lib/export
 */

import type { ExportBundleGenerator } from '@popper/core';

let exportGenerator: ExportBundleGenerator | null = null;

/**
 * Check if the export generator is initialized
 */
export function isExportGeneratorInitialized(): boolean {
  return exportGenerator !== null;
}

/**
 * Set the global export generator instance
 */
export function setExportGenerator(generator: ExportBundleGenerator): void {
  exportGenerator = generator;
}

/**
 * Get the global export generator instance
 *
 * @throws Error if not initialized
 */
export function getExportGenerator(): ExportBundleGenerator {
  if (!exportGenerator) {
    throw new Error('Export generator not initialized. Call setExportGenerator() first.');
  }
  return exportGenerator;
}
