# 04 — Adverse Event Detection

> **Version**: 0.2.0
> **Date**: 2026-03-19
> **Status**: Draft
> **Evidence Status**: Spec-backed (detection signals depend on Spec 03 override data being implemented first)
> **Target Proposed Standard**: VIII (Category 8 — Adverse Event Reporting) — Regain draft, not adopted by IAC

---

## Overview

Proposed IAC Standard VIII (Regain's draft, not yet submitted to or adopted by IAC) would require facilities to have an adverse event identification and reporting process specific to AI, track near-miss events, conduct root-cause analysis for each event, implement corrective actions, and report to the FDA via MedWatch when required.

Popper currently has an `incidents` table for drift-triggered safety incidents and an export bundle system for regulatory reporting. What is missing: formal adverse event detection criteria, near-miss classification, structured root cause analysis, corrective action tracking, and MedWatch-compatible export.

This spec extends Popper's existing incident infrastructure to cover AI-specific adverse events targeting the proposed Standard VIII. If IAC modifies the requirements, the detection criteria and root cause template can adapt.

---

## Current State

| Capability | Status | Where |
|---|---|---|
| Incident table (drift threshold breaches, safe-mode) | Implemented | `packages/db/src/schema/incidents.ts` |
| Safe-mode circuit breaker | Implemented | Popper control plane |
| Export bundles (de-identified) | Implemented | `04-popper-regulatory-export-and-triage.md` |
| Override analytics | Specified | `03-override-analytics.md` (this spec set) |
| AI-specific adverse event detection | **Not built** | — |
| Near-miss classification | **Not built** | — |
| Root cause analysis template | **Not built** | — |
| Corrective action tracking | **Not built** | — |
| MedWatch 3500A export | **Not built** | — |

---

## Target State

Popper detects AI-related adverse events and near-misses from its audit trail and override data, classifies them by severity and detection method, provides structured root cause analysis templates, tracks corrective actions to completion, and exports adverse event data in a format compatible with FDA MedWatch 3500A reporting.

---

## System Boundaries

| System | Responsibility |
|---|---|
| **Popper** | Detects adverse event signals, classifies near-misses, provides root cause templates, tracks corrective actions, exports MedWatch-compatible data |
| **MISS** | Clinical context for adverse events (patient outcome data), clinician input for root cause analysis |
| **Facility** | Determines clinical outcome (was patient harmed?), conducts root cause analysis, decides on FDA reporting, submits MedWatch forms, notifies AI vendor |

**Critical boundary:** Popper can detect **signals** of potential adverse events (override patterns, HARD_STOP followed by override, drift breaches). Popper **cannot** determine clinical outcomes — only the facility knows whether a patient was harmed. The facility makes the final adverse event determination.

---

## Architecture

### 1. Adverse Event Taxonomy

```typescript
/**
 * Severity classification for AI-related events.
 */
type AdverseEventSeverity =
  | 'adverse_event'    // Patient harm occurred or may have occurred
  | 'near_miss'        // Error caught before patient impact
  | 'potential_signal'; // Pattern suggesting elevated risk

/**
 * How the event was detected.
 */
type DetectionMethod =
  | 'caught_by_popper'      // Popper supervision flagged the issue (HARD_STOP, drift alert)
  | 'caught_by_clinician'   // Clinician override caught an AI error
  | 'caught_by_drift_alert' // Drift monitoring detected sustained anomaly
  | 'reported_by_facility'  // Facility reported outcome-based event
  | 'automated_pattern';    // Automated pattern detection (see §2)

/**
 * Root cause factor categories per proposed Standard VIII.4.
 */
type RootCauseFactor =
  | 'ai_system'            // AI model error, training data issue, edge case
  | 'supervision_mechanism' // Popper rule gap, threshold misconfiguration
  | 'clinician'            // Override error, alert fatigue, training gap
  | 'workflow'             // Process failure, handoff error, timing issue
  | 'data_quality';        // Image quality, incomplete data, artifact
```

### 2. Detection Criteria

Popper monitors for the following event signals automatically:

**Signal 1: HARD_STOP → Override → Unknown Outcome**

A HARD_STOP was issued (Popper flagged a safety concern), but the clinician overrode it. This is a potential adverse event signal — the supervision system tried to intervene and was overridden.

```typescript
interface HardStopOverrideSignal {
  signal_type: 'hard_stop_override';
  trace_id: string;
  hard_stop_rule_id: string;
  hard_stop_reason: string;
  override_action: ClinicianAction; // 'modified' or 'rejected' (of the HARD_STOP)
  override_rationale: RationaleCategory;
  severity: 'potential_signal'; // elevated to 'adverse_event' if facility reports harm
}
```

Detection: Query `clinician_feedback` for records where `supervision_decision = 'HARD_STOP'` and `action IN ('modified', 'rejected')`. The `supervision_decision` field is populated at ingestion time by joining the feedback event with the original audit event (see Spec 03, §2 Storage). This signal only fires for cases where a HARD_STOP was issued AND the clinician subsequently overrode it — which requires MISS to emit a `ClinicianFeedbackEvent` even for HARD_STOP scenarios, not just ROUTE_TO_CLINICIAN.

**Hermes contract note:** The current `ClinicianFeedbackEvent` is described as capturing what happens "AFTER ROUTE_TO_CLINICIAN decisions." If HARD_STOP overrides also need tracking, the Hermes contract must be extended to emit feedback events for HARD_STOP scenarios too — or a separate `HardStopOverrideEvent` must be defined. This is a **dependency on Hermes v2.1+**.

**Signal 2: Sustained Drift Breach**

Drift detection shows sustained performance degradation beyond thresholds.

```typescript
interface DriftBreachSignal {
  signal_type: 'sustained_drift_breach';
  drift_metric: string;
  breach_duration_hours: number;
  current_value: number;
  threshold_value: number;
  baseline_value: number;
  severity: 'potential_signal';
}
```

Detection: Existing drift detection system (already triggers incidents). This spec adds adverse event classification to drift incidents that persist beyond a configurable window (default: 24 hours).

**Signal 3: Systematic Override Pattern**

A specific measurement type or rule has a sustained override rate significantly above baseline, suggesting systematic AI error.

```typescript
interface SystematicOverrideSignal {
  signal_type: 'systematic_override';
  measurement_type: string;
  override_rate: number;
  baseline_rate: number;
  relative_increase: number; // > 2x baseline = signal
  period_days: number;
  severity: 'potential_signal';
}
```

Detection: Query `override_rates_daily` continuous aggregate (from `03-override-analytics.md`) for measurement types where override rate exceeds 2x the rolling 90-day baseline.

**Signal 4: Facility-Reported Adverse Event**

Facility reports a clinical outcome where AI output contributed to harm.

```typescript
interface FacilityReportedEvent {
  signal_type: 'facility_reported';
  reported_by: string; // facility user ID
  patient_outcome: string;
  ai_contribution: string;
  severity: 'adverse_event'; // facility has confirmed harm
}
```

Detection: Manual report via API endpoint `POST /v1/adverse-events`.

### 3. Adverse Event Record

Extends the existing `incidents` table schema:

```typescript
interface AdverseEvent {
  // Inherited from Incident
  id: string;
  organization_id: string;
  created_at: IsoDateTime;

  // Adverse event specific
  event_type: 'adverse_event' | 'near_miss' | 'potential_signal';
  detection_method: DetectionMethod;
  detection_signals: Array<{
    signal_type: string;
    signal_data: Record<string, unknown>;
    detected_at: IsoDateTime;
  }>;

  // Clinical context (populated by facility via MISS)
  clinical_context?: {
    ai_output_summary: string;       // de-identified
    clinician_action_summary: string; // de-identified
    patient_outcome?: string;         // de-identified, facility-provided
    supervision_decision: string;
    time_to_detection?: number;       // hours from AI output to event detection
  };

  // Root cause analysis (Standard VIII.4)
  root_cause?: RootCauseAnalysis;

  // Corrective actions (Standard VIII.5)
  corrective_actions: CorrectiveAction[];

  // Reporting
  vendor_notified: boolean;
  vendor_notified_at?: IsoDateTime;
  fda_reportable: boolean;
  medwatch_submitted: boolean;
  medwatch_submitted_at?: IsoDateTime;
  medwatch_report_number?: string;

  // Status
  status: 'detected' | 'investigating' | 'root_cause_complete' | 'corrective_action_planned'
    | 'corrective_action_in_progress' | 'corrective_action_completed' | 'verified' | 'closed';

  // Review
  reviewed_by?: string;
  reviewed_at?: IsoDateTime;
  next_review_due?: IsoDateTime; // quarterly per Standard VIII.6
}
```

### 4. Root Cause Analysis Template (Standard VIII.4)

```typescript
interface RootCauseAnalysis {
  analysis_id: string;
  adverse_event_id: string;
  conducted_by: string;
  conducted_at: IsoDateTime;

  // Per Standard VIII.4: evaluate each factor
  factors: Array<{
    factor: RootCauseFactor;
    contributed: boolean;
    findings: string;
    evidence: string[];
  }>;

  // AI system factors
  ai_system_analysis?: {
    model_version: string;
    input_quality: 'adequate' | 'degraded' | 'poor';
    known_limitation: boolean;
    similar_prior_events: number;
    vendor_aware: boolean;
  };

  // Supervision mechanism factors
  supervision_analysis?: {
    rule_fired: boolean;
    rule_id?: string;
    threshold_appropriate: boolean;
    detection_latency_hours?: number;
  };

  // Clinician factors
  clinician_analysis?: {
    override_involved: boolean;
    training_current: boolean;
    alert_fatigue_indicators: boolean; // response_time < 10s suggests auto-dismiss
    workload_context?: string;
  };

  // Workflow factors
  workflow_analysis?: {
    handoff_involved: boolean;
    time_pressure: boolean;
    process_deviation: boolean;
    contributing_workflow_step?: string;
  };

  // Data quality factors
  data_quality_analysis?: {
    image_quality: 'good' | 'adequate' | 'poor';
    missing_data: boolean;
    artifact_present: boolean;
    contributing_factor_description?: string;
  };

  // Summary
  primary_root_cause: RootCauseFactor;
  contributing_factors: RootCauseFactor[];
  summary: string;
  recommendations: string[];
}
```

### 5. Corrective Action Tracking (Standard VIII.5)

```typescript
interface CorrectiveAction {
  action_id: string;
  adverse_event_id: string;

  // Action details
  description: string;
  responsible_party: string;
  target_date: IsoDateTime;

  // Tracking
  status: 'planned' | 'in_progress' | 'completed' | 'verified';
  started_at?: IsoDateTime;
  completed_at?: IsoDateTime;
  verified_at?: IsoDateTime;
  verified_by?: string;

  // Verification
  verification_method?: string;
  verification_result?: string;

  // Vendor/FDA notification (Standard VIII.5)
  requires_vendor_notification: boolean;
  requires_fda_notification: boolean;
}
```

### 6. MedWatch 3500A Export (Standard VIII.5)

When a facility determines an adverse event is FDA-reportable, Popper generates a pre-populated MedWatch-compatible data structure. The facility completes facility-specific fields and submits.

```typescript
interface MedWatchExport {
  // Section A: Patient Information (facility completes — Popper has no PHI)
  section_a: {
    // Popper pre-fills: none (PHI-blind)
    // Facility completes: patient identifiers, age, sex, weight
  };

  // Section B: Adverse Event or Product Problem
  section_b: {
    // Popper pre-fills:
    event_description: string;        // de-identified summary of AI event
    date_of_event: string;            // from adverse event record
    outcomes: string[];               // if facility-reported
    // Facility completes: detailed clinical narrative
  };

  // Section D: Suspect Medical Device
  section_d: {
    // Popper pre-fills:
    brand_name: string;               // from AI tool registry
    manufacturer: string;             // from AI tool registry
    model_number: string;             // from AI tool registry
    device_type: 'AI/ML-enabled Software as a Medical Device (SaMD)';
    fda_clearance_number?: string;    // from AI tool registry (510(k) number)
    // Software version
    software_version: string;         // from AI tool registry
  };

  // Section G: Reporter Information (facility completes)
  section_g: {
    // Popper pre-fills: none
    // Facility completes: reporter identity, facility info
  };

  // Popper-specific supplement
  supplement: {
    popper_adverse_event_id: string;
    root_cause_summary: string;
    corrective_actions_summary: string;
    supervision_decision_at_time: string;
    override_details?: string;
    related_trace_ids: string[];
    export_bundle_ref?: string;      // link to export bundle for this event
  };
}
```

### 7. Near-Miss Classification

Near-misses are errors caught before patient impact. Proposed Standard VIII.3 would require tracking them using the same reporting process.

| Detection Method | Classification | Example |
|---|---|---|
| `caught_by_popper` | HARD_STOP prevented incorrect output from reaching clinician | Popper flagged EF < 10% as physiologically implausible |
| `caught_by_clinician` | Clinician override corrected AI error | AI reported EF 55%, clinician measured 35% |
| `caught_by_drift_alert` | Drift monitoring detected degradation before clinical impact | EF accuracy dropped 15% over 48 hours, auto-alert fired |

Near-misses flow through the same `AdverseEvent` structure with `event_type: 'near_miss'`. They require the same root cause analysis (Standard VIII.4) but do not require MedWatch reporting.

---

## Database Schema Extension

The existing `incidents` table is extended (not replaced) with an `adverse_events` table:

```sql
CREATE TABLE adverse_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id     UUID REFERENCES incidents(id),  -- link to existing incident if applicable
  organization_id UUID NOT NULL,

  event_type      TEXT NOT NULL,  -- 'adverse_event' | 'near_miss' | 'potential_signal'
  detection_method TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'detected',

  -- Detection signals (JSONB array)
  detection_signals JSONB NOT NULL DEFAULT '[]',

  -- Clinical context (facility-provided, de-identified)
  clinical_context JSONB,

  -- Root cause analysis
  root_cause      JSONB,

  -- Corrective actions
  corrective_actions JSONB NOT NULL DEFAULT '[]',

  -- Reporting status
  vendor_notified    BOOLEAN NOT NULL DEFAULT FALSE,
  vendor_notified_at TIMESTAMPTZ,
  fda_reportable     BOOLEAN NOT NULL DEFAULT FALSE,
  medwatch_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  medwatch_submitted_at TIMESTAMPTZ,
  medwatch_report_number TEXT,

  -- Review tracking
  reviewed_by     UUID,
  reviewed_at     TIMESTAMPTZ,
  next_review_due TIMESTAMPTZ,

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ae_org_status ON adverse_events (organization_id, status);
CREATE INDEX idx_ae_org_type ON adverse_events (organization_id, event_type);
CREATE INDEX idx_ae_incident ON adverse_events (incident_id);
CREATE INDEX idx_ae_review_due ON adverse_events (next_review_due) WHERE status != 'closed';
```

Regular PostgreSQL table (not hypertable) — adverse events are low-volume and need fast access by ID. Follows the same pattern as the existing `incidents` table.

---

## Proposed §4 Evidence Targeted

The following maps to the §4 structure in Regain's proposed draft (not adopted IAC requirements):

| Proposed Requirement | Delivered By |
|---|---|
| AI-specific adverse event reporting policy | System design + facility policy document |
| Near-miss and adverse event log summary | `adverse_events` table, queryable and exportable |
| Root-cause analyses for any reported events | `RootCauseAnalysis` structured template |
| Corrective action documentation | `CorrectiveAction` tracking with status lifecycle |

---

## Acceptance Criteria

1. Popper detects HARD_STOP→override signals automatically from `clinician_feedback` and `audit_events`
2. Sustained drift breaches (>24h default) are auto-classified as potential adverse event signals
3. Systematic override patterns (>2x baseline) are auto-classified as potential adverse event signals
4. Facilities can report adverse events via `POST /v1/adverse-events`
5. Root cause analysis template covers all five factor categories per Standard VIII.4
6. Corrective actions track through planned → in_progress → completed → verified lifecycle
7. MedWatch export pre-populates Section B (event) and Section D (device) from Popper data
8. Near-misses flow through the same workflow as adverse events (Standard VIII.3)
9. Quarterly review reminders are generated for open adverse events (Standard VIII.6)
10. All adverse event data is de-identified (no patient names, MRNs, or direct identifiers)

---

## Sources

1. **Proposed IAC Echo Standards, Standard VIII** (Regain draft, not yet submitted/adopted) — Adverse Event Identification and Reporting, §4 evidence requirements
2. **FDA MedWatch Form 3500A** — Mandatory reporting form structure for medical device adverse events
3. **IEC 62304:2006+Amd1:2015** — Medical device software lifecycle, incident handling requirements
4. **ISO 14971:2019** — Risk management for medical devices, post-market surveillance
5. **04-popper-regulatory-export-and-triage.md** — Existing incident and export infrastructure
6. **03-override-analytics.md** — Override data feeding into adverse event detection signals
