/**
 * Popper Queue Worker Entry Point
 *
 * BullMQ worker for processing background jobs:
 * - Audit event persistence
 *
 * @module index
 */

import { createDB } from '@popper/db';
import { config } from './lib/config';
import { logger, setupLogger } from './lib/logger';
import { createAuditWorker, createRedisConnection, getConnectionOptions } from './lib/queue';
import {
  flushPendingEvents,
  getPendingCount,
  initAuditProcessor,
  processAuditEvent,
} from './processors/audit';

// Track shutdown state
let isShuttingDown = false;

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Initialize logging
  await setupLogger();

  logger.info`Starting Popper Queue Worker...`;
  logger.info`Redis URL: ${config.redis.url.replace(/\/\/.*@/, '//<redacted>@')}`;

  // Validate DATABASE_URL
  if (!config.database.url) {
    logger.error`DATABASE_URL is required for queue worker`;
    process.exit(1);
  }

  // Initialize database connection
  logger.info`Connecting to PostgreSQL...`;
  const db = createDB(config.database.url);
  initAuditProcessor(db);
  logger.info`Database connection established`;

  // Initialize Redis connection
  logger.info`Connecting to Redis...`;
  const redis = createRedisConnection();
  const connectionOptions = getConnectionOptions(redis);

  // Create audit worker
  const auditWorker = createAuditWorker(connectionOptions, processAuditEvent);

  auditWorker.on('ready', () => {
    logger.info`Audit worker ready, concurrency: ${config.worker.concurrency}`;
  });

  auditWorker.on('completed', (job) => {
    logger.debug`Job ${job.id} completed`;
  });

  auditWorker.on('failed', (job, err) => {
    logger.error`Job ${job?.id} failed: ${err.message}`;
  });

  auditWorker.on('error', (err) => {
    logger.error`Worker error: ${err.message}`;
  });

  logger.info`Queue worker started successfully`;

  // Setup graceful shutdown
  setupGracefulShutdown(auditWorker, redis);
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown(
  worker: Awaited<ReturnType<typeof createAuditWorker>>,
  redis: ReturnType<typeof createRedisConnection>,
): void {
  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) {
      logger.warning`Shutdown already in progress, ignoring ${signal}`;
      return;
    }

    isShuttingDown = true;
    logger.info`Received ${signal}, starting graceful shutdown...`;

    try {
      // Stop accepting new jobs
      logger.info`Closing worker...`;
      await worker.close();

      // Flush any pending batched events
      const pendingCount = getPendingCount();
      if (pendingCount > 0) {
        logger.info`Flushing ${pendingCount} pending events...`;
        await flushPendingEvents();
      }

      // Close Redis connection
      logger.info`Closing Redis connection...`;
      redis.disconnect();

      logger.info`Queue worker stopped gracefully`;
      process.exit(0);
    } catch (error) {
      logger.error`Error during shutdown: ${error}`;
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (error) => {
    logger.fatal`Uncaught exception: ${error}`;
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal`Unhandled rejection: ${reason}`;
    process.exit(1);
  });
}

// Start the worker
main().catch((error) => {
  console.error('Failed to start queue worker:', error);
  process.exit(1);
});
