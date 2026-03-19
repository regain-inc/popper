# 06 — Enforcement Levels and Decision Taxonomy

> **Version**: 0.1.0
> **Date**: 2026-03-19

---

## Overview

Popper's four decision types (`HARD_STOP`, `ROUTE_TO_CLINICIAN`, `REQUEST_MORE_INFO`, `APPROVED`) are already defined in Hermes and implemented in the policy engine. This document specifies when each decision should be used in the context of clinically grounded rules, and how source hierarchy, evidence strength, safety criticality, and uncertainty interact to determine the appropriate enforcement level.

---

## Decision Types

### HARD_STOP

**Meaning:** The proposal must not proceed. Deutsch must block the action entirely and inform the patient that the recommendation cannot be provided.

**When to use:**
- Absolute contraindication matched (Layer 1)
- Schema validation failure (cannot evaluate safety)
- No health state snapshot provided
- Critical hallucination detected
- Critical intervention risk with medication proposal
- Critical patient acuity with medication proposal
- Prompt injection or jailbreak attempt detected
- Clinical domain processing failed

**When NOT to use:**
- Guideline deviation (use `ROUTE_TO_CLINICIAN` — clinician may have valid reason to deviate)
- Missing evidence (use `ROUTE_TO_CLINICIAN` or `REQUEST_MORE_INFO`)
- Relative contraindication (use `ROUTE_TO_CLINICIAN`)
- Local protocol deviation (use `ROUTE_TO_CLINICIAN`)
- Emerging safety signal (use `ROUTE_TO_CLINICIAN`)

**Clinical principle:** `HARD_STOP` means "this action is unsafe by definition and no clinician should authorize it through this system." This is reserved for clear, unambiguous safety violations where there is no legitimate clinical scenario in which the action could be appropriate.

**Source hierarchy rule:** Only Layer 1 (hard safety facts) and system integrity failures should produce `HARD_STOP`. Layer 2-5 sources should not produce `HARD_STOP` under normal circumstances.

**Exception:** A Class III (harm) guideline recommendation with LOE A may produce `HARD_STOP` if the clinical governance board specifically approves this classification. Example: aspirin as anticoagulation alternative in AF (2023 AF Guideline Class III — harm).

---

### ROUTE_TO_CLINICIAN

**Meaning:** The proposal requires human clinician review before proceeding. Deutsch must route the case to MISS (the clinician-facing system) and inform the patient that their care team will review.

**When to use:**
- Relative contraindication matched (Layer 1)
- Black box warning condition present (Layer 1)
- Major drug interaction detected (Layer 1)
- Guideline Class I recommendation violated (Layer 2)
- Guideline Class III (harm) recommendation matched (Layer 2, unless elevated to HARD_STOP)
- Missing evidence references on medication proposal
- Missing clinician protocol reference on medication proposal
- Weak evidence grade on clinical proposal
- Low HTV score on medication proposal
- High uncertainty on medication proposal
- Stale data with high-risk proposal
- Safe-mode enabled for high-risk proposal types
- Non-formulary medication proposed (Layer 3)
- Scope-of-practice exceeded (Layer 3)
- New safety signal from emerging evidence (Layer 5)
- Cross-domain conflict escalated
- High patient acuity
- High intervention risk

**Clinical principle:** `ROUTE_TO_CLINICIAN` means "a human must review this before it reaches the patient." The clinician may approve, modify, or reject the proposal. The clinician's action is logged via Hermes `ClinicianFeedbackEvent`.

**Override expectation:** Clinician overrides of `ROUTE_TO_CLINICIAN` decisions are expected and appropriate. The system should track override rates and rationale but should not treat overrides as errors.

---

### REQUEST_MORE_INFO

**Meaning:** The proposal cannot be evaluated with available information. Deutsch should ask the patient or system for additional data and resubmit.

**When to use:**
- Required lab values missing from snapshot (eGFR, potassium, lipid panel, etc.)
- Stale data with low-risk proposal
- Low HTV score on non-medication proposal
- High uncertainty on non-medication proposal
- Guideline Class IIa recommendation not followed — request clarification of clinical reasoning (Class IIb deviations are informational only, no enforcement)
- Moderate drug interaction — request confirmation of patient's current medications
- Missing dosing context (weight, renal function) for dose-dependent medications

**Clinical principle:** `REQUEST_MORE_INFO` means "we cannot evaluate safety without additional data." It is not a rejection — it is a request for completeness. The proposal may proceed once the missing information is provided.

**When to prefer over ROUTE_TO_CLINICIAN:** Use `REQUEST_MORE_INFO` when the issue is information quality, not clinical risk. If providing the missing information would resolve the concern, use `REQUEST_MORE_INFO`. If a clinician needs to exercise judgment regardless of the data, use `ROUTE_TO_CLINICIAN`.

---

### APPROVED

**Meaning:** The proposal may proceed. Deutsch can deliver the recommendation to the patient.

**When to use:**
- All loaded rules have been evaluated and none triggered a higher-priority decision
- Wellness proposals (care navigation, patient messages, lifestyle modifications, nutrition plans) that pass all safety checks
- Clinical proposals where all evidence, staleness, acuity, and guideline checks pass
- Proposals that are explicitly approved by a guideline-derived rule (e.g., first-line antihypertensive in uncomplicated HTN)

**Constraints on APPROVED:** An `APPROVED` decision may carry constraints:
- `must_route_after`: time limit after which the decision must be re-evaluated
- `allowed_actions`: restrictions on what can be done with the approved proposal

**Clinical principle:** `APPROVED` means "based on the rules currently loaded, this proposal does not trigger any safety concerns." It does not mean "this is clinically optimal" — Popper checks safety, not optimality.

---

## Decision Matrix by Source Layer

| Source Layer | Safety Concern | Default Decision | Can Be Elevated? | Can Be Reduced? |
|---|---|---|---|---|
| Layer 1: Absolute contraindication | Patient will be harmed | `HARD_STOP` | No | No |
| Layer 1: Relative contraindication | Patient may be harmed | `ROUTE_TO_CLINICIAN` | To `HARD_STOP` by clinical governance | No |
| Layer 1: Black box warning | Serious risk present | `ROUTE_TO_CLINICIAN` | To `HARD_STOP` by clinical governance | No |
| Layer 1: Major drug interaction | Serious interaction risk | `ROUTE_TO_CLINICIAN` | To `HARD_STOP` by clinical governance | No |
| Layer 1: Dose exceeds maximum | Over-dosing risk | `ROUTE_TO_CLINICIAN` | To `HARD_STOP` by clinical governance | No |
| Layer 2: Class I violated | Guideline divergence | `ROUTE_TO_CLINICIAN` | No | No |
| Layer 2: Class III (harm) | Harmful action | `ROUTE_TO_CLINICIAN` | To `HARD_STOP` by clinical governance | No |
| Layer 2: Class IIa not followed | Suboptimal therapy | `REQUEST_MORE_INFO` or informational | No | To informational only |
| Layer 2: Class IIb not followed | Uncertain benefit | No enforcement | No | N/A |
| Layer 3: Non-formulary | Protocol deviation | `ROUTE_TO_CLINICIAN` | No | To `REQUEST_MORE_INFO` by site config |
| Layer 3: Scope exceeded | Authorization gap | `ROUTE_TO_CLINICIAN` | No | No |
| Layer 4: Governance requirement | Compliance | Structural (not decision) | N/A | N/A |
| Layer 5: New safety signal | Emerging risk | `ROUTE_TO_CLINICIAN` | To `HARD_STOP` only after clinical governance review and promotion to Layer 1/2 | To `REQUEST_MORE_INFO` by clinical governance |

---

## Interaction with Existing Rule Priorities

The current priority system in `default.yaml` aligns well with the source hierarchy:

See `04-policy-pack-architecture.md` for the **normative priority table**. Summary:

| Priority Range | Owner | Contents |
|---|---|---|
| 1000+ | Core safety | Schema/security |
| 900-999 | Core safety | Staleness |
| 800-899 | Core safety | Safe-mode |
| 700-799 | Core + **Domain L1** | Input risk flags (core) + contraindications, label safety, drug interactions, allergy matches (domain Layer 1) |
| 600-699 | Core safety | Evidence quality, HTV score, evidence grade |
| 500-599 | Core safety | Uncertainty |
| 400-499 | Core safety | Hallucination detection |
| 300-399 | Core safety | Cross-domain conflicts |
| 200-299 | Core + **Domain L2** | Acuity/intervention risk (core) + guideline-derived therapy rules |
| 100-199 | **Domain L2** | Additional guideline rules, monitoring |
| 50-99 | **Site packs** | Formulary, escalation, scope-of-practice |
| 0-10 | Core safety | Default approval (wellness) + default fallback |

**Key invariant:** Layer 1 domain rules (contraindications) evaluate at 700-799, ABOVE generic evidence checks at 600-699. This guarantees a patient-specific contraindication fires before a generic "missing evidence" rule under first-match-wins semantics.

---

## Uncertainty and Evidence Interaction

When multiple factors contribute to a decision, the most restrictive factor wins:

| Evidence Grade | Uncertainty Level | Patient Acuity | Result |
|---|---|---|---|
| Strong (RCT/systematic review) | Low | Low | `APPROVED` (if no other issues) |
| Strong | Low | High | `ROUTE_TO_CLINICIAN` (acuity overrides) |
| Strong | High | Any | `ROUTE_TO_CLINICIAN` (uncertainty overrides) |
| Weak (case series/expert opinion) | Low | Low | `ROUTE_TO_CLINICIAN` for medication; `REQUEST_MORE_INFO` for other |
| Weak | High | Any | `ROUTE_TO_CLINICIAN` |
| Missing | Any | Any | `ROUTE_TO_CLINICIAN` for medication; `REQUEST_MORE_INFO` for other |

This already matches the existing rule structure in `default.yaml`. The addition of clinically grounded rules adds specificity to the "strong" and "weak" categories by tying them to COR/LOE classifications.

---

## Monitor-Only and Governance-Only Signals

Some situations should be logged for monitoring but should not affect the supervision decision:

| Signal | Action | Decision Impact |
|---|---|---|
| Guideline Class IIb not followed | Log in audit event with tag `governance_signal: class_IIb_divergence` | None |
| Override rate trending up | Log drift signal | None (unless threshold triggers safe-mode) |
| Rule nearing review_due date | Log governance alert | None |
| Bias metric threshold approached | Log governance signal | None (until governance action) |

These signals use the existing audit event and drift detection infrastructure. They do not require new decision types.

---

## Conservative Default

The existing default fallback rule (priority 0, `kind: always`, decision: `ROUTE_TO_CLINICIAN`) remains unchanged. If no rule matches a clinical proposal, it routes to a clinician. This is the correct conservative default for a supervisory system.

For wellness proposals (care navigation, patient messages, lifestyle modifications, nutrition plans), the existing default approval rule (priority 10) also remains unchanged — these are low-risk actions that do not require clinician review by default.
