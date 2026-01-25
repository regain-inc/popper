---
version: 1.7.0
last-updated: 2026-01-25
status: draft
owner: Hermes Dev Team
tags: [advocate, protocol, contract, schemas, imaging, feedback]
---

# Hermes Contract (v1) — Schemas, Semantics, Examples

## 0) How to read this document

- This is the **canonical contract** for Hermes v1.
- This file is written so it can be implemented as:
  - TypeScript types
  - Zod schemas
  - (optional) generated JSON Schema
- Language keywords:
  - **MUST** = required
  - **SHOULD** = recommended
  - **MAY** = optional

## 1) Conventions

### 1.1 Wire format
- All Hermes messages MUST use **JSON**.
- Field names in JSON MUST use **snake_case**.
- All top-level messages MUST include `hermes_version`.
- If a message is signed and/or hashed (e.g., `trace.signature`, `snapshot_hash`), implementations MUST use a deterministic canonical JSON serialization (see §1.5).

### 1.2 Time format
- `*_at` fields MUST be ISO-8601 UTC strings, e.g. `"2026-01-23T12:34:56.789Z"`.

#### 1.2.1 Timestamp validation (clock skew) — required

Implementations MUST define and enforce a clock-skew tolerance when validating timestamps in Hermes messages:

- **Tolerance**: default \(±5 minutes\) unless a deployment explicitly configures a different value.
- **Validation**: receivers SHOULD reject messages with timestamps outside tolerance as unsafe.
- **Operational requirement**: services SHOULD synchronize clocks (e.g., NTP) and monitor drift.

### 1.3 IDs
- IDs SHOULD be UUID strings (or ULID) but MUST be stable and unambiguous within a message.
- `trace_id` MUST be stable across the full “one supervised action” flow.

### 1.4 PHI/PII handling (important)

Hermes is used in clinical workflows; some payloads can contain sensitive content.

To prevent accidental leakage:
- Any message MAY contain sensitive fields **only if** those fields are clearly marked and redaction rules exist.
- Hermes MUST define a standard **redacted audit form** for every message type that is emitted to logs or exported.

This contract therefore defines:
- an **operational payload** (used for real-time decisions)
- a **redacted audit payload** (safe to store in most logs/exports)

### 1.5 Canonical JSON serialization (hashing/signatures)

Hermes is designed for auditability and reproducibility. If you compute any hashes/signatures over Hermes payloads (or referenced payloads like snapshots), you MUST ensure all parties compute the same bytes.

Minimum requirements:
- Canonicalize JSON before hashing/signing (deterministic key ordering, no insignificant whitespace).
- Prefer an existing canonicalization standard (e.g., JSON Canonicalization Scheme / RFC 8785) rather than implementing your own.
- If you compute `snapshot_hash`, document:
  - the canonicalization approach,
  - the hash algorithm (e.g., `sha256`),
  - and exactly which bytes were hashed (the full snapshot JSON, not the Hermes ref).

## 2) Core building blocks

### 2.1 `hermes_version`

```ts
export type HermesVersion = string; // e.g. "1.0.0"
```

### 2.2 `trace_context`

**Purpose:** create a consistent “receipt trail” across Deutsch, Popper, the API gateway, and clinician systems.

```ts
export interface TraceContext {
  trace_id: string;                 // required, stable across the whole flow
  span_id?: string;                 // optional
  parent_span_id?: string;          // optional
  created_at: string;               // ISO time when the message was created

  producer: {
    system: 'deutsch' | 'popper' | 'gateway' | 'other';
    service_version: string;        // git sha or semver for the producing service
    ruleset_version?: string;       // e.g. popper safety DSL version
    model_version?: string;         // e.g. "gpt-5.2-2026-01-15" (if used)
  };

  // Optional integrity. If used, MUST be verifiable by receiver.
  signature?: {
    // NOTE: In regulated deployments, implementations SHOULD use JWS with EdDSA (Ed25519).
    // See §2.2.2 for normative algorithm/encoding constraints.
    alg: 'hmac-sha256' | 'jws';
    key_id: string;
    value: string;                  // `alg="jws"` → JWS compact (base64url segments); `alg="hmac-sha256"` → base64url digest
  };
}
```

**Regulated integrity requirement (normative):**
- In `advocate_clinical` mode, implementations MUST enforce message integrity for supervision messages:
  - Preferred: `trace.signature` is present and verified by the receiver before processing.
  - Acceptable equivalent: strict mTLS + service identity + replay protection (documented per deployment).

#### 2.2.1 Signature signing input (normative)

If `trace.signature` is used, implementations MUST compute/verifiy the signature over the same bytes.

Minimum required signing rules:
- **Canonicalization**: RFC 8785 as described in §1.5.
- **Signing input**: the RFC 8785 canonical JSON bytes of the **entire top-level Hermes message** (e.g., `SupervisionRequest`), with `trace.signature` omitted.
  - Rationale: prevents circular signing and ensures consistent bytes across producers/receivers.
- **Verification failure**: receivers MUST treat as unsafe (default: `HARD_STOP` with `reason_codes` including `policy_violation`) and emit a `VALIDATION_FAILED` audit event.

> Note: deployments using “mTLS equivalent” MUST still implement replay protection semantics (§3.4.1) and MUST record auth failures in audit logs in PHI-minimized form.

**Deployment appendix:** key custody, rotation, and failure taxonomy are specified in:
- `03-hermes-specs/03-hermes-deployment-security.md`

#### 2.2.2 Signature algorithm + encoding (normative)

Hermes is intentionally minimal about cryptography, but regulated deployments MUST still interoperate.

In `advocate_clinical` deployments that use `trace.signature`:

- `trace.signature.alg` MUST be `"jws"`.
- `trace.signature.value` MUST be a **JWS Compact Serialization** string (`<header>.<payload>.<signature>`) using **base64url without padding** (RFC 7515 / RFC 4648 §5).
- JWS header requirements:
  - `alg` MUST be `"EdDSA"` (Ed25519).
  - `typ` SHOULD be `"JOSE"` or `"JWT"` (deployment choice; stable).
  - `kid` MAY be present; if present it MUST be consistent with `trace.signature.key_id`.
- Signing input bytes are defined in §2.2.1 (canonical JSON of the top-level message, omitting `trace.signature`).

Deployments MAY use `alg = "hmac-sha256"` only in non-regulated contexts (e.g., local dev) and MUST document it in their Site Integration Profile.

### 2.3 `mode`

**Purpose:** the same system behaves differently depending on deployment boundaries.

```ts
export type Mode =
  | 'wellness'            // non-regulated, lifestyle-first, no treatment-changing actions
  | 'advocate_clinical';  // regulated / clinician-governed autonomy boundary
```

### 2.4 `subject_ref`

**Purpose:** identify “who this is about” without embedding direct PII like email.

```ts
export interface SubjectRef {
  subject_type: 'patient';
  subject_id: string;          // pseudonymous stable ID (NOT email/phone/name)
  organization_id?: string;    // optional (TA3 org/site)
}
```

**Normative constraint:** in `advocate_clinical` mode, `organization_id` MUST be present on supervision messages.

### 2.5 `health_state_snapshot_ref`

**Purpose:** both Deutsch and Popper reason over the *same snapshot* so decisions are reproducible.

```ts
export interface HealthStateSnapshotRef {
  snapshot_id: string;
  snapshot_hash?: string;       // optional but strongly recommended for reproducibility (see §2.5.1)
  created_at: string;

  // A pointer to where the snapshot can be retrieved inside the deployment.
  // This MUST NOT be a public URL.
  snapshot_uri?: string;        // e.g. "phi://snapshots/<id>" or "http://internal/snapshots/<id>"

  // Minimal metadata for fast checks (no PHI).
  sources: Array<'ehr' | 'wearable' | 'patient_reported' | 'imaging' | 'other'>;

  // Optional PHI-minimized quality flags for safe decision-making.
  // Signal keys SHOULD align with the active cartridge's `required_snapshot_signals` (no values here).
  quality?: {
    missing_signals?: string[];        // e.g. ["potassium", "creatinine"]
    conflicting_signals?: string[];    // e.g. ["weight_trend"]
    notes?: string;                   // brief; MUST NOT include direct identifiers
  };

  // ═══════════════════════════════════════════════════════════════════
  // CLINICIAN OVERRIDE HISTORY (optional, for case reassessment)
  // See §4.2 and §4.3 for full type definitions
  // ═══════════════════════════════════════════════════════════════════

  // Prior clinician overrides for this patient (PHI-minimized)
  // Populated by snapshot builder when relevant history exists.
  // Used by Deutsch for patient-specific case reassessment (NOT RLHF).
  prior_clinician_overrides?: ClinicianOverrideHistory;

  // ═══════════════════════════════════════════════════════════════════
  // IMAGING DATA FIELDS (optional, see §2.9 and 05-hermes-imaging-data.md)
  // ═══════════════════════════════════════════════════════════════════

  // References to imaging studies (pointers, NOT raw pixels)
  // Raw imaging data MUST NEVER be included in the snapshot.
  imaging_studies?: ImagingStudyRef[];

  // Derived findings extracted from imaging (KB-sized, safe to include)
  // These are the outputs of radiologists or imaging AI pipelines.
  imaging_findings?: DerivedImagingFinding[];

  // Estimated uncompressed size in bytes (for validation)
  // Deployments SHOULD validate: estimated_size_bytes <= 1,000,000 (1 MB)
  estimated_size_bytes?: number;
}
```

#### 2.5.1 Snapshot hash computation (normative)

To make decisions reproducible and tamper-evident across services:

- In `advocate_clinical` mode, deployments MUST ensure the verifier (Popper) can access the snapshot **bytes** used for supervision, via one of:
  - **A)** `HealthStateSnapshotRef.snapshot_uri` is present and resolvable within the deployment trust boundary (internal-only; never public), OR
  - **B)** `SupervisionRequest.snapshot_payload` is present inline (used when Popper cannot/should not fetch snapshots over the network).
- In `advocate_clinical` mode, implementations SHOULD include `snapshot_hash` and SHOULD verify it using whichever snapshot access mode is in effect (A or B).
- **Canonicalization**: RFC 8785 (JSON Canonicalization Scheme) as described in §1.5.
- **Hash algorithm**: SHA-256.
- **Bytes hashed**: the snapshot JSON payload **itself** (not the `HealthStateSnapshotRef` wrapper), where the payload is either:
  - fetched via `snapshot_uri` (mode A), or
  - provided inline as `snapshot_payload` (mode B).
- **Encoding**: base64 of the raw SHA-256 digest bytes.

Verification semantics:
- If `snapshot_hash` is present and the verifier has access to snapshot bytes (A or B), a hash mismatch MUST be treated as unsafe (default: conservative decision + `reason_codes` including `policy_violation`).
- If a verifier cannot access snapshot bytes (neither A nor B), it MUST treat the snapshot as less trustworthy and SHOULD increase conservatism (route / request more info) per policy.
  - In `advocate_clinical`, if neither `snapshot_uri` nor `snapshot_payload` is available, Popper SHOULD treat the request as invalid/unsafe for regulated supervision.
  - Recommended default (if the verifier chooses to fetch via A): use a short snapshot fetch timeout (default: **50ms**, configurable) so the overall supervision path can remain low-latency.

In `advocate_clinical` mode, policies SHOULD treat inability to retrieve/verify the snapshot as a high-risk uncertainty driver for treatment-changing proposals (e.g., route to clinician for `MEDICATION_ORDER_PROPOSAL`).

#### 2.5.2 Snapshot size constraints (normative)

Raw medical imaging data (MRI, CT, X-ray) can be 100-500 MB per study. To ensure clinical agents operate efficiently:

**NORMATIVE**: `HealthStateSnapshot` MUST NOT exceed **1 MB** uncompressed.

**NORMATIVE**: Raw imaging pixels MUST NEVER be included in the snapshot. Instead:
- Use `ImagingStudyRef` to reference imaging studies (pointers to storage, not content)
- Use `DerivedImagingFinding` to include extracted findings (measurements, classifications)

**Validation requirements**:
- Deployments SHOULD populate `estimated_size_bytes` on `HealthStateSnapshotRef`
- Popper SHOULD reject snapshots where `estimated_size_bytes > 1,000,000`
- If `estimated_size_bytes` is absent, Popper MAY accept but SHOULD log a warning

**Rationale**: The "Reference, Don't Transfer" pattern ensures:
1. Clinical agents operate on KB-sized derived data, not MB-sized raw pixels
2. Imaging AI pipelines process raw data separately, outputting structured findings
3. Snapshot reproducibility is maintained without embedding large binary data

See [`05-hermes-imaging-data.md`](./05-hermes-imaging-data.md) for complete imaging type definitions.

### 2.6 `evidence_ref`

**Purpose:** provide “why” without copying large documents into messages.

```ts
export type EvidenceType =
  | 'guideline'
  | 'study'
  | 'patient_data'
  | 'calculation'
  | 'policy'
  | 'other';

export interface EvidenceRef {
  evidence_id: string;
  evidence_type: EvidenceType;

  // Human-readable citation string, e.g. "ACC/AHA HF Guideline 2024, Section 7.2"
  citation: string;

  // Optional pointer to full evidence text or stored "evidence pack"
  uri?: string;

  // Optional short excerpt (MUST be brief to avoid payload bloat)
  excerpt?: string; // <= ~500 chars recommended

  // Optional content hash for immutability
  content_hash?: string;

  // === EPISTEMOLOGICAL ENHANCEMENT (see 04-hermes-epistemological-types.md) ===

  // Evidence strength grade (systematic_review > rct > cohort > ... > expert_opinion)
  // SHOULD be populated for all evidence refs in advocate_clinical mode
  // SHOULD be populated for evidence supporting MEDICATION_ORDER_PROPOSAL
  // If absent on medication proposals, Popper SHOULD treat as below threshold (conservative)
  evidence_grade?: EvidenceGrade;

  // Calibrated confidence (0.0-1.0), accounting for grade and recency
  confidence?: number;

  // Publication date for confidence decay calculation
  publication_date?: string;

  // What would refute this evidence?
  falsification_condition?: string;
}
```

### 2.7 `disclosure_bundle`

**Purpose:** standard “glass box” explanation for clinicians and patients.

```ts
export type UncertaintyLevel = 'low' | 'medium' | 'high';

export interface DisclosureBundle {
  patient_summary: string;         // plain language
  clinician_summary: string;       // more technical

  rationale_bullets: string[];     // brief bullets of reasoning
  key_unknowns: string[];          // what could change the decision

  uncertainty: {
    level: UncertaintyLevel;
    notes?: string;
  };
}
```

### 2.8 Epistemological Types (Extended)

The following types operationalize Deutschian/Popperian epistemology. Full specification with algorithms and examples: [`04-hermes-epistemological-types.md`](./04-hermes-epistemological-types.md)

#### 2.8.1 `ClaimType` — Classifying claims by epistemic status

```ts
export type ClaimType =
  | 'observation'           // Directly observed data point
  | 'diagnosis'             // Explanatory hypothesis about patient state
  | 'prognosis'             // Prediction about future outcomes
  | 'treatment_rec'         // Recommendation for therapeutic action
  | 'lifestyle_rec'         // Recommendation for behavioral change
  | 'diagnostic_prompt'     // Suggestion to gather more information
  | 'escalation'            // Routing decision (clinician involvement)
  | 'administrative';       // Scheduling, logistics, non-clinical
```

#### 2.8.2 `EvidenceGrade` — Hierarchy for hard-to-vary explanations

```ts
export type EvidenceGrade =
  | 'systematic_review'  // Meta-analysis of RCTs (hardest to vary)
  | 'rct'                // Randomized controlled trial
  | 'cohort'             // Observational cohort study
  | 'case_control'       // Retrospective case-control
  | 'case_series'        // Descriptive case series
  | 'case_report'        // Single case report
  | 'expert_opinion'     // Expert consensus without systematic evidence
  | 'policy'             // Organizational policy
  | 'patient_reported'   // Self-reported by patient
  | 'calculated';        // Derived from other data
```

#### 2.8.3 `HTVScore` — Hard-to-Vary scoring

```ts
export interface HTVScore {
  interdependence: number;  // 0.0-1.0: How tightly coupled are claim parts?
  specificity: number;      // 0.0-1.0: How precise are predictions?
  parsimony: number;        // 0.0-1.0: Are all elements necessary?
  falsifiability: number;   // 0.0-1.0: What would refute this?
  composite: number;        // Weighted average (default: equal weights)
}
```

**Threshold mapping**: `composite ≥ 0.7` (good) | `0.4–0.7` (moderate) | `< 0.4` (poor/trigger IDK)

#### 2.8.4 `UncertaintyCalibration` — Quantified fallibilism

```ts
export interface UncertaintyDriver {
  factor: 'evidence_grade' | 'htv_score' | 'data_quality' | 'debate_consensus' | 'staleness' | 'conflicting_evidence';
  contribution: number;
  details: string;
}

export interface UncertaintyCalibration {
  level: UncertaintyLevel;        // 'low' | 'medium' | 'high'
  score: number;                  // 0.0-1.0 continuous
  drivers: UncertaintyDriver[];   // What contributed to uncertainty
}
```

#### 2.8.5 `FalsificationCriteria` — Testable refutation conditions

```ts
export interface FalsificationCriteria {
  claim_id: string;
  refutation_conditions: string[];      // Observable conditions that would refute
  observation_window_days?: number;     // Time window for observing outcomes
  outcome_measures: string[];           // Metrics to monitor
  refutation_action?: 'route_to_clinician' | 'hard_stop' | 'modify_recommendation' | 'log_only';
}
```

### 2.9 Imaging Data Types

Medical imaging requires special handling due to data size (MRI: 100-500 MB, CT: 30-500 MB). Hermes uses the **"Reference, Don't Transfer"** pattern: raw pixels stay in PHI storage, only derived findings flow to clinical agents.

Full specification with FHIR mappings and examples: [`05-hermes-imaging-data.md`](./05-hermes-imaging-data.md)

#### 2.9.1 `ImagingStudyRef` — Reference to imaging study (not content)

```ts
export type ImagingModality =
  | 'MR'    // Magnetic Resonance Imaging
  | 'CT'    // Computed Tomography
  | 'XR'    // X-Ray / Radiography
  | 'US'    // Ultrasound
  | 'MG'    // Mammography
  | 'PT'    // Positron Emission Tomography
  | 'NM'    // Nuclear Medicine
  | 'ECG'   // Electrocardiogram
  | 'DX'    // Digital Radiography
  | 'CR'    // Computed Radiography
  | 'OT';   // Other

export interface ImagingStudyRef {
  // Unique identifier (FHIR ImagingStudy.id or DICOM StudyInstanceUID)
  study_id: string;

  // Internal pointer to raw pixel storage (NEVER a public URL)
  // Clinical agents MUST NOT fetch this directly
  storage_endpoint: string;

  // Imaging modality (determines interpretation context)
  modality: ImagingModality;

  // When the imaging study was performed
  study_date: string;

  // Optional: links related studies acquired together (e.g., PET + CT in PET-CT)
  study_group_id?: string;

  // Optional: PHI-minimized label for the combined acquisition (e.g., "PET-CT", "PET-MR")
  multi_modality_type?: string;

  // Series and instance counts (metadata, not content)
  series_count?: number;
  instance_count?: number;

  // PHI-minimized description (e.g., "Cardiac MRI", NOT patient details)
  description_redacted: string;

  // Body part examined (SNOMED CT preferred)
  body_part_examined?: string;

  // Content hash of DICOM metadata (NOT pixels) for integrity
  metadata_hash?: string;

  // When this reference was last updated
  last_updated: string;
}
```

**Normative constraints**:
- `storage_endpoint` MUST be an internal URI (e.g., `phi://imaging/studies/{id}`), NEVER a public URL
- Clinical agents (Deutsch) MUST NOT attempt to fetch raw imaging data via `storage_endpoint`
- `description_redacted` MUST NOT include patient identifiers
- If present, `study_group_id` MUST be stable across all component studies from the same acquisition
- If present, `multi_modality_type` MUST be PHI-minimized (no patient identifiers)

#### 2.9.2 `DerivedImagingFinding` — Extracted findings (safe to include)

Derived findings are KB-sized extractions from imaging studies, produced by radiologists or imaging AI pipelines. These ARE safe to include in the snapshot.

```ts
export type ImagingFindingType =
  | 'measurement'       // Quantitative measurement (LVEF, tumor size, etc.)
  | 'classification'    // AI/radiologist classification (malignant/benign)
  | 'abnormality_flag'  // Binary abnormality detection
  | 'comparison'        // Comparison to prior imaging
  | 'structured_report';// Full DICOM SR summary

export type ImagingExtractor =
  | { type: 'radiologist'; provider_id?: string }
  | { type: 'ai_model'; model_id: string; model_version: string }
  | { type: 'automated'; system_id?: string };

export interface ImagingMeasurement {
  value: number;
  unit: string;                         // UCUM preferred (e.g., "mL", "mm", "%")
  reference_range?: {
    low?: number;
    high?: number;
    population?: string;                // e.g., "adult_male", "pediatric"
  };
  method?: string;                      // Measurement methodology
}

export interface ImagingClassification {
  label: string;                        // e.g., "malignant", "benign", "indeterminate"
  confidence: number;                   // 0.0-1.0
  model_id?: string;                    // If AI-derived
  alternative_labels?: Array<{
    label: string;
    confidence: number;
  }>;
}

export interface ImagingComparison {
  prior_study_id: string;
  comparison_type: 'improved' | 'stable' | 'worsened' | 'new_finding' | 'resolved';
  delta_value?: number;
  delta_unit?: string;
  notes?: string;
}

export interface DerivedImagingFinding {
  finding_id: string;

  // Which study this finding was derived from
  source_study: ImagingStudyRef;

  // Type of finding
  finding_type: ImagingFindingType;

  // Quantitative measurement (if applicable)
  measurement?: ImagingMeasurement;

  // Classification result (if applicable)
  classification?: ImagingClassification;

  // Anatomical location (SNOMED CT body site code preferred)
  body_site?: string;

  // Laterality if applicable
  laterality?: 'left' | 'right' | 'bilateral';

  // Clinical significance assessment
  clinical_significance?: 'normal' | 'abnormal' | 'critical' | 'indeterminate';

  // Comparison to prior imaging (if applicable)
  comparison?: ImagingComparison;

  // When this finding was extracted
  extracted_at: string;

  // Who/what extracted the finding
  extractor: ImagingExtractor;

  // Evidence grade for this finding
  // AI-derived findings typically: 'calculated'
  // Radiologist findings typically: 'expert_opinion' or 'case_report'
  evidence_grade: EvidenceGrade;

  // Overall confidence in this finding (0.0-1.0)
  confidence: number;

  // PHI-minimized notes
  notes_redacted?: string;
}
```

**Normative constraints**:
- `DerivedImagingFinding` MUST NOT exceed ~10 KB per finding
- `source_study` MUST reference a valid `ImagingStudyRef`
- AI-derived findings MUST include `extractor.model_id` and `extractor.model_version`
- Findings with `clinical_significance === 'critical'` SHOULD trigger escalation evaluation

#### 2.9.3 Imaging Message Types (InteropPayloadRef)

When using `InteropPayloadRef` (§6) for imaging interoperability:

```ts
// Extended message_type values for imaging
export type ImagingMessageType =
  | 'ImagingStudy'       // FHIR R4 ImagingStudy resource
  | 'DiagnosticReport'   // FHIR R4 DiagnosticReport (radiology report)
  | 'Observation'        // FHIR R4 Observation (imaging finding)
  | 'Media';             // FHIR R4 Media (key images, thumbnails)

// Extended InteropPayloadRef for imaging (see §6)
export interface ImagingInteropPayloadRef extends InteropPayloadRef {
  // DICOM StudyInstanceUID for cross-reference
  dicom_study_uid?: string;

  // Series references for selective retrieval
  series_refs?: Array<{
    series_uid: string;
    instance_count: number;
    modality?: ImagingModality;
  }>;
}
```

**FHIR Mapping**:

| Hermes Type | FHIR R4 Resource | Notes |
|-------------|------------------|-------|
| `ImagingStudyRef` | `ImagingStudy` | References via `ImagingStudy.endpoint[0]` → `Endpoint.address` (flattened into `storage_endpoint`) |
| `DerivedImagingFinding` | `Observation` | `derivedFrom` → `ImagingStudy` |
| Radiology report | `DiagnosticReport` | Contains `Observation[]` findings |

## 3) The Supervision Contract (Deutsch ↔ Popper)

### 3.1 Decision vocabulary

```ts
export type SupervisionDecision =
  | 'APPROVED'
  | 'HARD_STOP'
  | 'ROUTE_TO_CLINICIAN'
  | 'REQUEST_MORE_INFO';
```

### 3.2 Reason codes (for audit + dashboards)

```ts
export type ReasonCode =
  | 'schema_invalid'
  | 'policy_violation'
  | 'insufficient_evidence'
  | 'high_uncertainty'
  | 'data_quality_warning' // Data integrity incomplete but not schema-invalid (e.g., missing estimated_size_bytes with imaging)
  | 'patient_acuity_high'
  | 'risk_too_high'
  | 'drift_suspected'
  | 'needs_human_review'
  | 'approved_with_constraints'
  | 'low_htv_score'        // Proposal explanation is "easy to vary" (HTV < threshold)
  | 'weak_evidence_grade'  // Evidence grade below threshold for proposal type
  | 'snapshot_stale'       // Snapshot exceeds staleness threshold (Popper is authoritative)
  | 'snapshot_missing'     // No snapshot provided
  | 'other';

// ═══════════════════════════════════════════════════════════════════════════
// REQUIRED ACTION (when Popper needs Brain/Gateway to do something)
// ═══════════════════════════════════════════════════════════════════════════

export type RequiredActionKind =
  | 'refresh_snapshot'      // Snapshot is stale, Brain should refresh and retry
  | 'provide_evidence'      // Missing evidence refs, Brain should provide
  | 'clarify_intent'        // Unclear proposal, Brain should clarify
  | 'other';

export interface RequiredAction {
  kind: RequiredActionKind;
  details: {
    // For refresh_snapshot
    current_age_hours?: number;
    threshold_hours?: number;
    snapshot_id?: string;

    // For provide_evidence
    missing_evidence_types?: string[];

    // Generic
    message?: string;
  };
}
```

**Reason code taxonomy note (normative):**
- `ReasonCode` values are intentionally coarse to keep dashboards stable across deployments.
- For integrity/replay/snapshot/security failure classification, deployments MUST emit `AuditEvent` records with PHI-minimized tags as defined in:
  - `03-hermes-specs/03-hermes-deployment-security.md`

### 3.3 Proposed interventions (what Deutsch is asking to do)

Hermes defines **structured proposals** so Popper can evaluate them quickly.

Important:
- Proposals may include sensitive details needed for supervision.
- The contract therefore includes an **audit_redaction** section per proposal.

```ts
export type ProposedInterventionKind =
  | 'CARE_NAVIGATION'               // scheduling, logistics, reminders
  | 'TRIAGE_ROUTE'                  // route to care team/clinician with a reason
  | 'MEDICATION_ORDER_PROPOSAL'     // propose a medication order change (clinical mode only)
  | 'PATIENT_MESSAGE'               // what will be shown to the patient
  | 'LIFESTYLE_MODIFICATION_PROPOSAL'  // physical activity, sleep, stress management
  | 'NUTRITION_PLAN_PROPOSAL'       // dietary modifications, meal planning
  | 'BEHAVIORAL_INTERVENTION_PROPOSAL' // behavioral health, adherence support
  | 'OTHER';                        // escape hatch for future proposal types without breaking the contract

export interface ProposedInterventionBase {
  proposal_id: string;
  kind: ProposedInterventionKind;
  created_at: string;

  // Optional: proposals that share a group id MUST be treated atomically.
  // Popper MUST NOT partially approve within a group; Deutsch MUST NOT execute a partial group.
  interdependency_group_id?: string;

  // Deutsch self-assessment (Popper does not have to trust it)
  deutsch_risk_estimate?: {
    level: 'low' | 'medium' | 'high' | 'critical';
    notes?: string;
  };

  evidence_refs?: EvidenceRef[];
  disclosure?: DisclosureBundle;

  // === EPISTEMOLOGICAL ENHANCEMENT (see 04-hermes-epistemological-types.md) ===

  // Classification of the underlying claim
  // MUST be populated in advocate_clinical mode for all proposals
  claim_type?: ClaimType;

  // Hard-to-Vary score measuring explanation quality
  // MUST be populated in advocate_clinical mode for high-risk proposal types:
  //   - MEDICATION_ORDER_PROPOSAL
  //   - TRIAGE_ROUTE with urgency 'urgent'
  //   - Any proposal with deutsch_risk_estimate.level in ['high', 'critical']
  // SHOULD be populated for all other proposals in advocate_clinical mode
  htv_score?: HTVScore;

  // What would refute this recommendation?
  // SHOULD be populated for high-risk claim types (treatment_rec, diagnosis, prognosis)
  falsification_criteria?: FalsificationCriteria;

  // Calibrated uncertainty with algorithm-based scoring
  // SHOULD be populated; if absent, Popper SHOULD treat as 'high' uncertainty
  uncertainty_calibration?: UncertaintyCalibration;

  // REQUIRED: redacted representation safe(ish) for most logs.
  audit_redaction: {
    summary: string; // MUST NOT include direct identifiers (name, email, phone, address)
  };
}

export interface CareNavigationProposal extends ProposedInterventionBase {
  kind: 'CARE_NAVIGATION';
  action: 'schedule_appointment' | 'reschedule_appointment' | 'send_reminder' | 'other';
  details?: {
    // Keep brief and avoid PHI if possible; if PHI is needed, put in snapshot and reference it.
    note?: string;
  };
}

export interface TriageRouteProposal extends ProposedInterventionBase {
  kind: 'TRIAGE_ROUTE';
  urgency: 'routine' | 'soon' | 'urgent';
  route_to: 'care_team' | 'cardiologist' | 'primary_care' | 'emergency';
  reason: string;
}

export interface MedicationOrderProposal extends ProposedInterventionBase {
  kind: 'MEDICATION_ORDER_PROPOSAL';

  // NOTE: This may be PHI. It is included because Popper may need it to evaluate safety.
  // Implementations MUST NOT log these fields without explicit redaction.
  medication: {
    name: string;                // e.g. "lisinopril"
    rxnorm_code?: string;
  };
  change: {
    change_type: 'start' | 'stop' | 'titrate' | 'hold';
    from_dose?: string;          // e.g. "10 mg daily"
    to_dose?: string;            // e.g. "20 mg daily"
  };

  // Governance constraint: required for regulated mode actions.
  clinician_protocol_ref?: string; // pointer to approved protocol/order set
}

export interface PatientMessageProposal extends ProposedInterventionBase {
  kind: 'PATIENT_MESSAGE';
  message_markdown: string;
}

export interface OtherProposal extends ProposedInterventionBase {
  kind: 'OTHER';
  other_kind: string; // e.g. "NUTRITION_SUPPORT", "VIRTUAL_PT", "DOC_AUTOMATION"

  // Optional extension payload. Treat as potentially sensitive; do not log without redaction.
  payload?: Record<string, unknown>;
}

export type ProposedIntervention =
  | CareNavigationProposal
  | TriageRouteProposal
  | MedicationOrderProposal
  | PatientMessageProposal
  | OtherProposal;
```

### 3.3.1 Cross-Domain Conflict Types (Multi-Domain Composition)

When Deutsch uses multi-domain composition (see `../01-deutsch-specs/04-multi-domain-composition-spec.md`), it surfaces cross-domain conflicts to Popper for independent evaluation.

```ts
// Resolution strategies for cross-domain conflicts
export type ResolutionStrategy =
  | 'override'      // One domain's recommendation wins completely
  | 'constrain'     // Modify recommendation with limits/adjustments
  | 'merge'         // Combine compatible parts of recommendations
  | 'sequence'      // Time-order the recommendations
  | 'escalate';     // Cannot auto-resolve; requires clinician

// Domain categories are informational (NOT a priority hierarchy).
// Deployments SHOULD prefer the core set below for consistency; if a domain does not fit, use `other`.
export type DomainCategory =
  | 'clinical'
  | 'lifestyle'
  | 'behavioral'
  | 'preventive'
  | 'rehabilitative'
  | 'other';

// Cross-domain conflict representation
export interface CrossDomainConflict {
  conflict_id: string;

  // Conflict classification (extensible, not a closed enum)
  // Core types: drug_nutrient_interaction, drug_activity_contraindication,
  // condition_nutrient_restriction, condition_activity_restriction,
  // temporal_scheduling, resource_competition, guideline_disagreement,
  // uncertainty_propagation
  conflict_type: string;

  // Which rule detected this conflict
  triggering_rule: {
    rule_id: string;
    rule_source: string;      // Registry URI
    rule_version: string;
  };

  // Which domains conflicted
  conflicting_domains: string[];  // domain_ids

  // Which proposals were involved
  conflicting_proposal_ids: string[];

  // What each domain originally proposed (before resolution)
  original_proposals: Record<string, string>;  // domain_id → original recommendation

  // How the conflict was resolved
  resolution_strategy: ResolutionStrategy;

  // The merged/modified proposal (absent if escalate)
  resolved_proposal_id?: string;

  // Confidence in the resolution
  resolution_confidence: 'low' | 'medium' | 'high';

  // Evidence supporting the resolution
  evidence_refs: EvidenceRef[];

  // Uncertainty assessment
  uncertainty: {
    level: UncertaintyLevel;
    notes?: string;
  };

  // PHI-safe audit form
  audit_redaction: {
    summary: string;  // e.g., "Drug-nutrient interaction resolved by dietary constraint"
  };
}

// Domain contribution tracking
export interface ContributingDomain {
  domain_id: string;
  domain_version: string;
  domain_category: DomainCategory;
  status: 'success' | 'degraded' | 'failed';
  failure_reason?: string;

  // Which proposals came from this domain
  proposal_ids: string[];

  // Data quality for this domain
  data_quality?: {
    staleness_seconds: number;
    missing_signals: string[];
    conflicting_signals: string[];
  };
}

// Composition metadata for audit and reproducibility
export interface CompositionMetadata {
  composer_version: string;

  // Which registries were loaded
  registries_loaded: Array<{
    registry_ref: string;
    registry_version: string;
    rule_count: number;
  }>;

  // Computed priorities at time of composition
  priority_snapshot: Record<string, number>;  // domain_id → priority

  // Rule engine health
  rule_engine_status: 'healthy' | 'degraded' | 'failed';
}
```

**Normative constraints (multi-domain composition):**

- **Presence coupling**: when Deutsch uses multi-domain composition, it MUST include all of:
  - `cross_domain_conflicts` (MAY be an empty array)
  - `contributing_domains`
  - `composition_metadata`
  This prevents ambiguity about whether conflict detection was executed.

- **Conflict referential integrity**:
  - Every `CrossDomainConflict.conflicting_proposal_ids[]` MUST reference a `proposal_id` present in `SupervisionRequest.proposals[]`.
  - If `resolved_proposal_id` is present, it MUST reference a `proposal_id` present in `SupervisionRequest.proposals[]`.

- **Resolution invariants**:
  - If `resolution_strategy === "escalate"`:
    - `resolved_proposal_id` MUST be absent.
    - `resolution_confidence` SHOULD be `"low"`.
  - `evidence_refs` MUST be non-empty for safety-relevant conflicts (recommended default: all conflicts).

- **Domain contribution disclosure**:
  - `contributing_domains[]` MUST include every domain module that attempted to participate in composition (including failed ones), with `status` and (if failed/degraded) `failure_reason` populated.

### 3.4 `supervision_request`

```ts
export interface SupervisionRequest {
  hermes_version: HermesVersion;
  message_type: 'supervision_request';

  trace: TraceContext;
  mode: Mode;
  subject: SubjectRef;
  snapshot: HealthStateSnapshotRef;

  // Optional inline snapshot payload for deployments where Popper cannot (or should not) fetch snapshots via `snapshot_uri`.
  // If present, this MUST be the exact JSON payload whose bytes are hashed for `snapshot.snapshot_hash` (see §2.5.1).
  snapshot_payload?: Record<string, unknown>;

  // Replay protection / request binding.
  // Required in advocate_clinical deployments; recommended elsewhere.
  idempotency_key?: string;     // UUID/ULID stable across retries
  request_timestamp?: string;   // ISO-8601 UTC (use for clock skew + safe-mode effective checks)

  // Optional PHI-minimized risk flags about the inputs used to produce proposals.
  // This enables Popper to be conservative when multimodal inputs may be compromised.
  input_risk?: {
    attachments_present?: boolean;
    flags?: Array<'phi_detected' | 'prompt_injection_suspected' | 'malware_suspected' | 'other'>;
    notes?: string; // brief; MUST NOT include direct identifiers
  };

  // What Deutsch wants to do now.
  proposals: ProposedIntervention[];

  // Optional free-text notes (SHOULD be brief; avoid PHI if possible)
  notes?: string;

  // ═══════════════════════════════════════════════════════════════════
  // MULTI-DOMAIN COMPOSITION FIELDS (optional, present when composing)
  // See ../01-deutsch-specs/04-multi-domain-composition-spec.md
  // ═══════════════════════════════════════════════════════════════════

  // Cross-domain conflicts detected and (proposed) resolutions.
  // Popper evaluates these for independent oversight of cross-domain reasoning.
  cross_domain_conflicts?: CrossDomainConflict[];

  // Which domain modules contributed to this request.
  contributing_domains?: ContributingDomain[];

  // Composition metadata for audit and reproducibility.
  composition_metadata?: CompositionMetadata;

  // ═══════════════════════════════════════════════════════════════════
  // CLINICIAN FEEDBACK CONTEXT (optional, for case reassessment)
  // See §4.2-4.3 for full type definitions
  // See ../01-deutsch-specs/01-deutsch-system-spec.md §6.5 for usage
  // ═══════════════════════════════════════════════════════════════════

  // Relevant prior overrides for this patient (PHI-minimized).
  // Deutsch includes this when prior clinician feedback may be relevant.
  relevant_prior_overrides?: Array<{
    original_trace_id: string;
    action: ClinicianAction;
    rationale_summary: string;         // REQUIRED
    rationale_category: RationaleCategory;
    confidence?: 'low' | 'medium' | 'high';
    clinician_role?: 'attending' | 'specialist' | 'primary_care' | 'nurse_practitioner' | 'physician_assistant' | 'other';
    applies_to?: {
      medication_class?: string;
      medication_specific?: string;
      intervention_kind?: ProposedInterventionKind;
    };
    age_days: number;                  // How old is this override?
    is_permanent?: boolean;
  }>;

  // Conflict summary if there are unresolved clinician disagreements.
  unresolved_override_conflicts?: Array<{
    conflict_id: string;
    conflict_type: 'reversal' | 'disagreement';
    affected_intervention_kinds: ProposedInterventionKind[];
    override_trace_ids?: string[];      // The conflicting feedback trace_ids
    conflict_summary?: string;          // Human-readable conflict description
    requires_attending_resolution?: boolean; // Does this need attending review?
    recommended_action?: string;        // Suggested resolution action
  }>;

  // Alert fatigue indicators.
  feedback_metrics?: {
    override_rate_30d: number;         // 0.0-1.0
    override_rate_trend: 'increasing' | 'stable' | 'decreasing';
    avg_response_time_seconds?: number;
    // Optional: structured alert fatigue indicators for richer analysis
    alert_fatigue_indicators?: {
      rapid_responses: boolean;        // avg response time < threshold (e.g., 30s)
      low_confidence_rejections: boolean; // Many rejections with low confidence
      pattern_detected?: string;       // Human-readable summary of detected pattern
    };
  };

  // Redacted form safe(ish) for general logs.
  audit_redaction: {
    summary: string;
    proposal_summaries: string[];
  };
}
```

#### 3.4.1 Replay protection semantics (normative)

In `advocate_clinical` mode:

- `idempotency_key` and `request_timestamp` MUST be present.
- Receivers MUST enforce clock-skew tolerance for `request_timestamp` (see §1.2.1).
- Snapshot access MUST be available to the verifier (Popper), via at least one of:
  - `snapshot.snapshot_uri` present and resolvable within the deployment boundary, OR
  - `snapshot_payload` present inline.
  - If `snapshot_payload` is present, `snapshot.snapshot_hash` MUST be present so the verifier can recompute and compare.
- Popper SHOULD implement idempotency:
  - if the same `idempotency_key` is received again within a short replay window (default: **5 minutes**):
    - if the request payload is identical (after canonicalization), Popper SHOULD return the previously computed `SupervisionResponse`
    - if the request payload differs, Popper MUST treat it as unsafe (default: `HARD_STOP` with `reason_codes` including `policy_violation`)
- Popper SHOULD echo `request_idempotency_key` on the response. Deutsch SHOULD verify it matches the request it sent.

### 3.5 `supervision_response`

```ts
export interface SupervisionResponse {
  hermes_version: HermesVersion;
  message_type: 'supervision_response';

  trace: TraceContext;
  mode: Mode;
  subject: SubjectRef;
  snapshot: HealthStateSnapshotRef;

  // Request binding (echo fields, if provided on the request).
  request_idempotency_key?: string;
  response_timestamp?: string; // ISO-8601 UTC

  decision: SupervisionDecision;
  reason_codes: ReasonCode[];
  explanation: string;                 // human-readable; may be shown to clinicians

  // Required action when decision is REQUEST_MORE_INFO or certain ROUTE_TO_CLINICIAN cases.
  // Brain/Gateway is responsible for handling this action.
  required_action?: RequiredAction;

  // Optional constraints if approved
  approved_constraints?: {
    must_route_after?: string;         // ISO time, e.g. "if not resolved by X, route"
    allowed_actions?: ProposedInterventionKind[];
  };

  // Control plane hooks (Popper can modify settings/safe-mode)
  control_commands?: ControlCommand[];

  // Optional: bind decision to the safe-mode state used at evaluation time (for audits).
  safe_mode_state_used?: {
    enabled: boolean;
    effective_at?: string;
    effective_until?: string;
  };

  // ═══════════════════════════════════════════════════════════════════
  // MULTI-DOMAIN COMPOSITION FIELDS (optional, present when applicable)
  // ═══════════════════════════════════════════════════════════════════

  // Per-proposal decisions when Popper decides differently for different proposals.
  // Used for partial approval scenarios in multi-domain composition.
  // If absent, the top-level `decision` applies to all proposals.
  per_proposal_decisions?: Array<{
    proposal_id: string;
    decision: SupervisionDecision;
    reason_codes: ReasonCode[];
    explanation?: string;
  }>;

  // Conflict evaluation results (when cross_domain_conflicts were present on request)
  conflict_evaluations?: Array<{
    conflict_id: string;
    popper_agrees_with_resolution: boolean;
    override_decision?: SupervisionDecision;  // If Popper overrides Deutsch's resolution
    override_reason?: string;
  }>;

  audit_redaction: {
    summary: string;
    decision: SupervisionDecision;
    reason_codes: ReasonCode[];
  };
}
```

#### 3.5.1 Per-proposal decision semantics (normative)

- If `per_proposal_decisions` is present, Popper MUST include **one entry per** `proposal_id` in the corresponding `SupervisionRequest.proposals[]` (complete coverage).
- The top-level `decision` MUST equal the **most conservative** per-proposal decision:
  - `HARD_STOP` > `ROUTE_TO_CLINICIAN` > `REQUEST_MORE_INFO` > `APPROVED`
- If any `ProposedIntervention.interdependency_group_id` is present on the request:
  - Popper MUST NOT partially approve within that group (all proposals in the same group MUST have the same per-proposal `decision`).
  - Deutsch MUST treat any partial-group decision as unsafe (default: do not execute any proposal in the group; route/escalate).

#### 3.5.2 Conflict evaluation semantics (normative)

- If the request included `cross_domain_conflicts`, Popper SHOULD return `conflict_evaluations` for each conflict (at minimum, for any conflict Popper disagrees with).
- `conflict_evaluations` are **explanatory**. Any override MUST be reflected in `decision` and/or `per_proposal_decisions`; consumers MUST NOT treat `conflict_evaluations` alone as permission to execute.

### 3.6 `control_command` (Popper → Deutsch)

```ts
export type ControlCommandKind =
  | 'SET_SAFE_MODE'
  | 'SET_OPERATIONAL_SETTING';

export interface ControlCommand {
  command_id: string;
  kind: ControlCommandKind;
  created_at: string;

  // For SET_SAFE_MODE
  safe_mode?: {
    enabled: boolean;
    reason: string;
    effective_at?: string;
    effective_until?: string;
  };

  // For SET_OPERATIONAL_SETTING
  setting?: {
    key: string;     // e.g. "max_autonomy_level"
    value: string;   // stringly typed for v1; can become typed later
  };

  audit_redaction: {
    summary: string;
  };
}
```

### 3.7 Example JSON (request/response)

#### Example: `SupervisionRequest` (simplified)

```json
{
  "hermes_version": "1.6.0",
  "message_type": "supervision_request",
  "trace": {
    "trace_id": "2f4a5f2a-4c3a-4d3f-9c60-1c9e2c7a9f11",
    "created_at": "2026-01-23T13:00:00.000Z",
    "producer": {
      "system": "deutsch",
      "service_version": "deutsch-1.0.0",
      "ruleset_version": "cvd-spec-0.1.0",
      "model_version": "gpt-5.2"
    }
  },
  "idempotency_key": "01J0Y4K0P5GQ2Z8Z4W3C9Q9G7Q",
  "request_timestamp": "2026-01-23T13:00:00.000Z",
  "mode": "advocate_clinical",
  "subject": { "subject_type": "patient", "subject_id": "anon_8f2c...", "organization_id": "org_ta3_alpha" },
  "snapshot": {
    "snapshot_id": "snap_123",
    "snapshot_hash": "m8hP4l9Qyq9w9n0qB8p0bKqH0a7lq9hY2uT5h6k1e2c=",
    "created_at": "2026-01-23T12:59:40.000Z",
    "sources": ["ehr", "wearable"],
    "snapshot_uri": "phi://snapshots/snap_123"
  },
  "proposals": [
    {
      "proposal_id": "prop_1",
      "kind": "MEDICATION_ORDER_PROPOSAL",
      "created_at": "2026-01-23T13:00:00.000Z",
      "medication": { "name": "lisinopril" },
      "change": { "change_type": "titrate", "from_dose": "10 mg daily", "to_dose": "20 mg daily" },
      "clinician_protocol_ref": "protocol://org_ta3_alpha/cvd/hf-guideline-directed-med-optimization/v1.0.0",
      "audit_redaction": { "summary": "Propose medication change under approved protocol." }
    }
  ],
  "audit_redaction": {
    "summary": "Deutsch requests supervision for 1 proposed action.",
    "proposal_summaries": ["Propose medication change under approved protocol."]
  }
}
```

#### Example: `SupervisionResponse` (simplified)

```json
{
  "hermes_version": "1.6.0",
  "message_type": "supervision_response",
  "trace": {
    "trace_id": "2f4a5f2a-4c3a-4d3f-9c60-1c9e2c7a9f11",
    "created_at": "2026-01-23T13:00:00.050Z",
    "producer": {
      "system": "popper",
      "service_version": "popper-1.0.0",
      "ruleset_version": "popper-policy-0.3.0"
    }
  },
  "mode": "advocate_clinical",
  "subject": { "subject_type": "patient", "subject_id": "anon_8f2c...", "organization_id": "org_ta3_alpha" },
  "snapshot": { "snapshot_id": "snap_123", "created_at": "2026-01-23T12:59:40.000Z", "sources": ["ehr", "wearable"] },
  "request_idempotency_key": "01J0Y4K0P5GQ2Z8Z4W3C9Q9G7Q",
  "response_timestamp": "2026-01-23T13:00:00.050Z",
  "decision": "ROUTE_TO_CLINICIAN",
  "reason_codes": ["needs_human_review", "high_uncertainty"],
  "explanation": "Routing to clinician due to uncertainty and protocol boundary.",
  "safe_mode_state_used": { "enabled": false },
  "audit_redaction": {
    "summary": "Popper routed proposal to clinician.",
    "decision": "ROUTE_TO_CLINICIAN",
    "reason_codes": ["needs_human_review", "high_uncertainty"]
  }
}
```

## 4) Audit events (standard receipts)

Hermes MUST define a common audit envelope so systems can emit events that are joinable by `trace_id`.

```ts
export type AuditEventType =
  | 'SUPERVISION_REQUEST_SENT'
  | 'SUPERVISION_REQUEST_RECEIVED'
  | 'SUPERVISION_RESPONSE_DECIDED'
  | 'SUPERVISION_RESPONSE_RECEIVED'
  | 'CONTROL_COMMAND_ISSUED'
  | 'CONTROL_COMMAND_APPLIED'
  | 'SAFE_MODE_ENABLED'
  | 'SAFE_MODE_DISABLED'
  | 'OUTPUT_RETURNED'
  | 'VALIDATION_FAILED'
  | 'OTHER';

export interface AuditEvent {
  hermes_version: HermesVersion;
  message_type: 'audit_event';

  event_type: AuditEventType;
  other_event_type?: string; // REQUIRED if event_type === 'OTHER'
  occurred_at: string;

  trace: TraceContext;
  mode: Mode;
  subject: SubjectRef;

  // MUST be redacted/PHI-minimized.
  summary: string;

  // Optional structured tags for dashboards.
  tags?: Record<string, string>;
}
```

### 4.1 Audit event emission expectations (normative)

- If a system **issues** a `ControlCommand`, it MUST emit `CONTROL_COMMAND_ISSUED`.
- If a system **applies** a received `ControlCommand`, it MUST emit `CONTROL_COMMAND_APPLIED` (PHI-minimized), so auditors can reconstruct enforcement.
- For `VALIDATION_FAILED` events related to integrity/replay/snapshot failures, deployments SHOULD use `AuditEvent.tags` as defined in:
  - `03-hermes-specs/03-hermes-deployment-security.md`

### 4.2 Clinician Feedback Events

**Purpose:** Capture what happens AFTER `ROUTE_TO_CLINICIAN` decisions, enabling:
- Patient-specific case reassessment (NOT RLHF model training)
- Malpractice documentation with required rationale
- Alert fatigue detection via response time tracking
- Conflict resolution when multiple clinicians disagree
- Demographic bias monitoring per FDA AI/ML guidance

**Regulatory grounding:**
- FDA AI/ML TPLC requires post-market monitoring including feedback loops
- HIPAA 45 CFR 164.316(b) requires 6-year documentation retention (policies, procedures, and required records including feedback events)
- State disclosure laws (IL, TX eff. 2026, UT HB 452) require informed consent workflows
- Malpractice best practices require documentation of clinician agree/disagree decisions

#### 4.2.1 `ClinicianAction` — Decision vocabulary

```ts
export type ClinicianAction =
  | 'accepted'           // Clinician approved Deutsch's proposal as-is
  | 'modified'           // Clinician modified the proposal
  | 'rejected'           // Clinician rejected the proposal
  | 'deferred';          // Clinician deferred decision (needs more info)
```

#### 4.2.2 `RationaleCategory` — Structured override categories

Categories are based on malpractice documentation best practices and real-world override patterns.

```ts
export type RationaleCategory =
  | 'contraindication'         // Medical contraindication identified
  | 'drug_interaction'         // Drug-drug or drug-condition interaction
  | 'patient_preference'       // Patient preference consideration
  | 'clinical_judgment'        // Clinician experience/judgment
  | 'missing_context'          // Important context was missing from snapshot
  | 'protocol_not_applicable'  // Protocol doesn't apply to this patient
  | 'demographic_consideration'// Age/weight/renal function not suitable
  | 'recent_adverse_event'     // Patient had adverse event to similar treatment
  | 'comorbidity_conflict'     // Conflicts with another condition
  | 'insurance_formulary'      // Insurance/formulary constraint (non-clinical)
  | 'other';
```

#### 4.2.3 `ClinicianFeedbackEvent` — Full event type

```ts
export interface ClinicianFeedbackEvent {
  hermes_version: HermesVersion;
  message_type: 'clinician_feedback';

  // Link to the original supervision flow
  trace: TraceContext;
  mode: Mode;
  subject: SubjectRef;

  // Reference to the original proposal that was routed
  original_trace_id: string;           // The supervision request trace_id
  original_proposal_id: string;        // Which proposal was reviewed
  snapshot_ref: HealthStateSnapshotRef; // Snapshot at time of original proposal

  // Clinician's decision
  action: ClinicianAction;
  occurred_at: string;                 // When clinician made decision
  response_time_seconds?: number;      // Time from alert to decision (for alert fatigue analysis)

  // === CLINICIAN IDENTITY (for conflict resolution & audit) ===
  clinician_ref: {
    clinician_id: string;              // Pseudonymous ID (NOT name/NPI in audit)
    role: 'attending' | 'specialist' | 'primary_care' | 'nurse_practitioner' | 'physician_assistant' | 'other';
    specialty?: string;                // e.g., "cardiology", "nephrology"
  };

  // === RATIONALE (critical for malpractice documentation) ===
  // REQUIRED (not optional) per liability best practices
  rationale: {
    summary: string;                   // Brief explanation (MUST NOT include direct identifiers)
    category: RationaleCategory;       // Structured category for analytics
    subcategory?: string;              // Free-text subcategory
    confidence: 'low' | 'medium' | 'high'; // How confident is clinician in this decision?
    guideline_refs?: EvidenceRef[];    // Evidence supporting clinician's decision
    // Structured fields for specific categories
    contraindication_details?: {
      condition_code?: string;         // ICD-10 or SNOMED
      severity: 'relative' | 'absolute';
    };
  };

  // What clinician actually did (if modified)
  modified_action?: {
    intervention_kind: ProposedInterventionKind;
    summary: string;                   // PHI-minimized description of actual action
    // For medication changes
    medication_change?: {
      original_proposal_summary: string;
      actual_action_summary: string;   // e.g., "Prescribed alternative: metoprolol instead of lisinopril"
      reason_for_alternative?: string; // Why this alternative?
    };
  };

  // === SCOPE OF APPLICABILITY ===
  applies_to?: {
    medication_class?: string;         // e.g., "ACE_INHIBITOR" — this patient shouldn't get this class
    medication_specific?: string;      // Specific drug (e.g., "lisinopril") vs class
    intervention_kind?: ProposedInterventionKind;
    valid_until?: string;              // ISO date — when to re-evaluate (REQUIRED unless is_permanent)
    is_permanent?: boolean;            // Permanent patient-specific contraindication
    re_evaluation_trigger?: string;    // What would trigger re-evaluation (e.g., "new renal function test")
  };

  // === CONFLICT DETECTION (when multiple clinicians disagree) ===
  conflicts_with_prior_feedback?: {
    prior_trace_id: string;            // Previous feedback that this contradicts
    prior_action: ClinicianAction;
    conflict_type: 'reversal' | 'escalation' | 'disagreement';
    resolution_note?: string;          // How was conflict resolved?
  };

  // === DEMOGRAPHIC CONTEXT (for bias monitoring per FDA requirements) ===
  demographic_context?: {
    age_group?: 'pediatric' | 'adult' | 'geriatric';
    relevant_demographics?: string[];  // e.g., ["chronic_kidney_disease", "heart_failure"]
    // NOTE: NOT direct demographics (race/ethnicity) - only clinical factors
  };

  // PHI-minimized audit form (HIPAA 6-year retention)
  audit_redaction: {
    summary: string;
    action: ClinicianAction;
    category: RationaleCategory;
    response_time_bucket?: '<1min' | '1-5min' | '5-15min' | '15-60min' | '>60min';
  };
}
```

**Normative constraints:**
- `rationale` is REQUIRED (not optional) — critical for malpractice defense
- `rationale.summary` MUST NOT include direct identifiers (name, email, phone, address)
- Events MUST be retained for at least 6 years to support compliance documentation and clinical governance (HIPAA documentation retention: 45 CFR 164.316(b)); jurisdictions or organizational policy may require longer retention
- `response_time_seconds` SHOULD be populated for alert fatigue analysis
- If `conflicts_with_prior_feedback` is present, Deutsch MUST route to clinician for resolution

#### 4.2.4 Event emission requirements

When Deutsch learns of a clinician decision (via TA3 integration):
- Deutsch MUST emit a `ClinicianFeedbackEvent`
- Event MUST link to original `trace_id` and `proposal_id`
- Event MUST be PHI-minimized per §1.4
- Systems receiving the event SHOULD update `prior_clinician_overrides` in the patient's snapshot

### 4.3 `ClinicianOverrideHistory` — Patient-specific override context

**Purpose:** Enable Deutsch and Popper to consume prior clinician overrides for patient-specific case reassessment. This is DISTINCT from RLHF (model training) — it is patient-specific context.

```ts
export interface ClinicianOverrideHistory {
  // Summary counts for quick checks
  total_overrides: number;
  recent_overrides_30d: number;

  // Alert fatigue indicators (per FDA drift monitoring requirements)
  override_rate_trend?: 'increasing' | 'stable' | 'decreasing';

  // Active overrides that may affect current reasoning
  active_overrides: Array<{
    original_trace_id: string;
    action: ClinicianAction;
    occurred_at: string;
    clinician_role?: 'attending' | 'specialist' | 'primary_care' | 'nurse_practitioner' | 'physician_assistant' | 'other';
    clinician_specialty?: string;
    rationale_summary: string;         // REQUIRED (not optional)
    rationale_category: RationaleCategory;
    confidence?: 'low' | 'medium' | 'high';
    applies_to?: {
      medication_class?: string;
      medication_specific?: string;
      intervention_kind?: ProposedInterventionKind;
    };
    valid_until?: string;
    is_permanent?: boolean;
    re_evaluation_trigger?: string;

    // Conflict markers
    has_conflicting_feedback?: boolean; // Another clinician disagreed
    most_recent_wins?: boolean;         // If conflicting, is this the authoritative one?
  }>;

  // === CONFLICT SUMMARY ===
  // When multiple clinicians have given conflicting feedback
  unresolved_conflicts?: Array<{
    conflict_id: string;
    override_trace_ids: string[];       // The conflicting feedback trace_ids
    conflict_type: 'reversal' | 'disagreement';
    requires_resolution: boolean;       // Does this need attending/specialist review?
    recommended_action?: string;        // Suggested resolution
  }>;

  // === CARE CONTINUITY METADATA ===
  // For clinical handoffs (per IOM safety recommendations)
  last_handoff?: {
    occurred_at: string;
    from_organization_id?: string;
    to_organization_id?: string;
    overrides_transferred: number;
    notes?: string;
  };
}
```

**Normative constraints:**
- `rationale_summary` in `active_overrides[]` is REQUIRED (not optional) per malpractice documentation best practices
- `unresolved_conflicts[]` MUST be surfaced until explicitly resolved by attending physician
- `last_handoff` SHOULD be populated when patient transfers between organizations
- Override history MUST be PHI-minimized (no direct identifiers)

**Override decay semantics (informational — see Deutsch spec §6.5.4 for normative behavior):**
- 0-90 days: Full weight (1.0)
- 91-180 days: Declining weight (0.9 → 0.5)
- >180 days: Informational only (weight 0.3), recommend re-evaluation
- If `confidence === 'high'`: Extend all thresholds by 90 days

#### 4.3.1 Size bounds for `prior_clinician_overrides` (normative)

To prevent snapshot bloat and maintain performance:

- `active_overrides[]` SHOULD NOT exceed **50 entries** per patient
  - If more than 50 exist, include the 50 most recent + all permanent overrides
  - Older non-permanent overrides MAY be archived to long-term storage
- `unresolved_conflicts[]` SHOULD NOT exceed **10 entries**
  - If more than 10 exist, escalate immediately (likely systemic issue)
- `rationale_summary` SHOULD NOT exceed **500 characters**
- Total `prior_clinician_overrides` object SHOULD NOT exceed **50 KB**

Deployments MAY configure stricter limits per TA3 site integration profile.

#### 4.3.2 Override matching semantics (normative)

When Deutsch or Popper evaluates whether a prior override applies to a current proposal:

**Medication class matching:**
- `applies_to.medication_class` uses standardized class names (e.g., `ACE_INHIBITOR`, `BETA_BLOCKER`)
- Implementations SHOULD map from RxNorm codes to ATC/EPC therapeutic classes
- A proposal matches if its medication belongs to the specified class

**Medication-specific matching:**
- `applies_to.medication_specific` uses RxNorm codes when available
- Exact RxNorm match takes precedence over class match
- If RxNorm unavailable, use normalized drug name (lowercase, no salt forms)

**Intervention kind matching:**
- `applies_to.intervention_kind` matches `ProposedIntervention.kind` exactly
- `OTHER` proposals match if `other_kind` equals a stored intervention identifier

**Match precedence:**
1. Exact medication + exact patient → strongest match
2. Medication class + exact patient → strong match
3. Intervention kind + exact patient → moderate match
4. Any match with `is_permanent === true` → always applies regardless of age

### 4.4 Bias Detection Events

**Purpose:** First-class message type for demographic bias detection per FDA AI/ML post-market surveillance requirements. Enables structured reporting of bias patterns in clinician override behavior.

```ts
export interface BiasDetectionEvent {
  hermes_version: HermesVersion;
  message_type: 'bias_detection';

  trace: TraceContext;
  mode: Mode;

  // Organization scope (NOT patient-specific)
  organization_id: string;

  // Detection metadata
  detection_id: string;
  detection_type: 'demographic_override_disparity' | 'intervention_type_bias' | 'clinician_specialty_bias' | 'other';
  severity: 'info' | 'warning' | 'critical';
  detected_at: string;              // ISO datetime

  // Analysis period
  analysis_period: {
    start: string;                  // ISO datetime
    end: string;                    // ISO datetime
    days: number;
  };

  // What dimension showed bias
  affected_dimension: {
    dimension_type: 'age_group' | 'intervention_kind' | 'medication_class' | 'clinician_specialty' | 'other';
    dimension_value: string;        // e.g., "geriatric", "ACE_INHIBITOR"
  };

  // Statistical metrics
  metrics: {
    overall_override_rate: number;           // 0.0-1.0
    affected_group_override_rate: number;    // 0.0-1.0
    control_group_override_rate: number;     // 0.0-1.0
    rate_difference: number;                 // Absolute difference
    rate_ratio: number;                      // Ratio (affected / control)
    sample_size_affected: number;
    sample_size_control: number;
    statistical_significance?: {
      p_value?: number;
      confidence_interval_95?: [number, number];
      is_significant: boolean;
    };
  };

  // Breakdown by rationale category
  breakdown_by_category?: Array<{
    rationale_category: RationaleCategory;
    override_count: number;
    percentage: number;             // 0.0-1.0
  }>;

  // Affected intervention types
  affected_intervention_kinds?: Array<{
    kind: ProposedInterventionKind;
    override_rate: number;          // 0.0-1.0
  }>;

  // Recommendations for remediation
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    action: 'review_proposal_logic' | 'increase_clinician_routing' | 'model_recalibration' | 'training_data_review' | 'other';
    description: string;
  }>;

  // Regulatory context
  regulatory_context?: {
    fda_requirement?: string;       // e.g., "Post-market surveillance for demographic bias"
    guidance_reference?: string;    // e.g., "FDA AI/ML Guidance 2025, Section 4.3"
    reporting_required: boolean;
    reporting_deadline_days?: number;
  };

  // PHI-minimized audit form
  audit_redaction: {
    summary: string;
    detection_type: string;
    severity: string;
    affected_dimension: string;     // e.g., "age_group:geriatric"
    rate_difference: string;        // e.g., "18%"
    recommendations_count: number;
  };
}
```

**Normative constraints:**
- BiasDetectionEvent MUST be organization-scoped, NOT patient-specific
- `metrics.sample_size_affected` and `metrics.sample_size_control` MUST both be >= 30 for statistical validity
- If `severity === 'critical'`, the event SHOULD trigger safe-mode consideration for affected intervention types
- Events MUST be retained per FDA post-market surveillance requirements (typically 2 years minimum)

#### 4.4.1 Bias detection thresholds (informational)

Recommended detection thresholds (deployments MAY adjust per policy):
- `rate_difference >= 0.15` (15% absolute difference) → severity: `warning`
- `rate_difference >= 0.25` (25% absolute difference) → severity: `critical`
- `rate_ratio >= 1.5` (50% higher) → severity: `warning`
- `rate_ratio >= 2.0` (100% higher) → severity: `critical`

### 4.5 Event Producer Trust Chain (normative)

**Purpose:** Establish authoritative sources for different event types to ensure integrity and prevent spoofing.

#### 4.5.1 Authoritative producers by message type

| Message Type | Authoritative Producer | Trust Requirement |
|--------------|----------------------|-------------------|
| `supervision_request` | `deutsch` | Signed or mTLS-authenticated |
| `supervision_response` | `popper` | Signed or mTLS-authenticated |
| `clinician_feedback` | `gateway` | Gateway translates from TA3 clinical system |
| `bias_detection` | `popper` | Popper aggregates and analyzes feedback |
| `audit_event` | Any (`deutsch`, `popper`, `gateway`) | Producer must match event context |

#### 4.5.2 ClinicianFeedbackEvent trust chain

For `ClinicianFeedbackEvent`:
1. **TA3 clinical system** (EHR, clinical workflow) captures clinician decision
2. **Hermes gateway** receives TA3 event and translates to Hermes format
3. **Gateway** emits `ClinicianFeedbackEvent` with `trace.producer.system = 'gateway'`
4. **Deutsch and Popper** consume the event as trusted clinical input

**Normative:**
- `ClinicianFeedbackEvent` MUST have `trace.producer.system === 'gateway'`
- Gateway MUST validate TA3 event authenticity before translating
- Deutsch and Popper SHOULD NOT emit `ClinicianFeedbackEvent` directly
- If a system other than gateway emits feedback, receivers SHOULD log a warning and MAY reject

#### 4.5.3 Integrity verification

For all clinician feedback in `advocate_clinical` mode:
- Gateway SHOULD include `trace.signature` on `ClinicianFeedbackEvent`
- Receivers MAY verify signature before trusting feedback for case reassessment
- If signature verification fails, receivers SHOULD treat feedback as informational (not binding)

## 5) Error envelope (when rejecting messages)

```ts
export interface HermesError {
  hermes_version: HermesVersion;
  message_type: 'error';
  trace?: TraceContext;

  code: 'invalid_schema' | 'unsupported_version' | 'unauthorized' | 'rate_limited' | 'internal_error';
  message: string;
  details?: Record<string, unknown>;
}
```

## 6) Minimal interoperability types (FHIR/HL7 pointers)

ADVOCATE requires interoperability (FHIR + HL7v2) without forcing every consumer to embed full EHR payloads into Hermes messages.

Hermes therefore standardizes a **pointer-based** interop reference that can be mapped to FHIR/HL7 payloads stored in an appropriate PHI-approved system.

```ts
export type InteropStandard = 'FHIR_R4' | 'HL7V2' | 'OTHER';

export interface InteropPayloadRef {
  interop_id: string;
  standard: InteropStandard;
  content_type: string; // e.g. "application/fhir+json", "x-application/hl7-v2"
  message_type?: string; // e.g. "Task", "ServiceRequest", "ORU_R01"

  // Internal pointer to where the payload can be fetched in this deployment.
  // MUST NOT be a public URL.
  uri: string;

  // Optional integrity / reproducibility.
  content_hash?: string;

  audit_redaction: {
    summary: string; // PHI-minimized summary of what the interop payload represents
  };
}
```

### 6.1 Interop pointer fetch semantics (normative)

Hermes defines **pointers**, not a transport. However, consumers MUST not leave failure behavior ambiguous:

- **Fetch timeout**: any consumer that fetches `InteropPayloadRef.uri` MUST define a timeout (default: **2 seconds**) and MUST fail safely on timeout/error.
- **Integrity**: if `content_hash` is present and the payload is fetched, consumers SHOULD verify the hash using the same canonicalization guidance as §1.5.
- **Failure handling**:
  - when interop payloads are required to justify or validate a **high-risk** action, fetch failure SHOULD increase conservatism (route / request more info)
  - consumers MUST NOT treat missing interop payloads as “proof” of anything

## 7) Contract test fixtures (required)

Hermes MUST ship:
- `03-hermes-specs/fixtures/supervision_request.valid.json`
- `03-hermes-specs/fixtures/supervision_request.valid.inline_snapshot.json` (snapshot access mode B)
- `03-hermes-specs/fixtures/supervision_response.valid.json`
- `03-hermes-specs/fixtures/control_command.valid.json`
- `03-hermes-specs/fixtures/audit_event.valid.json`
- Optional (recommended): `fixtures/interop_payload_ref.valid.json`

**Multi-domain composition fixtures (required when supporting composition):**
- `03-hermes-specs/fixtures/supervision_request.multi_domain.json`
- `03-hermes-specs/fixtures/supervision_request.with_conflicts.json`
- `03-hermes-specs/fixtures/supervision_response.partial_approval.json`
- `03-hermes-specs/fixtures/cross_domain_conflict.valid.json`

**Imaging data fixtures (required when supporting imaging):**
- `03-hermes-specs/fixtures/imaging_study_ref.cardiac_mri.json`
- `03-hermes-specs/fixtures/derived_finding.lvef.json`
- `03-hermes-specs/fixtures/derived_finding.nodule_classification.json`
- `03-hermes-specs/fixtures/snapshot.with_imaging.json`

**Clinician feedback fixtures (required when supporting feedback integration):**
- `03-hermes-specs/fixtures/clinician_feedback_event.accepted.json`
- `03-hermes-specs/fixtures/clinician_feedback_event.rejected.json`
- `03-hermes-specs/fixtures/clinician_feedback_event.rejected.permanent.json`
- `03-hermes-specs/fixtures/clinician_feedback_event.modified.json`
- `03-hermes-specs/fixtures/clinician_feedback_event.deferred.json`
- `03-hermes-specs/fixtures/clinician_feedback_event.conflict.json`
- `03-hermes-specs/fixtures/snapshot_with_override_history.json`
- `03-hermes-specs/fixtures/snapshot_with_override_history.conflicts.json`
- `03-hermes-specs/fixtures/snapshot_with_override_history.handoff.json`
- `03-hermes-specs/fixtures/snapshot_with_override_history.alert_fatigue.json`
- `03-hermes-specs/fixtures/supervision_request.with_prior_overrides.json`
- `03-hermes-specs/fixtures/supervision_request.with_unresolved_conflicts.json`
- `03-hermes-specs/fixtures/supervision_request.with_feedback_metrics.json`
- `03-hermes-specs/fixtures/audit_event.bias_detection.json` (now `bias_detection` message type)

Deutsch and Popper teams MUST:
- include these fixtures in CI
- validate they can parse and produce the valid forms
- validate against the machine-readable schema:
  - `03-hermes-specs/schema/hermes-message.schema.json`

### 7.1 Example: Multi-Domain SupervisionRequest

```json
{
  "hermes_version": "1.6.0",
  "message_type": "supervision_request",
  "trace": {
    "trace_id": "3f5a6f3b-5d4b-5e4f-0d71-2d0f3d8b0f22",
    "created_at": "2026-01-24T10:00:00.000Z",
    "producer": {
      "system": "deutsch",
      "service_version": "deutsch-1.1.0",
      "ruleset_version": "cvd-lifestyle-composed-v1.0.0"
    }
  },
  "mode": "advocate_clinical",
  "subject": {
    "subject_type": "patient",
    "subject_id": "anon_9f3d...",
    "organization_id": "org_ta3_alpha"
  },
  "snapshot": {
    "snapshot_id": "snap_456",
    "snapshot_hash": "n9iQ5m0Ryr0x0o1rC9q1cLrI1b8mr0iZ3vU6i7l2f3d=",
    "created_at": "2026-01-24T09:59:30.000Z",
    "sources": ["ehr", "wearable", "patient_reported"],
    "snapshot_uri": "phi://snapshots/snap_456"
  },
  "idempotency_key": "01J1Z5L1Q6HR3A9A5X4D0R0H8R",
  "request_timestamp": "2026-01-24T10:00:00.000Z",
  "proposals": [
    {
      "proposal_id": "prop_med_001",
      "kind": "MEDICATION_ORDER_PROPOSAL",
      "created_at": "2026-01-24T10:00:00.000Z",
      "medication": { "name": "lisinopril" },
      "change": { "change_type": "titrate", "to_dose": "20 mg daily" },
      "clinician_protocol_ref": "protocol://org_ta3_alpha/cvd/hf-gdmt/v1.0.0",
      "audit_redaction": { "summary": "Medication titration under protocol" }
    },
    {
      "proposal_id": "prop_nutr_001",
      "kind": "OTHER",
      "other_kind": "NUTRITION_PLAN",
      "created_at": "2026-01-24T10:00:00.000Z",
      "payload": {
        "sodium_limit_mg": 2000,
        "potassium_limit_mg": 3500,
        "fluid_limit_ml": 2000
      },
      "audit_redaction": { "summary": "Dietary modifications for HF" }
    },
    {
      "proposal_id": "prop_exer_001",
      "kind": "OTHER",
      "other_kind": "EXERCISE_PLAN",
      "created_at": "2026-01-24T10:00:00.000Z",
      "payload": {
        "type": "walking",
        "intensity": "moderate",
        "duration_minutes": 30,
        "frequency": "5x_per_week"
      },
      "audit_redaction": { "summary": "Graded exercise for cardiac rehab" }
    }
  ],
  "cross_domain_conflicts": [
    {
      "conflict_id": "conflict_001",
      "conflict_type": "drug_nutrient_interaction",
      "triggering_rule": {
        "rule_id": "cardiology-nutrition-ace-potassium",
        "rule_source": "registries://cardiology/nutrition-interactions",
        "rule_version": "1.0.0"
      },
      "conflicting_domains": ["cardiology", "nutrition"],
      "conflicting_proposal_ids": ["prop_med_001", "prop_nutr_001"],
      "original_proposals": {
        "nutrition": "Increase potassium-rich foods for general health"
      },
      "resolution_strategy": "constrain",
      "resolved_proposal_id": "prop_nutr_001",
      "resolution_confidence": "high",
      "evidence_refs": [
        {
          "evidence_id": "interaction.ace-potassium",
          "evidence_type": "policy",
          "citation": "ACE Inhibitor-Potassium Interaction Database"
        }
      ],
      "uncertainty": { "level": "low" },
      "audit_redaction": {
        "summary": "Drug-nutrient interaction resolved by potassium constraint"
      }
    }
  ],
  "contributing_domains": [
    {
      "domain_id": "cardiology",
      "domain_version": "1.0.0",
      "domain_category": "clinical",
      "status": "success",
      "proposal_ids": ["prop_med_001"]
    },
    {
      "domain_id": "nutrition",
      "domain_version": "1.0.0",
      "domain_category": "lifestyle",
      "status": "success",
      "proposal_ids": ["prop_nutr_001"]
    },
    {
      "domain_id": "exercise",
      "domain_version": "1.0.0",
      "domain_category": "lifestyle",
      "status": "success",
      "proposal_ids": ["prop_exer_001"]
    }
  ],
  "composition_metadata": {
    "composer_version": "1.0.0",
    "registries_loaded": [
      {
        "registry_ref": "registries://cardiology/nutrition-interactions",
        "registry_version": "1.0.0",
        "rule_count": 12
      }
    ],
    "priority_snapshot": {
      "cardiology": 80,
      "nutrition": 50,
      "exercise": 45
    },
    "rule_engine_status": "healthy"
  },
  "audit_redaction": {
    "summary": "Multi-domain composition with 3 proposals and 1 resolved conflict",
    "proposal_summaries": [
      "Medication titration under protocol",
      "Dietary modifications for HF",
      "Graded exercise for cardiac rehab"
    ]
  }
}
```

### 7.2 Example: Partial Approval SupervisionResponse

```json
{
  "hermes_version": "1.6.0",
  "message_type": "supervision_response",
  "trace": {
    "trace_id": "3f5a6f3b-5d4b-5e4f-0d71-2d0f3d8b0f22",
    "created_at": "2026-01-24T10:00:00.080Z",
    "producer": {
      "system": "popper",
      "service_version": "popper-1.1.0",
      "ruleset_version": "popper-policy-0.4.0"
    }
  },
  "mode": "advocate_clinical",
  "subject": {
    "subject_type": "patient",
    "subject_id": "anon_9f3d...",
    "organization_id": "org_ta3_alpha"
  },
  "snapshot": {
    "snapshot_id": "snap_456",
    "created_at": "2026-01-24T09:59:30.000Z",
    "sources": ["ehr", "wearable", "patient_reported"]
  },
  "request_idempotency_key": "01J1Z5L1Q6HR3A9A5X4D0R0H8R",
  "response_timestamp": "2026-01-24T10:00:00.080Z",
  "decision": "ROUTE_TO_CLINICIAN",
  "reason_codes": ["needs_human_review"],
  "explanation": "Medication change with drug-nutrient interaction requires clinician review; lifestyle recommendations approved.",
  "per_proposal_decisions": [
    {
      "proposal_id": "prop_med_001",
      "decision": "ROUTE_TO_CLINICIAN",
      "reason_codes": ["needs_human_review", "risk_too_high"],
      "explanation": "Medication titration with concurrent drug-nutrient interaction"
    },
    {
      "proposal_id": "prop_nutr_001",
      "decision": "APPROVED",
      "reason_codes": ["approved_with_constraints"],
      "explanation": "Nutrition plan approved with potassium constraint"
    },
    {
      "proposal_id": "prop_exer_001",
      "decision": "APPROVED",
      "reason_codes": [],
      "explanation": "Exercise plan approved"
    }
  ],
  "conflict_evaluations": [
    {
      "conflict_id": "conflict_001",
      "popper_agrees_with_resolution": true
    }
  ],
  "safe_mode_state_used": { "enabled": false },
  "audit_redaction": {
    "summary": "Partial approval: medication routed, lifestyle approved",
    "decision": "ROUTE_TO_CLINICIAN",
    "reason_codes": ["needs_human_review"]
  }
}
```
