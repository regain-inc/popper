---
version: 1.0.0
last-updated: 2026-01-24
status: draft
owner: Deutsch Dev Team
tags: [advocate, ta1, deutsch, argmed, debate, popperian]
---

# Deutsch ArgMed Debate Specification (v1)

## 0) Purpose

This document formalizes the **ArgMed multi-agent debate** pattern that implements Popperian conjecture-refutation within Deutsch (TA1). The debate ensures that clinical recommendations are:
1. **Bold** — multiple hypotheses are generated
2. **Tested** — hypotheses are actively criticized
3. **Selected** — only survivors of criticism are presented
4. **Transparent** — the reasoning process is auditable

**Epistemological Foundations**: See [`../00-overall-specs/00-epistemology-foundations/03-conjecture-and-refutation.md`](../00-overall-specs/00-epistemology-foundations/03-conjecture-and-refutation.md)

---

## 1) Philosophy Grounding

### 1.1 Popperian Epistemology

Karl Popper's core insight: science advances not by confirming theories but by attempting to **refute** them. The ArgMed debate operationalizes this:

| Popperian Concept | ArgMed Implementation |
|-------------------|----------------------|
| Bold conjectures | Generator produces multiple hypotheses |
| Attempted refutation | Verifier attacks each hypothesis |
| Error elimination | Refuted hypotheses are discarded |
| Tentative adoption | Survivor hypotheses become recommendations |

### 1.2 Deutschian Enhancement

David Deutsch adds the **hard-to-vary** criterion: good explanations are those where every detail plays a functional role. The ArgMed debate scores explanations using HTV (Hard-to-Vary) dimensions.

---

## 2) Three-Agent Architecture

The ArgMed debate involves three logical roles (which MAY be implemented as separate LLM calls, prompts within a single call, or deterministic components):

```
┌─────────────────────────────────────────────────────────────────┐
│                      ArgMed Debate Flow                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    hypotheses    ┌──────────────┐             │
│  │  GENERATOR   │ ───────────────► │   VERIFIER   │             │
│  │ (Conjecturer)│                  │   (Critic)   │             │
│  └──────────────┘                  └──────┬───────┘             │
│         │                                 │                      │
│         │ context                         │ critiques            │
│         │                                 │ + HTV scores         │
│         ▼                                 ▼                      │
│  ┌─────────────────────────────────────────────────┐            │
│  │                   REASONER                       │            │
│  │                 (Synthesizer)                    │            │
│  │  - Selects survivors                            │            │
│  │  - Computes final confidence                    │            │
│  │  - Produces recommendations                     │            │
│  └─────────────────────────────────────────────────┘            │
│                          │                                       │
│                          ▼                                       │
│               ProposedIntervention[]                            │
│               (with HTV scores + evidence)                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.1 Generator (Conjecturer)

**Role**: Produce multiple **bold hypotheses** from the health snapshot and patient context.

**Responsibilities**:
- Generate ≥2 hypotheses for clinical claims (diagnosis, treatment)
- Generate ≥1 hypothesis for non-clinical claims (lifestyle, administrative)
- Ensure **diversity** — hypotheses should span different mechanisms
- Avoid premature closure — don't anchor on the first plausible hypothesis

**Input**:
- `HealthStateSnapshot` — patient data
- `user_message` — patient's current input
- `cartridge.guardrails` — domain constraints
- `mode` — wellness vs advocate_clinical

**Output**:
```typescript
interface GeneratorOutput {
  hypotheses: Hypothesis[];
  context_summary: string;       // Brief summary of case context
  data_quality_assessment: {
    missing_signals: string[];
    conflicting_signals: string[];
    confidence_in_data: number;  // 0.0-1.0
  };
}

interface Hypothesis {
  hypothesis_id: string;
  claim_type: ClaimType;
  claim_text: string;            // The hypothesis statement
  mechanism: string;             // Explanation of causation
  predictions: string[];         // What this hypothesis predicts
  evidence_refs: EvidenceRef[];  // Supporting evidence
  bold_rating: number;           // 0.0-1.0, how specific/risky is this claim
}
```

**Normative Constraints**:
- Generator MUST produce ≥2 hypotheses for any `claim_type` in `['diagnosis', 'treatment_rec', 'prognosis']`
- Generator SHOULD prefer bold hypotheses (specific, testable) over vague ones
- Generator MUST NOT filter hypotheses — that's the Verifier's job

### 2.2 Verifier (Critic)

**Role**: **Adversarially attack** each hypothesis, seeking refutation.

**Responsibilities**:
- Find **contradictory evidence** in the snapshot
- Identify **logical flaws** in the mechanism
- Score each hypothesis using **HTV dimensions**
- Generate **counter-hypotheses** when warranted
- Identify what **additional data** would resolve uncertainty

**Input**:
- `GeneratorOutput` — hypotheses to attack
- `HealthStateSnapshot` — same snapshot for consistency
- `cartridge.guardrails` — domain constraints

**Output**:
```typescript
interface VerifierOutput {
  critiques: HypothesisCritique[];
  counter_hypotheses?: Hypothesis[];  // Alternative explanations
  data_requests: string[];            // What data would resolve uncertainty
  verifier_agreed: boolean;           // Did verifier find any hypothesis acceptable?
}

interface HypothesisCritique {
  hypothesis_id: string;
  status: 'refuted' | 'weakened' | 'survived' | 'strengthened';

  // Refutation attempts
  contradictions_found: Contradiction[];
  logical_flaws: string[];
  missing_evidence: string[];

  // HTV scoring (the core quality metric)
  htv_score: HTVScore;

  // Counter-arguments
  counter_arguments: string[];
  alternative_explanations: string[];

  // Overall assessment
  critique_summary: string;
  confidence_in_critique: number;  // 0.0-1.0
}

interface Contradiction {
  source: string;           // What data contradicts the hypothesis
  contradiction: string;    // How it contradicts
  severity: 'fatal' | 'significant' | 'minor';
}
```

**Normative Constraints**:
- Verifier MUST attempt to refute every hypothesis (adversarial stance)
- Verifier MUST compute HTV score for every hypothesis
- Verifier MUST identify at least one potential refutation condition per hypothesis
- Verifier SHOULD NOT prefer hypotheses that match prior beliefs (no confirmation bias)

### 2.3 Reasoner (Synthesizer)

**Role**: **Select survivors** and produce final recommendations.

**Responsibilities**:
- Filter out refuted hypotheses
- Rank surviving hypotheses by HTV score
- Combine consistent hypotheses when appropriate
- Produce `ProposedIntervention[]` with full metadata
- Trigger **IDK Protocol** when no hypothesis survives or uncertainty is high

**Input**:
- `GeneratorOutput` — original hypotheses
- `VerifierOutput` — critiques and scores
- `mode` — behavior boundary

**Output**:
```typescript
interface ReasonerOutput {
  selected_hypotheses: string[];           // IDs of surviving hypotheses
  rejected_hypotheses: RejectionRecord[];  // Why each was rejected
  proposals: ProposedIntervention[];       // Final recommendations
  debate_metadata: DebateMetadata;
  idk_triggered: boolean;                  // True if IDK Protocol activated
  idk_response?: IDKResponse;              // Present if idk_triggered
}

interface RejectionRecord {
  hypothesis_id: string;
  rejection_reason: 'refuted' | 'low_htv' | 'insufficient_evidence' | 'conflict_unresolved';
  details: string;
}

interface DebateMetadata {
  debate_id: string;
  total_hypotheses_generated: number;
  hypotheses_refuted: number;
  hypotheses_survived: number;
  verifier_agreed: boolean;
  highest_htv_score: number;
  lowest_htv_score: number;
  debate_duration_ms?: number;
}
```

**Normative Constraints**:
- Reasoner MUST reject hypotheses with `htv_score.composite < 0.3` (refutation threshold)
- Reasoner SHOULD prefer hypotheses with `htv_score.composite >= 0.7`
- Reasoner MUST trigger IDK Protocol if no hypothesis has `htv_score.composite >= 0.4`
- Reasoner MUST include `htv_score` and `claim_type` on every `ProposedIntervention`

---

## 3) Conjecture Rules

### 3.1 Minimum Hypothesis Count

| Claim Type | Minimum Hypotheses | Rationale |
|------------|-------------------|-----------|
| `diagnosis` | 2 | Differential diagnosis requires alternatives |
| `treatment_rec` | 2 | Consider alternative treatments |
| `prognosis` | 2 | Best-case vs worst-case scenarios |
| `lifestyle_rec` | 1 | Lower risk, single recommendation acceptable |
| `escalation` | 1 | Routing decisions don't need alternatives |
| `administrative` | 1 | Non-clinical, single recommendation acceptable |

### 3.2 Diversity Requirement

Hypotheses SHOULD span different:
- **Mechanisms** — don't generate variants of the same explanation
- **Severity levels** — include both serious and benign possibilities
- **Interventions** — consider pharmacological vs non-pharmacological

**Example** (chest pain differential):
```
Hypothesis 1: Acute coronary syndrome (cardiac mechanism)
Hypothesis 2: Pulmonary embolism (pulmonary mechanism)
Hypothesis 3: Musculoskeletal pain (MSK mechanism)
```

NOT:
```
Hypothesis 1: STEMI (cardiac)
Hypothesis 2: NSTEMI (cardiac)
Hypothesis 3: Unstable angina (cardiac)
```
(All three are variants of the same mechanism)

### 3.3 Bold Conjecture Logging

Generator MUST log for each hypothesis:
- `bold_rating` — how specific/risky is this claim (0.0 = vague, 1.0 = precise)
- `audit_redaction.summary` — PHI-safe summary for audit

Hypotheses with `bold_rating < 0.3` SHOULD be flagged for review — they may indicate the Generator is being too cautious.

---

## 4) Refutation Criteria

### 4.1 Valid Refutation Types

| Type | Description | Example |
|------|-------------|---------|
| **Empirical contradiction** | Data in snapshot contradicts prediction | "Hypothesis predicts elevated troponin, but troponin is normal" |
| **Logical flaw** | Mechanism contains logical inconsistency | "Claim requires X and not-X simultaneously" |
| **Missing necessary evidence** | Required supporting evidence absent | "Treatment guideline not found for this indication" |
| **Low HTV score** | Explanation is easy to vary | `htv_score.composite < 0.3` |

### 4.2 Refutation Threshold

```
IF htv_score.composite < 0.3
THEN status = 'refuted'
     rejection_reason = 'low_htv'
```

### 4.3 Weakening vs Refutation

| Condition | Status |
|-----------|--------|
| Fatal contradiction found | `refuted` |
| Multiple significant contradictions | `refuted` |
| Single significant contradiction | `weakened` |
| Minor contradictions only | `weakened` |
| No contradictions, low HTV | `refuted` (< 0.3) or `weakened` (0.3-0.4) |
| No contradictions, adequate HTV | `survived` |
| Counter-evidence supports hypothesis | `strengthened` |

---

## 5) HTV Scoring Algorithm

### 5.1 Dimension Definitions

| Dimension | Question | Scoring Guidance |
|-----------|----------|------------------|
| **Interdependence** | How tightly coupled are claim components? | High (0.8-1.0): every piece connects; Low (0.0-0.3): components are independent |
| **Specificity** | How precise are predictions? | High: specific measurable outcomes; Low: vague/unfalsifiable |
| **Parsimony** | Are all elements necessary? | High: minimal sufficient; Low: includes superfluous elements |
| **Falsifiability** | What would refute this? | High: clear conditions exist; Low: claim is immune to counterevidence |

### 5.2 Computation

```typescript
function computeHTVScore(hypothesis: Hypothesis, critique: HypothesisCritique): HTVScore {
  // Interdependence: Do evidence refs connect to mechanism?
  const interdependence = assessInterdependence(hypothesis);

  // Specificity: Are predictions measurable?
  const specificity = assessSpecificity(hypothesis.predictions);

  // Parsimony: Are all elements necessary?
  const parsimony = assessParsimony(hypothesis);

  // Falsifiability: Are refutation conditions clear?
  const falsifiability = critique.contradictions_found.length > 0 ||
                         hypothesis.predictions.length > 0
    ? assessFalsifiability(hypothesis)
    : 0.1; // Unfalsifiable claims get low score

  const composite = 0.25 * interdependence +
                    0.25 * specificity +
                    0.25 * parsimony +
                    0.25 * falsifiability;

  return { interdependence, specificity, parsimony, falsifiability, composite };
}
```

### 5.3 Threshold Mapping

| Composite | Quality | Action |
|-----------|---------|--------|
| ≥ 0.7 | Good | Proceed (subject to other checks) |
| 0.4 – 0.7 | Moderate | Disclose uncertainty; may proceed for low-risk |
| 0.3 – 0.4 | Poor | Route to clinician (high-risk) or IDK Protocol |
| < 0.3 | Refuted | Reject hypothesis; do not proceed |

---

## 6) Integration with Popper

### 6.1 SupervisionRequest Population

When Deutsch sends a `SupervisionRequest` after ArgMed debate:

```typescript
const supervisionRequest: SupervisionRequest = {
  // ... standard fields ...

  proposals: reasonerOutput.proposals.map(p => ({
    ...p,
    claim_type: p.claim_type,              // From hypothesis
    htv_score: p.htv_score,                // From Verifier
    falsification_criteria: deriveFalsificationCriteria(p),
    uncertainty_calibration: computeUncertainty({
      minEvidenceGrade: getMinGrade(p.evidence_refs),
      htvScore: p.htv_score.composite,
      missingSignals: generatorOutput.data_quality_assessment.missing_signals,
      conflictingSignals: generatorOutput.data_quality_assessment.conflicting_signals,
      verifierAgreed: verifierOutput.verifier_agreed,
      dataAgeDays: computeDataAge(snapshot),
    }),
  })),

  // Include debate metadata in notes for audit
  notes: `ArgMed debate: ${reasonerOutput.debate_metadata.hypotheses_survived}/${reasonerOutput.debate_metadata.total_hypotheses_generated} survived`,
};
```

### 6.2 Popper HTV Evaluation

Popper MAY use the following Safety DSL conditions:

```typescript
// Route if HTV too low
{ kind: 'htv_score_below', threshold: 0.4 }

// Route if evidence grade too weak
{ kind: 'evidence_grade_below', threshold: 'cohort' }
```

### 6.3 Audit Events

Deutsch MUST emit audit events for the debate:

```typescript
// After debate completes
emit({
  event_type: 'OTHER',
  other_event_type: 'ARGMED_DEBATE_COMPLETED',
  summary: `Debate ${debate_metadata.debate_id}: ${debate_metadata.hypotheses_survived}/${debate_metadata.total_hypotheses_generated} hypotheses survived`,
  tags: {
    debate_id: debate_metadata.debate_id,
    total_hypotheses: String(debate_metadata.total_hypotheses_generated),
    survived: String(debate_metadata.hypotheses_survived),
    refuted: String(debate_metadata.hypotheses_refuted),
    highest_htv: String(debate_metadata.highest_htv_score),
    verifier_agreed: String(debate_metadata.verifier_agreed),
  },
});
```

---

## 7) Failure Modes

### 7.1 Generator Produces No Hypotheses

**Cause**: Insufficient data or out-of-scope query.

**Response**: Trigger IDK Protocol with `reason_code = 'MISSING_DATA'`.

### 7.2 All Hypotheses Refuted

**Cause**: Available hypotheses don't fit the data.

**Response**: Trigger IDK Protocol with `reason_code = 'LOW_HTV'` or generate counter-hypotheses.

### 7.3 Verifier and Generator Disagree Strongly

**Cause**: Model uncertainty or conflicting data.

**Response**: Flag in `uncertainty_calibration.drivers` and prefer routing.

### 7.4 Debate Timeout

**Cause**: LLM latency exceeds budget.

**Response**: Use partial results if Verifier completed; else route to clinician.

---

## 8) Testing Requirements

### 8.1 Unit Tests

- Generator produces ≥ minimum hypotheses per claim type
- Verifier computes HTV scores for all hypotheses
- Reasoner rejects hypotheses below HTV threshold
- IDK Protocol triggers when appropriate

### 8.2 Integration Tests

- Full debate produces valid `ProposedIntervention[]`
- Audit events are emitted correctly
- Popper receives and can evaluate HTV scores

### 8.3 Adversarial Tests

- Generator with leading prompt doesn't anchor on single hypothesis
- Verifier with obvious hypothesis still attempts refutation
- System handles conflicting data gracefully

---

## 9) References

- [03-conjecture-and-refutation.md](../00-overall-specs/00-epistemology-foundations/03-conjecture-and-refutation.md) — Popperian method
- [01-hard-to-vary-explanations.md](../00-overall-specs/00-epistemology-foundations/01-hard-to-vary-explanations.md) — HTV criterion
- [04-hermes-epistemological-types.md](../03-hermes-specs/04-hermes-epistemological-types.md) — Type definitions
- [08-deutsch-idk-protocol.md](./08-deutsch-idk-protocol.md) — IDK Protocol

---

*Last updated: 2026-01-24*
