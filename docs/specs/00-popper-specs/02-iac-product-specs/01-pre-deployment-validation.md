# 01 — Pre-Deployment Validation

> **Version**: 0.2.0
> **Date**: 2026-03-19
> **Status**: Draft
> **Evidence Status**: Spec-backed
> **Target Proposed Standard**: I (Category 1 — Pre-Deployment Validation) — Regain draft, not adopted by IAC

---

## Overview

Proposed IAC Standard I (Regain's draft, not yet submitted to or adopted by IAC) would require facilities to conduct site-specific validation testing of AI tools before clinical deployment. Validation would use the facility's own equipment and patient population, include demographic representation, compare against physician-established reference standards, and be signed off by a qualified physician.

Popper currently has per-org scoping and contract-based architecture that supports validation conceptually, but no validation protocol, no test harness, no demographic tracking, and no validation report generation. This spec defines the product features that close this gap. If IAC modifies the proposed requirements, these features are designed to adapt — thresholds, measurement profiles, and demographic dimensions are all configurable.

---

## Current State

| Capability | Status | Where |
|---|---|---|
| Per-organization scope (org-level policy packs) | Implemented | Popper policy engine |
| Hermes contract validation (schema compliance) | Implemented | Popper contract validator |
| Export bundle generation | Implemented | `04-popper-regulatory-export-and-triage.md` |
| ARPA-H accuracy ascertainment protocol | Specified | `05-popper-measurement-protocols.md` |
| Site-specific validation toolkit | **Not built** | — |
| Validation dataset management | **Not built** | — |
| Demographic representation tracking | **Not built** | — |
| Modality-specific validation profiles | **Not built** | — |
| Validation report generation | **Not built** | — |

---

## Target State

Popper provides a validation toolkit that facilities use to run site-specific validation of AI tools before deployment. The toolkit manages validation datasets, runs AI outputs through the production supervision pipeline, tracks demographic representation, computes accuracy metrics, and generates validation reports targeting the proposed IAC Standard I §4 evidence requirements.

---

## System Boundaries

| System | Responsibility |
|---|---|
| **Popper** | Validation suite orchestration, accuracy metric computation (from aggregated data), report generation. Receives de-identified study results, NOT raw demographics. |
| **MISS** | Validation UI for clinician reference standard entry, dataset management, demographic tagging per study. MISS holds row-level demographics transiently and sends only aggregate representativeness counts to Popper. |
| **Facility** | Curates validation dataset, establishes reference standards, defines performance thresholds, physician sign-off, provides equipment/site metadata |

**PHI boundary for validation:** Row-level demographic data (sex, age group, BMI category per patient) is entered in MISS and stays in MISS. MISS computes demographic distribution counts (e.g., "23 male, 27 female") and sends those aggregates to Popper. Popper never sees which study belongs to which demographic group — only the aggregate representativeness numbers. This preserves the PHI-blind invariant while enabling demographic representation tracking per Standard I.3.

**Exception:** Per-demographic accuracy breakdown (e.g., "mean EF difference for female patients") requires MISS to compute per-group metrics locally and send the results to Popper as pre-aggregated `DemographicMetricsSummary` objects. Popper receives `{dimension: "sex", category: "female", n: 23, mean_absolute_difference: 3.2}` — never the underlying patient-level data.

---

## Architecture

### 1. Core Interfaces

```typescript
/**
 * A validation suite represents one facility's pre-deployment
 * validation of one AI tool.
 */
interface ValidationSuite {
  suite_id: string;
  organization_id: string;

  // What is being validated
  ai_tool: {
    vendor: string;
    product: string;
    version: string;
    fda_clearance_number?: string;
    intended_use: string;
  };

  // Modality-specific profile
  modality_profile: ModalityValidationProfile;

  // Facility-defined thresholds (Standard I.5)
  performance_thresholds: PerformanceThreshold[];

  // Status tracking
  status: 'draft' | 'collecting' | 'validating' | 'review' | 'approved' | 'rejected';
  created_at: IsoDateTime;
  approved_at?: IsoDateTime;
  approved_by?: string; // physician ID (Standard I.7)

  // Re-validation tracking (Standard III.6)
  is_revalidation: boolean;
  prior_suite_id?: string;
  revalidation_reason?: 'software_update' | 'population_change' | 'periodic' | 'incident';
}

/**
 * Modality-specific validation configuration.
 * Echo profile shown; extensible to CT, Nuclear/PET per IAC scope.
 */
interface ModalityValidationProfile {
  modality: 'echo' | 'ct' | 'nuclear_pet';

  // Measurement types to validate
  measurement_types: MeasurementValidationConfig[];

  // Minimum dataset requirements (Standard I.2)
  minimum_studies: number; // IAC proposes 50, guideline recommends 100

  // Clinical range requirements (Standard I.2)
  required_severity_distribution: {
    normal: { min_percentage: number };
    mildly_abnormal: { min_percentage: number };
    moderately_abnormal: { min_percentage: number };
    severely_abnormal: { min_percentage: number };
  };

  // Demographic requirements (Standard I.3)
  demographic_dimensions: DemographicDimension[];
}

interface MeasurementValidationConfig {
  measurement_type: string; // 'ef' | 'strain_gls' | 'wall_motion' | etc.
  display_name: string;
  unit: string;
  comparison_method: 'absolute_difference' | 'correlation' | 'kappa' | 'bland_altman';
  threshold: number; // e.g., 5 for ±5%
  threshold_unit: string; // '%' | 'absolute' | 'kappa'
}

interface DemographicDimension {
  dimension: string; // 'sex' | 'age_group' | 'body_habitus' | 'race_ethnicity'
  required: boolean;
  minimum_representation_percentage: number; // e.g., 10
  categories: string[];
}
```

### 2. Echo Validation Profile (Default)

The echo validation profile implements the illustrative parameters from proposed Standard I with configurable overrides per proposed Standard I.5:

```typescript
const ECHO_VALIDATION_PROFILE: ModalityValidationProfile = {
  modality: 'echo',

  measurement_types: [
    {
      measurement_type: 'ef',
      display_name: 'Ejection Fraction (EF)',
      unit: '%',
      comparison_method: 'absolute_difference',
      threshold: 5,    // ±5% per Proposed Standard I.5 illustrative example
      threshold_unit: '%',
    },
    {
      measurement_type: 'strain_gls',
      display_name: 'Global Longitudinal Strain (GLS)',
      unit: '%',
      comparison_method: 'absolute_difference',
      threshold: 2,    // ±2% absolute per Proposed Standard I.5 illustrative example
      threshold_unit: '%',
    },
    {
      measurement_type: 'wall_motion',
      display_name: 'Wall Motion Assessment',
      unit: 'kappa',
      comparison_method: 'kappa',
      threshold: 0.7,  // kappa ≥ 0.7 (substantial agreement)
      threshold_unit: 'kappa',
    },
    {
      measurement_type: 'valve_area',
      display_name: 'Valve Area',
      unit: 'cm²',
      comparison_method: 'bland_altman',
      threshold: 0.3,  // mean difference ±0.3 cm²
      threshold_unit: 'cm²',
    },
  ],

  minimum_studies: 50,  // IAC §2 Standard I.2 proposed minimum

  required_severity_distribution: {
    normal: { min_percentage: 15 },
    mildly_abnormal: { min_percentage: 15 },
    moderately_abnormal: { min_percentage: 15 },
    severely_abnormal: { min_percentage: 10 },
  },

  demographic_dimensions: [
    {
      dimension: 'sex',
      required: true,      // Standard I.3 minimum
      minimum_representation_percentage: 10,
      categories: ['male', 'female'],
    },
    {
      dimension: 'age_group',
      required: true,      // Standard I.3 minimum
      minimum_representation_percentage: 10,
      categories: ['18-40', '41-65', '66-80', '>80'],
    },
    {
      dimension: 'body_habitus',
      required: true,      // Standard I.3 minimum
      minimum_representation_percentage: 10,
      categories: ['normal', 'overweight', 'obese'],
    },
    {
      dimension: 'race_ethnicity',
      required: false,     // Standard VI.3 recommended
      minimum_representation_percentage: 5,
      categories: [], // facility-defined
    },
  ],
};
```

### 2b. Performance Threshold (Referenced by ValidationSuite)

```typescript
interface PerformanceThreshold {
  measurement_type: string;
  metric: 'absolute_difference' | 'correlation' | 'kappa' | 'bland_altman_bias';
  threshold_value: number;
  direction: 'less_than' | 'greater_than'; // e.g., |diff| < 5 or kappa > 0.7
  clinically_grounded: boolean;
  source: string; // e.g., "Proposed Standard I.5 illustrative" or "facility-defined"
}
```

### 2c. Equipment and Site Metadata (Standard I.1)

Standard I requires validation on the facility's own equipment. The suite tracks this:

```typescript
interface ValidationSiteContext {
  facility_name: string;
  site_id: string;
  equipment: Array<{
    manufacturer: string;
    model: string;
    serial_number?: string; // optional, facility discretion
    probe_type?: string;    // e.g., "phased array", "sector"
  }>;
  population_baseline?: {
    description: string;    // e.g., "Urban academic medical center, 70% minority"
    annual_echo_volume?: number;
  };
}
```

### 3. Validation Dataset

**Important:** Row-level demographics are managed in MISS, not Popper. The `ValidationStudy` as stored in Popper contains only de-identified measurement data and severity classification. MISS computes demographic representativeness and per-group metrics locally.

```typescript
/**
 * A single study in the validation dataset (as stored in Popper).
 * Demographics are NOT included — they stay in MISS.
 */
interface ValidationStudy {
  study_id: string;
  suite_id: string;

  // Reference standard (Standard I.4)
  reference_standard: {
    established_by: string;  // pseudonymous physician ID
    established_at: IsoDateTime;
    method: 'physician_measurement' | 'consensus_panel' | 'expert_review';
  };

  // Severity classification (clinical, not demographic)
  severity: 'normal' | 'mildly_abnormal' | 'moderately_abnormal' | 'severely_abnormal';

  // Measurements
  measurements: ValidationMeasurement[];
}

interface ValidationMeasurement {
  measurement_type: string;
  reference_value: number;   // physician reference standard
  ai_value: number;          // AI tool output
  difference: number;        // computed: ai_value - reference_value
  meets_threshold: boolean;  // computed: |difference| ≤ threshold
  // For categorical measurements (wall motion)
  reference_category?: string;
  ai_category?: string;
  categories_agree?: boolean;
}
```

### 4. Validation Execution

Validation runs through the **production supervision pipeline** — this is critical. Validating against a separate pipeline would not validate the system as deployed.

1. **Dataset creation:** Facility identifies validation studies, enters reference standards via MISS
2. **AI tool processing:** Each study is processed by the AI tool under validation (facility runs this)
3. **Supervision:** AI outputs go through Popper's production supervision pipeline (same policy pack, same rules)
4. **Comparison:** Popper compares AI output against reference standard for each measurement
5. **Demographic tracking:** Popper checks representation against dimension requirements, emits warnings
6. **Report generation:** Popper generates validation report with all required statistics

**Sample size warnings:**

```typescript
interface RepresentationWarning {
  dimension: string;
  category: string;
  actual_count: number;
  actual_percentage: number;
  minimum_percentage: number;
  message: string; // e.g., "Only 8% of studies from patients >80 years (minimum: 10%)"
}
```

### 5. Accuracy Metrics

```typescript
interface ValidationMetrics {
  // Per measurement type
  measurement_metrics: Array<{
    measurement_type: string;
    n: number;
    mean_difference: number;
    std_difference: number;
    mean_absolute_difference: number;
    correlation: number;     // Pearson r
    icc: number;             // Intraclass correlation coefficient
    bland_altman: {
      bias: number;
      lower_limit: number;   // mean - 1.96 * SD
      upper_limit: number;   // mean + 1.96 * SD
    };
    kappa?: number;          // For categorical (wall motion)
    meets_threshold: boolean;
    pass_rate: number;       // fraction meeting per-study threshold
  }>;

  // Overall
  overall_pass: boolean;     // all measurement types meet threshold
  studies_analyzed: number;
  studies_excluded: number;
  exclusion_reasons: Array<{ study_id: string; reason: string }>;

  // Demographic breakdown
  demographic_breakdown: Array<{
    dimension: string;
    category: string;
    n: number;
    percentage: number;
    meets_representation: boolean;
    // Per-measurement accuracy within this demographic
    measurement_metrics: Array<{
      measurement_type: string;
      n: number;
      mean_absolute_difference: number;
      meets_threshold: boolean;
    }>;
  }>;
}
```

### 6. Validation Report

The validation report matches IAC §4 evidence requirements for Standard I:

```typescript
interface ValidationReport {
  report_id: string;
  suite_id: string;
  organization_id: string;
  generated_at: IsoDateTime;

  // AI tool identification
  ai_tool: ValidationSuite['ai_tool'];

  // Protocol document (Standard I.1)
  validation_protocol: {
    modality_profile: ModalityValidationProfile;
    performance_thresholds: PerformanceThreshold[];
    dataset_selection_criteria: string;
  };

  // Results (Standard I.6)
  metrics: ValidationMetrics;

  // Demographic breakdown (Standard I.3)
  demographic_summary: Array<{
    dimension: string;
    distribution: Array<{ category: string; count: number; percentage: number }>;
    warnings: RepresentationWarning[];
  }>;

  // Cases where AI did not meet thresholds (Standard I.6)
  failure_cases: Array<{
    study_id: string;
    measurement_type: string;
    reference_value: number;
    ai_value: number;
    difference: number;
    threshold: number;
  }>;

  // Sign-off (Standard I.7)
  sign_off: {
    status: 'pending' | 'approved' | 'rejected';
    physician_id?: string;
    signed_at?: IsoDateTime;
    comments?: string;
  };

  // Re-validation context (Standard III.6)
  revalidation?: {
    prior_suite_id: string;
    reason: string;
    comparison_to_prior: {
      measurement_type: string;
      prior_metric: number;
      current_metric: number;
      delta: number;
    }[];
  };
}
```

---

## Clinical Benchmarks

These benchmarks ground the default thresholds. Facilities may adjust per proposed Standard I.5.

| Metric | Benchmark | Source |
|---|---|---|
| AI LVEF ICC | 0.92 | Aggregated across published studies |
| AI LVEF override rate | 16.8% | He et al. 2023 Nature (n=3,495) |
| AI LVEF sensitivity for <50% | 84.6% | Us2.ai PANES-HF |
| AI LVEF specificity for <50% | 91.4% | Us2.ai PANES-HF |
| EF agreement threshold | ±5% | Proposed Standard I.5 illustrative, ASE 2025 |
| Strain agreement threshold | ±2% absolute | Proposed Standard I.5 illustrative |

---

## Proposed §4 Evidence Targeted

The following maps to the §4 structure in Regain's proposed draft (not adopted IAC requirements):

| Proposed Requirement | Delivered By |
|---|---|
| Validation protocol document | `ValidationReport.validation_protocol` |
| Validation results report with statistical summary | `ValidationReport.metrics` |
| Demographic breakdown of validation dataset | `ValidationReport.demographic_summary` |
| Physician or designated technical expert sign-off | `ValidationReport.sign_off` |

---

## Acceptance Criteria

1. A facility can create a `ValidationSuite` for a specific AI tool + modality profile
2. Validation studies can be added with reference standards and demographic data
3. AI outputs are compared against reference standards using the configured comparison method
4. Sample size warnings are generated when demographic representation falls below minimums
5. `ValidationMetrics` computes ICC, Bland-Altman, kappa, and per-threshold pass rates
6. `ValidationReport` can be generated and exported as JSON matching IAC §4 requirements
7. Re-validation suites link to prior suites with delta comparison
8. Validation runs through the production supervision pipeline (not a separate path)
9. Row-level demographic data never enters Popper — MISS computes demographic aggregates and per-group metrics locally, sending only summaries to Popper
10. Equipment/site metadata is captured per validation suite (Standard I.1)

---

## Sources

1. **Proposed IAC Echo Standards, Standard I** (Regain draft, not yet submitted/adopted) — Pre-Deployment AI Validation, §4 evidence requirements
2. **ASE 2025 Reporting Standardization** (JASE 2025;38:735–774) — Echo measurement standards and normal values
3. **He et al. 2023, Nature** (n=3,495 blinded RCT) — AI LVEF ICC 0.92, baseline performance data
4. **Us2.ai PANES-HF** — Sensitivity 84.6%, specificity 91.4% for LVEF <50%
5. **FDA AI-Enabled DSF Lifecycle Management Draft Guidance** (Jan 2025) — Bias analysis requirements in validation
6. **05-popper-measurement-protocols.md** — ARPA-H accuracy ascertainment protocol and sampling methodology
