# 08 — Regulatory and Accreditation Alignment

> **Version**: 0.1.0
> **Date**: 2026-03-19

---

## Overview

Popper operates within a three-layer regulatory, governance, and accreditation environment. This document maps Popper's capabilities to each layer and identifies what must be built, documented, or demonstrated for alignment. It does not claim endorsement or certification — it documents how Popper should be built so it is naturally compatible with these frameworks.

---

## The Three-Layer Environment

```
┌──────────────────────────────────────────────────────┐
│  Layer A: Device/Regulatory                          │
│  FDA (SaMD, PCCP, AI/ML lifecycle), CMS              │
│  Focus: Is the product safe and effective?            │
├──────────────────────────────────────────────────────┤
│  Layer B: Organizational Governance                  │
│  URAC, Joint Commission/CHAI, NIST AI RMF            │
│  Focus: Does the organization govern AI responsibly? │
├──────────────────────────────────────────────────────┤
│  Layer C: Facility/Modality Validation               │
│  IAC, ACR                                            │
│  Focus: Does the facility meet clinical depth        │
│         and quality standards for specific modalities?│
└──────────────────────────────────────────────────────┘
```

These layers are complementary, not competing. A facility using Popper may need to satisfy all three simultaneously.

---

### IAC Standards Cross-Reference

Popper and the accreditation product (`07-regain-accreditation`) number their standards differently. The table below provides the canonical mapping between the two numbering systems.

| Popper Category | Popper Name | Accreditation Standard | IAC Name |
|---|---|---|---|
| 1 | Pre-Deployment Validation | I | Pre-Deployment Validation |
| 2 | Independent Safety Supervision | II | Independent Safety Supervision |
| 3 | Clinician Override Tracking | V | Override and Rejection Tracking |
| 4 | Performance Monitoring/Drift | III | Ongoing Performance Monitoring |
| 5 | Bias and Equity Monitoring | VI | Equity and Bias Monitoring |
| 6 | Multi-Vendor AI Governance | VII | Governance and Transparency |
| 7 | Clinician Training | IV | Clinician Training and Competency |
| 8 | Adverse Event Reporting | VIII | Adverse Event Reporting |

> **Note:** The accreditation product (07-regain-accreditation) uses the IAC Standard numbering (I-VIII) which differs from Popper's original category numbering. The table above provides the canonical mapping. The accreditation evaluator implements all 8 standards with 47 detailed requirements (see spec-iac-echo-standards.md).

---

## Layer A: Device/Regulatory (FDA, CMS)

### FDA AI/ML SaMD

**Relevant guidance:**
- FDA PCCP Final Guidance (December 2024, updated August 2025): Marketing Submission Recommendations for a Predetermined Change Control Plan for AI-Enabled Device Software Functions
- FDA Draft Guidance (January 2025): AI-Enabled Device Software Functions: Lifecycle Management
- Five Guiding Principles for PCCPs (August 2025): Joint FDA/Health Canada/MHRA

**What Popper provides that aligns:**

| FDA Expectation | Popper Capability | Status |
|---|---|---|
| **Description of Modifications** — What changes are anticipated? | Policy pack versioning with semantic versioning. Each pack has `policy_version`, `metadata.sources`, and per-rule provenance. Changes are tracked via version history. | Partially implemented: versioning exists; provenance proposed in this spec set |
| **Modification Protocol** — How will changes be implemented and verified? | Policy pack review workflow (see `09-clinical-governance-review-workflow.md`). Changes go through clinical governance review before activation. Pack loader validates compatibility. | Proposed in this spec set |
| **Impact Assessment** — How will the impact of changes be evaluated? | Drift detection monitors decision distribution changes. A/B comparison of decision outcomes between pack versions could be built. Audit trail enables retrospective impact analysis. | Drift detection implemented; A/B comparison not yet built |
| **Labeling Transparency** — Users must know the system was authorized with a PCCP | Dashboard surfaces active policy pack version and sources. Not yet designed for patient-facing transparency. | Dashboard exists; transparency layer needed |
| **Risk-Based Approach** — Changes with higher risk require more rigorous protocols | Source hierarchy (Layer 1-5) and enforcement levels (HARD_STOP through APPROVED) encode risk stratification. Higher-layer rules require more rigorous governance review. | Proposed in this spec set |

**What is NOT yet aligned:**
- No formal PCCP document exists for Popper (this is a regulatory submission artifact, not a software feature)
- No formal QMS (Quality Management System) integration for policy pack lifecycle
- No pre-market validation dataset or performance testing results
- No formal risk management file per ISO 14971

### CMS

**Relevance:** CMS Conditions of Participation may require that AI-assisted clinical decisions in accredited facilities have documented oversight mechanisms. Popper's supervision model provides this, but CMS-specific documentation has not been prepared.

**What Popper provides:**
- Independent supervisory layer (structurally separate from the AI generating recommendations)
- Audit trail for all supervisory decisions
- Clinician-in-the-loop for all clinical proposals (`ROUTE_TO_CLINICIAN`)
- Safe-mode as an operational circuit breaker

**What is NOT yet aligned:**
- No CMS-specific compliance documentation
- No mapping of Popper capabilities to specific Conditions of Participation

---

## Layer B: Organizational Governance (URAC, Joint Commission/CHAI, NIST)

### URAC Health Care AI Accreditation

**Program:** Launched September 15, 2025. Two tracks: Developers (Regain) and Users (health systems deploying Popper).

**Three core standards domains:**

| URAC Domain | Popper Alignment | Status |
|---|---|---|
| **Risk Management** | Source hierarchy defines risk levels. Enforcement levels map safety criticality. Policy rules encode risk-based decisions. ISO 14971-compatible risk thinking (though no formal risk management file). | Partially aligned; formal risk documentation needed |
| **Operations & Infrastructure** | Deployed on isolated infrastructure (separate service from Deutsch). PHI-blind design. API key + role-based access. Safe-mode controls. Circuit breaker and fallback handling. Dual-region deployment capability. | Strongly aligned |
| **Performance Monitoring & Improvement** | Drift detection with configurable thresholds. Decision distribution monitoring. Audit trail with time-series analysis. Clinician feedback loop (via Hermes ClinicianFeedbackEvent). | Moderately aligned; bias monitoring gap remains |

**Key gaps for URAC Developer track:**
- Bias mitigation strategy is not documented (Popper is PHI-blind and cannot stratify by demographics independently)
- Formal transparency documentation ("model card" equivalent for a rule engine) does not exist
- Clinical effectiveness metrics are not defined

### Joint Commission / CHAI

**Program:** Initial guidance released September 17, 2025. Voluntary guidance for 22,000+ Joint Commission-accredited organizations.

| JC/CHAI Expectation | Popper Alignment | Status |
|---|---|---|
| **AI Governance Committee** | Not a Popper feature — this is an organizational requirement. Popper provides the tooling (dashboard, audit logs, safe-mode controls) that a governance committee would use. | Tooling ready; organizational structure is customer-side |
| **Patient Privacy & Transparency** | PHI-blind design. De-identified audit events. No patient data stored in Popper. | Strongly aligned |
| **Data Security** | API key authentication. Role-based access (ops_admin, ops_viewer, compliance). HIPAA-compatible architecture (PHI never enters Popper). | Strongly aligned |
| **Ongoing Quality Monitoring** | Drift detection. Decision distribution tracking. Audit event time-series. | Implemented |
| **Voluntary Reporting** | Audit trail provides raw data for incident reporting. No integration with Patient Safety Organizations yet. | Partially aligned |
| **AI Model Cards** | Popper is not an AI model — it is a deterministic rule engine. A "policy pack card" equivalent could describe each pack's sources, rules, review status, and governance. | Not yet built; proposed as part of this spec set |

### NIST AI RMF

**Framework:** AI RMF 1.0 (January 2023). Four functions: Govern, Map, Measure, Manage.

| NIST Function | Popper Alignment |
|---|---|
| **Govern** | Clinical governance review workflow (proposed in `09`). Source hierarchy defines authority. Provenance model enables accountability. |
| **Map** | Source hierarchy maps risk context. Domain and modality extension maps define scope. |
| **Measure** | Drift detection measures decision distribution changes. HTV scoring measures epistemic quality. Evidence grading measures source strength. |
| **Manage** | Safe-mode provides operational control. Policy pack versioning enables change management. Audit trail enables incident investigation. |

**NIST trustworthiness attributes alignment:**

| Attribute | Popper Coverage |
|---|---|
| Validity/Reliability | Deterministic evaluation; same inputs → same outputs. Test coverage on policy engine. |
| Safety | Core safety pack. Fail-safe defaults. Safe-mode circuit breaker. |
| Security/Resilience | API key auth. PHI-blind. Circuit breaker. Fallback handling. |
| Accountability/Transparency | Audit trail. Provenance model. Decision citations. |
| Explainability/Interpretability | Rule explanations in human-readable text. Reason codes. Source citations. |
| Privacy Enhancement | PHI-blind by architecture. De-identified audit events. |
| Fairness | **Gap.** Bias monitoring requires demographic data Popper does not have. |

---

## Layer C: Facility/Modality Validation (IAC, ACR)

### IAC AI Task Force Addendum

**Status:** Published April 1, 2025 as an addendum to each set of IAC Standards. Provides recommendations for IAC-accredited facilities utilizing AI technology.

**IAC Framework Categories and Popper Alignment:**

| IAC Category | Popper Coverage | Key Evidence |
|---|---|---|
| 1. Pre-Deployment Validation | Low | Contract-based architecture supports validation; no protocol or checklist exists |
| 2. Independent Safety Supervision | **High** | Core function. Architecturally independent, PHI-blind, verdict-based supervision |
| 3. Clinician Override Tracking | Medium | Audit trail captures Popper decisions; clinician rationale capture happens in MISS, not Popper |
| 4. Performance Monitoring / Drift | Medium-High | Drift detection with thresholds implemented; protocols for post-drift action needed |
| 5. Bias and Equity Monitoring | **None** (Popper alone) | PHI-blind design prevents demographic stratification without facility-level join. **Update:** The accreditation product has since implemented facility-level bias monitoring via BiasDetectionEvent integration (Standard VI, 5 requirements). Facilities seeking IAC accreditation can satisfy this category through the accreditation evaluator rather than Popper directly. |
| 6. Multi-Vendor AI Governance | Low-Medium | Per-org scope and contract-based interface support it; undemonstrated with multiple vendors |
| 7. Clinician Training | **None** | Out of scope for Popper; facility-level deliverable |
| 8. Adverse Event Reporting | Medium | Audit trail provides raw data; reporting workflow and templates missing |

**What this spec set adds for IAC alignment:**
- Source-grounded rules (Categories 2, 4) — every rule is traceable to its clinical source
- Clinical governance review workflow (Category 3) — clinician oversight of rule development
- Policy pack architecture (Category 6) — structured, composable packs support multi-site governance
- Build roadmap (Category 1) — pre-deployment validation protocol is a roadmap item

### ACR

**Relevance:** ACR accreditation applies to imaging modalities (CT, MRI, NM/PET, ultrasound). Popper does not currently supervise imaging. When modality extension is implemented (see `03-imaging-and-modality-extension-map.md`), ACR alignment should follow the same pattern as IAC modality alignment.

---

## What This Means for Popper Development

### Build for alignment, not certification

Popper should be built so that:
1. Every supervisory decision is auditable and traceable to its source
2. Policy packs are versioned, reviewed, and governance-approved
3. Drift detection and monitoring are active and documented
4. Safe-mode and operational controls are available and tested
5. The architecture supports facility-level deployment with site-specific customization

This makes Popper alignment-ready for any of these frameworks without requiring the product itself to be "certified" by them. Certification/accreditation is sought by the organizations deploying Popper, not by Popper itself.

### Do not conflate frameworks

| Framework | What It Governs | Popper's Role |
|---|---|---|
| FDA | The product (Regain as a medical device/SaMD) | Popper is part of the product's safety architecture |
| URAC | The organization developing/deploying AI | Popper provides tooling for organizational compliance |
| JC/CHAI | The healthcare facility using AI | Popper provides governance tooling for facility compliance |
| IAC/ACR | The facility's clinical modality program | Popper provides quality validation tooling (future) |

### Priority for development

1. **Source provenance model** — needed for all frameworks
2. **Clinical governance review workflow** — needed for FDA (PCCP), URAC (risk management), JC/CHAI (governance)
3. **Policy pack versioning and documentation** — needed for FDA (PCCP), URAC (operations)
4. **Pre-deployment validation protocol** — needed for IAC (Category 1), FDA (validation)
5. **Bias monitoring architecture** — needed for URAC, IAC (Category 5), NIST (fairness)
6. **Adverse event flagging workflow** — needed for IAC (Category 8), JC/CHAI (voluntary reporting)
