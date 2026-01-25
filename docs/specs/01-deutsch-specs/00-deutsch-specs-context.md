---
version: 1.0.0
last-updated: 2026-01-23
status: draft
owner: Deutsch Dev Team
tags: [advocate, ta1, deutsch, agent, cvd]
---

# Deutsch Specs Context (01-deutsch-specs)

## What you are building

You are building **Deutsch (TA1)**: the patient-facing clinical agent system ("the Brain").

In plain terms, Deutsch:
- talks to the patient (text/voice/etc.)
- understands the patient's situation using their data (EHR + wearable + patient reports)
- proposes actions (care navigation, triage, and in regulated mode: clinician-governed Rx changes)
- produces patient-friendly outputs
- **asks Popper (TA2) for permission** before any higher-risk action

Deutsch MUST be built so it can be specialized by swapping a disease "cartridge."

## Deployment Model

**Primary: Centralized SaaS Service**

Deutsch is deployed as a **centralized HTTP API service** that clients access remotely. This enables:
- **Monetization**: API-based pricing (per-session, per-message, subscription)
- **Consistency**: All clients use the same version
- **Observability**: Centralized monitoring, drift detection, quality metrics
- **Updates**: We control deployment cadence
- **Compliance**: Easier to audit and certify

**Secondary: Library embedding (optional)**

For enterprise customers requiring data locality (hospitals, on-prem requirements), Deutsch MAY be deployed as an embedded library. This is NOT the default path.

| Deployment | Use Case | Support Level |
|------------|----------|---------------|
| **SaaS Service** | Default for all clients | Primary / Full |
| Library (on-prem) | Enterprise with data locality requirements | Secondary / Custom contract |

## The core mental model

Deutsch uses a **Game Engine + Cartridge** architecture:
- **Engine**: reusable reasoning + planning + action framework (same for every disease)
- **Cartridge**: disease-specific “pack” (ontology, guidelines, guardrails, test cases)

For ADVOCATE, the initial cartridge is **CVD** (heart failure + post-MI).

## Where Deutsch fits in the 3-system stack

- **Hermes** = shared message contract (“grammar book”)
- **Deutsch (you)** = the generator/planner (“brain”)
- **Popper** = independent checker/controller (“shield”)

Deutsch communicates with Popper using the Hermes contract:
- Deutsch sends `SupervisionRequest`
- Popper returns `SupervisionResponse`

## Deliverables (definition of done)

### Required deliverables
- **Deutsch Service API** — HTTP API with session management, streaming responses, multi-domain composition
- **Deutsch core (Engine)** implemented as a reusable internal package
- **Deutsch CVD cartridge** (initial disease spec) implemented as a plugin/module
- **Supervised action flow**
  - Deutsch MUST call Popper for supervision for all high-risk actions
  - Deutsch MUST obey Popper's decision (approve / hard-stop / route)
- **Auditability**
  - emit structured audit events for every supervised action (traceable by `trace_id`)
- **Multi-tenancy support**
  - tenant isolation, per-tenant rate limits and quotas
  - API authentication (OAuth 2.0 / API keys)

### Optional deliverables (recommended)
- Library packaging for enterprise on-prem deployments (secondary deployment model)
- A simulation harness (synthetic patients) for evaluation and regression testing

## Non-goals (things you do NOT build)
- Do not build Popper (TA2) supervision logic
- Do not define the Hermes contract (consume it)
- Do not implement hospital-specific EHR integrations inside Deutsch core
  - Deutsch consumes a **snapshot** of the patient state built by the integration layer

## Dependencies (what you need from other teams)

Deutsch depends on two external components:

1) **Hermes package**
- You must import Hermes schemas/types to build and validate supervision messages.
- Canonical Hermes contract (schemas/semantics/examples):
  - `../03-hermes-specs/02-hermes-contracts.md`

2) **Popper supervision endpoint**
- You must be able to send a `SupervisionRequest` and receive a `SupervisionResponse`.
- Transport is NOT prescribed by this spec (HTTP or MCP are both acceptable), but the payload MUST be Hermes.

## Outputs you must provide to other teams

Deutsch must provide:
- A stable `SupervisionRequest` producer implementation (Hermes-compliant)
- A stable `DisclosureBundle` / evidence pointers so Popper can evaluate and audit
- A clear separation of:
  - “low-risk patient coaching” vs
  - “treatment-changing / clinician-governed actions”

## Key spec files in this folder

- `01-deutsch-system-spec.md` — system behavior + ARPA TA1 alignment checklist
- `02-deutsch-contracts-and-interfaces.md` — Deutsch internal interfaces + Hermes dependency
- `03-deutsch-cvd-cartridge-spec.md` — the initial CVD cartridge (HF + post‑MI)
- `10-deutsch-service-api-spec.md` — **HTTP API specification** (primary deployment model)

## Optional reference documents (helpful, not required)

These are background only. This folder is fully self-contained.
- TA1 overview: `/Users/gsizm/dev/01-regain-health/docs/00-vision/01-ADVOCATE/TA1 Specs/TA1-Specs.md`
- Architecture overview: `/Users/gsizm/dev/01-regain-health/docs/00-vision/00-clinical-agents/00-overall-specs/00-deutsch-popper-hermes-architecture.md`
