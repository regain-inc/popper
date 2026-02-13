/**
 * Deterministic Hallucination Detector Tests
 * @see SAL-1017
 */

import { describe, expect, test } from 'bun:test';
import type { ProposedIntervention, SupervisionRequest } from '../hermes';
import { detectHallucinations } from './detector';

// =============================================================================
// Test Helpers
// =============================================================================

function createMinimalRequest(overrides: Partial<SupervisionRequest> = {}): SupervisionRequest {
  return {
    hermes_version: '2.0.0',
    message_type: 'supervision_request',
    trace: {
      trace_id: 'test-trace-1',
      created_at: new Date().toISOString(),
      producer: { system: 'deutsch', service_version: '1.0.0' },
    },
    mode: 'wellness',
    subject: { subject_type: 'patient', subject_id: 'patient-123' },
    snapshot: {
      snapshot_id: 'snap-1',
      created_at: new Date().toISOString(),
      sources: [{ source_type: 'ehr' }],
    },
    proposals: [],
    audit_redaction: {
      summary: 'test',
      proposal_summaries: [],
    },
    ...overrides,
  } as SupervisionRequest;
}

function proposal(overrides: Record<string, unknown>): ProposedIntervention {
  return {
    proposal_id: `prop-${Math.random().toString(36).slice(2, 6)}`,
    kind: 'PATIENT_MESSAGE',
    created_at: new Date().toISOString(),
    audit_redaction: { summary: 'test' },
    ...overrides,
  } as ProposedIntervention;
}

// =============================================================================
// Tests: Clean request (no hallucination)
// =============================================================================

describe('detectHallucinations', () => {
  test('returns no detection for clean request with no proposals', () => {
    const request = createMinimalRequest();
    const result = detectHallucinations(request);

    expect(result.detected).toBe(false);
    expect(result.signals).toHaveLength(0);
    expect(result.severity).toBeUndefined();
  });

  test('returns no detection for clean request with valid evidence', () => {
    const request = createMinimalRequest({
      proposals: [
        proposal({
          proposal_id: 'p1',
          evidence_refs: [
            {
              evidence_id: 'e1',
              evidence_type: 'guideline',
              citation: 'ACC/AHA HF Guideline 2024',
            },
            {
              evidence_id: 'e2',
              evidence_type: 'study',
              citation: 'SPRINT Trial 2015',
            },
          ],
        }),
      ],
    });
    const result = detectHallucinations(request);

    expect(result.detected).toBe(false);
    expect(result.signals).toHaveLength(0);
  });

  // ===========================================================================
  // Evidence Ref Checks
  // ===========================================================================

  describe('evidence ref checks', () => {
    test('detects empty evidence_id', () => {
      const request = createMinimalRequest({
        proposals: [
          proposal({
            proposal_id: 'p1',
            evidence_refs: [{ evidence_id: '', evidence_type: 'guideline', citation: 'Test' }],
          }),
        ],
      });
      const result = detectHallucinations(request);

      expect(result.detected).toBe(true);
      expect(result.severity).toBe('significant');
      const signal = result.signals.find((s) => s.type === 'empty_evidence_id');
      expect(signal).toBeDefined();
      expect(signal?.proposal_id).toBe('p1');
    });

    test('detects missing citation', () => {
      const request = createMinimalRequest({
        proposals: [
          proposal({
            proposal_id: 'p1',
            evidence_refs: [{ evidence_id: 'e1', evidence_type: 'study' }],
          }),
        ],
      });
      const result = detectHallucinations(request);

      expect(result.detected).toBe(true);
      expect(result.severity).toBe('minor');
      const signal = result.signals.find((s) => s.type === 'missing_citation');
      expect(signal).toBeDefined();
    });

    test('detects empty citation', () => {
      const request = createMinimalRequest({
        proposals: [
          proposal({
            proposal_id: 'p1',
            evidence_refs: [{ evidence_id: 'e1', evidence_type: 'study', citation: '   ' }],
          }),
        ],
      });
      const result = detectHallucinations(request);

      expect(result.detected).toBe(true);
      const signal = result.signals.find((s) => s.type === 'empty_citation');
      expect(signal).toBeDefined();
    });

    test('detects duplicate evidence IDs within a proposal', () => {
      const request = createMinimalRequest({
        proposals: [
          proposal({
            proposal_id: 'p1',
            evidence_refs: [
              { evidence_id: 'e1', evidence_type: 'guideline', citation: 'Guideline A' },
              { evidence_id: 'e1', evidence_type: 'study', citation: 'Study B' },
            ],
          }),
        ],
      });
      const result = detectHallucinations(request);

      expect(result.detected).toBe(true);
      const signal = result.signals.find((s) => s.type === 'duplicate_evidence_id');
      expect(signal).toBeDefined();
      expect(signal?.severity).toBe('significant');
    });

    test('allows same evidence ID across different proposals', () => {
      const request = createMinimalRequest({
        proposals: [
          proposal({
            proposal_id: 'p1',
            evidence_refs: [
              { evidence_id: 'e1', evidence_type: 'guideline', citation: 'Guideline A' },
            ],
          }),
          proposal({
            proposal_id: 'p2',
            evidence_refs: [
              { evidence_id: 'e1', evidence_type: 'guideline', citation: 'Guideline A' },
            ],
          }),
        ],
      });
      const result = detectHallucinations(request);

      expect(result.detected).toBe(false);
    });
  });

  // ===========================================================================
  // Temporal Consistency Checks
  // ===========================================================================

  describe('temporal consistency', () => {
    test('detects future proposal created_at', () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour ahead
      const request = createMinimalRequest({
        proposals: [
          proposal({
            proposal_id: 'p1',
            created_at: futureDate,
          }),
        ],
      });
      const result = detectHallucinations(request);

      expect(result.detected).toBe(true);
      const signal = result.signals.find((s) => s.type === 'future_timestamp');
      expect(signal).toBeDefined();
      expect(signal?.severity).toBe('significant');
      expect(signal?.proposal_id).toBe('p1');
    });

    test('allows small clock drift (within 5 minutes)', () => {
      const slightFuture = new Date(Date.now() + 2 * 60 * 1000).toISOString(); // 2 min ahead
      const request = createMinimalRequest({
        proposals: [
          proposal({
            proposal_id: 'p1',
            created_at: slightFuture,
          }),
        ],
      });
      const result = detectHallucinations(request);

      const futureSignals = result.signals.filter(
        (s) => s.type === 'future_timestamp' && s.proposal_id === 'p1',
      );
      expect(futureSignals).toHaveLength(0);
    });

    test('detects future evidence publication_date', () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const request = createMinimalRequest({
        proposals: [
          proposal({
            proposal_id: 'p1',
            evidence_refs: [
              {
                evidence_id: 'e1',
                evidence_type: 'study',
                citation: 'Future Study',
                publication_date: futureDate,
              },
            ],
          }),
        ],
      });
      const result = detectHallucinations(request);

      expect(result.detected).toBe(true);
      const signal = result.signals.find(
        (s) => s.type === 'future_timestamp' && s.description.includes('publication_date'),
      );
      expect(signal).toBeDefined();
      expect(signal?.severity).toBe('minor');
    });
  });

  // ===========================================================================
  // Snapshot Hash Checks
  // ===========================================================================

  describe('snapshot hash', () => {
    test('detects snapshot hash mismatch', () => {
      const request = createMinimalRequest({
        snapshot: {
          snapshot_id: 'snap-1',
          created_at: new Date().toISOString(),
          snapshot_hash: 'declared-hash-abc123',
          sources: [{ source_type: 'ehr' }],
        } as SupervisionRequest['snapshot'],
      });
      // Add snapshot_payload that won't match the declared hash
      (request as Record<string, unknown>).snapshot_payload = {
        some: 'data',
      };

      const result = detectHallucinations(request);

      expect(result.detected).toBe(true);
      const signal = result.signals.find((s) => s.type === 'snapshot_hash_mismatch');
      expect(signal).toBeDefined();
      expect(signal?.severity).toBe('critical');
    });

    test('skips hash check when no snapshot_payload', () => {
      const request = createMinimalRequest({
        snapshot: {
          snapshot_id: 'snap-1',
          created_at: new Date().toISOString(),
          snapshot_hash: 'some-hash',
          sources: [{ source_type: 'ehr' }],
        } as SupervisionRequest['snapshot'],
      });

      const result = detectHallucinations(request);

      const hashSignals = result.signals.filter((s) => s.type === 'snapshot_hash_mismatch');
      expect(hashSignals).toHaveLength(0);
    });

    test('skips hash check when no snapshot_hash', () => {
      const request = createMinimalRequest();
      (request as Record<string, unknown>).snapshot_payload = { some: 'data' };

      const result = detectHallucinations(request);

      const hashSignals = result.signals.filter((s) => s.type === 'snapshot_hash_mismatch');
      expect(hashSignals).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Upstream Flag Extraction
  // ===========================================================================

  describe('upstream hallucination flag', () => {
    test('extracts upstream hallucination flag from Deutsch', () => {
      const request = createMinimalRequest();
      (request as Record<string, unknown>).hallucination_detection = {
        detected: true,
        severity: 'critical',
        description: 'Fabricated medication contraindication detected',
      };

      const result = detectHallucinations(request);

      expect(result.detected).toBe(true);
      expect(result.severity).toBe('critical');
      const signal = result.signals.find((s) => s.type === 'upstream_flag');
      expect(signal).toBeDefined();
      expect(signal?.severity).toBe('critical');
      expect(signal?.description).toContain('Fabricated');
    });

    test('defaults upstream severity to significant when not specified', () => {
      const request = createMinimalRequest();
      (request as Record<string, unknown>).hallucination_detection = {
        detected: true,
      };

      const result = detectHallucinations(request);

      expect(result.detected).toBe(true);
      expect(result.severity).toBe('significant');
    });

    test('ignores upstream flag when detected is false', () => {
      const request = createMinimalRequest();
      (request as Record<string, unknown>).hallucination_detection = {
        detected: false,
        severity: 'critical',
      };

      const result = detectHallucinations(request);

      expect(result.detected).toBe(false);
    });
  });

  // ===========================================================================
  // Severity Aggregation
  // ===========================================================================

  describe('severity aggregation', () => {
    test('returns highest severity across all signals', () => {
      const request = createMinimalRequest({
        proposals: [
          proposal({
            proposal_id: 'p1',
            evidence_refs: [
              // minor: missing citation
              { evidence_id: 'e1', evidence_type: 'study' },
            ],
          }),
        ],
      });
      // Add critical upstream flag
      (request as Record<string, unknown>).hallucination_detection = {
        detected: true,
        severity: 'critical',
      };

      const result = detectHallucinations(request);

      expect(result.detected).toBe(true);
      expect(result.severity).toBe('critical');
      expect(result.signals.length).toBeGreaterThan(1);
    });

    test('multiple minor signals stay minor', () => {
      const request = createMinimalRequest({
        proposals: [
          proposal({
            proposal_id: 'p1',
            evidence_refs: [
              { evidence_id: 'e1', evidence_type: 'study' },
              { evidence_id: 'e2', evidence_type: 'guideline' },
            ],
          }),
        ],
      });
      const result = detectHallucinations(request);

      expect(result.detected).toBe(true);
      expect(result.severity).toBe('minor');
      // Both missing citations
      expect(result.signals.every((s) => s.severity === 'minor')).toBe(true);
    });
  });
});
