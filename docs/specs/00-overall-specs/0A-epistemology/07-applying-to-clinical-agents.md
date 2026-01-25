# Applying Epistemology to Clinical Agents

> **Purpose**: Bridge document connecting Deutschian/Popperian epistemology to specific improvements for the Regain clinical agents specs. This is the actionable output of the epistemology series.

---

## 1. Architecture Alignment

### Agent Roles Recapped

| Agent | Named After | ARPA-H | Epistemological Function |
|-------|-------------|--------|--------------------------|
| **Deutsch** (TA1) | David Deutsch | Clinical Agent | Knowledge creation: conjecture → refutation → selection |
| **Popper** (TA2) | Karl Popper | Supervisory Agent | Demarcation: safe vs. unsafe, monitors boundaries |
| **Hermes** | Greek messenger | Shared Protocol | Communication: reliable, typed, auditable |

### Separation of Concerns

**All clinical reasoning happens in Deutsch (TA1)**:
- Generator produces conjectures (hypotheses)
- Verifier attempts refutation (criticism)
- Reasoner selects survivors (HTV scoring)
- Output: recommendations with evidence and uncertainty

**Popper (TA2) is supervisory only**:
- Does NOT generate clinical conjectures
- Monitors Deutsch's outputs for safety
- Gates: approve, hard-stop, route-to-clinician
- Detects: drift, hallucination, boundary violations

This separation prevents "AI sycophancy" (the supervisor agreeing with the reasoner) by enforcing independence.

---

## 2. What the Specs Get Right

### 2.1 ArgMed Multi-Agent Debate ✅

The specs implement Popperian epistemology through the ArgMed pattern:

| Agent | Popperian Role |
|-------|---------------|
| Generator | Bold conjecturer |
| Verifier | Adversarial critic |
| Reasoner | Survivor selector |

This is structurally sound.

### 2.2 HTV Scoring ✅

The four dimensions operationalize Deutsch's "hard to vary" criterion:
- Interdependence
- Specificity
- Parsimony
- Falsifiability

This is correctly formalized.

### 2.3 DisclosureBundle Transparency ✅

Every recommendation includes:
- `rationale_bullets`: The explanation
- `key_unknowns`: What we don't know
- `evidence_refs`: What supports the claim
- `uncertainty_level`: Calibrated confidence

This embodies fallibilism.

### 2.4 Snapshot-First Architecture ✅

Both Deutsch and Popper reason over the same snapshot, ensuring reproducibility. This supports auditability and debugging.

### 2.5 Deterministic Safety DSL ✅

Popper's rules are:
- Versioned
- Testable
- Auditable
- Non-LLM (no hallucination risk in safety layer)

This is epistemologically rigorous.

---

## 3. Gaps and Recommended Improvements

### 3.1 Claims Taxonomy with Falsification Criteria

**Gap**: No unified vocabulary for claim types.

**Recommendation**: Add to Hermes contract:

```typescript
enum ClaimType {
  OBSERVATION,      // "Patient reports fatigue" — directly observed
  DIAGNOSIS,        // "Patient has HFrEF" — explanatory hypothesis
  PROGNOSIS,        // "Risk of readmission is high" — future prediction
  TREATMENT_REC,    // "Increase ACE-I dose" — action recommendation
  LIFESTYLE_REC,    // "Reduce sodium intake" — behavioral guidance
  ESCALATION,       // "Contact clinician" — routing decision
}

interface ClaimMetadata {
  claim_type: ClaimType;
  falsification_condition: string;  // What would refute this?
  htv_score: HTVScore;
  evidence_refs: EvidenceRef[];
}
```

Each claim type has different risk profiles and testing requirements.

### 3.2 Uncertainty Calibration Algorithm

**Gap**: `UncertaintyLevel` (low/medium/high) is defined but computation is unspecified.

**Recommendation**: Define explicit thresholds:

```
LOW:
  - HTV score ≥ 0.7
  - ≥ 2 corroborating evidence sources
  - No contradictions detected
  - Generator-Verifier agreement

MEDIUM:
  - HTV score 0.4–0.7 OR
  - 1 evidence source OR
  - Minor contradictions resolved

HIGH:
  - HTV score < 0.4 OR
  - Contradictions unresolved OR
  - Generator-Verifier disagreement OR
  - Key data missing
```

This makes uncertainty calibration reproducible across implementations.

### 3.3 Evidence Grading in Hermes Contract

**Gap**: `evidence_type` exists but not `evidence_grade`.

**Recommendation**: Add to EvidenceRef:

```typescript
enum EvidenceGrade {
  RCT_META,         // Systematic review of RCTs
  RCT,              // Individual RCT
  COHORT,           // Observational cohort
  CASE_CONTROL,     // Retrospective
  CASE_SERIES,      // Descriptive
  CASE_REPORT,      // Single case
  EXPERT_OPINION,   // No systematic evidence
  PATIENT_REPORTED, // Self-report
  CALCULATED,       // Derived from other data
}

interface EvidenceRef {
  // ... existing fields
  evidence_grade: EvidenceGrade;
}
```

Popper can use `evidence_grade` to adjust conservatism: lower grades → more caution.

### 3.4 IDK Protocol Formalization

**Gap**: "IDK Protocol" mentioned but not formally specified.

**Recommendation**: Add to Deutsch spec:

```
## IDK Protocol

TRIGGER: Any of:
  - Uncertainty level = HIGH AND claim_type = TREATMENT_REC
  - HTV score < 0.3
  - Generator-Verifier both report "insufficient data"
  - Required input data missing

RESPONSE:
  1. Acknowledge uncertainty explicitly in patient summary
  2. Do NOT make treatment recommendation
  3. Request additional information (specify what)
  4. Suggest alternatives: "Consider discussing with clinician"
  5. Log as IDK_TRIGGERED in audit

OUTPUT FORMAT:
  {
    idk_triggered: true,
    reason_code: "INSUFFICIENT_EVIDENCE" | "LOW_HTV" | "DATA_MISSING" | ...,
    missing_information: ["recent labs", "current medications", ...],
    suggested_action: "Consult with care team for further evaluation"
  }
```

This operationalizes honest uncertainty admission.

### 3.5 Cartridge Guardrail Falsification Criteria

**Gap**: CVD cartridge defines guardrails but not their falsification conditions.

**Recommendation**: Each guardrail should specify:

```yaml
guardrails:
  - id: potassium_alert
    rule: "If K > 6.0 mEq/L → ROUTE_TO_CLINICIAN"
    rationale: "Severe hyperkalemia requires urgent intervention"
    falsification_condition: "If routing at K=6.0 causes unnecessary burden without improving outcomes, lower threshold to 5.5 or adjust response"
    last_validated: "2025-11-01"
    validation_source: "ACC/AHA Guidelines 2022"

  - id: bp_lifestyle_only
    rule: "If BP 130-139/80-89 AND no ASCVD → LIFESTYLE_ONLY"
    rationale: "Stage 1 hypertension without CVD can trial lifestyle first"
    falsification_condition: "If patients progress to Stage 2 within 6 months at rates above baseline, strengthen intervention"
    last_validated: "2025-11-01"
    validation_source: "JNC 8, ACC/AHA 2017"
```

This makes guardrails auditable and improvable.

---

## 4. Deutsch-Internal Improvements

### 4.1 Strengthen the Verifier (Critic)

Current: Verifier applies HTV scoring and checks for contradictions.

Enhancement:
- Explicit adversarial instructions: "Your job is to DESTROY hypotheses"
- Counter-argument generation: "Generate the strongest objection"
- Missing data identification: "What test would refute this?"
- Alternative hypothesis promotion: "What else could explain this?"

### 4.2 Ensure Generator Boldness

Current: Generator produces hypotheses from health snapshot.

Enhancement:
- Minimum hypothesis count: At least 2-3 conjectures for non-trivial cases
- Diversity requirement: Hypotheses should span different mechanisms
- Bold conjecture logging: Track whether Generator is appropriately speculative

### 4.3 HTV Calibration Examples

Provide worked examples in cartridge specs:

```
EXAMPLE 1: Low HTV (avoid)
  Claim: "Patient may have a cardiac issue"
  Interdependence: 0.2 (no specific mechanism)
  Specificity: 0.1 (no testable prediction)
  Parsimony: 0.3 (vague)
  Falsifiability: 0.1 (nothing would refute this)
  Total HTV: 0.175 ❌

EXAMPLE 2: High HTV (target)
  Claim: "Patient has acute HFrEF exacerbation due to medication non-adherence, evidenced by weight gain (5kg/week), elevated BNP (850 pg/mL), and missed Lasix doses per refill history"
  Interdependence: 0.9 (mechanism links findings)
  Specificity: 0.9 (precise predictions)
  Parsimony: 0.8 (minimal sufficient)
  Falsifiability: 0.9 (if BNP normal, refuted)
  Total HTV: 0.875 ✅
```

---

## 5. Popper-Supervisor Improvements

Per ARPA-H TA2 specs, Popper must:

### 5.1 Accuracy Ascertainment

| Phase | Target |
|-------|--------|
| 1A (Month 12) | >85% ability to ascertain agent accuracy |
| 1B (Month 24) | >95% ability to ascertain agent accuracy |

**Implementation**:
- Benchmark against known-correct cases
- Track Popper's agreement with retrospective ground truth
- Log false positives (unnecessary blocks) and false negatives (missed errors)

### 5.2 Hallucination Quantification

| Phase | Target |
|-------|--------|
| 1A | >85% quantification of hallucination rate |
| 1B | >95% quantification of hallucination rate |

**Implementation**:
- Define hallucination: claim unsupported by evidence_refs
- Popper checks: does each claim have grounding?
- Log and report hallucination rate per session

### 5.3 Drift Monitoring

**Implementation**:
- Baseline distribution of recommendation types
- Detect statistically significant shifts
- Trigger review when drift exceeds threshold
- Log as DRIFT_DETECTED in audit

---

## 6. Epistemological Checklist for Spec Review

When reviewing or updating specs, verify:

| Criterion | Question | Pass Condition |
|-----------|----------|----------------|
| Falsifiability | Does each claim have a falsification condition? | Yes |
| HTV Scoring | Are all recommendations scored for hard-to-vary? | ≥ 0.4 threshold |
| Uncertainty Disclosure | Are unknowns explicitly stated? | `key_unknowns` populated |
| Evidence Grounding | Is each claim linked to evidence? | `evidence_refs` non-empty |
| Versioning | Are all components versioned? | Semver on models, rules, cartridges |
| Audit Trail | Are decisions logged with reasoning? | `trace_id` links to full context |
| Error Correction | Is there a path to fix errors? | Update mechanism defined |

---

## 7. Summary

The Regain clinical agents specs are **strongly aligned** with Deutschian/Popperian epistemology. The gaps identified are refinements, not fundamental changes:

| Gap | Status | Priority |
|-----|--------|----------|
| Claims taxonomy | Not yet specified | High |
| Uncertainty calibration algorithm | Not yet specified | High |
| Evidence grading | Partially specified | Medium |
| IDK Protocol | Mentioned but informal | Medium |
| Cartridge falsification criteria | Not yet specified | Medium |
| Verifier strengthening | Could be enhanced | Low |
| Generator boldness | Could be documented | Low |

These improvements would make the system more epistemologically rigorous and more defensible to regulators (FDA MDDT qualification).

---

## 8. Key Sources

- Existing spec files in `/docs/00-vision/00-clinical-agents/`
- ARPA-H TA2 specs: `C-arpa-TA2-Specs.md`
- This epistemology series: documents 00-06
- [PMC: Falsifiability in medicine](https://pmc.ncbi.nlm.nih.gov/articles/PMC8140582/)

---

## 9. Document Series Navigation

| # | Document | Topic |
|---|----------|-------|
| 00 | Popper-Deutsch Fundamentals | Foundations |
| 01 | Hard-to-Vary Explanations | Core criterion |
| 02 | Primacy of Explanations | Explanation > prediction |
| 03 | Conjecture and Refutation | Scientific method |
| 04 | Fallibilism and Error Correction | Embracing error |
| 05 | Iterative Progress | Knowledge without foundations |
| 06 | Medical Reasoning Alignment | Clinical practice mapping |
| 07 | **This document** | Spec improvements |

---

*Last updated: 2026-01-24*
