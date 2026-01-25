---
version: 1.4.0
last-updated: 2026-01-24
status: draft
owner: Hermes Dev Team
tags: [advocate, protocol, safety, auditability, interoperability]
---

# Hermes System Spec (v1)

## 0) Executive Summary

Build **Hermes** as a **versioned contract library** that makes Deutsch↔Popper communication:
- **Correct** (validated)
- **Auditable** (standard receipts)
- **Interoperable** (stable JSON shapes)
- **Fast** (designed for low-latency transport and parsing)

Hermes is **not** a server and does **not** implement agent logic. Hermes defines the *message shapes and rules* that other systems must follow.

## 1) Scope

### In scope (v1)
- TypeScript contract library with runtime validation (Zod)
- Stable JSON serialization guidance + fixtures
- Conformance tests (fixtures) shared with all teams
- Message families:
  - **Supervision**: `SupervisionRequest` / `SupervisionResponse`
  - **Trace/Audit**: `TraceContext`, `AuditEvent`, `DisclosureBundle`
  - **Evidence pointers**: `EvidenceRef` (references, not PHI)
  - **Snapshot-first**: `HealthStateSnapshotRef`
  - **Interop (pointers)**: `InteropPayloadRef` (FHIR/HL7 pointers; payload stored elsewhere)
  - **Control**: `ControlCommand` (safe-mode + operational settings)
  - **Errors**: standard error envelopes

### Optional in scope (v1, if time)
- “Interop payload” convenience types (FHIR/HL7-shaped alerts/tasks beyond pointer refs)
- UI instruction types for server-driven UI are **not included in Hermes v1** in this spec set; keep UI contracts in the implementation layer unless/until we intentionally standardize UI in Hermes.
- JSON Schema generation artifacts for non-TS consumers
- MCP adapter package (same methods as HTTP)

### Out of scope
- Any clinical reasoning or guideline logic
- Any “agent behavior” implementation
- Network transports (HTTP servers, queues) except optional adapters
- Storage (databases, audit log persistence)

## 2) Design Principles (non-negotiable)

1. **Hermes must support PHI-minimized messaging + explicit redaction**
   - Operational payloads MAY include sensitive fields when strictly necessary for safety decisions.
   - Every message MUST include an `audit_redaction` form (or be convertible into one) so logs/exports can be PHI-minimized.
   - Direct identifiers (name, email, phone, address) MUST NOT appear in any `audit_redaction` fields.

2. **Validation is mandatory**
   - Every inbound/outbound message MUST be validated with Hermes Zod schemas.
   - If validation fails, the caller MUST treat the operation as unsafe (default: route/hard-stop).

3. **Stable semantics**
   - A field name has one meaning, forever (or requires a major bump).
   - Fields that affect safety decisions MUST be explicit, not hidden in free text.

4. **Snapshot-first**
   - Requests SHOULD refer to a stable `HealthStateSnapshotRef` so decisions are reproducible.

5. **Versioned and testable**
   - Hermes must ship fixture packs so teams can run contract tests in CI.

6. **Interop-first (ADVOCATE)**
   - Hermes must make it straightforward to operate in environments requiring FHIR/HL7v2 interoperability and alignment with US health IT standards (TEFCA/USCDI), without bloating the supervision payload.
   - Default strategy: **pointer-based interop refs** (payloads live in PHI-approved systems; Hermes carries stable IDs + hashes + redacted summaries).

## 3) Repository & Packaging Requirements

Hermes should be shipped as a standalone repo.

### Required exports
Hermes MUST export:
- `schemas/*` (Zod schemas)
- `types/*` (TypeScript inferred types)
- `fixtures/*` (JSON fixtures for conformance tests)
- `helpers/*` (small pure utilities; no network calls)

### Recommended package layout (one repo, multiple packages)
You may implement as one package or multiple. Recommended:
- `@regain/hermes-core` (trace, ids, time, errors, evidence refs)
- `@regain/hermes-supervision` (request/response schemas)
- `@regain/hermes-control` (control plane schemas)
- `@regain/hermes-audit` (audit events / disclosure bundles)
- Optional: `@regain/hermes-fhir`, `@regain/hermes-ui`, `@regain/hermes-mcp`

### Build constraints
- Must run in Node/Bun runtime
- Zero side effects on import (no env reads, no global init)
- Tree-shakeable modules (keep utilities small)

## 4) Versioning & Compatibility Policy

Hermes MUST use Semantic Versioning: `MAJOR.MINOR.PATCH`.

### Patch changes (safe)
- Fix documentation / comments
- Add fixtures/tests
- Bugfix a schema implementation that was incorrect (without changing the intended public contract)

### Minor changes (backward compatible)
- Add optional fields
- Add new message types
- Add new enum values ONLY if consumers can ignore unknown values safely (prefer explicit `UNKNOWN_*`)

### Major changes (breaking)
- Rename fields
- Change field meaning
- Change required/optional status
- Remove enum values

### Required runtime version fields
All top-level Hermes messages MUST include:
- `hermes_version`: string (the schema version that created the payload)

### Runtime compatibility rules (required)

Hermes is a library, but consumers MUST behave consistently at runtime:

- **Supported range**: each service MUST define a supported Hermes range, e.g. `>=1.0.0 <2.0.0`.
- **Accept**: if `hermes_version` is within the supported range, the message MAY be processed (subject to schema validation).
- **Reject**: if `hermes_version` is outside the supported range, the receiver MUST treat the message as unsafe.
  - Popper SHOULD return `HARD_STOP` with `reason_codes = ["schema_invalid"]` (and emit an audit event) rather than attempting best-effort parsing.
  - Deutsch SHOULD fail safe (route / request more info) rather than attempting to “guess” intent.
- **No silent coercion**: receivers MUST NOT silently reinterpret fields from an unsupported major version.

## 5) Performance Requirements (contract-level)

Hermes itself is a library, but it must be designed so transports can satisfy low-latency goals.

### Size budgets (hard limits)
- `SupervisionRequest` JSON payload SHOULD be <= **64 KB**
- `SupervisionResponse` JSON payload SHOULD be <= **32 KB**

If a payload must exceed these:
- Put large content behind references (e.g., evidence packs stored elsewhere)
- Keep Hermes payloads pointer-based

### Parsing budgets (target)
- Validating a typical payload SHOULD take **<5ms** on a modern server CPU.

## 6) Security & Privacy Requirements (contract-level)

### PHI/PII rules
- Hermes MUST define which fields are **operational** vs **audit_redaction**.
- Systems MUST log/export only the `audit_redaction` form unless explicitly operating in a PHI-approved logging environment.
- Forbidden in `audit_redaction`: patient name, phone, address, raw clinician notes, raw images/audio, SSN.

### Integrity (recommended)
Hermes SHOULD support optional message integrity:
- `signature` field in `TraceContext` (HMAC/JWS) or transport-level mTLS
- This is optional for v1, but the schema should leave room for it.

**Regulated deployments:** in `advocate_clinical` mode, implementations MUST enforce message integrity (either `TraceContext.signature` verification or an explicitly documented equivalent such as strict mTLS + service identity + replay protection).

Deployment appendix:
- `03-hermes-specs/03-hermes-deployment-security.md` (key custody, rotation, integrity/replay failure taxonomy)

## 7) One-page Integration Guide (for Deutsch & Popper teams)

### What Deutsch does
1. Create `SupervisionRequest` (validate it)
2. Send to Popper via transport (HTTP/MCP/queue)
3. Validate `SupervisionResponse`
4. Obey the decision (`APPROVED` / `HARD_STOP` / `ROUTE_TO_CLINICIAN` / `REQUEST_MORE_INFO`)
5. Emit `AuditEvent` with same `trace_id`

### What Popper does
1. Validate inbound `SupervisionRequest`
2. Decide (`APPROVED` / `HARD_STOP` / `ROUTE_TO_CLINICIAN` / `REQUEST_MORE_INFO`) using its own logic
3. Create `SupervisionResponse` (validate it)
4. Emit `AuditEvent` with same `trace_id`

### Shared rule
If validation fails at any step:
- **Default to safety**: `ROUTE_TO_CLINICIAN` or `HARD_STOP`

### Recommended MCP method names (non-normative)

TA2 calls out MCP explicitly. If you ship an MCP adapter package, align method names across implementations:
- `supervise(req: SupervisionRequest) -> SupervisionResponse`
- `setSafeMode(enabled: boolean, reason: string, effective_at?: string, effective_until?: string) -> ControlCommand`
- `setSetting(key: string, value: string) -> ControlCommand`
- `getStatus() -> { service_version: string; ruleset_version: string; safe_mode: { enabled: boolean; effective_until?: string } }`

## 8) Acceptance Criteria (Hermes v1)

- A dev can import Hermes and validate every message used in Deutsch↔Popper supervision.
- Hermes ships a fixture pack and a test runner; Deutsch and Popper can run it in CI.
- Hermes publishes a versioned package with a changelog and compatibility notes.
- Hermes messages include (or can be converted into) PHI-minimized `audit_redaction` forms suitable for logs and oversight.
- Hermes includes pointer-based interoperability types (`InteropPayloadRef`) so TA2 can emit FHIR/HL7-bound payload references without embedding large PHI payloads in supervision messages.

## 9) What to implement next (suggested roadmap)

- v1.0: supervision + trace/audit + evidence pointers + snapshot refs + interop pointer refs + control plane
- v1.1: convenience “interop payload” types (FHIR/HL7 shaped alerts/tasks)
- v1.2: JSON Schema generation + MCP adapter package
