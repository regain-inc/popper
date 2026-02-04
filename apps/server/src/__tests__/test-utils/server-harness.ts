/**
 * Popper Test Server Harness (SAL-937 POP-R7)
 *
 * Provides utilities for starting a Popper test server with in-memory storage
 * for integration tests. No external dependencies (Redis/PostgreSQL) required
 * for basic functionality.
 *
 * Usage:
 * ```typescript
 * const { url, stop } = await startPopperTestServer();
 * // Run tests against url
 * await stop();
 * ```
 */

import { resolve } from 'node:path';
import {
  InMemoryApiKeyCache,
  InMemoryBaselineCache,
  InMemoryDriftCounters,
  InMemoryIdempotencyCache,
  InMemoryRateLimitCache,
} from '@popper/cache';
import type { SupervisionResponse } from '@popper/core';
import {
  AuditEmitter,
  BaselineCalculator,
  DriftTriggers,
  DriftTriggersManager,
  ExportBundleGenerator,
  InMemoryCooldownTracker,
  InMemoryExportBundleStorage,
  InMemoryPolicyPackCache,
  InMemorySafeModeStateStore,
  InMemorySettingsCache,
  PolicyLifecycleManager,
  policyRegistry,
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
} from '@popper/db';
import type { Server } from 'bun';
import { createApp } from '../../app';
import { initApiKeyService, setApiKeyCache } from '../../lib/api-keys';
import { setAuditReader } from '../../lib/audit-reader';
import { setBaselineCalculator } from '../../lib/baselines';
import { setDriftCounters } from '../../lib/drift';
import { setExportGenerator } from '../../lib/export';
import { setIdempotencyCache } from '../../lib/idempotency';
import { setIncidentsStore } from '../../lib/incidents';
import { initOrganizationService } from '../../lib/organizations';
import { setPolicyLifecycleManager } from '../../lib/policy-lifecycle';
import { PolicyPackStoreAdapter } from '../../lib/policy-pack-store-adapter';
import { setRateLimitCache } from '../../lib/rate-limit';
import { setRlhfAggregator } from '../../lib/rlhf';
import { setSafeModeManager } from '../../lib/safe-mode';
import { setSettingsManager } from '../../lib/settings';
import { setDriftTriggersManager } from '../../lib/triggers';

export interface PopperTestServerOptions {
  /** Port to listen on (default: random available port) */
  port?: number;
  /** Database URL (required) */
  databaseUrl: string;
  /** Policies directory (default: config/policies) */
  policiesDir?: string;
}

export interface PopperTestServer {
  /** Base URL of the test server */
  url: string;
  /** Port the server is listening on */
  port: number;
  /** Stop the test server */
  stop: () => Promise<void>;
}

/**
 * Start a Popper test server with in-memory storage
 *
 * Uses:
 * - In-memory caches (idempotency, API keys, rate limiting, baselines, settings)
 * - PostgreSQL for persistent storage (audit events, incidents, etc.)
 * - No Redis required
 * - Loads policy packs from config/policies/
 *
 * @param options - Server configuration options
 * @returns Server instance with URL and stop function
 */
export async function startPopperTestServer(
  options: PopperTestServerOptions,
): Promise<PopperTestServer> {
  const { port = 0, databaseUrl, policiesDir: customPoliciesDir } = options;

  // Load policy packs
  const policiesDir =
    customPoliciesDir || resolve(import.meta.dir, '../../../../../config/policies');

  try {
    const count = await policyRegistry.loadFromDir(policiesDir);
    console.log(`[test-harness] Loaded ${count} policy pack(s) from ${policiesDir}`);
  } catch (error) {
    console.warn(`[test-harness] Failed to load policy packs: ${error}`);
  }

  // Initialize database connection
  const db = createDB(databaseUrl);

  // Initialize audit storage with direct PostgreSQL writes
  const auditStorage = new DrizzleAuditStorage(db);
  const auditEmitter = new AuditEmitter(auditStorage, {
    batchEnabled: true,
    batchSize: 100,
    batchFlushInterval: 1000,
    asyncWrites: true,
  });
  setDefaultEmitter(auditEmitter);

  // In-memory idempotency cache
  const idempotencyCache = new InMemoryIdempotencyCache<SupervisionResponse>();
  setIdempotencyCache(idempotencyCache);

  // Safe-mode manager: in-memory state + PostgreSQL history
  const safeModeManager = new SafeModeManager({
    stateStore: new InMemorySafeModeStateStore(),
    historyStore: new DrizzleSafeModeHistoryStorage(db),
  });
  setSafeModeManager(safeModeManager);

  // API key service: Database + in-memory cache
  const apiKeyCache = new InMemoryApiKeyCache();
  setApiKeyCache(apiKeyCache);
  const apiKeyService = new ApiKeyService(db);
  initApiKeyService(apiKeyService);

  // Organization service: Database
  const organizationService = new OrganizationService(db);
  initOrganizationService(organizationService);

  // Rate limit cache: in-memory
  setRateLimitCache(new InMemoryRateLimitCache());

  // Drift counters: in-memory
  setDriftCounters(new InMemoryDriftCounters());

  // Settings manager: PostgreSQL + in-memory cache
  const settingsManager = new SettingsManager({
    store: new DrizzleOperationalSettingsStorage(db),
    cache: new InMemorySettingsCache(),
  });
  setSettingsManager(settingsManager);

  // Baseline calculator: PostgreSQL + in-memory cache
  const baselineStore = new DrizzleDriftBaselineStorage(db);
  const aggregateReader = new DrizzleDailyAggregateReader(db);
  const baselineCalculator = new BaselineCalculator({
    store: baselineStore,
    aggregateReader,
    cache: new InMemoryBaselineCache(),
  });
  setBaselineCalculator(baselineCalculator);

  // Incidents store: PostgreSQL
  const incidentsStore = new DrizzleIncidentsStorage(db);
  setIncidentsStore(incidentsStore);

  // Drift triggers manager: in-memory cooldowns + PostgreSQL for incidents
  const driftTriggersManager = new DriftTriggersManager({
    triggers: new DriftTriggers({ cooldownTracker: new InMemoryCooldownTracker() }),
    baselineCalculator,
    driftCounters: new InMemoryDriftCounters(),
    safeModeManager,
    incidentsStore,
    cooldownTracker: new InMemoryCooldownTracker(),
    logger: {
      info: (msg: string) => console.log(`[drift-triggers] ${msg}`),
      warn: (msg: string) => console.warn(`[drift-triggers] ${msg}`),
      error: (msg: string) => console.error(`[drift-triggers] ${msg}`),
    },
  });
  setDriftTriggersManager(driftTriggersManager);

  // Audit event reader
  const auditReader = new DrizzleAuditEventReader(db);
  setAuditReader(auditReader);

  // RLHF Feedback Aggregator: PostgreSQL
  const rlhfBundlesStorage = new DrizzleRlhfBundlesStorage(db);
  const rlhfAggregator = new RLHFFeedbackAggregator({
    bundleStore: rlhfBundlesStorage,
    auditReader,
  });
  setRlhfAggregator(rlhfAggregator);

  // Export Bundle Generator: in-memory file storage + PostgreSQL metadata
  const exportBundlesStorage = new DrizzleExportBundlesStorage(db);
  const exportFileStorage = new InMemoryExportBundleStorage();
  const exportGenerator = new ExportBundleGenerator({
    storage: exportFileStorage,
    store: exportBundlesStorage,
    auditReader: new DrizzleAuditEventExportReader(db),
    incidentReader: new DrizzleIncidentExportReader(db),
  });
  setExportGenerator(exportGenerator);

  // Policy lifecycle manager: PostgreSQL + in-memory cache
  const policyPackStorage = new DrizzlePolicyPackStorage(db);
  const policyLifecycleManager = new PolicyLifecycleManager({
    store: new PolicyPackStoreAdapter(policyPackStorage),
    cache: new InMemoryPolicyPackCache(),
    onPolicyActivated: (pack) => {
      policyRegistry.register(pack.content, true);
      console.log(
        `[test-harness] Policy ${pack.policy_id} v${pack.version} activated and registered`,
      );
    },
    onLifecycleEvent: (event) => {
      console.log(`[test-harness] Policy lifecycle event: ${event.event_type}`);
    },
  });
  setPolicyLifecycleManager(policyLifecycleManager);

  // Load active policies from database
  try {
    const activePolicies = await policyLifecycleManager.list({ state: 'ACTIVE' });
    for (const pack of activePolicies) {
      policyRegistry.register(pack.content, true);
    }
    if (activePolicies.length > 0) {
      console.log(`[test-harness] Registered ${activePolicies.length} active policy pack(s)`);
    }
  } catch (err) {
    console.warn(`[test-harness] Failed to load active policies: ${err}`);
  }

  // Create and start the application
  const app = createApp();

  const server: Server = app.listen({
    port,
    hostname: '127.0.0.1',
  });

  const actualPort = server.port;
  const baseUrl = `http://127.0.0.1:${actualPort}`;

  console.log(`[test-harness] Popper test server listening on ${baseUrl}`);

  return {
    url: baseUrl,
    port: actualPort,
    stop: async () => {
      console.log('[test-harness] Stopping Popper test server...');
      server.stop(true);
      // Flush any pending audit events
      await auditEmitter.flush();
      console.log('[test-harness] Popper test server stopped');
    },
  };
}
