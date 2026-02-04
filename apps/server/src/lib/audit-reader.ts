/**
 * Audit event reader singleton for server
 *
 * Provides access to DrizzleAuditEventReader for dashboard
 * and other endpoints that need to query audit events.
 *
 * @module lib/audit-reader
 */

import type { DrizzleAuditEventReader } from '@popper/db';

let reader: DrizzleAuditEventReader | null = null;

export function setAuditReader(r: DrizzleAuditEventReader): void {
  reader = r;
}

export function getAuditReader(): DrizzleAuditEventReader {
  if (!reader) {
    throw new Error('Audit reader not initialized. Requires PostgreSQL.');
  }
  return reader;
}

export function isAuditReaderInitialized(): boolean {
  return reader !== null;
}
