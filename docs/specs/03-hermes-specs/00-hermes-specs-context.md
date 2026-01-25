---
version: 1.4.0
last-updated: 2026-01-24
status: draft
owner: Hermes Dev Team
tags: [advocate, protocol, safety, auditability, interoperability]
---

# Hermes Specs Context (03-hermes-specs)

## What is Hermes?

**Hermes is the shared language (contract) that Deutsch (TA1) and Popper (TA2) use to communicate.**

Hermes is **not a server** and it is **not an “agent.”** It is a **versioned library** that provides:
- **Schema definitions** (Types + validation) for all inter-agent messages
- **Compatibility rules** (versioning policy)
- **Conformance tests** so teams can prove they “speak Hermes” correctly

If Deutsch is the “Brain” and Popper is the “Shield,” Hermes is the **Grammar Book** they both follow.

## Why Hermes exists (the real problem it solves)

Without a shared contract:
- Deutsch and Popper will silently diverge on field names, semantics, and safety metadata.
- Audit logs will become inconsistent (“can’t prove what happened”).
- The TA1↔TA2 “fusion” requirement (secure, low-latency, standardized protocol) becomes untestable.

Hermes turns “agent-to-agent communication” into **something developers can unit test**.

## What this team must deliver (definition of done)

Your team delivers a **standalone repo/library** that can be imported by both Deutsch and Popper.

### Required deliverables
- **A published package** (TypeScript) containing Hermes schemas + helpers
  - Example name: `@regain/hermes` (final naming is up to implementation)
- **Zod validation** for every message type
- **Stable JSON serialization** rules (so hashes and audits match across services)
- **Compatibility/versioning policy** (what changes are allowed in minor vs major)
- **Conformance tests**
  - “Given this JSON payload, does it validate?”
  - “Can we round-trip parse→serialize without losing meaning?”

### Optional (strongly recommended) deliverables
- **Generated JSON Schema** artifacts for non-TypeScript consumers
- **MCP adapter** (Model Context Protocol) that exposes the same “methods” as the HTTP API

## How Hermes relates to the other two systems

### Deutsch (TA1) uses Hermes to:
- Build a `SupervisionRequest` that contains:
  - what Deutsch wants to do (the proposed action)
  - why (evidence pointers + explanation bundle)
  - how confident/uncertain it is
  - the snapshot reference it reasoned over (so Popper can evaluate consistently)
- Parse a `SupervisionResponse` and obey it (approve vs hard-stop vs route)

### Popper (TA2) uses Hermes to:
- Validate every incoming `SupervisionRequest` (reject invalid / unsafe shapes)
- Produce a `SupervisionResponse` with a clear decision and audit-ready reasons
- Emit audit/export bundles that have stable fields regulators can consume

## What Hermes must standardize (minimum)

Hermes must standardize these concepts end-to-end:
- **Trace & audit metadata**
  - `trace_id`, timestamps, system versions, decision outcome, “who did what”
- **Evidence pointers**
  - citations / guideline references / data references (without embedding PHI)
- **Snapshot-first semantics**
  - Deutsch/Popper decisions refer to a stable `HealthStateSnapshotRef`
- **Fusion protocol**
  - `SupervisionRequest` ↔ `SupervisionResponse`
- **Control hooks**
  - safe-mode and operational setting changes (Popper → Deutsch)

## What Hermes must NOT do (non-goals)

- Do **not** embed CVD guidelines, risk models, or clinical logic
  - That belongs in Deutsch “cartridges” and Popper “policy/monitoring”
- Do **not** store PHI/PII
  - Hermes defines explicit `audit_redaction` fields so systems can log/export PHI-minimized “receipts”
- Do **not** make network calls
  - Hermes is a library; consumers decide transport (HTTP, MCP, queue)

## Inputs you need from other teams (so you are not blocked)

Hermes is designed so you can implement it **without waiting** for Deutsch/Popper:
- You will implement schemas and conformance tests from the contract in:
  - `02-hermes-contracts.md` (in this same folder)

The only external input you *may* want later:
- Which transports to ship first (HTTP vs MCP vs both)
- Which optional message families to include in v1 (UI instructions, FHIR shapes)

## Outputs you must hand back to other teams

- A pinned Hermes version + changelog
- A “contract test pack” (JSON fixtures) that Deutsch and Popper must pass
- A short integration guide (included in `01-hermes-system-spec.md`)

## Optional reference documents (helpful, but not required)

These are **not required** to implement Hermes. They are just background.
- Architecture overview: `/Users/gsizm/dev/01-regain-health/docs/00-vision/01-ADVOCATE/TA1 Specs/00-Architecture-Overview-Deutsch-Popper.md`
- TA1 official requirements: `/Users/gsizm/dev/01-regain-health/docs/00-vision/01-ADVOCATE/TA1 Specs/TA1-Specs.md`
- TA2 official requirements: `/Users/gsizm/dev/01-regain-health/docs/00-vision/01-ADVOCATE/TA2 Specs/TA2-Specs.md`
