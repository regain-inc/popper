/**
 * BullMQ queue configuration and connection
 * @module lib/queue
 */

import { type ConnectionOptions, type Job, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { config, QUEUE_NAMES } from './config';

/**
 * Create Redis connection for BullMQ
 */
export function createRedisConnection(): IORedis {
  return new IORedis(config.redis.url, {
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
  });
}

/**
 * Get BullMQ connection options from Redis instance
 */
export function getConnectionOptions(redis: IORedis): ConnectionOptions {
  return { connection: redis };
}

/**
 * Create audit events queue
 */
export function createAuditQueue(connection: ConnectionOptions): Queue {
  return new Queue(QUEUE_NAMES.AUDIT_EVENTS, {
    ...connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
        count: 1000,
      },
      removeOnFail: {
        age: 86400 * 7, // Keep failed jobs for 7 days
      },
    },
  });
}

/**
 * Create audit events worker
 */
export function createAuditWorker(
  connection: ConnectionOptions,
  processor: (job: Job) => Promise<void>,
): Worker {
  return new Worker(QUEUE_NAMES.AUDIT_EVENTS, processor, {
    ...connection,
    concurrency: config.worker.concurrency,
  });
}
