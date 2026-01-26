/**
 * Hermes Protocol integration tests
 * Verifies @regain/hermes package re-exports work correctly
 */

import { describe, expect, test } from 'bun:test';
import type {
  HTVScore,
  Mode,
  ReasonCode,
  SupervisionDecision,
  UncertaintyCalibration,
} from './hermes';
import {
  CLAIM_TYPES,
  // Constants
  CURRENT_HERMES_VERSION,
  compareEvidenceGrades,
  // Utilities
  computeHTVScore,
  computeUncertainty,
  createFalsificationCriteria,
  createPoorHTVScore,
  createUniformHTVScore,
  EVIDENCE_GRADES,
  getEffectiveEvidenceGrade,
  getHTVQualityLevel,
  HermesValidationError,
  HTV_DEFAULT_WEIGHTS,
  // Builders
  HTVScoreBuilder,
  htvScore,
  isUncertaintyAcceptable,
  isValidHermesMessage,
  MODES,
  meetsHTVThreshold,
  PROPOSED_INTERVENTION_KINDS,
  parseHermesMessage,
  REASON_CODES,
  SUPERVISION_DECISIONS,
  UNCERTAINTY_THRESHOLDS,
  // Validation
  validateHermesMessage,
} from './hermes';

describe('Hermes Protocol Integration', () => {
  describe('Constants', () => {
    test('CURRENT_HERMES_VERSION is defined', () => {
      expect(CURRENT_HERMES_VERSION).toBeDefined();
      expect(typeof CURRENT_HERMES_VERSION).toBe('string');
      expect(CURRENT_HERMES_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });

    test('MODES contains expected values', () => {
      expect(MODES).toContain('wellness');
      expect(MODES).toContain('advocate_clinical');
    });

    test('REASON_CODES contains expected values', () => {
      expect(REASON_CODES).toContain('schema_invalid');
      expect(REASON_CODES).toContain('policy_violation');
      expect(REASON_CODES).toContain('risk_too_high');
      expect(REASON_CODES).toContain('approved_with_constraints');
    });

    test('SUPERVISION_DECISIONS contains expected values', () => {
      expect(SUPERVISION_DECISIONS).toContain('APPROVED');
      expect(SUPERVISION_DECISIONS).toContain('HARD_STOP');
      expect(SUPERVISION_DECISIONS).toContain('ROUTE_TO_CLINICIAN');
      expect(SUPERVISION_DECISIONS).toContain('REQUEST_MORE_INFO');
    });

    test('PROPOSED_INTERVENTION_KINDS contains expected values', () => {
      expect(PROPOSED_INTERVENTION_KINDS).toContain('CARE_NAVIGATION');
      expect(PROPOSED_INTERVENTION_KINDS).toContain('TRIAGE_ROUTE');
      expect(PROPOSED_INTERVENTION_KINDS).toContain('MEDICATION_ORDER_PROPOSAL');
      expect(PROPOSED_INTERVENTION_KINDS).toContain('PATIENT_MESSAGE');
    });

    test('CLAIM_TYPES contains expected values', () => {
      expect(CLAIM_TYPES).toContain('observation');
      expect(CLAIM_TYPES).toContain('diagnosis');
      expect(CLAIM_TYPES).toContain('treatment_rec');
      expect(CLAIM_TYPES).toContain('lifestyle_rec');
    });

    test('EVIDENCE_GRADES contains expected values', () => {
      expect(EVIDENCE_GRADES).toContain('systematic_review');
      expect(EVIDENCE_GRADES).toContain('rct');
      expect(EVIDENCE_GRADES).toContain('cohort');
      expect(EVIDENCE_GRADES).toContain('expert_opinion');
    });

    test('HTV_DEFAULT_WEIGHTS is defined', () => {
      expect(HTV_DEFAULT_WEIGHTS).toBeDefined();
      expect(HTV_DEFAULT_WEIGHTS.interdependence).toBe(0.25);
      expect(HTV_DEFAULT_WEIGHTS.specificity).toBe(0.25);
      expect(HTV_DEFAULT_WEIGHTS.parsimony).toBe(0.25);
      expect(HTV_DEFAULT_WEIGHTS.falsifiability).toBe(0.25);
    });
  });

  describe('HTV Score Builder', () => {
    test('creates valid HTV score with builder pattern', () => {
      const score = htvScore()
        .withInterdependence(0.9)
        .withSpecificity(0.85)
        .withParsimony(0.8)
        .withFalsifiability(0.75)
        .build();

      expect(score.interdependence).toBe(0.9);
      expect(score.specificity).toBe(0.85);
      expect(score.parsimony).toBe(0.8);
      expect(score.falsifiability).toBe(0.75);
      expect(score.composite).toBeDefined();
    });

    test('HTVScoreBuilder class works', () => {
      const builder = new HTVScoreBuilder();
      const score = builder
        .withInterdependence(0.7)
        .withSpecificity(0.75)
        .withParsimony(0.8)
        .withFalsifiability(0.85)
        .build();

      expect(score.interdependence).toBe(0.7);
      expect(score.specificity).toBe(0.75);
      expect(score.parsimony).toBe(0.8);
      expect(score.falsifiability).toBe(0.85);
    });

    test('createUniformHTVScore creates equal scores', () => {
      const score = createUniformHTVScore(0.8);

      expect(score.interdependence).toBe(0.8);
      expect(score.specificity).toBe(0.8);
      expect(score.parsimony).toBe(0.8);
      expect(score.falsifiability).toBe(0.8);
      expect(score.composite).toBe(0.8);
    });
  });

  describe('HTV Utilities', () => {
    test('computeHTVScore calculates weighted average', () => {
      const score = computeHTVScore({
        interdependence: 0.9,
        specificity: 0.8,
        parsimony: 0.7,
        falsifiability: 0.6,
      });

      expect(score.composite).toBeGreaterThan(0);
      expect(score.composite).toBeLessThanOrEqual(1);
      // With equal weights: (0.9 + 0.8 + 0.7 + 0.6) / 4 = 0.75
      expect(score.composite).toBeCloseTo(0.75);
    });

    test('createPoorHTVScore creates minimum scores', () => {
      const score = createPoorHTVScore();

      expect(score.interdependence).toBe(0);
      expect(score.specificity).toBe(0);
      expect(score.parsimony).toBe(0);
      expect(score.falsifiability).toBe(0);
      expect(score.composite).toBe(0);
    });

    test('meetsHTVThreshold validates against threshold', () => {
      const highScore = createUniformHTVScore(0.9);
      const lowScore = createUniformHTVScore(0.3);

      expect(meetsHTVThreshold(highScore, 0.7)).toBe(true);
      expect(meetsHTVThreshold(lowScore, 0.7)).toBe(false);
      // Default threshold is 0.4
      expect(meetsHTVThreshold(highScore)).toBe(true);
      expect(meetsHTVThreshold(lowScore)).toBe(false);
    });

    test('getHTVQualityLevel returns quality level', () => {
      const highScore = createUniformHTVScore(0.9);
      const lowScore = createUniformHTVScore(0.2);

      const highLevel = getHTVQualityLevel(highScore);
      const lowLevel = getHTVQualityLevel(lowScore);

      expect(highLevel).toBeDefined();
      expect(lowLevel).toBeDefined();
      expect(typeof highLevel).toBe('string');
    });
  });

  describe('Uncertainty Utilities', () => {
    test('computeUncertainty calculates uncertainty', () => {
      const inputs = {
        minEvidenceGrade: 'rct' as const,
        htvScore: 0.8,
        missingSignals: [],
        conflictingSignals: [],
        verifierAgreed: true,
        dataAgeDays: 1,
      };

      const result = computeUncertainty(inputs);
      expect(result).toBeDefined();
      expect(typeof result.level).toBe('string');
      expect(typeof result.score).toBe('number');
      expect(['low', 'medium', 'high']).toContain(result.level);
    });

    test('isUncertaintyAcceptable validates uncertainty', () => {
      const lowUncertainty: UncertaintyCalibration = {
        level: 'low',
        score: 0.2,
        drivers: [],
      };

      const highUncertainty: UncertaintyCalibration = {
        level: 'high',
        score: 0.8,
        drivers: [{ factor: 'evidence_grade', contribution: 0.3, details: 'test' }],
      };

      expect(isUncertaintyAcceptable(lowUncertainty)).toBe(true);
      expect(isUncertaintyAcceptable(highUncertainty)).toBe(false);
    });

    test('UNCERTAINTY_THRESHOLDS is defined', () => {
      expect(UNCERTAINTY_THRESHOLDS).toBeDefined();
      expect(typeof UNCERTAINTY_THRESHOLDS.HIGH).toBe('number');
      expect(typeof UNCERTAINTY_THRESHOLDS.MEDIUM).toBe('number');
      expect(UNCERTAINTY_THRESHOLDS.HIGH).toBeGreaterThan(UNCERTAINTY_THRESHOLDS.MEDIUM);
    });
  });

  describe('Evidence Grade Utilities', () => {
    test('compareEvidenceGrades compares grades', () => {
      // systematic_review is stronger than expert_opinion
      const result = compareEvidenceGrades('systematic_review', 'expert_opinion');
      expect(result).toBeLessThan(0); // systematic_review has lower index (stronger)
    });

    test('getEffectiveEvidenceGrade gets effective grade', () => {
      const grade = getEffectiveEvidenceGrade('rct');
      expect(grade).toBe('rct');

      const policyGrade = getEffectiveEvidenceGrade('policy');
      expect(policyGrade).toBeDefined();
    });
  });

  describe('Falsification Criteria Builder', () => {
    test('createFalsificationCriteria creates valid criteria', () => {
      const criteria = createFalsificationCriteria(
        'claim-123',
        ['If HbA1c > 8.0% after 3 months'],
        ['hba1c_level'],
        { observationWindowDays: 90 },
      );

      expect(criteria.claim_id).toBe('claim-123');
      expect(criteria.refutation_conditions).toHaveLength(1);
      expect(criteria.outcome_measures).toContain('hba1c_level');
    });

    test('createFalsificationCriteria throws on invalid input', () => {
      expect(() => createFalsificationCriteria('', ['condition'], ['measure'])).toThrow();
      expect(() => createFalsificationCriteria('id', [], ['measure'])).toThrow();
      expect(() => createFalsificationCriteria('id', ['condition'], [])).toThrow();
    });
  });

  describe('Validation Functions', () => {
    test('isValidHermesMessage returns boolean', () => {
      const invalidMessage = { invalid: true };
      const result = isValidHermesMessage('SupervisionRequest', invalidMessage);
      expect(typeof result).toBe('boolean');
      expect(result).toBe(false);
    });

    test('validateHermesMessage returns validation result', () => {
      const message = {
        hermes_version: CURRENT_HERMES_VERSION,
        request_id: 'test-123',
      };

      const result = validateHermesMessage('SupervisionRequest', message);
      expect(result).toBeDefined();
      expect(typeof result.valid).toBe('boolean');
    });

    test('parseHermesMessage throws on invalid message', () => {
      const invalidMessage = { invalid: true };

      expect(() => {
        parseHermesMessage('SupervisionRequest', invalidMessage);
      }).toThrow(HermesValidationError);
    });
  });

  describe('Type Compatibility', () => {
    test('ReasonCode type is usable', () => {
      const code: ReasonCode = 'policy_violation';
      expect(REASON_CODES).toContain(code);
    });

    test('SupervisionDecision type is usable', () => {
      const decision: SupervisionDecision = 'APPROVED';
      expect(SUPERVISION_DECISIONS).toContain(decision);
    });

    test('Mode type is usable', () => {
      const mode: Mode = 'wellness';
      expect(MODES).toContain(mode);
    });

    test('HTVScore type is usable', () => {
      const score: HTVScore = {
        interdependence: 0.9,
        specificity: 0.85,
        parsimony: 0.8,
        falsifiability: 0.75,
        composite: 0.825,
      };
      expect(score.composite).toBe(0.825);
    });
  });
});
