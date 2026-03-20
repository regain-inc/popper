# 01 — Clinical Grounding and Supervision Spec Set

> **Version**: 0.1.0
> **Date**: 2026-03-19
> **Status**: Draft
> **Owner**: Popper Dev Team + Clinical Governance (TBD)

---

## Purpose

This spec set defines how Popper should evolve from a structurally sound but clinically ungrounded supervisory agent into one whose rules are explicitly traceable to authoritative clinical sources, regulatory expectations, and accreditation frameworks.

Popper already has:
- A deterministic policy engine (`packages/core/src/policy-engine/`)
- A Safety DSL with priority-ordered rules (`03-popper-safety-dsl.md`)
- Evidence-related fields in Hermes (`evidence_refs`, `evidence_grade` on proposals; `guideline_refs` on clinician feedback)
- Safety-oriented logic for missing evidence, uncertainty, hallucination detection, acuity scoring, and fail-safe routing
- A working default policy pack (`config/policies/default.yaml`) with 32 rules across 10 priority tiers
- A policy lifecycle plugin (`apps/server/src/plugins/policy-lifecycle.ts`) with draft/review/approve/activate/archive/rollback flows

What Popper does *not* yet have:
- Rules grounded in specific clinical guidelines (e.g., "ROUTE_TO_CLINICIAN if potassium >5.5 on MRA proposal per lisinopril SPL Warnings §5.1")
- A source hierarchy defining which types of clinical authority take precedence
- A provenance model that ties each rule to its authoritative citation, evidence grade, and review lifecycle
- Domain-specific policy packs for cardiometabolic supervision
- Site-level protocol packs for local formulary and escalation differences
- A governance review workflow ensuring clinician sign-off on clinical rules
- Formal alignment documentation for FDA, URAC, Joint Commission/CHAI, and IAC expectations

This spec set addresses all of these.

---

## Relationship to Existing Specs

### Popper specs
| Existing Spec | Relationship |
|---|---|
| `01-popper-system-spec.md` | This spec set extends the system spec's supervision model with clinical source grounding |
| `02-popper-contracts-and-interfaces.md` | Proposes additions to Hermes types for rule provenance (see `05-rule-provenance`) |
| `03-popper-safety-dsl.md` | Builds on the Safety DSL with new condition kinds and policy pack structure (see `04-policy-pack-architecture`) |
| `04-popper-regulatory-export-and-triage.md` | Connects export bundles to source-grounded audit trails (see `08-regulatory-alignment`) |
| `08-arpa-iso-traceability-matrix.md` | Extends traceability to clinical guideline citations |
| `00-dashboard-harsh/` | Dashboard already surfaces policy pack info; grounded packs improve the compliance story |

### Cross-system specs (Hermes + Deutsch)
| Spec | Repo | Relationship |
|---|---|---|
| `02-hermes-contracts.md` §3.3 | Hermes | Defines `MedicationOrderProposal` type with medication identity and change fields |
| `06-hermes-clinical-supervision-contract.md` | Hermes | **NEW.** Clinical snapshot payload, extended medication identity (ATC class), lab/condition schemas, native evidence grading, vocabulary tables |
| `hermes-message.schema.json` | Hermes | JSON schema now types proposals and snapshot_payload to match prose |
| `03-deutsch-cvd-cartridge-spec.md` §5, §9, §10 | Deutsch | Protocol registry, guideline source registry, medication proposal requirements |
| `11-deutsch-to-popper-clinical-projection-spec.md` | Deutsch | **NEW.** How Deutsch projects cartridge output into typed Hermes proposals; migration plan from `OTHER` to `MEDICATION_ORDER_PROPOSAL` |

---

## Current State vs. Target State

### Current state (code-backed)
- Policy engine evaluates rules deterministically against Hermes SupervisionRequests
- Rules check structural properties: schema validity, staleness, evidence presence, HTV score, uncertainty level, acuity, intervention risk
- `PolicySource` type has `kind: 'policy' | 'guideline' | 'other'` with a free-text `citation` string — this is the existing hook, but no guideline content or structured citations are stored
- Evidence grading and HTV scoring originate from `@regain/hermes` and are consumed by Popper as inputs from Deutsch
- The default policy pack cites only internal specs ("03-popper-safety-dsl.md §5")
- Policy lifecycle plugin already supports draft/review/approve/activate/archive/rollback flows

### Upstream contract state (spec-defined but not yet in runtime)
- **Hermes prose spec** (`02-hermes-contracts.md` §3.3) already defines a typed `MedicationOrderProposal` with `medication.name`, `medication.rxnorm_code`, `change.change_type`, `change.from_dose/to_dose`, and `clinician_protocol_ref`.
- **Hermes v2.3 extension** (`06-hermes-clinical-supervision-contract.md`) adds `medication.atc_class`, `structured_dose`, `ClinicalSnapshotPayload` (active medications, labs, conditions, vitals, allergies), and `NativeGrading` for source-native evidence systems.
- **Hermes JSON schema** (`hermes-message.schema.json`) now types `proposals` as `Array<ProposedIntervention>` and `snapshot_payload` as `ClinicalSnapshotPayload`.
- **Deutsch CVD cartridge spec** (`03-deutsch-cvd-cartridge-spec.md` §5.2, §9, §10) already requires `MEDICATION_ORDER_PROPOSAL` with protocol refs and evidence refs; defines a protocol registry and guideline source registry.
- **Deutsch projection spec** (`11-deutsch-to-popper-clinical-projection-spec.md`) defines the migration from current `OTHER`-heavy runtime to typed proposals.

**The gap is in runtime, not in contract:** Deutsch's `supervision.ts` currently maps `treatment_rec` to `OTHER` instead of the already-specified `MEDICATION_ORDER_PROPOSAL`. The snapshot builder does not yet populate `snapshot_payload`. The Deutsch projection spec (Phase 0 in the roadmap) defines the migration.

### Target state (this spec set)
- Each clinical rule carries structured provenance: source type, exact citation, evidence grade, jurisdiction, review interval, approval owner
- Domain-specific policy packs (cardiometabolic first) contain rules traceable to AHA/ACC, ADA, KDIGO, and FDA label sources
- Site protocol packs allow local formulary and escalation customization without forking core rules
- A clinical governance review workflow ensures no clinical rule enters production without physician sign-off
- Regulatory and accreditation alignment is documented, not claimed

---

## Reading Order

| # | File | What It Covers |
|---|---|---|
| 00 | [00-why-this-spec-set-exists.md](./00-why-this-spec-set-exists.md) | Motivation and design principles |
| 01 | [01-source-hierarchy-for-popper-rules.md](./01-source-hierarchy-for-popper-rules.md) | What Popper should trust and in what order |
| 02 | [02-cardiometabolic-guideline-priority-map.md](./02-cardiometabolic-guideline-priority-map.md) | First-wave clinical grounding targets |
| 03 | [03-imaging-and-modality-extension-map.md](./03-imaging-and-modality-extension-map.md) | Future modality supervision architecture |
| 04 | [04-policy-pack-architecture.md](./04-policy-pack-architecture.md) | How policy packs should be structured and composed |
| 05 | [05-rule-provenance-and-evidence-model.md](./05-rule-provenance-and-evidence-model.md) | How each rule carries its source citation — **most important file** |
| 06 | [06-enforcement-levels-and-decision-taxonomy.md](./06-enforcement-levels-and-decision-taxonomy.md) | When to HARD_STOP vs. ROUTE_TO_CLINICIAN vs. other |
| 07 | [07-site-protocol-pack-and-localization.md](./07-site-protocol-pack-and-localization.md) | How local medical-center rules plug in |
| 08 | [08-regulatory-and-accreditation-alignment.md](./08-regulatory-and-accreditation-alignment.md) | FDA, URAC, Joint Commission/CHAI, IAC alignment |
| 09 | [09-clinical-governance-review-workflow.md](./09-clinical-governance-review-workflow.md) | Human governance so engineers don't encode medicine alone |
| 10 | [10-build-roadmap.md](./10-build-roadmap.md) | Phased implementation plan |

---

## Key Principles

1. **Popper is a supervisory mechanism, not a source of medicine.** It enforces rules derived from authoritative clinical sources. It does not generate clinical recommendations.
2. **Clinically grounded does not mean black box.** Every rule must be deterministic, auditable, and traceable to its source.
3. **Source hierarchy matters.** Medication label contraindications outrank guideline recommendations, which outrank local protocols, which outrank emerging literature.
4. **Clinical rules require clinical review.** No clinical rule enters a policy pack without physician sign-off. Engineering owns the mechanism; clinical governance owns the content.
5. **Governance alignment is documented, not endorsed.** Popper should be built so it is naturally compatible with regulatory and accreditation expectations without claiming endorsement.
