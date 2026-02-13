---
version: 1.2.1
last-updated: 2026-01-24
status: draft
owner: Popper Dev Team
tags: [advocate, ta2, popper, measurement, accuracy, hallucination, arpa-h, imaging]
---

# Popper Measurement Protocols (v1)

## 0) Purpose

This document specifies **accuracy ascertainment** and **hallucination quantification** protocols for Popper (TA2). These protocols implement ARPA-H requirements for measuring and monitoring Deutsch (TA1) output quality.

**Epistemological Grounding**: See [`../00-overall-specs/00-epistemology-foundations/04-fallibilism-and-error-correction.md`](../00-overall-specs/00-epistemology-foundations/04-fallibilism-and-error-correction.md) — error correction requires systematic measurement.

---

## 1) ARPA-H Alignment

### 1.1 TA2 Accuracy Targets

Per ARPA-H TA2 specifications:

| Phase | Accuracy Ascertainment Target | Timeline |
|-------|------------------------------|----------|
| **Phase 1A** | >85% ability to ascertain agent accuracy | 0-12 months |
| **Phase 1B** | >95% ability to ascertain agent accuracy | 12-24 months |

**Definition**: "Ability to ascertain" means the supervisor can determine whether a given agent output was correct or incorrect. This includes:
- Ground truth determination (via clinician validation)
- Confidence scoring of supervisor's own assessment
- Audit trail linking assessment to evidence

### 1.2 TA2 Safety Targets

| Metric | Target |
|--------|--------|
| Hard-stop false negative rate | <1% (critical errors MUST be caught) |
| Route-to-clinician appropriate use | >90% of high-uncertainty cases routed |
| Hallucination detection rate | >95% of fabricated claims identified |

---

## 2) Accuracy Ascertainment Protocol

### 2.1 Sampling Strategy

Popper MUST implement **stratified random sampling** of Deutsch proposals for clinician validation:

```typescript
type ProposalSamplingBucket =
  | 'MEDICATION_ORDER_PROPOSAL' // Hermes ProposedIntervention.kind
  | 'TRIAGE_ROUTE'              // Hermes ProposedIntervention.kind
  | 'CLAIM_LIFESTYLE_REC'       // proposals where claim_type === 'lifestyle_rec'
  | 'PATIENT_MESSAGE';          // Hermes ProposedIntervention.kind

interface AccuracySampleConfig {
  // Sampling rates by proposal type
  sampling_rates: {
    MEDICATION_ORDER_PROPOSAL: 0.15; // 15% — highest risk
    TRIAGE_ROUTE: 0.10;              // 10% — routing decisions
    CLAIM_LIFESTYLE_REC: 0.05;       // 5% — lower risk
    PATIENT_MESSAGE: 0.03;           // 3% — informational
  };

  // Override: always sample these
  always_sample: {
    first_proposal_per_session: true;  // Catch early drift
    low_htv_score: true;               // HTV < 0.5
    high_uncertainty: true;            // uncertainty.level = 'high'
    near_miss: true;                   // Approved with conditions
  };

  // Minimum samples per period
  minimum_per_week: {
    MEDICATION_ORDER_PROPOSAL: 10;
    TRIAGE_ROUTE: 20;
    CLAIM_LIFESTYLE_REC: 30;
  };
}
```

### 2.2 Clinician Validation Process

Sampled proposals are routed to clinician validators:

```typescript
interface ValidationTask {
  validation_id: string;
  proposal_id: string;
  proposal_snapshot: {
    intervention: ProposedIntervention;
    health_snapshot_ref: HealthStateSnapshotRef;
    deutsch_reasoning: string;        // Summary of debate
    htv_score: HTVScore;
    evidence_refs: EvidenceRef[];
  };

  // Validation metadata
  created_at: string;                 // ISO 8601
  deadline: string;                   // 48h window
  validator_role: 'attending' | 'specialist' | 'pharmacist';
  blinding: 'single' | 'double';      // Validator blinded to AI source
}

interface ValidationResult {
  validation_id: string;
  validator_id: string;               // Pseudonymous

  // Core assessment
  accuracy_verdict: 'correct' | 'partially_correct' | 'incorrect' | 'indeterminate';
  confidence_in_verdict: number;      // 0.0-1.0

  // Detailed assessment
  clinical_appropriateness: number;   // 0.0-1.0
  evidence_support: number;           // 0.0-1.0
  patient_safety: number;             // 0.0-1.0

  // Errors identified
  errors_found?: ValidationError[];

  // Free text
  clinical_notes?: string;

  // Metadata
  time_spent_seconds: number;
  completed_at: string;
}

interface ValidationError {
  error_type: 'factual' | 'reasoning' | 'omission' | 'contraindication' | 'hallucination';
  severity: 'critical' | 'significant' | 'minor';
  description: string;
  evidence_refs?: EvidenceRef[];       // Supporting clinician's assessment
}
```

### 2.3 Accuracy Metrics Calculation

```typescript
interface AccuracyMetrics {
  period: { start: string; end: string };

  // Overall accuracy
  overall_accuracy: number;           // correct / (correct + incorrect)
  ascertainment_rate: number;         // (correct + incorrect) / total_sampled
  indeterminate_rate: number;         // indeterminate / total_sampled

  // By proposal type
  accuracy_by_type: Record<ProposalSamplingBucket, {
    accuracy: number;
    sample_size: number;
    confidence_interval: [number, number];  // 95% CI
  }>;

  // Error analysis
  error_distribution: Record<ErrorType, number>;
  critical_error_rate: number;

  // Trends
  week_over_week_delta: number;
  trend_direction: 'improving' | 'stable' | 'degrading';
}

function calculateAccuracyMetrics(results: ValidationResult[]): AccuracyMetrics {
  const correct = results.filter(r => r.accuracy_verdict === 'correct').length;
  const incorrect = results.filter(r => r.accuracy_verdict === 'incorrect').length;
  const indeterminate = results.filter(r => r.accuracy_verdict === 'indeterminate').length;
  const total = results.length;

  return {
    overall_accuracy: correct / (correct + incorrect),
    ascertainment_rate: (correct + incorrect) / total,
    indeterminate_rate: indeterminate / total,
    // ... other calculations
  };
}
```

### 2.4 Accuracy Thresholds (Normative)

| Proposal Type | Phase 1A Target | Phase 1B Target | Critical Error Max |
|---------------|-----------------|-----------------|-------------------|
| MEDICATION_ORDER_PROPOSAL | 95% | 98% | 0.1% |
| TRIAGE_ROUTE | 90% | 97% | 0.5% |
| CLAIM_LIFESTYLE_REC | 85% | 92% | 2% |
| PATIENT_MESSAGE | 85% | 90% | 5% |

---

## 3) Hallucination Quantification Protocol

### 3.1 Definition

A **hallucination** is a claim made by Deutsch that is:
1. Not supported by evidence in the HealthStateSnapshot, OR
2. Contradicts data present in the snapshot, OR
3. Fabricates patient history, metrics, or clinical context, OR
4. Cites non-existent guidelines or studies

### 3.1.1 Detection Scope: Deterministic vs Measurement

Popper's hallucination detection operates in **two distinct modes**:

| Mode | Timing | Method | DSL Integration |
|------|--------|--------|-----------------|
| **Deterministic (Demarcation-Grade)** | Real-time (sync) | Automated structural checks | `hallucination_detected` condition |
| **Measurement (Async/Human)** | Async (48h window) | Clinician validation sampling | Metrics/reporting only |

**Deterministic Checks** (can block in real-time):
- Evidence ref URI resolution failure (unresolved_refs)
- Snapshot hash mismatch
- Claim references data field not present in snapshot
- Citation to non-existent guideline version
- Temporal inconsistency (dates in future, impossible sequences)

**Measurement Checks** (async, cannot block):
- Clinical appropriateness of claim interpretation
- Subtle reasoning errors
- Context-dependent accuracy
- Evidence weight assessment

**Important**: The Safety DSL `hallucination_detected` condition (see [`03-popper-safety-dsl.md`](./03-popper-safety-dsl.md) §8) MUST only trigger on **deterministic** hallucination signals. Measurement-based hallucination detection feeds into accuracy metrics and drift monitoring but MUST NOT cause real-time blocking decisions.

```typescript
// Deterministic (can trigger DSL condition)
interface DeterministicHallucinationCheck {
  evidence_refs_resolved: boolean;      // All URIs valid
  snapshot_fields_exist: boolean;       // Referenced data in snapshot
  citations_valid: boolean;             // Guideline versions exist
  temporal_consistent: boolean;         // Dates make sense
}

// Measurement (async only, feeds metrics)
interface MeasurementHallucinationCheck {
  clinical_accuracy: ValidationResult;  // Clinician assessment
  reasoning_soundness: ValidationResult;
  context_appropriateness: ValidationResult;
}
```

### 3.2 Detection Signals

Popper MUST check for these hallucination signals:

```typescript
interface HallucinationCheck {
  proposal_id: string;

  // Evidence verification
  evidence_verification: {
    all_refs_resolved: boolean;           // All EvidenceRef URIs valid
    refs_match_snapshot: boolean;         // Data matches snapshot
    unresolved_refs: string[];            // URIs that failed
  };

  // Claim verification
  claim_verification: {
    claims_in_snapshot: ClaimCheck[];     // Each claim traced to data
    unsupported_claims: string[];         // Claims without evidence
    contradicted_claims: string[];        // Claims contradicting data
  };

  // Citation verification
  citation_verification: {
    guidelines_verified: boolean;         // Guideline refs exist
    studies_verified: boolean;            // Study refs resolvable
    fabricated_citations: string[];       // Non-existent refs
  };

  // Cross-check
  snapshot_consistency: {
    patient_data_matches: boolean;        // Demographics, conditions, etc.
    temporal_consistency: boolean;        // Dates make sense
    medication_list_matches: boolean;     // Med references accurate
  };
}

interface ClaimCheck {
  claim: string;
  source_in_snapshot: string | null;      // JSON path to supporting data
  verification_status: 'verified' | 'unsupported' | 'contradicted';
}
```

### 3.3 Hallucination Scoring

```typescript
interface HallucinationScore {
  proposal_id: string;

  // Binary flags
  has_hallucination: boolean;

  // Severity
  severity: 'none' | 'minor' | 'significant' | 'critical';

  // Breakdown
  unsupported_claim_count: number;
  contradicted_claim_count: number;
  fabricated_citation_count: number;

  // Composite score (0.0 = no hallucination, 1.0 = severe)
  hallucination_score: number;

  // Details for audit
  details: HallucinationDetail[];
}

interface HallucinationDetail {
  type: 'unsupported_claim' | 'contradiction' | 'fabricated_citation' | 'data_mismatch';
  claim_or_ref: string;
  expected: string | null;
  actual: string | null;
  severity: 'minor' | 'significant' | 'critical';
}
```

### 3.4 Hallucination Rate Calculation

```typescript
function calculateHallucinationRate(
  checks: HallucinationCheck[],
  period: { start: string; end: string }
): HallucinationMetrics {
  const withHallucination = checks.filter(c => hasHallucination(c)).length;
  const total = checks.length;

  const rate = withHallucination / total;

  return {
    period,
    total_checked: total,
    hallucination_count: withHallucination,
    hallucination_rate: rate,

    by_type: {
      unsupported_claims: countByType(checks, 'unsupported'),
      contradictions: countByType(checks, 'contradicted'),
      fabricated_citations: countByType(checks, 'fabricated'),
    },

    severity_distribution: {
      minor: countBySeverity(checks, 'minor'),
      significant: countBySeverity(checks, 'significant'),
      critical: countBySeverity(checks, 'critical'),
    },
  };
}
```

### 3.5 Imaging Hallucination Detection

Imaging-derived findings require specialized hallucination checks due to their multi-stage provenance (raw pixels → AI model → derived finding → snapshot → Deutsch).

**Reference**: See [`../01-deutsch-specs/09-deutsch-imaging-integration.md`](../01-deutsch-specs/09-deutsch-imaging-integration.md) for the imaging AI pipeline architecture.

#### 3.5.1 Imaging-Specific Hallucination Types

```typescript
type ImagingHallucinationType =
  | 'invalid_study_reference'       // Finding references non-existent study_id
  | 'measurement_not_in_sr'         // Finding claims measurement not in DICOM SR
  | 'body_site_mismatch'           // Finding body_site contradicts study modality
  | 'modality_capability_mismatch' // Finding claims data impossible for modality
  | 'temporal_impossibility'       // Finding date before study date
  | 'ai_model_mismatch'            // Model ID doesn't match registered models
  | 'confidence_fabrication'       // Confidence claimed without model output
  | 'finding_duplication'          // Same finding claimed from different studies
  | 'laterality_contradiction'     // Left/right contradicts source image;
```

#### 3.5.2 Imaging Hallucination Detection Signals

```typescript
interface ImagingHallucinationCheck {
  finding_id: string;
  source_study_ref: ImagingStudyRef;

  // Study reference verification
  study_verification: {
    study_exists: boolean;               // study_id resolves in PHI Service
    storage_endpoint_valid: boolean;     // Endpoint accessible
    study_date_matches: boolean;         // Claimed date matches actual
  };

  // Finding-to-source consistency
  source_consistency: {
    modality_supports_finding: boolean;  // e.g., LVEF from X-ray without supporting evidence
    body_site_in_study: boolean;         // Study actually includes body site
    laterality_matches: boolean;         // Left/right consistent
    measurement_in_sr: boolean;          // Value exists in DICOM SR
  };

  // AI model verification (for ai_model extractor)
  model_verification?: {
    model_id_registered: boolean;        // Model exists in registry
    model_supports_modality: boolean;    // Model trained for this modality
    confidence_in_output: boolean;       // Confidence matches model output
  };

  // Temporal consistency
  temporal_verification: {
    finding_date_after_study: boolean;   // Finding can't predate source
    not_stale: boolean;                  // Within acceptable age
    sequence_valid: boolean;             // Comparison findings in order
  };
}
```

#### 3.5.3 Modality-Finding Compatibility Matrix

Popper MUST validate that findings are possible for the claimed modality:

| Modality | Valid Finding Types | Invalid Finding Types | Notes |
|----------|--------------------|-----------------------|-------|
| **MR** (MRI) | Soft tissue measurements, EF%, volumes, abnormality detection | Bone density (DEXA) | MRI not standard for CAC scoring but can detect calcification |
| **CT** | Densities, volumes, calcification scores, nodule sizing, EF% (with gating) | Soft tissue characterization | Cardiac CT with ECG-gating CAN produce EF% |
| **XR** (X-ray alias) | Cardiac silhouette, bone fractures, nodule presence | Precise volumes, soft tissue | Convenience alias; prefer DX/CR for DICOM |
| **US** (Ultrasound) | EF%, valve measurements, fluid detection | Bone measurements, calcification scoring | |
| **MG** (Mammography) | Mass characterization, density, calcifications | Non-breast findings | |
| **ECG** | Rhythm, intervals, ST changes | Anatomical measurements | |
| **PT** (PET) | Metabolic activity (SUV), tumor staging | Anatomical measurements (use CT) | Often combined with CT as PET-CT |
| **NM** (Nuclear Med) | Perfusion, function studies, MUGA EF% | Anatomical detail | |
| **DX** (Digital X-ray) | Same as XR | Same as XR | DICOM standard for digital radiography |
| **CR** (Computed Radiography) | Same as XR | Same as XR | DICOM standard for computed radiography |
| **OT** (Other) | Route for validation | — | Unknown modality: always route to clinician |

**Fallback rule**: For modalities not in this matrix (or `OT`), Popper SHOULD route to clinician and log for review.

#### 3.5.4 Imaging Hallucination Scoring

```typescript
interface ImagingHallucinationScore {
  finding_id: string;
  study_id: string;

  // Binary flag
  has_imaging_hallucination: boolean;

  // Type breakdown
  hallucination_types: ImagingHallucinationType[];

  // Severity (imaging hallucinations are typically more severe)
  severity: 'none' | 'significant' | 'critical';

  // Composite score
  imaging_hallucination_score: number;  // 0.0-1.0

  // Details
  details: ImagingHallucinationDetail[];
}

interface ImagingHallucinationDetail {
  type: ImagingHallucinationType;
  claim: string;                        // What was claimed
  evidence: string;                     // What was found
  severity: 'significant' | 'critical';
  remediation: string;                  // Suggested fix
}
```

#### 3.5.5 Imaging Hallucination Thresholds

Imaging hallucinations are treated with **higher severity** than text hallucinations due to clinical impact:

| Detection | Severity | Response |
|-----------|----------|----------|
| `invalid_study_reference` | **Critical** | `ROUTE_TO_CLINICIAN` (default) + log incident (policy MAY upgrade to `HARD_STOP` if suspicious) |
| `measurement_not_in_sr` | **Critical** | `ROUTE_TO_CLINICIAN` + require clinician review |
| `body_site_mismatch` | Significant | `ROUTE_TO_CLINICIAN` + increase uncertainty |
| `modality_capability_mismatch` | **Critical** | `ROUTE_TO_CLINICIAN` + trigger model audit |
| `ai_model_mismatch` | **Critical** | `ROUTE_TO_CLINICIAN` + trigger security review (policy MAY upgrade to `HARD_STOP`) |
| `confidence_fabrication` | Significant | `ROUTE_TO_CLINICIAN` + flag for review |
| `laterality_contradiction` | Significant | `ROUTE_TO_CLINICIAN` |

#### 3.5.6 Integration with General Hallucination Protocol

Imaging hallucination checks integrate with the general protocol:

```typescript
function checkForHallucinations(
  proposal: ProposedIntervention,
  snapshot: HealthStateSnapshot
): HallucinationCheck {
  // Standard hallucination checks
  const standardCheck = checkStandardHallucinations(proposal, snapshot);

  // Imaging-specific checks (if proposal references imaging)
  if (proposalUsesImagingEvidence(proposal)) {
    const imagingCheck = checkImagingHallucinations(proposal, snapshot);

    // Merge results (imaging hallucinations elevate severity)
    return mergeHallucinationChecks(standardCheck, imagingCheck);
  }

  return standardCheck;
}

function checkImagingHallucinations(
  proposal: ProposedIntervention,
  snapshot: HealthStateSnapshot
): ImagingHallucinationCheck[] {
  const checks: ImagingHallucinationCheck[] = [];

  for (const evidenceRef of proposal.evidence_refs ?? []) {
    if (isImagingEvidence(evidenceRef)) {
      const finding = findDerivedFinding(evidenceRef, snapshot);
      if (!finding) {
        // Finding referenced but not in snapshot = hallucination
        checks.push(createInvalidReferenceCheck(evidenceRef));
        continue;
      }

      // Verify study exists
      const studyValid = await verifyStudyExists(finding.source_study);
      if (!studyValid) {
        checks.push(createInvalidStudyCheck(finding));
      }

      // Verify modality compatibility
      if (!modalitySupportsFinding(finding.source_study.modality, finding)) {
        checks.push(createModalityMismatchCheck(finding));
      }

      // Verify temporal consistency
      if (finding.extracted_at < finding.source_study.study_date) {
        checks.push(createTemporalInconsistencyCheck(finding));
      }
    }
  }

  return checks;
}
```

#### 3.5.7 Audit Events for Imaging Hallucinations

```typescript
// Imaging hallucination detected
emit({
  event_type: 'OTHER',
  other_event_type: 'IMAGING_HALLUCINATION_DETECTED',
  summary: `Imaging hallucination in proposal ${proposal_id}: ${type}`,
  tags: {
    proposal_id,
    finding_id,
    study_id,
    hallucination_type: type,
    modality: finding.source_study.modality,
    severity: 'significant' | 'critical',
  },
});

// Imaging hallucination rate alert
emit({
  event_type: 'OTHER',
  other_event_type: 'IMAGING_HALLUCINATION_RATE_ALERT',
  summary: `Imaging hallucination rate ${rate}% exceeds threshold`,
  tags: {
    rate: String(rate),
    threshold: String(threshold),
    modality: modality ?? 'all',
    alert_level: 'warn' | 'critical',
  },
});
```

---

### 3.6 Response Thresholds

| Hallucination Rate | Severity | Response |
|--------------------|----------|----------|
| < 2% | Normal | Continue normal operation |
| 2-5% | Elevated | INFO alert, increase sampling rate |
| 5-10% | High | WARN alert, safe-mode consideration |
| > 10% | Critical | Hard-stop + incident escalation |

**Critical Hallucinations** (any rate): Immediate action required:
- Fabricated medication contraindication
- Invented lab values affecting treatment
- Non-existent guideline cited for medication order

---

## 4) HTV-Based Conservatism

### 4.1 HTV Evaluation by Popper

Popper MUST evaluate HTV scores from Deutsch proposals:

```typescript
interface HTVEvaluation {
  proposal_id: string;

  // Deutsch-provided HTV
  deutsch_htv: HTVScore;

  // Popper's independent assessment (optional, for calibration)
  popper_htv?: HTVScore;

  // Calibration delta
  htv_delta?: number;                    // deutsch - popper (for drift detection)

  // Decision impact
  htv_based_decision: {
    threshold_used: number;              // e.g., 0.4
    passed: boolean;
    action_if_failed: 'route' | 'hard_stop' | 'increase_uncertainty';
  };
}
```

### 4.2 HTV Thresholds for Routing

| Proposal Type | HTV Threshold | Action if Below |
|---------------|---------------|-----------------|
| `MEDICATION_ORDER_PROPOSAL` | 0.5 | Route to clinician |
| `TRIAGE_ROUTE` (urgent) | 0.5 | Route to clinician |
| `TRIAGE_ROUTE` (routine) | 0.4 | Route to clinician |
| proposals where `claim_type === "lifestyle_rec"` (typically `kind: "OTHER"`) | 0.3 | Route to clinician (default) |

### 4.3 HTV Drift Monitoring

Popper MUST track HTV calibration over time:

```typescript
interface HTVDriftMetrics {
  period: { start: string; end: string };

  // Distribution
  mean_htv: number;
  median_htv: number;
  std_dev: number;

  // Thresholds
  below_0_3_rate: number;               // Refuted hypotheses
  below_0_4_rate: number;               // Poor explanations
  above_0_7_rate: number;               // Good explanations

  // Trends
  week_over_week_delta: number;
  trend: 'improving' | 'stable' | 'degrading';

  // Alerts
  alert_triggered: boolean;
  alert_reason?: string;
}
```

---

## 5) Evidence Grade Evaluation

### 5.1 Grade-Based Conservatism

Popper MUST evaluate evidence grades on proposals:

```typescript
interface EvidenceGradeEvaluation {
  proposal_id: string;

  // Evidence summary
  evidence_refs: EvidenceRef[];

  // Grade distribution
  grade_counts: Record<EvidenceGrade, number>;

  // Minimum grade (weakest link)
  min_grade: EvidenceGrade;

  // Weighted average (optional)
  weighted_grade_score?: number;        // 0.0-1.0

  // Decision impact
  grade_based_decision: {
    threshold_met: boolean;
    required_grade: EvidenceGrade;
    action_if_failed: 'route' | 'increase_uncertainty';
  };
}
```

### 5.2 Grade Thresholds

| Proposal Type | Minimum Grade | Action if Below |
|---------------|---------------|-----------------|
| `MEDICATION_ORDER_PROPOSAL` | `cohort` | Route to clinician |
| `TRIAGE_ROUTE` | `case_series` | Route to clinician |
| proposals where `claim_type === "lifestyle_rec"` (typically `kind: "OTHER"`) | `expert_opinion` | Increase uncertainty / prefer conservative posture |

---

## 6) Audit and Export

### 6.1 Measurement Audit Events

Popper MUST emit audit events for all measurement activities:

```typescript
// Accuracy sample selected
emit({
  event_type: 'OTHER',
  other_event_type: 'ACCURACY_SAMPLE_SELECTED',
  summary: `Proposal ${proposal_id} selected for validation`,
  tags: {
    proposal_id,
    proposal_type: intervention.kind,
    sampling_reason: 'random' | 'low_htv' | 'high_uncertainty' | 'first_in_session',
  },
});

// Validation completed
emit({
  event_type: 'OTHER',
  other_event_type: 'ACCURACY_VALIDATION_COMPLETED',
  summary: `Validation ${validation_id}: ${verdict}`,
  tags: {
    validation_id,
    proposal_id,
    verdict: 'correct' | 'incorrect' | 'indeterminate',
    confidence: String(confidence),
  },
});

// Hallucination detected
emit({
  event_type: 'OTHER',
  other_event_type: 'HALLUCINATION_DETECTED',
  summary: `Hallucination in proposal ${proposal_id}: ${type}`,
  tags: {
    proposal_id,
    hallucination_type: type,
    severity: 'minor' | 'significant' | 'critical',
  },
});
```

### 6.2 Export Formats

For regulatory reporting and analysis:

**`accuracy_samples.jsonl`**:
```json
{"sample_id": "...", "proposal_id": "...", "sampled_at": "...", "reason": "..."}
```

**`accuracy_validations.jsonl`**:
```json
{"validation_id": "...", "proposal_id": "...", "verdict": "...", "confidence": 0.95, "errors": [...]}
```

**`hallucination_detections.jsonl`**:
```json
{"proposal_id": "...", "detected_at": "...", "type": "...", "severity": "...", "details": [...]}
```

**`htv_evaluations.jsonl`**:
```json
{"proposal_id": "...", "htv_score": {...}, "threshold": 0.4, "passed": true}
```

---

## 7) Integration Points

### 7.1 Safety DSL Conditions

See [`03-popper-safety-dsl.md`](./03-popper-safety-dsl.md) for rule integration:

```typescript
// Route if HTV too low
{ kind: 'htv_score_below', threshold: 0.4 }

// Route if evidence grade too weak
{ kind: 'evidence_grade_below', threshold: 'cohort' }

// Route if hallucination detected
{ kind: 'hallucination_detected', severity: 'significant' }
```

### 7.2 Drift Monitoring

See [`01-popper-system-spec.md`](./01-popper-system-spec.md) §5 for drift integration:

- Accuracy trends feed into drift monitoring
- HTV drift triggers safe-mode consideration
- Hallucination rate spikes trigger alerts

### 7.3 Control Commands

Measurement results MAY trigger control commands:

```typescript
// If hallucination rate > 10%
{
  command: 'SET_SAFE_MODE',
  params: { enabled: true, reason: 'hallucination_rate_exceeded' },
}

// If accuracy degrading
{
  command: 'INCREASE_CONSERVATISM',
  params: { delta: 0.1 },
}
```

---

## 8) Testing Requirements

### 8.1 Unit Tests

- Sampling rates correctly applied
- Validation task creation with correct fields
- Hallucination detection for all types
- HTV threshold comparisons
- Evidence grade evaluations

### 8.2 Integration Tests

- End-to-end sampling → validation → metrics flow
- Hallucination detection pipeline
- Audit event emission
- Export file generation

### 8.3 Scenario Tests

- High-accuracy scenario: >95% correct, verify no alerts
- Degradation scenario: accuracy drops, verify drift alert
- Hallucination spike: rate exceeds 10%, verify hard-stop
- HTV drift: mean HTV drops, verify conservatism increase

---

## 9) References

- [01-popper-system-spec.md](./01-popper-system-spec.md) — System architecture
- [03-popper-safety-dsl.md](./03-popper-safety-dsl.md) — Safety rule language
- [04-popper-regulatory-export-and-triage.md](./04-popper-regulatory-export-and-triage.md) — Export formats
- [../01-deutsch-specs/09-deutsch-imaging-integration.md](../01-deutsch-specs/09-deutsch-imaging-integration.md) — Imaging AI pipeline
- [../03-hermes-specs/04-hermes-epistemological-types.md](../03-hermes-specs/04-hermes-epistemological-types.md) — Type definitions
- [../03-hermes-specs/05-hermes-imaging-data.md](../03-hermes-specs/05-hermes-imaging-data.md) — Imaging data types
- [../00-overall-specs/00-epistemology-foundations/04-fallibilism-and-error-correction.md](../00-overall-specs/00-epistemology-foundations/04-fallibilism-and-error-correction.md) — Epistemological grounding

---

*Last updated: 2026-01-24*
