/**
 * Tests for PHI redaction utilities
 */

import { describe, expect, it } from 'bun:test';
import type { ProposedIntervention, SupervisionRequest } from '@regain/hermes';
import { buildAuditTags, extractRequestMetadata, redactPHI } from './redaction';

describe('PHI Redaction', () => {
  describe('redactPHI', () => {
    it('redacts known PHI field names', () => {
      const input = {
        mode: 'wellness',
        patient_name: 'John Doe',
        email: 'john@example.com',
        phone: '555-1234',
        ssn: '123-45-6789',
      };

      const result = redactPHI(input);

      expect(result.mode).toBe('wellness');
      expect(result.patient_name).toBe('[REDACTED]');
      expect(result.email).toBe('[REDACTED]');
      expect(result.phone).toBe('[REDACTED]');
      expect(result.ssn).toBe('[REDACTED]');
    });

    it('redacts fields containing PHI keywords', () => {
      const input = {
        user_email_address: 'user@example.com',
        patient_data: { value: 123 },
        clinical_notes_summary: 'Some notes',
        medication_list: ['med1', 'med2'],
      };

      const result = redactPHI(input);

      expect(result.user_email_address).toBe('[REDACTED]');
      expect(result.patient_data).toBe('[REDACTED]');
      expect(result.clinical_notes_summary).toBe('[REDACTED]');
      expect(result.medication_list).toBe('[REDACTED]');
    });

    it('preserves non-PHI fields', () => {
      const input = {
        mode: 'advocate_clinical',
        proposal_count: 3,
        decision: 'APPROVED',
        latency_ms: 15.5,
        tags: ['high_risk', 'urgent'],
      };

      const result = redactPHI(input);

      expect(result.mode).toBe('advocate_clinical');
      expect(result.proposal_count).toBe(3);
      expect(result.decision).toBe('APPROVED');
      expect(result.latency_ms).toBe(15.5);
      expect(result.tags).toEqual(['high_risk', 'urgent']);
    });

    it('handles nested objects', () => {
      const input = {
        metadata: {
          mode: 'wellness',
          subject: {
            subject_id: 'sub-123',
            patient_name: 'Jane Doe',
          },
        },
      };

      const result = redactPHI(input);
      const metadata = result.metadata as Record<string, unknown>;
      const subject = metadata.subject as Record<string, unknown>;

      expect(metadata.mode).toBe('wellness');
      expect(subject.subject_id).toBe('sub-123');
      expect(subject.patient_name).toBe('[REDACTED]');
    });

    it('handles arrays', () => {
      const input = {
        items: [
          { id: 1, name: 'Item 1' },
          { id: 2, patient_info: 'PHI data' },
        ],
        tags: ['tag1', 'tag2'],
      };

      const result = redactPHI(input);
      const items = result.items as Array<Record<string, unknown>>;

      expect(items[0].id).toBe(1);
      expect(items[0].name).toBe('[REDACTED]');
      expect(items[1].id).toBe(2);
      expect(items[1].patient_info).toBe('[REDACTED]');
      expect(result.tags).toEqual(['tag1', 'tag2']);
    });

    it('handles null and undefined values', () => {
      const input = {
        mode: 'wellness',
        optional_field: null,
        missing_field: undefined,
      };

      const result = redactPHI(input);

      expect(result.mode).toBe('wellness');
      expect(result.optional_field).toBeNull();
      expect(result.missing_field).toBeUndefined();
    });

    it('handles deep nesting with max depth', () => {
      const input = {
        l1: {
          l2: {
            l3: {
              l4: {
                l5: {
                  l6: {
                    deep_value: 'should be replaced',
                  },
                },
              },
            },
          },
        },
      };

      const result = redactPHI(input);
      const l5 = (
        (
          ((result.l1 as Record<string, unknown>).l2 as Record<string, unknown>).l3 as Record<
            string,
            unknown
          >
        ).l4 as Record<string, unknown>
      ).l5 as Record<string, unknown>;

      expect(l5.l6).toEqual({ _redacted: 'max_depth_exceeded' });
    });
  });

  describe('extractRequestMetadata', () => {
    it('extracts mode and proposal metadata', () => {
      const request: Partial<SupervisionRequest> = {
        mode: 'wellness',
        proposals: [
          { kind: 'PATIENT_MESSAGE', proposal_id: 'p1' } as ProposedIntervention,
          { kind: 'TRIAGE_ROUTE', proposal_id: 'p2' } as ProposedIntervention,
        ],
        snapshot: {
          snapshot_id: 'snap-123',
        },
      };

      const metadata = extractRequestMetadata(request as SupervisionRequest);

      expect(metadata.mode).toBe('wellness');
      expect(metadata.proposal_count).toBe(2);
      expect(metadata.proposal_kinds).toEqual(['PATIENT_MESSAGE', 'TRIAGE_ROUTE']);
    });

    it('handles missing proposals', () => {
      const request: Partial<SupervisionRequest> = {
        mode: 'wellness',
      };

      const metadata = extractRequestMetadata(request as SupervisionRequest);

      expect(metadata.proposal_count).toBe(0);
      expect(metadata.proposal_kinds).toEqual([]);
    });

    it('includes input risk flags if present', () => {
      const request: Partial<SupervisionRequest> = {
        mode: 'wellness',
        proposals: [],
        input_risk: {
          flags: ['prompt_injection_suspected'],
        },
      };

      const metadata = extractRequestMetadata(request as SupervisionRequest);

      expect(metadata.input_risk_flags).toEqual(['prompt_injection_suspected']);
    });
  });

  describe('buildAuditTags', () => {
    it('adds high_risk tag for medication proposals', () => {
      const request: Partial<SupervisionRequest> = {
        mode: 'wellness',
        proposals: [
          { kind: 'MEDICATION_ORDER_PROPOSAL', proposal_id: 'p1' } as ProposedIntervention,
        ],
      };

      const tags = buildAuditTags(request as SupervisionRequest, 'APPROVED', false, false);

      expect(tags).toContain('high_risk');
      expect(tags).not.toContain('low_risk');
    });

    it('adds low_risk tag for patient message proposals', () => {
      const request: Partial<SupervisionRequest> = {
        mode: 'wellness',
        proposals: [{ kind: 'PATIENT_MESSAGE', proposal_id: 'p1' } as ProposedIntervention],
      };

      const tags = buildAuditTags(request as SupervisionRequest, 'APPROVED', false, false);

      expect(tags).toContain('low_risk');
      expect(tags).not.toContain('high_risk');
    });

    it('adds stale_snapshot tag when stale', () => {
      const request: Partial<SupervisionRequest> = {
        mode: 'wellness',
        proposals: [],
      };

      const tags = buildAuditTags(request as SupervisionRequest, 'REQUEST_MORE_INFO', true, false);

      expect(tags).toContain('stale_snapshot');
    });

    it('handles triage route as high risk', () => {
      const request: Partial<SupervisionRequest> = {
        mode: 'advocate_clinical',
        proposals: [{ kind: 'TRIAGE_ROUTE', proposal_id: 'p1' } as ProposedIntervention],
      };

      const tags = buildAuditTags(
        request as SupervisionRequest,
        'ROUTE_TO_CLINICIAN',
        false,
        false,
      );

      expect(tags).toContain('high_risk');
    });
  });
});
