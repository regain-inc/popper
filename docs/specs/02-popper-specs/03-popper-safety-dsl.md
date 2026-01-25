---
version: 1.3.0
last-updated: 2026-01-24
status: draft
owner: Popper Dev Team
tags: [advocate, ta2, popper, safety, dsl, policy, htv, evidence-grade, hallucination, imaging]
---

# Popper Safety DSL (Deterministic Policy Engine) — v1

## 0) Purpose

TA2 requires Popper to provide **real-time monitoring and control** of TA1 outputs. The minimum viable way to do this safely is a deterministic policy layer that:
- can **hard stop** or **route** without calling an LLM
- is **versioned**, testable, and auditable
- is **disease-agnostic** (no hardcoded CVD logic in Popper core)

This document specifies the **Safety DSL**: a policy pack format and evaluation semantics for Popper.

## 1) Design goals

- **Deterministic**: given the same Hermes request, policy pack, and settings → same decision.
- **Auditable**: decisions must cite which rule(s) fired and why (reason codes).
- **Composable**: global rules + site/org rules + temporary overrides (safe-mode).
- **Safe by default**: unknown/unsupported conditions route or hard stop.
- **Extensible**: new rules can be added without changing Popper core logic.

## 2) Inputs and outputs

### 2.1 Inputs (minimum)

Popper policy evaluation consumes:
- Hermes `SupervisionRequest` (validated)
- Popper control-plane state:
  - `safe_mode` (enabled/disabled + reason + effective_at + effective_until)
  - operational settings (e.g., `max_autonomy_level`)
- Policy pack (`PolicyPack`) + version

### 2.2 Outputs (minimum)

Policy evaluation outputs:
- Hermes `SupervisionDecision` (APPROVED / HARD_STOP / ROUTE_TO_CLINICIAN / REQUEST_MORE_INFO)
- `ReasonCode[]` (from Hermes)
- rule execution trace (for internal logging + de-identified export bundles)

## 3) Policy pack format (v1)

The DSL is represented as JSON or YAML. Below is a TypeScript-like schema for clarity.

```ts
export interface PolicyPack {
  policy_id: string;           // e.g. "popper-safety"
  policy_version: string;      // semver; MUST be emitted in TraceContext.producer.ruleset_version

  // Optional metadata for audit/regulatory packages.
  metadata?: {
    description?: string;
    owner?: string;            // org/site owner
    created_at?: string;
    sources?: Array<{ kind: 'policy' | 'guideline' | 'other'; citation: string }>;
  };

  // Staleness configuration (Popper is AUTHORITATIVE for staleness validation)
  // See 01-popper-system-spec.md §5.1.1 for rationale.
  staleness?: {
    thresholds: {
      wellness_hours: number;      // Default: 24
      clinical_hours: number;      // Default: 4
    };
    // Per-signal overrides (v2 extension, optional)
    signals?: Record<string, string>;  // e.g., { "vitals": "4h", "labs": "24h" }
    behavior: {
      low_risk_stale: 'REQUEST_MORE_INFO' | 'ROUTE_TO_CLINICIAN';
      high_risk_stale: 'ROUTE_TO_CLINICIAN' | 'HARD_STOP';
    };
  };

  // Ordered rule list; first-match wins unless rule says "continue".
  rules: PolicyRule[];
}

export interface PolicyRule {
  rule_id: string;
  description: string;

  // Higher priority rules evaluated first (descending).
  priority: number;

  // If true, rule requires manual clinician review even if decision is APPROVED.
  requires_human_review?: boolean;

  when: RuleCondition;
  then: RuleAction;
}

export type RuleCondition =
  // Boolean composition
  | { kind: 'all_of'; conditions: RuleCondition[] }
  | { kind: 'any_of'; conditions: RuleCondition[] }
  | { kind: 'not'; condition: RuleCondition }

  | { kind: 'always' }
  | { kind: 'safe_mode_enabled' }
  | { kind: 'schema_invalid' }
  | { kind: 'missing_field'; field_path: string }
  | { kind: 'proposal_kind_in'; kinds: string[] } // Hermes ProposedIntervention.kind (stringly for extensibility)
  // Like `missing_field`, but scoped to proposals of specific kinds.
  // `field_path` is evaluated relative to the proposal object (e.g., "htv_score", "evidence_refs[].evidence_grade").
  | { kind: 'proposal_missing_field'; proposal_kinds?: string[]; field_path: string }
  | { kind: 'uncertainty_at_least'; level: 'low' | 'medium' | 'high' }
  | { kind: 'snapshot_source_missing'; source: 'ehr' | 'wearable' | 'patient_reported' | 'other' }
  | { kind: 'input_risk_flag_in'; flags: string[] } // Hermes SupervisionRequest.input_risk.flags (stringly)

  // Staleness conditions (Popper is AUTHORITATIVE - does NOT trust Brain's validation)
  | { kind: 'snapshot_stale' }                       // Snapshot exceeds staleness threshold for current mode
  | { kind: 'snapshot_stale_by'; hours: number }     // Snapshot exceeds explicit hours threshold
  | { kind: 'snapshot_missing' }                     // No snapshot provided (snapshot_ref and snapshot_payload both absent)

  // Multi-domain composition conditions (see §7)
  | { kind: 'conflict_count_exceeds'; threshold: number }
  | { kind: 'conflict_type_in'; types: string[] }
  | { kind: 'conflict_missing_evidence' }
  | { kind: 'conflict_resolution_confidence'; level: 'low' | 'medium' | 'high' }
  | { kind: 'conflict_escalated' }
  | {
      kind: 'domain_status_in';
      statuses: Array<'success' | 'degraded' | 'failed'>;
      domain_category?: string;
    }
  | { kind: 'rule_engine_failed' }

  // Epistemological quality conditions (see §8)
  | { kind: 'htv_score_below'; threshold: number; proposal_kinds?: string[] }
  | { kind: 'evidence_grade_below'; threshold: EvidenceGrade; proposal_kinds?: string[] }
  | { kind: 'hallucination_detected'; severity?: 'minor' | 'significant' | 'critical' }
  | { kind: 'idk_triggered' }

  | { kind: 'other'; expr: string }; // escape hatch, implementation-specific

export interface RuleAction {
  decision: 'APPROVED' | 'HARD_STOP' | 'ROUTE_TO_CLINICIAN' | 'REQUEST_MORE_INFO';
  reason_codes: Array<
    | 'schema_invalid'
    | 'policy_violation'
    | 'insufficient_evidence'
    | 'high_uncertainty'
    | 'patient_acuity_high'
    | 'risk_too_high'
    | 'drift_suspected'
    | 'needs_human_review'
    | 'approved_with_constraints'
    | 'low_htv_score'
    | 'weak_evidence_grade'
    | 'snapshot_stale'          // Snapshot exceeds staleness threshold
    | 'snapshot_missing'        // No snapshot provided
    | 'other'
  >;

  // Human-readable explanation shown to clinicians (NOT necessarily shown to patients).
  explanation: string;

  // Optional constraints to include in SupervisionResponse.approved_constraints
  approved_constraints?: {
    must_route_after?: string;
    allowed_actions?: string[];
  };

  // Optional control commands (safe-mode or settings changes)
  control_commands?: Array<{
    kind: 'SET_SAFE_MODE' | 'SET_OPERATIONAL_SETTING';
    safe_mode?: { enabled: boolean; reason: string; effective_at?: string; effective_until?: string };
    setting?: { key: string; value: string };
  }>;

  // If true, keep evaluating subsequent rules and merge reason_codes (rare).
  continue?: boolean;
}
```

## 4) Evaluation semantics (v1)

1. **Validate** the inbound Hermes request.
   - If invalid → return `HARD_STOP` with `reason_codes = ["schema_invalid"]`.
   - In `advocate_clinical`, additionally treat regulated-mode integrity constraints as safety gates:
     - missing/invalid signature (or documented mTLS equivalent failure) → `HARD_STOP` (default `reason_codes` includes `policy_violation`) + emit `VALIDATION_FAILED` audit events with tagged failure kinds (see `03-hermes-specs/03-hermes-deployment-security.md`).
     - replay suspected / clock-skew rejection / snapshot hash mismatch → map to coarse `ReasonCode` values (typically `policy_violation` or `schema_invalid`) and emit fine-grained audit tags for ops/regulatory triage.
2. **Apply safe-mode override**:
   - If safe-mode enabled (and effective for this request’s timestamp):
     - define the **request timestamp** as `SupervisionRequest.request_timestamp` if present, otherwise fall back to `trace.created_at`
     - never `APPROVE` medication proposals
     - default to `ROUTE_TO_CLINICIAN` for non-trivial proposals
3. **Evaluate rules in priority order**.
   - **Boolean conditions**:
     - `all_of` matches only if **all** nested conditions match.
     - `any_of` matches if **any** nested condition matches.
     - `not` matches if the nested condition **does not** match.
   - **continue semantics** (safe-by-default):
     - If multiple rules match with `then.continue = true`, Popper MUST choose the **most conservative** decision among all matched rules:
       - `HARD_STOP` > `ROUTE_TO_CLINICIAN` > `REQUEST_MORE_INFO` > `APPROVED`
     - `reason_codes` MUST be the union of all matched rule reason codes (deduplicated).
4. **Default rule**:
   - If no rule matches, Popper MUST default to `ROUTE_TO_CLINICIAN` (`reason_codes = ["other"]`).

Popper MUST include rule trace in internal logs and SHOULD include a redacted version in export bundles.

## 5) Minimum required rules (v1)

Policy packs MUST include rules equivalent to:
- schema invalid → HARD_STOP
- safe-mode enabled → route (especially for high-risk kinds)
- advocate_clinical missing snapshot access (`snapshot_uri` absent AND `snapshot_payload` absent) → HARD_STOP (schema invalid in regulated mode)
- input risk flags (e.g., `prompt_injection_suspected`) → ROUTE_TO_CLINICIAN (or HARD_STOP for suspected malicious activity)
- medication proposal without `clinician_protocol_ref` → ROUTE_TO_CLINICIAN
- medication proposal missing required `evidence_refs` → ROUTE_TO_CLINICIAN (`reason_codes = ["insufficient_evidence"]`)
- high uncertainty in `DisclosureBundle` for high-risk proposals → ROUTE_TO_CLINICIAN
- **snapshot staleness (AUTHORITATIVE)** — Popper validates staleness independently, does NOT trust Brain:
  - `snapshot_stale` in `wellness` mode, low-risk proposal → REQUEST_MORE_INFO (`reason_codes = ["snapshot_stale"]`)
  - `snapshot_stale` in `wellness` mode, high-risk proposal → ROUTE_TO_CLINICIAN (`reason_codes = ["snapshot_stale"]`)
  - `snapshot_stale` in `advocate_clinical` mode → ROUTE_TO_CLINICIAN (`reason_codes = ["snapshot_stale"]`)
  - `snapshot_missing` → HARD_STOP (`reason_codes = ["snapshot_missing", "schema_invalid"]`)

### 5.1 Staleness Rule Examples (YAML)

```yaml
rules:
  # ═══════════════════════════════════════════════════════════════
  # STALENESS RULES (Popper is AUTHORITATIVE)
  # Brain MAY check staleness for UX, but Popper MUST validate independently
  # ═══════════════════════════════════════════════════════════════

  - rule_id: "snapshot_missing"
    description: "No snapshot provided - cannot proceed safely"
    priority: 1100  # Very high - fundamental requirement
    when:
      kind: "snapshot_missing"
    then:
      decision: "HARD_STOP"
      reason_codes: ["snapshot_missing", "schema_invalid"]
      explanation: "No health state snapshot provided. Cannot evaluate safety without patient data."

  - rule_id: "snapshot_stale_clinical"
    description: "Stale snapshot in advocate_clinical mode"
    priority: 950
    when:
      kind: "all_of"
      conditions:
        - kind: "snapshot_stale"
        - kind: "other"
          expr: "mode === 'advocate_clinical'"
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["snapshot_stale", "high_uncertainty"]
      explanation: "Health state snapshot is stale. Clinical decisions require fresh data."

  - rule_id: "snapshot_stale_wellness_high_risk"
    description: "Stale snapshot in wellness mode for high-risk proposal"
    priority: 900
    when:
      kind: "all_of"
      conditions:
        - kind: "snapshot_stale"
        - kind: "proposal_kind_in"
          kinds: ["MEDICATION_ORDER_PROPOSAL", "ESCALATE_TO_CARE_TEAM", "TRIAGE_ROUTE"]
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["snapshot_stale", "risk_too_high"]
      explanation: "Health state snapshot is stale. High-risk actions require fresh data."

  - rule_id: "snapshot_stale_wellness_low_risk"
    description: "Stale snapshot in wellness mode for low-risk proposal"
    priority: 800
    when:
      kind: "snapshot_stale"
    then:
      decision: "REQUEST_MORE_INFO"
      reason_codes: ["snapshot_stale"]
      explanation: "Health state snapshot is outdated. Please refresh patient data."
      # Brain/Gateway is responsible for refreshing and retrying
```

## 6) Test vectors (required)

Every policy pack version MUST ship with:
- JSON fixtures for representative requests
- expected decisions + reason codes
- a regression test runner that can run in CI

Minimum test vector categories:
- invalid schema request (hard stop)
- advocate_clinical missing snapshot access (hard stop)
- snapshot hash mismatch (hard stop)
- input risk flag set (route)
- medication proposal missing `clinician_protocol_ref` (route)
- medication proposal missing `evidence_refs` (route)
- safe-mode enabled (route)
- unknown `ProposedIntervention.kind` (route by default)

### 6.1 Staleness Test Vectors (REQUIRED)

Staleness validation is critical because Popper is Brain-agnostic and MUST NOT trust that the Brain has validated staleness.

| Test ID | Mode | Snapshot Age | Proposal Risk | Expected Decision | Expected Reason Codes |
|---------|------|--------------|---------------|-------------------|-----------------------|
| `stale-001` | wellness | 25h | low | REQUEST_MORE_INFO | `["snapshot_stale"]` |
| `stale-002` | wellness | 25h | high (medication) | ROUTE_TO_CLINICIAN | `["snapshot_stale", "risk_too_high"]` |
| `stale-003` | advocate_clinical | 5h | any | ROUTE_TO_CLINICIAN | `["snapshot_stale", "high_uncertainty"]` |
| `stale-004` | advocate_clinical | 3h | any | APPROVED (if other checks pass) | - |
| `stale-005` | wellness | 23h | any | APPROVED (if other checks pass) | - |
| `stale-006` | any | missing | any | HARD_STOP | `["snapshot_missing", "schema_invalid"]` |
| `stale-007` | wellness | 25h | low | REQUEST_MORE_INFO | `["snapshot_stale"]` + verify `required_action.kind = "refresh_snapshot"` |

**Test fixture example (stale-003):**

```json
{
  "test_id": "stale-003",
  "description": "Stale snapshot in advocate_clinical mode must route to clinician",
  "request": {
    "mode": "advocate_clinical",
    "snapshot": {
      "snapshot_id": "snap_test_001",
      "created_at": "2026-01-25T05:00:00Z"
    },
    "proposals": [
      { "kind": "SCHEDULE_VISIT", "risk_level": "low" }
    ]
  },
  "current_time": "2026-01-25T10:30:00Z",
  "expected": {
    "decision": "ROUTE_TO_CLINICIAN",
    "reason_codes": ["snapshot_stale", "high_uncertainty"],
    "required_action": {
      "kind": "refresh_snapshot",
      "details": {
        "current_age_hours": 5.5,
        "threshold_hours": 4
      }
    }
  }
}
```

## 7) Cross-Domain Conflict Rules (Multi-Domain Composition)

When Deutsch uses multi-domain composition (see [`../01-deutsch-specs/04-multi-domain-composition-spec.md`](../01-deutsch-specs/04-multi-domain-composition-spec.md)), the `SupervisionRequest` includes `cross_domain_conflicts`. Popper MUST evaluate these to provide independent oversight of cross-domain reasoning.

### 7.1 Extended Rule Conditions

Add these condition types to the DSL schema:

```ts
export type RuleCondition =
  // ... existing conditions ...

  // Cross-domain conflict conditions
  | { kind: 'conflict_count_exceeds'; threshold: number }
  | { kind: 'conflict_type_in'; types: string[] }
  | { kind: 'conflict_missing_evidence' }
  | { kind: 'conflict_resolution_confidence'; level: 'low' | 'medium' | 'high' }
  | { kind: 'conflict_escalated' }
  | { kind: 'domain_status_in'; statuses: Array<'success' | 'degraded' | 'failed'>; domain_category?: string }
  | { kind: 'rule_engine_failed' };
```

> Note: boolean composition (`all_of` / `any_of` / `not`) is also available for combining these conditions.

### 7.2 Required Conflict Evaluation Rules

Policy packs supporting multi-domain composition MUST include these rules:

```yaml
# Cross-Domain Conflict Evaluation Rules

rules:
  # ═══════════════════════════════════════════════════════════════
  # CRITICAL: Composition Infrastructure Failures
  # ═══════════════════════════════════════════════════════════════

  - rule_id: "conflict_clinical_domain_failed"
    description: "Clinical domain module failed - cannot proceed safely"
    priority: 1000
    when:
      kind: "domain_status_in"
      domain_category: "clinical"
      statuses: ["failed"]
    then:
      decision: "HARD_STOP"
      reason_codes: ["policy_violation"]
      explanation: "Clinical domain module failed; cannot provide safe recommendations"

  - rule_id: "conflict_rule_engine_failed"
    description: "Interaction rule engine failed - cannot detect conflicts"
    priority: 1000
    when:
      kind: "rule_engine_failed"
    then:
      decision: "HARD_STOP"
      reason_codes: ["policy_violation"]
      explanation: "Conflict detection engine failed; cannot guarantee safety"

  # ═══════════════════════════════════════════════════════════════
  # HIGH: Conflict Resolution Quality Issues
  # ═══════════════════════════════════════════════════════════════

  - rule_id: "conflict_no_evidence"
    description: "Cross-domain conflict resolved without evidence citation"
    priority: 900
    when:
      kind: "conflict_missing_evidence"
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["insufficient_evidence"]
      explanation: "Cross-domain conflict was resolved without supporting evidence"

  - rule_id: "conflict_low_confidence"
    description: "Low confidence in cross-domain conflict resolution"
    priority: 850
    when:
      kind: "conflict_resolution_confidence"
      level: "low"
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["high_uncertainty"]
      explanation: "Cross-domain conflict resolution has low confidence"

  - rule_id: "conflict_explicitly_escalated"
    description: "Deutsch explicitly escalated conflict for clinician review"
    priority: 800
    when:
      kind: "conflict_escalated"
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["needs_human_review"]
      explanation: "Cross-domain conflict could not be auto-resolved; requires clinician review"

  # ═══════════════════════════════════════════════════════════════
  # MEDIUM: Complexity and Risk Thresholds
  # ═══════════════════════════════════════════════════════════════

  - rule_id: "conflict_count_high"
    description: "Too many cross-domain conflicts to safely auto-resolve"
    priority: 750
    when:
      kind: "conflict_count_exceeds"
      threshold: 5
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["risk_too_high"]
      explanation: "High number of cross-domain conflicts indicates complex case requiring clinician review"

  - rule_id: "conflict_drug_interaction_with_med_proposal"
    description: "Drug interaction conflict combined with medication proposal"
    priority: 700
    when:
      kind: "all_of"
      conditions:
        - kind: "conflict_type_in"
          types: ["drug_nutrient_interaction", "drug_activity_contraindication"]
        - kind: "proposal_kind_in"
          kinds: ["MEDICATION_ORDER_PROPOSAL"]
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["needs_human_review", "risk_too_high"]
      explanation: "Drug interaction conflict present with concurrent medication change"

  # ═══════════════════════════════════════════════════════════════
  # LOW: Degraded Operation Warnings
  # ═══════════════════════════════════════════════════════════════

  - rule_id: "conflict_lifestyle_domain_degraded_or_failed"
    description: "Lifestyle domain degraded/failed; proceed with non-lifestyle recommendations"
    priority: 500
    when:
      kind: "domain_status_in"
      domain_category: "lifestyle"
      statuses: ["degraded", "failed"]
    then:
      decision: "APPROVED"  # Allow clinical recommendations to proceed
      reason_codes: ["approved_with_constraints"]
      explanation: "Lifestyle recommendations unavailable; clinical recommendations proceeding"
      approved_constraints:
        allowed_actions: ["MEDICATION_ORDER_PROPOSAL", "TRIAGE_ROUTE", "CARE_NAVIGATION"]
      continue: true  # Keep evaluating other rules
```

**Default posture (recommended):**
- Graceful degradation is enabled by default only for `lifestyle`.
- Any expansion to other non-clinical categories (`behavioral`, `preventive`, `rehabilitative`, `other`) SHOULD be explicitly enabled and governed per TA3 Site Integration Profile.

### 7.3 Per-Proposal Decision Rules

Hermes supports **partial approval** via `SupervisionResponse.per_proposal_decisions` (see `../03-hermes-specs/02-hermes-contracts.md`).

This DSL v1 remains **request-level**: each rule yields a single `decision`. If a deployment supports partial approvals, it MUST implement a deterministic post-processing step that:

- never approves proposals that are high-risk or policy-violating,
- never splits proposals that Deutsch marked as interdependent (see Hermes interdependency fields),
- sets the top-level decision to the **most conservative** decision across proposals.

Policy packs MAY still use this DSL to decide the top-level routing/hard-stop behavior; per-proposal decisions are an optional extension on top.

### 7.4 Extended Test Vectors

Add these test vector categories for multi-domain composition:

```yaml
test_vectors:
  # Critical failures
  - name: "clinical_domain_failed"
    request:
      contributing_domains:
        - domain_id: "cardiology"
          domain_category: "clinical"
          status: "failed"
    expected:
      decision: "HARD_STOP"
      reason_codes: ["policy_violation"]

  - name: "rule_engine_failed"
    request:
      composition_metadata:
        rule_engine_status: "failed"
    expected:
      decision: "HARD_STOP"
      reason_codes: ["policy_violation"]

  # Conflict quality issues
  - name: "conflict_without_evidence"
    request:
      cross_domain_conflicts:
        - conflict_id: "c1"
          evidence_refs: []
          resolution_strategy: "constrain"
    expected:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["insufficient_evidence"]

  - name: "conflict_low_confidence"
    request:
      cross_domain_conflicts:
        - conflict_id: "c1"
          resolution_confidence: "low"
    expected:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["high_uncertainty"]

  - name: "conflict_escalated"
    request:
      cross_domain_conflicts:
        - conflict_id: "c1"
          resolution_strategy: "escalate"
    expected:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["needs_human_review"]

  # Complexity thresholds
  - name: "too_many_conflicts"
    request:
      cross_domain_conflicts:
        - conflict_id: "c1"
        - conflict_id: "c2"
        - conflict_id: "c3"
        - conflict_id: "c4"
        - conflict_id: "c5"
        - conflict_id: "c6"
    expected:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["risk_too_high"]

  # Graceful degradation
  - name: "lifestyle_domain_degraded_clinical_ok"
    request:
      contributing_domains:
        - domain_id: "cardiology"
          domain_category: "clinical"
          status: "success"
        - domain_id: "nutrition"
          domain_category: "lifestyle"
          status: "failed"
      proposals:
        - kind: "MEDICATION_ORDER_PROPOSAL"
    expected:
      decision: "APPROVED"
      reason_codes: ["approved_with_constraints"]
```

### 7.5 Audit Event Requirements

For each cross-domain conflict evaluated, emit:

```yaml
audit_event:
  event_type: "OTHER"
  other_event_type: "CROSS_DOMAIN_CONFLICT_EVALUATED"
  tags:
    conflict_id: "{conflict.conflict_id}"
    conflict_type: "{conflict.conflict_type}"
    resolution_strategy: "{conflict.resolution_strategy}"
    resolution_confidence: "{conflict.resolution_confidence}"
    popper_decision: "{decision}"
    override_applied: "{true if Popper changed the resolution}"
    domains_involved: "{comma-separated domain_ids}"
```

## 8) Epistemological Quality Rules (HTV, Evidence, Hallucination)

These conditions implement Deutschian epistemology in the Safety DSL. They enable Popper to evaluate the quality of Deutsch's reasoning using Hard-to-Vary (HTV) scores, evidence grades, and hallucination detection.

**Epistemological Grounding**: See [`../00-overall-specs/00-epistemology-foundations/`](../00-overall-specs/00-epistemology-foundations/)

### 8.0 Non-Trust Principle (Normative)

**Popper MUST only use epistemological fields to INCREASE conservatism, never to DECREASE it.**

This principle ensures that Popper's demarcation role (safety boundary enforcement) cannot be weakened by epistemological metadata from Deutsch:

| Field | Popper MAY Use To | Popper MUST NOT Use To |
|-------|-------------------|------------------------|
| `htv_score.composite` | Route if below threshold | Approve without other checks |
| `evidence_grade` | Route if below threshold | Override protocol requirements |
| `uncertainty_calibration` | Increase routing threshold | Reduce routing threshold |
| `claim_type` | Apply stricter thresholds for high-risk types | Relax checks for "safe" types |

**Rationale**: Popper implements Popperian *demarcation* (what counts as safe to proceed), not methodology. Deutsch provides epistemological metadata to help Popper be MORE conservative when reasoning quality is low, but Popper cannot use high HTV scores or strong evidence to bypass safety gates.

**Example violations (prohibited)**:
- "HTV score is 0.9, so skip medication protocol check" ❌
- "Evidence grade is systematic_review, so approve without routing" ❌

**Example compliant uses**:
- "HTV score is 0.3, routing to clinician even though proposal type normally auto-approves" ✅
- "Evidence grade is case_report, increasing conservatism for this medication proposal" ✅

### 8.1 Extended Rule Conditions

```ts
export type RuleCondition =
  // ... existing conditions ...

  // HTV (Hard-to-Vary) score evaluation
  | { kind: 'htv_score_below'; threshold: number; proposal_kinds?: string[] }

  // Evidence grade evaluation (hierarchy: systematic_review > rct > cohort > ...)
  | { kind: 'evidence_grade_below'; threshold: EvidenceGrade; proposal_kinds?: string[] }

  // Hallucination detection
  | { kind: 'hallucination_detected'; severity?: 'minor' | 'significant' | 'critical' }

  // IDK Protocol triggered
  | { kind: 'idk_triggered' };

export type EvidenceGrade =
  | 'systematic_review'
  | 'rct'
  | 'cohort'
  | 'case_control'
  | 'case_series'
  | 'case_report'
  | 'expert_opinion'
  | 'policy'
  | 'patient_reported'
  | 'calculated';
```

**Condition semantics (normative, v1):**
- `htv_score_below`: evaluates whether **any** proposal in scope has `htv_score.composite < threshold`.
  - Scope: if `proposal_kinds` is provided, only proposals whose `kind` is in `proposal_kinds` are evaluated; otherwise all proposals are evaluated.
  - If any in-scope proposal is missing `htv_score` when it is required by policy, Popper SHOULD treat it as below threshold (conservative).
- `evidence_grade_below`: evaluates whether **any** proposal in scope has minimum **effective** `evidence_refs[].evidence_grade` below the threshold (see §8.2 for special-grade mapping).
  - Scope: if `proposal_kinds` is provided, only proposals whose `kind` is in `proposal_kinds` are evaluated; otherwise all proposals are evaluated.
  - Missing `evidence_grade` SHOULD be treated as below threshold for high-risk proposals.
- `hallucination_detected`: set by Popper’s hallucination checks (see `05-popper-measurement-protocols.md`); MUST NOT require Popper to perform domain-specific clinical reasoning.
- `idk_triggered`: true if Deutsch explicitly signals IDK via a marker such as `audit_redaction.summary` beginning with `"IDK Protocol:"` on any proposal.

### 8.2 Evidence Grade Hierarchy

For `evidence_grade_below` comparisons, use this ordering (strongest first):

```
systematic_review > rct > cohort > case_control > case_series > case_report > expert_opinion
```

**Special grades (normative mapping):**
- `policy`: treat as `cohort` unless explicitly annotated stronger by the deployment governance process.
- `patient_reported`: treat as `case_report`.
- `calculated`: SHOULD inherit grade from the weakest input; if unknown, treat as `cohort`.

The condition `{ kind: 'evidence_grade_below', threshold: 'cohort' }` matches if the minimum effective evidence grade on the proposal is weaker than `cohort` (i.e., `case_control`, `case_series`, `case_report`, or `expert_opinion`, after applying the special-grade mapping above).

### 8.3 Required Epistemological Rules

Policy packs SHOULD include these rules for epistemological quality:

```yaml
# Epistemological Quality Evaluation Rules

rules:
  # ═══════════════════════════════════════════════════════════════
  # CRITICAL: Missing Epistemological Fields (Conservative Default)
  # ═══════════════════════════════════════════════════════════════

  - rule_id: "missing_htv_medication"
    description: "Missing HTV score on medication proposal - treat as below threshold"
    priority: 955
    when:
      kind: "proposal_missing_field"
      proposal_kinds: ["MEDICATION_ORDER_PROPOSAL"]
      field_path: "htv_score"
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["low_htv_score", "risk_too_high"]
      explanation: "Medication proposal missing HTV score - conservative routing"

  - rule_id: "missing_evidence_grade_medication"
    description: "Missing evidence grade on medication proposal - treat as below threshold"
    priority: 954
    when:
      kind: "proposal_missing_field"
      proposal_kinds: ["MEDICATION_ORDER_PROPOSAL"]
      field_path: "evidence_refs[].evidence_grade"
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["weak_evidence_grade", "insufficient_evidence"]
      explanation: "Medication proposal evidence missing grade - conservative routing"

  # ═══════════════════════════════════════════════════════════════
  # CRITICAL: HTV Score Thresholds
  # ═══════════════════════════════════════════════════════════════

  - rule_id: "htv_too_low_medication"
    description: "HTV score too low for medication proposal"
    priority: 950
    when:
      kind: "htv_score_below"
      proposal_kinds: ["MEDICATION_ORDER_PROPOSAL"]
      threshold: 0.5
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["low_htv_score", "risk_too_high"]
      explanation: "Medication proposal has low explanatory quality (HTV < 0.5)"

  - rule_id: "htv_too_low_urgent_triage"
    description: "HTV score too low for urgent triage routing"
    priority: 940
    when:
      kind: "htv_score_below"
      proposal_kinds: ["TRIAGE_ROUTE"]
      threshold: 0.5
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["low_htv_score", "high_uncertainty"]
      explanation: "Urgent triage routing has low explanatory quality (HTV < 0.5)"

  - rule_id: "htv_refuted"
    description: "HTV score in refuted range - applies to ALL proposal types including lifestyle"
    priority: 930
    when:
      kind: "htv_score_below"
      threshold: 0.3
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["low_htv_score", "insufficient_evidence"]
      explanation: "Proposal explanation was effectively refuted (HTV < 0.3)"
    # NOTE: This rule intentionally applies to ALL proposals, including lifestyle_rec.
    # Per Deutschian epistemology, a refuted explanation (HTV < 0.3) indicates the
    # reasoning failed conjecture-refutation. Even low-risk lifestyle recommendations
    # should not proceed with refuted explanations - route for clinician review.

  # ═══════════════════════════════════════════════════════════════
  # HIGH: Evidence Grade Thresholds
  # ═══════════════════════════════════════════════════════════════

  - rule_id: "weak_evidence_medication"
    description: "Evidence grade too weak for medication proposal"
    priority: 920
    when:
      kind: "evidence_grade_below"
      proposal_kinds: ["MEDICATION_ORDER_PROPOSAL"]
      threshold: "cohort"
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["weak_evidence_grade", "insufficient_evidence"]
      explanation: "Medication proposal lacks cohort-level or stronger evidence"

  - rule_id: "weak_evidence_triage"
    description: "Evidence grade too weak for triage routing"
    priority: 910
    when:
      kind: "evidence_grade_below"
      proposal_kinds: ["TRIAGE_ROUTE"]
      threshold: "case_series"
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["weak_evidence_grade", "insufficient_evidence"]
      explanation: "Triage routing lacks case-series level or stronger evidence"

  # ═══════════════════════════════════════════════════════════════
  # CRITICAL: Hallucination Detection
  # ═══════════════════════════════════════════════════════════════

  - rule_id: "hallucination_critical"
    description: "Critical hallucination detected"
    priority: 1000
    when:
      kind: "hallucination_detected"
      severity: "critical"
    then:
      decision: "HARD_STOP"
      reason_codes: ["policy_violation", "drift_suspected"]
      explanation: "Critical hallucination detected - fabricated clinical data"
      control_commands:
        - kind: "SET_SAFE_MODE"
          safe_mode:
            enabled: true
            reason: "Critical hallucination detected"

  - rule_id: "hallucination_significant"
    description: "Significant hallucination detected"
    priority: 960
    when:
      kind: "hallucination_detected"
      severity: "significant"
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["drift_suspected", "risk_too_high"]
      explanation: "Significant hallucination detected - claims without evidence"

  - rule_id: "hallucination_any"
    description: "Any hallucination detected (minor+)"
    priority: 850
    when:
      kind: "hallucination_detected"
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["insufficient_evidence"]
      explanation: "Hallucination detected - verify claims with clinician"
      continue: true  # Allow other rules to further evaluate

  # ═══════════════════════════════════════════════════════════════
  # MEDIUM: IDK Protocol
  # ═══════════════════════════════════════════════════════════════

  - rule_id: "idk_triggered"
    description: "Deutsch triggered IDK Protocol"
    priority: 800
    when:
      kind: "idk_triggered"
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["high_uncertainty", "needs_human_review"]
      explanation: "Agent acknowledged uncertainty - requires clinician review"
```

### 8.4 Extended Reason Codes

Add these reason codes to the DSL schema:

```ts
export interface RuleAction {
  // ... existing fields ...

  reason_codes: Array<
    // ... existing codes ...
    | 'low_htv_score'       // HTV score below threshold
    | 'weak_evidence_grade' // Evidence grade below threshold
  >;
}
```

### 8.5 Extended Test Vectors

Note: some epistemological conditions (e.g., hallucination severity) are computed by Popper as **derived signals** prior to policy evaluation. Test vectors MAY include a `derived_signals` block to represent these Popper-internal inputs; it is **not** part of the Hermes request schema.

```yaml
test_vectors:
  # HTV Score Tests
  - name: "htv_too_low_medication"
    request:
      proposals:
        - kind: "MEDICATION_ORDER_PROPOSAL"
          htv_score:
            interdependence: 0.4
            specificity: 0.3
            parsimony: 0.4
            falsifiability: 0.3
            composite: 0.35
    expected:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["low_htv_score", "risk_too_high"]

  - name: "htv_refuted"
    request:
      proposals:
        - kind: "OTHER"
          claim_type: "lifestyle_rec"
          htv_score:
            interdependence: 0.2
            specificity: 0.2
            parsimony: 0.4
            falsifiability: 0.2
            composite: 0.25
    expected:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["low_htv_score", "insufficient_evidence"]

  # Evidence Grade Tests
  - name: "weak_evidence_medication"
    request:
      proposals:
        - kind: "MEDICATION_ORDER_PROPOSAL"
          evidence_refs:
            - evidence_id: "e.case_report.1"
              evidence_type: "study"
              citation: "Example case report"
              evidence_grade: "case_report"
    expected:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["weak_evidence_grade", "insufficient_evidence"]

  # Hallucination Tests
  - name: "hallucination_critical"
    request:
      proposals:
        - kind: "PATIENT_MESSAGE"
          message_markdown: "Example"
    derived_signals:
      hallucination:
        severity: "critical"
    expected:
      decision: "HARD_STOP"
      reason_codes: ["policy_violation", "drift_suspected"]

  - name: "hallucination_significant"
    request:
      proposals:
        - kind: "PATIENT_MESSAGE"
          message_markdown: "Example"
    derived_signals:
      hallucination:
        severity: "significant"
    expected:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["drift_suspected", "risk_too_high"]

  # IDK Protocol Tests
  - name: "idk_triggered"
    request:
      proposals:
        - kind: "TRIAGE_ROUTE"
          urgency: "routine"
          route_to: "care_team"
          reason: "IDK Protocol"
          audit_redaction:
            summary: "IDK Protocol: LOW_HTV. Routing to clinician."
    expected:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["high_uncertainty", "needs_human_review"]

  # ═══════════════════════════════════════════════════════════════
  # Edge Case Tests: Missing Fields and Special Grades
  # ═══════════════════════════════════════════════════════════════

  # Missing htv_score on high-risk proposal (treat as below threshold)
  - name: "missing_htv_score_medication"
    request:
      mode: "advocate_clinical"
      proposals:
        - kind: "MEDICATION_ORDER_PROPOSAL"
          medication: { name: "lisinopril" }
          change: { change_type: "titrate" }
          # htv_score is MISSING - should be treated as below threshold
          audit_redaction:
            summary: "Medication proposal without HTV score"
    expected:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["low_htv_score", "risk_too_high"]

  # Missing evidence_grade on medication proposal (treat as below threshold)
  - name: "missing_evidence_grade_medication"
    request:
      mode: "advocate_clinical"
      proposals:
        - kind: "MEDICATION_ORDER_PROPOSAL"
          medication: { name: "lisinopril" }
          change: { change_type: "titrate" }
          htv_score:
            interdependence: 0.8
            specificity: 0.7
            parsimony: 0.8
            falsifiability: 0.7
            composite: 0.75
          evidence_refs:
            - evidence_id: "e.guideline.1"
              evidence_type: "guideline"
              citation: "ACC/AHA HF Guidelines"
              # evidence_grade is MISSING - should be treated as below threshold
          audit_redaction:
            summary: "Medication proposal with missing evidence grade"
    expected:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["weak_evidence_grade", "insufficient_evidence"]

  # Lifestyle recommendation with refuted HTV (MUST route, not allow with disclosure)
  - name: "lifestyle_rec_htv_refuted"
    request:
      mode: "advocate_clinical"
      proposals:
        - kind: "OTHER"
          other_kind: "NUTRITION_PLAN"
          claim_type: "lifestyle_rec"
          htv_score:
            interdependence: 0.2
            specificity: 0.2
            parsimony: 0.3
            falsifiability: 0.2
            composite: 0.225
          audit_redaction:
            summary: "Lifestyle recommendation with refuted explanation"
    expected:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["low_htv_score", "insufficient_evidence"]
    notes: |
      Per Q2 decision: Even lifestyle recommendations route when HTV < 0.3.
      Refuted explanations (failed conjecture-refutation) should not proceed.

  # Special grade: policy (maps to cohort for comparison)
  - name: "policy_grade_medication_ok"
    request:
      mode: "advocate_clinical"
      proposals:
        - kind: "MEDICATION_ORDER_PROPOSAL"
          medication: { name: "lisinopril" }
          change: { change_type: "titrate" }
          htv_score:
            interdependence: 0.8
            specificity: 0.7
            parsimony: 0.8
            falsifiability: 0.7
            composite: 0.75
          evidence_refs:
            - evidence_id: "e.policy.1"
              evidence_type: "policy"
              citation: "Org medication protocol"
              evidence_grade: "policy"
          clinician_protocol_ref: "protocol://org/v1"
          audit_redaction:
            summary: "Medication with policy-grade evidence"
    expected:
      # policy maps to cohort; therefore this case SHOULD NOT be treated as weak_evidence_grade.
      # This example uses the DSL default decision to keep the test vector self-contained.
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["other"]

  # Special grade: patient_reported (maps to case_report, below cohort)
  - name: "patient_reported_grade_medication_routes"
    request:
      mode: "advocate_clinical"
      proposals:
        - kind: "MEDICATION_ORDER_PROPOSAL"
          medication: { name: "lisinopril" }
          change: { change_type: "titrate" }
          htv_score:
            interdependence: 0.8
            specificity: 0.7
            parsimony: 0.8
            falsifiability: 0.7
            composite: 0.75
          evidence_refs:
            - evidence_id: "e.patient.1"
              evidence_type: "patient_data"
              citation: "Patient self-report"
              evidence_grade: "patient_reported"
          clinician_protocol_ref: "protocol://org/v1"
          audit_redaction:
            summary: "Medication with only patient-reported evidence"
    expected:
      # patient_reported maps to case_report, below cohort threshold
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["weak_evidence_grade", "insufficient_evidence"]

  # Special grade: calculated (maps to cohort when inputs unknown)
  - name: "calculated_grade_medication"
    request:
      mode: "advocate_clinical"
      proposals:
        - kind: "MEDICATION_ORDER_PROPOSAL"
          medication: { name: "lisinopril" }
          change: { change_type: "titrate" }
          htv_score:
            interdependence: 0.8
            specificity: 0.7
            parsimony: 0.8
            falsifiability: 0.7
            composite: 0.75
          evidence_refs:
            - evidence_id: "e.calc.1"
              evidence_type: "calculation"
              citation: "Derived from lab values"
              evidence_grade: "calculated"
          clinician_protocol_ref: "protocol://org/v1"
          audit_redaction:
            summary: "Medication with calculated evidence"
    expected:
      # calculated maps to cohort (when inputs unknown); therefore this case SHOULD NOT be treated as weak_evidence_grade.
      # This example uses the DSL default decision to keep the test vector self-contained.
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["other"]
```

### 8.6 Audit Event Requirements

For epistemological quality evaluations, emit:

```yaml
# HTV Score Evaluation
audit_event:
  event_type: "OTHER"
  other_event_type: "HTV_SCORE_EVALUATED"
  tags:
    proposal_id: "{proposal.proposal_id}"
    htv_composite: "{htv_score.composite}"
    threshold_used: "{threshold}"
    passed: "{true|false}"

# Evidence Grade Evaluation
audit_event:
  event_type: "OTHER"
  other_event_type: "EVIDENCE_GRADE_EVALUATED"
  tags:
    proposal_id: "{proposal.proposal_id}"
    min_grade: "{min_evidence_grade}"
    threshold_used: "{threshold}"
    passed: "{true|false}"

# Hallucination Detected
audit_event:
  event_type: "OTHER"
  other_event_type: "HALLUCINATION_DETECTED"
  tags:
    proposal_id: "{proposal.proposal_id}"
    severity: "{severity}"
    type: "{hallucination_type}"
```

## 9) Imaging Data Rules

These conditions enable Popper to validate imaging data and enforce the **"Reference, Don't Transfer"** pattern.

**Full Specification**: [`01-popper-system-spec.md`](./01-popper-system-spec.md) §5.8

**Hermes Types**: [`../03-hermes-specs/05-hermes-imaging-data.md`](../03-hermes-specs/05-hermes-imaging-data.md)

### 9.1 Extended Rule Conditions

```ts
export type RuleCondition =
  // ... existing conditions ...

  // Imaging validation conditions
  | { kind: 'imaging_confidence_below'; threshold: number; modality?: ImagingModality }
  | { kind: 'imaging_required'; modality: ImagingModality; clinical_context?: string }
  | { kind: 'snapshot_size_exceeds'; max_bytes: number }
  | { kind: 'snapshot_size_missing_with_imaging' }  // NEW: Fallback when size absent
  | { kind: 'imaging_critical_finding_present' }
  | { kind: 'imaging_stale'; max_days: number; modality?: ImagingModality }
  | { kind: 'imaging_hallucination_detected' };

export type ImagingModality =
  | 'MR' | 'CT' | 'XR' | 'US' | 'MG' | 'PT' | 'NM' | 'ECG' | 'DX' | 'CR' | 'OT';
```

**Condition semantics (normative):**
- `imaging_confidence_below`: true if any `DerivedImagingFinding.confidence < threshold` (finding-level confidence, not classification-specific; optionally filtered by modality)
- `imaging_required`: true if cartridge-specified required imaging is absent from snapshot
- `snapshot_size_exceeds`: true if `snapshot.estimated_size_bytes > max_bytes`
- `snapshot_size_missing_with_imaging`: true if `estimated_size_bytes` is absent AND (`imaging_studies.length > 0` OR `imaging_findings.length > 0`)
- `imaging_critical_finding_present`: true if any finding has `clinical_significance === 'critical'`
- `imaging_stale`: true if any imaging study is older than `max_days`
- `imaging_hallucination_detected`: true if imaging finding validation fails (see §9.3)

**Note on confidence**: `DerivedImagingFinding.confidence` is REQUIRED on all findings (measurement, classification, etc.) and represents overall confidence in the finding. For classification findings, `classification.confidence` MAY also be present. Rules MUST use the top-level `confidence` field.

### 9.2 Required Imaging Rules

Policy packs SHOULD include these rules for imaging validation:

```yaml
# Imaging Data Validation Rules

rules:
  # ═══════════════════════════════════════════════════════════════
  # CRITICAL: Snapshot Size Enforcement
  # ═══════════════════════════════════════════════════════════════

  - rule_id: "imaging_snapshot_too_large"
    description: "Snapshot exceeds maximum size limit (possible raw imaging embedded)"
    priority: 1000
    when:
      kind: "snapshot_size_exceeds"
      max_bytes: 1000000  # 1 MB
    then:
      decision: "HARD_STOP"
      reason_codes: ["policy_violation"]
      explanation: "Snapshot exceeds 1 MB limit - raw imaging data must not be embedded"

  - rule_id: "imaging_size_missing_clinical"
    description: "Size estimate missing with imaging data in clinical mode"
    priority: 990
    when:
      kind: "all_of"
      conditions:
        - kind: "snapshot_size_missing_with_imaging"
        - kind: "mode_in"
          modes: ["advocate_clinical"]
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["data_quality_warning"]
      explanation: "Snapshot contains imaging but missing size estimate - verify data integrity"

  # ═══════════════════════════════════════════════════════════════
  # CRITICAL: Imaging Critical Findings
  # ═══════════════════════════════════════════════════════════════

  - rule_id: "imaging_critical_finding"
    description: "Critical imaging finding requires immediate clinician review"
    priority: 950
    when:
      kind: "imaging_critical_finding_present"
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["patient_acuity_high", "needs_human_review"]
      explanation: "Critical imaging finding detected - requires immediate clinician review"

  # ═══════════════════════════════════════════════════════════════
  # HIGH: Imaging Confidence Thresholds
  # ═══════════════════════════════════════════════════════════════

  - rule_id: "imaging_low_confidence_medication"
    description: "Low imaging confidence with medication proposal"
    priority: 920
    when:
      kind: "all_of"
      conditions:
        - kind: "imaging_confidence_below"
          threshold: 0.7
        - kind: "proposal_kind_in"
          kinds: ["MEDICATION_ORDER_PROPOSAL"]
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["high_uncertainty", "insufficient_evidence"]
      explanation: "Imaging confidence too low for medication decision"

  - rule_id: "imaging_very_low_confidence"
    description: "Very low imaging confidence requires radiologist review"
    priority: 900
    when:
      kind: "imaging_confidence_below"
      threshold: 0.5
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["high_uncertainty", "needs_human_review"]
      explanation: "Imaging classification confidence < 50% - radiologist review needed"

  # ═══════════════════════════════════════════════════════════════
  # MEDIUM: Imaging Staleness
  # ═══════════════════════════════════════════════════════════════

  - rule_id: "imaging_stale_mri"
    description: "MRI imaging older than configurable threshold (default 90 days)"
    priority: 800
    when:
      kind: "all_of"
      conditions:
        - kind: "imaging_stale"
          max_days: 90  # Configurable per cartridge/site
          modality: "MR"
        - kind: "proposal_kind_in"
          kinds: ["MEDICATION_ORDER_PROPOSAL"]
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["high_uncertainty"]
      explanation: "MRI imaging older than staleness threshold - recommend updated imaging"
      continue: true
    # NOTE: This rule is disease-agnostic. The 90-day threshold is a default
    # that can be overridden per cartridge or TA3 Site Integration Profile.
    # For CVD, cardiac MRI staleness may be configured differently than
    # neurological or oncological MRI staleness.

  # ═══════════════════════════════════════════════════════════════
  # HIGH: Imaging Hallucination Detection
  # ═══════════════════════════════════════════════════════════════

  - rule_id: "imaging_hallucination"
    description: "Imaging finding failed validation checks"
    priority: 960
    when:
      kind: "imaging_hallucination_detected"
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["drift_suspected", "policy_violation"]
      explanation: "Imaging finding references invalid source or contains inconsistent data"
```

### 9.3 Imaging Hallucination Detection Signals

Popper SHOULD check for these imaging-specific hallucination patterns:

| Signal | Description | Severity |
|--------|-------------|----------|
| **missing_source_study** | `source_study.study_id` not in `imaging_studies` | Significant |
| **modality_mismatch** | Finding type incompatible with modality (e.g., LVEF from X-ray) | Critical |
| **body_site_contradiction** | Finding `body_site` contradicts `source_study.body_part_examined` | Significant |
| **laterality_invalid** | `laterality` present for unpaired organ | Minor |
| **missing_ai_model_id** | `extractor.type === 'ai_model'` but `model_id` missing | Minor |

### 9.4 Extended Test Vectors

```yaml
test_vectors:
  # Snapshot size tests
  - name: "snapshot_too_large"
    request:
      snapshot:
        estimated_size_bytes: 2000000  # 2 MB
    expected:
      decision: "HARD_STOP"
      reason_codes: ["policy_violation"]

  # Critical finding tests
  - name: "imaging_critical_finding"
    request:
      snapshot:
        imaging_findings:
          - finding_id: "f-001"
            clinical_significance: "critical"
    expected:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["patient_acuity_high", "needs_human_review"]

  # Low confidence tests
  - name: "imaging_low_confidence_medication"
    request:
      proposals:
        - kind: "MEDICATION_ORDER_PROPOSAL"
      snapshot:
        imaging_findings:
          - finding_id: "f-001"
            classification:
              confidence: 0.6
    expected:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["high_uncertainty", "insufficient_evidence"]

  # Hallucination tests
  - name: "imaging_missing_source_study"
    request:
      snapshot:
        imaging_studies: []  # No studies
        imaging_findings:
          - finding_id: "f-001"
            source_study:
              study_id: "nonexistent-study"
    derived_signals:
      imaging_hallucination: true
    expected:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["drift_suspected", "policy_violation"]
```

### 9.5 Audit Event Requirements

For imaging validation, emit:

```yaml
# Imaging Finding Validated
audit_event:
  event_type: "OTHER"
  other_event_type: "IMAGING_FINDING_VALIDATED"
  tags:
    finding_id: "{finding.finding_id}"
    modality: "{finding.source_study.modality}"
    confidence: "{finding.confidence}"
    validation_passed: "{true|false}"
    issues_found: "{comma-separated issue types}"

# Imaging Critical Finding
audit_event:
  event_type: "OTHER"
  other_event_type: "IMAGING_CRITICAL_FINDING_DETECTED"
  tags:
    finding_id: "{finding.finding_id}"
    modality: "{finding.source_study.modality}"
    clinical_significance: "critical"

# Imaging Hallucination
audit_event:
  event_type: "OTHER"
  other_event_type: "IMAGING_HALLUCINATION_DETECTED"
  tags:
    finding_id: "{finding.finding_id}"
    hallucination_type: "{type}"
    severity: "{severity}"
```

## 10) References

- [01-popper-system-spec.md](./01-popper-system-spec.md) — System architecture
- [05-popper-measurement-protocols.md](./05-popper-measurement-protocols.md) — Accuracy and hallucination protocols
- [../03-hermes-specs/04-hermes-epistemological-types.md](../03-hermes-specs/04-hermes-epistemological-types.md) — Type definitions
- [../03-hermes-specs/05-hermes-imaging-data.md](../03-hermes-specs/05-hermes-imaging-data.md) — Imaging data types
- [../00-overall-specs/00-epistemology-foundations/](../00-overall-specs/00-epistemology-foundations/) — Epistemological grounding

