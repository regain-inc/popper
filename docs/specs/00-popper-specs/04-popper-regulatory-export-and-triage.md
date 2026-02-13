---
version: 1.0.0
last-updated: 2026-01-23
status: draft
owner: Popper Dev Team
tags: [advocate, ta2, popper, regulatory, export, audit, triage]
---

# Popper Regulatory Export + Issue Triage Spec — v1

## 0) Purpose

TA2 requires Popper to:
- support **useful data transfers** to regulatory bodies for oversight
- **de-identify and aggregate** data
- provide protocols for **rapid issue triage and resolution**

This document specifies:
1) a de-identified **Export Bundle** format
2) the minimum **triage workflow** Popper must support (incident + safe-mode)

Hermes is the contract foundation for traceability and redaction:
- `../03-hermes-specs/02-hermes-contracts.md`

## 1) Definitions

- **Export Bundle**: a packaged, de-identified artifact representing one or more supervised actions and related safety events.
- **Incident**: a record representing a suspected safety issue (e.g., drift spike, repeated policy violations, schema failures).
- **Safe-mode**: a time-bounded posture that routes or stops high-risk actions.

## 2) Export Bundle goals

- **PHI-minimized by default**: the bundle must be safe to share with appropriate oversight partners under the program’s data-sharing agreements.
- **Reproducible**: include snapshot references + hashes where possible (without embedding PHI payloads).
- **Actionable**: include clear summaries, reason codes, and rule versions.
- **Composable**: bundles can be aggregated across a time window or cohort without format changes.

## 3) Bundle contents (v1)

An Export Bundle MUST include:

### 3.1 `bundle_manifest.json` (required)

```json
{
  "bundle_version": "1.0.0",
  "generated_at": "2026-01-23T13:00:00.000Z",
  "generator": {
    "system": "popper",
    "service_version": "popper-1.0.0",
    "ruleset_version": "popper-safety-1.0.0"
  },
  "scope": {
    "mode": "advocate_clinical",
    "organization_id": "org_123",
    "time_window": { "from": "2026-01-23T00:00:00.000Z", "to": "2026-01-23T23:59:59.999Z" }
  },
  "trace_ids": ["2f4a5f2a-4c3a-4d3f-9c60-1c9e2c7a9f11"],
  "files": {
    "audit_events": "audit_events.jsonl",
    "supervision_receipts": "supervision_receipts.jsonl",
    "incident_summaries": "incidents.jsonl"
  }
}
```

### 3.2 `audit_events.jsonl` (required)

JSON Lines file of Hermes `AuditEvent` objects in PHI-minimized form.
- MUST include events relevant to supervision, validation failures, and safe-mode toggles.
- MUST be joinable by `trace_id`.

### 3.3 `supervision_receipts.jsonl` (required)

JSON Lines file containing, per `trace_id`:
- `SupervisionRequest.audit_redaction`
- `SupervisionResponse.audit_redaction`
- `trace.producer` (service + ruleset versions)
- `snapshot` ref (Hermes `HealthStateSnapshotRef`) with `snapshot_hash` if available

### 3.4 `incidents.jsonl` (required when incidents exist)

Each incident record MUST be de-identified and MUST include:
- `incident_id`
- `created_at`
- `severity` (info/warning/critical)
- `trigger` (e.g., validation_failure_spike, policy_violation_spike, manual_ops)
- `safe_mode` state changes (if any)
- `summary` (PHI-minimized)
- `related_trace_ids[]`

## 4) De-identification rules (mandatory)

Export bundles MUST NOT contain:
- direct identifiers (name, phone, email, address)
- raw clinician notes
- raw images/audio/video
- full EHR documents or FHIR bundles unless explicitly approved under a PHI-sharing agreement

Allowed:
- pseudonymous `subject_id` and `organization_id`
- `audit_redaction` summaries
- `snapshot_ref` with internal `snapshot_uri` (only if the recipient has access); otherwise omit `snapshot_uri` and include only `snapshot_id` + `snapshot_hash`

## 5) Issue triage workflow (v1)

### 5.1 Triggers (minimum)

Popper MUST support the following trigger types:
- spike in `VALIDATION_FAILED`
- spike in `HARD_STOP`
- spike in repeated `policy_violation` reason codes
- any integrity-related validation failures (even if not “spiky”), such as `VALIDATION_FAILED` events tagged:
  - `signature_invalid` / `replay_suspected` / `snapshot_integrity_failed` / `unauthorized_org`
- manual clinician/safety ops trigger

### 5.2 Actions (minimum)

When a trigger fires:
1. **Enable safe-mode** (time-bounded if possible)
2. **Create an incident record**
3. **Generate an export bundle** for the time window and trace set relevant to the trigger
4. **Emit audit events** documenting the above

### 5.3 Resolution (minimum)

Popper MUST support a resolution workflow that:
- records who disabled safe-mode and why (audit event)
- records the incident outcome (resolved / false-positive / requires follow-up)
- records any policy pack version changes (traceable to ruleset_version bumps)

## 6) Acceptance criteria

- A TA3 clinician/safety operator can trigger safe-mode and get an export bundle within minutes.
- Export bundles contain enough information to reconstruct “what happened” without leaking direct identifiers by default.
- Every bundle is trace-linked and versioned (service + policy versions).

