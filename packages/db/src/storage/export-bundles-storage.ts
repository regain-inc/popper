/**
 * Export Bundles storage layer
 *
 * Provides PostgreSQL storage for export bundle metadata.
 *
 * @module storage/export-bundles
 */

import type {
  BundleListOptions,
  BundleListResult,
  IExportBundleStore,
  StoredExportBundle,
} from '@popper/core/export/types';
import { and, desc, eq, lt } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { type ExportBundle, exportBundles, type NewExportBundle } from '../schema/export-bundles';

/**
 * Convert database record to StoredExportBundle
 */
function toStoredBundle(record: ExportBundle): StoredExportBundle {
  return {
    id: record.id,
    organization_id: record.organizationId,
    time_window: {
      from: record.timeWindowFrom,
      to: record.timeWindowTo,
    },
    generated_at: record.generatedAt,
    triggered_by: record.triggeredBy,
    storage_uri: record.storageUri,
    size_bytes: record.sizeBytes,
    content_hash: record.contentHash,
    event_count: record.eventCount,
    incident_count: record.incidentCount,
    status: record.status as StoredExportBundle['status'],
    expires_at: record.expiresAt ?? undefined,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

/**
 * Drizzle-based export bundles storage
 */
export class DrizzleExportBundlesStorage implements IExportBundleStore {
  constructor(private readonly db: PostgresJsDatabase) {}

  async save(bundle: StoredExportBundle): Promise<StoredExportBundle> {
    const record: NewExportBundle = {
      id: bundle.id,
      organizationId: bundle.organization_id,
      timeWindowFrom: bundle.time_window.from,
      timeWindowTo: bundle.time_window.to,
      generatedAt: bundle.generated_at,
      triggeredBy: bundle.triggered_by,
      storageUri: bundle.storage_uri,
      sizeBytes: bundle.size_bytes,
      contentHash: bundle.content_hash,
      eventCount: bundle.event_count,
      incidentCount: bundle.incident_count,
      status: bundle.status,
      expiresAt: bundle.expires_at,
      createdAt: bundle.created_at,
      updatedAt: bundle.updated_at,
    };

    const [result] = await this.db.insert(exportBundles).values(record).returning();
    return toStoredBundle(result);
  }

  async getById(id: string): Promise<StoredExportBundle | null> {
    const results = await this.db
      .select()
      .from(exportBundles)
      .where(eq(exportBundles.id, id))
      .limit(1);

    if (results.length === 0) return null;
    return toStoredBundle(results[0]);
  }

  async list(organizationId: string, options?: BundleListOptions): Promise<BundleListResult> {
    const limit = Math.min(options?.limit ?? 10, 100);
    const cursor = options?.cursor;

    // Build query with cursor if provided
    let cursorDate: Date | undefined;
    if (cursor) {
      const cursorBundle = await this.getById(cursor);
      if (cursorBundle) {
        cursorDate = cursorBundle.generated_at;
      }
    }

    // Query with cursor-based pagination
    const whereCondition = cursorDate
      ? and(
          eq(exportBundles.organizationId, organizationId),
          lt(exportBundles.generatedAt, cursorDate),
        )
      : eq(exportBundles.organizationId, organizationId);

    const results = await this.db
      .select()
      .from(exportBundles)
      .where(whereCondition)
      .orderBy(desc(exportBundles.generatedAt))
      .limit(limit + 1); // Fetch one extra to check if there are more

    const hasMore = results.length > limit;
    const bundles = results.slice(0, limit).map(toStoredBundle);
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
    const [result] = await this.db
      .update(exportBundles)
      .set({ status, updatedAt: new Date() })
      .where(eq(exportBundles.id, id))
      .returning();

    if (!result) return null;
    return toStoredBundle(result);
  }

  async markDownloaded(id: string): Promise<StoredExportBundle | null> {
    return this.updateStatus(id, 'downloaded');
  }
}

/**
 * In-memory export bundles storage for testing
 */
export class InMemoryExportBundlesStorage implements IExportBundleStore {
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

    let filtered = Array.from(this.bundles.values())
      .filter((b) => b.organization_id === organizationId)
      .sort((a, b) => b.generated_at.getTime() - a.generated_at.getTime());

    // Apply cursor
    if (cursor) {
      const cursorIndex = filtered.findIndex((b) => b.id === cursor);
      if (cursorIndex >= 0) {
        filtered = filtered.slice(cursorIndex + 1);
      }
    }

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
