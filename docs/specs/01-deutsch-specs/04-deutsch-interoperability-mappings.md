---
version: 1.0.0
last-updated: 2026-01-23
status: draft
owner: Deutsch Dev Team
tags: [advocate, ta1, deutsch, interoperability, fhir, hl7v2, tefca, uscdi]
---

# Deutsch Interoperability Mappings (CVD v1) — minimum required

## Purpose

TA1 requires the CVD Agent to be **EHR-agnostic** and natively support **FHIR**, **HL7 v2**, and alignment with **TEFCA/USCDI**.

Deutsch does **not** perform vendor integrations directly. Deutsch consumes a `HealthStateSnapshotRef` (Hermes) created by an integration layer.

This spec defines the **minimum interoperability mapping surface** needed to build snapshots suitable for the ADVOCATE CVD cartridge (HF + post‑MI) and to satisfy TA1 interoperability requirements.

## Canonical mapping source

The canonical, implementation-grade mapping guide is:

- `docs/01-product/technical-specs/29-ehr-interoperability.md`

This file is a **minimal subset** for TA1 teams and contract discussions with TA3 sites.

## Minimum required snapshot signals (CVD v1)

Snapshot builder MUST materialize (or explicitly mark missing) these signals:

- **Demographics**: age range, sex
- **Problems/conditions**: HF, post‑MI, HTN, hyperlipidemia, AFib (as coded conditions)
- **Medications**: active med list relevant to CVD (including orders + adherence signals when available)
- **Vitals trends**: BP, HR, weight
- **Labs**: potassium, creatinine/eGFR, lipid panel; BNP/NT‑proBNP when available
- **Symptoms/red flags**: chest pain, dyspnea, syncope, edema, palpitations, weight-gain trend (patient reported and/or clinically documented)

The CVD cartridge’s protocol registry defines `required_snapshot_signals` per `clinician_protocol_ref`:

- `03-deutsch-cvd-cartridge-spec.md` → “9) Clinician protocol registry”

### Canonical signal keys (required for `snapshot.quality`)

Hermes `HealthStateSnapshotRef` supports PHI-minimized quality flags (`snapshot.quality.missing_signals` / `snapshot.quality.conflicting_signals`).

To keep implementations consistent:
- Snapshot builder MUST use **the exact signal identifiers** referenced by the active TA3 protocol registry’s `required_snapshot_signals`.
- For the CVD v1 starter registry, examples include:
  - `meds_list`, `bp_trend`, `hr_trend`, `weight_trend`
  - `potassium`, `creatinine`, `egfr`, `lipid_panel`, `allergies`

## FHIR R4 minimum resources (v1)

Snapshot builder MUST support ingesting at least:

| FHIR Resource | Example uses for snapshot | Notes |
|---|---|---|
| `Patient` | demographics | use de-identified representation in snapshot where possible |
| `Condition` | HF/post‑MI/comorbidities | prefer coded concepts; record onset/abatement when available |
| `MedicationRequest` | active medication orders | include status + dosage instructions |
| `MedicationStatement` (optional) | adherence/“taking” signals | include only if available |
| `Observation` | vitals + labs | MUST support BP/weight/K/Cr/eGFR/lipids; include effective times |
| `AllergyIntolerance` (recommended) | medication safety context | required for many med protocols |

## HL7 v2 minimum message types (v1)

Snapshot builder MUST support ingesting at least:

| HL7v2 Message | Typical contents | Snapshot signals |
|---|---|---|
| `ADT^A08` (or similar ADT updates) | patient demographics updates | demographics |
| `ORU^R01` | lab results | labs + some vitals |
| `RDE^O11` / `RXE` segments (when available) | medication orders | medications |

## TEFCA / USCDI alignment (minimum)

Snapshot builder SHOULD map USCDI data classes to snapshot signals and emit explicit “missing” markers when a TA3 connector cannot supply a required class.

Minimum USCDI classes for ADVOCATE CVD v1:

| USCDI data class | Snapshot signals |
|---|---|
| Demographics | demographics |
| Problems | conditions |
| Medications | meds_list |
| Vital Signs | bp_trend, weight_trend, hr_trend |
| Laboratory | potassium, creatinine/eGFR, lipid panel (+ BNP when available) |
| Allergies/Intolerances (recommended) | allergies |

## Failure handling (required safety posture)

Interop failures are a **safety signal**, not a silent degradation.

- If EHR/wearable ingestion fails for a required signal:
  - snapshot builder MUST mark the signal as missing (do not fabricate)
  - snapshot builder SHOULD populate `snapshot_ref.quality.missing_signals` with the canonical signal key(s)
  - Deutsch MUST treat missing required signals as increased uncertainty and SHOULD request more info or route to clinician
  - Popper MUST enforce conservative policy (route / request more info) when required signals are missing for a high‑risk proposal

## Conflicting sources (required)

Wearable, patient-reported, and EHR sources can conflict (e.g., weight trend vs a clinic scale, BP cuff vs in-clinic BP).

- Snapshot builder MUST preserve provenance (which source produced which value) and MUST NOT silently “pick a winner” when sources materially disagree.
- Snapshot builder SHOULD include a conflict marker for materially conflicting signals by populating `snapshot_ref.quality.conflicting_signals` (canonical signal keys), so Deutsch can:
  - explicitly disclose uncertainty
  - request clarification or new measurements
  - default to conservative routing for high-risk decisions

## Pointer semantics (Hermes)

- `HealthStateSnapshotRef.snapshot_uri` MUST NOT be a public URL.
- In `advocate_clinical`, `snapshot_uri` MUST be present and resolvable by Popper within the deployment trust boundary.
- If `snapshot_hash` is provided, it MUST be computed and verified per Hermes canonicalization guidance.
- `InteropPayloadRef` pointers (when used) MUST follow the same “internal pointer” rule and MUST define a timeout + fallback policy in the integration layer.

