/**
 * Queue-based audit storage using BullMQ
 *
 * Instead of writing directly to the database, this storage
 * sends audit events to a Redis queue for async processing.
 *
 * Benefits:
 * - Non-blocking writes (supervision endpoint responds faster)
 * - Fault tolerance (events persist in Redis if DB is down)
 * - Scalability (multiple workers can process events)
 * - Built-in retry logic from BullMQ
 *
 * @module lib/queue-audit-storage
 */

import type { AuditStorage, StoredAuditEvent } from '@popper/core';
import type { Queue } from 'bullmq';

/**
 * Queue-based audit storage
 *
 * Implements AuditStorage interface but sends events to BullMQ
 * instead of writing directly to database.
 */
export class QueueAuditStorage implements AuditStorage {
  constructor(private readonly queue: Queue) {}

  /**
   * Send a single audit event to the queue
   */
  async insert(event: StoredAuditEvent): Promise<void> {
    await this.queue.add('audit-event', event, {
      // Use event id as job ID for deduplication
      jobId: `audit-${event.id}`,
    });
  }

  /**
   * Send multiple audit events to the queue
   */
  async insertBatch(events: StoredAuditEvent[]): Promise<void> {
    if (events.length === 0) return;

    // BullMQ bulk add
    const jobs = events.map((event) => ({
      name: 'audit-event',
      data: event,
      opts: {
        jobId: `audit-${event.id}`,
      },
    }));

    await this.queue.addBulk(jobs);
  }
}
