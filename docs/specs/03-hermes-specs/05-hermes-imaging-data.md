---
version: 1.2.1
last-updated: 2026-01-24
status: draft
owner: Hermes Dev Team
tags: [advocate, hermes, imaging, dicom, fhir, phi]
canonical-types: hermes-message.schema.json
---

# Hermes Imaging Data Types (v1)

## 0) Purpose

This document defines types for handling medical imaging data in the Hermes protocol. The core principle is **"Reference, Don't Transfer"**: raw imaging pixels (which can be 100-500 MB per study) MUST NEVER flow through the clinical agent pipeline. Only **derived findings** (measurements, classifications, abnormality flags) are included in the HealthStateSnapshot.

**Related Standards**:
- FHIR R4 `ImagingStudy` and `DiagnosticReport` resources
- DICOM Structured Reports (SR)
- IHE AI Results (AIR) Profile

---

## 1) Data Size Principles

### 1.1 Normative Constraints

```
NORMATIVE: HealthStateSnapshot MUST NOT exceed 1 MB uncompressed.
NORMATIVE: Raw imaging pixels MUST NEVER be included in snapshot.
NORMATIVE: Imaging data MUST be referenced via ImagingStudyRef, not embedded.
NORMATIVE: Only DerivedImagingFinding objects (KB-sized) may flow to Deutsch.
```

### 1.2 Data Size Reality

| Data Type | Typical Size | Included in Snapshot? |
|-----------|--------------|----------------------|
| Raw MRI pixels | 100-500 MB | **NEVER** |
| Raw CT pixels | 30-500 MB | **NEVER** |
| Raw X-ray pixels | 10-50 MB | **NEVER** |
| Raw Ultrasound | 50-200 MB | **NEVER** |
| DICOM SR (findings) | 10-100 KB | ✅ As DerivedImagingFinding |
| AI model output | 1-10 KB | ✅ As DerivedImagingFinding |
| Radiology report text | 1-5 KB | ✅ As EvidenceRef excerpt |

### 1.3 Rationale

Medical imaging represents the largest category of patient health data. A large hospital may accumulate ~50 petabytes/year of imaging data, with individual patients averaging ~80 MB/year. Transferring raw pixels to clinical agents would:

1. **Exceed bandwidth constraints** — Network transfer of GB-sized files is impractical for real-time clinical decisions
2. **Create security risk** — Raw DICOM files contain extensive PHI metadata
3. **Waste compute resources** — Deutsch (TA1) cannot interpret raw pixels; it needs derived findings
4. **Violate separation of concerns** — Imaging AI is a specialized pipeline, not part of clinical reasoning

---

## 2) ImagingStudyRef — Reference to Raw Imaging

### 2.1 Type Definition

```typescript
/**
 * Reference to an imaging study stored in the PHI service.
 * Contains metadata about the study but NEVER the raw pixels.
 *
 * Maps to FHIR R4 ImagingStudy resource.
 */
export interface ImagingStudyRef {
  /**
   * Unique identifier for the study.
   * Format: FHIR resource ID or DICOM StudyInstanceUID.
   * Example: "1.2.840.113619.2.55.3.604688119" (DICOM UID)
   */
  study_id: string;

  /**
   * Internal endpoint where raw pixels are stored.
   * MUST be an internal PHI service URI, never public.
   * Example: "phi://imaging/studies/abc123" or "https://phi.internal/dicom/..."
   */
  storage_endpoint: string;

  /**
   * Imaging modality.
   * Values aligned with DICOM Modality (0008,0060).
   */
  modality: ImagingModality;

  /**
   * When the imaging study was performed.
   * ISO 8601 date format.
   */
  study_date: string;

  /**
   * Number of series in the study.
   */
  series_count?: number;

  /**
   * Total number of instances (images) across all series.
   */
  instance_count?: number;

  /**
   * PHI-redacted description for audit purposes.
   * Example: "Cardiac MRI with contrast" (no patient identifiers)
   */
  description_redacted: string;

  /**
   * Body part examined (if applicable).
   * SNOMED CT code preferred.
   * Example: "80891009" (Heart structure)
   */
  body_part_examined?: string;

  /**
   * Hash of DICOM metadata (not pixels) for integrity verification.
   * Algorithm: SHA-256.
   */
  metadata_hash?: string;

  /**
   * When this reference was created/updated.
   */
  last_updated: string;
}
```

### 2.2 ImagingModality Enum

```typescript
/**
 * Imaging modality codes.
 * Most codes are aligned with DICOM Modality (0008,0060).
 */
export type ImagingModality =
  | 'MR'    // Magnetic Resonance (DICOM)
  | 'CT'    // Computed Tomography (DICOM)
  | 'XR'    // X-Ray - convenience alias (see note below)
  | 'US'    // Ultrasound (DICOM)
  | 'MG'    // Mammography (DICOM)
  | 'PT'    // Positron Emission Tomography (DICOM)
  | 'NM'    // Nuclear Medicine (DICOM)
  | 'ECG'   // Electrocardiogram (DICOM waveform)
  | 'DX'    // Digital Radiography (DICOM)
  | 'CR'    // Computed Radiography (DICOM)
  | 'OT';   // Other (DICOM)
```

**Note on XR**: `XR` is a **convenience alias** for general radiography, not a DICOM modality code. DICOM uses `DX` (Digital Radiography) and `CR` (Computed Radiography). When interfacing with DICOM systems:
- Map `XR` → `DX` for digital X-rays
- Map `XR` → `CR` for computed radiography systems
- For strict DICOM compliance, prefer `DX` or `CR` directly

### 2.3 FHIR Mapping

| ImagingStudyRef Field | FHIR ImagingStudy Path | Notes |
|----------------------|------------------------|-------|
| `study_id` | `ImagingStudy.identifier[0].value` or `ImagingStudy.id` | DICOM StudyInstanceUID |
| `storage_endpoint` | `ImagingStudy.endpoint[0]` → `Endpoint.address` | Note: FHIR uses Reference to Endpoint resource |
| `modality` | `ImagingStudy.modality[0].code` | |
| `study_date` | `ImagingStudy.started` | |
| `series_count` | `ImagingStudy.numberOfSeries` | |
| `instance_count` | `ImagingStudy.numberOfInstances` | |
| `body_part_examined` | `ImagingStudy.series[0].bodySite.code` | SNOMED CT code |

**Note on FHIR Endpoint mapping**: In FHIR, `ImagingStudy.endpoint` is a `Reference(Endpoint)`, not a direct address. The actual URL is at `Endpoint.address`. Our `storage_endpoint` flattens this for simplicity.

---

## 3) DerivedImagingFinding — Extracted Clinical Information

### 3.1 Type Definition

```typescript
/**
 * A clinical finding derived from an imaging study.
 * This is the ONLY imaging information that flows to Deutsch.
 *
 * May be produced by:
 * - Radiologist interpretation
 * - AI/ML imaging models
 * - Automated measurement tools
 *
 * Maps to FHIR R4 Observation (derived from ImagingStudy).
 */
export interface DerivedImagingFinding {
  /**
   * Unique identifier for this finding.
   */
  finding_id: string;

  /**
   * Reference to the source imaging study.
   * Links finding back to raw data (for audit, not transfer).
   */
  source_study: ImagingStudyRef;

  /**
   * Type of finding.
   */
  finding_type: ImagingFindingType;

  /**
   * Quantitative measurement, if applicable.
   * Example: LVEF = 35%, tumor diameter = 2.3 cm
   */
  measurement?: ImagingMeasurement;

  /**
   * Classification result, if applicable.
   * Example: malignant/benign, BIRADS score
   */
  classification?: ImagingClassification;

  /**
   * Anatomical body site (SNOMED CT code).
   * Example: "80891009" (Heart), "39607008" (Lung)
   */
  body_site?: string;

  /**
   * Laterality, if applicable.
   */
  laterality?: 'left' | 'right' | 'bilateral';

  /**
   * Clinical significance assessment.
   */
  clinical_significance?: 'normal' | 'abnormal' | 'critical' | 'indeterminate';

  /**
   * Comparison to prior imaging, if available.
   */
  comparison?: ImagingComparison;

  /**
   * When this finding was extracted from the study.
   */
  extracted_at: string;

  /**
   * Who/what extracted this finding.
   */
  extractor: ImagingExtractor;

  /**
   * Evidence grade for epistemological tracking.
   * AI-derived findings typically grade as 'calculated'.
   * Radiologist findings may grade higher based on methodology.
   */
  evidence_grade: EvidenceGrade;

  /**
   * Confidence in this finding (0.0-1.0).
   * For AI models: model confidence score.
   * For radiologists: certainty assessment.
   */
  confidence: number;

  /**
   * Free-text clinical notes (PHI-redacted for audit).
   */
  notes_redacted?: string;
}
```

### 3.2 Supporting Types

**Note**: These types are defined canonically in [`hermes-message.schema.json`](./schema/hermes-message.schema.json). This section documents them for readability.

```typescript
/**
 * Type of imaging finding.
 */
export type ImagingFindingType =
  | 'measurement'         // Quantitative measurement (LVEF, size, volume)
  | 'classification'      // Categorical classification (malignant/benign)
  | 'abnormality_flag'    // Binary flag for abnormality presence
  | 'comparison'          // Comparison to prior study
  | 'structured_report';  // Full DICOM SR converted to structured data

/**
 * Quantitative measurement from imaging.
 * Canonical source: hermes-message.schema.json#/$defs/ImagingMeasurement
 */
export interface ImagingMeasurement {
  /** Measured value */
  value: number;

  /** Unit of measurement (UCUM) */
  unit: string;

  /** Reference range, if applicable */
  reference_range?: {
    low?: number;
    high?: number;
    population?: string;  // e.g., "adult", "pediatric"
  };

  /** Measurement method */
  method?: string;
}

/**
 * Classification result from imaging.
 * Canonical source: hermes-message.schema.json#/$defs/ImagingClassification
 */
export interface ImagingClassification {
  /** Classification label (e.g., "malignant", "benign", "BIRADS-4") */
  label: string;

  /** Confidence in classification (0.0-1.0) */
  confidence: number;

  /** Model/algorithm that produced this (for AI) */
  model_id?: string;

  /** Alternative labels with confidence scores */
  alternative_labels?: Array<{
    label: string;
    confidence: number;
  }>;
}

/**
 * Comparison to prior imaging study.
 * Canonical source: hermes-message.schema.json#/$defs/ImagingComparison
 */
export interface ImagingComparison {
  /** ID of the prior study being compared */
  prior_study_id: string;

  /** Type of change observed */
  comparison_type: 'improved' | 'stable' | 'worsened' | 'new_finding' | 'resolved';

  /** Quantitative change value, if measurable */
  delta_value?: number;

  /** Unit for delta_value */
  delta_unit?: string;

  /** Additional notes about the comparison */
  notes?: string;
}

/**
 * Who/what extracted the finding.
 * Canonical source: hermes-message.schema.json#/$defs/ImagingExtractor
 *
 * IMPORTANT: When type === 'ai_model', model_id and model_version are REQUIRED.
 */
export interface ImagingExtractor {
  /** Type of extractor */
  type: 'radiologist' | 'ai_model' | 'automated';

  /** For radiologist: practitioner identifier */
  provider_id?: string;

  /** For AI: model identifier (REQUIRED when type === 'ai_model') */
  model_id?: string;

  /** For AI: model version (REQUIRED when type === 'ai_model') */
  model_version?: string;

  /** For automated: system identifier */
  system_id?: string;
}
```

### 3.3 FHIR Mapping

| DerivedImagingFinding Field | FHIR Observation Path |
|----------------------------|----------------------|
| `finding_id` | `Observation.id` |
| `source_study` | `Observation.derivedFrom[0]` → ImagingStudy |
| `finding_type` | `Observation.code.coding[0].code` |
| `measurement.value` | `Observation.valueQuantity.value` |
| `measurement.unit` | `Observation.valueQuantity.unit` |
| `classification.label` | `Observation.valueCodeableConcept.coding[0].display` |
| `body_site` | `Observation.bodySite.coding[0].code` |
| `extracted_at` | `Observation.effectiveDateTime` |
| `extractor` | `Observation.performer[0]` |

---

## 4) HealthStateSnapshotRef Imaging Fields

### 4.1 Extensions for Imaging

The `HealthStateSnapshotRef` type (defined in [`02-hermes-contracts.md`](./02-hermes-contracts.md) §2.5) includes these imaging-related fields:

```typescript
// Imaging fields on HealthStateSnapshotRef
// Canonical source: hermes-message.schema.json#/$defs/HealthStateSnapshotRef

/**
 * References to imaging studies available for this patient.
 * Contains metadata only, NOT raw pixels.
 * Used for audit and provenance tracking.
 */
imaging_studies?: ImagingStudyRef[];

/**
 * Derived findings from imaging studies.
 * These are the ONLY imaging data that Deutsch can reason about.
 * Typically KB-sized (measurements, classifications).
 */
imaging_findings?: DerivedImagingFinding[];

/**
 * Estimated snapshot size in bytes.
 * Used for validation against 1 MB limit.
 * Schema enforces: maximum: 1000000
 */
estimated_size_bytes?: number;
```

**Note**: The full `HealthStateSnapshotRef` type includes additional fields (`snapshot_id`, `snapshot_hash`, `created_at`, `snapshot_uri`, `sources`, `quality`). See the [Hermes contracts](./02-hermes-contracts.md) for the complete definition.

### 4.2 Validation Rules

```typescript
/**
 * Validates snapshot imaging data.
 * Called before sending to Deutsch.
 */
function validateSnapshotImaging(snapshot: HealthStateSnapshotRef): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Size validation with fallback
  const hasImagingData = (snapshot.imaging_studies?.length ?? 0) > 0 ||
                         (snapshot.imaging_findings?.length ?? 0) > 0;

  if (snapshot.estimated_size_bytes) {
    if (snapshot.estimated_size_bytes > 1_000_000) {
      errors.push(`Snapshot exceeds 1 MB limit: ${snapshot.estimated_size_bytes} bytes`);
    }
  } else if (hasImagingData) {
    // Missing size estimate with imaging data present
    warnings.push('estimated_size_bytes absent with imaging data present');
    // In advocate_clinical mode, this should trigger route to clinician
  }

  // Imaging findings must reference valid studies
  for (const finding of snapshot.imaging_findings ?? []) {
    if (!finding.source_study?.study_id) {
      errors.push(`Finding ${finding.finding_id} missing source_study reference`);
    }

    // Confidence bounds
    if (finding.confidence < 0 || finding.confidence > 1) {
      errors.push(`Finding ${finding.finding_id} has invalid confidence: ${finding.confidence}`);
    }
  }

  // Studies must have valid modality
  for (const study of snapshot.imaging_studies ?? []) {
    if (!study.modality) {
      errors.push(`Study ${study.study_id} missing modality`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
```

### 4.3 Size Enforcement Fallback

When `estimated_size_bytes` is absent but imaging data is present:

| Mode | Fallback Behavior |
|------|-------------------|
| `wellness` | Accept with warning logged |
| `advocate_clinical` | Route to clinician with `reason_codes: ['data_quality_warning']` |

**Rationale**: In clinical mode, missing size metadata indicates the snapshot may not have been properly constructed. Conservative routing prevents potential issues.

**Implementation note**: Popper SHOULD check for this condition via:
```typescript
const hasImagingData = (snapshot.imaging_studies?.length ?? 0) > 0 ||
                       (snapshot.imaging_findings?.length ?? 0) > 0;

if (!snapshot.estimated_size_bytes && hasImagingData) {
  if (mode === 'advocate_clinical') {
    return { decision: 'ROUTE_TO_CLINICIAN', reason_codes: ['data_quality_warning'] };
  } else {
    logWarning('missing_size_estimate_with_imaging');
  }
}
```

### 4.4 Multi-Modality Studies (e.g., PET-CT)

Some imaging studies combine multiple modalities (PET-CT, SPECT-CT, PET-MR). The Hermes protocol handles these as follows:

#### Representation Pattern

Multi-modality studies are represented as **separate `ImagingStudyRef` entries linked by `study_group_id`**:

```typescript
/**
 * Extended ImagingStudyRef fields for multi-modality studies.
 */
export interface ImagingStudyRef {
  // ... existing fields ...

  /**
   * Optional: Links related studies in a multi-modality acquisition.
   * All studies with the same study_group_id were acquired together.
   * Example: PET and CT components of a PET-CT study share the same group.
   */
  study_group_id?: string;

  /**
   * Optional: Indicates this study is part of a multi-modality acquisition.
   * Value describes the combined study type.
   */
  multi_modality_type?: 'PET-CT' | 'SPECT-CT' | 'PET-MR' | string;
}
```

#### Example: PET-CT Study

```json
[
  {
    "study_id": "imgstd-petct-2026-001-pet",
    "study_group_id": "grp-petct-2026-001",
    "multi_modality_type": "PET-CT",
    "modality": "PT",
    "storage_endpoint": "phi://imaging/studies/imgstd-petct-2026-001-pet",
    "study_date": "2026-01-20T10:00:00Z",
    "description_redacted": "PET-CT whole body - oncology staging"
  },
  {
    "study_id": "imgstd-petct-2026-001-ct",
    "study_group_id": "grp-petct-2026-001",
    "multi_modality_type": "PET-CT",
    "modality": "CT",
    "storage_endpoint": "phi://imaging/studies/imgstd-petct-2026-001-ct",
    "study_date": "2026-01-20T10:00:00Z",
    "description_redacted": "PET-CT whole body - oncology staging"
  }
]
```

#### Findings from Multi-Modality Studies

`DerivedImagingFinding` references the **specific modality component** that produced the finding:

| Finding Type | Source Modality | Example |
|--------------|-----------------|---------|
| SUV max measurement | PT (PET) | `source_study.modality: 'PT'` |
| Nodule size | CT | `source_study.modality: 'CT'` |
| Fused localization | PT | Reference PT; CT provides anatomical context |

**IMPORTANT**: Findings MUST reference the component study that produced the measurement, not a generic "PET-CT" reference.

---

## 5) Enhanced InteropPayloadRef for Imaging

### 5.1 Imaging Message Types

The existing `InteropPayloadRef` supports imaging-specific FHIR resources:

```typescript
export interface InteropPayloadRef {
  interop_id: string;
  standard: 'FHIR_R4' | 'HL7V2' | 'DICOM_SR' | 'OTHER';
  content_type: string;

  /**
   * Message type for imaging payloads.
   * Extended to include imaging-specific resources.
   */
  message_type?:
    | 'ImagingStudy'       // FHIR R4 ImagingStudy
    | 'DiagnosticReport'   // FHIR R4 DiagnosticReport (radiology)
    | 'Observation'        // FHIR R4 Observation (finding)
    | 'Task'               // Order/workflow
    | 'ServiceRequest'     // Imaging order
    | string;              // Other types

  uri: string;
  content_hash?: string;
  audit_redaction: { summary: string };
}
```

### 5.2 ImagingInteropPayloadRef Extension

```typescript
/**
 * Extended InteropPayloadRef for DICOM-specific references.
 */
export interface ImagingInteropPayloadRef extends InteropPayloadRef {
  /**
   * DICOM StudyInstanceUID for direct DICOM access.
   */
  dicom_study_uid?: string;

  /**
   * Series-level references for granular access.
   */
  series_refs?: Array<{
    series_uid: string;
    instance_count: number;
    modality?: ImagingModality;
  }>;
}
```

---

## 6) Integration Points

### 6.1 Imaging AI Pipeline → HealthStateSnapshot

```
┌─────────────────────────────────────────────────────────────────┐
│                    PHI Service (Raw Storage)                     │
│                                                                  │
│  Raw pixels stored, never transferred to clinical agents         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  DICOM Store: MRI, CT, X-ray, Ultrasound files          │    │
│  └─────────────────────────────────────────────────────────┘    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ Imaging AI processors run inside PHI boundary
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Imaging AI Pipeline                             │
│                                                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │ Cardiac MRI │ │  Chest CT   │ │  Mammo AI   │ ...           │
│  │    Model    │ │    Model    │ │    Model    │               │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘               │
│         │               │               │                       │
│         └───────────────┴───────────────┘                       │
│                         │                                       │
│                         ▼                                       │
│         ┌───────────────────────────────────┐                   │
│         │    DerivedImagingFinding[]        │                   │
│         │    (KB-sized structured data)     │                   │
│         └───────────────────────────────────┘                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              HealthStateSnapshot Assembly                        │
│                                                                  │
│  Snapshot includes:                                              │
│  - imaging_studies[]: ImagingStudyRef (references only)         │
│  - imaging_findings[]: DerivedImagingFinding (actual data)      │
│  - estimated_size_bytes: validated < 1 MB                       │
│                                                                  │
│  Snapshot does NOT include:                                      │
│  - Raw pixels                                                    │
│  - DICOM file content                                           │
│  - Full radiology reports (only excerpts)                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Deutsch (TA1)                                 │
│                                                                  │
│  Receives: DerivedImagingFinding[] with:                        │
│  - LVEF = 35%                                                    │
│  - Nodule classification: benign (0.92)                         │
│  - Cardiomegaly: present                                        │
│                                                                  │
│  Cannot access: Raw imaging pixels                               │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Deutsch Usage

Deutsch MUST treat imaging findings as `observation` claim type and include `source_study` in evidence refs. See [`01-deutsch-specs/09-deutsch-imaging-integration.md`](../01-deutsch-specs/09-deutsch-imaging-integration.md).

### 6.3 Popper Validation

Popper validates imaging findings for hallucination and consistency. See [`02-popper-specs/05-popper-measurement-protocols.md`](../02-popper-specs/05-popper-measurement-protocols.md) §3.5.

---

## 7) Contract Test Fixtures

Fixtures for imaging types are in [`fixtures/`](./fixtures/):

| Fixture | Description |
|---------|-------------|
| `imaging_study_ref.cardiac_mri.json` | Cardiac MRI study reference |
| `derived_finding.lvef.json` | LVEF measurement finding |
| `derived_finding.nodule_classification.json` | AI classification finding |
| `snapshot.with_imaging.json` | Full snapshot with imaging data |

**Validation**: All fixtures MUST validate against `hermes-message.schema.json`.

---

## 8) References

- [FHIR R4 ImagingStudy](https://hl7.org/fhir/R4/imagingstudy.html)
- [FHIR R4 DiagnosticReport](https://hl7.org/fhir/R4/diagnosticreport.html)
- [IHE AI Results Profile](https://wiki.ihe.net/index.php/AI_Results_(AIR))
- [DICOM Structured Reporting](https://www.dicomstandard.org/using/dicomweb/structured-reporting)
- [02-hermes-contracts.md](./02-hermes-contracts.md) — Main Hermes contract
- [04-hermes-epistemological-types.md](./04-hermes-epistemological-types.md) — EvidenceGrade enum

---

*Last updated: 2026-01-24*
