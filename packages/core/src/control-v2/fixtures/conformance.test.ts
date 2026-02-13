/**
 * Conformance Fixture Validation Tests
 *
 * Validates that the 3 canonical conformance fixtures from CC-v2 spec §6
 * are well-formed ControlCommandV2 messages that satisfy type constraints.
 *
 * Work Stream 6.1
 */

import { describe, expect, test } from 'bun:test';
import type { ControlCommandV2 } from '../types';
import {
  atomicRejectionCommand,
  atomicRejectionExpectedAuditEvents,
  atomicRejectionExpectedResponse,
  coreSettingsCommand,
  coreSettingsExpectedAuditEvents,
  coreSettingsExpectedResponse,
  emergencyModeCommand,
  emergencyModeExpectedAuditEvents,
  emergencyModeExpectedResponse,
  emergencyModeMaxRoundTripMs,
} from './index';

// =============================================================================
// Helpers
// =============================================================================

function assertValidCommand(cmd: ControlCommandV2): void {
  expect(cmd.hermes_version).toBe('2.0.0');
  expect(cmd.message_type).toBe('control_command_v2');
  expect(cmd.command_id).toBeTruthy();
  expect(cmd.created_at).toBeTruthy();
  expect(cmd.source.system).toBe('popper');
  expect(cmd.source.service_version).toBeTruthy();
  expect(cmd.target.system).toBe('deutsch');
  expect(cmd.idempotency_key).toBeTruthy();
  expect(cmd.audit_redaction).toBeDefined();
  expect(['ROUTINE', 'URGENT', 'EMERGENCY']).toContain(cmd.priority);
  expect([
    'SET_SAFE_MODE',
    'SET_OPERATIONAL_SETTINGS',
    'GET_OPERATIONAL_STATE',
    'SET_OPERATIONAL_MODE',
  ]).toContain(cmd.kind);
}

// =============================================================================
// Fixture 1: Core Settings Change (hermes-v2-core-settings-001)
// =============================================================================

describe('Conformance: hermes-v2-core-settings-001', () => {
  test('fixture is a valid ControlCommandV2', () => {
    assertValidCommand(coreSettingsCommand);
  });

  test('fixture has correct kind and priority', () => {
    expect(coreSettingsCommand.kind).toBe('SET_OPERATIONAL_SETTINGS');
    expect(coreSettingsCommand.priority).toBe('ROUTINE');
  });

  test('fixture has exactly 1 setting change', () => {
    expect(coreSettingsCommand.settings).toHaveLength(1);
    expect(coreSettingsCommand.settings?.[0].key).toBe('autonomy.max_risk_level');
    expect(coreSettingsCommand.settings?.[0].value).toBe('low');
    expect(coreSettingsCommand.settings?.[0].reason).toBeTruthy();
  });

  test('fixture has no mode_transition or safe_mode', () => {
    expect(coreSettingsCommand.mode_transition).toBeUndefined();
    expect(coreSettingsCommand.safe_mode).toBeUndefined();
  });

  test('expected response has APPLIED status', () => {
    expect(coreSettingsExpectedResponse.status).toBe('APPLIED');
    expect(coreSettingsExpectedResponse.setting_results).toHaveLength(1);
    expect(coreSettingsExpectedResponse.setting_results[0].status).toBe('APPLIED');
  });

  test('expected audit events are correct', () => {
    expect(coreSettingsExpectedAuditEvents).toEqual([
      'CONTROL_COMMAND_RECEIVED',
      'CONTROL_COMMAND_APPLIED',
    ]);
  });

  test('idempotency key is unique from command_id', () => {
    expect(coreSettingsCommand.idempotency_key).not.toBe(coreSettingsCommand.command_id);
  });
});

// =============================================================================
// Fixture 2: EMERGENCY Mode Transition (hermes-v2-mode-transition-001)
// =============================================================================

describe('Conformance: hermes-v2-mode-transition-001', () => {
  test('fixture is a valid ControlCommandV2', () => {
    assertValidCommand(emergencyModeCommand);
  });

  test('fixture has correct kind and priority', () => {
    expect(emergencyModeCommand.kind).toBe('SET_OPERATIONAL_MODE');
    expect(emergencyModeCommand.priority).toBe('EMERGENCY');
  });

  test('fixture has mode_transition to SAFE_MODE', () => {
    expect(emergencyModeCommand.mode_transition).toBeDefined();
    expect(emergencyModeCommand.mode_transition?.target_mode).toBe('SAFE_MODE');
    expect(emergencyModeCommand.mode_transition?.reason).toBeTruthy();
  });

  test('fixture has operator_id for clinician', () => {
    expect(emergencyModeCommand.source.operator_id).toBe('clinician_dr_test');
  });

  test('fixture has no settings', () => {
    expect(emergencyModeCommand.settings).toBeUndefined();
  });

  test('expected response shows SAFE_MODE applied', () => {
    expect(emergencyModeExpectedResponse.status).toBe('APPLIED');
    expect(emergencyModeExpectedResponse.operational_state.operational_mode).toBe('SAFE_MODE');
    expect(emergencyModeExpectedResponse.operational_state.safe_mode.enabled).toBe(true);
  });

  test('timing constraint is 100ms for EMERGENCY', () => {
    expect(emergencyModeMaxRoundTripMs).toBe(100);
  });

  test('expected audit events include mode transition', () => {
    expect(emergencyModeExpectedAuditEvents).toContain('OPERATIONAL_MODE_TRANSITION');
  });
});

// =============================================================================
// Fixture 3: Rejected Batch (hermes-v2-atomic-reject-001)
// =============================================================================

describe('Conformance: hermes-v2-atomic-reject-001', () => {
  test('fixture is a valid ControlCommandV2', () => {
    assertValidCommand(atomicRejectionCommand);
  });

  test('fixture has correct kind and priority', () => {
    expect(atomicRejectionCommand.kind).toBe('SET_OPERATIONAL_SETTINGS');
    expect(atomicRejectionCommand.priority).toBe('ROUTINE');
  });

  test('fixture has exactly 2 settings (one valid, one invalid)', () => {
    expect(atomicRejectionCommand.settings).toHaveLength(2);
    expect(atomicRejectionCommand.settings?.[0].key).toBe('autonomy.max_risk_level');
    expect(atomicRejectionCommand.settings?.[1].key).toBe('nonexistent.setting_key');
  });

  test('expected response is REJECTED with both settings rejected', () => {
    expect(atomicRejectionExpectedResponse.status).toBe('REJECTED');
    expect(atomicRejectionExpectedResponse.setting_results).toHaveLength(2);
    // Both must be REJECTED for atomicity
    for (const result of atomicRejectionExpectedResponse.setting_results) {
      expect(result.status).toBe('REJECTED');
    }
  });

  test('invalid key rejection has reason', () => {
    const invalidResult = atomicRejectionExpectedResponse.setting_results.find(
      (r) => r.key === 'nonexistent.setting_key',
    );
    expect(invalidResult?.reason).toBeTruthy();
  });

  test('expected audit events include VALIDATION_FAILED', () => {
    expect(atomicRejectionExpectedAuditEvents).toContain('VALIDATION_FAILED');
    expect(atomicRejectionExpectedAuditEvents).not.toContain('CONTROL_COMMAND_APPLIED');
  });
});

// =============================================================================
// Cross-fixture validation
// =============================================================================

describe('Conformance: Cross-fixture invariants', () => {
  const allFixtures = [coreSettingsCommand, emergencyModeCommand, atomicRejectionCommand];

  test('all fixtures have unique command_ids', () => {
    const ids = allFixtures.map((f) => f.command_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('all fixtures have unique idempotency_keys', () => {
    const keys = allFixtures.map((f) => f.idempotency_key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('all fixtures target deutsch system', () => {
    for (const fixture of allFixtures) {
      expect(fixture.target.system).toBe('deutsch');
      expect(fixture.target.organization_id).toBe('org_ta3_test');
    }
  });

  test('all fixtures use hermes v2.0.0', () => {
    for (const fixture of allFixtures) {
      expect(fixture.hermes_version).toBe('2.0.0');
    }
  });

  test('all fixtures have valid ISO timestamps', () => {
    for (const fixture of allFixtures) {
      expect(new Date(fixture.created_at).toISOString()).toBe(fixture.created_at);
    }
  });
});
