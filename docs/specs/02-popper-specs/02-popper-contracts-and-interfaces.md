---
version: 1.0.0
last-updated: 2026-01-23
status: draft
owner: Popper Dev Team
tags: [advocate, ta2, popper, api, contracts]
---

# Popper Contracts & Interfaces (v1)

This file defines:
- Popper’s **public API** (HTTP + optional MCP)
- how Popper consumes the **Hermes v1 contract** for supervision, auditability, and interoperability
- the **control plane** interface (safe-mode + settings)

## 1) Popper public API (HTTP)

### 1.1 Supervision endpoint

`POST /v1/popper/supervise`

Request: `SupervisionRequest`  
Response: `SupervisionResponse`

Rules:
- Popper MUST validate the request using Hermes schema.
- In `advocate_clinical` mode, Popper MUST additionally enforce regulated-mode requirements from Hermes, including:
  - `subject.organization_id` present and authorized for caller
  - `idempotency_key` + `request_timestamp` present
  - snapshot access available to Popper via at least one of:
    - `snapshot.snapshot_uri` present (snapshot payload retrievable within the deployment boundary), OR
    - `snapshot_payload` present inline
    - if `snapshot_payload` is present, `snapshot.snapshot_hash` MUST be present for verification
  - clock-skew validation for `request_timestamp` (default ±5 minutes)
- Popper SHOULD implement idempotency cache semantics per Hermes (§3.4.1).
- If invalid, Popper MUST return a valid `SupervisionResponse` with:
  - `decision = "HARD_STOP"`
  - `reason_codes` includes `"schema_invalid"`

Authorization (required):
- The supervision endpoint MUST be protected by strong authentication.
- In TA3 deployments, Popper MUST ensure the authenticated caller is authorized for `subject.organization_id` (no cross-tenant supervision).

### 1.2 Control plane endpoints

#### Set safe-mode
`POST /v1/popper/control/safe-mode`

Request:

```json
{
  "enabled": true,
  "reason": "Drift suspected: validation failures spiking",
  "effective_at": "2026-01-23T13:00:00.000Z",
  "effective_until": "2026-01-23T18:00:00.000Z"
}
```

Response:
- `200 OK` + a `ControlCommand` (Hermes) that can also be forwarded to Deutsch

Authorization (required):
- These endpoints MUST be protected by strong authentication + RBAC.
- Only clinician/safety-ops roles (TA3 org-controlled) may change safe-mode or operational settings.

#### Set an operational setting
`POST /v1/popper/control/settings`

Request:

```json
{
  "key": "max_autonomy_level",
  "value": "0"
}
```

Response:
- `200 OK` + a `ControlCommand`

### 1.3 Status endpoint (recommended)
`GET /v1/popper/status`

Response:
- safe-mode state
- current ruleset version
- current service version
- basic counters (requests, hard-stops, routes)

## 2) Optional Popper API (MCP)

TA2 strongly prefers an interoperability framework leveraging APIs and **MCP**.

Popper SHOULD expose an MCP server with methods equivalent to HTTP:
- `supervise(SupervisionRequest) -> SupervisionResponse`
- `setSafeMode(enabled, reason, effective_at?, effective_until?) -> ControlCommand`
- `setSetting(key, value) -> ControlCommand`
- `getStatus() -> Status`

## 3) Hermes contract dependency (Deutsch ↔ Popper)

Popper MUST validate and produce Hermes v1 messages as defined by the canonical contract:
- **Canonical contract**: [`../03-hermes-specs/02-hermes-contracts.md`](../03-hermes-specs/02-hermes-contracts.md)

Popper MUST use Hermes types/schemas for:
- `TraceContext`, `SubjectRef`, `HealthStateSnapshotRef`
- `EvidenceRef`, `DisclosureBundle`
- `ProposedIntervention` (including `kind: "OTHER"` escape hatch)
- `SupervisionRequest`, `SupervisionResponse`, `ControlCommand`
- `AuditEvent`, `HermesError`, `InteropPayloadRef`

## 4) ControlCommand (Popper → Deutsch)

Popper MUST be able to emit a control command that can be forwarded to Deutsch.
The canonical schema is Hermes `ControlCommand` (see Hermes contract).

## 5) Audit events (Popper emits these)

Popper MUST emit Hermes `AuditEvent` objects (see Hermes contract) that are joinable by `trace_id`.

Minimum required event emission for v1:
- **On receiving a request**: `event_type = "SUPERVISION_REQUEST_RECEIVED"`
- **On deciding a response**: `event_type = "SUPERVISION_RESPONSE_DECIDED"`
- **On issuing a control command**: `event_type = "CONTROL_COMMAND_ISSUED"`
- **On toggling safe-mode**:
  - `event_type = "SAFE_MODE_ENABLED"` or `"SAFE_MODE_DISABLED"`
- **On schema/validation failure**: `event_type = "VALIDATION_FAILED"`
