import { describe, expect, test } from 'bun:test';
import type { ProposedIntervention, SupervisionRequest } from '../hermes';
import { compareAcuityLevels, computeAcuity } from './scorer';
import { DEFAULT_ACUITY_CONFIG } from './types';

// =============================================================================
// Test Helpers
// =============================================================================

function createMinimalRequest(overrides: Partial<SupervisionRequest> = {}): SupervisionRequest {
  return {
    hermes_version: '1.6.0',
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
    },
    proposals: [],
    audit_redaction: {
      summary: 'test',
      proposal_summaries: [],
    },
    ...overrides,
  } as SupervisionRequest;
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function proposal(overrides: Record<string, unknown>): ProposedIntervention {
  return {
    proposal_id: `prop-${Math.random().toString(36).slice(2, 6)}`,
    kind: 'PATIENT_MESSAGE',
    created_at: new Date().toISOString(),
    ...overrides,
  } as ProposedIntervention;
}

// =============================================================================
// Tests
// =============================================================================

describe('computeAcuity', () => {
  test('returns low acuity for minimal request with no proposals', () => {
    const request = createMinimalRequest();
    const result = computeAcuity(request);

    expect(result.level).toBe('low');
    expect(result.composite).toBeGreaterThanOrEqual(0);
    expect(result.composite).toBeLessThan(DEFAULT_ACUITY_CONFIG.thresholds.moderate);
    expect(result.dimensions).toHaveLength(4);
  });

  test('returns high acuity for medication order proposals', () => {
    const request = createMinimalRequest({
      proposals: [proposal({ proposal_id: 'prop-1', kind: 'MEDICATION_ORDER_PROPOSAL' })],
    });
    const result = computeAcuity(request);

    // Medication order gets 1.0 on proposal_risk (weight 0.35)
    expect(result.composite).toBeGreaterThanOrEqual(0.25);
    const proposalDim = result.dimensions.find((d) => d.dimension === 'proposal_risk');
    expect(proposalDim?.score).toBe(1.0);
  });

  test('returns low proposal risk for lifestyle modifications', () => {
    const request = createMinimalRequest({
      proposals: [proposal({ proposal_id: 'prop-1', kind: 'LIFESTYLE_MODIFICATION_PROPOSAL' })],
    });
    const result = computeAcuity(request);

    const proposalDim = result.dimensions.find((d) => d.dimension === 'proposal_risk');
    expect(proposalDim?.score).toBe(0.2);
  });

  test('scores data quality high when snapshot is missing', () => {
    const request = createMinimalRequest({
      snapshot: { snapshot_id: 'snap-1' } as SupervisionRequest['snapshot'],
    });
    const result = computeAcuity(request);

    const dataDim = result.dimensions.find((d) => d.dimension === 'data_quality');
    expect(dataDim?.score).toBe(1.0);
    expect(dataDim?.rationale).toContain('Snapshot missing');
  });

  test('scores data quality high for stale snapshot in clinical mode', () => {
    const request = createMinimalRequest({
      mode: 'advocate_clinical',
      snapshot: {
        snapshot_id: 'snap-1',
        created_at: hoursAgo(6),
      } as SupervisionRequest['snapshot'],
    });
    const result = computeAcuity(request);

    const dataDim = result.dimensions.find((d) => d.dimension === 'data_quality');
    expect(dataDim?.score).toBeGreaterThanOrEqual(0.6);
    expect(dataDim?.rationale).toContain('Stale');
  });

  test('scores data quality low for fresh snapshot with good sources', () => {
    const request = createMinimalRequest({
      snapshot: {
        snapshot_id: 'snap-1',
        created_at: new Date().toISOString(),
        sources: [{ source_type: 'ehr' }, { source_type: 'patient_reported' }],
      } as SupervisionRequest['snapshot'],
    });
    const result = computeAcuity(request);

    const dataDim = result.dimensions.find((d) => d.dimension === 'data_quality');
    expect(dataDim?.score).toBe(0);
    expect(dataDim?.rationale).toContain('Good data quality');
  });

  test('increases epistemological risk for low HTV scores', () => {
    const request = createMinimalRequest({
      proposals: [
        proposal({
          proposal_id: 'prop-1',
          kind: 'PATIENT_MESSAGE',
          htv_score: { composite: 0.2 },
        }),
      ],
    });
    const result = computeAcuity(request);

    const episDim = result.dimensions.find((d) => d.dimension === 'epistemological_quality');
    expect(episDim?.score).toBeGreaterThanOrEqual(0.5);
    expect(episDim?.rationale).toContain('Very low HTV');
  });

  test('increases conflict severity for escalated conflicts', () => {
    const request = createMinimalRequest({
      cross_domain_conflicts: [
        {
          conflict_id: 'c-1',
          conflict_type: 'drug_interaction',
          resolution_strategy: 'escalate',
        },
        {
          conflict_id: 'c-2',
          conflict_type: 'contraindication',
          evidence_refs: [],
        },
      ],
    } as Partial<SupervisionRequest>);
    const result = computeAcuity(request);

    const conflictDim = result.dimensions.find((d) => d.dimension === 'conflict_severity');
    expect(conflictDim?.score).toBeGreaterThanOrEqual(0.5);
  });

  test('returns critical acuity for worst-case scenario', () => {
    const request = createMinimalRequest({
      mode: 'advocate_clinical',
      snapshot: { snapshot_id: 'snap-1' } as SupervisionRequest['snapshot'],
      proposals: [
        proposal({
          proposal_id: 'prop-1',
          kind: 'MEDICATION_ORDER_PROPOSAL',
          htv_score: { composite: 0.15 },
          uncertainty_calibration: { overall_level: 'high' },
        }),
      ],
      cross_domain_conflicts: [
        { conflict_id: 'c-1', conflict_type: 'x', resolution_strategy: 'escalate' },
        { conflict_id: 'c-2', conflict_type: 'y', resolution_strategy: 'escalate' },
        { conflict_id: 'c-3', conflict_type: 'z' },
      ],
    } as Partial<SupervisionRequest>);
    const result = computeAcuity(request);

    expect(result.level).toBe('critical');
    expect(result.composite).toBeGreaterThanOrEqual(0.75);
  });

  test('uses max risk across multiple proposals', () => {
    const request = createMinimalRequest({
      proposals: [
        proposal({ proposal_id: 'prop-1', kind: 'PATIENT_MESSAGE' }),
        proposal({ proposal_id: 'prop-2', kind: 'MEDICATION_ORDER_PROPOSAL' }),
      ],
    });
    const result = computeAcuity(request);

    const proposalDim = result.dimensions.find((d) => d.dimension === 'proposal_risk');
    expect(proposalDim?.score).toBe(1.0);
    expect(proposalDim?.rationale).toContain('MEDICATION_ORDER_PROPOSAL');
  });
});

describe('compareAcuityLevels', () => {
  test('low < moderate < high < critical', () => {
    expect(compareAcuityLevels('low', 'moderate')).toBeLessThan(0);
    expect(compareAcuityLevels('moderate', 'high')).toBeLessThan(0);
    expect(compareAcuityLevels('high', 'critical')).toBeLessThan(0);
  });

  test('equal levels return 0', () => {
    expect(compareAcuityLevels('high', 'high')).toBe(0);
  });

  test('critical > low', () => {
    expect(compareAcuityLevels('critical', 'low')).toBeGreaterThan(0);
  });
});
