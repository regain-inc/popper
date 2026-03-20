# 03 — Override Analytics

> **Version**: 0.2.0
> **Date**: 2026-03-19
> **Status**: Draft
> **Evidence Status**: Spec-backed
> **Target Proposed Standard**: V (Category 3 — Clinician Override Tracking) — Regain draft, not adopted by IAC

---

## Overview

Proposed IAC Standard V (Regain's draft, not yet submitted to or adopted by IAC) would require facilities to track all clinician overrides of AI-generated echocardiographic outputs, review override data at defined intervals, define investigation thresholds, and maintain aggregate statistics by measurement type and by clinician. This spec builds against the proposed standard as a design target. If IAC modifies the requirements, the implementation will adapt accordingly.

Popper currently captures supervisory decisions (APPROVED, ROUTE_TO_CLINICIAN, HARD_STOP) in its audit trail. What happens **after** ROUTE_TO_CLINICIAN — the clinician's accept/modify/reject decision and their rationale — is captured by MISS via Hermes `ClinicianFeedbackEvent` but is not ingested or analyzed by Popper.

This spec closes that gap.

---

## Current State

| Capability | Status | Where |
|---|---|---|
| Supervision verdicts (APPROVED, ROUTE_TO_CLINICIAN, HARD_STOP) | Implemented | Popper audit trail |
| Clinician feedback capture (action, rationale, response time) | Implemented | MISS → Hermes `ClinicianFeedbackEvent` |
| Clinician feedback ingestion into Popper | **Not built** | — |
| Override rate aggregation | **Not built** | — |
| Threshold-based investigation triggers | **Not built** | — |
| Override review reports for governance committee | **Not built** | — |

---

## Target State

Popper ingests clinician feedback from MISS, stores it in a TimescaleDB hypertable, computes continuous aggregates for override rates, and generates investigation triggers and review reports targeting the proposed IAC Standard V §4 evidence requirements.

---

## System Boundaries

| System | Responsibility |
|---|---|
| **MISS** | Captures clinician feedback via UI, emits `ClinicianFeedbackEvent` to Popper |
| **Popper** | Ingests feedback, stores in hypertable, computes aggregates, generates reports |
| **Facility** | Governance committee reviews reports, conducts investigations, submits to IAC |

---

## Architecture

### 1. Feedback Ingestion

MISS emits Hermes `ClinicianFeedbackEvent` objects (see `hermes/src/types/feedback.ts`). Popper receives these via a new endpoint.

**Endpoint:**

```
POST /v1/feedback
Content-Type: application/json
Authorization: Bearer <api_key>
```

**Request body:** A valid Hermes `ClinicianFeedbackEvent`.

**Validation:**
- MUST be a valid Hermes message (`validateHermesMessage` — schema enforces `additionalProperties: false`)
- `message_type` MUST be `'clinician_feedback'`
- `original_trace_id` MUST reference a supervision request in Popper's audit trail
- `original_proposal_id` MUST be present (required by Hermes contract)
- `subject.organization_id` MUST match the API key's scope (org is on `subject`, not `trace`)
- **Idempotency:** Deduplicate on `trace.trace_id`. If a feedback event with the same `trace.trace_id` already exists, return `200 OK` with the existing record. Do NOT insert a duplicate.
- **Orphan handling:** If `original_trace_id` references a trace not found (compressed, archived, or not yet ingested), return `202 Accepted` and queue for deferred join. Retry join hourly for 72 hours, then mark as orphaned.

**Response:** `201 Created` with `{ feedback_id, trace_id }` (or `200 OK` if deduplicated).

### 2. Storage: `clinician_feedback` Hypertable

The schema is derived from the Hermes `ClinicianFeedbackEvent` type (`hermes/src/types/feedback.ts`). Fields map 1:1 to the Hermes contract — no invented fields. Echo-specific derived data (measurement_type, ai_value, clinician_value) is NOT stored here; it lives in a joined view against audit_events.

```sql
CREATE TABLE clinician_feedback (
  occurred_at        TIMESTAMPTZ NOT NULL,  -- from ClinicianFeedbackEvent.occurred_at
  feedback_id        UUID NOT NULL DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL,         -- from subject.organization_id (NOT trace)

  -- Hermes identity keys
  trace_id           TEXT NOT NULL UNIQUE,  -- from trace.trace_id (dedupe key)
  original_trace_id  TEXT NOT NULL,         -- from original_trace_id
  original_proposal_id TEXT NOT NULL,       -- from original_proposal_id (REQUIRED by Hermes)
  subject_id         TEXT NOT NULL,         -- from subject.subject_id

  -- Clinician decision (direct Hermes mapping)
  action             TEXT NOT NULL,         -- ClinicianAction: 'accepted'|'modified'|'rejected'|'deferred'
  rationale_category TEXT NOT NULL,         -- rationale.category (RationaleCategory)
  rationale_summary  TEXT,                  -- rationale.summary (max 500 chars, PHI-minimized)
  confidence         TEXT,                  -- rationale.confidence: 'low'|'medium'|'high'

  -- Clinician ref (pseudonymous)
  clinician_id       TEXT NOT NULL,         -- clinician_ref.clinician_id (pseudonymous)
  clinician_role     TEXT NOT NULL,         -- clinician_ref.role
  clinician_specialty TEXT,                 -- clinician_ref.specialty

  -- Timing
  response_time_seconds INTEGER,            -- response_time_seconds (alert fatigue)

  -- Demographics (clinical context only — NOT full demographic data)
  age_group          TEXT,                  -- demographic_context.age_group

  -- Modified action (if action = 'modified')
  modified_action_summary TEXT,             -- modified_action.summary
  modified_intervention_kind TEXT,          -- modified_action.intervention_kind

  -- Supervision context (joined from audit_events at ingestion)
  supervision_decision TEXT,                -- original supervision verdict (APPROVED/ROUTE_TO_CLINICIAN/HARD_STOP)

  -- Metadata
  snapshot_id        TEXT,                  -- snapshot_ref.snapshot_id
  mode               TEXT,                  -- mode (advocate_clinical, etc.)
  ingested_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (occurred_at, feedback_id)
);

-- Convert to hypertable
SELECT create_hypertable('clinician_feedback', 'occurred_at',
  chunk_time_interval => INTERVAL '1 week');

-- Compression after 30 days (regulatory data, query less after first month)
ALTER TABLE clinician_feedback SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'organization_id',
  timescaledb.compress_orderby = 'occurred_at DESC'
);
SELECT add_compression_policy('clinician_feedback', INTERVAL '30 days');

-- Retention: 7 years (HIPAA audit requirement)
SELECT add_retention_policy('clinician_feedback', INTERVAL '7 years');
```

**Indexes:**

```sql
CREATE INDEX idx_cf_org_action ON clinician_feedback (organization_id, action, occurred_at DESC);
CREATE INDEX idx_cf_org_clinician ON clinician_feedback (organization_id, clinician_id, occurred_at DESC);
CREATE INDEX idx_cf_original_trace ON clinician_feedback (original_trace_id);
CREATE INDEX idx_cf_original_proposal ON clinician_feedback (original_proposal_id);
CREATE INDEX idx_cf_supervision ON clinician_feedback (organization_id, supervision_decision, occurred_at DESC);
```

**Echo-specific measurement data:** Fields like `measurement_type`, `ai_value`, and `clinician_value` are NOT part of the Hermes `ClinicianFeedbackEvent`. They come from the original `SupervisionRequest` in the audit trail. To get per-measurement override analytics, join `clinician_feedback` with `audit_events` on `original_proposal_id`:

```sql
-- View for echo measurement-level override analysis
CREATE VIEW feedback_with_measurements AS
SELECT
  cf.*,
  ae.measurement_type,  -- from audit event metadata
  ae.ai_value,
  (cf.modified_action_summary)::jsonb ->> 'clinician_value' AS clinician_value
FROM clinician_feedback cf
LEFT JOIN audit_events ae ON cf.original_proposal_id = ae.proposal_id;
```

### 3. Continuous Aggregates

**Daily override rates:**

Note: TimescaleDB continuous aggregates do NOT support `PERCENTILE_CONT` or other ordered-set aggregates. Median response time is computed at query time or via a separate scheduled job.

```sql
CREATE MATERIALIZED VIEW override_rates_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', occurred_at) AS bucket,
  organization_id,
  supervision_decision,  -- group by supervision verdict (not measurement_type — that requires join)
  COUNT(*) FILTER (WHERE action IN ('modified', 'rejected')) AS override_count,
  COUNT(*) AS total_feedback,
  COUNT(*) FILTER (WHERE action IN ('modified', 'rejected'))::DOUBLE PRECISION
    / NULLIF(COUNT(*), 0) AS override_rate,
  -- By rationale category
  COUNT(*) FILTER (WHERE rationale_category = 'clinical_judgment') AS clinical_judgment_count,
  COUNT(*) FILTER (WHERE rationale_category = 'missing_context') AS missing_context_count,
  COUNT(*) FILTER (WHERE rationale_category = 'contraindication') AS contraindication_count,
  -- Response time (alert fatigue indicator — avg only, median computed at query time)
  AVG(response_time_seconds) FILTER (WHERE response_time_seconds IS NOT NULL) AS avg_response_time_s,
  COUNT(*) FILTER (WHERE response_time_seconds IS NOT NULL) AS response_time_count
FROM clinician_feedback
GROUP BY bucket, organization_id, supervision_decision;

-- Refresh policy: 90-day lookback to capture late-arriving feedback and backfills
-- (quarterly governance review period — Standard V.3)
SELECT add_continuous_aggregate_policy('override_rates_daily',
  start_offset => INTERVAL '90 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour');
```

**Daily override rates by clinician:**

```sql
CREATE MATERIALIZED VIEW override_rates_by_clinician_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', occurred_at) AS bucket,
  organization_id,
  clinician_id,
  clinician_role,
  COUNT(*) FILTER (WHERE action IN ('modified', 'rejected')) AS override_count,
  COUNT(*) AS total_feedback,
  COUNT(*) FILTER (WHERE action IN ('modified', 'rejected'))::DOUBLE PRECISION
    / NULLIF(COUNT(*), 0) AS override_rate
FROM clinician_feedback
GROUP BY bucket, organization_id, clinician_id, clinician_role;

SELECT add_continuous_aggregate_policy('override_rates_by_clinician_daily',
  start_offset => INTERVAL '90 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour');
```

**Measurement-level aggregates** require joining with audit_events. This is done at report-generation time, not via continuous aggregate, because measurement_type lives in the audit trail, not in `clinician_feedback`.

### 4. Investigation Thresholds

Proposed Standard V.4 would require facilities to define override rate thresholds that trigger investigation. He et al. 2023 (Nature, n=3,495 blinded RCT) reported a 16.8% override rate for AI LVEF assessments. The proposed standard cites this benchmark explicitly.

**Default thresholds (configurable per organization):**

```typescript
interface OverrideThresholds {
  /** Overall override rate triggering investigation */
  investigation_threshold: number; // default: 0.25 (25%)

  /** Per-clinician override rate triggering review */
  clinician_threshold: number; // default: 0.40 (40%)

  /** Per-measurement-type override rate triggering review */
  measurement_threshold: number; // default: 0.30 (30%)

  /** Minimum sample size before thresholds apply */
  minimum_sample_size: number; // default: 20

  /** Review period for threshold calculation */
  review_period_days: number; // default: 90 (quarterly per proposed Standard V.3)
}
```

**Rationale for 25% default:** Conservative buffer above the He et al. benchmark (16.8%). A facility consistently above 25% has a meaningfully higher override rate than the published RCT baseline, warranting investigation. Facilities may set tighter thresholds based on their own baseline data.

### 5. Investigation Workflow

When an override threshold is breached:

1. **Auto-generate investigation report** containing:
   - Override rate vs. threshold (with trend over last 4 periods)
   - Breakdown by rationale category
   - Breakdown by measurement type
   - Breakdown by clinician (pseudonymous)
   - Top 5 example cases (de-identified)

2. **Route to governance committee** via dashboard notification and optional email/webhook

3. **Governance committee decides** (per `09-clinical-governance-review-workflow.md`):
   - **Rule correct, AI performing as expected** — raise threshold or accept rate
   - **AI too aggressive** — adjust policy pack thresholds, re-validate
   - **AI incorrect for this population** — escalate to vendor, request model update
   - **Clinician training needed** — route to training program
   - **Data quality issue** — investigate image quality, patient mix changes

4. **Document decision** — stored in investigation log, available for IAC §4 submission

### 5b. Threshold Evaluation Job

Continuous aggregates are materialized views, not a workflow. A separate **threshold evaluation job** runs after each CAGG refresh:

1. Query `override_rates_daily` for the configured `review_period_days` window (default: 90 days)
2. Compare aggregate override rates against `OverrideThresholds` for the organization
3. If any threshold is breached AND the breach is new (not already tracked), create an investigation record
4. Emit a dashboard notification and optional webhook
5. **Idempotent:** If the same threshold breach is already open/acknowledged, do not create a duplicate

The job runs on the same schedule as the CAGG refresh (hourly). Cold-start behavior: if no feedback data exists yet, the job produces no alerts and no reports — it does not fail.

**Clinician identity mapping:** Popper stores pseudonymous `clinician_id` values. When a governance committee needs to investigate a clinician-level override spike, the facility must resolve the pseudonymous ID to a real person using their own clinician registry. Popper does not own this mapping.

### 6. Review Reports

**Quarterly override summary** (matches IAC §4 evidence for Standard V):

```typescript
interface OverrideReviewReport {
  report_id: string;
  organization_id: string;
  period: { start: IsoDateTime; end: IsoDateTime };
  generated_at: IsoDateTime;

  // Summary statistics (Standard V.5)
  total_feedback_events: number;
  total_overrides: number;
  overall_override_rate: number;

  // By measurement type (Standard V.5)
  by_measurement_type: Array<{
    measurement_type: string;
    total: number;
    overrides: number;
    override_rate: number;
    trend: 'increasing' | 'stable' | 'decreasing';
  }>;

  // By clinician (Standard V.5)
  by_clinician: Array<{
    clinician_id: string;  // pseudonymous
    clinician_role: string;
    total: number;
    overrides: number;
    override_rate: number;
  }>;

  // By rationale category
  by_rationale: Array<{
    category: RationaleCategory;
    count: number;
    percentage: number;
  }>;

  // Threshold breaches (Standard V.4)
  threshold_breaches: Array<{
    threshold_type: 'overall' | 'clinician' | 'measurement';
    entity: string;
    rate: number;
    threshold: number;
    investigation_required: boolean;
  }>;

  // Trends over time
  period_over_period: Array<{
    period_end: IsoDateTime;
    override_rate: number;
  }>;

  // Alert fatigue indicators
  avg_response_time_seconds: number;
  response_time_trend: 'increasing' | 'stable' | 'decreasing';
}
```

---

## Hermes Type Mapping

| Hermes Field | Popper Column | Notes |
|---|---|---|
| `trace.trace_id` | `trace_id` | **Dedupe key** — UNIQUE constraint |
| `original_trace_id` | `original_trace_id` | Link to original supervision request |
| `original_proposal_id` | `original_proposal_id` | **Required.** Proposal-level identity for joins and case studies |
| `subject.organization_id` | `organization_id` | Org scope is on `subject`, NOT `trace` |
| `subject.subject_id` | `subject_id` | Patient pseudonym for bias monitoring joins |
| `action` | `action` | Direct map: accepted, modified, rejected, deferred |
| `rationale.category` | `rationale_category` | Direct map: 11 RationaleCategory values |
| `rationale.summary` | `rationale_summary` | PHI-minimized, max 500 chars |
| `rationale.confidence` | `confidence` | low, medium, high |
| `clinician_ref.clinician_id` | `clinician_id` | Pseudonymous |
| `clinician_ref.role` | `clinician_role` | attending, specialist, etc. |
| `clinician_ref.specialty` | `clinician_specialty` | cardiology, nephrology, etc. |
| `response_time_seconds` | `response_time_seconds` | For alert fatigue analysis |
| `demographic_context.age_group` | `age_group` | Clinical context only (pediatric, adult, geriatric) |
| `modified_action.summary` | `modified_action_summary` | What clinician actually did (if action = 'modified') |
| `modified_action.intervention_kind` | `modified_intervention_kind` | Type of modified intervention |
| `snapshot_ref.snapshot_id` | `snapshot_id` | Link to health state snapshot |
| `mode` | `mode` | Operational mode |
| `occurred_at` | `occurred_at` | When clinician made decision (partition column) |

**Fields NOT stored (intentionally omitted):**
- `rationale.guideline_refs` — verbose, available via trace lookup if needed
- `rationale.contraindication_details` — available via trace lookup
- `applies_to` — available via trace lookup
- `conflicts_with_prior_feedback` — available via trace lookup
- `audit_redaction` — redundant with stored fields

---

## Proposed IAC §4 Evidence Targeted

This spec targets the following proposed §4 evidence requirements for Standard V (Override Tracking). These requirements are from Regain's draft proposal, not adopted IAC standards:

| Requirement | Delivered By |
|---|---|
| Override log summary statistics | `OverrideReviewReport.overall_override_rate` + breakdowns |
| Most recent two review reports | Quarterly `OverrideReviewReport` persisted and exportable |
| Threshold definitions and any triggered investigations | `OverrideThresholds` config + `threshold_breaches` array |

---

## Acceptance Criteria

1. `POST /v1/feedback` ingests valid `ClinicianFeedbackEvent` and stores in `clinician_feedback` hypertable
2. Invalid or orphaned feedback (no matching `original_trace_id`) is rejected with `400`/`404`
3. `override_rates_daily` continuous aggregate refreshes hourly and is queryable
4. Override rate exceeding threshold generates investigation notification within 1 hour of aggregate refresh
5. `OverrideReviewReport` can be generated for any organization + period and exported as JSON
6. All feedback data is de-identified (pseudonymous clinician IDs, no patient names/MRNs)
7. 7-year retention policy is active on `clinician_feedback` hypertable

---

## Sources

1. **Proposed IAC Echo Standards, Standard V** (Regain draft, not yet submitted/adopted) — Override and Rejection Tracking, §4 evidence requirements
2. **He et al. 2023, Nature** (n=3,495 blinded RCT) — AI LVEF override rate 16.8%, cited in proposed Standard V.4
3. **Hermes Protocol v2.3.0** — `ClinicianFeedbackEvent`, `RationaleCategory`, `DemographicContext` type definitions
4. **09-clinical-governance-review-workflow.md** — Governance committee roles and override review process
