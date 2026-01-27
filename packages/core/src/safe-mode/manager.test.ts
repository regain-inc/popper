import { beforeEach, describe, expect, it } from 'bun:test';
import { SafeModeManager } from './manager';
import { InMemorySafeModeHistoryStore, InMemorySafeModeStateStore } from './stores';
import { GLOBAL_ORG_ID } from './types';

describe('SafeModeManager', () => {
  let manager: SafeModeManager;
  let stateStore: InMemorySafeModeStateStore;
  let historyStore: InMemorySafeModeHistoryStore;

  beforeEach(() => {
    stateStore = new InMemorySafeModeStateStore();
    historyStore = new InMemorySafeModeHistoryStore();
    manager = new SafeModeManager({
      stateStore,
      historyStore,
    });
  });

  describe('getState', () => {
    it('should return null for unconfigured organization', async () => {
      const state = await manager.getState('org-123');
      expect(state).toBeNull();
    });

    it('should return state after it is set', async () => {
      await manager.enable('Test reason', { organization_id: 'org-123' });
      const state = await manager.getState('org-123');

      expect(state).not.toBeNull();
      expect(state?.enabled).toBe(true);
      expect(state?.reason).toBe('Test reason');
    });
  });

  describe('isEnabled', () => {
    it('should return false for unconfigured organization', async () => {
      const enabled = await manager.isEnabled('org-123');
      expect(enabled).toBe(false);
    });

    it('should return true after enabling', async () => {
      await manager.enable('Test', { organization_id: 'org-123' });
      const enabled = await manager.isEnabled('org-123');
      expect(enabled).toBe(true);
    });

    it('should return false after disabling', async () => {
      await manager.enable('Enable', { organization_id: 'org-123' });
      await manager.disable('Disable', { organization_id: 'org-123' });
      const enabled = await manager.isEnabled('org-123');
      expect(enabled).toBe(false);
    });
  });

  describe('snapshot', () => {
    it('should return default state for unconfigured organization', async () => {
      const snapshot = await manager.snapshot('org-123');

      expect(snapshot.enabled).toBe(false);
      expect(snapshot.organization_id).toBe('org-123');
      expect(snapshot.reason).toContain('Default');
    });

    it('should return current state as snapshot', async () => {
      await manager.enable('Drift breach detected', {
        organization_id: 'org-123',
        triggered_by: 'drift_breach',
      });

      const snapshot = await manager.snapshot('org-123');

      expect(snapshot.enabled).toBe(true);
      expect(snapshot.triggered_by).toBe('drift_breach');
    });
  });

  describe('enable', () => {
    it('should enable safe-mode with manual trigger by default', async () => {
      const state = await manager.enable('Manual activation', { organization_id: 'org-123' });

      expect(state.enabled).toBe(true);
      expect(state.triggered_by).toBe('manual');
      expect(state.reason).toBe('Manual activation');
    });

    it('should enable safe-mode with custom trigger', async () => {
      const state = await manager.enable('Metrics out of range', {
        organization_id: 'org-123',
        triggered_by: 'drift_breach',
      });

      expect(state.enabled).toBe(true);
      expect(state.triggered_by).toBe('drift_breach');
    });

    it('should record history entry', async () => {
      await manager.enable('Test', { organization_id: 'org-123' });

      const history = historyStore.getAll();
      expect(history).toHaveLength(1);
      expect(history[0].enabled).toBe(true);
      expect(history[0].organization_id).toBe('org-123');
    });

    it('should include actor_id when provided', async () => {
      const state = await manager.enable('Admin action', {
        organization_id: 'org-123',
        actor_id: 'user-456',
      });

      expect(state.actor_id).toBe('user-456');
    });

    it('should include incident_id when provided', async () => {
      const state = await manager.enable('Incident response', {
        organization_id: 'org-123',
        triggered_by: 'incident',
        incident_id: 'incident-789',
      });

      expect(state.incident_id).toBe('incident-789');
      expect(state.triggered_by).toBe('incident');
    });
  });

  describe('disable', () => {
    it('should disable safe-mode', async () => {
      await manager.enable('Enable first', { organization_id: 'org-123' });
      const state = await manager.disable('All clear', { organization_id: 'org-123' });

      expect(state.enabled).toBe(false);
      expect(state.triggered_by).toBe('manual');
      expect(state.reason).toBe('All clear');
    });

    it('should record history entry', async () => {
      await manager.enable('Enable', { organization_id: 'org-123' });
      await manager.disable('Disable', { organization_id: 'org-123' });

      const history = historyStore.getAll();
      expect(history).toHaveLength(2);
      expect(history[0].enabled).toBe(true);
      expect(history[1].enabled).toBe(false);
    });
  });

  describe('setState', () => {
    it('should set state with custom effective_at', async () => {
      const futureTime = new Date(Date.now() + 60000).toISOString();

      const state = await manager.setState({
        enabled: true,
        reason: 'Scheduled activation',
        triggered_by: 'manual',
        organization_id: 'org-123',
        effective_at: futureTime,
      });

      expect(state.effective_at).toBe(futureTime);
    });
  });

  describe('getHistory', () => {
    it('should return empty array for no history', async () => {
      const history = await manager.getHistory('org-123');
      expect(history).toEqual([]);
    });

    it('should return history in reverse chronological order', async () => {
      await manager.enable('First', { organization_id: 'org-123' });
      await manager.disable('Second', { organization_id: 'org-123' });
      await manager.enable('Third', { organization_id: 'org-123' });

      const history = await manager.getHistory('org-123');

      expect(history).toHaveLength(3);
      expect(history[0].reason).toBe('Third');
      expect(history[1].reason).toBe('Second');
      expect(history[2].reason).toBe('First');
    });

    it('should isolate history by organization', async () => {
      await manager.enable('Org 1', { organization_id: 'org-1' });
      await manager.enable('Org 2', { organization_id: 'org-2' });

      const history1 = await manager.getHistory('org-1');
      const history2 = await manager.getHistory('org-2');

      expect(history1).toHaveLength(1);
      expect(history1[0].reason).toBe('Org 1');
      expect(history2).toHaveLength(1);
      expect(history2[0].reason).toBe('Org 2');
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await manager.enable(`Entry ${i}`, { organization_id: 'org-123' });
      }

      const history = await manager.getHistory('org-123', 3);
      expect(history).toHaveLength(3);
    });
  });

  describe('global organization', () => {
    it('should use global org by default', async () => {
      const state = await manager.enable('Global safe-mode');

      expect(state.organization_id).toBe(GLOBAL_ORG_ID);
    });

    it('should check global state when no org specified', async () => {
      await manager.enable('Global');

      const enabled = await manager.isEnabled();
      expect(enabled).toBe(true);
    });
  });
});
