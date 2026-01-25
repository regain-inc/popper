---
version: 1.0.0
last-updated: 2026-01-23
status: draft
owner: Deutsch Dev Team
tags: [advocate, ta1, deutsch, cvd, cartridge]
---

# Deutsch CVD Cartridge Spec (HF + Post‑MI) — v1

## 0) Purpose

This document specifies the **Deutsch CVD cartridge**: the disease-specific “plug-in” that makes the Deutsch Engine capable of ADVOCATE’s initial intended use.

The cartridge provides:
- CVD ontology (HF + post‑MI + key comorbidities)
- guideline mappings (as `EvidenceRef`s, not embedded PDFs)
- guardrails (hard/soft constraints)
- scenario test cases (synthetic + expected safe outcomes)

This cartridge MUST be **swappable**: no engine changes required to replace CVD with another disease pack later.

## 1) Scope

### In scope (v1)
- **Primary intended use** (ADVOCATE): outpatient management support for:
  - heart failure (HF)
  - post‑myocardial infarction (post‑MI)
- **Medication-relevant CVD conditions explicitly called out by TA1**:
  - hypertension
  - hyperlipidemia
  - atrial fibrillation (AFib)
- **Intervention types**:
  - care navigation (appointments, reminders)
  - triage routing (routine/soon/urgent; route targets)
  - clinician-governed medication order proposals (ADVOCATE clinical mode only)
  - patient messaging (patient-safe summaries + next steps)

### Out of scope (v1)
- Implementing Popper policies (Popper is TA2)
- Implementing EHR vendor-specific integrations
- Embedding full guideline text (use `EvidenceRef` pointers)
- Executing prescriptions directly (Deutsch proposes; host system executes only after Popper decision + clinical governance)

## 2) Cartridge interface contract

The cartridge MUST implement the `ClinicalCartridge` interface defined in:
- `02-deutsch-contracts-and-interfaces.md`

The cartridge outputs **Hermes** `ProposedIntervention[]` (see `../03-hermes-specs/02-hermes-contracts.md`).

## 3) Required ontology (minimum vocabulary)

The cartridge MUST define a stable internal vocabulary for:
- **Conditions**: HF (with phenotype tags where available), post‑MI, HTN, hyperlipidemia, AFib
- **Symptoms/red flags** (represented as structured tags, not free text only): chest pain, dyspnea, syncope, edema, palpitations, weight gain trend, confusion
- **Vitals/labs** (as snapshot-derived signals): BP, HR, weight, potassium, creatinine/eGFR, BNP/NT‑proBNP (when available)
- **Medications** (as identifiers and categories): ACEi/ARB/ARNI, beta‑blockers, diuretics, statins, anticoagulants, etc. (exact list is implementation-specific but MUST be versioned)

## 4) Guardrails (hard vs soft)

Cartridge guardrails are **constraints** and **test vectors**. They are not patient-facing advice.

### 4.1 Hard guardrails (MUST)

Hard guardrails are conditions that MUST force conservative behavior:
- generate `TRIAGE_ROUTE` with urgency `urgent`, and/or
- force supervision for any treatment-changing proposal, and/or
- downgrade to “route to clinician” posture if required evidence is missing.

Minimum required hard guardrail categories:
- **Missing governance**: any medication proposal without a `clinician_protocol_ref`
- **High uncertainty**: any high-impact recommendation where `disclosure.uncertainty.level = "high"`
- **Data insufficiency**: missing critical inputs for the contemplated action (e.g., medication change without required labs per protocol)
- **Potential acute risk**: red-flag symptom patterns that require urgent routing

### 4.2 Soft guardrails (SHOULD)

Soft guardrails are cautionary constraints:
- prefer clarifying questions
- prefer routing to clinician for ambiguous cases
- prefer non-device, low-risk actions in wellness mode

### 4.3 PRO-Triggered Guardrails (FDA MDDT-Aligned)

The following guardrails use FDA-qualified PRO instruments for safety signals.

#### Heart Failure Core PRO Guardrails

| Condition | Guardrail Type | Action |
|-----------|---------------|--------|
| KCCQ score drops >5 points in 30 days | SOFT | Flag for clinician review + medication adherence check |
| KCCQ total <50 (severe symptoms) | SOFT | Route to clinician for intensification review |
| MLHFQ >80 (severe QoL impact) | SOFT | Route to behavioral health + social work referral |

#### Digital Health Biomarker Guardrails

| Condition | Guardrail Type | Action |
|-----------|---------------|--------|
| New AFib detection + no recent anticoag assessment | HARD | ROUTE_TO_CLINICIAN for stroke risk (CHA₂DS₂-VASc) evaluation |
| AFib burden >10% weekly + symptoms | SOFT | Flag for rate/rhythm control review |

#### Comorbidity PRO Guardrails

| Condition | Guardrail Type | Action |
|-----------|---------------|--------|
| INSPIRE psychosocial score drops >10 points | SOFT | Flag for diabetes educator + AID system check |
| WOUND-Q wound_bother increases OR healing_progress decreases | SOFT | Route to wound care specialist + vascular assessment |

#### Cardiac Implant Safety Guardrails

| Condition | Guardrail Type | Action |
|-----------|---------------|--------|
| Patient has cardiac implant AND imaging order includes MRI | HARD | ROUTE_TO_CLINICIAN - verify MRI conditional status |
| Implant + >6 months since last interrogation | SOFT | Flag for device clinic follow-up |

**Note:** MRI conditional status determination SHOULD use IMAnalytics/Virtual MRI Safety MDDT methodology when available.

**Reference:** [`../00-overall-specs/0B-FDA-alignment/13-qualified-mddt-solutions.md`](../00-overall-specs/0B-FDA-alignment/13-qualified-mddt-solutions.md) §4-8

## 5) Intervention generation rules (by mode)

### 5.1 `wellness` mode (non-clinical)

The cartridge MUST NOT emit `MEDICATION_ORDER_PROPOSAL` in `wellness` mode.

Allowed outputs:
- `PATIENT_MESSAGE` with patient-safe education and “discuss with clinician” phrasing
- `CARE_NAVIGATION` for logistics (reminders, scheduling assistance)
- `TRIAGE_ROUTE` for risk/uncertainty (routing to clinicians; urgent routing when required)
- `OTHER` only if it is clearly non-treatment-changing and PHI-minimized in `audit_redaction`

### 5.2 `advocate_clinical` mode (clinician-governed)

The cartridge MAY emit `MEDICATION_ORDER_PROPOSAL` only if:
- `clinician_protocol_ref` is present and valid for the site/org
- required snapshot inputs for the protocol are present (or the proposal is explicitly “request missing input” + route)
- the proposal includes:
  - `EvidenceRef[]` that cite the governing protocol/guideline
  - a `DisclosureBundle` with uncertainty explicitly stated

All medication proposals MUST be treated as high-risk and therefore supervised by Popper.

## 6) Evidence requirements (`EvidenceRef`)

For any high-risk proposal (triage urgent, medication proposal, or any “treatment-like” instruction), the cartridge MUST include:
- at least 1 `EvidenceRef` to the governing guideline/protocol (`evidence_type = "guideline"` or `"policy"`) when such a protocol/guideline exists for the proposal
- at least 1 `EvidenceRef` to patient-data provenance (`evidence_type = "patient_data"`) in PHI-minimized form (e.g., “red-flag symptoms present in snapshot”; do not embed raw values in audit fields)

For `TRIAGE_ROUTE` with `urgency = "urgent"`, the cartridge MUST include an `EvidenceRef` of type `patient_data` at minimum, so audits can reconstruct why urgent routing occurred.

High-risk medication proposals in `advocate_clinical` mode MUST include:
- at least 1 `EvidenceRef` to the **site protocol** referenced by `clinician_protocol_ref` (`evidence_type = "policy"`)
- at least 1 `EvidenceRef` to the **guideline source** the protocol is based on (`evidence_type = "guideline"`)

If these evidence refs cannot be provided, the cartridge MUST NOT emit a `MEDICATION_ORDER_PROPOSAL` and MUST instead emit a conservative routing posture (triage route / request more info).

## 7) Scenario test library (required)

The cartridge MUST ship a scenario library suitable for:
- safety regression testing
- IV&V-style evaluation harnesses

Minimum scenario categories:
- HF decompensation-like symptom cluster (requires routing/escalation path)
- post‑MI symptom check-in (uncertainty handling + evidence pointers)
- medication proposal under protocol (requires Popper supervision)
- missing labs / stale snapshot (forces clarification + safe posture)
- conflicting data sources (wearable vs EHR) → explicit uncertainty + safe routing

Each scenario MUST specify:
- snapshot stub (or snapshot ref fixture metadata)
- user message (text + optional attachments)
- expected **proposal kinds** emitted (not exact wording)
- whether Popper supervision is required
- minimum required `audit_redaction.summary` content (PHI-minimized)

## 8) Versioning & change control (regulatory posture)

The cartridge MUST be versioned with semver and MUST support traceability:
- every release MUST record what clinical knowledge changed (guideline/protocol version bumps)
- every proposal MUST include `trace.producer.ruleset_version` so Popper and auditors can identify the exact cartridge version used

In regulated deployments, cartridge updates MUST be:
- reviewable (diffable knowledge changes)
- reversible (rollback plan)
- auditable (who approved, when, and why)

## 9) Clinician protocol registry (`clinician_protocol_ref`) — required

In `advocate_clinical` mode, any `MEDICATION_ORDER_PROPOSAL` MUST include a `clinician_protocol_ref` pointing to a **TA3-site-approved protocol**.

### 9.1 URI format (normative)

`clinician_protocol_ref` MUST follow this format:

- `protocol://{organization_id}/cvd/{protocol_slug}/v{semver}`

Examples:
- `protocol://org_ta3_alpha/cvd/hf-guideline-directed-med-optimization/v1.0.0`
- `protocol://org_ta3_alpha/cvd/post-mi-secondary-prevention/v1.0.0`

### 9.2 Registry semantics (normative)

The “protocol registry” is a **bounded allowlist** of protocol refs that Deutsch is permitted to cite for medication proposals.

Rules:
- In `advocate_clinical` mode, `subject.organization_id` MUST be present (protocols are site-specific).
- Deutsch MUST NOT invent protocol refs. It may only select from the registry for that `organization_id`.
- If the registry does not contain a protocol required for the situation, Deutsch MUST:
  - route to clinician (triage) and/or request more info, and
  - emit no medication proposal.

Popper requirements (enforced in TA2 policy):
- If `clinician_protocol_ref` is missing or not in the allowlist for that `organization_id` → `ROUTE_TO_CLINICIAN`.

### 9.3 Minimum registry fields (v1)

Each protocol registry entry MUST define:
- `clinician_protocol_ref` (the canonical ID)
- `title`
- `status` (`active` | `retired`)
- `allowed_change_types` (`start` | `stop` | `titrate` | `hold`)
- `required_snapshot_signals` (names of required snapshot inputs; no raw PHI)
- `guideline_sources` (`evidence_id`s from §10)
- `ehr_mapping` (optional; e.g., `FHIR_R4:MedicationRequest`)

### 9.4 Example protocol registry (v1 starter)

> This is a **starter registry** for implementation scaffolding. TA3 sites MUST replace/extend with their own approved protocols and governance review cycles.

| organization_id | clinician_protocol_ref | title | status | allowed_change_types | required_snapshot_signals (examples) | guideline_sources | ehr_mapping |
|---|---|---|---|---|---|---|---|
| `org_ta3_alpha` | `protocol://org_ta3_alpha/cvd/hf-guideline-directed-med-optimization/v1.0.0` | HF GDMT optimization protocol | active | start/stop/titrate/hold | meds_list, bp_trend, weight_trend, creatinine, potassium | `guideline.aha-acc-hfsa.hf.2022` | FHIR_R4:MedicationRequest |
| `org_ta3_alpha` | `protocol://org_ta3_alpha/cvd/post-mi-secondary-prevention/v1.0.0` | Post‑MI secondary prevention protocol | active | start/stop/titrate | meds_list, bp_trend, lipid_panel, allergies | `guideline.aha-acc.chronic-coronary-disease.2023`, `guideline.aha-acc.cholesterol.2018` | FHIR_R4:MedicationRequest |
| `org_ta3_alpha` | `protocol://org_ta3_alpha/cvd/htn-med-adjustment/v1.0.0` | Hypertension medication adjustment | active | start/stop/titrate/hold | bp_trend, meds_list, creatinine, potassium | `guideline.acc-aha.hypertension.2017` | FHIR_R4:MedicationRequest |
| `org_ta3_alpha` | `protocol://org_ta3_alpha/cvd/hyperlipidemia-nonstatin-add-on/v1.0.0` | Hyperlipidemia non‑statin add‑on protocol | active | start/stop | lipid_panel, meds_list, liver_enzymes | `guideline.acc.nonstatin.2022`, `guideline.aha-acc.cholesterol.2018` | FHIR_R4:MedicationRequest |
| `org_ta3_alpha` | `protocol://org_ta3_alpha/cvd/afib-anticoagulation/v1.0.0` | AFib anticoagulation protocol | active | start/stop | afib_status, renal_function, bleeding_risk_signals | `guideline.acc-aha-afib.2023` | FHIR_R4:MedicationRequest |

## 10) Guideline source registry (for `EvidenceRef`) — required

Deutsch MUST reference guideline sources using stable `EvidenceRef` entries. To keep citations consistent across teams, the cartridge maintains a small **guideline source registry**.

Guideline registry rules:
- `evidence_id` MUST be stable and versioned (year included when possible).
- `EvidenceRef.citation` MUST be a human-readable citation string suitable for clinician review.
- `EvidenceRef.uri` SHOULD be an internal pointer into the Evidence Engine (the full text may be licensed; do not embed).

### 10.1 CVD guideline registry (v1)

| evidence_id | evidence_type | citation (recommended string) | uri (example) |
|---|---|---|---|
| `guideline.aha-acc-hfsa.hf.2022` | guideline | 2022 AHA/ACC/HFSA Guideline for the Management of Heart Failure | `evidence://guidelines/aha-acc-hfsa-hf-2022` |
| `guideline.acc-aha.hypertension.2017` | guideline | 2017 ACC/AHA Guideline for the Prevention, Detection, Evaluation, and Management of High Blood Pressure in Adults | `evidence://guidelines/acc-aha-htn-2017` |
| `guideline.aha-acc.cholesterol.2018` | guideline | 2018 AHA/ACC Guideline on the Management of Blood Cholesterol | `evidence://guidelines/aha-acc-cholesterol-2018` |
| `guideline.acc.nonstatin.2022` | guideline | 2022 ACC Expert Consensus Decision Pathway on Nonstatin Therapies for LDL‑C Lowering | `evidence://guidelines/acc-nonstatin-2022` |
| `guideline.acc-aha-afib.2023` | guideline | 2023 ACC/AHA/ACCP/HRS Guideline for the Diagnosis and Management of Atrial Fibrillation | `evidence://guidelines/acc-aha-afib-2023` |
| `guideline.aha-acc.chronic-coronary-disease.2023` | guideline | 2023 AHA/ACC Guideline for the Management of Patients With Chronic Coronary Disease | `evidence://guidelines/aha-acc-ccd-2023` |

### 10.2 Protocol evidence refs (policy)

When `clinician_protocol_ref` is used, Deutsch SHOULD also include an `EvidenceRef` of type `policy` pointing to the protocol record in the TA3 governance system:

- `evidence_type`: `policy`
- `citation`: “TA3 protocol {title} ({clinician_protocol_ref})”
- `uri`: a PHI-safe internal pointer to the protocol artifact (not the patient record)

