import { beforeEach, describe, expect, it } from 'bun:test';
import {
  InMemorySafeModeHistoryStore,
  InMemorySafeModeStateStore,
  SafeModeManager,
} from '@popper/core';
import { Elysia } from 'elysia';
import { setSafeModeManager } from '../lib/safe-mode';
import { controlPlugin } from './control';

// Test API key
const TEST_API_KEY = 'test-admin-key-12345';

describe('Control Plugin', () => {
  let app: Elysia;

  beforeEach(() => {
    // Reset environment
    process.env.POPPER_ADMIN_API_KEY = TEST_API_KEY;
    process.env.NODE_ENV = 'test';

    // Setup in-memory safe-mode manager
    const manager = new SafeModeManager({
      stateStore: new InMemorySafeModeStateStore(),
      historyStore: new InMemorySafeModeHistoryStore(),
    });
    setSafeModeManager(manager);

    // Create app with control plugin
    app = new Elysia().use(controlPlugin);
  });

  describe('Authentication', () => {
    it('should reject request without API key', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/popper/control/safe-mode'),
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('unauthorized');
    });

    it('should reject request with invalid API key', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/popper/control/safe-mode', {
          headers: { 'x-popper-admin-key': 'wrong-key' },
        }),
      );

      expect(response.status).toBe(401);
    });

    it('should accept request with valid API key', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/popper/control/safe-mode', {
          headers: { 'x-popper-admin-key': TEST_API_KEY },
        }),
      );

      expect(response.status).toBe(200);
    });
  });

  describe('GET /safe-mode', () => {
    it('should return default state for unconfigured org', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/popper/control/safe-mode', {
          headers: { 'x-popper-admin-key': TEST_API_KEY },
        }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.enabled).toBe(false);
      expect(body.organization_id).toBe('00000000-0000-0000-0000-000000000000');
    });

    it('should return state for specific organization', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/popper/control/safe-mode?organization_id=org-123', {
          headers: { 'x-popper-admin-key': TEST_API_KEY },
        }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.organization_id).toBe('org-123');
    });
  });

  describe('POST /safe-mode', () => {
    it('should enable safe-mode', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/popper/control/safe-mode', {
          method: 'POST',
          headers: {
            'x-popper-admin-key': TEST_API_KEY,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            enabled: true,
            reason: 'Drift threshold exceeded',
            triggered_by: 'drift_breach',
          }),
        }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.enabled).toBe(true);
      expect(body.reason).toBe('Drift threshold exceeded');
      expect(body.triggered_by).toBe('drift_breach');
      expect(body.organization_id).toBe('00000000-0000-0000-0000-000000000000');
    });

    it('should disable safe-mode', async () => {
      // First enable
      await app.handle(
        new Request('http://localhost/v1/popper/control/safe-mode', {
          method: 'POST',
          headers: {
            'x-popper-admin-key': TEST_API_KEY,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            enabled: true,
            reason: 'Enable first',
          }),
        }),
      );

      // Then disable
      const response = await app.handle(
        new Request('http://localhost/v1/popper/control/safe-mode', {
          method: 'POST',
          headers: {
            'x-popper-admin-key': TEST_API_KEY,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            enabled: false,
            reason: 'Issue resolved',
          }),
        }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.enabled).toBe(false);
      expect(body.reason).toBe('Issue resolved');
    });

    it('should accept organization_id', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/popper/control/safe-mode', {
          method: 'POST',
          headers: {
            'x-popper-admin-key': TEST_API_KEY,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            enabled: true,
            reason: 'Org-specific issue',
            organization_id: 'org-456',
          }),
        }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.organization_id).toBe('org-456');
    });

    it('should accept actor_id and incident_id', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/popper/control/safe-mode', {
          method: 'POST',
          headers: {
            'x-popper-admin-key': TEST_API_KEY,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            enabled: true,
            reason: 'Incident response',
            triggered_by: 'incident',
            actor_id: 'user-789',
            incident_id: 'incident-001',
          }),
        }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.actor_id).toBe('user-789');
      expect(body.incident_id).toBe('incident-001');
    });

    it('should validate required fields', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/popper/control/safe-mode', {
          method: 'POST',
          headers: {
            'x-popper-admin-key': TEST_API_KEY,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            enabled: true,
            // missing reason
          }),
        }),
      );

      expect(response.status).toBe(422);
    });
  });

  describe('GET /safe-mode/history', () => {
    it('should return empty history for new org', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/popper/control/safe-mode/history', {
          headers: { 'x-popper-admin-key': TEST_API_KEY },
        }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.organization_id).toBe('00000000-0000-0000-0000-000000000000');
      expect(body.entries).toEqual([]);
    });

    it('should return history after changes', async () => {
      // Make some changes
      await app.handle(
        new Request('http://localhost/v1/popper/control/safe-mode', {
          method: 'POST',
          headers: {
            'x-popper-admin-key': TEST_API_KEY,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ enabled: true, reason: 'First' }),
        }),
      );

      await app.handle(
        new Request('http://localhost/v1/popper/control/safe-mode', {
          method: 'POST',
          headers: {
            'x-popper-admin-key': TEST_API_KEY,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ enabled: false, reason: 'Second' }),
        }),
      );

      // Get history
      const response = await app.handle(
        new Request('http://localhost/v1/popper/control/safe-mode/history', {
          headers: { 'x-popper-admin-key': TEST_API_KEY },
        }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.entries).toHaveLength(2);
      // Most recent first
      expect(body.entries[0].reason).toBe('Second');
      expect(body.entries[1].reason).toBe('First');
    });

    it('should filter history by organization', async () => {
      // Change for org-1
      await app.handle(
        new Request('http://localhost/v1/popper/control/safe-mode', {
          method: 'POST',
          headers: {
            'x-popper-admin-key': TEST_API_KEY,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            enabled: true,
            reason: 'Org 1',
            organization_id: 'org-1',
          }),
        }),
      );

      // Change for org-2
      await app.handle(
        new Request('http://localhost/v1/popper/control/safe-mode', {
          method: 'POST',
          headers: {
            'x-popper-admin-key': TEST_API_KEY,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            enabled: true,
            reason: 'Org 2',
            organization_id: 'org-2',
          }),
        }),
      );

      // Get history for org-1
      const response = await app.handle(
        new Request('http://localhost/v1/popper/control/safe-mode/history?organization_id=org-1', {
          headers: { 'x-popper-admin-key': TEST_API_KEY },
        }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.organization_id).toBe('org-1');
      expect(body.entries).toHaveLength(1);
      expect(body.entries[0].reason).toBe('Org 1');
    });

    it('should respect limit parameter', async () => {
      // Make 5 changes
      for (let i = 0; i < 5; i++) {
        await app.handle(
          new Request('http://localhost/v1/popper/control/safe-mode', {
            method: 'POST',
            headers: {
              'x-popper-admin-key': TEST_API_KEY,
              'content-type': 'application/json',
            },
            body: JSON.stringify({ enabled: i % 2 === 0, reason: `Change ${i}` }),
          }),
        );
      }

      // Get history with limit
      const response = await app.handle(
        new Request('http://localhost/v1/popper/control/safe-mode/history?limit=3', {
          headers: { 'x-popper-admin-key': TEST_API_KEY },
        }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.entries).toHaveLength(3);
    });
  });

  describe('Development mode', () => {
    it('should allow access without API key in development', async () => {
      // Remove API key config
      delete process.env.POPPER_ADMIN_API_KEY;
      process.env.NODE_ENV = 'development';

      const response = await app.handle(
        new Request('http://localhost/v1/popper/control/safe-mode'),
      );

      expect(response.status).toBe(200);
    });
  });
});
