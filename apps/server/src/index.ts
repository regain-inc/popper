/**
 * Popper Server Entry Point
 * HTTP server with graceful shutdown, structured logging, and observability
 * @module index
 */

import { resolve } from 'node:path';
import { AuditEmitter, policyRegistry, setDefaultEmitter } from '@popper/core';
import { createDB, DrizzleAuditStorage } from '@popper/db';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { createApp } from './app';
import { env } from './config/env';
import { logger, setupLogger } from './lib/logger';
import { QueueAuditStorage } from './lib/queue-audit-storage';
import { setReady } from './plugins/health';

/** Audit events queue name */
const AUDIT_QUEUE_NAME = 'audit-events';

// Track shutdown state
let isShuttingDown = false;

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Initialize logging first
  await setupLogger();

  logger.info`Starting Popper server...`;
  logger.info`Environment: ${env.NODE_ENV}`;
  logger.info`Log level: ${env.LOG_LEVEL}`;

  // Load policy packs
  // POLICIES_DIR is relative to monorepo root, not server cwd
  const policiesDir = resolve(import.meta.dir, '../../..', env.POLICIES_DIR);
  logger.info`Loading policy packs from ${policiesDir}...`;

  try {
    const count = await policyRegistry.loadFromDir(policiesDir);
    logger.info`Loaded ${count} policy pack(s): ${policyRegistry.list().join(', ')}`;

    if (count === 0) {
      logger.warning`No policy packs found. Supervision requests will fail.`;
    }
  } catch (error) {
    logger.error`Failed to load policy packs: ${error}`;
    throw error;
  }

  // Initialize audit storage
  // Priority: Redis queue > Direct PostgreSQL > In-memory
  if (env.REDIS_URL) {
    // Use BullMQ queue for async audit event processing
    logger.info`Initializing audit storage with Redis queue...`;
    const redis = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
    });
    const auditQueue = new Queue(AUDIT_QUEUE_NAME, { connection: redis });
    const auditStorage = new QueueAuditStorage(auditQueue);
    const auditEmitter = new AuditEmitter(auditStorage, {
      batchEnabled: false, // Queue handles batching
      asyncWrites: true,
    });
    setDefaultEmitter(auditEmitter);
    logger.info`Audit storage initialized with Redis queue`;
  } else if (env.DATABASE_URL) {
    // Direct PostgreSQL writes (not recommended for production)
    logger.info`Initializing audit storage with PostgreSQL (direct)...`;
    logger.warning`Direct DB writes not recommended. Set REDIS_URL for queue-based storage.`;
    const db = createDB(env.DATABASE_URL);
    const auditStorage = new DrizzleAuditStorage(db);
    const auditEmitter = new AuditEmitter(auditStorage, {
      batchEnabled: true,
      batchSize: 100,
      batchFlushInterval: 1000,
      asyncWrites: true,
    });
    setDefaultEmitter(auditEmitter);
    logger.info`Audit storage initialized with PostgreSQL (direct)`;
  } else {
    logger.warning`REDIS_URL and DATABASE_URL not configured, using in-memory audit storage`;
  }

  // Create and start the application
  const app = createApp();

  const server = app.listen({
    port: env.PORT,
    hostname: env.HOST,
  });

  logger.info`Popper listening on http://${env.HOST}:${env.PORT}`;

  // Mark as ready after successful startup
  setReady(true);
  logger.info`Server ready to accept connections`;

  // Setup graceful shutdown handlers
  setupGracefulShutdown(server);
}

/**
 * Setup graceful shutdown handlers for SIGTERM and SIGINT
 */
function setupGracefulShutdown(server: ReturnType<typeof Bun.serve>): void {
  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) {
      logger.warning`Shutdown already in progress, ignoring ${signal}`;
      return;
    }

    isShuttingDown = true;
    logger.info`Received ${signal}, starting graceful shutdown...`;

    // Mark as not ready to stop receiving new traffic
    setReady(false);

    try {
      // Give load balancers time to stop sending traffic
      const drainTimeout = 5000;
      logger.info`Draining connections for ${drainTimeout}ms...`;
      await new Promise((resolve) => setTimeout(resolve, drainTimeout));

      // Stop the server
      logger.info`Stopping server...`;
      server.stop(true); // true = wait for pending requests

      logger.info`Server stopped gracefully`;
      process.exit(0);
    } catch (error) {
      logger.error`Error during shutdown: ${error}`;
      process.exit(1);
    }
  };

  // Handle termination signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.fatal`Uncaught exception: ${error}`;
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal`Unhandled rejection: ${reason}`;
    process.exit(1);
  });
}

// Start the server
main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
