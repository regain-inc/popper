---
version: 1.0.1
last-updated: 2026-01-24
status: draft
owner: Deutsch Dev Team
tags: [advocate, ta1, deutsch, imaging, ai-pipeline]
---

# Deutsch Imaging Integration Specification (v1)

## 0) Purpose

This document specifies how Deutsch (TA1) interacts with medical imaging data. The core principle is **"Reference, Don't Transfer"**: raw imaging pixels never flow to Deutsch; only derived findings do.

**Related specifications:**
- [`../03-hermes-specs/05-hermes-imaging-data.md`](../03-hermes-specs/05-hermes-imaging-data.md) — Type definitions
- [`../03-hermes-specs/02-hermes-contracts.md`](../03-hermes-specs/02-hermes-contracts.md) — §2.9 Imaging Data Types

---

## 1) Normative Constraints

### 1.1 Data Access Restrictions

**NORMATIVE**: Deutsch MUST NOT request, receive, or process raw imaging pixels.

**NORMATIVE**: Deutsch MUST only consume `DerivedImagingFinding` from `HealthStateSnapshot`.

**NORMATIVE**: Deutsch MUST NOT attempt to fetch raw imaging data via `ImagingStudyRef.storage_endpoint`.

**NORMATIVE**: Deutsch MUST treat all imaging findings as `OBSERVATION` claim type in the claims taxonomy.

### 1.2 Evidence Handling

**NORMATIVE**: When referencing imaging evidence, Deutsch MUST include `source_study` reference in `evidence_refs`.

**NORMATIVE**: Deutsch MUST NOT claim direct access to imaging content — only derived findings.

**NORMATIVE**: Deutsch SHOULD weight AI-derived imaging findings by `DerivedImagingFinding.confidence` (finding-level; required on all findings). For `finding_type === "classification"`, `classification.confidence` MAY be used as an input when populating the top-level `confidence`.

---

## 2) Imaging AI Pipeline Architecture

Deutsch operates at the **end** of an imaging AI pipeline, receiving only the derived outputs:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PHI Service (Raw Storage)                            │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                   │
│  │   MRI Pixels  │  │   CT Pixels   │  │  X-ray Pixels │                   │
│  │   (500 MB)    │  │   (200 MB)    │  │    (50 MB)    │                   │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘                   │
│          │                  │                  │                            │
└──────────┼──────────────────┼──────────────────┼────────────────────────────┘
           │                  │                  │
           ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Imaging AI Processor Service                            │
│                                                                              │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                   │
│  │ Cardiac MRI   │  │  Lung CT      │  │  Chest X-ray  │                   │
│  │   Model       │  │   Model       │  │    Model      │                   │
│  │  (LVEF, LV)   │  │  (Nodules)    │  │(Cardiomegaly) │                   │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘                   │
│          │                  │                  │                            │
│          ▼                  ▼                  ▼                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              DerivedImagingFinding[] (~1-10 KB each)                │   │
│  │                                                                      │   │
│  │  finding_id: "f-001"           finding_id: "f-002"                  │   │
│  │  finding_type: "measurement"   finding_type: "classification"       │   │
│  │  measurement:                  classification:                      │   │
│  │    value: 35                     label: "benign"                    │   │
│  │    unit: "%"                     confidence: 0.92                   │   │
│  │  clinical_significance:        source_study: {...}                  │   │
│  │    "abnormal"                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HealthStateSnapshot (~10-50 KB total)                     │
│                                                                              │
│  Contains:                                                                   │
│    - imaging_studies: ImagingStudyRef[]    (references only)                │
│    - imaging_findings: DerivedImagingFinding[]  (actual data, KB-sized)     │
│    - estimated_size_bytes: 45000                                            │
│                                                                              │
│  Does NOT contain:                                                           │
│    - Raw MRI/CT/X-ray pixels                                                │
│    - DICOM files                                                            │
│    - Image binary data                                                      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Deutsch (TA1)                                     │
│                                                                              │
│  Sees:                                                                       │
│    "LVEF = 35% (abnormal), cardiac MRI, study_id: mri-abc123"              │
│    "Lung nodule: benign (0.92 confidence), CT, study_id: ct-def456"        │
│                                                                              │
│  Cannot access:                                                              │
│    Raw MRI pixels at phi://imaging/studies/mri-abc123                       │
│    Raw CT pixels at phi://imaging/studies/ct-def456                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3) Evidence Handling for Imaging

### 3.1 EvidenceRef Construction

When Deutsch references imaging-derived evidence, it MUST construct `EvidenceRef` as follows:

```typescript
interface ImagingEvidenceRef extends EvidenceRef {
  evidence_id: string;                    // Unique reference ID
  evidence_type: 'patient_data';          // ALWAYS patient_data for imaging
  evidence_grade: EvidenceGrade;          // Typically 'calculated' for AI, 'expert_opinion' for radiologist

  // Citation format for imaging
  citation: string;                       // e.g., "Cardiac MRI, 2026-01-15, LVEF measurement"

  // URI points to finding, NOT raw pixels
  uri?: string;                           // e.g., "phi://imaging/findings/f-001"

  // Confidence from the imaging finding
  confidence?: number;                    // 0.0-1.0, from finding.confidence

  // Falsification criteria specific to imaging
  falsification_condition?: string;       // e.g., "Repeat imaging shows different measurement"
}
```

### 3.2 Example Evidence Construction

```typescript
function constructImagingEvidence(finding: DerivedImagingFinding): EvidenceRef {
  const modalityLabel = getModalityLabel(finding.source_study.modality);
  const findingDescription = describeFinding(finding);

  return {
    evidence_id: `ev-img-${finding.finding_id}`,
    evidence_type: 'patient_data',

    // AI-derived → 'calculated'; radiologist → 'expert_opinion'
    evidence_grade: finding.extractor.type === 'ai_model'
      ? 'calculated'
      : 'expert_opinion',

    citation: `${modalityLabel}, ${finding.source_study.study_date.slice(0,10)}, ${findingDescription}`,

    // Reference the finding, NOT the raw study
    uri: `phi://imaging/findings/${finding.finding_id}`,

    confidence: finding.confidence,

    // Imaging-specific falsification
    falsification_condition: `Repeat ${modalityLabel.toLowerCase()} shows contradictory finding`,
  };
}

function getModalityLabel(modality: ImagingModality): string {
  const labels: Record<ImagingModality, string> = {
    MR: 'Cardiac MRI',
    CT: 'CT Scan',
    XR: 'X-Ray',
    US: 'Ultrasound',
    MG: 'Mammography',
    PT: 'PET Scan',
    NM: 'Nuclear Medicine',
    ECG: 'ECG',
    DX: 'Digital Radiography',
    CR: 'Computed Radiography',
    OT: 'Imaging Study',
  };
  return labels[modality] || 'Imaging Study';
}
```

---

## 4) ArgMed Debate Integration

### 4.1 Generator (Conjecturer) with Imaging

The Generator MAY use imaging findings as supporting evidence for hypotheses:

```typescript
interface GeneratorImagingContext {
  // Available imaging findings from snapshot
  available_findings: DerivedImagingFinding[];

  // Findings relevant to current clinical context
  relevant_findings: DerivedImagingFinding[];

  // Missing imaging that might inform the case
  suggested_imaging: Array<{
    modality: ImagingModality;
    body_part: string;
    rationale: string;
  }>;
}
```

**Generator Imaging Rules:**
- Generator SHOULD consider all `clinical_significance === 'abnormal'` or `'critical'` findings
- Generator MUST include imaging findings in hypothesis `evidence_refs`
- Generator SHOULD NOT anchor on imaging alone — consider full clinical picture

### 4.2 Verifier (Critic) with Imaging

The Verifier MUST check if imaging findings contradict hypotheses:

```typescript
interface VerifierImagingChecks {
  // Does imaging contradict the hypothesis?
  imaging_contradictions: Array<{
    finding_id: string;
    contradiction_type: 'measurement_mismatch' | 'classification_conflict' | 'progression_unexpected';
    details: string;
    severity: 'fatal' | 'significant' | 'minor';
  }>;

  // Is AI confidence too low?
  low_confidence_warnings: Array<{
    finding_id: string;
    confidence: number;
    threshold: number;
  }>;

  // Are there critical findings being ignored?
  overlooked_critical_findings: DerivedImagingFinding[];
}
```

**Verifier Imaging Rules:**
- Verifier MUST check if hypothesis contradicts imaging findings
- Verifier SHOULD flag findings with `confidence < 0.7` as uncertain
- Verifier MUST note any `clinical_significance === 'critical'` findings in critique

### 4.3 Reasoner (Synthesizer) with Imaging

The Reasoner weights imaging evidence appropriately:

```typescript
interface ReasonerImagingWeighting {
  // Weight AI-derived findings by confidence
  ai_confidence_weight: (finding: DerivedImagingFinding) => number;

  // Prefer radiologist-verified findings
  radiologist_boost: number;  // e.g., 1.2x weight

  // Recent imaging preferred over old
  recency_decay: (days_since_study: number) => number;
}

// Example weighting
function computeImagingWeight(finding: DerivedImagingFinding): number {
  let weight = finding.confidence;

  // Radiologist findings get boost
  if (finding.extractor.type === 'radiologist') {
    weight *= 1.2;
  }

  // Decay for old imaging
  const daysSinceStudy = daysBetween(finding.source_study.study_date, now());
  if (daysSinceStudy > 90) {
    weight *= 0.9;
  }
  if (daysSinceStudy > 180) {
    weight *= 0.8;
  }

  return Math.min(weight, 1.0);
}
```

---

## 5) IDK Protocol for Imaging

### 5.1 Missing Imaging Triggers

Deutsch SHOULD trigger IDK Protocol when required imaging is unavailable:

```typescript
interface ImagingIDKTriggers {
  // Cartridge specifies required imaging for clinical context
  required_imaging_missing: {
    modality: ImagingModality;
    body_part?: string;
    clinical_context: string;
  }[];

  // Critical finding without recent confirmation
  critical_finding_stale: {
    finding_id: string;
    days_since_study: number;
    threshold: number;
  }[];

  // AI confidence too low for treatment decision
  confidence_below_threshold: {
    finding_id: string;
    confidence: number;
    required_confidence: number;
  }[];
}
```

### 5.2 IDK Response for Imaging

```typescript
interface ImagingIDKResponse extends IDKResponse {
  idk_triggered: true;
  reason_code: 'MISSING_DATA' | 'LOW_HTV' | 'INSUFFICIENT_EVIDENCE' | 'STALE_DATA';

  // Imaging-specific missing information
  missing_information: string[];  // e.g., ["Cardiac MRI required for LVEF assessment"]

  // Suggested imaging to resolve uncertainty
  suggested_imaging?: Array<{
    modality: ImagingModality;
    body_part: string;
    urgency: 'routine' | 'soon' | 'urgent';
    rationale: string;
  }>;

  safe_fallback_available: boolean;
}
```

### 5.3 Example IDK Trigger Logic

```typescript
function checkImagingIDK(
  snapshot: HealthStateSnapshot,
  clinicalContext: ClinicalContext,
  cartridge: Cartridge,
): ImagingIDKResponse | null {

  // Check for required imaging per cartridge
  const requiredImaging = cartridge.required_imaging_for_context(clinicalContext);

  for (const requirement of requiredImaging) {
    const hasFinding = snapshot.imaging_findings?.some(f =>
      f.source_study.modality === requirement.modality &&
      (!requirement.body_part || f.body_site === requirement.body_part)
    );

    if (!hasFinding) {
      return {
        idk_triggered: true,
        reason_code: 'MISSING_DATA',
        missing_information: [
          `${getModalityLabel(requirement.modality)} required for ${requirement.clinical_context}`,
        ],
        suggested_imaging: [{
          modality: requirement.modality,
          body_part: requirement.body_part || 'unspecified',
          urgency: requirement.urgency || 'routine',
          rationale: requirement.clinical_context,
        }],
        safe_fallback_available: false,
      };
    }
  }

  // Check confidence thresholds for treatment decisions
  if (clinicalContext.involves_treatment_decision) {
    for (const finding of snapshot.imaging_findings || []) {
      if (finding.classification && finding.confidence < 0.7) {
        return {
          idk_triggered: true,
          reason_code: 'INSUFFICIENT_EVIDENCE',
          missing_information: [
            `Imaging classification confidence (${(finding.confidence * 100).toFixed(0)}%) below threshold for treatment decision`,
          ],
          suggested_action: 'Request radiologist review of imaging',
          safe_fallback_available: true,
        };
      }
    }
  }

  return null; // No IDK trigger
}
```

---

## 6) Cartridge Integration

### 6.1 Cartridge Imaging Configuration

Domain cartridges MAY specify imaging requirements:

```typescript
interface CartridgeImagingConfig {
  // Imaging modalities relevant to this domain
  relevant_modalities: ImagingModality[];

  // Required imaging for specific clinical contexts
  imaging_requirements: Array<{
    clinical_context: string;          // e.g., "heart_failure_assessment"
    required_modality: ImagingModality;
    required_body_part?: string;
    max_staleness_days: number;        // e.g., 90 for cardiac MRI
    confidence_threshold: number;      // e.g., 0.7 for treatment decisions
    fallback_behavior: 'idk' | 'route' | 'proceed_with_warning';
  }>;

  // Imaging-specific guardrails
  imaging_guardrails: Array<{
    condition: string;                 // e.g., "critical_finding_present"
    action: 'escalate' | 'flag' | 'log';
    urgency: 'immediate' | 'soon' | 'routine';
  }>;
}
```

### 6.2 Example: CVD Cartridge Imaging

```typescript
const cvdImagingConfig: CartridgeImagingConfig = {
  relevant_modalities: ['MR', 'CT', 'US', 'ECG'],

  imaging_requirements: [
    {
      clinical_context: 'lvef_assessment',
      required_modality: 'MR',
      required_body_part: 'heart',
      max_staleness_days: 90,
      confidence_threshold: 0.8,
      fallback_behavior: 'idk',
    },
    {
      clinical_context: 'pulmonary_assessment',
      required_modality: 'CT',
      required_body_part: 'chest',
      max_staleness_days: 180,
      confidence_threshold: 0.7,
      fallback_behavior: 'route',
    },
  ],

  imaging_guardrails: [
    {
      condition: 'lvef_below_35_percent',
      action: 'escalate',
      urgency: 'immediate',
    },
    {
      condition: 'new_pulmonary_nodule',
      action: 'flag',
      urgency: 'soon',
    },
  ],
};
```

---

## 7) Audit and Compliance

### 7.1 Audit Events for Imaging

Deutsch MUST emit audit events when imaging influences decisions:

```typescript
// When imaging finding is used in hypothesis
emit({
  event_type: 'OTHER',
  other_event_type: 'IMAGING_FINDING_USED',
  summary: `Imaging finding ${finding.finding_id} used in hypothesis`,
  tags: {
    finding_id: finding.finding_id,
    modality: finding.source_study.modality,
    finding_type: finding.finding_type,
    confidence: String(finding.confidence),
    extractor_type: finding.extractor.type,
  },
});

// When imaging triggers IDK
emit({
  event_type: 'OTHER',
  other_event_type: 'IMAGING_IDK_TRIGGERED',
  summary: `IDK triggered: ${idk_response.reason_code}`,
  tags: {
    reason_code: idk_response.reason_code,
    missing_modality: idk_response.suggested_imaging?.[0]?.modality || 'none',
  },
});

// When critical imaging finding detected
emit({
  event_type: 'OTHER',
  other_event_type: 'IMAGING_CRITICAL_FINDING',
  summary: `Critical imaging finding detected`,
  tags: {
    finding_id: finding.finding_id,
    modality: finding.source_study.modality,
    clinical_significance: 'critical',
  },
});
```

### 7.2 PHI Minimization

Audit events for imaging MUST NOT include:
- Raw pixel data
- Patient identifiers
- Specific anatomical descriptions that could identify patient
- Storage endpoints or internal URIs

Audit events MAY include:
- Finding IDs
- Modalities
- Clinical significance levels
- Confidence scores
- Extractor types

---

## 8) Testing Requirements

### 8.1 Unit Tests

- Deutsch correctly constructs `EvidenceRef` from `DerivedImagingFinding`
- Deutsch does NOT attempt to access `storage_endpoint`
- IDK Protocol triggers correctly for missing imaging
- Confidence weighting applied correctly in ArgMed

### 8.2 Integration Tests

- Full debate produces correct recommendations with imaging findings
- Critical findings trigger appropriate escalation
- Audit events emitted correctly

### 8.3 Adversarial Tests

- Deutsch handles snapshot with no imaging gracefully
- Deutsch handles low-confidence findings appropriately
- Deutsch does not hallucinate imaging data not in snapshot

---

## 9) References

- [`../03-hermes-specs/05-hermes-imaging-data.md`](../03-hermes-specs/05-hermes-imaging-data.md) — Type definitions
- [`../03-hermes-specs/02-hermes-contracts.md`](../03-hermes-specs/02-hermes-contracts.md) — §2.9 Imaging Data Types
- [`07-deutsch-argmed-debate.md`](./07-deutsch-argmed-debate.md) — ArgMed debate specification
- [`08-deutsch-idk-protocol.md`](./08-deutsch-idk-protocol.md) — IDK Protocol formalization
- [`../02-popper-specs/05-popper-measurement-protocols.md`](../02-popper-specs/05-popper-measurement-protocols.md) — Imaging hallucination detection

---

*Last updated: 2026-01-24*
