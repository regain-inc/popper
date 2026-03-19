# 10 — Build Roadmap

> **Version**: 0.1.0
> **Date**: 2026-03-19

---

## Overview

This roadmap translates the spec set into a phased implementation plan. Each phase builds on the previous one. The goal is to reach clinically grounded supervision of cardiometabolic medications within 6 months, with site protocol support and governance workflow operational by month 9.

---

## Current State (March 2026)

### What exists and works

| Component | Status | Evidence |
|---|---|---|
| Policy engine (parser, evaluator, decision builder) | **Implemented, tested** | 25KB evaluator + 34KB tests, 21KB parser + 15KB tests |
| Default policy pack (32 rules, 10 priority tiers) | **Implemented** | `config/policies/default.yaml` |
| Safety DSL v1 with 28 condition kinds | **Implemented** | `packages/core/src/policy-engine/types.ts` |
| Hermes v2.1.0 schema with evidence types + clinical supervision contract | **Implemented** | `@regain/hermes` npm package |
| Deutsch → Popper supervision integration | **Implemented** | `04-deutsch/apps/api/src/helpers/supervision.ts` |
| Audit events with PHI redaction | **Implemented** | `packages/core/src/audit/` |
| Drift detection | **Implemented** | `packages/core/src/drift/` |
| Safe-mode controls | **Implemented** | `packages/core/src/safe-mode/` |
| Ops dashboard (status, audit log, safe-mode) | **Implemented** | Next.js dashboard in `apps/web/` |
| KSA deployment | **Deployed** | popper.regain.ai on Oracle VM |
| PolicySource type with `kind` and `citation` | **Implemented** | `policy-engine/types.ts` line 49-52 |

### What exists but is not acknowledged in earlier spec drafts

| Component | Status | Evidence |
|---|---|---|
| Policy lifecycle plugin (draft/review/approve/activate/archive/rollback) | **Implemented** | `apps/server/src/plugins/policy-lifecycle.ts` (18KB) |
| Multi-directory pack loading | **Partially implemented** | Loader already loads from `config/policies/` and `config/policies/reconfigure/` |
| Reconfigure policy engine (drift-triggered operational changes) | **Implemented** | `packages/core/src/reconfigure-policy/` with 3 policies in `config/policies/reconfigure/default.yaml` |

### What exists in spec but not in runtime (the migration gap)

| Component | Spec Status | Runtime Status |
|---|---|---|
| Typed `MedicationOrderProposal` with medication identity | **Defined** in Hermes `02` §3.3 + `06` | **Not emitted** — Deutsch sends `OTHER` |
| Clinical snapshot payload (labs, meds, conditions) | **Defined** in Hermes `06` + JSON schema | **Not populated** — Deutsch sends metadata only |
| Vocabulary (RxNorm, ATC, LOINC, SNOMED aliases) | **Defined** in Hermes `06` §5 | **Not implemented** in runtime |
| Deutsch → Popper clinical projection rules | **Defined** in Deutsch `11` | **Not implemented** in `supervision.ts` |

### What does not exist yet (spec or runtime)

| Component | Status |
|---|---|
| Structured rule provenance (`RuleProvenance` type) | Not implemented |
| Source registry | Not implemented |
| Domain-specific policy packs | Not implemented |
| Site protocol packs | Not implemented |
| Clinical governance review workflow | Not implemented |
| Medication-specific condition kinds in Popper evaluator | Not implemented |
| Multi-pack composition with merge and conflict detection | Not implemented (basic multi-dir loading exists) |
| Formulary data model | Not implemented |
| Activation bundle integrity model | Not implemented |

---

## Phase 0: Upstream Runtime Migration (Days 1-45)

### Goal
Align Deutsch runtime with the already-defined Hermes contract. The contracts exist in spec — the gap is in runtime code.

### What already exists in spec (not in runtime)
- **Hermes prose** (`02-hermes-contracts.md` §3.3) already defines typed `MedicationOrderProposal` with `medication.name`, `rxnorm_code`, `change`, `clinician_protocol_ref`
- **Hermes v2.1** (`06-hermes-clinical-supervision-contract.md`) adds `atc_class`, `structured_dose`, `ClinicalSnapshotPayload`, vocabulary tables
- **Hermes JSON schema** (`hermes-message.schema.json`) now types proposals and snapshot_payload
- **Deutsch CVD cartridge spec** (`03-deutsch-cvd-cartridge-spec.md` §5.2, §9) already requires `MEDICATION_ORDER_PROPOSAL` with protocol refs
- **Deutsch projection spec** (`11-deutsch-to-popper-clinical-projection-spec.md`) defines the full migration

### What runtime code must change

| # | Task | Repos Affected | Effort |
|---|---|---|---|
| 0.1 | Add `medication_context` to `ArgMedProposedIntervention` type in `@deutsch/core` | Deutsch | Small |
| 0.2 | Update CVD cartridge to populate `medication_context` for `treatment_rec` claims involving medication actions (ATC class lookup, structured dose) | Deutsch | Medium |
| 0.3 | Update `convertToHermesProposals()` in `supervision.ts`: `treatment_rec` + `medication_context` → `MEDICATION_ORDER_PROPOSAL`; `diagnosis`/`prognosis` → `TRIAGE_ROUTE` (not `PATIENT_MESSAGE`) | Deutsch | Medium |
| 0.4 | Update `request-builder.ts` to populate `snapshot_payload` with `active_medications`, `recent_labs`, `active_conditions`, `medication_allergies`, `recent_vitals` from health state. Use `null` (not `[]`) for unavailable fields to distinguish "data missing" from "confirmed empty" | Deutsch | Medium-Large |
| 0.5 | Update `convertToHermesProposals()` to map `evidence_refs` with correct `evidence_type` values (`guideline`, `policy`, `patient_data`) instead of hardcoding all to `guideline` | Deutsch | Small |
| 0.6 | Update `convertToHermesProposals()` to populate `change.from_dose`/`change.to_dose` string fields from `medication_context` structured dose (e.g., `"10 mg daily"`) | Deutsch | Small |
| 0.7 | Migrate Popper hallucination pipeline from duck-typed `hallucination_detection` to `request.output_validation` (see Hermes `06` §5.5). Existing `hallucination_detected` condition kind reads from the new field. | Popper | Small |
| 0.8 | Add new Popper condition kinds: `medication_class_in`, `medication_name_in`, `snapshot_lab_below`, `snapshot_lab_above`, `snapshot_lab_missing`, `snapshot_condition_present`, `snapshot_field_missing`, `combination_present`, `allergy_match`, `dose_exceeds_max` | Popper | Medium |
| 0.9 | Update Popper evaluator to extract clinical fields from typed proposals and snapshot_payload | Popper | Medium |
| 0.10 | Integration tests covering full contract chain | Both | Medium |

### Acceptance Criteria
- Deutsch sends `MEDICATION_ORDER_PROPOSAL` (not `OTHER`) for medication-related `treatment_rec` claims
- Deutsch sends `TRIAGE_ROUTE` (not `PATIENT_MESSAGE`) for `diagnosis` and `prognosis` claims
- Deutsch populates `snapshot_payload` with at minimum: active medications, eGFR, potassium, BP, medication allergies
- Deutsch uses `null` for unavailable snapshot fields, `[]` for confirmed-empty
- Deutsch maps `evidence_type` correctly (`guideline`, `policy`, `patient_data`) — not all hardcoded to `guideline`
- Popper's evaluator can match on `medication_class_in`, `snapshot_lab_below`, `allergy_match`, `snapshot_field_missing`, and `dose_exceeds_max` in test rules
- Backward compatible: `OTHER` proposals from pre-migration traffic still pass through structural rules
- Integration test: Deutsch sends `MEDICATION_ORDER_PROPOSAL` with `atc_class` + `snapshot_payload` with labs → Popper matches correctly and produces expected decision

### Why this must come first
Every new condition kind in domain packs depends on typed upstream data. The specs define the contract; Phase 0 makes the runtime match. This is the critical path to Phase 3 (first domain pack).

---

## Phase 1: Provenance Foundation (Days 15-45, overlaps Phase 0)

### Goal
Add the provenance data model to the policy engine so rules can carry structured source citations. No new clinical rules yet — this is infrastructure.

### Deliverables

| # | Task | Files Affected | Effort |
|---|---|---|---|
| 1.1 | Add `RuleProvenance` type to policy-engine types | `packages/core/src/policy-engine/types.ts` | Small |
| 1.2 | Extend `PolicyRule` with optional `provenance` field | `packages/core/src/policy-engine/types.ts` | Small |
| 1.3 | Extend `PolicyPackMetadata` with `pack_type`, `depends_on` | `packages/core/src/policy-engine/types.ts` | Small |
| 1.4 | Update parser to validate new provenance fields | `packages/core/src/policy-engine/parser.ts` | Medium |
| 1.5 | Update evaluator to include provenance in evaluation trace | `packages/core/src/policy-engine/evaluator.ts` | Small |
| 1.6 | Add provenance fields to audit event tags | `packages/core/src/audit/emitter.ts` | Small |
| 1.7 | Add provenance to existing default.yaml rules (internal_policy citations) | `config/policies/default.yaml` | Medium |
| 1.8 | Write tests for provenance validation | New test files | Medium |
| 1.9 | Create source registry schema and initial data file | `config/sources/registry.yaml` (new) | Medium |

### Acceptance Criteria
- Every rule in the default pack has a `provenance` block with `source_type: internal_policy`
- Parser rejects domain/site pack rules without provenance
- Audit events for supervision decisions include `rule_id`, `source_type`, and `citation` in tags
- Source registry file exists and lists the Safety DSL spec as the first source

---

## Phase 2: Multi-Pack Architecture (Days 30-75)

### Goal
Extend existing multi-directory loading into full multi-pack composition with merge semantics, conflict detection, and version tracking. The loader already loads from `config/policies/` and `config/policies/reconfigure/`; the policy lifecycle plugin already supports draft/review/approve/activate/archive/rollback. This phase builds on those foundations.

### Deliverables

| # | Task | Files Affected | Effort |
|---|---|---|---|
| 2.1 | Extend loader to support named pack directories with `pack_type` and `depends_on` validation | `packages/core/src/policy-engine/loader.ts` | Medium |
| 2.2 | Implement merge logic (combine rules from multiple packs, sort by priority, validate priority-range constraints per pack type) | `packages/core/src/policy-engine/loader.ts` | Medium |
| 2.3 | Add conflict detection (site cannot weaken core/domain) | `packages/core/src/policy-engine/loader.ts` | Medium |
| 2.4 | Add `depends_on` validation (version constraints) | `packages/core/src/policy-engine/loader.ts` | Small |
| 2.5 | Refactor default.yaml into core safety pack | `config/policies/core/safety.yaml` (new) | Medium |
| 2.6 | Move evidence/acuity rules to domain general pack | `config/policies/domains/cardiometabolic-general.yaml` (new) | Medium |
| 2.7 | Update supervision plugin to load packs based on request context | `apps/server/src/plugins/supervision.ts` | Medium |
| 2.8 | Add composite version string to `ruleset_version` | Multiple | Small |
| 2.9 | Write integration tests for multi-pack loading | New test files | Medium |

### Acceptance Criteria
- Two packs (core + domain) load and merge correctly
- Priority ordering is maintained across packs
- Conflict detection rejects a site pack that weakens a core rule
- `ruleset_version` in responses includes versions of all loaded packs

---

## Phase 3: First Domain Pack — Heart Failure (Days 30-90)

### Goal
Build the first clinically grounded domain pack with rules derived from medication labels and the 2022 AHA/ACC/HFSA HF Guideline. Requires clinical governance involvement.

### Deliverables

| # | Task | Owner | Effort |
|---|---|---|---|
| 3.1 | Author HF contraindication rules using Phase 0 condition kinds (`medication_class_in`, `allergy_match`, `snapshot_lab_below`, `combination_present`) for ACEi, ARB, ARNI, BB, MRA, SGLT2i from DailyMed labels | Clinical pharmacist + Engineering | Large |
| 3.3 | Build guideline-derived rules from 2022 HF Guideline §7 (HFrEF GDMT) | Domain cardiologist + Engineering | Large |
| 3.4 | Build guideline-derived rules from 2024 ACC ECDP (titration logic) | Domain cardiologist + Engineering | Medium |
| 3.5 | Populate source registry with HF guideline and medication label entries | Engineering | Small |
| 3.6 | Clinical governance board reviews and approves domain pack | Governance board | N/A (process) |
| 3.7 | Staging validation with test scenarios | Engineering + Domain physician | Medium |
| 3.8 | Activate HF domain pack in production | Engineering | Small |

### Prerequisites
- **Phase 0 complete (clinical data contract)** — without typed medication proposals and lab data in snapshots, clinical condition kinds cannot be implemented
- Phase 1 complete (provenance model)
- Phase 2 complete (multi-pack loading)
- Clinical governance board established (at least interim; see `09-clinical-governance-review-workflow.md`, bootstrapping procedure)
- Domain cardiologist available for rule review

### Acceptance Criteria
- HF domain pack contains >=15 clinically grounded rules
- Every rule has structured provenance with specific guideline/label citation
- Pack passes all automated validation checks
- Clinical governance board has signed off on all enforcement levels
- Test scenarios demonstrate correct HARD_STOP, ROUTE_TO_CLINICIAN, and APPROVED behavior

---

## Phase 4: Additional Domain Packs + Source Registry (Days 60-180)

### Goal
Extend clinical grounding to hypertension, lipids, diabetes CV, and CKD domains. Build source registry tooling.

### Deliverables

| # | Task | Timeline | Effort |
|---|---|---|---|
| 4.1 | Build `cardiometabolic-htn` domain pack (2025 AHA/ACC HTN Guideline) | Days 60-90 | Large |
| 4.2 | Build `cardiometabolic-lipids` domain pack (2026 ACC/AHA Dyslipidemia Guideline) | Days 75-105 | Large |
| 4.3 | Build `cardiometabolic-diabetes-cv` domain pack (ADA 2026 §9-10) | Days 90-120 | Large |
| 4.4 | Build `cardiometabolic-ckd` domain pack (KDIGO 2024) | Days 105-150 | Large |
| 4.5 | Build source registry API (query sources, impact analysis, review tracking) | Days 90-120 | Medium |
| 4.6 | Build governance dashboard extension (review status, override analytics) | Days 120-150 | Medium |
| 4.7 | Build AF domain pack if anticoagulation is in Deutsch scope | Days 150-180 | Large |

### Acceptance Criteria
- >=4 domain packs active with total >=60 clinically grounded rules
- Source registry contains all referenced guidelines and medication labels
- Source registry API supports impact analysis queries
- Clinical governance board has approved all packs

---

## Phase 5: Site Protocol Packs (Days 120-210)

### Goal
Build site protocol pack support and create the first site pack.

### Deliverables

| # | Task | Timeline | Effort |
|---|---|---|---|
| 5.1 | Add formulary condition kind (`medication_not_in_formulary`) | Days 120-135 | Medium |
| 5.2 | Build formulary data model and loader | Days 120-135 | Medium |
| 5.3 | Build site pack template and documentation | Days 135-150 | Small |
| 5.4 | Create first site pack (Regain Health pilot site) | Days 150-180 | Medium |
| 5.5 | Build site pack validation (cannot weaken core/domain) | Days 135-150 | Medium |
| 5.6 | Clinical governance review of first site pack | Days 180-195 | N/A (process) |
| 5.7 | Activate first site pack in production | Days 195-210 | Small |

### Acceptance Criteria
- Site pack template exists with documentation
- First site pack is active with formulary and escalation rules
- Validation confirms site pack does not weaken any core or domain rule
- Site medical director has approved the pack

---

## Phase 6: Governance Workflow Tooling (Days 150-270)

### Goal
Build the tooling that supports the clinical governance review workflow, so it is not a purely manual process.

### Deliverables

| # | Task | Timeline | Effort |
|---|---|---|---|
| 6.1 | Build review tracking system (which rules are due for review) | Days 150-180 | Medium |
| 6.2 | Build guideline update notification system | Days 165-195 | Medium |
| 6.3 | Build override analysis dashboard (override rates by rule, rationale distribution) | Days 180-210 | Medium |
| 6.4 | Build rule change log (chronological record of all changes) | Days 195-225 | Small |
| 6.5 | Build pack approval workflow (governance sign-off tracking) | Days 210-240 | Medium |
| 6.6 | Build pre-deployment validation protocol for new sites | Days 225-255 | Medium |
| 6.7 | Build compliance export for governance documentation | Days 240-270 | Medium |

---

## Later Phases (9+ months)

| Phase | Goal | Trigger |
|---|---|---|
| **Imaging modality packs** | Echo, cardiac CT, nuclear/PET supervision | When Deutsch processes imaging data |
| **Bias monitoring architecture** | Demographic-stratified analysis without breaking PHI-blind design | When facility-level join infrastructure exists |
| **Adverse event flagging** | Structured incident detection and reporting workflow | When post-market reporting requirements are defined |
| **Multi-vendor supervision** | Supervise AI systems beyond Deutsch | When third-party Brain integrations are planned |
| **Hermes schema additions** | `rule_citations` in SupervisionResponse, structured `rule_provenance` in AuditEvent | When governance maturity justifies Hermes version bump |
| **PCCP document** | Formal Predetermined Change Control Plan for FDA | When regulatory submission timeline is defined |

---

## Dependencies and Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Deutsch does not provide structured medication/lab data in proposals** | **CRITICAL — top blocker** | Phase 0 is entirely about this. Without typed proposals and snapshot payloads, all clinical condition kinds are unimplementable. This is a cross-repo effort requiring Hermes schema changes, Deutsch adapter changes, and vocabulary standardization. |
| **No clinical governance board established** | High | Cannot activate clinical rules without clinical sign-off. Establish at least an interim board with one physician and one pharmacist before Phase 3. See bootstrapping procedure in `09`. |
| **No canonical clinical vocabulary** | High | Must decide on RxNorm, LOINC, SNOMED before implementing medication/lab/condition matching. Wrong coding early will require painful re-encoding later. Phase 0 addresses this. |
| **Domain physician availability** | High | Each domain pack requires sustained physician engagement for rule review. Plan for 10-15 hours of physician time per domain pack. |
| **Activation bundle integrity** | Medium | Deployed pack sets need immutable manifests (hash/signature per pack version + source registry version) for audit reconstruction and safe rollback. Not yet designed. |
| **Pack-version sprawl** | Medium | With 6 domain packs, 3 site packs, and a core pack, coordinating version updates becomes non-trivial. Need clear dependency constraints and automated compatibility checks. |
| **Guideline updates during development** | Medium | The 2025 HTN and 2026 Dyslipidemia guidelines are very recent. Monitor for focused updates or errata. Source registry tracking helps manage this. |
| **Test scenario coverage** | Medium | Clinical rules need clinically realistic test scenarios, not engineering edge cases. Need a formal scenario bank design with acceptable false-positive thresholds. Work with domain physicians. |
| **Emergency governance without board** | Medium | FDA recalls or safety communications may arrive before the governance board exists. Emergency procedure defined in `09`, but needs real-world testing. |

---

## Summary Timeline

```
Month 1          Month 2          Month 3          Month 4          Month 5-7        Month 8-10
├─ Phase 0 ─────────────────────┤
│ Clinical data contract        │
│ (Hermes + Deutsch + vocab)    │
        ├─ Phase 1 ─────┤
        │ Provenance     ├─ Phase 2 ─────┤
        │ foundation     │ Multi-pack     ├─ Phase 3 ──────┤
                         │ architecture   │ HF domain pack ├─ Phase 4 ──────────────┤
                                                           │ HTN, lipids, DM, CKD  │
                                                           ├─ Phase 5 ─────────────┤
                                                           │ Site protocol packs    │
                                                           ├─ Phase 6 ─────────────────────┤
                                                           │ Governance tooling             │
```

**Key milestones:**
- **Day 45:** Clinical data contract shipped — Deutsch sends typed medication proposals with lab data
- **Day 45:** Provenance model in production, all existing rules annotated
- **Day 75:** Multi-pack architecture in production, core/domain split complete
- **Day 120:** First clinically grounded domain pack (HF) active with governance sign-off
- **Day 210:** Four domain packs active, source registry operational
- **Day 240:** First site protocol pack active
- **Day 300:** Governance workflow tooling operational
