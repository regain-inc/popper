# 05 — IAC Report Exporters

> **Version**: 0.2.0
> **Date**: 2026-03-19
> **Status**: Draft
> **Evidence Status**: Spec-backed (partial — Standard III monitoring pipeline undefined, Standard VI report is facility-side)
> **Target Proposed Standards**: I–VIII (all categories) — Regain draft, not adopted by IAC

---

## Overview

Regain's proposed §4 defines an evidence submission structure for each of the eight proposed standards. If IAC adopts a similar framework, facilities would submit documentation covering validation, supervision, performance monitoring, training, overrides, bias, multi-vendor management, and adverse events.

This spec defines seven report generators (one per proposed category, excluding Category 7 which is facility-only), a case study generator, an AI tool inventory table, and a readiness gap tracker. Together, these produce a **draft-aligned evidence package** useful for pilot scoping, internal readiness assessment, and future accreditation preparation if IAC adopts a substantially similar framework. This is not an IAC submission package — no official IAC submission lane for AI accreditation exists yet.

---

## Current State

| Capability | Status | Where |
|---|---|---|
| Export bundles (de-identified audit data) | Implemented | `04-popper-regulatory-export-and-triage.md` |
| Validation reports | Specified | `01-pre-deployment-validation.md` |
| Override review reports | Specified | `03-override-analytics.md` |
| Bias monitoring reports | Specified | `02-bias-monitoring-architecture.md` |
| Adverse event reports | Specified | `04-adverse-event-detection.md` |
| IAC-specific report exporters | **Not built** | — |
| Case study generator | **Not built** | — |
| AI tool inventory | **Not built** | — |
| Readiness self-assessment | **Not built** | — |

---

## Target State

Popper provides a unified evidence packaging system that combines Popper-generated reports with facility-uploaded artifacts to produce a structured IAC submission package. Popper generates reports for standards where it owns the data (Standards I, II, V, VIII partial). For standards where evidence is facility-owned (Standards IV, VI, VII partial), Popper provides templates and packages facility-uploaded artifacts. Standard III monitoring data pipeline is partially defined — echo-specific post-deployment performance monitoring requires additional specification (see Known Gaps below).

**This is NOT a "complete evidence package" generator.** It is a packaging tool that reduces the facility's assembly burden. Several §4 requirements depend on facility-provided artifacts that Popper cannot generate.

---

## System Boundaries

| System | Responsibility |
|---|---|
| **Popper** | Generates reports from audit trail, override analytics, drift data, adverse events. Manages AI tool inventory. Scores readiness. |
| **MISS** | Provides UI for report review, case study selection, physician sign-off |
| **Facility** | Reviews reports, adds facility-specific context (training records, governance committee minutes), signs off, submits to IAC |

---

## Architecture

### 1. Report Generator Registry

```typescript
/**
 * Each IAC standard has a corresponding report generator.
 * Standard IV (Training) is facility-only — Popper provides a template but no data.
 */
interface ReportGenerator {
  standard: number;          // IAC Standard I-VIII
  category: number;          // IAC Category 1-8
  name: string;
  description: string;
  data_sources: string[];    // which Popper tables/aggregates feed this report
  facility_input_required: boolean;
}

const REPORT_GENERATORS: ReportGenerator[] = [
  {
    standard: 1, category: 1,
    name: 'Pre-Deployment Validation Report',
    description: 'Validation protocol, results, demographics, physician sign-off',
    data_sources: ['validation_suites', 'validation_studies', 'validation_metrics'],
    facility_input_required: true, // physician sign-off
  },
  {
    standard: 2, category: 2,
    name: 'Safety Supervision Report',
    description: 'Supervision mechanism description, independence verification, discrepancy log',
    data_sources: ['audit_events', 'supervision_receipts'],
    facility_input_required: false,
  },
  {
    standard: 3, category: 4,
    name: 'Performance Monitoring Report',
    description: 'Accuracy thresholds, drift detection results, re-validation evidence',
    data_sources: ['drift_metrics', 'audit_events', 'validation_suites'],
    facility_input_required: true, // threshold definitions
  },
  {
    standard: 4, category: 7,
    name: 'Training Documentation Template',
    description: 'Template for training curriculum and competency records',
    data_sources: [],  // facility-only
    facility_input_required: true, // entirely facility-provided
  },
  {
    standard: 5, category: 3,
    name: 'Override Tracking Report',
    description: 'Override statistics, threshold definitions, investigation reports',
    data_sources: ['clinician_feedback', 'override_rates_daily', 'override_rates_by_clinician_daily'],
    facility_input_required: false,
  },
  {
    standard: 6, category: 5,
    name: 'Bias Monitoring Report',
    description: 'Disaggregated performance, disparity results, mitigation plans',
    data_sources: ['bias_monitoring_export'],  // facility-side join
    facility_input_required: true, // demographic data, mitigation plans
  },
  {
    standard: 7, category: 6,
    name: 'Multi-Vendor AI Management Report',
    description: 'AI tool inventory, conflict resolution protocols',
    data_sources: ['ai_tool_registry'],
    facility_input_required: true, // conflict resolution protocol
  },
  {
    standard: 8, category: 8,
    name: 'Adverse Event Report',
    description: 'Event log, root cause analyses, corrective actions',
    data_sources: ['adverse_events', 'incidents'],
    facility_input_required: true, // clinical context, root cause analysis
  },
];
```

### 2. Report Generation API

**Endpoint:**

```
POST /v1/organizations/{org_id}/reports/iac
Content-Type: application/json
Authorization: Bearer <api_key>
```

**Request:**

```typescript
interface IACReportRequest {
  /** Which standards to generate reports for (default: all) */
  standards?: number[];

  /** Reporting period */
  period: {
    start: IsoDateTime;
    end: IsoDateTime;
  };

  /** Output format */
  format: 'json' | 'pdf' | 'docx'; // json for machine consumption, pdf/docx for committee review packets

  /** Include case studies */
  include_case_studies?: boolean;

  /** Include readiness self-assessment */
  include_readiness_assessment?: boolean;
}
```

**Response:**

```typescript
interface IACReportBundle {
  bundle_id: string;
  organization_id: string;
  generated_at: IsoDateTime;
  period: { start: IsoDateTime; end: IsoDateTime };

  reports: {
    standard_1?: ValidationReport;       // from 01-pre-deployment-validation.md
    standard_2?: SafetySupervisionReport;
    standard_3?: PerformanceMonitoringReport;
    standard_4?: TrainingDocumentationTemplate;
    standard_5?: OverrideReviewReport;   // from 03-override-analytics.md
    standard_6?: FacilityArtifactRef;    // facility-uploaded after facility-side join (see 02-bias-monitoring-architecture.md)
    standard_7?: MultiVendorReport;
    standard_8?: AdverseEventSummaryReport; // from 04-adverse-event-detection.md
  };

  case_studies?: CaseStudy[];
  readiness_assessment?: ReadinessAssessment;
}
```

### 3. Per-Standard Report Details

#### Standard II: Safety Supervision Report

```typescript
interface SafetySupervisionReport {
  report_id: string;
  period: { start: IsoDateTime; end: IsoDateTime };

  // Supervision mechanism description (Standard II.1–II.3)
  supervision_mechanism: {
    type: 'deterministic_rule_engine';
    name: 'Popper';
    version: string;
    independence_statement: string; // "Architecturally independent of AI systems being supervised"
    policy_pack_version: string;
    ruleset_version: string;
  };

  // Performance characteristics (Standard II.4)
  performance: {
    total_supervised_actions: number;
    approved: number;
    routed_to_clinician: number;
    hard_stopped: number;
    hard_stop_rate: number;
    route_rate: number;
  };

  // Discrepancy log (Standard II.5)
  discrepancy_summary: {
    total_discrepancies: number;  // HARD_STOP + ROUTE_TO_CLINICIAN events
    by_rule_category: Array<{
      category: string;
      count: number;
      example_trace_ids: string[]; // up to 3 de-identified examples
    }>;
    resolution_summary: {
      clinician_agreed_with_supervision: number;
      clinician_overrode_supervision: number;
      pending_resolution: number;
    };
  };
}
```

#### Standard III: Performance Monitoring Report

**Known gap:** The existing Popper measurement spec (`05-popper-measurement-protocols.md`) covers Deutsch proposal accuracy ascertainment, NOT echo-specific post-deployment AI performance monitoring with AI-physician correlation, false positive/negative rates, and image quality rejection data. The `performance_metrics` fields below describe what the IAC standard requires, but the underlying data pipeline to compute them is **not yet specified**. This is the most significant open gap in the spec set.

Specifically:
- `ai_physician_correlation` requires systematic sampling of AI vs physician measurements — similar to the validation protocol but ongoing
- `detection_rates` requires truth labels (what was actually abnormal) — not available from supervision data alone
- `quality_rejection_rate` requires image quality assessment data from the AI tool itself

Until the monitoring data pipeline is specified, this report type should be marked as **not available** in readiness assessments.

```typescript
interface PerformanceMonitoringReport {
  report_id: string;
  period: { start: IsoDateTime; end: IsoDateTime };

  // Defined thresholds (Standard III.2)
  thresholds: Array<{
    metric: string;
    threshold_value: number;
    threshold_type: 'minimum' | 'maximum';
    clinically_grounded: boolean;
    source: string;
  }>;

  // Performance metrics (Standard III.3)
  performance_metrics: {
    // Correlation between AI and physician measurements
    ai_physician_correlation: Array<{
      measurement_type: string;
      sample_size: number;
      correlation: number;
      icc: number;
    }>;

    // False positive/negative rates
    detection_rates: Array<{
      condition: string;
      sensitivity: number;
      specificity: number;
      false_positive_rate: number;
      false_negative_rate: number;
    }>;

    // Image quality rejection rates
    quality_rejection_rate: number;
  };

  // Threshold breaches (Standard III.4)
  threshold_breaches: Array<{
    metric: string;
    breach_date: IsoDateTime;
    value: number;
    threshold: number;
    response_taken: string;
    ai_suspended: boolean;
  }>;

  // Committee reporting (Standard III.5)
  reported_to_committee: boolean;
  committee_review_date?: IsoDateTime;

  // Re-validation after updates (Standard III.6)
  software_updates: Array<{
    update_date: IsoDateTime;
    from_version: string;
    to_version: string;
    revalidation_suite_id?: string;
    revalidation_status: 'pending' | 'passed' | 'failed';
  }>;
}
```

#### Standard VII: Multi-Vendor AI Management Report

```typescript
interface MultiVendorReport {
  report_id: string;
  generated_at: IsoDateTime;

  // AI tool inventory (Standard VII.1)
  tool_inventory: AIToolRecord[];

  // Conflict resolution protocol (Standard VII.2–VII.3)
  conflict_resolution: {
    protocol_exists: boolean;
    protocol_summary?: string;
    precedence_rules?: Array<{
      scenario: string;
      primary_tool: string;
      rationale: string;
    }>;
    physician_adjudication_required: boolean;
  };

  // Governance (Standard VII.4)
  governance: {
    designated_individual_or_committee: string;
    governance_scope: string;
  };
}
```

### 4. AI Tool Inventory (Standard VII.1)

New table for multi-vendor governance:

```sql
CREATE TABLE ai_tool_registry (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL,

  -- Tool identification (Standard VII.1)
  vendor_name      TEXT NOT NULL,
  product_name     TEXT NOT NULL,
  version          TEXT NOT NULL,
  model_number     TEXT,         -- manufacturer model/catalog number (for MedWatch 3500A Section D)
  fda_clearance    TEXT,         -- 510(k) number or De Novo
  fda_status       TEXT NOT NULL DEFAULT 'unknown', -- 'cleared' | 'authorized' | 'pending' | 'exempt' | 'unknown'
  intended_use     TEXT NOT NULL,
  deployment_date  TIMESTAMPTZ,

  -- Modality and scope
  modality         TEXT NOT NULL,  -- 'echo' | 'ct' | 'nuclear_pet'
  measurement_types TEXT[] NOT NULL DEFAULT '{}', -- which measurements this tool generates

  -- Status
  status           TEXT NOT NULL DEFAULT 'active', -- 'active' | 'suspended' | 'retired'
  retired_at       TIMESTAMPTZ,
  retirement_reason TEXT,

  -- Metadata
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (organization_id, vendor_name, product_name, version)
);

CREATE INDEX idx_atr_org ON ai_tool_registry (organization_id);
CREATE INDEX idx_atr_org_status ON ai_tool_registry (organization_id, status);
```

```typescript
interface AIToolRecord {
  id: string;
  vendor_name: string;
  product_name: string;
  version: string;
  model_number?: string;      // manufacturer model/catalog number
  fda_clearance?: string;
  fda_status: 'cleared' | 'authorized' | 'pending' | 'exempt' | 'unknown';
  intended_use: string;
  deployment_date?: IsoDateTime;
  modality: string;
  measurement_types: string[];
  status: 'active' | 'suspended' | 'retired';
}
```

### 5. Case Study Generator (§4 Case Study Requirements)

IAC §4 requires at minimum 3 case studies:
1. AI and physician agreed on findings
2. Clinician overrode or modified AI output
3. Supervision mechanism identified a discrepancy

Popper auto-selects candidate cases and generates de-identified templates.

```typescript
interface CaseStudyCandidate {
  proposal_id: string;   // proposal-level identity (NOT trace_id — traces may contain multiple proposals)
  trace_id: string;      // for audit trail linkage
  case_type: 'agreement' | 'override' | 'discrepancy';
  score: number;         // relevance score for selection

  // Selection criteria
  selection_reason: string;
}

interface CaseStudy {
  case_study_id: string;
  case_type: 'agreement' | 'override' | 'discrepancy';

  // Per IAC §4 case study requirements
  clinical_context: string;        // de-identified, auto-generated from audit data
  ai_output: {
    measurement_type: string;
    ai_value?: number;
    ai_classification?: string;
    confidence?: number;
  };
  physician_interpretation: {
    value?: number;
    classification?: string;
    notes?: string;               // facility completes
  };
  supervision_result?: {
    decision: string;             // APPROVED, ROUTE_TO_CLINICIAN, HARD_STOP
    rules_triggered: string[];
    reason_codes: string[];
  };
  final_clinical_decision: string; // facility completes
}
```

**Auto-selection algorithm:**

1. **Agreement cases:** Select from `clinician_feedback` where `action = 'accepted'` (clinician agreed with AI). For cases where AI was APPROVED by Popper without clinician review, there is no explicit agreement event — these cases are only usable if the facility provides retrospective physician review via the validation dataset. Prioritize cases with interesting clinical context (e.g., borderline normal/abnormal)
2. **Override cases:** Select cases where clinician modified AI output with clear rationale (prefer high-confidence overrides with documented reasoning)
3. **Discrepancy cases:** Select HARD_STOP or ROUTE_TO_CLINICIAN events with documented resolution

All auto-selected cases are de-identified. The facility reviews, adds clinical context, and selects final 3+ cases for submission.

### 6. Facility Readiness Self-Assessment

Auto-scores readiness from Popper data and flags items requiring facility self-assessment.

```typescript
interface ReadinessAssessment {
  assessment_id: string;
  organization_id: string;
  generated_at: IsoDateTime;

  // No numeric score — accreditation readiness is not a 0-100 scale.
  // Instead: per-standard gap matrix with evidence status.
  overall_status: 'all_evidence_present' | 'gaps_remain' | 'critical_gaps';
  total_requirements: number;
  met_count: number;
  partial_count: number;
  not_met_count: number;
  facility_input_needed_count: number;

  by_standard: Array<{
    standard: number;
    category: number;
    name: string;

    // Per-requirement evidence status (not a numeric score)
    evidence_items: Array<{
      requirement: string;         // IAC §4 requirement text
      owner: 'popper' | 'facility' | 'shared';
      status: 'met' | 'partial' | 'not_met' | 'requires_facility_input';
      evidence_location?: string;  // file path in evidence package
      data_source?: string;        // which Popper table/aggregate backs this
      notes?: string;
    }>;

    // Items that only the facility can assess
    facility_self_assessment_items: Array<{
      requirement: string;
      description: string;
      guidance: string;
    }>;
  }>;
}
```

**Scoring rules:**

| Standard | What Popper Can Auto-Score | What Requires Facility Input |
|---|---|---|
| I (Validation) | Validation suite exists, metrics computed, demographics tracked | Physician sign-off status |
| II (Supervision) | Popper is deployed and supervising, discrepancy log populated | Independence documentation |
| III (Monitoring) | Drift detection active, thresholds defined, breach responses logged | Committee review evidence |
| IV (Training) | Nothing — entirely facility-side | All training records |
| V (Overrides) | Override data collected, aggregates computed, thresholds defined | Investigation reports |
| VI (Bias) | Export available, analysis library provided | Demographic data available, mitigation plans |
| VII (Multi-Vendor) | AI tool inventory populated | Conflict resolution protocol |
| VIII (Adverse Events) | Detection signals active, event tracking operational | Root cause analyses, MedWatch submissions |

---

## Unified Export Endpoint

**Generate draft-aligned evidence package** (for pilot scoping, internal readiness, and future accreditation preparation):

```
POST /v1/organizations/{org_id}/reports/iac/package
```

Returns a ZIP archive containing:
```
iac-evidence-package/
├── manifest.json
├── standard-1-validation/
│   ├── validation-report.json
│   └── demographic-summary.json
├── standard-2-supervision/
│   ├── supervision-report.json
│   └── discrepancy-log.jsonl
├── standard-3-monitoring/
│   ├── performance-report.json
│   └── threshold-breaches.json
├── standard-4-training/
│   └── template.json           (facility completes)
├── standard-5-overrides/
│   ├── override-report.json
│   └── investigation-reports.json
├── standard-6-bias/
│   ├── export-for-join.jsonl   (facility joins with demographics)
│   └── analysis-template.json
├── standard-7-multivendor/
│   ├── tool-inventory.json
│   └── governance-report.json
├── standard-8-adverse-events/
│   ├── event-summary.json
│   └── corrective-actions.json
├── case-studies/
│   ├── candidates.json
│   └── template.json
└── readiness-assessment.json
```

---

## Proposed Evidence Crosswalk to Regain Draft §4

This is an internal crosswalk mapping Popper outputs to the §4 evidence structure in Regain's proposed draft. This is NOT an approved IAC submission checklist — no such checklist exists. If IAC modifies the evidence requirements, this mapping will need to be updated.

| Proposed §4 Requirement | Proposed Standard | Report / Section |
|---|---|---|
| Validation protocol document | I | `standard-1-validation/validation-report.json` → `validation_protocol` |
| Validation results with statistical summary | I | `standard-1-validation/validation-report.json` → `metrics` |
| Demographic breakdown of validation dataset | I | `standard-1-validation/demographic-summary.json` |
| Physician sign-off | I | `standard-1-validation/validation-report.json` → `sign_off` |
| Supervision mechanism description | II | `standard-2-supervision/supervision-report.json` → `supervision_mechanism` |
| Independence verification | II | `standard-2-supervision/supervision-report.json` → `supervision_mechanism.independence_statement` |
| Discrepancy log | II | `standard-2-supervision/discrepancy-log.jsonl` |
| Two most recent performance reviews | III | `standard-3-monitoring/performance-report.json` (covers most recent period; prior period stored) |
| Defined thresholds document | III | `standard-3-monitoring/performance-report.json` → `thresholds` |
| Response protocol for breaches | III | `standard-3-monitoring/threshold-breaches.json` |
| Re-validation after updates | III | `standard-3-monitoring/performance-report.json` → `software_updates` |
| Training curriculum | IV | `standard-4-training/template.json` (facility completes) |
| Training completion records | IV | Facility-provided |
| Competency assessment results | IV | Facility-provided |
| Override log summary statistics | V | `standard-5-overrides/override-report.json` |
| Two most recent review reports | V | `standard-5-overrides/override-report.json` (covers most recent period) |
| Threshold definitions + investigations | V | `standard-5-overrides/investigation-reports.json` |
| Most recent bias monitoring report | VI | `standard-6-bias/` (facility completes after join) |
| Disaggregated performance data | VI | `standard-6-bias/export-for-join.jsonl` (raw data for facility join) |
| Mitigation plans + follow-up | VI | Facility-provided (library generates template) |
| Current AI tool inventory | VII | `standard-7-multivendor/tool-inventory.json` |
| Conflict resolution protocol | VII | `standard-7-multivendor/governance-report.json` (facility completes) |
| Governance designation | VII | `standard-7-multivendor/governance-report.json` |
| Adverse event reporting policy | VIII | `standard-8-adverse-events/event-summary.json` |
| Near-miss and adverse event log | VIII | `standard-8-adverse-events/event-summary.json` |
| Root-cause analyses | VIII | `standard-8-adverse-events/event-summary.json` → `root_cause` |
| Corrective action documentation | VIII | `standard-8-adverse-events/corrective-actions.json` |
| Case studies (3 minimum) | §4 | `case-studies/` |

---

## Known Gaps

| Gap | Standard | Impact | Resolution Path |
|---|---|---|---|
| **Standard III monitoring pipeline** | III | CRITICAL — no data source for AI-physician correlation, detection rates, quality rejection | Requires new spec: echo-specific post-deployment monitoring with representative sampling protocol |
| **Independence verification evidence** | II | MAJOR — `independence_statement` is a static string, not auditable evidence | Facility must upload independence documentation (architecture diagram, vendor attestation) as artifact |
| **Two-period report storage** | III, V | MAJOR — spec says "prior period stored" but no persistence model defined | Add report archive table; store generated reports with period metadata |
| **Training record integration** | IV | MINOR — template exists but no artifact upload/packaging path defined | Use facility artifact intake from context file §Facility Artifact Intake |
| **Conflict resolution protocol capture** | VII | MAJOR — `protocol_summary` is a text field, not a structured document | Facility uploads protocol as artifact; Popper packages it |
| **Adverse event reporting policy** | VIII | MAJOR — currently mapped to `event-summary.json` but a policy document is different from an event log | Facility uploads policy document as artifact |

---

## Acceptance Criteria

1. Report generators for Standards I, II, V produce valid JSON from Popper-owned data
2. Standard III report is flagged as **incomplete** in readiness assessment until monitoring pipeline is specified
3. Standard IV template is generated; facility artifacts are packaged alongside
4. Standard VI evidence package contains Popper export + facility-uploaded completed report
5. Case study generator auto-selects at least 3 candidates using `proposal_id` keys (1 agreement, 1 override, 1 discrepancy)
6. Case studies are de-identified with no PHI
7. AI tool inventory (`ai_tool_registry`) supports CRUD operations
8. Readiness assessment provides per-requirement gap matrix (no numeric score) with evidence owner and status
9. Unified export endpoint packages Popper-generated reports + facility-uploaded artifacts into ZIP
10. Facility artifact intake endpoint accepts uploads for Standards II, IV, VI, VII, VIII
11. Reports for two consecutive periods can be generated and archived (IAC requires "most recent two" for Standards III and V)
12. All reports are scoped to `organization_id` — no cross-org data leakage

---

## Sources

1. **Proposed IAC Echo Standards, §4** (Regain draft, not yet submitted/adopted) — Evidence Requirements for all proposed Standards I–VIII
2. **Proposed IAC Echo Standards, §4 Case Study Requirements** — Minimum 3 case studies (proposed)
3. **01-pre-deployment-validation.md** — ValidationReport interface
4. **02-bias-monitoring-architecture.md** — BiasMonitoringReport interface, facility-side join architecture
5. **03-override-analytics.md** — OverrideReviewReport interface, continuous aggregates
6. **04-adverse-event-detection.md** — AdverseEvent, RootCauseAnalysis, MedWatchExport interfaces
7. **04-popper-regulatory-export-and-triage.md** — Export bundle format and de-identification rules
