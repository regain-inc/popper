/**
 * Export Bundle In-Memory Stores
 *
 * In-memory implementations for testing and development.
 *
 * @module export/stores
 */

import type { IAuditEventExportReader, IIncidentExportReader } from './generator';
import type {
  BundleListOptions,
  BundleListResult,
  IExportBundleStorage,
  IExportBundleStore,
  StoredExportBundle,
} from './types';

/**
 * In-memory export bundle storage
 */
export class InMemoryExportBundleStorage implements IExportBundleStorage {
  private bundles: Map<string, Buffer> = new Map();

  async upload(bundleId: string, data: Buffer, _contentType: string): Promise<string> {
    const uri = `memory://${bundleId}`;
    this.bundles.set(uri, data);
    return uri;
  }

  async download(storageUri: string): Promise<Buffer> {
    const data = this.bundles.get(storageUri);
    if (!data) {
      throw new Error(`Bundle not found: ${storageUri}`);
    }
    return data;
  }

  async delete(storageUri: string): Promise<void> {
    this.bundles.delete(storageUri);
  }

  /** Clear all bundles (for testing) */
  clear(): void {
    this.bundles.clear();
  }
}

/**
 * In-memory export bundle metadata store
 */
export class InMemoryExportBundleStore implements IExportBundleStore {
  private bundles: Map<string, StoredExportBundle> = new Map();

  async save(bundle: StoredExportBundle): Promise<StoredExportBundle> {
    this.bundles.set(bundle.id, bundle);
    return bundle;
  }

  async getById(id: string): Promise<StoredExportBundle | null> {
    return this.bundles.get(id) ?? null;
  }

  async list(organizationId: string, options?: BundleListOptions): Promise<BundleListResult> {
    const limit = Math.min(options?.limit ?? 10, 100);
    const cursor = options?.cursor;

    // Get all bundles for org, sorted by generated_at desc
    let filtered = Array.from(this.bundles.values())
      .filter((b) => b.organization_id === organizationId)
      .sort((a, b) => b.generated_at.getTime() - a.generated_at.getTime());

    // Apply cursor (find position after cursor bundle)
    if (cursor) {
      const cursorIndex = filtered.findIndex((b) => b.id === cursor);
      if (cursorIndex >= 0) {
        filtered = filtered.slice(cursorIndex + 1);
      }
    }

    // Get limit + 1 to check if there are more
    const bundles = filtered.slice(0, limit);
    const hasMore = filtered.length > limit;
    const nextCursor = hasMore && bundles.length > 0 ? bundles[bundles.length - 1].id : null;

    return {
      bundles,
      next_cursor: nextCursor,
      has_more: hasMore,
    };
  }

  async updateStatus(
    id: string,
    status: StoredExportBundle['status'],
  ): Promise<StoredExportBundle | null> {
    const bundle = this.bundles.get(id);
    if (!bundle) return null;

    bundle.status = status;
    bundle.updated_at = new Date();
    this.bundles.set(id, bundle);
    return bundle;
  }

  async markDownloaded(id: string): Promise<StoredExportBundle | null> {
    return this.updateStatus(id, 'downloaded');
  }

  /** Clear all bundles (for testing) */
  clear(): void {
    this.bundles.clear();
  }
}

/**
 * Mock audit event reader for testing
 */
export class MockAuditEventExportReader implements IAuditEventExportReader {
  private events: Array<{
    event_id: string;
    event_type: string;
    timestamp: Date;
    trace_id: string;
    organization_id: string;
    subject_id?: string;
    decision?: string;
    reason_codes?: string[];
    mode?: string;
    validation_result?: { is_valid: boolean; issues?: string[] };
    safe_mode?: { enabled: boolean; reason?: string };
    metadata?: Record<string, unknown>;
  }> = [];

  /** Set events for testing */
  setEvents(
    events: Array<{
      event_id: string;
      event_type: string;
      timestamp: Date;
      trace_id: string;
      organization_id: string;
      subject_id?: string;
      decision?: string;
      reason_codes?: string[];
      mode?: string;
      validation_result?: { is_valid: boolean; issues?: string[] };
      safe_mode?: { enabled: boolean; reason?: string };
      metadata?: Record<string, unknown>;
    }>,
  ): void {
    this.events = events;
  }

  async getEventsForExport(
    organizationId: string,
    from: Date,
    to: Date,
    traceIds?: string[],
  ): Promise<
    Array<{
      event_id: string;
      event_type: string;
      timestamp: Date;
      trace_id: string;
      organization_id: string;
      subject_id?: string;
      decision?: string;
      reason_codes?: string[];
      mode?: string;
      validation_result?: { is_valid: boolean; issues?: string[] };
      safe_mode?: { enabled: boolean; reason?: string };
      metadata?: Record<string, unknown>;
    }>
  > {
    return this.events.filter((e) => {
      if (e.organization_id !== organizationId) return false;
      if (e.timestamp < from || e.timestamp > to) return false;
      if (traceIds && !traceIds.includes(e.trace_id)) return false;
      return true;
    });
  }
}

/**
 * Mock incident reader for testing
 */
export class MockIncidentExportReader implements IIncidentExportReader {
  private incidents: Array<{
    id: string;
    created_at: Date;
    type: string;
    status: string;
    trigger_signal?: string;
    title: string;
    description?: string;
    safe_mode_enabled?: Date;
    resolved_at?: Date;
    resolved_by?: string;
    resolution_notes?: string;
    metadata?: Record<string, unknown>;
  }> = [];

  /** Set incidents for testing */
  setIncidents(
    incidents: Array<{
      id: string;
      created_at: Date;
      type: string;
      status: string;
      trigger_signal?: string;
      title: string;
      description?: string;
      safe_mode_enabled?: Date;
      resolved_at?: Date;
      resolved_by?: string;
      resolution_notes?: string;
      metadata?: Record<string, unknown>;
    }>,
  ): void {
    this.incidents = incidents;
  }

  async getIncidentsForExport(
    _organizationId: string,
    from: Date,
    to: Date,
  ): Promise<
    Array<{
      id: string;
      created_at: Date;
      type: string;
      status: string;
      trigger_signal?: string;
      title: string;
      description?: string;
      safe_mode_enabled?: Date;
      resolved_at?: Date;
      resolved_by?: string;
      resolution_notes?: string;
      metadata?: Record<string, unknown>;
    }>
  > {
    return this.incidents.filter((i) => i.created_at >= from && i.created_at <= to);
  }
}
