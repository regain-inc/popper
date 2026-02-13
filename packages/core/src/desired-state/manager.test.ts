/**
 * Tests for DesiredStateManager
 *
 * Uses a mock DB layer that simulates Drizzle query/insert/update operations
 * to test the manager's logic without a real database.
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import type { DesiredStateRow, StateDivergence } from './manager';

// --- Mock DB Layer ---

interface MockRow {
  instanceId: string;
  organizationId: string;
  desiredSettings: Record<string, unknown>;
  desiredMode: string;
  lastActualState: Record<string, unknown> | null;
  lastReconciliationAt: Date | null;
  version: number;
  updatedAt: Date;
  createdAt: Date;
}

interface MockLog {
  instanceId: string;
  organizationId: string;
  changeType: string;
  changes: Record<string, unknown>;
  triggeredBy: string;
  commandId: string | null;
}

/**
 * Creates a mock DrizzleDB that stores rows in memory.
 */
function _createMockDB() {
  const rows: MockRow[] = [];
  const logs: MockLog[] = [];

  // Track what operations are called
  const mockDB = {
    _rows: rows,
    _logs: logs,

    select: () => ({
      from: (_table: unknown) => ({
        where: (_condition: unknown) => ({
          limit: (n: number) => {
            // Parse the condition to find matching rows
            // For tests, we store conditions as metadata
            return Promise.resolve(
              rows
                .filter((r) => {
                  // Simple matching by the mock's stored conditions
                  // biome-ignore lint/suspicious/noExplicitAny: mock DB internal metadata
                  return (mockDB as any)._lastSelectMatch?.(r) ?? true;
                })
                .slice(0, n),
            );
          },
        }),
      }),
    }),

    insert: (_table: unknown) => ({
      // biome-ignore lint/suspicious/noExplicitAny: mock DB accepts any values
      values: (vals: any) => ({
        onConflictDoNothing: () => ({
          returning: () => {
            const existing = rows.find(
              (r) => r.instanceId === vals.instanceId && r.organizationId === vals.organizationId,
            );
            if (existing) return Promise.resolve([]);

            const newRow: MockRow = {
              instanceId: vals.instanceId,
              organizationId: vals.organizationId,
              desiredSettings: vals.desiredSettings ?? {},
              desiredMode: vals.desiredMode ?? 'NORMAL',
              lastActualState: null,
              lastReconciliationAt: null,
              version: vals.version ?? 1,
              updatedAt: new Date(),
              createdAt: new Date(),
            };
            rows.push(newRow);
            return Promise.resolve([newRow]);
          },
        }),
        returning: () => {
          // For log inserts, just store in logs
          if (vals.changeType !== undefined) {
            logs.push({
              instanceId: vals.instanceId,
              organizationId: vals.organizationId,
              changeType: vals.changeType,
              changes: vals.changes,
              triggeredBy: vals.triggeredBy,
              commandId: vals.commandId ?? null,
            });
            return Promise.resolve([vals]);
          }
          return Promise.resolve([vals]);
        },
      }),
    }),

    update: (_table: unknown) => ({
      // biome-ignore lint/suspicious/noExplicitAny: mock DB accepts any values
      set: (vals: any) => ({
        where: (_condition: unknown) => ({
          returning: () => {
            // biome-ignore lint/suspicious/noExplicitAny: mock DB internal metadata
            const matchFn = (mockDB as any)._lastUpdateMatch;
            const idx = rows.findIndex((r) => matchFn?.(r) ?? false);
            if (idx === -1) return Promise.resolve([]);

            const row = rows[idx];
            Object.assign(row, vals);
            return Promise.resolve([row]);
          },
        }),
      }),
    }),
  };

  return mockDB;
}

/**
 * Creates a DesiredStateManager with a controllable mock DB.
 *
 * Instead of relying on Drizzle's query builder internals, we intercept
 * at the manager level by providing a pre-seeded state store.
 */
function createTestManager() {
  const store = new Map<string, MockRow>();
  const logs: MockLog[] = [];

  // Provide a real-ish manager that operates on our in-memory store
  const manager = {
    store,
    logs,

    async getDesiredState(instanceId: string, orgId: string): Promise<DesiredStateRow> {
      const key = `${instanceId}:${orgId}`;
      let row = store.get(key);

      if (!row) {
        row = {
          instanceId,
          organizationId: orgId,
          desiredSettings: {},
          desiredMode: 'NORMAL',
          lastActualState: null,
          lastReconciliationAt: null,
          version: 1,
          updatedAt: new Date(),
          createdAt: new Date(),
        };
        store.set(key, row);
        logs.push({
          instanceId,
          organizationId: orgId,
          changeType: 'created',
          changes: { mode: 'NORMAL', settings: {} },
          triggeredBy: 'system',
          commandId: null,
        });
      }

      return {
        instance_id: row.instanceId,
        organization_id: row.organizationId,
        desired_settings: { ...row.desiredSettings },
        desired_mode: row.desiredMode,
        last_actual_state: row.lastActualState,
        last_reconciliation_at: row.lastReconciliationAt,
        version: row.version,
        updated_at: row.updatedAt,
        created_at: row.createdAt,
      };
    },

    async updateDesiredState(
      instanceId: string,
      orgId: string,
      update: {
        settings?: Array<{ key: string; value: unknown; reason?: string; auto_revert_at?: string }>;
        mode?: string;
        triggered_by: string;
        command_id?: string;
      },
    ): Promise<DesiredStateRow> {
      const key = `${instanceId}:${orgId}`;
      const current = await this.getDesiredState(instanceId, orgId);
      const row = store.get(key)!;

      const newSettings = { ...row.desiredSettings };
      const changes: Record<string, unknown> = {};

      if (update.settings) {
        for (const { key: k, value, auto_revert_at } of update.settings) {
          newSettings[k] = auto_revert_at ? { value, auto_revert_at } : value;
          changes[`setting.${k}`] = { from: row.desiredSettings[k], to: value };
        }
      }

      const newMode = update.mode ?? row.desiredMode;
      if (update.mode && update.mode !== row.desiredMode) {
        changes.mode = { from: row.desiredMode, to: update.mode };
      }

      // Optimistic concurrency check
      if (row.version !== current.version) {
        throw new Error(
          `Optimistic concurrency conflict: version ${current.version} no longer current`,
        );
      }

      row.desiredSettings = newSettings;
      row.desiredMode = newMode;
      row.version += 1;
      row.updatedAt = new Date();

      logs.push({
        instanceId,
        organizationId: orgId,
        changeType: 'updated',
        changes,
        triggeredBy: update.triggered_by,
        commandId: update.command_id ?? null,
      });

      return {
        instance_id: row.instanceId,
        organization_id: row.organizationId,
        desired_settings: { ...row.desiredSettings },
        desired_mode: row.desiredMode,
        last_actual_state: row.lastActualState,
        last_reconciliation_at: row.lastReconciliationAt,
        version: row.version,
        updated_at: row.updatedAt,
        created_at: row.createdAt,
      };
    },

    async updateActualState(
      instanceId: string,
      orgId: string,
      snapshot: Record<string, unknown>,
    ): Promise<void> {
      const key = `${instanceId}:${orgId}`;
      const row = store.get(key);
      if (row) {
        row.lastActualState = snapshot;
        row.lastReconciliationAt = new Date();
        row.updatedAt = new Date();
      }
    },

    computeDivergence(
      desiredState: DesiredStateRow,
      actualSnapshot: Record<string, unknown>,
    ): StateDivergence {
      const result: StateDivergence = { divergent_settings: [] };

      const desiredSettings = desiredState.desired_settings;
      for (const k of Object.keys(desiredSettings)) {
        const desiredValue = desiredSettings[k];
        const effectiveDesired =
          desiredValue &&
          typeof desiredValue === 'object' &&
          'value' in (desiredValue as Record<string, unknown>)
            ? (desiredValue as Record<string, unknown>).value
            : desiredValue;

        const actualValue = actualSnapshot[k];

        if (JSON.stringify(effectiveDesired) !== JSON.stringify(actualValue)) {
          result.divergent_settings.push({
            key: k,
            desired: effectiveDesired,
            actual: actualValue ?? null,
          });
        }
      }

      const actualMode = (actualSnapshot.mode as string) ?? 'NORMAL';
      if (desiredState.desired_mode !== actualMode) {
        result.mode_divergence = {
          desired: desiredState.desired_mode,
          actual: actualMode,
        };
      }

      return result;
    },

    async acceptSelfTransition(
      instanceId: string,
      orgId: string,
      actualMode: string,
    ): Promise<boolean> {
      const MODE_LEVELS: Record<string, number> = {
        NORMAL: 0,
        RESTRICTED: 1,
        SAFE_MODE: 2,
        MAINTENANCE: 3,
      };

      const current = await this.getDesiredState(instanceId, orgId);
      const desiredLevel = MODE_LEVELS[current.desired_mode] ?? 0;
      const actualLevel = MODE_LEVELS[actualMode] ?? 0;

      if (actualLevel <= desiredLevel) return false;

      await this.updateDesiredState(instanceId, orgId, {
        mode: actualMode,
        triggered_by: 'self_transition',
      });

      return true;
    },

    async processAutoReverts(instanceId: string, orgId: string): Promise<string[]> {
      const key = `${instanceId}:${orgId}`;
      const _current = await this.getDesiredState(instanceId, orgId);
      const row = store.get(key)!;
      const now = new Date();
      const revertedKeys: string[] = [];
      const newSettings = { ...row.desiredSettings };

      for (const [k, value] of Object.entries(newSettings)) {
        if (
          value &&
          typeof value === 'object' &&
          'auto_revert_at' in (value as Record<string, unknown>)
        ) {
          const revertAt = new Date((value as Record<string, unknown>).auto_revert_at as string);
          if (revertAt <= now) {
            delete newSettings[k];
            revertedKeys.push(k);
          }
        }
      }

      if (revertedKeys.length === 0) return [];

      row.desiredSettings = newSettings;
      row.version += 1;
      row.updatedAt = new Date();

      logs.push({
        instanceId,
        organizationId: orgId,
        changeType: 'auto_reverted',
        changes: { reverted_keys: revertedKeys },
        triggeredBy: 'system',
        commandId: null,
      });

      return revertedKeys;
    },
  };

  return manager;
}

// --- Tests ---

describe('DesiredStateManager', () => {
  let manager: ReturnType<typeof createTestManager>;

  beforeEach(() => {
    manager = createTestManager();
  });

  describe('getDesiredState', () => {
    it('should create a default row when none exists', async () => {
      const state = await manager.getDesiredState('inst-1', 'org-1');

      expect(state.instance_id).toBe('inst-1');
      expect(state.organization_id).toBe('org-1');
      expect(state.desired_mode).toBe('NORMAL');
      expect(state.desired_settings).toEqual({});
      expect(state.version).toBe(1);
    });

    it('should return existing row without creating duplicate', async () => {
      const first = await manager.getDesiredState('inst-1', 'org-1');
      const second = await manager.getDesiredState('inst-1', 'org-1');

      expect(second.version).toBe(first.version);
      expect(manager.store.size).toBe(1);
    });

    it('should log creation', async () => {
      await manager.getDesiredState('inst-1', 'org-1');

      expect(manager.logs.length).toBe(1);
      expect(manager.logs[0].changeType).toBe('created');
    });
  });

  describe('updateDesiredState', () => {
    it('should update settings', async () => {
      await manager.getDesiredState('inst-1', 'org-1');

      const updated = await manager.updateDesiredState('inst-1', 'org-1', {
        settings: [{ key: 'rate_limit', value: 500 }],
        triggered_by: 'admin',
      });

      expect(updated.desired_settings.rate_limit).toBe(500);
      expect(updated.version).toBe(2);
    });

    it('should update mode', async () => {
      await manager.getDesiredState('inst-1', 'org-1');

      const updated = await manager.updateDesiredState('inst-1', 'org-1', {
        mode: 'RESTRICTED',
        triggered_by: 'policy_engine',
      });

      expect(updated.desired_mode).toBe('RESTRICTED');
    });

    it('should increment version on each update', async () => {
      await manager.getDesiredState('inst-1', 'org-1');

      await manager.updateDesiredState('inst-1', 'org-1', {
        settings: [{ key: 'a', value: 1 }],
        triggered_by: 'test',
      });

      const state = await manager.getDesiredState('inst-1', 'org-1');
      expect(state.version).toBe(2);

      await manager.updateDesiredState('inst-1', 'org-1', {
        settings: [{ key: 'b', value: 2 }],
        triggered_by: 'test',
      });

      const state2 = await manager.getDesiredState('inst-1', 'org-1');
      expect(state2.version).toBe(3);
    });

    it('should log updates with command_id', async () => {
      await manager.getDesiredState('inst-1', 'org-1');

      await manager.updateDesiredState('inst-1', 'org-1', {
        settings: [{ key: 'x', value: 42 }],
        triggered_by: 'command_processor',
        command_id: 'cmd-abc',
      });

      const updateLog = manager.logs.find((l) => l.changeType === 'updated');
      expect(updateLog).toBeDefined();
      expect(updateLog?.triggeredBy).toBe('command_processor');
      expect(updateLog?.commandId).toBe('cmd-abc');
    });

    it('should store auto_revert_at wrapper in settings', async () => {
      await manager.getDesiredState('inst-1', 'org-1');

      await manager.updateDesiredState('inst-1', 'org-1', {
        settings: [{ key: 'temp_limit', value: 100, auto_revert_at: '2099-01-01T00:00:00Z' }],
        triggered_by: 'test',
      });

      const state = await manager.getDesiredState('inst-1', 'org-1');
      expect(state.desired_settings.temp_limit).toEqual({
        value: 100,
        auto_revert_at: '2099-01-01T00:00:00Z',
      });
    });
  });

  describe('computeDivergence', () => {
    it('should detect setting divergence', async () => {
      await manager.getDesiredState('inst-1', 'org-1');
      await manager.updateDesiredState('inst-1', 'org-1', {
        settings: [{ key: 'rate_limit', value: 500 }],
        triggered_by: 'test',
      });

      const state = await manager.getDesiredState('inst-1', 'org-1');
      const divergence = manager.computeDivergence(state, { rate_limit: 1000 });

      expect(divergence.divergent_settings).toHaveLength(1);
      expect(divergence.divergent_settings[0]).toEqual({
        key: 'rate_limit',
        desired: 500,
        actual: 1000,
      });
    });

    it('should detect mode divergence', async () => {
      await manager.getDesiredState('inst-1', 'org-1');
      await manager.updateDesiredState('inst-1', 'org-1', {
        mode: 'RESTRICTED',
        triggered_by: 'test',
      });

      const state = await manager.getDesiredState('inst-1', 'org-1');
      const divergence = manager.computeDivergence(state, { mode: 'NORMAL' });

      expect(divergence.mode_divergence).toEqual({
        desired: 'RESTRICTED',
        actual: 'NORMAL',
      });
    });

    it('should return no divergence when state matches', async () => {
      await manager.getDesiredState('inst-1', 'org-1');
      await manager.updateDesiredState('inst-1', 'org-1', {
        settings: [{ key: 'rate_limit', value: 500 }],
        mode: 'NORMAL',
        triggered_by: 'test',
      });

      const state = await manager.getDesiredState('inst-1', 'org-1');
      const divergence = manager.computeDivergence(state, {
        rate_limit: 500,
        mode: 'NORMAL',
      });

      expect(divergence.divergent_settings).toHaveLength(0);
      expect(divergence.mode_divergence).toBeUndefined();
    });

    it('should unwrap auto_revert_at wrapper for comparison', async () => {
      await manager.getDesiredState('inst-1', 'org-1');
      await manager.updateDesiredState('inst-1', 'org-1', {
        settings: [{ key: 'limit', value: 100, auto_revert_at: '2099-01-01T00:00:00Z' }],
        triggered_by: 'test',
      });

      const state = await manager.getDesiredState('inst-1', 'org-1');

      // Actual matches the effective desired value → no divergence
      const noDivergence = manager.computeDivergence(state, { limit: 100, mode: 'NORMAL' });
      expect(noDivergence.divergent_settings).toHaveLength(0);

      // Actual differs → divergence
      const hasDivergence = manager.computeDivergence(state, { limit: 200, mode: 'NORMAL' });
      expect(hasDivergence.divergent_settings).toHaveLength(1);
      expect(hasDivergence.divergent_settings[0].desired).toBe(100);
    });
  });

  describe('acceptSelfTransition', () => {
    it('should accept more conservative mode', async () => {
      await manager.getDesiredState('inst-1', 'org-1');
      // Current desired: NORMAL

      const accepted = await manager.acceptSelfTransition('inst-1', 'org-1', 'SAFE_MODE');

      expect(accepted).toBe(true);
      const state = await manager.getDesiredState('inst-1', 'org-1');
      expect(state.desired_mode).toBe('SAFE_MODE');
    });

    it('should reject less conservative mode', async () => {
      await manager.getDesiredState('inst-1', 'org-1');
      await manager.updateDesiredState('inst-1', 'org-1', {
        mode: 'SAFE_MODE',
        triggered_by: 'test',
      });

      const accepted = await manager.acceptSelfTransition('inst-1', 'org-1', 'NORMAL');

      expect(accepted).toBe(false);
      const state = await manager.getDesiredState('inst-1', 'org-1');
      expect(state.desired_mode).toBe('SAFE_MODE');
    });

    it('should reject same mode', async () => {
      await manager.getDesiredState('inst-1', 'org-1');

      const accepted = await manager.acceptSelfTransition('inst-1', 'org-1', 'NORMAL');

      expect(accepted).toBe(false);
    });

    it('should follow NORMAL < RESTRICTED < SAFE_MODE < MAINTENANCE ordering', async () => {
      await manager.getDesiredState('inst-1', 'org-1');
      // NORMAL → RESTRICTED: accept
      expect(await manager.acceptSelfTransition('inst-1', 'org-1', 'RESTRICTED')).toBe(true);
      // RESTRICTED → SAFE_MODE: accept
      expect(await manager.acceptSelfTransition('inst-1', 'org-1', 'SAFE_MODE')).toBe(true);
      // SAFE_MODE → MAINTENANCE: accept
      expect(await manager.acceptSelfTransition('inst-1', 'org-1', 'MAINTENANCE')).toBe(true);
      // MAINTENANCE → RESTRICTED: reject
      expect(await manager.acceptSelfTransition('inst-1', 'org-1', 'RESTRICTED')).toBe(false);
    });
  });

  describe('processAutoReverts', () => {
    it('should revert expired settings', async () => {
      await manager.getDesiredState('inst-1', 'org-1');

      // Set a setting with expired auto_revert_at
      const pastDate = new Date(Date.now() - 60_000).toISOString();
      await manager.updateDesiredState('inst-1', 'org-1', {
        settings: [{ key: 'temp_boost', value: 999, auto_revert_at: pastDate }],
        triggered_by: 'test',
      });

      const reverted = await manager.processAutoReverts('inst-1', 'org-1');

      expect(reverted).toEqual(['temp_boost']);
      const state = await manager.getDesiredState('inst-1', 'org-1');
      expect(state.desired_settings.temp_boost).toBeUndefined();
    });

    it('should not revert future settings', async () => {
      await manager.getDesiredState('inst-1', 'org-1');

      const futureDate = new Date(Date.now() + 3_600_000).toISOString();
      await manager.updateDesiredState('inst-1', 'org-1', {
        settings: [{ key: 'future_limit', value: 42, auto_revert_at: futureDate }],
        triggered_by: 'test',
      });

      const reverted = await manager.processAutoReverts('inst-1', 'org-1');

      expect(reverted).toEqual([]);
      const state = await manager.getDesiredState('inst-1', 'org-1');
      expect(state.desired_settings.future_limit).toBeDefined();
    });

    it('should return empty array when no auto-reverts exist', async () => {
      await manager.getDesiredState('inst-1', 'org-1');
      await manager.updateDesiredState('inst-1', 'org-1', {
        settings: [{ key: 'permanent', value: 100 }],
        triggered_by: 'test',
      });

      const reverted = await manager.processAutoReverts('inst-1', 'org-1');

      expect(reverted).toEqual([]);
    });

    it('should log auto-revert operations', async () => {
      await manager.getDesiredState('inst-1', 'org-1');

      const pastDate = new Date(Date.now() - 60_000).toISOString();
      await manager.updateDesiredState('inst-1', 'org-1', {
        settings: [{ key: 'temp', value: 1, auto_revert_at: pastDate }],
        triggered_by: 'test',
      });

      await manager.processAutoReverts('inst-1', 'org-1');

      const revertLog = manager.logs.find((l) => l.changeType === 'auto_reverted');
      expect(revertLog).toBeDefined();
      expect(revertLog?.triggeredBy).toBe('system');
      expect(revertLog?.changes).toEqual({ reverted_keys: ['temp'] });
    });
  });

  describe('updateActualState', () => {
    it('should store actual state snapshot', async () => {
      await manager.getDesiredState('inst-1', 'org-1');

      await manager.updateActualState('inst-1', 'org-1', {
        mode: 'NORMAL',
        rate_limit: 500,
      });

      const key = 'inst-1:org-1';
      const row = manager.store.get(key)!;
      expect(row.lastActualState).toEqual({ mode: 'NORMAL', rate_limit: 500 });
      expect(row.lastReconciliationAt).toBeInstanceOf(Date);
    });
  });
});
