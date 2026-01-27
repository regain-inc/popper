/**
 * Audit event processor
 *
 * Processes audit events from BullMQ and writes them to PostgreSQL.
 * Uses batching for efficient inserts into TimescaleDB.
 *
 * @module processors/audit
 */

import type { DrizzleDB } from '@popper/db';
import { DrizzleAuditStorage, type StoredAuditEvent } from '@popper/db';
import type { Job } from 'bullmq';
import { config } from '../lib/config';
import { logger } from '../lib/logger';

/**
 * Batch accumulator for efficient database writes
 */
class BatchAccumulator {
  private batch: StoredAuditEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly storage: DrizzleAuditStorage;
  private readonly batchSize: number;
  private readonly batchTimeout: number;

  constructor(db: DrizzleDB, batchSize: number, batchTimeout: number) {
    this.storage = new DrizzleAuditStorage(db);
    this.batchSize = batchSize;
    this.batchTimeout = batchTimeout;
  }

  /**
   * Add event to batch and flush if needed
   */
  async add(event: StoredAuditEvent): Promise<void> {
    this.batch.push(event);

    if (this.batch.length >= this.batchSize) {
      await this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flush().catch((err) => {
          logger.error`Batch flush failed: ${err}`;
        });
      }, this.batchTimeout);
    }
  }

  /**
   * Force flush all pending events
   */
  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.batch.length === 0) {
      return;
    }

    const eventsToFlush = this.batch;
    this.batch = [];

    const startTime = performance.now();
    await this.storage.insertBatch(eventsToFlush);
    const elapsed = performance.now() - startTime;

    logger.info`Flushed ${eventsToFlush.length} audit events in ${elapsed.toFixed(2)}ms`;
  }

  /**
   * Get pending event count
   */
  getPendingCount(): number {
    return this.batch.length;
  }
}

let batchAccumulator: BatchAccumulator | null = null;

/**
 * Initialize the audit processor with database connection
 */
export function initAuditProcessor(db: DrizzleDB): void {
  batchAccumulator = new BatchAccumulator(db, config.worker.batchSize, config.worker.batchTimeout);
}

/**
 * Process a single audit event job
 */
export async function processAuditEvent(job: Job<StoredAuditEvent>): Promise<void> {
  if (!batchAccumulator) {
    throw new Error('Audit processor not initialized. Call initAuditProcessor first.');
  }

  const event = job.data;

  // Validate required fields
  if (!event.id || !event.traceId || !event.eventType) {
    logger.warning`Invalid audit event in job ${job.id}: missing required fields`;
    throw new Error('Invalid audit event: missing required fields');
  }

  await batchAccumulator.add(event);
}

/**
 * Flush any pending events (call on shutdown)
 */
export async function flushPendingEvents(): Promise<void> {
  if (batchAccumulator) {
    await batchAccumulator.flush();
  }
}

/**
 * Get pending event count
 */
export function getPendingCount(): number {
  return batchAccumulator?.getPendingCount() ?? 0;
}
