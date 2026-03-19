# 03 — Imaging and Modality Extension Map

> **Version**: 0.1.0
> **Date**: 2026-03-19

---

## Current State

Popper does not currently supervise imaging or modality-specific decisions. The Hermes schema includes imaging-related types (`ImagingStudyRef`, `DerivedImagingFinding`, `ImagingModality`, `ImagingMeasurement`, `ImagingClassification`, `ImagingComparison`) that were designed for future use, but no policy rules reference imaging data today.

This document defines the architecture for extending Popper into modality-specific supervision when Deutsch or other Brains begin to reason about imaging findings.

---

## Why Modality Extension Matters

Healthcare AI increasingly processes imaging data — echocardiograms, cardiac CT, nuclear/PET studies, cardiac MRI, and catheterization findings. These modalities have their own professional societies, accreditation bodies (IAC, ACR), measurement standards, and clinical significance thresholds.

Popper's supervisory model — deterministic rules, source-linked provenance, fail-safe routing — applies to imaging just as it does to medication supervision. The key differences:

1. **Imaging supervision checks measurement quality, not treatment appropriateness.** Example: "Is this LVEF measurement derived from a study that meets ASE reporting standards?"
2. **Imaging has modality-specific accreditation.** IAC accredits echo, CT, nuclear/PET, MRI, and cath separately. Each has distinct quality requirements.
3. **Imaging findings feed into clinical decisions.** An LVEF <40% from an echo study drives HF medication therapy. Popper may need to validate the imaging provenance before trusting the finding.

---

## Modality Extension Architecture

### Policy Pack Model

Imaging supervision would use **modality-specific policy packs** that layer on top of the core safety pack:

```
┌─────────────────────────────────────┐
│  Core Safety Pack (universal)       │  ← Always loaded
├─────────────────────────────────────┤
│  Cardiometabolic Domain Pack        │  ← Loaded per domain config
├─────────────────────────────────────┤
│  Echo Modality Pack (optional)      │  ← Loaded when imaging data present
│  Cardiac CT Modality Pack (opt.)    │
│  Nuclear/PET Modality Pack (opt.)   │
│  Cath Modality Pack (opt.)          │
└─────────────────────────────────────┘
```

Modality packs are only loaded when the `SupervisionRequest` contains imaging data (via `snapshot.imaging_studies` or `snapshot.imaging_findings`). This keeps evaluation fast for non-imaging requests.

### Rule Categories for Imaging

| Category | What It Checks | Example |
|---|---|---|
| **Measurement validity** | Is the finding derived from a study that meets minimum quality criteria? | LVEF from an echo study with adequate image quality rating |
| **Finding provenance** | Is the extractor (radiologist, AI model, automated) identified and version-tracked? | AI-derived finding must include `model_id` and `model_version` |
| **Clinical significance thresholds** | Does the finding meet the threshold for clinical action? | LVEF <40% triggers HFrEF classification; AS peak velocity >4 m/s triggers severe aortic stenosis |
| **Comparison consistency** | When comparing to prior studies, is the comparison method valid? | Delta LVEF comparison requires same measurement method |
| **Accreditation alignment** | Does the study meet accreditation facility requirements? | IAC echo accreditation requires specific measurement protocols |

### Condition Kinds Needed (Policy Engine Extension)

The policy engine would need new condition kinds for imaging:

```typescript
// Proposed new condition kinds for imaging
| ImagingModalityCondition      // "imaging_modality_in": ["US", "CT"]
| ImagingFindingTypeCondition   // "finding_type_in": ["measurement", "classification"]
| ImagingConfidenceCondition    // "imaging_confidence_below": 0.8
| ImagingExtractorCondition     // "extractor_type_in": ["ai_model"]
| ClinicalSignificanceCondition // "clinical_significance_in": ["critical", "abnormal"]
```

These would be added to the `RuleCondition` union type in `packages/core/src/policy-engine/types.ts` when imaging supervision is implemented.

---

## Societies, Standards, and Accreditation Reference (Compact)

Each modality has a professional society, measurement standards, and at least one accreditation pathway:

| Modality | Professional Society | Key Standards | Accreditation |
|---|---|---|---|
| **Echo** | ASE/EACVI | ASE 2025 Reporting Standardization (*JASE* 2025;38:735-774); ASE 2025 Diastolic Function; ACC/AHA/ASE 2019 TTE Key Data Elements (DOI: 10.1161/HCI.0000000000000027) | IAC Echo (updated Aug 2024), ACR Ultrasound |
| **Cardiac CT** | SCCT | SCCT 2021 Expert Consensus on Coronary CTA; SCCT 2016 Performance Guidelines (PMID: 27780758) | IAC CT (updated Apr 2025), ACR CT (revised Apr 2025) |
| **Nuclear/PET** | ASNC/SNMMI | ASNC/SNMMI 2025 F-18 Flurpiridaz PET Guideline; ASNC/SNMMI 2016 PET Procedure Standard (PMID: 27392702) | IAC Nuclear/PET, ACR NM/PET (revised Apr 2025) |
| **Cardiac MRI** | SCMR | SCMR standardized CMR protocols | IAC MRI, ACR MRI (revised Apr 2025) |
| **Cath/Interventional** | SCAI | SCAI interventional cardiology standards | IAC Cardiovascular Catheterization |
| **EP** | HRS | HRS consensus documents; 2023 ACC/AHA/HRS AF Guideline (already in cardiometabolic Wave 3) | — |

Detailed source citations for each modality should be compiled when the corresponding modality pack is built, not before. The table above serves as a starting reference.

---

## Implementation Phasing (Summary)

**Current state:** Hermes schema supports imaging types. No policy rules, condition kinds, or modality packs exist. Schema hooks are in place.

**When imaging supervision is needed** (triggered by Deutsch processing imaging data):
1. Add imaging condition kinds to the policy engine
2. Build echo modality pack first (most common cardiovascular imaging modality)
3. Extend to CT, nuclear/PET, MRI as demand requires
4. Build cross-modality rules (e.g., LVEF from echo + medication proposal → guideline check)

This is not on the near-term roadmap. The immediate priority is medication supervision via the clinical data contract (Phase 0) and cardiometabolic domain packs.

---

## Key Design Decisions

1. **Modality packs are additive, not mandatory.** Popper must work correctly without any modality packs loaded. Imaging supervision is an extension, not a requirement.

2. **Imaging rules check provenance, not pixel data.** Popper does not analyze images. It checks whether imaging-derived findings (measurements, classifications) meet quality and provenance criteria.

3. **AI-derived findings require stricter provenance.** If a finding was extracted by an AI model rather than a radiologist, Popper should require `model_id`, `model_version`, and minimum confidence thresholds before trusting the finding in subsequent clinical rules.

4. **Accreditation alignment is per-modality.** IAC accredits echo separately from CT separately from nuclear/PET. Popper's modality packs should mirror this structure.

5. **Do not conflate modality accreditation with clinical guideline enforcement.** IAC accredits that a facility performs echo correctly. The AHA/ACC HF guideline says what LVEF thresholds drive therapy. These are different layers (Layer 4 vs. Layer 2) and must remain separate in the rule model.
