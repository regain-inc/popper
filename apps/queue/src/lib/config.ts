/**
 * Queue worker configuration
 * @module lib/config
 */

export const config = {
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    maxRetriesPerRequest: null, // Required for BullMQ
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  worker: {
    concurrency: Number(process.env.WORKER_CONCURRENCY) || 10,
    batchSize: Number(process.env.BATCH_SIZE) || 100,
    batchTimeout: Number(process.env.BATCH_TIMEOUT) || 1000, // ms
  },
  log: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
};

export const QUEUE_NAMES = {
  AUDIT_EVENTS: 'audit-events',
} as const;
