---
version: 1.0.0
last-updated: 2026-01-24
status: draft
owner: Hermes Dev Team
tags: [advocate, hermes, epistemology, htv, evidence, uncertainty]
---

# Hermes Epistemological Types (v1)

## 0) Purpose

This document defines types that operationalize Deutschian/Popperian epistemology in the Hermes contract. These types enable:
- Classification of clinical claims by their epistemic status
- Evidence grading based on "hard-to-vary" principles
- Quantified uncertainty calibration
- Falsification criteria for testable recommendations

**Epistemological Foundations**: See [`../00-overall-specs/00-epistemology-foundations/`](../00-overall-specs/00-epistemology-foundations/) for the philosophical grounding.

---

## 1) ClaimType — Classifying Claims by Epistemic Status

Every clinical recommendation makes an implicit *claim*. Popperian epistemology requires that claims be:
1. Classifiable (what kind of claim is it?)
2. Falsifiable (what would refute it?)
3. Distinguishable by risk profile

### 1.1 ClaimType Enum

```typescript
/**
 * Classification of clinical claims by their epistemic nature.
 * Each type has different falsifiability conditions and risk profiles.
 *
 * @see ../00-overall-specs/00-epistemology-foundations/03-conjecture-and-refutation.md
 */
export type ClaimType =
  | 'observation'           // Directly observed data point
  | 'diagnosis'             // Explanatory hypothesis about patient state
  | 'prognosis'             // Prediction about future outcomes
  | 'treatment_rec'         // Recommendation for therapeutic action
  | 'lifestyle_rec'         // Recommendation for behavioral change
  | 'diagnostic_prompt'     // Suggestion to gather more information
  | 'escalation'            // Routing decision (clinician involvement)
  | 'administrative';       // Scheduling, logistics, non-clinical
```

### 1.2 Claim Characteristics by Type

| ClaimType | Risk Level | Requires Popper | Falsifiable By | Example |
|-----------|------------|-----------------|----------------|---------|
| `observation` | Low | No | Contradiction in source data | "Patient reports fatigue" |
| `diagnosis` | High | Yes | Negative test results, conflicting findings | "Patient has HFrEF" |
| `prognosis` | Medium | Situational | Outcome differs from prediction | "Risk of readmission is high" |
| `treatment_rec` | High | Yes | Contraindication develops, adverse event | "Increase ACE-I dose" |
| `lifestyle_rec` | Low | No | No measurable outcome after intervention | "Reduce sodium intake" |
| `diagnostic_prompt` | Low | No | Test already performed, data already available | "Check potassium level" |
| `escalation` | Medium | Yes | Clinician determines no escalation needed | "Contact care team" |
| `administrative` | Low | No | Scheduling conflict, infeasibility | "Schedule follow-up" |

### 1.3 Normative Constraints

- **High-risk claim types** (`diagnosis`, `treatment_rec`, `escalation`) MUST include `falsification_criteria` when used in `advocate_clinical` mode.
- Deutsch MUST populate `claim_type` for all `ProposedIntervention` items sent to Popper in `advocate_clinical` mode.
- Popper MAY use `claim_type` to adjust conservatism thresholds.

---

## 2) EvidenceGrade — Hierarchy for Hard-to-Vary Explanations

Evidence quality varies. Per Deutschian epistemology, "harder to vary" evidence (e.g., RCTs with tight controls) is more trustworthy than "easy to vary" evidence (e.g., expert opinion with no systematic testing).

### 2.1 EvidenceGrade Enum

```typescript
/**
 * Evidence quality hierarchy, ordered from strongest to weakest.
 * Stronger grades indicate evidence that is "harder to vary" —
 * every methodological element is load-bearing, making the
 * conclusions more resistant to ad-hoc adjustments.
 *
 * @see ../00-overall-specs/00-epistemology-foundations/01-hard-to-vary-explanations.md
 */
export type EvidenceGrade =
  | 'systematic_review'  // Meta-analysis of RCTs (hardest to vary)
  | 'rct'                // Randomized controlled trial
  | 'cohort'             // Observational cohort study
  | 'case_control'       // Retrospective case-control
  | 'case_series'        // Descriptive case series
  | 'case_report'        // Single case report
  | 'expert_opinion'     // Expert consensus without systematic evidence
  | 'policy'             // Organizational policy (may or may not be evidence-based)
  | 'patient_reported'   // Self-reported by patient
  | 'calculated';        // Derived from other data (algorithms, scores)
```

### 2.2 Evidence Hierarchy (Strength Order)

```
systematic_review > rct > cohort > case_control > case_series > case_report > expert_opinion
```

**Special grades** (not in main hierarchy):
- `policy`: May be strong or weak depending on its backing; treat as `cohort` level for routing unless annotated
- `patient_reported`: Important for patient-centered care but subjective; treat as `case_report` level
- `calculated`: Depends on input data quality; inherit grade from weakest input

### 2.3 Popper Conservatism Linkage

| Minimum Evidence Grade | Popper Behavior (High-Risk Proposals) |
|------------------------|---------------------------------------|
| `systematic_review` or `rct` | Normal autonomy; may approve |
| `cohort` | Increased conservatism; prefer routing |
| `case_control` or weaker | Route all clinical proposals |
| `expert_opinion` only | Route + flag for review |

### 2.4 Enhanced EvidenceRef

The existing `EvidenceRef` type is extended with grade information:

```typescript
export interface EvidenceRef {
  evidence_id: string;
  evidence_type: EvidenceType;  // Existing: 'guideline' | 'study' | 'patient_data' | etc.

  // === NEW FIELDS (Epistemological Enhancement) ===
  evidence_grade?: EvidenceGrade;         // Strength of evidence
  confidence?: number;                    // 0.0-1.0, calibrated by grade + recency
  publication_date?: string;              // ISO date, for confidence decay
  falsification_condition?: string;       // What would refute this evidence?

  // Existing fields
  citation: string;
  uri?: string;
  excerpt?: string;
  content_hash?: string;
}
```

**Normative constraints**:
- In `advocate_clinical` mode, `evidence_grade` SHOULD be populated for all evidence supporting treatment recommendations.
- `confidence` SHOULD decay over time: 5% per year since `publication_date` (configurable per deployment).
- `falsification_condition` SHOULD be populated for guideline-type evidence.

---

## 3) HTVScore — Hard-to-Vary Scoring

The HTV (Hard-to-Vary) score quantifies how "hard to vary" a clinical explanation or recommendation is. Higher scores indicate explanations where every detail plays a functional role.

### 3.1 HTVScore Type

```typescript
/**
 * Hard-to-Vary score measuring explanation quality.
 * Based on Deutsch's criterion: good explanations are those
 * where changing any detail would invalidate the explanation.
 *
 * @see ../00-overall-specs/00-epistemology-foundations/01-hard-to-vary-explanations.md
 */
export interface HTVScore {
  /**
   * How tightly coupled are the claim's components?
   * High: every piece of evidence connects to the conclusion.
   * Low: components could be swapped without affecting the claim.
   */
  interdependence: number;  // 0.0-1.0

  /**
   * How precise are the predictions?
   * High: specific, measurable outcomes predicted.
   * Low: vague, unfalsifiable predictions.
   */
  specificity: number;      // 0.0-1.0

  /**
   * Are all elements necessary?
   * High: minimal sufficient explanation.
   * Low: includes superfluous elements that could be removed.
   */
  parsimony: number;        // 0.0-1.0

  /**
   * What would refute this claim?
   * High: clear falsification conditions exist.
   * Low: claim is unfalsifiable or immune to counterevidence.
   */
  falsifiability: number;   // 0.0-1.0

  /**
   * Composite score (weighted average of dimensions).
   * Default weights: equal (0.25 each).
   */
  composite: number;        // 0.0-1.0
}
```

### 3.2 HTV Scoring Algorithm

```typescript
function computeHTVScore(dimensions: {
  interdependence: number;
  specificity: number;
  parsimony: number;
  falsifiability: number;
}): HTVScore {
  // Default: equal weights
  const weights = {
    interdependence: 0.25,
    specificity: 0.25,
    parsimony: 0.25,
    falsifiability: 0.25,
  };

  const composite =
    weights.interdependence * dimensions.interdependence +
    weights.specificity * dimensions.specificity +
    weights.parsimony * dimensions.parsimony +
    weights.falsifiability * dimensions.falsifiability;

  return {
    ...dimensions,
    composite,
  };
}
```

### 3.3 HTV Threshold Mapping

| Composite Score | Quality Level | Recommended Action |
|-----------------|---------------|-------------------|
| ≥ 0.7 | **Good** | May proceed (subject to other checks) |
| 0.4 – 0.7 | **Moderate** | Disclose uncertainty; prefer conservative action |
| < 0.4 | **Poor** | Trigger IDK Protocol or route to clinician |
| < 0.3 | **Refuted** | Treat as failed hypothesis; do not proceed |

### 3.4 Worked Examples

**Example 1: Poor HTV (avoid)**
```
Claim: "Patient may have a cardiac issue"
- Interdependence: 0.2 (no specific mechanism linking symptoms)
- Specificity: 0.1 (no testable prediction)
- Parsimony: 0.3 (vague, could mean many things)
- Falsifiability: 0.1 (nothing would clearly refute this)
Composite HTV: 0.175 ❌
```

**Example 2: Good HTV (target)**
```
Claim: "Patient has acute HFrEF exacerbation due to medication non-adherence,
        evidenced by weight gain (5kg/week), elevated BNP (850 pg/mL),
        and missed Lasix doses per refill history"
- Interdependence: 0.9 (mechanism links all findings)
- Specificity: 0.9 (precise, measurable claims)
- Parsimony: 0.8 (minimal elements, all necessary)
- Falsifiability: 0.9 (if BNP normal or weight stable, claim is refuted)
Composite HTV: 0.875 ✅
```

---

## 4) UncertaintyCalibration — Quantified Fallibilism

Deutschian epistemology embraces fallibilism: all knowledge is provisional. The uncertainty calibration algorithm quantifies this uncertainty based on multiple factors.

### 4.1 UncertaintyDriver Type

```typescript
/**
 * A factor contributing to uncertainty in a recommendation.
 */
export interface UncertaintyDriver {
  factor:
    | 'evidence_grade'      // Weak evidence
    | 'htv_score'           // Low HTV score
    | 'data_quality'        // Missing or conflicting snapshot signals
    | 'debate_consensus'    // Generator-Verifier disagreement
    | 'staleness'           // Old data or evidence
    | 'conflicting_evidence'; // Sources disagree

  contribution: number;     // How much this factor adds to uncertainty (0.0-1.0)
  details: string;          // Human-readable explanation
}
```

### 4.2 UncertaintyCalibration

```typescript
/**
 * Enhanced uncertainty representation with calibration details.
 * Extends the existing UncertaintyLevel with quantified scoring.
 */
export interface UncertaintyCalibration {
  level: UncertaintyLevel;        // 'low' | 'medium' | 'high'
  score: number;                  // 0.0-1.0 continuous score
  drivers: UncertaintyDriver[];   // What contributed to this uncertainty
}
```

### 4.3 Uncertainty Calibration Algorithm

```typescript
interface UncertaintyInputs {
  minEvidenceGrade: EvidenceGrade;
  htvScore: number;
  missingSignals: string[];
  conflictingSignals: string[];
  verifierAgreed: boolean;
  dataAgeDays: number;
}

function computeUncertainty(inputs: UncertaintyInputs): UncertaintyCalibration {
  const drivers: UncertaintyDriver[] = [];
  let score = 0;

  // Normalize "special" evidence grades into the main hierarchy.
  // See §2.2 for semantics.
  const effectiveEvidenceGrade =
    inputs.minEvidenceGrade === 'policy'
      ? 'cohort'
      : inputs.minEvidenceGrade === 'patient_reported'
        ? 'case_report'
        : inputs.minEvidenceGrade === 'calculated'
          ? 'cohort'
          : inputs.minEvidenceGrade;

  // Evidence quality factor (0-0.3)
  if (effectiveEvidenceGrade === 'expert_opinion' || effectiveEvidenceGrade === 'case_report') {
    score += 0.3;
    drivers.push({
      factor: 'evidence_grade',
      contribution: 0.3,
      details: `Weak evidence grade: ${inputs.minEvidenceGrade} (treated as ${effectiveEvidenceGrade})`,
    });
  } else if (effectiveEvidenceGrade === 'case_series' || effectiveEvidenceGrade === 'case_control') {
    score += 0.2;
    drivers.push({
      factor: 'evidence_grade',
      contribution: 0.2,
      details: `Moderate evidence grade: ${inputs.minEvidenceGrade} (treated as ${effectiveEvidenceGrade})`,
    });
  } else if (effectiveEvidenceGrade === 'cohort') {
    score += 0.1;
    drivers.push({
      factor: 'evidence_grade',
      contribution: 0.1,
      details: `Observational evidence: ${inputs.minEvidenceGrade} (treated as ${effectiveEvidenceGrade})`,
    });
  }

  // HTV factor (0-0.3)
  if (inputs.htvScore < 0.4) {
    score += 0.3;
    drivers.push({
      factor: 'htv_score',
      contribution: 0.3,
      details: `Low HTV score: ${inputs.htvScore.toFixed(2)}`,
    });
  } else if (inputs.htvScore < 0.7) {
    score += 0.15;
    drivers.push({
      factor: 'htv_score',
      contribution: 0.15,
      details: `Moderate HTV score: ${inputs.htvScore.toFixed(2)}`,
    });
  }

  // Data quality factor (0-0.2)
  if (inputs.missingSignals.length > 2) {
    score += 0.15;
    drivers.push({
      factor: 'data_quality',
      contribution: 0.15,
      details: `Multiple missing signals: ${inputs.missingSignals.join(', ')}`,
    });
  } else if (inputs.missingSignals.length > 0) {
    score += 0.08;
    drivers.push({
      factor: 'data_quality',
      contribution: 0.08,
      details: `Missing signal: ${inputs.missingSignals.join(', ')}`,
    });
  }

  if (inputs.conflictingSignals.length > 0) {
    score += 0.1;
    drivers.push({
      factor: 'conflicting_evidence',
      contribution: 0.1,
      details: `Conflicting signals: ${inputs.conflictingSignals.join(', ')}`,
    });
  }

  // Debate consensus factor (0-0.1)
  if (!inputs.verifierAgreed) {
    score += 0.1;
    drivers.push({
      factor: 'debate_consensus',
      contribution: 0.1,
      details: 'Generator-Verifier disagreement in ArgMed debate',
    });
  }

  // Staleness factor (0-0.1)
  if (inputs.dataAgeDays > 30) {
    score += 0.1;
    drivers.push({
      factor: 'staleness',
      contribution: 0.1,
      details: `Data age: ${inputs.dataAgeDays} days`,
    });
  } else if (inputs.dataAgeDays > 14) {
    score += 0.05;
    drivers.push({
      factor: 'staleness',
      contribution: 0.05,
      details: `Data age: ${inputs.dataAgeDays} days`,
    });
  }

  // Clamp score to [0, 1]
  score = Math.min(1.0, Math.max(0.0, score));

  // Map to level
  let level: UncertaintyLevel;
  if (score >= 0.6) level = 'high';
  else if (score >= 0.3) level = 'medium';
  else level = 'low';

  return { level, score, drivers };
}
```

### 4.4 Uncertainty Thresholds

| Uncertainty Score | Level | Popper Behavior |
|-------------------|-------|-----------------|
| < 0.3 | `low` | Normal operation |
| 0.3 – 0.6 | `medium` | Increased scrutiny; may route borderline cases |
| ≥ 0.6 | `high` | Route to clinician (for high-risk proposals) |

---

## 5) FalsificationCriteria — Testable Refutation Conditions

Per Popperian epistemology, every scientific claim must specify what would refute it. Falsification criteria make recommendations auditable and correctable.

### 5.1 FalsificationCriteria Type

```typescript
/**
 * Specifies what would refute a clinical claim.
 * Implements Popper's demarcation criterion: scientific claims
 * must be falsifiable.
 *
 * @see ../00-overall-specs/00-epistemology-foundations/03-conjecture-and-refutation.md
 */
export interface FalsificationCriteria {
  claim_id: string;                         // Links to the proposal

  /**
   * Observable conditions that would refute the claim.
   * E.g., "If serum potassium > 5.5 mEq/L post-titration"
   */
  refutation_conditions: string[];

  /**
   * Time window for observing outcomes (days).
   * E.g., 30 days for medication efficacy assessment.
   */
  observation_window_days?: number;

  /**
   * Specific metrics to monitor for refutation.
   * E.g., ["serum_potassium", "serum_creatinine", "blood_pressure"]
   */
  outcome_measures: string[];

  /**
   * What action to take if refutation conditions are met.
   */
  refutation_action?: 'route_to_clinician' | 'hard_stop' | 'modify_recommendation' | 'log_only';
}
```

### 5.2 Per-Claim-Type Falsification Examples

| Claim Type | Falsification Example |
|------------|----------------------|
| `treatment_rec` | "If adverse event occurs, discontinue and route" |
| `diagnosis` | "If confirmatory test negative, revise hypothesis" |
| `prognosis` | "If outcome differs by >2 SD from prediction, recalibrate" |
| `lifestyle_rec` | "If no measurable improvement after 90 days, escalate" |
| `escalation` | "If clinician determines no action needed, log as over-routing" |

---

## 6) Enhanced ProposedInterventionBase

The existing `ProposedInterventionBase` is extended with epistemological fields:

```typescript
export interface ProposedInterventionBase {
  // === EXISTING FIELDS ===
  proposal_id: string;
  kind: ProposedInterventionKind;
  created_at: string;
  interdependency_group_id?: string;
  deutsch_risk_estimate?: { level: 'low' | 'medium' | 'high' | 'critical'; notes?: string };
  evidence_refs?: EvidenceRef[];
  disclosure?: DisclosureBundle;
  audit_redaction: { summary: string };

  // === NEW EPISTEMOLOGICAL FIELDS ===

  /**
   * Classification of the underlying claim.
   * MUST be populated in advocate_clinical mode.
   */
  claim_type?: ClaimType;

  /**
   * Hard-to-Vary score measuring explanation quality.
   * SHOULD be populated for clinical recommendations.
   */
  htv_score?: HTVScore;

  /**
   * What would refute this recommendation?
   * SHOULD be populated for high-risk claim types.
   */
  falsification_criteria?: FalsificationCriteria;

  /**
   * Calibrated uncertainty with drivers.
   * Extends the DisclosureBundle.uncertainty with algorithm-based scoring.
   */
  uncertainty_calibration?: UncertaintyCalibration;
}
```

---

## 7) Integration Points

### 7.1 Deutsch → Popper (SupervisionRequest)

When Deutsch sends a `SupervisionRequest`:
- `proposals[].claim_type` — populated for all proposals in `advocate_clinical` mode
- `proposals[].htv_score` — populated for clinical recommendations
- `proposals[].falsification_criteria` — populated for high-risk claims
- `proposals[].evidence_refs[].evidence_grade` — populated where available

### 7.2 Popper Evaluation

Popper uses these fields in its Safety DSL:
- `htv_score_below` condition: routes if `htv_score.composite < threshold`
- `evidence_grade_below` condition: routes if `min(evidence_refs[].evidence_grade) < threshold`
- `uncertainty_high` condition: routes if `uncertainty_calibration.level === 'high'`

### 7.3 Audit Trail

All epistemological fields MUST be preserved in audit events:
- `AuditEvent.tags.htv_score` — composite score (PHI-safe)
- `AuditEvent.tags.claim_type` — claim classification
- `AuditEvent.tags.evidence_grade` — minimum evidence grade
- `AuditEvent.tags.uncertainty_level` — calibrated uncertainty

---

## 8) Contract Test Fixtures

New fixtures for epistemological types:

- `fixtures/evidence_ref.graded.json` — Evidence with grades and confidence
- `fixtures/supervision_request.with_htv_scores.json` — Proposals with HTV scores
- `fixtures/htv_score.examples.json` — Good and poor HTV examples
- `fixtures/uncertainty_calibration.examples.json` — Uncertainty calculation examples

---

## 9) References

- [00-popper-deutsch-fundamentals.md](../00-overall-specs/00-epistemology-foundations/00-popper-deutsch-fundamentals.md) — Philosophical foundations
- [01-hard-to-vary-explanations.md](../00-overall-specs/00-epistemology-foundations/01-hard-to-vary-explanations.md) — HTV criterion
- [03-conjecture-and-refutation.md](../00-overall-specs/00-epistemology-foundations/03-conjecture-and-refutation.md) — Falsifiability
- [04-fallibilism-and-error-correction.md](../00-overall-specs/00-epistemology-foundations/04-fallibilism-and-error-correction.md) — Uncertainty
- [07-applying-to-clinical-agents.md](../00-overall-specs/00-epistemology-foundations/07-applying-to-clinical-agents.md) — Implementation guidance

---

*Last updated: 2026-01-24*
