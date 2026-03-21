/**
 * Tests for hermes-bridge.ts — degraded mapping and safe mode behavior
 *
 * Covers the remediation behaviors added for:
 * - SAFE_MODE_CHANGED event mapping (enabled/disabled/degraded)
 * - Mode defaulting and diagnostic tags
 * - Normal SUPERVISION_DECISION mapping
 */

import { describe, expect, it } from 'bun:test';
import { mapPopperEventTypeToHermes, toHermesAuditEvent } from './hermes-bridge';
import type { AuditEventInput } from './types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeBaseEvent(overrides?: Partial<AuditEventInput>): AuditEventInput {
  return {
    traceId: 'trace-bridge-001',
    eventType: 'SUPERVISION_DECISION',
    subjectId: 'pt-12345',
    organizationId: 'org-test',
    policyPackVersion: '1.0.0',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// SAFE_MODE_CHANGED mapping
// ---------------------------------------------------------------------------

describe('toHermesAuditEvent — SAFE_MODE_CHANGED', () => {
  it('maps to SAFE_MODE_ENABLED when payload.safe_mode.active = true', () => {
    const event = makeBaseEvent({
      eventType: 'SAFE_MODE_CHANGED',
      payload: {
        mode: 'advocate_clinical',
        safe_mode: { active: true, effective_at: '2026-01-25T10:00:00Z' },
      },
    });

    const result = toHermesAuditEvent(event);

    expect(result.event_type).toBe('SAFE_MODE_ENABLED');
    // Should NOT have degraded tags
    expect(result.tags?.mapping_confidence).toBeUndefined();
  });

  it('maps to SAFE_MODE_DISABLED when payload.safe_mode.active = false', () => {
    const event = makeBaseEvent({
      eventType: 'SAFE_MODE_CHANGED',
      payload: {
        mode: 'advocate_clinical',
        safe_mode: { active: false },
      },
    });

    const result = toHermesAuditEvent(event);

    expect(result.event_type).toBe('SAFE_MODE_DISABLED');
    expect(result.tags?.mapping_confidence).toBeUndefined();
  });

  it('maps to OTHER with mapping_confidence: degraded when safe_mode state is missing', () => {
    const event = makeBaseEvent({
      eventType: 'SAFE_MODE_CHANGED',
      // No payload.safe_mode AND no safeModeActive field
      payload: {},
    });

    const result = toHermesAuditEvent(event);

    expect(result.event_type).toBe('OTHER');
    expect(result.other_event_type).toBe('SAFE_MODE_CHANGED');
    expect(result.tags).toBeDefined();
    expect(result.tags?.mapping_confidence).toBe('degraded');
    expect(result.tags?.mapping_degraded).toBe('missing_safe_mode_state');
  });

  it('falls back to safeModeActive field when payload.safe_mode is missing', () => {
    const event = makeBaseEvent({
      eventType: 'SAFE_MODE_CHANGED',
      safeModeActive: true,
      payload: { mode: 'advocate_clinical' },
    });

    const result = toHermesAuditEvent(event);

    expect(result.event_type).toBe('SAFE_MODE_ENABLED');
  });

  it('prefers payload.safe_mode.active over safeModeActive field', () => {
    const event = makeBaseEvent({
      eventType: 'SAFE_MODE_CHANGED',
      safeModeActive: true,
      payload: {
        mode: 'advocate_clinical',
        safe_mode: { active: false },
      },
    });

    const result = toHermesAuditEvent(event);

    // payload.safe_mode.active takes precedence
    expect(result.event_type).toBe('SAFE_MODE_DISABLED');
  });
});

// ---------------------------------------------------------------------------
// Mode defaulting and diagnostic tags
// ---------------------------------------------------------------------------

describe('toHermesAuditEvent — mode defaulting', () => {
  it('includes mode_defaulted: true tag when event has no mode in payload', () => {
    const event = makeBaseEvent({
      eventType: 'SUPERVISION_DECISION',
      decision: 'APPROVED',
      reasonCodes: [],
      // No payload.mode
    });

    const result = toHermesAuditEvent(event);

    expect(result.tags).toBeDefined();
    expect(result.tags?.mode_defaulted).toBe('true');
    // Default mode should be 'wellness'
    expect(result.mode).toBe('wellness');
  });

  it('does not include mode_defaulted tag when mode is present in payload', () => {
    const event = makeBaseEvent({
      eventType: 'SUPERVISION_DECISION',
      decision: 'APPROVED',
      reasonCodes: [],
      payload: {
        mode: 'advocate_clinical',
      },
    });

    const result = toHermesAuditEvent(event);

    expect(result.mode).toBe('advocate_clinical');
    expect(result.tags?.mode_defaulted).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Normal SUPERVISION_DECISION → SUPERVISION_RESPONSE_DECIDED
// ---------------------------------------------------------------------------

describe('toHermesAuditEvent — SUPERVISION_DECISION', () => {
  it('maps SUPERVISION_DECISION to SUPERVISION_RESPONSE_DECIDED (no degraded tags)', () => {
    const event = makeBaseEvent({
      eventType: 'SUPERVISION_DECISION',
      decision: 'APPROVED',
      reasonCodes: ['LOW_RISK'],
      latencyMs: 42,
      proposalCount: 3,
      payload: {
        mode: 'advocate_clinical',
      },
    });

    const result = toHermesAuditEvent(event);

    expect(result.event_type).toBe('SUPERVISION_RESPONSE_DECIDED');
    expect(result.mode).toBe('advocate_clinical');
    // Should have decision and reason_codes tags but NOT degraded tags
    expect(result.tags?.decision).toBe('APPROVED');
    expect(result.tags?.reason_codes).toBe('LOW_RISK');
    expect(result.tags?.latency_ms).toBe('42');
    expect(result.tags?.proposal_count).toBe('3');
    expect(result.tags?.mapping_confidence).toBeUndefined();
    expect(result.tags?.mapping_degraded).toBeUndefined();
  });

  it('sets hermes_version and message_type correctly', () => {
    const event = makeBaseEvent({
      payload: { mode: 'wellness' },
    });

    const result = toHermesAuditEvent(event);

    expect(result.hermes_version).toBeDefined();
    expect(result.message_type).toBe('audit_event');
  });

  it('sets producer system to popper with provided service version', () => {
    const event = makeBaseEvent({
      payload: { mode: 'wellness' },
    });

    const result = toHermesAuditEvent(event, '2.1.0');

    expect(result.trace.producer.system).toBe('popper');
    expect(result.trace.producer.service_version).toBe('2.1.0');
  });
});

// ---------------------------------------------------------------------------
// mapPopperEventTypeToHermes — quick mapping
// ---------------------------------------------------------------------------

describe('mapPopperEventTypeToHermes', () => {
  it('SAFE_MODE_CHANGED with safeModeActive=true → SAFE_MODE_ENABLED', () => {
    expect(mapPopperEventTypeToHermes('SAFE_MODE_CHANGED', true)).toBe('SAFE_MODE_ENABLED');
  });

  it('SAFE_MODE_CHANGED with safeModeActive=false → SAFE_MODE_DISABLED', () => {
    expect(mapPopperEventTypeToHermes('SAFE_MODE_CHANGED', false)).toBe('SAFE_MODE_DISABLED');
  });

  it('SUPERVISION_DECISION → SUPERVISION_RESPONSE_DECIDED', () => {
    expect(mapPopperEventTypeToHermes('SUPERVISION_DECISION')).toBe('SUPERVISION_RESPONSE_DECIDED');
  });

  it('Popper-only types → OTHER', () => {
    expect(mapPopperEventTypeToHermes('CONTROL_COMMAND_TIMEOUT')).toBe('OTHER');
    expect(mapPopperEventTypeToHermes('POLICY_LIFECYCLE')).toBe('OTHER');
  });
});
