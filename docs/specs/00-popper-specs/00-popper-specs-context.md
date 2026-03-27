---
version: 1.3.0
last-updated: 2026-02-13
status: draft
owner: Popper Dev Team
tags: [advocate, ta2, popper, supervision, safety, control-v2]
---

# Popper Specs Context (02-popper-specs)

## What you are building

You are building **Popper (TA2)**: the independent supervisory agent (“the Shield” / “Referee”).

In plain terms, Popper:
- watches what Deutsch (TA1) wants to do
- evaluates risk, uncertainty, and guideline/policy compliance
- decides whether Deutsch can proceed
- can force “safe mode” and other operational controls
- produces audit-ready artifacts and de-identified exports for oversight

Popper must be **independent** from Deutsch (separate repo/service), to reduce "AI sycophancy" and conflicts of interest.

## Open Source & Brain-Agnostic Design

**Popper is designed as an open source project** that can supervise **any** clinical reasoning agent ("Brain"), not just Deutsch.

### Implications

| Principle | Description |
|-----------|-------------|
| **Brain-agnostic** | Popper makes no assumptions about which Brain sends `SupervisionRequest`. Third parties can use Popper with their own agents. |
| **No trust in Brain** | Popper MUST NOT assume that the Brain has validated anything (staleness, schema, etc.). Popper validates independently. |
| **Self-contained safety** | All safety checks are in Popper. Brain's checks are UX optimizations, not safety guarantees. |
| **Configurable** | Thresholds and policies are in config files, not hardcoded. Self-hosted users can customize. |

### Deployment Models

| Model | Description | Who Operates |
|-------|-------------|--------------|
| **Open Source (self-hosted)** | Users run their own Popper instance | Customer |
| **Managed Service (SaaS)** | We operate Popper for customers | Regain Health |

### Staleness: Popper is Authoritative

Because Popper is Brain-agnostic:
- **Popper MUST validate snapshot staleness** independently, regardless of whether the Brain claims to have checked it.
- Brain (Deutsch or other) MAY check staleness for UX (faster feedback to user), but this is NOT a safety guarantee.
- Staleness thresholds are **configured in Popper**, not in the Brain.

## Where Popper fits in the 3-system stack

- **Hermes** = shared message contract (“grammar book”)
- **Deutsch** = generator/planner (“brain”)
- **Popper (you)** = checker/controller (“shield”)

Popper communicates with Deutsch using Hermes:
- receives `SupervisionRequest`
- returns `SupervisionResponse`

## Deliverables (definition of done)

### Required deliverables
- **Supervision API**
  - Validate incoming `SupervisionRequest` (Hermes-compliant)
  - Return `SupervisionResponse` (Hermes-compliant)
- **Deterministic safety layer (policy first)**
  - Popper must be able to "hard stop" without calling an LLM
- **Control plane**
  - Safe-mode toggles and operational setting changes (Popper → Deutsch)
- **Control plane v2** *(implemented)*
  - DSL `reconfigure` side-effects for trend-based operational settings changes
  - Signal Aggregator (Redis-backed) for supervision signal collection
  - Reconfigure Policy Engine with configurable thresholds and cooldowns
  - Desired-State Manager with PostgreSQL persistence and reconciliation loops
  - Push Delivery pipeline with circuit breaker, dead-letter queue, and retry strategy
  - 5 new v2 API endpoints (settings, mode, state, reconciliation, manual reconciliation)
  - 6 Prometheus metrics for push delivery observability
- **Auditability**
  - Every decision emits audit events joinable by `trace_id`
  - Control commands emit `CONTROL_COMMAND_ISSUED` audit events
  - State divergence and reconciliation failures produce audit trails
- **FDA MDDT Qualification (MANDATORY per ARPA-H TA2 §2.G)**
  - FDA MDDT Qualification application (NAM category)
  - Context of Use (COU) statement aligned with ARPA-H TA2 requirements
  - Evidence package meeting ARPA-H metric targets (>95% accuracy, >95% hallucination quantification)
  - Validation using UCSF Lethal Arrhythmia Database (FDA MDDT-qualified Mar 2024)
  - Reference: [`../00-overall-specs/0B-FDA-alignment/13-qualified-mddt-solutions.md`](../00-overall-specs/0B-FDA-alignment/13-qualified-mddt-solutions.md)

### Optional deliverables (recommended)
- A minimal clinician ops UI or integration hooks (queue + alerts)
- Drift monitoring dashboards (quality dips, hallucination rate estimates)
- Regulator export bundle generator (de-identified)

## Non-goals (things you do NOT build)
- Do not build Deutsch (TA1)
- Do not define Hermes (consume Hermes)
- Do not implement disease-specific logic inside Popper core
  - Popper MUST remain disease-agnostic; disease “knowledge” should come via policies/config and evidence refs

## Dependencies (what you need from other teams)

1) **Hermes package**
- You must import Hermes schemas/types.
- Canonical Hermes contract (schemas/semantics/examples):
  - `../03-hermes-specs/02-hermes-contracts.md`

2) **Deutsch request producer**
- Popper needs Deutsch to send `SupervisionRequest` and obey responses.

## Outputs you must provide to other teams

Popper must provide:
- A stable decision vocabulary (approve / hard-stop / route)
- A stable control vocabulary (safe-mode + settings)
- Clear reason codes so Deutsch can message patients safely and clinicians can audit

## Key spec files in this folder

- `01-popper-system-spec.md` — system behavior + ARPA TA2 alignment checklist
- `02-popper-contracts-and-interfaces.md` — Popper API/MCP + Hermes dependency
- `03-popper-safety-dsl.md` — deterministic policy pack + test vectors
- `04-popper-regulatory-export-and-triage.md` — de-identified export bundles + incident workflow
- `05-popper-measurement-protocols.md` — accuracy ascertainment + hallucination quantification
- `10-popper-service-architecture.md` — tech stack, repo structure, data storage, deployment
- `06-popper-control-plane-v2.md` — control decision engine, signal aggregation, reconfigure policies, desired-state manager *(implemented)*
- `07-popper-push-delivery.md` — HTTP push delivery, circuit breaker, dead-letter queue, retry strategy, observability *(implemented)*
- `08-arpa-iso-traceability-matrix.md` — ARPA-H ISO compliance mapping (all 9 gaps GREEN)

## Optional reference documents (helpful, not required)

This folder is fully self-contained. These are background only:
- TA2 overview: `/Users/gsizm/dev/01-regain-health/docs/00-vision/01-ADVOCATE/TA2 Specs/TA2-Specs.md`
- Architecture overview: `/Users/gsizm/dev/01-regain-health/docs/00-vision/00-clinical-agents/00-overall-specs/00-deutsch-popper-hermes-architecture.md`

---

## IAC Product Specs — Moved

> **As of 2026-03-26**, the IAC product specs (`02-iac-product-specs/`) and clinical grounding specs (`01-clinical-grounding-and-supervision/`) have been **centralized** into `07-regain-accreditation/docs/` as the single source of truth for the IAC accreditation product line.
>
> Redirect stubs remain in each file pointing to the canonical location.
>
> **Canonical index**: `07-regain-accreditation/docs/00-index.md`
