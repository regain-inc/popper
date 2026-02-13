/**
 * Conformance Fixture: Rejected Batch (Atomicity)
 *
 * Fixture ID: hermes-v2-atomic-reject-001
 * Tests: SET_OPERATIONAL_SETTINGS with one valid + one invalid key
 * Invariant: no settings must change if batch contains invalid key
 *
 * @see CC-v2 spec section 6, fixture 3
 */

import type { ControlCommandV2 } from '../types';

/** Canonical ControlCommandV2 for atomic rejection */
export const atomicRejectionCommand: ControlCommandV2 = {
  hermes_version: '2.0.0',
  message_type: 'control_command_v2',
  command_id: '01JQXK0000000000000RJCT01',
  created_at: '2026-01-15T10:10:00.000Z',
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
      reason: 'Valid setting',
    },
    {
      key: 'nonexistent.setting_key',
      value: 'anything',
      reason: 'Invalid key',
    },
  ],
  idempotency_key: '01JQXK0000000000000IDEM03',
  audit_redaction: {
    summary: 'Batch with invalid setting key',
  },
};

/** Expected response structure for atomic rejection fixture */
export const atomicRejectionExpectedResponse = {
  status: 'REJECTED',
  setting_results: [
    {
      key: 'autonomy.max_risk_level',
      status: 'REJECTED',
    },
    {
      key: 'nonexistent.setting_key',
      status: 'REJECTED',
      reason: 'Unknown setting key',
    },
  ],
};

/** Expected audit events for atomic rejection fixture */
export const atomicRejectionExpectedAuditEvents = ['CONTROL_COMMAND_RECEIVED', 'VALIDATION_FAILED'];
