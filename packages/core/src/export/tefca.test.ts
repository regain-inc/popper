import { describe, expect, it } from 'bun:test';
import { assessTEFCACompliance, buildInteropRefs } from './tefca';
import type { ExportAuditEvent } from './types';

describe('assessTEFCACompliance', () => {
  it('returns treatment purpose for empty bundle', () => {
    const result = assessTEFCACompliance({ eventCount: 0, incidentCount: 0 });

    expect(result.framework_version).toBe('v1');
    expect(result.exchange_purposes).toEqual(['treatment']);
    expect(result.document_format).toBe('popper_bundle_v1');
    expect(result.ccda_convertible).toBe(true);
    expect(result.qhin_ready).toBe(false);
    expect(result.push_capable).toBe(true);
    expect(result.pull_queryable).toBe(false);
  });

  it('adds operations purpose when events are present', () => {
    const result = assessTEFCACompliance({ eventCount: 5, incidentCount: 0 });

    expect(result.exchange_purposes).toContain('treatment');
    expect(result.exchange_purposes).toContain('operations');
  });

  it('adds operations purpose when incidents are present', () => {
    const result = assessTEFCACompliance({ eventCount: 0, incidentCount: 2 });

    expect(result.exchange_purposes).toContain('operations');
  });

  it('adds operations purpose when both events and incidents are present', () => {
    const result = assessTEFCACompliance({ eventCount: 10, incidentCount: 3 });

    expect(result.exchange_purposes).toEqual(['treatment', 'operations']);
  });
});

describe('buildInteropRefs', () => {
  const makeEvent = (overrides: Partial<ExportAuditEvent> = {}): ExportAuditEvent => ({
    event_id: 'evt-001',
    event_type: 'supervision.completed',
    timestamp: '2026-01-30T10:00:00Z',
    trace_id: 'trace-001',
    organization_id: 'org-hash-001',
    decision: 'APPROVED',
    reason_codes: ['within_guidelines'],
    ...overrides,
  });

  it('returns empty array when no supervision events', () => {
    const events: ExportAuditEvent[] = [
      makeEvent({ event_type: 'validation.failed' }),
      makeEvent({ event_type: 'safe_mode.enabled' }),
    ];

    expect(buildInteropRefs(events)).toEqual([]);
  });

  it('builds refs for supervision.completed events', () => {
    const events = [makeEvent()];
    const refs = buildInteropRefs(events);

    expect(refs).toHaveLength(1);
    expect(refs[0].standard).toBe('FHIR_R4');
    expect(refs[0].content_type).toBe('application/fhir+json');
    expect(refs[0].message_type).toBe('Bundle');
    expect(refs[0].uri).toBe('urn:popper:supervision:trace-001');
    expect(refs[0].interop_id).toBeTruthy();
    expect(refs[0].content_hash).toBeTruthy();
  });

  it('builds refs for supervision_completed events (underscore variant)', () => {
    const events = [makeEvent({ event_type: 'supervision_completed' })];
    const refs = buildInteropRefs(events);

    expect(refs).toHaveLength(1);
    expect(refs[0].standard).toBe('FHIR_R4');
  });

  it('generates deterministic interop_id for same event', () => {
    const event = makeEvent();
    const refs1 = buildInteropRefs([event]);
    const refs2 = buildInteropRefs([event]);

    expect(refs1[0].interop_id).toBe(refs2[0].interop_id);
    expect(refs1[0].content_hash).toBe(refs2[0].content_hash);
  });

  it('generates different interop_id for different events', () => {
    const event1 = makeEvent({ event_id: 'evt-001', trace_id: 'trace-001' });
    const event2 = makeEvent({ event_id: 'evt-002', trace_id: 'trace-002' });

    const refs = buildInteropRefs([event1, event2]);

    expect(refs).toHaveLength(2);
    expect(refs[0].interop_id).not.toBe(refs[1].interop_id);
  });

  it('includes audit_redaction summary with decision and reason codes', () => {
    const event = makeEvent({
      event_id: 'evt-100',
      decision: 'HARD_STOP',
      reason_codes: ['policy_violation', 'missing_evidence'],
    });

    const refs = buildInteropRefs([event]);

    expect(refs[0].audit_redaction.summary).toContain('evt-100');
    expect(refs[0].audit_redaction.summary).toContain('HARD_STOP');
    expect(refs[0].audit_redaction.summary).toContain('policy_violation,missing_evidence');
  });

  it('handles event with no decision gracefully', () => {
    const event = makeEvent({ decision: undefined, reason_codes: undefined });
    const refs = buildInteropRefs([event]);

    expect(refs).toHaveLength(1);
    expect(refs[0].audit_redaction.summary).toContain('N/A');
  });

  it('filters only supervision events from mixed input', () => {
    const events = [
      makeEvent({ event_type: 'validation.failed' }),
      makeEvent({ event_type: 'supervision.completed', event_id: 'evt-A' }),
      makeEvent({ event_type: 'safe_mode.enabled' }),
      makeEvent({ event_type: 'supervision_completed', event_id: 'evt-B' }),
    ];

    const refs = buildInteropRefs(events);

    expect(refs).toHaveLength(2);
  });
});
