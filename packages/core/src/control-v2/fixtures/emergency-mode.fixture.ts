/**
 * Conformance Fixture: EMERGENCY Mode Transition
 *
 * Fixture ID: hermes-v2-mode-transition-001
 * Tests: SET_OPERATIONAL_MODE with EMERGENCY priority to SAFE_MODE
 * Timing constraint: max_round_trip_ms = 100
 *
 * @see CC-v2 spec section 6, fixture 2
 */

import type { ControlCommandV2 } from '../types';

/** Canonical ControlCommandV2 for emergency mode transition */
export const emergencyModeCommand: ControlCommandV2 = {
  hermes_version: '2.0.0',
  message_type: 'control_command_v2',
  command_id: '01JQXK0000000000000EMER01',
  created_at: '2026-01-15T10:05:00.000Z',
  source: {
    system: 'popper',
    service_version: 'popper-2.0.0',
    operator_id: 'clinician_dr_test',
  },
  target: {
    system: 'deutsch',
    organization_id: 'org_ta3_test',
  },
  kind: 'SET_OPERATIONAL_MODE',
  priority: 'EMERGENCY',
  mode_transition: {
    target_mode: 'SAFE_MODE',
    reason: 'Critical safety event — multiple hallucinations detected',
  },
  idempotency_key: '01JQXK0000000000000IDEM02',
  audit_redaction: {
    summary: 'Emergency transition to SAFE_MODE',
  },
};

/** Expected response structure for emergency mode fixture */
export const emergencyModeExpectedResponse = {
  status: 'APPLIED',
  operational_state: {
    operational_mode: 'SAFE_MODE',
    safe_mode: {
      enabled: true,
    },
  },
};

/** Timing constraint: max round-trip in milliseconds */
export const emergencyModeMaxRoundTripMs = 100;

/** Expected audit events for emergency mode fixture */
export const emergencyModeExpectedAuditEvents = [
  'CONTROL_COMMAND_RECEIVED',
  'CONTROL_COMMAND_APPLIED',
  'OPERATIONAL_MODE_TRANSITION',
];
