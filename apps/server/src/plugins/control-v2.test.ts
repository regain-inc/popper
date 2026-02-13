/**
 * Control Plane v2 endpoint tests
 *
 * Tests the v2 control API endpoints for desired-state management,
 * settings changes, mode transitions, and reconciliation.
 */

import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { Elysia } from 'elysia';
import { setDesiredStateManager } from '../lib/desired-state';
import { controlV2Plugin } from './control-v2';

// =============================================================================
// Mock Desired-State Manager
// =============================================================================

interface MockDesiredState {
  instance_id: string;
  organization_id: string;
  desired_settings: Record<string, unknown>;
  desired_mode: string;
  last_actual_state: Record<string, unknown> | null;
  last_reconciliation_at: string | null;
  version: number;
  updated_at: Date;
  created_at: Date;
}

const mockStates = new Map<string, MockDesiredState>();

function stateKey(instanceId: string, orgId: string) {
  return `${instanceId}:${orgId}`;
}

const now = new Date();

const mockManager = {
  getDesiredState: mock(async (instanceId: string, orgId: string) => {
    const key = stateKey(instanceId, orgId);
    if (!mockStates.has(key)) {
      const state: MockDesiredState = {
        instance_id: instanceId,
        organization_id: orgId,
        desired_settings: {},
        desired_mode: 'NORMAL',
        last_actual_state: null,
        last_reconciliation_at: null,
        version: 1,
        updated_at: now,
        created_at: now,
      };
      mockStates.set(key, state);
    }
    return mockStates.get(key)!;
  }),

  // biome-ignore lint/suspicious/noExplicitAny: mock accepts any update shape
  updateDesiredState: mock(async (instanceId: string, orgId: string, update: any) => {
    const key = stateKey(instanceId, orgId);
    const state = mockStates.get(key) ?? {
      instance_id: instanceId,
      organization_id: orgId,
      desired_settings: {},
      desired_mode: 'NORMAL',
      last_actual_state: null,
      last_reconciliation_at: null,
      version: 1,
      updated_at: now,
      created_at: now,
    };

    if (update.settings) {
      for (const s of update.settings) {
        state.desired_settings[s.key] = s.value;
      }
    }
    if (update.mode) {
      state.desired_mode = update.mode;
    }
    state.version++;
    mockStates.set(key, state);
  }),

  // biome-ignore lint/suspicious/noExplicitAny: mock accepts any state shape
  computeDivergence: mock((state: any, actualSnapshot: Record<string, unknown>) => {
    const divergentSettings: Array<{ key: string; desired: unknown; actual: unknown }> = [];
    const actualSettings = (actualSnapshot.settings ?? {}) as Record<string, unknown>;

    for (const [key, value] of Object.entries(state.desired_settings)) {
      if (actualSettings[key] !== value) {
        divergentSettings.push({ key, desired: value, actual: actualSettings[key] });
      }
    }

    const actualMode = actualSnapshot.operational_mode as string | undefined;
    const modeDivergence =
      actualMode && actualMode !== state.desired_mode
        ? { desired: state.desired_mode, actual: actualMode }
        : undefined;

    return { divergent_settings: divergentSettings, mode_divergence: modeDivergence };
  }),
};

// =============================================================================
// Test Setup
// =============================================================================

let app: Elysia;

beforeAll(() => {
  // biome-ignore lint/suspicious/noExplicitAny: mock manager for testing
  setDesiredStateManager(mockManager as any);
  app = new Elysia().use(controlV2Plugin);
});

beforeEach(() => {
  mockStates.clear();
  mockManager.getDesiredState.mockClear();
  mockManager.updateDesiredState.mockClear();
  mockManager.computeDivergence.mockClear();
});

// =============================================================================
// Helpers
// =============================================================================

async function get(path: string) {
  return app.handle(new Request(`http://localhost${path}`));
}

async function post(path: string, body: unknown) {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

// =============================================================================
// Tests
// =============================================================================

describe('GET /v2/popper/control/state/:instance_id', () => {
  test('returns desired state for instance', async () => {
    const response = await get('/v2/popper/control/state/deutsch-1?organization_id=org-1');
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.instance_id).toBe('deutsch-1');
    expect(body.organization_id).toBe('org-1');
    expect(body.desired_mode).toBe('NORMAL');
    expect(body.desired_settings).toEqual({});
  });

  test('returns existing state with settings', async () => {
    // Pre-populate state
    mockStates.set('deutsch-1:org-1', {
      instance_id: 'deutsch-1',
      organization_id: 'org-1',
      desired_settings: { 'autonomy.max_risk_level': 'low' },
      desired_mode: 'RESTRICTED',
      last_actual_state: null,
      last_reconciliation_at: null,
      version: 3,
      updated_at: now,
      created_at: now,
    });

    const response = await get('/v2/popper/control/state/deutsch-1?organization_id=org-1');
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.desired_mode).toBe('RESTRICTED');
    expect(body.desired_settings['autonomy.max_risk_level']).toBe('low');
    expect(body.version).toBe(3);
  });
});

describe('GET /v2/popper/control/reconciliation/:instance_id', () => {
  test('returns no_actual_state when no reconciliation has occurred', async () => {
    const response = await get('/v2/popper/control/reconciliation/deutsch-1?organization_id=org-1');
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('no_actual_state');
    expect(body.divergences).toBeNull();
  });

  test('returns reconciled when states match', async () => {
    mockStates.set('deutsch-1:org-1', {
      instance_id: 'deutsch-1',
      organization_id: 'org-1',
      desired_settings: { 'autonomy.max_risk_level': 'medium' },
      desired_mode: 'NORMAL',
      last_actual_state: {
        operational_mode: 'NORMAL',
        settings: { 'autonomy.max_risk_level': 'medium' },
      },
      last_reconciliation_at: new Date().toISOString(),
      version: 2,
      updated_at: now,
      created_at: now,
    });

    const response = await get('/v2/popper/control/reconciliation/deutsch-1?organization_id=org-1');
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('reconciled');
  });

  test('returns diverged when settings differ', async () => {
    mockStates.set('deutsch-1:org-1', {
      instance_id: 'deutsch-1',
      organization_id: 'org-1',
      desired_settings: { 'autonomy.max_risk_level': 'low' },
      desired_mode: 'NORMAL',
      last_actual_state: {
        operational_mode: 'NORMAL',
        settings: { 'autonomy.max_risk_level': 'medium' },
      },
      last_reconciliation_at: new Date().toISOString(),
      version: 2,
      updated_at: now,
      created_at: now,
    });

    const response = await get('/v2/popper/control/reconciliation/deutsch-1?organization_id=org-1');
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('diverged');
    expect(body.divergences.divergent_settings).toHaveLength(1);
    expect(body.divergences.divergent_settings[0].key).toBe('autonomy.max_risk_level');
  });
});

describe('POST /v2/popper/control/settings', () => {
  test('updates desired state with batch settings', async () => {
    const response = await post('/v2/popper/control/settings', {
      target_instance_id: 'deutsch-1',
      organization_id: 'org-1',
      settings: [
        { key: 'autonomy.max_risk_level', value: 'low' },
        { key: 'autonomy.require_clinician_review', value: true },
      ],
      reason: 'Drift detected',
      operator_id: 'popper-reconfig',
    });

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('accepted');
    expect(body.settings_count).toBe(2);
    expect(body.delivery_status).toBe('pending');

    // Verify manager was called
    expect(mockManager.updateDesiredState).toHaveBeenCalledTimes(1);
  });

  test('works without optional operator_id', async () => {
    const response = await post('/v2/popper/control/settings', {
      target_instance_id: 'deutsch-1',
      organization_id: 'org-1',
      settings: [{ key: 'autonomy.max_risk_level', value: 'none' }],
      reason: 'Emergency',
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('accepted');
  });
});

describe('POST /v2/popper/control/mode', () => {
  test('updates desired mode', async () => {
    const response = await post('/v2/popper/control/mode', {
      target_instance_id: 'deutsch-1',
      organization_id: 'org-1',
      target_mode: 'RESTRICTED',
      reason: 'Drift threshold exceeded',
      operator_id: 'policy-engine',
    });

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('accepted');
    expect(body.target_mode).toBe('RESTRICTED');
    expect(body.delivery_status).toBe('pending');

    expect(mockManager.updateDesiredState).toHaveBeenCalledTimes(1);
  });
});

describe('POST /v2/popper/control/reconciliation/:instance_id', () => {
  test('triggers manual reconciliation', async () => {
    const response = await post('/v2/popper/control/reconciliation/deutsch-1', {
      organization_id: 'org-1',
    });

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.instance_id).toBe('deutsch-1');
    expect(body.delivery_status).toBe('pending');
  });
});
