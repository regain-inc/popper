/**
 * Popper Server Entry Point
 * HTTP server with graceful shutdown, structured logging, and observability
 * @module index
 */

import { resolve } from 'node:path';
import {
  ApiKeyCache,
  BaselineCache,
  CooldownTracker,
  DriftCounters,
  IdempotencyCache,
  InMemoryApiKeyCache,
  InMemoryBaselineCache,
  InMemoryDriftCounters,
  InMemoryIdempotencyCache,
  InMemoryRateLimitCache,
  InMemorySignalAggregator,
  RateLimitCache,
  SignalAggregator,
} from '@popper/cache';
import type { SupervisionResponse } from '@popper/core';
import {
  AuditEmitter,
  BaselineCalculator,
  ControlHttpClient,
  InMemoryCooldownTracker as CoreInMemoryCooldownTracker,
  createPolicyLifecycleEvent,
  DeadLetterQueue,
  DeliveryManager,
  DesiredStateManager,
  DriftTriggers,
  DriftTriggersManager,
  ExportBundleGenerator,
  getDefaultEmitter,
  InMemoryExportBundleStorage,
  InMemoryPolicyPackCache,
  InMemorySafeModeStateStore,
  InMemorySettingsCache,
  loadTargetsFromEnv,
  type PolicyLifecycleEvent,
  PolicyLifecycleManager,
  policyRegistry,
  RedisPolicyPackCache,
  RedisSafeModeStateStore,
  RedisSettingsCache,
  RLHFFeedbackAggregator,
  SafeModeManager,
  SettingsManager,
  setDefaultEmitter,
} from '@popper/core';
import {
  ApiKeyService,
  createDB,
  DrizzleAuditEventExportReader,
  DrizzleAuditEventReader,
  DrizzleAuditStorage,
  DrizzleDailyAggregateReader,
  DrizzleDriftBaselineStorage,
  DrizzleExportBundlesStorage,
  DrizzleIncidentExportReader,
  DrizzleIncidentsStorage,
  DrizzleOperationalSettingsStorage,
  DrizzlePolicyPackStorage,
  DrizzleRlhfBundlesStorage,
  DrizzleSafeModeHistoryStorage,
  OrganizationService,
  S3ExportBundleStorage,
} from '@popper/db';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import postgres from 'postgres';
import { createApp } from './app';
import { env } from './config/env';
import { initApiKeyService, setApiKeyCache } from './lib/api-keys';
import { setAuditReader } from './lib/audit-reader';
import { setBaselineCalculator } from './lib/baselines';
import { setDeliveryManager } from './lib/delivery-manager';
import { setDesiredStateManager } from './lib/desired-state';
import { setDriftCounters } from './lib/drift';
import { setExportGenerator } from './lib/export';
import { setIdempotencyCache } from './lib/idempotency';
import { setIncidentsStore } from './lib/incidents';
import { logger, setupLogger, shutdownLogger } from './lib/logger';
import { initOrganizationService } from './lib/organizations';
import { setPolicyLifecycleManager } from './lib/policy-lifecycle';
import { PolicyPackStoreAdapter } from './lib/policy-pack-store-adapter';
import { QueueAuditStorage } from './lib/queue-audit-storage';
import { setRateLimitCache } from './lib/rate-limit';
import { setRlhfAggregator } from './lib/rlhf';
import { setSafeModeManager } from './lib/safe-mode';
import { setSettingsManager } from './lib/settings';
import { setSignalAggregator } from './lib/signal-aggregator';
import { setDriftTriggersManager } from './lib/triggers';
import { setDeadLetterDeps } from './plugins/dead-letters';
import { setReady } from './plugins/health';

/** Audit events queue name */
const AUDIT_QUEUE_NAME = 'audit-events';

// Track shutdown state
let isShuttingDown = false;

/**
 * Test database connection at startup
 * Exits with code 1 if unreachable
 */
async function testDatabaseConnection(connectionString: string): Promise<void> {
  const sql = postgres(connectionString, { max: 1, connect_timeout: 5 });
  try {
    await sql`SELECT 1`;
    await sql.end();
  } catch (error) {
    await sql.end().catch(() => {});
    logger.fatal`Database connection failed: ${error}`;
    logger.fatal`Check DATABASE_URL and ensure PostgreSQL is running.`;
    process.exit(1);
  }
}

/**
 * Create export file storage: S3/MinIO if configured, in-memory fallback
 */
function createExportFileStorage() {
  if (env.S3_ENDPOINT && env.S3_ACCESS_KEY && env.S3_SECRET_KEY) {
    return new S3ExportBundleStorage({
      endpoint: env.S3_ENDPOINT,
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
      bucket: env.S3_BUCKET,
      region: env.S3_REGION,
    });
  }
  return new InMemoryExportBundleStorage();
}

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

  // Verify database connection before proceeding
  await testDatabaseConnection(env.DATABASE_URL);
  logger.info`Database connection verified`;

  // Initialize audit storage, idempotency cache, and safe-mode manager
  // Priority: Redis + PostgreSQL > Direct PostgreSQL
  if (env.REDIS_URL) {
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

    // Drift counters via Redis
    const driftRedis = new IORedis(env.REDIS_URL);
    setDriftCounters(new DriftCounters(driftRedis));
    logger.info`Drift counters initialized with Redis`;

    // Settings manager: PostgreSQL for storage, Redis for cache
    const settingsRedis = new IORedis(env.REDIS_URL);
    const settingsManager = new SettingsManager({
      store: new DrizzleOperationalSettingsStorage(db),
      cache: new RedisSettingsCache(settingsRedis),
    });
    setSettingsManager(settingsManager);
    logger.info`Settings manager initialized with PostgreSQL + Redis cache`;

    // Baseline calculator: PostgreSQL for storage, Redis for cache
    const baselineStore = new DrizzleDriftBaselineStorage(db);
    const aggregateReader = new DrizzleDailyAggregateReader(db);
    const baselineCacheRedis = new IORedis(env.REDIS_URL);
    const baselineCalculator = new BaselineCalculator({
      store: baselineStore,
      aggregateReader,
      cache: new BaselineCache(baselineCacheRedis),
    });
    setBaselineCalculator(baselineCalculator);
    logger.info`Baseline calculator initialized with PostgreSQL + Redis cache`;

    // Incidents store: PostgreSQL
    const incidentsStore = new DrizzleIncidentsStorage(db);
    setIncidentsStore(incidentsStore);
    logger.info`Incidents store initialized with PostgreSQL`;

    // Drift triggers manager: Redis for cooldowns, PostgreSQL for incidents
    const cooldownRedis = new IORedis(env.REDIS_URL);
    const driftTriggersManager = new DriftTriggersManager({
      triggers: new DriftTriggers({ cooldownTracker: new CooldownTracker(cooldownRedis) }),
      baselineCalculator,
      driftCounters: new DriftCounters(driftRedis),
      safeModeManager,
      incidentsStore,
      cooldownTracker: new CooldownTracker(cooldownRedis),
      logger: {
        info: (msg: string) => logger.info`${msg}`,
        warn: (msg: string) => logger.warning`${msg}`,
        error: (msg: string) => logger.error`${msg}`,
      },
    });
    setDriftTriggersManager(driftTriggersManager);
    logger.info`Drift triggers manager initialized with Redis + PostgreSQL`;

    // Signal aggregator: Redis-backed sliding window for reconfigure policies
    const signalRedis = new IORedis(env.REDIS_URL);
    setSignalAggregator(new SignalAggregator(signalRedis));
    logger.info`Signal aggregator initialized with Redis`;

    // Desired-state manager: PostgreSQL for per-instance desired state
    const desiredStateManager = new DesiredStateManager(db);
    setDesiredStateManager(desiredStateManager);
    logger.info`Desired-state manager initialized with PostgreSQL`;

    // Push delivery: HTTP client, DLQ, delivery manager, target registration
    const httpClient = new ControlHttpClient();
    const deadLetterQueue = new DeadLetterQueue(db);
    const deliveryManager = new DeliveryManager(httpClient, deadLetterQueue, desiredStateManager, {
      serviceVersion: '1.0.0',
      reconciliationIntervalMs: env.RECONCILIATION_INTERVAL_MS,
      idleReconciliationIntervalMs: env.IDLE_RECONCILIATION_INTERVAL_MS,
    });
    setDeliveryManager(deliveryManager);
    setDeadLetterDeps(deadLetterQueue, deliveryManager);

    // Register targets from env
    const targets = loadTargetsFromEnv();
    for (const target of targets) {
      deliveryManager.registerTarget(target);
      deliveryManager.startReconciliationLoop(target.instance_id, target.organization_id);
      logger.info`Registered push target: ${target.instance_id}:${target.organization_id}`;
    }
    if (targets.length > 0) {
      deliveryManager.startupReconciliation().catch((err) => {
        logger.warning`Startup reconciliation failed: ${err}`;
      });
    }
    logger.info`Push delivery initialized with ${targets.length} target(s)`;

    // Audit event reader (shared between RLHF aggregator and dashboard)
    const auditReader = new DrizzleAuditEventReader(db);
    setAuditReader(auditReader);
    logger.info`Audit reader initialized with PostgreSQL`;

    // RLHF Feedback Aggregator: PostgreSQL for bundles storage + audit event reader
    const rlhfBundlesStorage = new DrizzleRlhfBundlesStorage(db);
    const rlhfAggregator = new RLHFFeedbackAggregator({
      bundleStore: rlhfBundlesStorage,
      auditReader,
    });
    setRlhfAggregator(rlhfAggregator);
    logger.info`RLHF aggregator initialized with PostgreSQL (continuous aggregate + hypertable)`;

    // Export Bundle Generator: PostgreSQL for metadata + readers, S3/MinIO for file storage
    const exportBundlesStorage = new DrizzleExportBundlesStorage(db);
    const exportFileStorage = createExportFileStorage();
    const exportGenerator = new ExportBundleGenerator({
      storage: exportFileStorage,
      store: exportBundlesStorage,
      auditReader: new DrizzleAuditEventExportReader(db),
      incidentReader: new DrizzleIncidentExportReader(db),
    });
    setExportGenerator(exportGenerator);
    logger.info`Export generator initialized with PostgreSQL + ${env.S3_ENDPOINT ? 'S3/MinIO' : 'in-memory'} storage`;

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
  } else {
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

    // Drift counters: in-memory (Redis recommended for production)
    setDriftCounters(new InMemoryDriftCounters());
    logger.warning`Using in-memory drift counters. Set REDIS_URL for distributed drift tracking.`;

    // Settings manager: PostgreSQL for storage, in-memory cache
    const settingsManager = new SettingsManager({
      store: new DrizzleOperationalSettingsStorage(db),
      cache: new InMemorySettingsCache(),
    });
    setSettingsManager(settingsManager);
    logger.info`Settings manager initialized with PostgreSQL (in-memory cache)`;

    // Baseline calculator: PostgreSQL for storage, in-memory cache
    const baselineStore = new DrizzleDriftBaselineStorage(db);
    const aggregateReader = new DrizzleDailyAggregateReader(db);
    const baselineCalculator = new BaselineCalculator({
      store: baselineStore,
      aggregateReader,
      cache: new InMemoryBaselineCache(),
    });
    setBaselineCalculator(baselineCalculator);
    logger.info`Baseline calculator initialized with PostgreSQL (in-memory cache)`;

    // Incidents store: PostgreSQL
    const incidentsStore = new DrizzleIncidentsStorage(db);
    setIncidentsStore(incidentsStore);
    logger.info`Incidents store initialized with PostgreSQL`;

    // Drift triggers manager: in-memory cooldowns, PostgreSQL for incidents
    const driftTriggersManager = new DriftTriggersManager({
      triggers: new DriftTriggers({ cooldownTracker: new CoreInMemoryCooldownTracker() }),
      baselineCalculator,
      driftCounters: new InMemoryDriftCounters(),
      safeModeManager,
      incidentsStore,
      cooldownTracker: new CoreInMemoryCooldownTracker(),
      logger: {
        info: (msg: string) => logger.info`${msg}`,
        warn: (msg: string) => logger.warning`${msg}`,
        error: (msg: string) => logger.error`${msg}`,
      },
    });
    setDriftTriggersManager(driftTriggersManager);
    logger.info`Drift triggers manager initialized with PostgreSQL (in-memory cooldowns)`;

    // Signal aggregator: in-memory for dev/test
    setSignalAggregator(new InMemorySignalAggregator());
    logger.warning`Using in-memory signal aggregator. Set REDIS_URL for production.`;

    // Desired-state manager: PostgreSQL for per-instance desired state
    const desiredStateManager = new DesiredStateManager(db);
    setDesiredStateManager(desiredStateManager);
    logger.info`Desired-state manager initialized with PostgreSQL`;

    // Push delivery: HTTP client, DLQ, delivery manager, target registration
    const httpClient = new ControlHttpClient();
    const deadLetterQueue = new DeadLetterQueue(db);
    const deliveryManager = new DeliveryManager(httpClient, deadLetterQueue, desiredStateManager, {
      serviceVersion: '1.0.0',
      reconciliationIntervalMs: env.RECONCILIATION_INTERVAL_MS,
      idleReconciliationIntervalMs: env.IDLE_RECONCILIATION_INTERVAL_MS,
    });
    setDeliveryManager(deliveryManager);
    setDeadLetterDeps(deadLetterQueue, deliveryManager);

    // Register targets from env
    const targets = loadTargetsFromEnv();
    for (const target of targets) {
      deliveryManager.registerTarget(target);
      deliveryManager.startReconciliationLoop(target.instance_id, target.organization_id);
      logger.info`Registered push target: ${target.instance_id}:${target.organization_id}`;
    }
    if (targets.length > 0) {
      deliveryManager.startupReconciliation().catch((err) => {
        logger.warning`Startup reconciliation failed: ${err}`;
      });
    }
    logger.info`Push delivery initialized with ${targets.length} target(s)`;

    // Audit event reader (shared between RLHF aggregator and dashboard)
    const auditReader = new DrizzleAuditEventReader(db);
    setAuditReader(auditReader);
    logger.info`Audit reader initialized with PostgreSQL`;

    // RLHF Feedback Aggregator: PostgreSQL for bundles storage + audit event reader
    const rlhfBundlesStorage = new DrizzleRlhfBundlesStorage(db);
    const rlhfAggregator = new RLHFFeedbackAggregator({
      bundleStore: rlhfBundlesStorage,
      auditReader,
    });
    setRlhfAggregator(rlhfAggregator);
    logger.info`RLHF aggregator initialized with PostgreSQL (continuous aggregate + hypertable)`;

    // Export Bundle Generator: PostgreSQL for metadata + readers, S3/MinIO for file storage
    const exportBundlesStorage = new DrizzleExportBundlesStorage(db);
    const exportFileStorage = createExportFileStorage();
    const exportGenerator = new ExportBundleGenerator({
      storage: exportFileStorage,
      store: exportBundlesStorage,
      auditReader: new DrizzleAuditEventExportReader(db),
      incidentReader: new DrizzleIncidentExportReader(db),
    });
    setExportGenerator(exportGenerator);
    logger.info`Export generator initialized with PostgreSQL + ${env.S3_ENDPOINT ? 'S3/MinIO' : 'in-memory'} storage`;

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

      // Shut down delivery manager (stop reconciliation loops)
      try {
        const { isDeliveryManagerInitialized, getDeliveryManager } = await import(
          './lib/delivery-manager'
        );
        if (isDeliveryManagerInitialized()) {
          getDeliveryManager().shutdown();
          logger.info`Delivery manager shut down`;
        }
      } catch {
        /* non-fatal */
      }

      // Stop the server
      logger.info`Stopping server...`;
      server.stop(true); // true = wait for pending requests

      // Flush Loki sink before exit
      await shutdownLogger();

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
