import { describe, expect, test } from 'bun:test';
import type { ProposedIntervention, SupervisionRequest } from '../hermes';
import {
  calculateAllInterventionRisks,
  calculateInterventionRisk,
  compareRiskLevels,
  getMaxRiskLevel,
} from './calculator';

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

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

// =============================================================================
// Tests: calculateInterventionRisk
// =============================================================================

describe('calculateInterventionRisk', () => {
  test('returns low risk for patient message with good epistemological data', () => {
    const p = proposal({
      proposal_id: 'p1',
      kind: 'PATIENT_MESSAGE',
      htv_score: { composite: 0.8 },
      evidence_refs: [{ ref_id: 'e1', evidence_grade: 'rct' }],
      uncertainty_calibration: { overall_level: 'low' },
    });
    const request = createMinimalRequest({ proposals: [p] });
    const result = calculateInterventionRisk(p, request);

    expect(result.proposal_id).toBe('p1');
    expect(result.proposal_kind).toBe('PATIENT_MESSAGE');
    expect(result.level).toBe('low');
    expect(result.factors).toHaveLength(5);
  });

  test('returns high risk for medication order proposal', () => {
    const p = proposal({
      proposal_id: 'p1',
      kind: 'MEDICATION_ORDER_PROPOSAL',
      medication: { name: 'lisinopril', rxnorm_code: '104377' },
      change: { change_type: 'start', to_dose: '10 mg daily' },
      clinician_protocol_ref: 'proto-123',
    });
    const request = createMinimalRequest({ proposals: [p] });
    const result = calculateInterventionRisk(p, request);

    expect(result.proposal_kind).toBe('MEDICATION_ORDER_PROPOSAL');
    expect(result.composite).toBeGreaterThanOrEqual(0.3);

    const kindFactor = result.factors.find((f) => f.factor === 'proposal_kind');
    expect(kindFactor?.score).toBe(1.0);
  });

  test('medication start change is higher risk than hold', () => {
    const startProposal = proposal({
      proposal_id: 'p-start',
      kind: 'MEDICATION_ORDER_PROPOSAL',
      medication: { name: 'lisinopril' },
      change: { change_type: 'start' },
    });
    const holdProposal = proposal({
      proposal_id: 'p-hold',
      kind: 'MEDICATION_ORDER_PROPOSAL',
      medication: { name: 'lisinopril' },
      change: { change_type: 'hold' },
    });
    const request = createMinimalRequest();

    const startResult = calculateInterventionRisk(startProposal, request);
    const holdResult = calculateInterventionRisk(holdProposal, request);

    const startMedFactor = startResult.factors.find((f) => f.factor === 'medication_factors');
    const holdMedFactor = holdResult.factors.find((f) => f.factor === 'medication_factors');

    expect(startMedFactor?.score).toBeGreaterThan(holdMedFactor?.score ?? 0);
  });

  test('missing clinician protocol ref increases medication risk', () => {
    const withProtocol = proposal({
      proposal_id: 'p-with',
      kind: 'MEDICATION_ORDER_PROPOSAL',
      medication: { name: 'lisinopril', rxnorm_code: '104377' },
      change: { change_type: 'start' },
      clinician_protocol_ref: 'proto-123',
    });
    const withoutProtocol = proposal({
      proposal_id: 'p-without',
      kind: 'MEDICATION_ORDER_PROPOSAL',
      medication: { name: 'lisinopril', rxnorm_code: '104377' },
      change: { change_type: 'start' },
    });
    const request = createMinimalRequest();

    const withResult = calculateInterventionRisk(withProtocol, request);
    const withoutResult = calculateInterventionRisk(withoutProtocol, request);

    expect(withoutResult.composite).toBeGreaterThan(withResult.composite);
  });

  test('non-medication proposals get zero medication_factors', () => {
    const p = proposal({ proposal_id: 'p1', kind: 'LIFESTYLE_MODIFICATION_PROPOSAL' });
    const request = createMinimalRequest({ proposals: [p] });
    const result = calculateInterventionRisk(p, request);

    const medFactor = result.factors.find((f) => f.factor === 'medication_factors');
    expect(medFactor?.score).toBe(0);
  });

  test('low HTV score increases epistemological risk', () => {
    const withHTV = proposal({
      proposal_id: 'p-good',
      kind: 'PATIENT_MESSAGE',
      htv_score: { composite: 0.8 },
    });
    const withLowHTV = proposal({
      proposal_id: 'p-low',
      kind: 'PATIENT_MESSAGE',
      htv_score: { composite: 0.2 },
    });
    const request = createMinimalRequest();

    const goodResult = calculateInterventionRisk(withHTV, request);
    const lowResult = calculateInterventionRisk(withLowHTV, request);

    const goodEpis = goodResult.factors.find((f) => f.factor === 'epistemological');
    const lowEpis = lowResult.factors.find((f) => f.factor === 'epistemological');

    expect(lowEpis?.score).toBeGreaterThan(goodEpis?.score ?? 0);
    expect(lowEpis?.rationale).toContain('Very low HTV');
  });

  test('missing snapshot increases data sufficiency risk', () => {
    const p = proposal({ proposal_id: 'p1' });
    const request = createMinimalRequest({
      snapshot: { snapshot_id: 'snap-1' } as SupervisionRequest['snapshot'],
      proposals: [p],
    });
    const result = calculateInterventionRisk(p, request);

    const dataFactor = result.factors.find((f) => f.factor === 'data_sufficiency');
    expect(dataFactor?.score).toBe(1.0);
    expect(dataFactor?.rationale).toContain('Snapshot missing');
  });

  test('stale snapshot increases data sufficiency risk', () => {
    const p = proposal({ proposal_id: 'p1' });
    const request = createMinimalRequest({
      mode: 'advocate_clinical',
      snapshot: {
        snapshot_id: 'snap-1',
        created_at: hoursAgo(6),
        sources: [{ source_type: 'ehr' }],
      } as SupervisionRequest['snapshot'],
      proposals: [p],
    });
    const result = calculateInterventionRisk(p, request);

    const dataFactor = result.factors.find((f) => f.factor === 'data_sufficiency');
    expect(dataFactor?.score).toBeGreaterThanOrEqual(0.5);
    expect(dataFactor?.rationale).toContain('Stale');
  });

  test('clinical mode increases clinical context risk', () => {
    const p = proposal({ proposal_id: 'p1' });
    const wellnessRequest = createMinimalRequest({ mode: 'wellness', proposals: [p] });
    const clinicalRequest = createMinimalRequest({ mode: 'advocate_clinical', proposals: [p] });

    const wellnessResult = calculateInterventionRisk(p, wellnessRequest);
    const clinicalResult = calculateInterventionRisk(p, clinicalRequest);

    const wellnessCtx = wellnessResult.factors.find((f) => f.factor === 'clinical_context');
    const clinicalCtx = clinicalResult.factors.find((f) => f.factor === 'clinical_context');

    expect(clinicalCtx?.score).toBeGreaterThan(wellnessCtx?.score ?? 0);
    expect(clinicalCtx?.rationale).toContain('Clinical mode');
  });

  test('patient acuity amplifies clinical context risk', () => {
    const p = proposal({ proposal_id: 'p1' });
    const request = createMinimalRequest({ proposals: [p] });

    const lowResult = calculateInterventionRisk(p, request, { patientAcuity: 'low' });
    const criticalResult = calculateInterventionRisk(p, request, { patientAcuity: 'critical' });

    const lowCtx = lowResult.factors.find((f) => f.factor === 'clinical_context');
    const criticalCtx = criticalResult.factors.find((f) => f.factor === 'clinical_context');

    expect(criticalCtx?.score).toBeGreaterThan(lowCtx?.score ?? 0);
    expect(criticalCtx?.rationale).toContain('critical');
  });

  test('worst-case medication proposal returns critical risk', () => {
    const p = proposal({
      proposal_id: 'p1',
      kind: 'MEDICATION_ORDER_PROPOSAL',
      medication: { name: 'unknown-drug' },
      change: { change_type: 'start' },
      // No protocol ref, no rxnorm, no HTV, no evidence
    });
    const request = createMinimalRequest({
      mode: 'advocate_clinical',
      snapshot: { snapshot_id: 'snap-1' } as SupervisionRequest['snapshot'],
      proposals: [p],
    });
    const result = calculateInterventionRisk(p, request, { patientAcuity: 'critical' });

    expect(result.level).toBe('critical');
    expect(result.composite).toBeGreaterThanOrEqual(0.75);
  });
});

// =============================================================================
// Tests: calculateAllInterventionRisks
// =============================================================================

describe('calculateAllInterventionRisks', () => {
  test('returns empty array for no proposals', () => {
    const request = createMinimalRequest();
    const results = calculateAllInterventionRisks(request);
    expect(results).toHaveLength(0);
  });

  test('returns one score per proposal', () => {
    const request = createMinimalRequest({
      proposals: [
        proposal({ proposal_id: 'p1', kind: 'PATIENT_MESSAGE' }),
        proposal({ proposal_id: 'p2', kind: 'MEDICATION_ORDER_PROPOSAL' }),
        proposal({ proposal_id: 'p3', kind: 'LIFESTYLE_MODIFICATION_PROPOSAL' }),
      ],
    });
    const results = calculateAllInterventionRisks(request);

    expect(results).toHaveLength(3);
    expect(results.map((r) => r.proposal_id)).toEqual(['p1', 'p2', 'p3']);
  });

  test('medication proposal scores higher than lifestyle proposal', () => {
    const request = createMinimalRequest({
      proposals: [
        proposal({ proposal_id: 'p-med', kind: 'MEDICATION_ORDER_PROPOSAL' }),
        proposal({ proposal_id: 'p-life', kind: 'LIFESTYLE_MODIFICATION_PROPOSAL' }),
      ],
    });
    const results = calculateAllInterventionRisks(request);

    const medScore = results.find((r) => r.proposal_id === 'p-med');
    const lifeScore = results.find((r) => r.proposal_id === 'p-life');

    expect(medScore?.composite).toBeGreaterThan(lifeScore?.composite ?? 0);
  });
});

// =============================================================================
// Tests: compareRiskLevels
// =============================================================================

describe('compareRiskLevels', () => {
  test('low < moderate < high < critical', () => {
    expect(compareRiskLevels('low', 'moderate')).toBeLessThan(0);
    expect(compareRiskLevels('moderate', 'high')).toBeLessThan(0);
    expect(compareRiskLevels('high', 'critical')).toBeLessThan(0);
  });

  test('equal levels return 0', () => {
    expect(compareRiskLevels('high', 'high')).toBe(0);
  });
});

// =============================================================================
// Tests: getMaxRiskLevel
// =============================================================================

describe('getMaxRiskLevel', () => {
  test('returns low for empty array', () => {
    expect(getMaxRiskLevel([])).toBe('low');
  });

  test('returns highest risk level', () => {
    const scores = [
      { proposal_id: 'p1', proposal_kind: 'X', level: 'low' as const, composite: 0.1, factors: [] },
      {
        proposal_id: 'p2',
        proposal_kind: 'Y',
        level: 'high' as const,
        composite: 0.6,
        factors: [],
      },
      {
        proposal_id: 'p3',
        proposal_kind: 'Z',
        level: 'moderate' as const,
        composite: 0.3,
        factors: [],
      },
    ];
    expect(getMaxRiskLevel(scores)).toBe('high');
  });
});
