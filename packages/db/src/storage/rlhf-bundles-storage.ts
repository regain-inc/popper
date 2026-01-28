/**
 * RLHF Bundles storage layer
 *
 * Provides PostgreSQL storage for RLHF feedback bundles.
 *
 * @module storage/rlhf-bundles
 */

import type {
  IFeedbackBundleStore,
  RLHFFeedbackBundle,
  StoredFeedbackBundle,
} from '@popper/core/rlhf/types';
import { desc, eq, isNull } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { type NewRlhfBundle, type RlhfBundle, rlhfBundles } from '../schema/rlhf-bundles';

/**
 * Convert database record to StoredFeedbackBundle
 */
function toStoredBundle(record: RlhfBundle): StoredFeedbackBundle {
  return {
    id: record.id,
    organizationId: record.organizationId,
    periodStart: record.periodStart,
    periodEnd: record.periodEnd,
    generatedAt: record.generatedAt,
    triggeredBy: record.triggeredBy,
    bundleData: record.bundleData as RLHFFeedbackBundle,
    status: record.status as 'pending' | 'processed' | 'archived',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/**
 * Drizzle-based RLHF bundles storage
 */
export class DrizzleRlhfBundlesStorage implements IFeedbackBundleStore {
  constructor(private readonly db: PostgresJsDatabase) {}

  async save(bundle: StoredFeedbackBundle): Promise<StoredFeedbackBundle> {
    const record: NewRlhfBundle = {
      id: bundle.id,
      organizationId: bundle.organizationId,
      periodStart: bundle.periodStart,
      periodEnd: bundle.periodEnd,
      generatedAt: bundle.generatedAt,
      triggeredBy: bundle.triggeredBy,
      bundleData: bundle.bundleData,
      status: bundle.status,
      createdAt: bundle.createdAt,
      updatedAt: bundle.updatedAt,
    };

    const [result] = await this.db.insert(rlhfBundles).values(record).returning();
    return toStoredBundle(result);
  }

  async getById(id: string): Promise<StoredFeedbackBundle | null> {
    const results = await this.db.select().from(rlhfBundles).where(eq(rlhfBundles.id, id)).limit(1);

    if (results.length === 0) return null;
    return toStoredBundle(results[0]);
  }

  async list(organizationId: string | null, limit = 10): Promise<StoredFeedbackBundle[]> {
    const condition =
      organizationId === null
        ? isNull(rlhfBundles.organizationId)
        : eq(rlhfBundles.organizationId, organizationId);

    const results = await this.db
      .select()
      .from(rlhfBundles)
      .where(condition)
      .orderBy(desc(rlhfBundles.generatedAt))
      .limit(limit);

    return results.map(toStoredBundle);
  }

  async updateStatus(
    id: string,
    status: 'pending' | 'processed' | 'archived',
  ): Promise<StoredFeedbackBundle | null> {
    const [result] = await this.db
      .update(rlhfBundles)
      .set({ status, updatedAt: new Date() })
      .where(eq(rlhfBundles.id, id))
      .returning();

    if (!result) return null;
    return toStoredBundle(result);
  }

  async getLatest(organizationId: string | null): Promise<StoredFeedbackBundle | null> {
    const bundles = await this.list(organizationId, 1);
    return bundles[0] ?? null;
  }
}

/**
 * In-memory RLHF bundles storage for testing
 */
export class InMemoryRlhfBundlesStorage implements IFeedbackBundleStore {
  private bundles: Map<string, StoredFeedbackBundle> = new Map();

  async save(bundle: StoredFeedbackBundle): Promise<StoredFeedbackBundle> {
    this.bundles.set(bundle.id, bundle);
    return bundle;
  }

  async getById(id: string): Promise<StoredFeedbackBundle | null> {
    return this.bundles.get(id) ?? null;
  }

  async list(organizationId: string | null, limit = 10): Promise<StoredFeedbackBundle[]> {
    const filtered = Array.from(this.bundles.values())
      .filter((b) => b.organizationId === organizationId)
      .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());

    return filtered.slice(0, limit);
  }

  async updateStatus(
    id: string,
    status: 'pending' | 'processed' | 'archived',
  ): Promise<StoredFeedbackBundle | null> {
    const bundle = this.bundles.get(id);
    if (!bundle) return null;

    bundle.status = status;
    bundle.updatedAt = new Date();
    this.bundles.set(id, bundle);
    return bundle;
  }

  async getLatest(organizationId: string | null): Promise<StoredFeedbackBundle | null> {
    const bundles = await this.list(organizationId, 1);
    return bundles[0] ?? null;
  }

  /** Clear all bundles (for testing) */
  clear(): void {
    this.bundles.clear();
  }
}
