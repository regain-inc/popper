# 02 — Bias Monitoring Architecture

> **Version**: 0.2.0
> **Date**: 2026-03-19
> **Status**: Draft
> **Evidence Status**: Spec-backed (Popper export) / Not evidenced (facility-side library, return path)
> **Target Proposed Standard**: VI (Category 5 — Bias and Equity Monitoring) — Regain draft, not adopted by IAC

---

## Overview

Proposed IAC Standard VI (Regain's draft, not yet submitted to or adopted by IAC) would require facilities to evaluate AI performance across patient demographics on a recurring basis, report disaggregated performance data across at minimum three dimensions (sex, age group, body habitus), and document mitigation plans when statistically significant disparities are identified. This spec builds against the proposed standard as a design target.

Popper is PHI-blind by architecture. It does not have access to patient demographic data. This is non-negotiable — the PHI-blind boundary is Popper's core safety invariant.

This spec defines a **facility-side join architecture** where Popper exports de-identified audit data, the facility joins it with their demographic registry, and the facility runs disparity analysis using Popper's open-source analysis library. Popper provides the tooling; the facility performs the join.

---

## Current State

| Capability | Status | Where |
|---|---|---|
| PHI-blind audit trail with de-identified subject_id | Implemented | Popper audit events |
| De-identified export bundles | Implemented | `04-popper-regulatory-export-and-triage.md` |
| Clinical DemographicContext (age_group only) | Implemented | Hermes `ClinicianFeedbackEvent` |
| Full demographic stratification | **Not possible** | Popper has no demographic data |
| Disparity analysis | **Not built** | — |
| Bias monitoring reports | **Not built** | — |
| Mitigation workflow | **Not built** | — |

---

## Target State

Popper exports de-identified performance data keyed by `subject_id`. The facility joins this with their demographic registry on their own infrastructure. The facility runs Popper's open-source disparity analysis library against the joined dataset. The library computes per-group accuracy metrics, detects statistically significant disparities, and generates bias monitoring reports targeting the proposed IAC Standard VI §4 evidence requirements.

---

## System Boundaries

| System | Responsibility |
|---|---|
| **Popper** | Exports de-identified audit data (subject_id, AI outputs, supervision verdicts, override data). Publishes open-source disparity analysis library. |
| **MISS** | Emits Hermes events with subject_id linkage |
| **Facility** | Maintains demographic registry. Performs facility-side join. Runs disparity analysis. Owns mitigation plans. Submits reports to IAC. |

**Why facility-side join?** Three reasons:
1. **PHI-blind invariant:** Popper must never see demographic data. This is the core architectural guarantee.
2. **Data sovereignty:** Facilities own their patient data. The join stays in their environment.
3. **Regulatory clarity:** The facility is responsible for bias monitoring under IAC. Popper is a tool, not the accountable entity.

---

## Architecture

### 1. Popper Export: Bias Monitoring Dataset

Popper exposes an endpoint that generates a de-identified performance dataset for a time period:

**Endpoint:**

```
GET /v1/organizations/{org_id}/exports/bias-monitoring?from={iso}&to={iso}
Accept: application/jsonl
Authorization: Bearer <api_key>
```

**Export format (one row per supervised action):**

```typescript
interface BiasMonitoringExportRow {
  // Join key — facility uses this to link to their demographic registry
  subject_id: string;

  // Temporal
  occurred_at: IsoDateTime;

  // AI performance data
  measurement_type: string;       // 'ef' | 'strain_gls' | etc.
  ai_value?: number;              // AI-generated value
  supervision_decision: string;   // 'APPROVED' | 'ROUTE_TO_CLINICIAN' | 'HARD_STOP'

  // Override data (if clinician feedback exists)
  clinician_action?: string;      // 'accepted' | 'modified' | 'rejected'
  clinician_value?: number;       // clinician's value (if modified)
  rationale_category?: string;    // RationaleCategory

  // Supervision metadata
  hard_stop_fired: boolean;
  rules_triggered: string[];      // rule IDs that fired
}
```

**De-identification guarantees:**
- `subject_id` is a pseudonymous identifier (no name, MRN, DOB)
- No direct identifiers in any field
- No clinician identity (pseudonymous in override analytics, stripped here)
- Export follows the same de-identification rules as `04-popper-regulatory-export-and-triage.md` §4

### 2. Facility-Side Join

The facility joins Popper's export with their demographic registry:

```
┌─────────────────────┐    ┌──────────────────────┐
│ Popper Export        │    │ Facility Demographics │
│ (de-identified)      │    │ (PHI, facility-owned) │
│                      │    │                       │
│ subject_id ──────────┼────┼── subject_id          │
│ ai_value             │    │ sex                   │
│ clinician_value      │    │ age_group             │
│ supervision_decision │    │ body_habitus (BMI)    │
│ clinician_action     │    │ race_ethnicity (opt)  │
│ hard_stop_fired      │    │                       │
└─────────────────────┘    └──────────────────────┘
            │                          │
            └──────────┬───────────────┘
                       ▼
              ┌─────────────────┐
              │ Joined Dataset   │
              │ (facility-side)  │
              │                  │
              │ → Disparity      │
              │   Analysis       │
              │   Library        │
              └─────────────────┘
```

**Popper provides:** A mapping guide documenting how `subject_id` is generated and how facilities should structure their demographic registry table for the join.

### 3. Disparity Analysis Library (Open-Source)

Popper publishes an open-source library (`@regain/bias-analysis`) that facilities run on their own infrastructure against the joined dataset. This keeps the computation facility-side while standardizing the methodology.

```typescript
/**
 * Core analysis function.
 * Runs entirely facility-side — Popper never sees the joined data.
 */
interface DisparityAnalysisInput {
  // Joined dataset
  rows: JoinedBiasRow[];

  // Configuration
  config: {
    // Dimensions to analyze (Standard VI.2 minimum: sex, age_group, body_habitus)
    dimensions: string[];

    // Metrics to compute per group
    metrics: ('accuracy' | 'sensitivity' | 'specificity' | 'override_rate' | 'hard_stop_rate')[];

    // Disparity threshold (default: 0.10 = 10% relative difference)
    disparity_threshold: number;

    // Minimum group size for statistical validity
    minimum_group_size: number; // default: 30

    // Statistical test
    statistical_test: 'chi_square' | 'fisher_exact' | 'bland_altman';
  };
}

interface JoinedBiasRow {
  subject_id: string;
  occurred_at: string;

  // Performance data (from Popper export)
  measurement_type: string;
  ai_value?: number;
  clinician_value?: number;
  supervision_decision: string;
  clinician_action?: string;
  hard_stop_fired: boolean;

  // Demographics (from facility registry)
  demographics: Record<string, string>; // dimension → category
}
```

**Metrics per group (Standard VI.1):**

**Truth-data limitation:** The export contains `ai_value` and optional `clinician_value` (from overrides only). This means accuracy/sensitivity/specificity can only be computed for the subset of cases where clinician feedback exists — which is a biased sample (overrides are disproportionately cases where AI was wrong). This is a fundamental limitation.

**Two tiers of bias metrics:**

| Tier | Metrics | Data Source | Selection Bias Risk |
|---|---|---|---|
| **Tier 1: Always available** | Override rate, hard stop rate per demographic group | All supervised actions | Low — computed over full population |
| **Tier 2: Requires reference standard** | Accuracy, sensitivity, specificity, mean difference | Only cases with clinician feedback OR validation-dataset reference standards | High — override-only data is biased toward AI errors |

To get unbiased Tier 2 metrics, facilities should use the **validation dataset** from Spec 01 (which has reference standards for all studies) or implement a **representative sampling protocol** where a random subset of cases gets clinician review regardless of override. This sampling protocol is the facility's responsibility.

```typescript
interface GroupMetrics {
  dimension: string;        // 'sex'
  category: string;         // 'female'
  n: number;                // sample size

  // Tier 1: Always computable (full population)
  override_rate: number;    // (modified + rejected) / total
  hard_stop_rate: number;   // hard_stops / total

  // Tier 2: Only computable when reference standard exists
  // Marked optional because they require truth data
  accuracy?: number;        // correct / total (where reference standard exists)
  sensitivity?: number;     // true positive rate for abnormality detection
  specificity?: number;     // true negative rate
  tier_2_sample_size?: number; // how many cases had reference standards
  tier_2_coverage?: number;   // tier_2_sample_size / n (selection bias indicator)

  // Agreement (continuous measures, Tier 2)
  mean_absolute_difference?: number;  // |AI - reference| for continuous measures
  icc?: number;                       // intraclass correlation for continuous
}
```

### 4. Disparity Detection

```typescript
interface DisparityResult {
  dimension: string;         // 'sex'
  metric: string;            // 'accuracy'
  reference_group: string;   // 'male' (largest group)
  comparison_group: string;  // 'female'

  reference_value: number;   // 0.94
  comparison_value: number;  // 0.82
  relative_difference: number; // 0.128 (12.8%)
  absolute_difference: number; // 0.12

  // Statistical significance (categorical metrics only — override_rate, hard_stop_rate)
  p_value?: number;          // from chi_square or fisher_exact (NOT for continuous metrics)
  test_used?: string;        // 'chi_square' | 'fisher_exact'
  statistically_significant?: boolean;

  // Disparity classification
  exceeds_threshold: boolean;  // relative_difference > disparity_threshold
  requires_mitigation: boolean; // significant AND exceeds threshold

  // Confidence interval
  ci_95: [number, number];
}
```

**Disparity threshold rationale:** A >10% relative difference in accuracy/sensitivity/specificity between demographic groups triggers review. This threshold balances:
- Clinical significance (differences >10% could affect diagnostic decisions)
- Statistical noise (differences <10% are often within measurement variability for typical sample sizes)
- NIST AI RMF guidance on fairness metrics (Govern 1.5, Measure 2.11)

For categorical outcomes (override rate, hard stop rate): Chi-square test with Yates correction (n ≥ 5 per cell) or Fisher's exact test (small samples). These produce p-values.

For continuous outcomes (mean absolute difference, ICC): Bland-Altman analysis is a **descriptive** method — it produces bias and limits of agreement, NOT a p-value. Disparity is assessed by comparing Bland-Altman bias between groups: if group A has bias = +1.2% and group B has bias = +5.8%, the relative difference in bias is the signal. The `exceeds_threshold` flag triggers on relative difference; `p_value` is only populated for categorical tests.

### 5. Mitigation Workflow (Standard VI.4)

When a disparity requiring mitigation is detected:

1. **Document** the disparity (automated by analysis library)
2. **Root cause analysis** — facility governance committee investigates:
   - Training data composition for the AI tool
   - Image quality differences across demographics (e.g., BMI affecting echo windows)
   - Reference standard bias (inter-observer variability across demographics)
   - Workflow differences (e.g., time-of-day, operator differences)
3. **Mitigation plan** — documented with:
   - Specific actions (vendor engagement, additional training data, adjusted thresholds)
   - Responsible party
   - Timeline
4. **6-month reassessment** — re-run disparity analysis and compare to baseline (Standard VI.4)

```typescript
interface MitigationPlan {
  plan_id: string;
  organization_id: string;
  created_at: IsoDateTime;

  // What triggered this plan
  triggering_disparities: DisparityResult[];

  // Root cause
  root_cause_analysis: {
    investigated_factors: string[];
    findings: string;
    root_cause: 'training_data' | 'image_quality' | 'reference_standard_bias'
      | 'workflow_variation' | 'clinical_population' | 'unknown';
  };

  // Actions
  actions: Array<{
    description: string;
    responsible_party: string;
    target_date: IsoDateTime;
    status: 'planned' | 'in_progress' | 'completed' | 'verified';
  }>;

  // Reassessment
  reassessment_due: IsoDateTime; // 6 months from creation
  reassessment_result?: {
    completed_at: IsoDateTime;
    disparities_resolved: boolean;
    comparison_to_baseline: DisparityResult[];
  };
}
```

### 6. Bias Monitoring Report

Generated by the facility-side library. Matches IAC §4 evidence for Standard VI.

```typescript
interface BiasMonitoringReport {
  report_id: string;
  organization_id: string;
  period: { start: IsoDateTime; end: IsoDateTime };
  generated_at: IsoDateTime;

  // Dataset summary
  total_studies: number;
  dimensions_analyzed: string[];

  // Disaggregated performance (Standard VI.2)
  group_metrics: GroupMetrics[];

  // Disparity results
  disparities: DisparityResult[];
  disparities_requiring_mitigation: DisparityResult[];

  // Sample size warnings
  insufficient_sample_sizes: Array<{
    dimension: string;
    category: string;
    n: number;
    minimum_required: number;
  }>;

  // Active mitigation plans
  active_mitigation_plans: MitigationPlan[];

  // Demographic data collection status (Standard VI.5)
  data_collection_gaps: Array<{
    dimension: string;
    status: 'available' | 'partial' | 'not_collected';
    plan_to_collect?: string;
  }>;
}
```

---

### 7. Return Path: Completed Report Import

The bias monitoring report is generated facility-side. For Spec 05 (report exporters) to package it into the IAC evidence bundle, the facility must upload the completed report back to Popper as a facility artifact:

```
POST /v1/organizations/{org_id}/artifacts
Content-Type: multipart/form-data
Fields:
  standard: 6
  artifact_type: "bias_monitoring_report"
  file: <completed BiasMonitoringReport JSON or PDF>
  period_start: <ISO date>
  period_end: <ISO date>
```

Popper stores this as an opaque artifact and includes it in the IAC evidence package. Popper does NOT parse the joined demographic data inside — it is passed through as-is.

This means the IAC evidence package for Standard VI contains:
1. **Popper-generated:** `export-for-join.jsonl` (raw de-identified data)
2. **Facility-uploaded:** Completed `BiasMonitoringReport` (with demographics, after facility-side join)
3. **Facility-uploaded:** Any `MitigationPlan` documents

---

## Standard VI.5: Data Collection Plan

If a facility lacks demographic data for the proposed required dimensions, proposed Standard VI.5 would require documenting a plan to begin collecting within one accreditation cycle. The bias monitoring report includes a `data_collection_gaps` section where facilities would document this status.

---

## Proposed §4 Evidence Targeted

The following maps to the §4 structure in Regain's proposed draft (not adopted IAC requirements):

| Proposed Requirement | Delivered By |
|---|---|
| Most recent bias monitoring report | `BiasMonitoringReport` (annual, per Standard VI.1) |
| Disaggregated performance data across required dimensions | `BiasMonitoringReport.group_metrics` |
| Any mitigation plans and follow-up results | `BiasMonitoringReport.active_mitigation_plans` |

---

## Acceptance Criteria

1. Popper's bias monitoring export endpoint generates de-identified JSONL with `subject_id` join key
2. Export contains no PHI, no direct identifiers, no clinician identity
3. Open-source disparity analysis library (`@regain/bias-analysis`) runs entirely facility-side
4. Library computes per-group accuracy, sensitivity, specificity, override rate, hard stop rate
5. Library detects disparities exceeding 10% relative difference threshold with statistical testing
6. Library generates `BiasMonitoringReport` matching IAC §4 evidence requirements
7. Mitigation plan template includes root cause analysis, actions, and 6-month reassessment
8. Library handles small sample sizes gracefully (warnings, Fisher's exact test for small cells)
9. Minimum three dimensions supported: sex, age group, body habitus (Standard VI.2)

---

## Sources

1. **Proposed IAC Echo Standards, Standard VI** (Regain draft, not yet submitted/adopted) — Bias Monitoring Across Patient Demographics, §4 evidence requirements
2. **NIST AI RMF 1.0** (Jan 2023) — Govern 1.5 (fairness documentation), Measure 2.11 (bias metrics)
3. **FDA AI-Enabled DSF Lifecycle Management Draft Guidance** (Jan 2025) — Bias analysis requirements across demographics
4. **04-popper-regulatory-export-and-triage.md** — De-identification rules and export bundle format
5. **03-override-analytics.md** — Override data that feeds into bias analysis
