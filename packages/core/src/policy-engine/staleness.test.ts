/**
 * Staleness Validator Tests
 */

import { describe, expect, test } from 'bun:test';
import type { SupervisionRequest } from '../hermes';
import {
  createStalenessValidator,
  DEFAULT_STALENESS_THRESHOLDS,
  defaultStalenessValidator,
  HIGH_RISK_PROPOSAL_KINDS,
  StalenessValidator,
} from './staleness';

// =============================================================================
// Test Helpers
// =============================================================================

const createRequest = (
  mode: 'wellness' | 'advocate_clinical',
  snapshotAge?: number, // hours ago, undefined = no snapshot
  proposals: SupervisionRequest['proposals'] = [],
): SupervisionRequest => {
  const request: SupervisionRequest = {
    hermes_version: '2.0.0',
    mode,
    trace: {
      request_id: 'test-request-1',
      created_at: new Date().toISOString(),
      producer: {
        system_id: 'test-system',
        system_version: '1.0.0',
      },
    },
    subject: {
      subject_id: 'patient-123',
      subject_type: 'patient',
    },
    proposals,
  };

  if (snapshotAge !== undefined) {
    const snapshotTime = new Date(Date.now() - snapshotAge * 60 * 60 * 1000);
    (request as Record<string, unknown>).snapshot = {
      snapshot_id: 'snap-001',
      created_at: snapshotTime.toISOString(),
    };
  }

  return request;
};

// =============================================================================
// Tests
// =============================================================================

describe('StalenessValidator', () => {
  describe('Default Configuration', () => {
    test('uses default thresholds', () => {
      const validator = new StalenessValidator();
      const config = validator.getConfig();

      expect(config.thresholds.wellness_hours).toBe(24);
      expect(config.thresholds.clinical_hours).toBe(4);
    });

    test('DEFAULT_STALENESS_THRESHOLDS matches spec', () => {
      expect(DEFAULT_STALENESS_THRESHOLDS.wellness_hours).toBe(24);
      expect(DEFAULT_STALENESS_THRESHOLDS.clinical_hours).toBe(4);
    });

    test('allows custom thresholds', () => {
      const validator = new StalenessValidator({
        thresholds: {
          wellness_hours: 48,
          clinical_hours: 2,
        },
      });
      const config = validator.getConfig();

      expect(config.thresholds.wellness_hours).toBe(48);
      expect(config.thresholds.clinical_hours).toBe(2);
    });

    test('partial threshold override preserves defaults', () => {
      const validator = new StalenessValidator({
        thresholds: {
          wellness_hours: 48,
          clinical_hours: 4, // Keep default
        },
      });
      const config = validator.getConfig();

      expect(config.thresholds.wellness_hours).toBe(48);
      expect(config.thresholds.clinical_hours).toBe(4);
    });
  });

  describe('Missing Snapshot Detection', () => {
    test('detects missing snapshot', () => {
      const validator = new StalenessValidator();
      const request = createRequest('wellness', undefined);

      const result = validator.validate(request);

      expect(result.is_missing).toBe(true);
      expect(result.is_stale).toBe(false);
      expect(result.age_hours).toBeUndefined();
    });

    test('detects missing timestamp in snapshot', () => {
      const validator = new StalenessValidator();
      const request = createRequest('wellness', undefined);
      (request as Record<string, unknown>).snapshot = { snapshot_id: 'snap-001' }; // No created_at

      const result = validator.validate(request);

      expect(result.is_missing).toBe(true);
    });

    test('HARD_STOP recommended for missing snapshot', () => {
      const validator = new StalenessValidator();
      const request = createRequest('wellness', undefined);

      const result = validator.validate(request);
      const decision = validator.getRecommendedDecision(result, 'low');

      expect(decision).toBe('HARD_STOP');
    });
  });

  describe('Wellness Mode Validation', () => {
    test('fresh snapshot (< 24h) passes in wellness mode', () => {
      const validator = new StalenessValidator();
      const request = createRequest('wellness', 12); // 12 hours old

      const result = validator.validate(request);

      expect(result.is_stale).toBe(false);
      expect(result.is_missing).toBe(false);
      expect(result.age_hours).toBeCloseTo(12, 0);
      expect(result.threshold_hours).toBe(24);
    });

    test('stale snapshot (> 24h) fails in wellness mode', () => {
      const validator = new StalenessValidator();
      const request = createRequest('wellness', 25); // 25 hours old

      const result = validator.validate(request);

      expect(result.is_stale).toBe(true);
      expect(result.is_missing).toBe(false);
      expect(result.age_hours).toBeCloseTo(25, 0);
    });

    test('exactly 24h is not stale (boundary)', () => {
      const validator = new StalenessValidator();
      const request = createRequest('wellness', 24); // Exactly 24 hours

      const result = validator.validate(request);

      expect(result.is_stale).toBe(false);
    });

    test('24.1h is stale (boundary)', () => {
      const validator = new StalenessValidator();
      const request = createRequest('wellness', 24.1);

      const result = validator.validate(request);

      expect(result.is_stale).toBe(true);
    });
  });

  describe('Clinical Mode Validation', () => {
    test('fresh snapshot (< 4h) passes in clinical mode', () => {
      const validator = new StalenessValidator();
      const request = createRequest('advocate_clinical', 2); // 2 hours old

      const result = validator.validate(request);

      expect(result.is_stale).toBe(false);
      expect(result.threshold_hours).toBe(4);
    });

    test('stale snapshot (> 4h) fails in clinical mode', () => {
      const validator = new StalenessValidator();
      const request = createRequest('advocate_clinical', 5); // 5 hours old

      const result = validator.validate(request);

      expect(result.is_stale).toBe(true);
      expect(result.age_hours).toBeCloseTo(5, 0);
    });

    test('12h snapshot is stale in clinical but fresh in wellness', () => {
      const validator = new StalenessValidator();
      const clinicalRequest = createRequest('advocate_clinical', 12);
      const wellnessRequest = createRequest('wellness', 12);

      const clinicalResult = validator.validate(clinicalRequest);
      const wellnessResult = validator.validate(wellnessRequest);

      expect(clinicalResult.is_stale).toBe(true);
      expect(wellnessResult.is_stale).toBe(false);
    });
  });

  describe('Decision Matrix', () => {
    test('low-risk + stale (wellness) → REQUEST_MORE_INFO', () => {
      const validator = new StalenessValidator();
      const request = createRequest('wellness', 25);

      const result = validator.validate(request);
      const decision = validator.getRecommendedDecision(result, 'low');

      expect(decision).toBe('REQUEST_MORE_INFO');
    });

    test('high-risk + stale (wellness) → ROUTE_TO_CLINICIAN', () => {
      const validator = new StalenessValidator();
      const request = createRequest('wellness', 25);

      const result = validator.validate(request);
      const decision = validator.getRecommendedDecision(result, 'high');

      expect(decision).toBe('ROUTE_TO_CLINICIAN');
    });

    test('any + stale (clinical) → ROUTE_TO_CLINICIAN', () => {
      const validator = new StalenessValidator();
      const request = createRequest('advocate_clinical', 5);

      const result = validator.validate(request);
      const lowRiskDecision = validator.getRecommendedDecision(result, 'low');
      const highRiskDecision = validator.getRecommendedDecision(result, 'high');

      expect(lowRiskDecision).toBe('ROUTE_TO_CLINICIAN');
      expect(highRiskDecision).toBe('ROUTE_TO_CLINICIAN');
    });

    test('fresh snapshot → APPROVED', () => {
      const validator = new StalenessValidator();
      const request = createRequest('wellness', 12);

      const result = validator.validate(request);
      const decision = validator.getRecommendedDecision(result, 'low');

      expect(decision).toBe('APPROVED');
    });

    test('missing → HARD_STOP regardless of risk', () => {
      const validator = new StalenessValidator();
      const request = createRequest('wellness', undefined);

      const result = validator.validate(request);

      expect(validator.getRecommendedDecision(result, 'low')).toBe('HARD_STOP');
      expect(validator.getRecommendedDecision(result, 'high')).toBe('HARD_STOP');
    });
  });

  describe('Risk Level Detection', () => {
    test('detects high-risk MEDICATION_ORDER_PROPOSAL', () => {
      const validator = new StalenessValidator();
      const request = createRequest('wellness', 12, [
        {
          kind: 'MEDICATION_ORDER_PROPOSAL',
          proposal_id: 'p1',
          medication: { name: 'Test' },
          change: { change_type: 'titrate' },
        },
      ]);

      const riskLevel = validator.determineRiskLevel(request);

      expect(riskLevel).toBe('high');
    });

    test('detects high-risk TRIAGE_ROUTE', () => {
      const validator = new StalenessValidator();
      const request = createRequest('wellness', 12, [
        {
          kind: 'TRIAGE_ROUTE',
          proposal_id: 'p1',
          urgency: 'routine',
          route_to: 'care_team',
          reason: 'Test',
        },
      ]);

      const riskLevel = validator.determineRiskLevel(request);

      expect(riskLevel).toBe('high');
    });

    test('detects low-risk PATIENT_MESSAGE', () => {
      const validator = new StalenessValidator();
      const request = createRequest('wellness', 12, [
        {
          kind: 'PATIENT_MESSAGE',
          proposal_id: 'p1',
          message_markdown: 'Hello',
        },
      ]);

      const riskLevel = validator.determineRiskLevel(request);

      expect(riskLevel).toBe('low');
    });

    test('mixed proposals with any high-risk → high', () => {
      const validator = new StalenessValidator();
      const request = createRequest('wellness', 12, [
        {
          kind: 'PATIENT_MESSAGE',
          proposal_id: 'p1',
          message_markdown: 'Hello',
        },
        {
          kind: 'MEDICATION_ORDER_PROPOSAL',
          proposal_id: 'p2',
          medication: { name: 'Test' },
          change: { change_type: 'titrate' },
        },
      ]);

      const riskLevel = validator.determineRiskLevel(request);

      expect(riskLevel).toBe('high');
    });

    test('empty proposals → low risk', () => {
      const validator = new StalenessValidator();
      const request = createRequest('wellness', 12, []);

      const riskLevel = validator.determineRiskLevel(request);

      expect(riskLevel).toBe('low');
    });

    test('HIGH_RISK_PROPOSAL_KINDS includes expected types', () => {
      expect(HIGH_RISK_PROPOSAL_KINDS).toContain('MEDICATION_ORDER_PROPOSAL');
      expect(HIGH_RISK_PROPOSAL_KINDS).toContain('TRIAGE_ROUTE');
      expect(HIGH_RISK_PROPOSAL_KINDS).toContain('ESCALATE_TO_CARE_TEAM');
    });
  });

  describe('Reason Codes', () => {
    test('missing snapshot returns schema_invalid + data_quality_warning', () => {
      const validator = new StalenessValidator();
      const request = createRequest('wellness', undefined);

      const result = validator.validate(request);
      const codes = validator.getReasonCodes(result, 'low');

      expect(codes).toContain('schema_invalid');
      expect(codes).toContain('data_quality_warning');
    });

    test('stale low-risk returns data_quality_warning', () => {
      const validator = new StalenessValidator();
      const request = createRequest('wellness', 25);

      const result = validator.validate(request);
      const codes = validator.getReasonCodes(result, 'low');

      expect(codes).toContain('data_quality_warning');
      expect(codes).not.toContain('risk_too_high');
    });

    test('stale high-risk returns data_quality_warning + risk_too_high', () => {
      const validator = new StalenessValidator();
      const request = createRequest('wellness', 25);

      const result = validator.validate(request);
      const codes = validator.getReasonCodes(result, 'high');

      expect(codes).toContain('data_quality_warning');
      expect(codes).toContain('risk_too_high');
    });

    test('stale clinical returns data_quality_warning + risk_too_high + high_uncertainty', () => {
      const validator = new StalenessValidator();
      const request = createRequest('advocate_clinical', 5);

      const result = validator.validate(request);
      const codes = validator.getReasonCodes(result, 'low');

      expect(codes).toContain('data_quality_warning');
      expect(codes).toContain('risk_too_high');
      expect(codes).toContain('high_uncertainty');
    });

    test('fresh snapshot returns empty reason codes', () => {
      const validator = new StalenessValidator();
      const request = createRequest('wellness', 12);

      const result = validator.validate(request);
      const codes = validator.getReasonCodes(result, 'low');

      expect(codes).toHaveLength(0);
    });
  });

  describe('Required Action', () => {
    test('stale snapshot includes refresh_snapshot action', () => {
      const validator = new StalenessValidator();
      const request = createRequest('wellness', 25);

      const result = validator.validate(request);

      expect(result.required_action).toBeDefined();
      expect(result.required_action?.kind).toBe('refresh_snapshot');
      expect(result.required_action?.details.current_age_hours).toBeCloseTo(25, 0);
      expect(result.required_action?.details.threshold_hours).toBe(24);
    });

    test('fresh snapshot has no required action', () => {
      const validator = new StalenessValidator();
      const request = createRequest('wellness', 12);

      const result = validator.validate(request);

      expect(result.required_action).toBeUndefined();
    });

    test('missing snapshot has no required action', () => {
      const validator = new StalenessValidator();
      const request = createRequest('wellness', undefined);

      const result = validator.validate(request);

      expect(result.required_action).toBeUndefined();
    });
  });

  describe('Snapshot Extraction', () => {
    test('extracts snapshot from snapshot field', () => {
      const validator = new StalenessValidator();
      const request = createRequest('wellness', 12);

      const result = validator.validate(request);

      expect(result.is_missing).toBe(false);
      expect(result.age_hours).toBeDefined();
    });

    test('extracts snapshot from snapshot_payload field', () => {
      const validator = new StalenessValidator();
      const request = createRequest('wellness', undefined);
      const snapshotTime = new Date(Date.now() - 6 * 60 * 60 * 1000);
      (request as Record<string, unknown>).snapshot_payload = {
        snapshot_id: 'snap-001',
        created_at: snapshotTime.toISOString(),
      };

      const result = validator.validate(request);

      expect(result.is_missing).toBe(false);
      expect(result.age_hours).toBeCloseTo(6, 0);
    });

    test('handles timestamp field as fallback', () => {
      const validator = new StalenessValidator();
      const request = createRequest('wellness', undefined);
      const snapshotTime = new Date(Date.now() - 8 * 60 * 60 * 1000);
      (request as Record<string, unknown>).snapshot = {
        snapshot_id: 'snap-001',
        timestamp: snapshotTime.toISOString(), // Using timestamp instead of created_at
      };

      const result = validator.validate(request);

      expect(result.is_missing).toBe(false);
      expect(result.age_hours).toBeCloseTo(8, 0);
    });
  });

  describe('Threshold Retrieval', () => {
    test('getThreshold returns wellness threshold for wellness mode', () => {
      const validator = new StalenessValidator();

      expect(validator.getThreshold('wellness')).toBe(24);
    });

    test('getThreshold returns clinical threshold for advocate_clinical mode', () => {
      const validator = new StalenessValidator();

      expect(validator.getThreshold('advocate_clinical')).toBe(4);
    });
  });

  describe('Factory Functions', () => {
    test('createStalenessValidator creates validator', () => {
      const validator = createStalenessValidator();

      expect(validator).toBeInstanceOf(StalenessValidator);
    });

    test('createStalenessValidator accepts config', () => {
      const validator = createStalenessValidator({
        thresholds: { wellness_hours: 48, clinical_hours: 2 },
      });

      expect(validator.getThreshold('wellness')).toBe(48);
      expect(validator.getThreshold('advocate_clinical')).toBe(2);
    });

    test('defaultStalenessValidator is available', () => {
      expect(defaultStalenessValidator).toBeInstanceOf(StalenessValidator);
      expect(defaultStalenessValidator.getThreshold('wellness')).toBe(24);
    });
  });

  describe('Spec Test Vectors', () => {
    // Test vectors from 03-popper-safety-dsl.md §6.1

    test('stale-001: wellness 25h low-risk → REQUEST_MORE_INFO', () => {
      const validator = new StalenessValidator();
      const request = createRequest('wellness', 25, [
        { kind: 'PATIENT_MESSAGE', proposal_id: 'p1', message_markdown: 'Hello' },
      ]);

      const result = validator.validate(request);
      const riskLevel = validator.determineRiskLevel(request);
      const decision = validator.getRecommendedDecision(result, riskLevel);

      expect(decision).toBe('REQUEST_MORE_INFO');
    });

    test('stale-002: wellness 25h high-risk (medication) → ROUTE_TO_CLINICIAN', () => {
      const validator = new StalenessValidator();
      const request = createRequest('wellness', 25, [
        {
          kind: 'MEDICATION_ORDER_PROPOSAL',
          proposal_id: 'p1',
          medication: { name: 'Test' },
          change: { change_type: 'titrate' },
        },
      ]);

      const result = validator.validate(request);
      const riskLevel = validator.determineRiskLevel(request);
      const decision = validator.getRecommendedDecision(result, riskLevel);

      expect(decision).toBe('ROUTE_TO_CLINICIAN');
    });

    test('stale-003: advocate_clinical 5h any → ROUTE_TO_CLINICIAN', () => {
      const validator = new StalenessValidator();
      const request = createRequest('advocate_clinical', 5, [
        { kind: 'PATIENT_MESSAGE', proposal_id: 'p1', message_markdown: 'Hello' },
      ]);

      const result = validator.validate(request);
      const riskLevel = validator.determineRiskLevel(request);
      const decision = validator.getRecommendedDecision(result, riskLevel);

      expect(decision).toBe('ROUTE_TO_CLINICIAN');
    });

    test('stale-004: advocate_clinical 3h any → APPROVED', () => {
      const validator = new StalenessValidator();
      const request = createRequest('advocate_clinical', 3, [
        { kind: 'PATIENT_MESSAGE', proposal_id: 'p1', message_markdown: 'Hello' },
      ]);

      const result = validator.validate(request);
      const decision = validator.getRecommendedDecision(result, 'low');

      expect(decision).toBe('APPROVED');
    });

    test('stale-005: wellness 23h any → APPROVED', () => {
      const validator = new StalenessValidator();
      const request = createRequest('wellness', 23, [
        { kind: 'PATIENT_MESSAGE', proposal_id: 'p1', message_markdown: 'Hello' },
      ]);

      const result = validator.validate(request);
      const decision = validator.getRecommendedDecision(result, 'low');

      expect(decision).toBe('APPROVED');
    });

    test('stale-006: any mode missing → HARD_STOP', () => {
      const validator = new StalenessValidator();
      const wellnessRequest = createRequest('wellness', undefined);
      const clinicalRequest = createRequest('advocate_clinical', undefined);

      const wellnessResult = validator.validate(wellnessRequest);
      const clinicalResult = validator.validate(clinicalRequest);

      expect(validator.getRecommendedDecision(wellnessResult, 'low')).toBe('HARD_STOP');
      expect(validator.getRecommendedDecision(clinicalResult, 'high')).toBe('HARD_STOP');
    });
  });
});
