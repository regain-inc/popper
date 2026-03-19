# 00 — Why This Spec Set Exists

> **Version**: 0.1.0
> **Date**: 2026-03-19

---

## The Problem: Deterministic Supervision Without Clinical Grounding

Popper's policy engine is structurally sound. It evaluates SupervisionRequests against prioritized rules and produces deterministic decisions. Every decision is auditable, traceable, and PHI-redacted. The fail-safe defaults are conservative: unknown conditions route to clinicians, stale data triggers escalation, missing evidence blocks medication proposals.

But the current rules are **structurally grounded, not clinically grounded**. They answer questions like:

- "Is evidence present?" (yes/no)
- "Is the HTV score above threshold?" (numeric comparison)
- "Is the data fresh enough?" (timestamp arithmetic)
- "Is the patient acuity high?" (composite scoring)

They do not answer questions like:

- "Is this ACE inhibitor proposed alongside an ARB, violating the dual-RAS-blockade prohibition per KDIGO 2024 and FDA labeling?"
- "Does this statin dose exceed the maximum approved dose per the DailyMed structured product label?"
- "Is this SGLT2 inhibitor initiation proposal missing the eGFR context required by KDIGO 2024 for safe initiation?"
- "Does this anticoagulation proposal follow the 2023 ACC/AHA/HRS AF guideline stroke-risk threshold?"

The gap is not that Popper lacks rules — it has 32 rules across 10 priority tiers. The gap is that none of those rules are traceable to specific clinical guidelines, medication labels, or regulatory expectations.

---

## Why This Gap Matters

### 1. Regulatory and accreditation bodies will ask

FDA's PCCP guidance (December 2024, updated August 2025) requires that AI/ML-based SaMD changes be described, protocoled, and impact-assessed. URAC's Health Care AI Accreditation (launched September 2025) evaluates risk management, bias mitigation, and performance monitoring. Joint Commission/CHAI's guidance (September 2025) expects formal AI governance with model cards, drift monitoring, and quality controls. IAC's AI Task Force addendum (April 2025) adds AI-specific requirements to modality accreditation standards.

All of these frameworks expect that clinical rules be traceable to their sources. "We have a policy engine" is necessary but insufficient. "Our policy engine enforces Rule X, which implements AHA/ACC 2022 HF Guideline §7.3.2 Class I Recommendation for SGLT2i in HFrEF, reviewed and approved by Dr. [Name] on [Date], scheduled for review upon next guideline update" — that is the standard.

### 2. Clinicians will not trust uncited rules

When Popper routes a medication proposal to a clinician with reason code `insufficient_evidence`, the clinician needs to know: insufficient according to what? A supervisory system that blocks clinical proposals without citing clinical authority will generate alert fatigue, clinician resistance, and eventual workarounds.

### 3. The existing infrastructure provides a starting point

Hermes defines `EvidenceGrade` (systematic_review through patient_reported) and `evidence_refs` on proposals. Deutsch attaches evidence references to proposals via the ArgMed pipeline. The Hermes `ClinicianFeedbackEvent` supports `guideline_refs` for clinician rationale.

However, this infrastructure needed extension. Hermes v2.1 (`06-hermes-clinical-supervision-contract.md`) now defines typed clinical snapshot payloads, extended medication identity with ATC classification, lab/condition schemas, and vocabulary tables. The Hermes JSON schema types proposals and snapshot_payload accordingly. Deutsch's projection spec (`11-deutsch-to-popper-clinical-projection-spec.md`) defines the migration from current `OTHER`-heavy runtime to typed proposals. The contract layer is in place — the runtime migration (Phase 0 in `10-build-roadmap.md`) is what remains.

### 4. Source-grounded rules are better engineering

Ungrounded rules are fragile. "Route to clinician if HTV score < 0.6 for medication proposals" — where did 0.6 come from? If a guideline changes, which rules need updating? Without provenance, rule maintenance becomes guesswork. With provenance, a guideline update triggers a traceable review of every rule derived from that guideline.

---

## What "More Clinically Grounded" Must Not Mean

### It must not mean "more black box"

Adding clinical content to Popper's rules must not make the system less transparent. Every clinically grounded rule must remain:
- **Deterministic**: same inputs → same decision
- **Auditable**: decision cites which rule fired, which source it implements, and why
- **Reviewable**: any clinical reviewer can read the rule, understand its logic, and verify it against its source
- **Configurable**: sites can adjust thresholds within governed bounds

### It must not mean "LLM decides the standard of care"

Popper does not call an LLM to evaluate clinical appropriateness. Popper applies deterministic rules that have been derived from clinical guidelines by human clinicians and encoded by engineers under clinical governance. The LLM (Deutsch) generates proposals. Popper checks them against pre-defined, pre-approved rules. This separation is the point.

### It must not mean "guidelines override safety"

The source hierarchy is strict: hard safety facts (medication label contraindications, black box warnings) always outrank softer guideline recommendations. A guideline may recommend a medication for a population, but a contraindication for a specific patient overrides that recommendation. Popper must enforce this ordering.

### It must not mean "one-size-fits-all"

Different medical centers have different formularies, escalation pathways, staffing models, and protocols. Clinically grounded rules must be composable with site-specific protocol packs that respect local clinical operations without compromising core safety rules.

---

## The Design Principle

**Clinically grounded, deterministic, auditable, configurable, source-linked supervision.**

Each word matters:

| Word | Meaning |
|---|---|
| **Clinically grounded** | Rules derive from authoritative clinical sources, not engineering intuition |
| **Deterministic** | Same inputs, same decision. No LLM inference in the supervision path |
| **Auditable** | Every decision traces to a rule, every rule traces to a source, every source has a citation |
| **Configurable** | Thresholds, enforcement levels, and local protocols are externalized, not hardcoded |
| **Source-linked** | Every rule carries structured provenance: source, citation, evidence grade, review interval, approval owner |

This spec set defines the architecture, data model, governance workflow, and build roadmap to get there.

---

## What Popper Is, Restated

Popper is not a clinical decision support system. It does not recommend treatments, diagnose conditions, or advise clinicians.

Popper is a **supervisory mechanism** that checks whether AI-generated clinical proposals are consistent with pre-approved rules derived from authoritative clinical sources. It is the "referee" that ensures the "player" (Deutsch) follows the "rulebook" (clinical guidelines + safety rules + local protocols).

The rulebook has been empty. This spec set fills it.
