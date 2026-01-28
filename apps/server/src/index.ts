/**
 * Popper Server Entry Point
 * HTTP server with graceful shutdown, structured logging, and observability
 * @module index
 */

import { resolve } from 'node:path';
import {
  ApiKeyCache,
  IdempotencyCache,
  InMemoryApiKeyCache,
  InMemoryIdempotencyCache,
  InMemoryRateLimitCache,
  RateLimitCache,
} from '@popper/cache';
import type { SupervisionResponse } from '@popper/core';
import {
  AuditEmitter,
  createPolicyLifecycleEvent,
  getDefaultEmitter,
  InMemoryPolicyPackCache,
  InMemorySafeModeHistoryStore,
  InMemorySafeModeStateStore,
  InMemorySettingsCache,
  InMemorySettingsStore,
  type PolicyLifecycleEvent,
  PolicyLifecycleManager,
  policyRegistry,
  RedisPolicyPackCache,
  RedisSafeModeStateStore,
  RedisSettingsCache,
  SafeModeManager,
  SettingsManager,
  setDefaultEmitter,
} from '@popper/core';
import {
  ApiKeyService,
  createDB,
  DrizzleAuditStorage,
  DrizzleOperationalSettingsStorage,
  DrizzlePolicyPackStorage,
  DrizzleSafeModeHistoryStorage,
  OrganizationService,
} from '@popper/db';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { createApp } from './app';
import { env } from './config/env';
import { initApiKeyService, setApiKeyCache } from './lib/api-keys';
import { setIdempotencyCache } from './lib/idempotency';
import { logger, setupLogger } from './lib/logger';
import { initOrganizationService } from './lib/organizations';
import { setPolicyLifecycleManager } from './lib/policy-lifecycle';
import { PolicyPackStoreAdapter } from './lib/policy-pack-store-adapter';
import { QueueAuditStorage } from './lib/queue-audit-storage';
import { setRateLimitCache } from './lib/rate-limit';
import { setSafeModeManager } from './lib/safe-mode';
import { setSettingsManager } from './lib/settings';
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

  // Initialize audit storage, idempotency cache, and safe-mode manager
  // Priority: Redis + PostgreSQL > Direct PostgreSQL > In-memory
  if (env.REDIS_URL && env.DATABASE_URL) {
    // Production setup: Redis for state + queue, PostgreSQL for history
    logger.info`Initializing with Redis + PostgreSQL...`;

    const redis = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
    });

    // Audit storage via queue
    const auditQueue = new Queue(AUDIT_QUEUE_NAME, { connection: redis });
    const auditStorage = new QueueAuditStorage(auditQueue);
    const auditEmitter = new AuditEmitter(auditStorage, {
      batchEnabled: false, // Queue handles batching
      asyncWrites: true,
    });
    setDefaultEmitter(auditEmitter);
    logger.info`Audit storage initialized with Redis queue`;

    // Idempotency cache via Redis
    const idempotencyRedis = new IORedis(env.REDIS_URL);
    const idempotencyCache = new IdempotencyCache<SupervisionResponse>(idempotencyRedis);
    setIdempotencyCache(idempotencyCache);
    logger.info`Idempotency cache initialized with Redis`;

    // Safe-mode manager: Redis for state, PostgreSQL for history
    const safeModeRedis = new IORedis(env.REDIS_URL);
    const db = createDB(env.DATABASE_URL);
    const safeModeManager = new SafeModeManager({
      stateStore: new RedisSafeModeStateStore(safeModeRedis),
      historyStore: new DrizzleSafeModeHistoryStorage(db),
    });
    setSafeModeManager(safeModeManager);
    logger.info`Safe-mode manager initialized with Redis + PostgreSQL`;

    // API key service: Database + Redis cache
    const apiKeyRedis = new IORedis(env.REDIS_URL);
    const apiKeyCache = new ApiKeyCache(apiKeyRedis);
    setApiKeyCache(apiKeyCache);
    const apiKeyService = new ApiKeyService(db);
    initApiKeyService(apiKeyService);
    logger.info`API key service initialized with PostgreSQL + Redis cache`;

    // Organization service: Database
    const organizationService = new OrganizationService(db);
    initOrganizationService(organizationService);
    logger.info`Organization service initialized with PostgreSQL`;

    // Rate limit cache via Redis
    const rateLimitRedis = new IORedis(env.REDIS_URL);
    setRateLimitCache(new RateLimitCache(rateLimitRedis));
    logger.info`Rate limit cache initialized with Redis`;

    // Settings manager: PostgreSQL for storage, Redis for cache
    const settingsRedis = new IORedis(env.REDIS_URL);
    const settingsManager = new SettingsManager({
      store: new DrizzleOperationalSettingsStorage(db),
      cache: new RedisSettingsCache(settingsRedis),
    });
    setSettingsManager(settingsManager);
    logger.info`Settings manager initialized with PostgreSQL + Redis cache`;

    // Policy lifecycle manager: PostgreSQL for storage, Redis for cache
    const policyPackStorage = new DrizzlePolicyPackStorage(db);
    const policyPackCacheRedis = new IORedis(env.REDIS_URL);
    const policyLifecycleManager = new PolicyLifecycleManager({
      store: new PolicyPackStoreAdapter(policyPackStorage),
      cache: new RedisPolicyPackCache(policyPackCacheRedis),
      onPolicyActivated: (pack) => {
        // Register activated policy in runtime registry for supervision
        // Global policies (org_id=null) are registered for all supervision requests
        // Organization-specific policies can be handled via policy_id lookup
        policyRegistry.register(pack.content, true);
        logger.info`Policy ${pack.policy_id} v${pack.version} activated and registered in runtime registry`;
      },
      onLifecycleEvent: (event: PolicyLifecycleEvent) => {
        // Emit audit event for policy lifecycle changes
        const auditEvent = createPolicyLifecycleEvent({
          eventType: event.event_type,
          policyPackId: event.policy_pack_id,
          policyId: event.policy_id,
          version: event.version,
          organizationId: event.organization_id,
          actor: event.actor,
          previousState: event.previous_state,
          newState: event.new_state,
          metadata: event.metadata,
        });
        getDefaultEmitter()
          .emit(auditEvent)
          .catch((err) => {
            logger.error`Failed to emit policy lifecycle audit event: ${err}`;
          });
      },
    });
    setPolicyLifecycleManager(policyLifecycleManager);
    logger.info`Policy lifecycle manager initialized with PostgreSQL + Redis cache`;

    // Load and register active policies from database at startup
    try {
      const activePolicies = await policyLifecycleManager.list({ state: 'ACTIVE' });
      for (const pack of activePolicies) {
        policyRegistry.register(pack.content, true);
        logger.info`Loaded active policy from DB: ${pack.policy_id} v${pack.version}`;
      }
      if (activePolicies.length > 0) {
        logger.info`Registered ${activePolicies.length} active policy pack(s) from database`;
      }
    } catch (err) {
      logger.warning`Failed to load active policies from database: ${err}`;
    }
  } else if (env.REDIS_URL) {
    // Redis only (no PostgreSQL for history)
    logger.info`Initializing with Redis only...`;
    logger.warning`DATABASE_URL not set. Safe-mode history will be in-memory.`;

    const redis = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    // Audit storage via queue
    const auditQueue = new Queue(AUDIT_QUEUE_NAME, { connection: redis });
    const auditStorage = new QueueAuditStorage(auditQueue);
    const auditEmitter = new AuditEmitter(auditStorage, {
      batchEnabled: false,
      asyncWrites: true,
    });
    setDefaultEmitter(auditEmitter);
    logger.info`Audit storage initialized with Redis queue`;

    // Idempotency cache via Redis
    const idempotencyRedis = new IORedis(env.REDIS_URL);
    const idempotencyCache = new IdempotencyCache<SupervisionResponse>(idempotencyRedis);
    setIdempotencyCache(idempotencyCache);
    logger.info`Idempotency cache initialized with Redis`;

    // Safe-mode manager: Redis for state, in-memory for history
    const safeModeRedis = new IORedis(env.REDIS_URL);
    const safeModeManager = new SafeModeManager({
      stateStore: new RedisSafeModeStateStore(safeModeRedis),
      historyStore: new InMemorySafeModeHistoryStore(),
    });
    setSafeModeManager(safeModeManager);
    logger.info`Safe-mode manager initialized with Redis (in-memory history)`;

    // API key service: Not available without database
    // In-memory cache will be used but service won't be initialized
    const apiKeyRedis = new IORedis(env.REDIS_URL);
    const apiKeyCache = new ApiKeyCache(apiKeyRedis);
    setApiKeyCache(apiKeyCache);
    logger.warning`API key service not available without DATABASE_URL. Key validation disabled.`;

    // Rate limit cache via Redis
    const rateLimitRedis = new IORedis(env.REDIS_URL);
    setRateLimitCache(new RateLimitCache(rateLimitRedis));
    logger.info`Rate limit cache initialized with Redis`;

    // Settings manager: in-memory storage without database, Redis for cache
    const settingsRedis = new IORedis(env.REDIS_URL);
    const settingsManager = new SettingsManager({
      store: new InMemorySettingsStore(),
      cache: new RedisSettingsCache(settingsRedis),
    });
    setSettingsManager(settingsManager);
    logger.warning`Settings manager initialized with in-memory storage (no DATABASE_URL)`;
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

    // In-memory idempotency cache (Redis recommended for production)
    const idempotencyCache = new InMemoryIdempotencyCache<SupervisionResponse>();
    setIdempotencyCache(idempotencyCache);
    logger.warning`Using in-memory idempotency cache. Set REDIS_URL for distributed cache.`;

    // Safe-mode manager: in-memory for state, PostgreSQL for history
    const safeModeManager = new SafeModeManager({
      stateStore: new InMemorySafeModeStateStore(),
      historyStore: new DrizzleSafeModeHistoryStorage(db),
    });
    setSafeModeManager(safeModeManager);
    logger.info`Safe-mode manager initialized with PostgreSQL (in-memory state)`;

    // API key service: Database + in-memory cache
    const apiKeyCache = new InMemoryApiKeyCache();
    setApiKeyCache(apiKeyCache);
    const apiKeyService = new ApiKeyService(db);
    initApiKeyService(apiKeyService);
    logger.info`API key service initialized with PostgreSQL (in-memory cache)`;

    // Organization service: Database
    const organizationService = new OrganizationService(db);
    initOrganizationService(organizationService);
    logger.info`Organization service initialized with PostgreSQL`;

    // Rate limit cache: in-memory (Redis recommended for production)
    setRateLimitCache(new InMemoryRateLimitCache());
    logger.warning`Using in-memory rate limit cache. Set REDIS_URL for distributed rate limiting.`;

    // Settings manager: PostgreSQL for storage, in-memory cache
    const settingsManager = new SettingsManager({
      store: new DrizzleOperationalSettingsStorage(db),
      cache: new InMemorySettingsCache(),
    });
    setSettingsManager(settingsManager);
    logger.info`Settings manager initialized with PostgreSQL (in-memory cache)`;

    // Policy lifecycle manager: PostgreSQL for storage
    const policyPackStorage = new DrizzlePolicyPackStorage(db);
    const policyLifecycleManager = new PolicyLifecycleManager({
      store: new PolicyPackStoreAdapter(policyPackStorage),
      cache: new InMemoryPolicyPackCache(),
      onPolicyActivated: (pack) => {
        policyRegistry.register(pack.content, true);
        logger.info`Policy ${pack.policy_id} v${pack.version} activated and registered in runtime registry`;
      },
      onLifecycleEvent: (event: PolicyLifecycleEvent) => {
        const auditEvent = createPolicyLifecycleEvent({
          eventType: event.event_type,
          policyPackId: event.policy_pack_id,
          policyId: event.policy_id,
          version: event.version,
          organizationId: event.organization_id,
          actor: event.actor,
          previousState: event.previous_state,
          newState: event.new_state,
          metadata: event.metadata,
        });
        getDefaultEmitter()
          .emit(auditEvent)
          .catch((err) => {
            logger.error`Failed to emit policy lifecycle audit event: ${err}`;
          });
      },
    });
    setPolicyLifecycleManager(policyLifecycleManager);
    logger.info`Policy lifecycle manager initialized with PostgreSQL (in-memory cache)`;

    // Load and register active policies from database at startup
    try {
      const activePolicies = await policyLifecycleManager.list({ state: 'ACTIVE' });
      for (const pack of activePolicies) {
        policyRegistry.register(pack.content, true);
        logger.info`Loaded active policy from DB: ${pack.policy_id} v${pack.version}`;
      }
      if (activePolicies.length > 0) {
        logger.info`Registered ${activePolicies.length} active policy pack(s) from database`;
      }
    } catch (err) {
      logger.warning`Failed to load active policies from database: ${err}`;
    }
  } else {
    logger.warning`REDIS_URL and DATABASE_URL not configured, using in-memory storage`;

    // In-memory idempotency cache for development/testing
    const idempotencyCache = new InMemoryIdempotencyCache<SupervisionResponse>();
    setIdempotencyCache(idempotencyCache);
    logger.info`Idempotency cache initialized with in-memory storage`;

    // Safe-mode manager: all in-memory
    const safeModeManager = new SafeModeManager({
      stateStore: new InMemorySafeModeStateStore(),
      historyStore: new InMemorySafeModeHistoryStore(),
    });
    setSafeModeManager(safeModeManager);
    logger.info`Safe-mode manager initialized with in-memory storage`;

    // API key service: Not available without database
    // Development mode will bypass auth, but API key management endpoints won't work
    logger.warning`API key service not available without DATABASE_URL. Key management disabled.`;

    // Rate limit cache: in-memory for development/testing
    // Note: In dev mode without auth, rate limiting uses dev-org ID
    logger.info`Rate limit cache initialized with in-memory storage`;

    // Settings manager: all in-memory for development/testing
    const settingsManager = new SettingsManager({
      store: new InMemorySettingsStore(),
      cache: new InMemorySettingsCache(),
    });
    setSettingsManager(settingsManager);
    logger.info`Settings manager initialized with in-memory storage`;
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
