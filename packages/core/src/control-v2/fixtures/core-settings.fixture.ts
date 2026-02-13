/**
 * Conformance Fixture: Core Settings Change (ROUTINE)
 *
 * Fixture ID: hermes-v2-core-settings-001
 * Tests: SET_OPERATIONAL_SETTINGS with ROUTINE priority
 *
 * @see CC-v2 spec section 6, fixture 1
 */

import type { ControlCommandV2 } from '../types';

/** Canonical ControlCommandV2 for core settings change */
export const coreSettingsCommand: ControlCommandV2 = {
  hermes_version: '2.0.0',
  message_type: 'control_command_v2',
  command_id: '01JQXK0000000000000CORE01',
  created_at: '2026-01-15T10:00:00.000Z',
  source: {
    system: 'popper',
    service_version: 'popper-2.0.0',
  },
  target: {
    system: 'deutsch',
    organization_id: 'org_ta3_test',
  },
  kind: 'SET_OPERATIONAL_SETTINGS',
  priority: 'ROUTINE',
  settings: [
    {
      key: 'autonomy.max_risk_level',
      value: 'low',
      reason: 'Routine safety adjustment',
    },
  ],
  idempotency_key: '01JQXK0000000000000IDEM01',
  audit_redaction: {
    summary: 'Reduce max risk level to low',
  },
};

/** Expected response structure for core settings fixture */
export const coreSettingsExpectedResponse = {
  status: 'APPLIED',
  setting_results: [
    {
      key: 'autonomy.max_risk_level',
      status: 'APPLIED',
      applied_value: 'low',
    },
  ],
};

/** Expected audit events for core settings fixture */
export const coreSettingsExpectedAuditEvents = [
  'CONTROL_COMMAND_RECEIVED',
  'CONTROL_COMMAND_APPLIED',
];
