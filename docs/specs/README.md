# Clinical Agents System Overview

> **For LLM Context**: This README is the entry point for understanding and improving the clinical agent specifications. Read this first, then navigate to the specific spec folders based on your task.

---

## What We Are Building

We are building a **clinically-safe, FDA-approvable agentic healthcare system** based on the epistemology of **Karl Popper and David Deutsch** (conjecture and refutation, hard-to-vary explanations, critical rationalism). The system consists of:

1. **A mobile app** (thin client) - lives in this repo (`apps/mobile`)
2. **Deutsch** (TA1) - patient-facing clinical agent ("the Brain") - separate repo
3. **Popper** (TA2) - independent supervisory agent ("the Shield") - separate repo
4. **Hermes** - shared contract/protocol library ("the Grammar Book") - separate repo

The mobile app is a "dumb" thin client that renders server-driven UI from Deutsch. The intelligence lives in the three backend systems.

---

## Canonical Reference Document

**The single source of truth for system architecture is:**

### [00-overall-specs/00-deutsch-popper-hermes-architecture.md](./00-overall-specs/00-deutsch-popper-hermes-architecture.md)

This document contains:
- Detailed mermaid diagrams of the entire system
- The "Brain vs Shield" model explained visually
- Hermes protocol flow diagrams
- Mode-dependent behavior (wellness vs clinical)
- Latency strategy (snapshot-first)
- Cybersecurity integration (cross-cutting)
- **Implementation Spec Index** (at the end) - a table of all specs that must exist before implementation can begin

**Read this document thoroughly before working on any specs.**

---

## Quick Navigation

| What you need to work on | Go to |
|--------------------------|-------|
| **Architecture (START HERE)** | [00-overall-specs/00-deutsch-popper-hermes-architecture.md](./00-overall-specs/00-deutsch-popper-hermes-architecture.md) |
| Deutsch (TA1 - the Brain) | [01-deutsch-specs/](./01-deutsch-specs/) |
| Popper (TA2 - the Shield) | [02-popper-specs/](./02-popper-specs/) |
| Hermes (Protocol Library) | [03-hermes-specs/](./03-hermes-specs/) |
| **ARPA-H requirements (MUST SATISFY)** | [00-overall-specs/A-arpa-program-description.md](./00-overall-specs/A-arpa-program-description.md) |
| TA1 requirements (Deutsch must satisfy) | [00-overall-specs/B-arpa-TA1-Specs.md](./00-overall-specs/B-arpa-TA1-Specs.md) |
| TA2 requirements (Popper must satisfy) | [00-overall-specs/C-arpa-TA2-Specs.md](./00-overall-specs/C-arpa-TA2-Specs.md) |

---

## The Big Picture

### The Problem

Current healthcare AI fails in three ways:

1. **Correlation masquerading as causation** - Pattern-matching systems confuse "A usually follows B" with causal relationships
2. **Black swan vulnerability** - Inductive models fail precisely where medicine matters most: rare, edge-case presentations
3. **Explanatory mushiness** - Probabilistic outputs ("you might have A, B, or C") obscure rather than illuminate

### Our Solution: Popper-Deutsch Epistemology

We implement **Critical Rationalism** as articulated by Karl Popper and extended by David Deutsch:

- **Knowledge grows through conjecture and refutation**, not confirmation
- **Good explanations are hard-to-vary** - you can't change details without breaking the theory
- **We optimize for explanatory power**, not probability scores
- **The system actively seeks refutation** and surfaces uncertainty honestly

As David Deutsch articulates: *"A good explanation is hard to vary while still accounting for what it purports to explain."*

### The Three-System Architecture

For detailed architecture diagrams, see **[00-overall-specs/00-deutsch-popper-hermes-architecture.md](./00-overall-specs/00-deutsch-popper-hermes-architecture.md)**.

**Summary:**

| System | Role | Mental Model |
|--------|------|--------------|
| **Deutsch** | Patient-facing agent that reasons and proposes actions | "The Brain" |
| **Popper** | Independent safety checker that approves/blocks actions | "The Shield" |
| **Hermes** | Shared contract/schemas that both systems must follow | "The Grammar Book" |

**Key insight**: Deutsch, Popper, and Hermes are **universal** (any healthcare startup can use them). The Regain mobile app is just one implementation.

---

## System Components

### Deutsch (TA1) - "The Brain"

**What it does:**
- Talks to patients (text/voice/images)
- Understands patient situation using their health data
- Generates assessments using conjecture-and-refutation reasoning
- Proposes interventions (care navigation, triage, and in clinical mode: medication changes)

**Architecture: "Game Engine + Domain Modules" (Multi-Domain Composition)**
- **Engine** (reusable): reasoning loop, planning, action framework
- **Domain Modules** (composable): domain-specific knowledge packs that can be combined

For our first implementation, the primary domain is **CVD** (heart failure + post-MI). The architecture supports **multi-domain composition** — combining clinical domains (e.g., Cardiology) with lifestyle domains (e.g., Nutrition, Exercise) into unified patient sessions. The `DomainComposer` orchestrates interactions, detects conflicts, and proposes resolutions that Popper evaluates.

**Domain categories**: `clinical | lifestyle | behavioral | preventive | rehabilitative | other`

**Critical rule**: Deutsch MUST call Popper for supervision before any high-risk action.

**Specs**: [01-deutsch-specs/](./01-deutsch-specs/)

---

### Popper (TA2) - "The Shield"

**What it does:**
- Watches what Deutsch wants to do
- Evaluates risk, uncertainty, and policy compliance
- Decides (Hermes `SupervisionDecision`): **`APPROVED`**, **`HARD_STOP`**, **`ROUTE_TO_CLINICIAN`**, or **`REQUEST_MORE_INFO`**
- Can force "safe mode" when things go wrong
- Produces audit-ready artifacts for regulators

**Philosophy: "The Strict Auditor"**
- Popper doesn't try to be helpful - it only checks if actions are safe
- If uncertain, Popper defaults to safety (route/stop)
- Popper is disease-agnostic (doesn't know CVD specifics)

**Critical rule**: Popper MUST be independent from Deutsch (separate repo, separate deployment). This prevents "AI sycophancy" and conflict of interest.

**Specs**: [02-popper-specs/](./02-popper-specs/)

---

### Hermes - "The Grammar Book"

**What it is:**
- A **versioned library** of schemas, types, and validation rules
- NOT a server - nothing "goes through Hermes"
- The shared contract that Deutsch and Popper must follow

**What it standardizes:**
- `SupervisionRequest` / `SupervisionResponse` - the fusion protocol
- `TraceContext` / `AuditEvent` - audit trail metadata
- `EvidenceRef` - citations without embedding PHI
- `HealthStateSnapshotRef` - pointer to patient state for reproducible decisions
- `ControlCommand` - safe-mode and operational settings
- `CrossDomainConflict` / `ContributingDomain` / `CompositionMetadata` - multi-domain composition types (v1.4.0+)

**Specs**: [03-hermes-specs/](./03-hermes-specs/)

---

## ARPA-H ADVOCATE Requirements (MUST SATISFY)

The ARPA-H ADVOCATE program documents define **requirements we must satisfy** to achieve FDA approval. These are not optional guidelines - they are the regulatory bar we must clear.

| Document | What it contains | Must align with |
|----------|------------------|-----------------|
| [A-arpa-program-description.md](./00-overall-specs/A-arpa-program-description.md) | Full program structure, timelines, metrics, evaluation criteria | All specs |
| [B-arpa-TA1-Specs.md](./00-overall-specs/B-arpa-TA1-Specs.md) | Requirements for patient-facing agents | [01-deutsch-specs/](./01-deutsch-specs/) |
| [C-arpa-TA2-Specs.md](./00-overall-specs/C-arpa-TA2-Specs.md) | Requirements for supervisory agents | [02-popper-specs/](./02-popper-specs/) |

**Key regulatory targets:**
- **Deutsch (TA1)**: FDA Software as Medical Device (SaMD) authorization
- **Popper (TA2)**: FDA Medical Device Development Tool (MDDT) qualification

### Alignment Verification (IMPORTANT)

**When improving specs, you MUST verify alignment with ARPA requirements:**

1. **For Deutsch specs** → Check against [B-arpa-TA1-Specs.md](./00-overall-specs/B-arpa-TA1-Specs.md):
   - Does Deutsch satisfy all TA1 functionalities? (Section 2)
   - Does it meet latency requirements? (<100ms data processing)
   - Does it support required interoperability? (FHIR, HL7v2, TEFCA/USCDI)
   - Are metrics achievable? (Phase 1A/1B targets)

2. **For Popper specs** → Check against [C-arpa-TA2-Specs.md](./00-overall-specs/C-arpa-TA2-Specs.md):
   - Does Popper satisfy all TA2 functionalities? (Section 2)
   - Is it disease-agnostic as required?
   - Does it support drift monitoring, safe-mode, hard-stop analysis?
   - Does it produce regulatory-ready exports?

3. **For Hermes specs** → Check against both TA1 and TA2:
   - Does Hermes enable the "common API" requirement?
   - Does it support <100ms fusion protocol latency?
   - Does it standardize audit/trace metadata for regulatory review?

**If you find a gap between our specs and ARPA requirements, document it and propose how to close it.**

---

## Cybersecurity: Orthogonal but Mandatory

**Cybersecurity is a separate concern from clinical safety, but both are required.**

| Layer | What it addresses | Where it lives |
|-------|-------------------|----------------|
| **Clinical Safety** | Deutsch/Popper/Hermes | Safe reasoning, supervision, auditability |
| **Cybersecurity** | PHI/PII protection, encryption, access control | Fortress architecture + phi-service/pii-service |

### How They Intersect

The clinical agents (Deutsch/Popper) and cybersecurity (PHI/PII services) meet at runtime:

```
┌──────────────────────────────────────────────────────────────┐
│                  CLINICAL SAFETY LAYER                       │
│         (Deutsch reasoning + Popper supervision)             │
│                                                              │
│   Deutsch ──SupervisionRequest──> Popper ──Response──> Deutsch│
│                         │                                    │
│                         │ uses HealthStateSnapshot           │
│                         ▼                                    │
└──────────────────────────┼───────────────────────────────────┘
                           │
          ─────────────────┼─────────────────
                           │
┌──────────────────────────┼───────────────────────────────────┐
│               CYBERSECURITY LAYER                            │
│     (protects data at rest, in transit, access control)      │
│                          │                                   │
│   ┌──────────────┐   ┌───┴────────┐   ┌──────────────┐      │
│   │ phi-service  │   │ pii-service│   │ Vault/Keys   │      │
│   │ (PHI storage)│   │ (Auth/ID)  │   │ (Secrets)    │      │
│   └──────────────┘   └────────────┘   └──────────────┘      │
│                                                              │
│   Tamper-evident audit logs | RBAC | Encryption | IR/DR     │
└──────────────────────────────────────────────────────────────┘
```

### Key Points

1. **Deutsch/Popper don't store PHI directly** - they consume `HealthStateSnapshot` pointers
2. **Audit logs are PHI-minimized** - Hermes defines `audit_redaction` fields for safe logging
3. **phi-service and pii-service are separate microservices** - not part of the clinical agent repos
4. **Offline-first mobile caching requires PHI-on-device hardening** - encryption, key management, session revocation

### Cybersecurity Documentation

- Baseline (Fortress architecture): `docs/01-product/roadmap/01-cybersecurity/00-cybersecurity-assignment.md`
- Index (implementation artifacts): `docs/01-product/roadmap/01-cybersecurity/README.md`
- ADVOCATE supply-chain: `docs/01-product/roadmap/01-cybersecurity/12-ADVOCATE-security-specs.md`
- Implementation tickets: `docs/01-product/roadmap/01-cybersecurity/13-ADVOCATE-linear-tickets.md`

---

## Implementation Spec Index

**Before implementation can begin, specific specs must exist.**

The canonical list is at the **end of [00-overall-specs/00-deutsch-popper-hermes-architecture.md](./00-overall-specs/00-deutsch-popper-hermes-architecture.md)** in the "Implementation Spec Index" section.

It contains a table with:
- Every spec file needed
- What each spec must define
- Current status (READY / PARTIAL / MISSING)
- Gap analysis (what's missing to fully implement)

**If you're planning implementation work, check this table first.**

---

## Epistemological Foundation

### The Popperian-Deutsch Reasoning Engine (inside Deutsch)

Deutsch uses a **four-agent adversarial system**:

1. **Intake Agent** → structures patient's health timeline into "unexplained phenomena"
2. **Conjecturer** → generates bold biological hypotheses (Generator role only)
3. **Critic** → systematically attempts to falsify each theory (Destructor role only)
4. **Synthesizer** → selects theories that survive refutation

**Why this works:**
- The Conjecturer cannot validate its own theories
- The Critic cannot propose alternatives
- Role separation enforces disciplined epistemology

### Hard-to-Vary (HTV) Scoring

Theories are scored on explanatory quality, not probability:

| Criterion | Good = |
|-----------|--------|
| **Interdependence** | Changing one part collapses the whole theory |
| **Specificity** | Makes precise, testable predictions |
| **Parsimony** | No ad-hoc assumptions needed |
| **Falsifiability** | Clear data would prove it wrong |

### The IDK Protocol

When all theories fail or remaining ones score identically:
- System explicitly admits "I don't know"
- Identifies which specific test would distinguish between theories
- Guides next-step clinical inquiry
- **Never hallucinates a confident answer**

---

## Operating Modes

The system behaves differently depending on deployment context:

### `wellness` mode (D2C, no clinician)
- Deutsch MUST NOT propose treatment-changing actions
- Medication suggestions → "discuss with your doctor"
- Focus: lifestyle coaching, education, tracking

### `advocate_clinical` mode (clinician-governed)
- Deutsch MAY propose medication changes under approved protocols
- Requires `clinician_protocol_ref` in proposals
- Popper enforces governance boundaries
- Full audit trail for regulatory review

---

## Multi-Domain Composition (v1.4.0+)

Deutsch supports **multi-domain composition** — combining multiple domain modules (e.g., Cardiology + Nutrition + Exercise) into unified patient sessions.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     DomainComposer                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Cardiology  │  │  Nutrition  │  │  Exercise   │         │
│  │ (clinical)  │  │ (lifestyle) │  │ (lifestyle) │  ...    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│         └────────────────┼────────────────┘                 │
│                          ▼                                  │
│              InteractionRuleEngine                          │
│         (detects conflicts, proposes resolutions)           │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼ cross_domain_conflicts[]
                    SupervisionRequest
                           │
                           ▼
                        Popper
               (evaluates ALL conflicts)
```

### Key Concepts

| Concept | Description |
|---------|-------------|
| **DomainModule** | Extends `ClinicalCartridge` with `domain_category`, priority rules, and interaction registry refs |
| **DomainCategory** | `clinical \| lifestyle \| behavioral \| preventive \| rehabilitative \| other` |
| **CrossDomainConflict** | Detected interaction between proposals from different domains |
| **ResolutionStrategy** | `override \| constrain \| merge \| sequence \| escalate` |
| **InteractionRuleEngine** | Data-driven (YAML) rules, not hardcoded logic |

### TA2 Compliance

- **ALL conflicts** are surfaced to Popper via `cross_domain_conflicts[]`, even resolved ones
- Popper evaluates resolution quality and may override or escalate
- `per_proposal_decisions[]` enables partial approval (approve some, route others)
- `interdependency_group_id` signals proposals that must be treated atomically

### Graceful Degradation

- **Default**: Only `lifestyle` domains degrade gracefully (continue with constraints if domain fails)
- **Clinical/rule_engine failure**: Always `HARD_STOP`
- **Other categories** (`behavioral`, `preventive`, `rehabilitative`): Require explicit TA3 governance opt-in

### Specs

- [01-deutsch-specs/04-multi-domain-composition-spec.md](./01-deutsch-specs/04-multi-domain-composition-spec.md)
- [01-deutsch-specs/05-domain-module-template.md](./01-deutsch-specs/05-domain-module-template.md)
- [01-deutsch-specs/06-interaction-rule-registry-spec.md](./01-deutsch-specs/06-interaction-rule-registry-spec.md)
- [02-popper-specs/03-popper-safety-dsl.md](./02-popper-specs/03-popper-safety-dsl.md) §7
- [03-hermes-specs/02-hermes-contracts.md](./03-hermes-specs/02-hermes-contracts.md) §3.3.1, §7

---

## How to Use These Specs

### If you're improving Deutsch specs:
1. Read this README first
2. Read **[00-overall-specs/00-deutsch-popper-hermes-architecture.md](./00-overall-specs/00-deutsch-popper-hermes-architecture.md)** (canonical reference)
3. Read [01-deutsch-specs/00-deutsch-specs-context.md](./01-deutsch-specs/00-deutsch-specs-context.md)
4. Read [01-deutsch-specs/01-deutsch-system-spec.md](./01-deutsch-specs/01-deutsch-system-spec.md)
5. Read [01-deutsch-specs/02-deutsch-contracts-and-interfaces.md](./01-deutsch-specs/02-deutsch-contracts-and-interfaces.md)
6. Read [01-deutsch-specs/03-deutsch-cvd-cartridge-spec.md](./01-deutsch-specs/03-deutsch-cvd-cartridge-spec.md)
7. For multi-domain composition, read:
   - [01-deutsch-specs/04-multi-domain-composition-spec.md](./01-deutsch-specs/04-multi-domain-composition-spec.md) - composition architecture
   - [01-deutsch-specs/05-domain-module-template.md](./01-deutsch-specs/05-domain-module-template.md) - domain module template
   - [01-deutsch-specs/06-interaction-rule-registry-spec.md](./01-deutsch-specs/06-interaction-rule-registry-spec.md) - interaction rules
8. **Verify alignment with [00-overall-specs/B-arpa-TA1-Specs.md](./00-overall-specs/B-arpa-TA1-Specs.md)** - all TA1 requirements must be satisfied
9. Ensure your changes are consistent with the Hermes canonical contract: [03-hermes-specs/02-hermes-contracts.md](./03-hermes-specs/02-hermes-contracts.md)
10. Do NOT add Popper logic or Hermes definitions to Deutsch

### If you're improving Popper specs:
1. Read this README first
2. Read **[00-overall-specs/00-deutsch-popper-hermes-architecture.md](./00-overall-specs/00-deutsch-popper-hermes-architecture.md)** (canonical reference)
3. Read [02-popper-specs/00-popper-specs-context.md](./02-popper-specs/00-popper-specs-context.md)
4. Read [02-popper-specs/01-popper-system-spec.md](./02-popper-specs/01-popper-system-spec.md)
5. Read [02-popper-specs/02-popper-contracts-and-interfaces.md](./02-popper-specs/02-popper-contracts-and-interfaces.md)
6. Read [02-popper-specs/03-popper-safety-dsl.md](./02-popper-specs/03-popper-safety-dsl.md) — includes §7 for multi-domain conflict evaluation rules
7. Read [02-popper-specs/04-popper-regulatory-export-and-triage.md](./02-popper-specs/04-popper-regulatory-export-and-triage.md)
8. **Verify alignment with [00-overall-specs/C-arpa-TA2-Specs.md](./00-overall-specs/C-arpa-TA2-Specs.md)** - all TA2 requirements must be satisfied
9. Ensure your changes are consistent with the Hermes canonical contract: [03-hermes-specs/02-hermes-contracts.md](./03-hermes-specs/02-hermes-contracts.md)
10. Do NOT add disease-specific logic to Popper core

### If you're improving Hermes specs:
1. Read this README first
2. Read **[00-overall-specs/00-deutsch-popper-hermes-architecture.md](./00-overall-specs/00-deutsch-popper-hermes-architecture.md)** (canonical reference)
3. Read [03-hermes-specs/00-hermes-specs-context.md](./03-hermes-specs/00-hermes-specs-context.md)
4. Read [03-hermes-specs/01-hermes-system-spec.md](./03-hermes-specs/01-hermes-system-spec.md)
5. Read [03-hermes-specs/02-hermes-contracts.md](./03-hermes-specs/02-hermes-contracts.md)
6. **Verify Hermes enables both TA1 and TA2 requirements** (common API, <100ms latency, audit support, interop pointer types)
7. Changes to Hermes affect both Deutsch and Popper - be careful
8. Follow semver strictly (see versioning policy)

---

## Key Principles to Maintain

1. **Separation of concerns**
   - Deutsch = generator/planner
   - Popper = checker/controller
   - Hermes = shared language
   - Cybersecurity = orthogonal protection layer
   - No mixing of responsibilities

2. **Default to safety**
   - When uncertain, route to clinician or hard stop
   - Never "approve by accident"
   - If Popper is unavailable, Deutsch fails safe

3. **Auditability ("Glass Box")**
   - Every decision has a `trace_id`
   - Every decision can be reconstructed from audit logs
   - PHI-minimized but complete

4. **Disease-agnostic core**
   - Deutsch Engine is reusable (swap cartridges)
   - Popper is fully disease-agnostic
   - Hermes is fully domain-agnostic

5. **Snapshot-first**
   - Decisions are made over cached health state snapshots
   - Enables reproducibility and low latency (<100ms)
   - Snapshot refs are Hermes-compatible

---

## B2B Platform Strategy

The architecture enables dual use:

### For Regain (our product)
- We use Deutsch/Popper/Hermes to build our mobile app
- We are the first (and reference) implementation

### For Other Healthtech Startups
- They import Hermes as an SDK (`@regain/hermes`)
- They send supervision requests to Popper (hosted or self-hosted)
- They build their own Layer 4 (their app) using Layers 1-3

---

## External References

- Regain Epistemology: https://regain.ai/about/en/epistemology/
- FDA Cybersecurity Guidance: https://www.fda.gov/regulatory-information/search-fda-guidance-documents/cybersecurity-medical-devices-quality-system-considerations-and-content-premarket-submissions
- NIST AI Risk Management Framework: https://doi.org/10.6028/NIST.AI.100-1
- IMDRF SaMD Clinical Evaluation: https://www.imdrf.org/sites/default/files/docs/imdrf/final/technical/imdrf-tech-200218-samd-n41.pdf

---

## Summary

**You are working on a clinical AI system that:**
- Uses Popper-Deutsch epistemology (conjecture and refutation, hard-to-vary explanations)
- Separates "thinking" (Deutsch) from "checking" (Popper) via a shared contract (Hermes)
- Is designed for FDA approval (SaMD for Deutsch, MDDT for Popper)
- Keeps cybersecurity (PHI/PII) as an orthogonal but mandatory concern
- Defaults to safety when uncertain
- Produces auditable, traceable decisions

**Start with the canonical reference: [00-overall-specs/00-deutsch-popper-hermes-architecture.md](./00-overall-specs/00-deutsch-popper-hermes-architecture.md)**

Then navigate to the specific spec folder based on your task. The `00-*-context.md` file in each folder tells you what you're building and what's out of scope.

**When making changes:**
- **Verify alignment with ARPA requirements** (TA1 for Deutsch, TA2 for Popper)
- Keep responsibilities separated
- Ensure Hermes contract consistency across all three systems
- Default to safety
- Think about auditability
- Check the Implementation Spec Index for gaps

---

*Last updated: 2026-01-24*
*Version: 1.1.0*
