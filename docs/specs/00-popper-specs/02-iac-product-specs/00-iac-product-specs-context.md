# 00 — IAC Product Implementation Specs: Context

> **Version**: 0.3.0
> **Date**: 2026-03-19
> **Status**: Draft
> **Distribution**: Internal only — do not share with IAC or external stakeholders

---

## Authority and Draft Status

> **Global disclaimer:** This spec set targets Regain's proposed IAC echo AI accreditation framework. IAC has not adopted, endorsed, or reviewed this framework as of 2026-03-19. Any requirement, evidence structure, or facility workflow described in these specs is **preparatory** and may require revision if IAC modifies, partially adopts, or rejects the proposal. Nothing in this spec set should be cited externally as an "IAC requirement."

### What is authoritative now (external, adopted)

| Source | Status | Citation pattern in specs |
|---|---|---|
| IAC AI Task Force Guidance Addendum (April 2025, Pizzutiello chair) | Published by IAC | "Per IAC's published guidance..." |
| IAC organizational structure, accreditation process, facility counts | Published by IAC | Direct citation |
| FDA guidance documents (PCCP, DSF Lifecycle, MedWatch) | Published by FDA | Direct citation |
| Clinical literature (He et al. 2023, Us2.ai, ASE 2025) | Peer-reviewed | Direct citation |
| NIST AI RMF, ISO 14971, IEC 62304 | Published standards | Direct citation |

### What is Regain's proposal (pending IAC review)

| Source | Status | Citation pattern in specs |
|---|---|---|
| Echo Standards draft I–VIII (`05-external/31-*`) | Regain draft, not submitted | "Proposed Standard X would require..." |
| §4 evidence requirements | Regain draft | "The proposed §4 structure..." |
| Facility readiness checklist (`05-external/33-*`) | Regain draft | "The proposed checklist..." |
| Governance framework (`05-external/30-*`) | Regain draft | "The proposed framework..." |

### What is speculative / pilot-calibrated

| Source | Status | Citation pattern in specs |
|---|---|---|
| Numeric thresholds (50-study minimum, 25% override threshold) | Illustrative, subject to pilot calibration | "Proposed as pilot starting point..." |
| Echo pilot scope and pricing | Internal planning assumption | "If IAC commissions an echo pilot..." |
| Revenue projections from IAC standards | Internal modeling | Not cited in specs (see playbooks) |

### How to write requirement language in this spec set

| Pattern to use | Pattern to avoid |
|---|---|
| "Proposed Standard X would require..." | "IAC Standard X requires..." |
| "This spec targets the proposed §4 structure..." | "This satisfies IAC §4 evidence requirements..." |
| "Draft-aligned evidence package..." | "Complete evidence package for IAC submission..." |
| "If IAC adopts a similar framework..." | "When IAC publishes standards..." |
| "Mapped to Regain's proposed draft..." | "Mapped to IAC requirements..." |

---

## Evidence Status Convention

Every spec in this set carries an evidence status label at the top. Use these to calibrate what is real vs aspirational:

| Label | Meaning |
|---|---|
| **Implemented** | Code exists, tests pass, deployed or deployable |
| **Spec-backed** | Interface and architecture defined, not yet coded |
| **Not evidenced** | Depends on undefined data flows, facility systems, or unbuilt infrastructure |

**Rule:** Do not claim externally (VC, IAC, YC, FDA) that something is "built" unless its evidence status is **Implemented**. See `06-regain-solutions-iac-perspective/08-live-vs-specified-vs-still-needed.md`.

---

## What This Spec Set Covers

This directory contains implementation specifications for Popper product features that would support facilities in generating evidence aligned to Regain's proposed IAC accreditation framework. These specs tell engineers **how to build** features; they target a draft proposal that IAC has not yet reviewed. If IAC adopts a substantially similar framework, these features become compliance-enabling. If IAC modifies the framework, the specs will need corresponding updates.

### What already exists

The **clinical grounding specs** (`01-clinical-grounding-and-supervision/`) cover:
- Policy engine architecture, DSL, and provenance model
- Independent safety supervision (IAC Standard II — Category 2)
- Ongoing performance monitoring and drift detection (IAC Standard III — Category 4)
- Clinical governance review workflow (IAC Standard V partial — Category 3 partial)
- Regulatory export bundles and triage (`04-popper-regulatory-export-and-triage.md`)

These specs implement the **core supervision stack** — the features where Popper's primary value lies.

### What this spec set adds

Five implementation specs covering the IAC categories that have **no** corresponding Popper product spec:

| Spec | IAC Standard | What It Specifies | Evidence Status |
|---|---|---|---|
| `01-pre-deployment-validation.md` | Standard I (Cat 1) | Validation toolkit, test harness, echo metrics | Spec-backed |
| `02-bias-monitoring-architecture.md` | Standard VI (Cat 5) | PHI-blind facility-side join, disparity analysis | Spec-backed (Popper export) / Not evidenced (facility library) |
| `03-override-analytics.md` | Standard V (Cat 3) | Override ingestion, aggregate stats, investigation | Spec-backed |
| `04-adverse-event-detection.md` | Standard VIII (Cat 8) | Detection criteria, near-miss, root cause, MedWatch | Spec-backed |
| `05-iac-report-exporters.md` | Standards I–VIII | Report generators, case study, readiness tracker | Spec-backed (partial — Standard III data pipeline undefined) |

**Coverage status after this spec set:** Every IAC Standard (I–VIII) has a corresponding spec mapping. Standards II and IV (partial) have implemented backing. Standards I, III, V, VI, VII, VIII have spec-backed designs with gaps noted per-spec. This is coverage-mapped, not gap-closed.

---

## Relationship to IAC External Documents

The proposed echo AI accreditation standards are in:

```
09-deliverables/02-iac/05-external/31-iac-ai-standards-draft-echo-external.md
```

**CRITICAL: That document is Regain's draft proposal for IAC, not an adopted IAC standard.** It has not been submitted, reviewed, or approved by IAC. IAC may accept it as-is, modify it substantially, or reject it entirely. The eight "Standards" (I–VIII) and §4 evidence requirements referenced throughout this spec set are **Regain's proposed requirements**, not IAC's published requirements.

**What this means for Popper specs:** These specs are built against the proposed standards as a design target. If IAC modifies the requirements, the Popper specs will need to be updated to match. The architecture is designed to be adaptable — configurable thresholds, modular report generators, and policy-pack-based rules mean most changes can be absorbed without architectural rework. But the specific acceptance criteria, report shapes, and evidence mappings in these specs are provisional.

**What IS real from IAC:**
- The IAC AI Task Force Guidance Addendum (April 2025, Pizzutiello chair) — this is published and defines eight governance categories. Our proposed standards operationalize these categories for echo.
- IAC's accreditation process and organizational structure
- The ~14,000 accredited facilities

**What is Regain's proposal, pending IAC review:**
- The eight proposed binding standards (Standards I–VIII) in `31-iac-ai-standards-draft-echo-external.md`
- The §4 evidence submission requirements
- The non-binding guidelines and transition plan
- The facility readiness checklist in `33-iac-ai-facility-readiness-checklist-external.md`

IAC accredits facilities, not vendors. Popper is a tool that would help facilities generate evidence for accreditation — once the standards exist in adopted form.

---

## Relationship to Clinical Grounding Specs

```
01-clinical-grounding-and-supervision/
├── 08-regulatory-and-accreditation-alignment.md   ← Gap analysis (Layer C)
├── 09-clinical-governance-review-workflow.md       ← Override review workflow
└── (other clinical grounding specs)

02-iac-product-specs/                               ← This directory
├── 00-iac-product-specs-context.md                 ← You are here
├── 01-pre-deployment-validation.md
├── 02-bias-monitoring-architecture.md
├── 03-override-analytics.md
├── 04-adverse-event-detection.md
└── 05-iac-report-exporters.md
```

The clinical grounding specs define Popper's **core supervision architecture**. This spec set defines **IAC-specific product features** that wrap around that core. Cross-references flow both ways — the clinical grounding spec `08-regulatory-and-accreditation-alignment.md` identifies the gaps; these specs close them.

---

## Three-System Boundary

Every spec in this set defines what happens in each of three systems:

| System | Owns | Does NOT Own |
|---|---|---|
| **Popper** | Supervision engine, audit trail, drift detection, de-identified export bundles, aggregate analytics, report generation | PHI, demographic data, patient records, clinician identity |
| **MISS** | Clinical UI, clinician feedback capture, real-time patient data, Hermes event emission, validation dataset UI | Policy evaluation, supervision logic, safety verdicts |
| **Facility** | Demographic registry, PHI, clinician credentialing, governance committee, IAC application submission, training records, facility artifact uploads (independence docs, training records, conflict protocols, committee minutes, completed bias reports) | Supervision engine, policy packs, drift detection |

This boundary is **non-negotiable** for PHI-blind architecture. When a spec describes a workflow that crosses system boundaries, it specifies the handoff contract explicitly.

### Boundary Exceptions (Narrow, Explicit)

| Data Type | Where It Lives | Redaction Rule |
|---|---|---|
| **Clinician IDs** in feedback | Popper `clinician_feedback` hypertable | Pseudonymous only — facility owns the mapping to real identity |
| **Demographic tags** in feedback | Popper `clinician_feedback.age_group` column | Clinical context only (pediatric/adult/geriatric from Hermes `DemographicContext`). NOT full demographic data. |
| **Validation demographics** | MISS validation UI → Popper validation report | Transient: used for representativeness computation, retained only in aggregate form in the validation report. Row-level demographics deleted after report generation. Deletion timing: within 24 hours of report finalization. |
| **Facility artifacts** | Uploaded by facility via `POST /v1/organizations/{org_id}/artifacts` | Stored as opaque attachments. Popper does not parse PHI from facility uploads — they are passed through to the evidence package. |

### Facility Artifact Intake

Several proposed §4 evidence items are facility-owned: independence documentation (proposed Standard II), training records (proposed Standard IV), conflict resolution protocols (proposed Standard VII), committee review evidence (proposed Standards III, V), completed bias monitoring reports (proposed Standard VI), and adverse event policies (proposed Standard VIII). Popper must accept these as uploaded artifacts and package them into draft-aligned evidence bundles.

```
POST /v1/organizations/{org_id}/artifacts
Content-Type: multipart/form-data
Fields: standard (1-8), artifact_type, file, description
```

Artifacts are stored as opaque blobs. Popper does not extract, index, or validate their content — it packages them into the draft-aligned evidence bundle alongside Popper-generated reports.

---

## Reading Order

For engineers new to this spec set:

1. **This file** (context and boundaries)
2. **`03-override-analytics.md`** — richest existing Hermes type support, most concrete data flow
3. **`01-pre-deployment-validation.md`** — independent, no dependency on other new specs
4. **`02-bias-monitoring-architecture.md`** — depends on understanding the export pattern from 03
5. **`04-adverse-event-detection.md`** — extends the incident schema, depends on override pattern
6. **`05-iac-report-exporters.md`** — references all other specs

For understanding IAC compliance holistically, also read:
- `08-regulatory-and-accreditation-alignment.md` (gap analysis)
- `09-clinical-governance-review-workflow.md` (governance roles)
- `04-popper-regulatory-export-and-triage.md` (export bundle format)

---

## Authoritative Sources

### FDA

| Source | Relevance |
|---|---|
| PCCP Final Guidance (Dec 2024, updated Aug 2025) | Post-market surveillance, predetermined change control |
| AI-Enabled DSF Lifecycle Management Draft Guidance (Jan 2025) | Bias analysis requirements, lifecycle documentation |
| MedWatch 3500A form | Adverse event reporting structure (Spec 04) |
| 209 cardiovascular AI devices authorized (JACC Advances, Sept 2025) | Market context |
| ~5% of cleared AI devices had reported adverse events (AHA Dec 2025) | Adverse event baseline |

### IAC

| Source | Status | Relevance |
|---|---|---|
| AI Task Force Guidance Addendum (April 2025, Pizzutiello chair) | **Published by IAC** | Eight governance categories — real, adopted |
| Echo Standards draft — Standards I–VIII + §4 evidence requirements | **Regain's proposal (not submitted)** | Design target for all specs — provisional, subject to IAC review |
| >14,000 accredited facilities, >5,200 echo sites | **Published by IAC** | Scale context |

### Clinical Validation

| Source | Relevance |
|---|---|
| He et al. 2023 Nature: AI LVEF override rate 16.8% (n=3,495 blinded RCT) | Override threshold benchmark (Spec 03) |
| Us2.ai PANES-HF: Sensitivity 84.6%, specificity 91.4% for LVEF <50% | Validation benchmark (Spec 01) |
| AI LVEF ICC 0.92 across published studies | Accuracy benchmark (Spec 01) |
| ASE 2025 Reporting Standardization (JASE 2025;38:735–774) | Echo measurement standards (Spec 01) |

### Governance Frameworks

| Source | Relevance |
|---|---|
| URAC Health Care AI Accreditation (Sept 2025) | Organizational governance alignment |
| Joint Commission/CHAI (Sept 2025) | Facility governance elements |
| NIST AI RMF 1.0 (Jan 2023) + AI 600-1 (July 2024) | Fairness, bias monitoring (Spec 02) |
| ISO 14971:2019 | Risk management (Spec 04) |
| IEC 62304:2006+Amd1:2015 | Software lifecycle (Spec 04) |
| ISO/IEC 42001:2023 | AI management system |

---

## Training (Proposed Standard IV — Category 7)

Proposed Standard IV (Clinician Training) would be a **facility-level** deliverable, not a Popper product feature. Popper does not own clinician training curricula or competency assessments.

A training package template for echo AI is maintained in:

```
09-deliverables/02-iac/06-training/
```

This includes:
- Training curriculum template covering AI capabilities, limitations, failure modes, override procedures
- Competency assessment framework

Popper's contribution to proposed Standard IV would be indirect: the dashboard, audit trail, and override analytics provide the data and tools that training programs would reference.
