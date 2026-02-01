import { describe, expect, it } from 'bun:test';
import type { ExportAuditEvent, ExportIncidentSummary, ExportSupervisionReceipt } from './types';
import { analyzeUSCDICoverage, mapEventToUSCDI } from './uscdi';

const makeEvent = (overrides: Partial<ExportAuditEvent> = {}): ExportAuditEvent => ({
  event_id: 'evt-001',
  event_type: 'supervision.completed',
  timestamp: '2026-01-30T10:00:00Z',
  trace_id: 'trace-001',
  organization_id: 'org-hash-001',
  ...overrides,
});

const makeReceipt = (
  overrides: Partial<ExportSupervisionReceipt> = {},
): ExportSupervisionReceipt => ({
  trace_id: 'trace-001',
  timestamp: '2026-01-30T10:00:00Z',
  producer: { service: 'popper', service_version: '1.0.0', ruleset_version: '1.0.0' },
  decision: 'APPROVED',
  reason_codes: [],
  ...overrides,
});

const makeIncident = (overrides: Partial<ExportIncidentSummary> = {}): ExportIncidentSummary => ({
  incident_id: 'inc-001',
  created_at: '2026-01-30T10:00:00Z',
  severity: 'warning',
  trigger: 'drift_threshold_exceeded',
  summary: 'Drift exceeded threshold',
  related_trace_ids: ['trace-001'],
  ...overrides,
});

describe('mapEventToUSCDI', () => {
  it('returns empty array for event without USCDI-relevant fields', () => {
    const event = makeEvent();
    expect(mapEventToUSCDI(event)).toEqual([]);
  });

  it('maps subject_id_hash to patient_demographics', () => {
    const event = makeEvent({ subject_id_hash: 'hash-123' });
    expect(mapEventToUSCDI(event)).toContain('patient_demographics');
  });

  it('maps metadata medications field', () => {
    const event = makeEvent({ metadata: { medications: ['lisinopril'] } });
    expect(mapEventToUSCDI(event)).toContain('medications');
  });

  it('maps metadata vitals field', () => {
    const event = makeEvent({ metadata: { vitals: { bp: '120/80' } } });
    expect(mapEventToUSCDI(event)).toContain('vital_signs');
  });

  it('maps metadata laboratory fields', () => {
    const event = makeEvent({ metadata: { potassium: 4.5, creatinine: 1.1 } });
    const classes = mapEventToUSCDI(event);
    expect(classes).toContain('laboratory');
  });

  it('maps multiple fields to multiple classes', () => {
    const event = makeEvent({
      subject_id_hash: 'hash-123',
      metadata: {
        medications: ['aspirin'],
        potassium: 4.0,
        conditions: ['hypertension'],
      },
    });

    const classes = mapEventToUSCDI(event);
    expect(classes).toContain('patient_demographics');
    expect(classes).toContain('medications');
    expect(classes).toContain('laboratory');
    expect(classes).toContain('problems');
  });

  it('does not duplicate classes', () => {
    const event = makeEvent({
      metadata: { medication_name: 'aspirin', medication_dose: '100mg', medications: ['aspirin'] },
    });

    const classes = mapEventToUSCDI(event);
    const medicationCount = classes.filter((c) => c === 'medications').length;
    expect(medicationCount).toBe(1);
  });
});

describe('analyzeUSCDICoverage', () => {
  it('reports all missing for empty inputs', () => {
    const report = analyzeUSCDICoverage([], [], []);

    expect(report.version).toBe('v3');
    expect(report.coverage_score).toBe(0);
    expect(report.data_classes).toHaveLength(7);

    for (const cls of report.data_classes) {
      expect(cls.status).toBe('missing');
      expect(cls.gaps).toBeDefined();
      expect(cls.gaps?.length).toBeGreaterThan(0);
    }
  });

  it('detects patient_demographics from subject_id_hash', () => {
    const events = [makeEvent({ subject_id_hash: 'hash-abc' })];
    const report = analyzeUSCDICoverage(events, [], []);

    const demo = report.data_classes.find((d) => d.class === 'patient_demographics');
    expect(demo?.status).toBe('present');
    expect(demo?.source_fields).toContain('subject_id_hash');
  });

  it('detects clinical_notes from supervision receipts', () => {
    const receipts = [
      makeReceipt({
        request_redaction: { redacted_fields: ['phi'], summary: 'Patient presented with...' },
      }),
    ];

    const report = analyzeUSCDICoverage([], receipts, []);

    const notes = report.data_classes.find((d) => d.class === 'clinical_notes');
    expect(notes?.status).toBe('present');
    expect(notes?.source_fields).toContain('request_redaction.summary');
  });

  it('detects problems from incident triggers containing condition keywords', () => {
    const incidents = [makeIncident({ trigger: 'condition_worsening_detected' })];
    const report = analyzeUSCDICoverage([], [], incidents);

    const problems = report.data_classes.find((d) => d.class === 'problems');
    expect(problems?.status).not.toBe('missing');
  });

  it('calculates coverage score correctly', () => {
    // 2 present out of 7 = (2 + 0*0.5) / 7 ≈ 0.29
    const events = [
      makeEvent({ subject_id_hash: 'hash', metadata: { allergies: ['penicillin'] } }),
    ];

    const report = analyzeUSCDICoverage(events, [], []);

    const presentCount = report.data_classes.filter((d) => d.status === 'present').length;
    expect(presentCount).toBe(2); // patient_demographics + allergies
    expect(report.coverage_score).toBeCloseTo(2 / 7, 2);
  });

  it('reports partial coverage for incomplete class data', () => {
    // bp_trend is a vital_signs field, but not the expected 'vitals' field
    const events = [makeEvent({ metadata: { bp_trend: 'stable' } })];
    const report = analyzeUSCDICoverage(events, [], []);

    const vitals = report.data_classes.find((d) => d.class === 'vital_signs');
    expect(vitals?.status).toBe('partial');
    expect(vitals?.gaps).toBeDefined();
  });

  it('provides gaps_summary for missing and partial classes', () => {
    const report = analyzeUSCDICoverage([], [], []);

    expect(report.gaps_summary).toContain('Missing');
    expect(report.gaps_summary.length).toBeGreaterThan(0);
  });

  it('reports full coverage when all classes are present', () => {
    const events = [
      makeEvent({
        subject_id_hash: 'hash',
        metadata: {
          conditions: ['hypertension'],
          medications: ['lisinopril'],
          vitals: { bp: '120/80' },
          potassium: 4.5,
          allergies: ['penicillin'],
        },
      }),
    ];

    const receipts = [
      makeReceipt({
        request_redaction: { redacted_fields: ['phi'], summary: 'Clinical note summary' },
      }),
    ];

    const report = analyzeUSCDICoverage(events, receipts, []);

    expect(report.coverage_score).toBe(1);
    expect(report.gaps_summary).toBe('Full USCDI v3 coverage achieved.');
  });

  it('counts partial classes at 0.5 weight in coverage score', () => {
    // subject_id_hash → patient_demographics (present)
    // bp_trend → vital_signs (partial, expected 'vitals')
    const events = [makeEvent({ subject_id_hash: 'hash', metadata: { bp_trend: 'stable' } })];
    const report = analyzeUSCDICoverage(events, [], []);

    const present = report.data_classes.filter((d) => d.status === 'present').length;
    const partial = report.data_classes.filter((d) => d.status === 'partial').length;
    const expected = (present + partial * 0.5) / 7;

    expect(report.coverage_score).toBeCloseTo(expected, 2);
  });
});
