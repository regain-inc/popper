/**
 * ControlCommandV2 Builder Tests
 */

import { beforeEach, describe, expect, test } from 'bun:test';
import { AuditEmitter, InMemoryAuditStorage, setDefaultEmitter } from '../audit/emitter';
import type { ReconfigureEffect } from '../policy-engine/types';
import {
  type BuildCommandOptions,
  buildControlCommandV2,
  buildGetStateCommand,
  buildSafeModeCommand,
} from './builder';

let auditStorage: InMemoryAuditStorage;

const DEFAULT_OPTIONS: BuildCommandOptions = {
  organizationId: 'org-001',
  instanceId: 'deutsch-prod-1',
  serviceVersion: '0.1.0',
  operatorId: 'drift-policy',
};

beforeEach(() => {
  auditStorage = new InMemoryAuditStorage();
  setDefaultEmitter(new AuditEmitter(auditStorage, { batchEnabled: false, asyncWrites: false }));
});

// =============================================================================
// buildControlCommandV2
// =============================================================================

describe('buildControlCommandV2', () => {
  test('builds SET_OPERATIONAL_SETTINGS command from settings-only effect', () => {
    const effect: ReconfigureEffect = {
      settings: [{ key: 'max_autonomy_level', value: 2, reason: 'Drift detected' }],
      priority: 'URGENT',
    };

    const cmd = buildControlCommandV2(effect, DEFAULT_OPTIONS);

    expect(cmd.hermes_version).toBe('2.0.0');
    expect(cmd.message_type).toBe('control_command_v2');
    expect(cmd.kind).toBe('SET_OPERATIONAL_SETTINGS');
    expect(cmd.priority).toBe('URGENT');
    expect(cmd.settings).toHaveLength(1);
    expect(cmd.settings?.[0].key).toBe('max_autonomy_level');
    expect(cmd.settings?.[0].value).toBe(2);
    expect(cmd.settings?.[0].reason).toBe('Drift detected');
    expect(cmd.mode_transition).toBeUndefined();
    expect(cmd.source.system).toBe('popper');
    expect(cmd.target.system).toBe('deutsch');
    expect(cmd.target.instance_id).toBe('deutsch-prod-1');
    expect(cmd.target.organization_id).toBe('org-001');
  });

  test('builds SET_OPERATIONAL_MODE command when mode_transition present', () => {
    const effect: ReconfigureEffect = {
      mode_transition: {
        target_mode: 'RESTRICTED',
        reason: 'Approval rate below threshold',
      },
      priority: 'EMERGENCY',
    };

    const cmd = buildControlCommandV2(effect, DEFAULT_OPTIONS);

    expect(cmd.kind).toBe('SET_OPERATIONAL_MODE');
    expect(cmd.mode_transition).toBeDefined();
    expect(cmd.mode_transition?.target_mode).toBe('RESTRICTED');
    expect(cmd.mode_transition?.reason).toBe('Approval rate below threshold');
  });

  test('prefers SET_OPERATIONAL_MODE when both settings and mode_transition present', () => {
    const effect: ReconfigureEffect = {
      settings: [{ key: 'a', value: 1 }],
      mode_transition: {
        target_mode: 'SAFE_MODE',
        reason: 'Emergency',
      },
      priority: 'EMERGENCY',
    };

    const cmd = buildControlCommandV2(effect, DEFAULT_OPTIONS);

    expect(cmd.kind).toBe('SET_OPERATIONAL_MODE');
    expect(cmd.settings).toBeDefined();
    expect(cmd.mode_transition).toBeDefined();
  });

  test('defaults priority to ROUTINE when not specified', () => {
    const effect: ReconfigureEffect = {
      settings: [{ key: 'a', value: 1 }],
    };

    const cmd = buildControlCommandV2(effect, DEFAULT_OPTIONS);

    expect(cmd.priority).toBe('ROUTINE');
  });

  test('generates unique command_id and idempotency_key', () => {
    const effect: ReconfigureEffect = { settings: [{ key: 'a', value: 1 }] };

    const cmd1 = buildControlCommandV2(effect, DEFAULT_OPTIONS);
    const cmd2 = buildControlCommandV2(effect, DEFAULT_OPTIONS);

    expect(cmd1.command_id).not.toBe(cmd2.command_id);
    expect(cmd1.idempotency_key).toBe(cmd1.command_id);
  });

  test('includes batch_id when provided', () => {
    const effect: ReconfigureEffect = { settings: [{ key: 'a', value: 1 }] };

    const cmd = buildControlCommandV2(effect, {
      ...DEFAULT_OPTIONS,
      batchId: 'batch-abc',
    });

    expect(cmd.command_batch_id).toBe('batch-abc');
  });

  test('computes effective_until from auto_revert settings', () => {
    const effect: ReconfigureEffect = {
      settings: [{ key: 'x', value: 42 }],
      auto_revert: true,
      revert_after_minutes: 60,
    };

    const before = Date.now();
    const cmd = buildControlCommandV2(effect, DEFAULT_OPTIONS);
    const after = Date.now();

    const effectiveUntil = new Date(cmd.settings?.[0].effective_until as string).getTime();
    const expectedMin = before + 60 * 60 * 1000;
    const expectedMax = after + 60 * 60 * 1000;

    expect(effectiveUntil).toBeGreaterThanOrEqual(expectedMin);
    expect(effectiveUntil).toBeLessThanOrEqual(expectedMax);
  });

  test('does not set effective_until when auto_revert is false', () => {
    const effect: ReconfigureEffect = {
      settings: [{ key: 'x', value: 42 }],
      auto_revert: false,
    };

    const cmd = buildControlCommandV2(effect, DEFAULT_OPTIONS);

    expect(cmd.settings?.[0].effective_until).toBeUndefined();
  });

  test('sets audit_redaction.redact to false', () => {
    const effect: ReconfigureEffect = { settings: [{ key: 'a', value: 1 }] };

    const cmd = buildControlCommandV2(effect, DEFAULT_OPTIONS);

    expect(cmd.audit_redaction.redact).toBe(false);
  });

  test('emits CONTROL_COMMAND_ISSUED audit event', async () => {
    const effect: ReconfigureEffect = {
      settings: [{ key: 'max_autonomy', value: 2 }],
      priority: 'URGENT',
    };

    buildControlCommandV2(effect, { ...DEFAULT_OPTIONS, policyId: 'drift-policy-1' });

    await new Promise((resolve) => setTimeout(resolve, 10));

    const events = auditStorage.getEvents();
    const event = events.find((e) => e.eventType === 'CONTROL_COMMAND_ISSUED');
    expect(event).toBeDefined();
    expect(event?.organizationId).toBe('org-001');
    expect(event?.payload?.command_kind).toBe('SET_OPERATIONAL_SETTINGS');
    expect(event?.tags).toContain('control_v2');
  });

  test('adds auto_revert audit tag when effect has auto_revert', async () => {
    const effect: ReconfigureEffect = {
      settings: [{ key: 'a', value: 1 }],
      auto_revert: true,
      revert_after_minutes: 30,
    };

    buildControlCommandV2(effect, DEFAULT_OPTIONS);

    await new Promise((resolve) => setTimeout(resolve, 10));

    const events = auditStorage.getEvents();
    const event = events.find((e) => e.eventType === 'CONTROL_COMMAND_ISSUED');
    expect(event?.tags).toContain('auto_revert');
  });

  test('adds ta1_self_transition tag when no operator', async () => {
    const effect: ReconfigureEffect = { settings: [{ key: 'a', value: 1 }] };
    const opts = { ...DEFAULT_OPTIONS, operatorId: undefined };

    buildControlCommandV2(effect, opts);

    await new Promise((resolve) => setTimeout(resolve, 10));

    const events = auditStorage.getEvents();
    const event = events.find((e) => e.eventType === 'CONTROL_COMMAND_ISSUED');
    expect(event?.tags).toContain('ta1_self_transition');
  });
});

// =============================================================================
// buildGetStateCommand
// =============================================================================

describe('buildGetStateCommand', () => {
  test('builds GET_OPERATIONAL_STATE command', () => {
    const cmd = buildGetStateCommand(DEFAULT_OPTIONS);

    expect(cmd.kind).toBe('GET_OPERATIONAL_STATE');
    expect(cmd.priority).toBe('ROUTINE');
    expect(cmd.settings).toBeUndefined();
    expect(cmd.mode_transition).toBeUndefined();
    expect(cmd.safe_mode).toBeUndefined();
    expect(cmd.target.instance_id).toBe('deutsch-prod-1');
  });

  test('emits audit event with reconciliation tag', async () => {
    buildGetStateCommand(DEFAULT_OPTIONS);

    await new Promise((resolve) => setTimeout(resolve, 10));

    const events = auditStorage.getEvents();
    const event = events.find((e) => e.eventType === 'CONTROL_COMMAND_ISSUED');
    expect(event).toBeDefined();
    expect(event?.tags).toContain('reconciliation');
  });
});

// =============================================================================
// buildSafeModeCommand
// =============================================================================

describe('buildSafeModeCommand', () => {
  test('builds SET_SAFE_MODE enable command', () => {
    const cmd = buildSafeModeCommand(true, 'Critical safety issue', DEFAULT_OPTIONS);

    expect(cmd.kind).toBe('SET_SAFE_MODE');
    expect(cmd.priority).toBe('EMERGENCY');
    expect(cmd.safe_mode).toBeDefined();
    expect(cmd.safe_mode?.enabled).toBe(true);
    expect(cmd.safe_mode?.reason).toBe('Critical safety issue');
  });

  test('builds SET_SAFE_MODE disable command', () => {
    const cmd = buildSafeModeCommand(false, 'Issue resolved', DEFAULT_OPTIONS);

    expect(cmd.safe_mode?.enabled).toBe(false);
  });

  test('includes effective_until when provided', () => {
    const until = '2026-01-01T00:00:00Z';
    const cmd = buildSafeModeCommand(true, 'Temp', {
      ...DEFAULT_OPTIONS,
      effectiveUntil: until,
    });

    expect(cmd.safe_mode?.effective_until).toBe(until);
  });
});
