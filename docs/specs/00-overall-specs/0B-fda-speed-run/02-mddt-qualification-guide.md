# MDDT Qualification Guide for Popper Supervisory Agent

> **Document Version:** 1.0.0
> **Last Updated:** 2026-01-24
> **Applies To:** Popper (TA2 - Supervisory Agent)
> **Related Specs:** `02-popper-specs/`, ARPA-H ADVOCATE TA2

---

## 1. Overview

This document provides guidance on Medical Device Development Tool (MDDT) qualification for the Popper Supervisory Agent (TA2). MDDT qualification enables Popper to become an industry-standard tool for AI/ML safety monitoring, allowing device manufacturers to use it without re-validating its suitability for each new device.

### Strategic Value of MDDT Qualification

| Benefit | Description |
|---------|-------------|
| **Industry Adoption** | Other TA1 performers (and future clinical AI developers) can use Popper without independent FDA validation |
| **Regulatory Efficiency** | FDA reviewers can rely on qualified MDDT status when reviewing devices that use Popper |
| **Scalability** | Enables disease-agnostic application beyond CVD |
| **Competitive Advantage** | First-in-class supervisory AI MDDT |

### Popper MDDT Classification

| Attribute | Classification |
|-----------|----------------|
| **MDDT Category** | Non-clinical Assessment Model (NAM) |
| **Context of Use** | Computational evaluation of AI/ML clinical agent outputs |
| **Qualification Goal** | Post-market monitoring and safety assurance of clinical AI agents |

---

## 2. Regulatory Framework

### 2.1 What is an MDDT?

Per FDA guidance:

> **Medical Device Development Tool (MDDT)**: A qualified tool that medical device sponsors can use in the development and evaluation of medical devices. MDDTs include biomarker tests, clinical outcome assessments (COAs), and non-clinical assessment models (NAMs).

Popper qualifies as a **Non-clinical Assessment Model (NAM)** because it:
- Computationally evaluates device outputs (not patient outcomes directly)
- Predicts/assesses safety parameters without clinical testing
- Provides objective measures of clinical agent performance

### 2.2 MDDT Categories

| Category | Definition | Examples | Popper Fit |
|----------|------------|----------|------------|
| **Biomarker Test (BT)** | Measures biological indicators | Blood tests, imaging biomarkers | ❌ No |
| **Clinical Outcome Assessment (COA)** | Measures patient outcomes | PROs, clinician-reported outcomes | ❌ No |
| **Non-clinical Assessment Model (NAM)** | Computational models/methods | Computational simulations, AI evaluation tools | ✅ Yes |

### 2.3 Existing Qualified MDDTs (Precedents)

As of January 2026, FDA has qualified 17+ MDDTs. Relevant precedents for Popper:

| MDDT | Category | Context of Use | Relevance |
|------|----------|----------------|-----------|
| **Apple AFib History** | Digital NAM | AFib burden measurement from wearable | First digital health MDDT |
| **Sim4Life IMAnalytics** | Computational NAM | MRI safety computational modeling | Computational evaluation paradigm |
| **MED Institute MRI Tool** | Computational NAM | MRI RF heating prediction | Computational safety prediction |
| **VHP-Female CAD Model** | Computational NAM | Orthopedic MRI heating prediction | Anatomical model evaluation |

**Gap Identified:** No existing MDDTs address AI/ML supervision or clinical agent safety monitoring. Popper would be **first-in-class**.

---

## 3. Two-Phase Qualification Process

### 3.1 Process Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MDDT Qualification Process                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  PHASE 1: PROPOSAL                    PHASE 2: QUALIFICATION        │
│  ┌─────────────────────┐              ┌─────────────────────┐       │
│  │ MDDT Description    │              │ Full Evidence       │       │
│  │ Context of Use      │     FDA      │ Package             │       │
│  │ Qualification Plan  │────Accept───►│ Validation Data     │       │
│  │                     │              │ SEBQ Document       │       │
│  └──────────┬──────────┘              └──────────┬──────────┘       │
│             │                                    │                   │
│             ▼                                    ▼                   │
│  ┌─────────────────────┐              ┌─────────────────────┐       │
│  │ FDA Review          │              │ FDA Qualification   │       │
│  │ ~120 days           │              │ Decision            │       │
│  │ Feedback provided   │              │ SEBQ Published      │       │
│  └─────────────────────┘              └─────────────────────┘       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Phase 1: Proposal Phase

**Goal:** Determine if Popper is suitable for MDDT qualification and agree on the qualification plan.

**Submission Contents:**

| Section | Content | Popper Application |
|---------|---------|-------------------|
| **Cover Letter** | Submission type, MDDT name, category | "MDDT Proposal: Popper Supervisory Agent (NAM)" |
| **MDDT Description** | Tool functionality, how it works | Deterministic policy engine + quality signal monitoring |
| **Context of Use (COU)** | Specific application scope | See §4 below |
| **Performance Criteria** | Measurable performance characteristics | Accuracy, precision, latency metrics |
| **Qualification Plan** | Evidence collection strategy | Phase 1A/1B IV&V data, TA3 deployment data |

**FDA Review (~120 days):**
- FDA reviews proposal for COU clarity
- FDA may request clarifications
- FDA accepts into Qualification Program or provides feedback

### 3.3 Phase 2: Qualification Phase

**Goal:** Demonstrate that Popper reliably performs as intended within the defined COU.

**Submission Contents:**

| Section | Content | Popper Application |
|---------|---------|-------------------|
| **Full MDDT Description** | Complete technical documentation | Architecture, algorithms, policy DSL |
| **COU (Finalized)** | Refined scope based on Phase 1 feedback | AI supervision scope |
| **Evidence Package** | Data demonstrating performance | IV&V data, Scalability Study results |
| **Assessment of Advantages/Limitations** | Honest evaluation of tool capabilities | Supported agent types, known limitations |
| **SEBQ Draft** | Summary of Evidence and Basis of Qualification | Narrative for public posting |

**FDA Qualification Decision:**
- FDA reviews evidence package
- FDA may request additional data
- If qualified, FDA publishes SEBQ document

---

## 4. Context of Use (COU) for Popper

### 4.1 COU Definition

The Context of Use is the most critical element of MDDT qualification. It defines the boundaries within which Popper can be used.

**Proposed COU for Popper:**

> **Context of Use:** The Popper Supervisory Agent is a non-clinical assessment model for the continuous, automated evaluation of AI-enabled clinical decision support systems and clinical agents. Popper assesses the safety, accuracy, and reliability of clinical agent outputs by:
>
> 1. **Validating output schema compliance** against defined contracts
> 2. **Detecting policy violations** using deterministic rule evaluation
> 3. **Quantifying uncertainty levels** in clinical recommendations
> 4. **Identifying high-risk proposals** requiring clinician review
> 5. **Monitoring algorithmic drift** through quality signal tracking
> 6. **Enabling safe-mode transitions** when safety thresholds are exceeded
>
> The tool is qualified for use with AI/ML clinical agents that:
> - Operate in cardiovascular disease management (heart failure, post-MI, hypertension, hyperlipidemia, AFib)
> - Communicate via the Hermes protocol or compatible message formats
> - Are intended for adult patient populations
>
> **Limitations:**
> - Does not replace clinical judgment or human oversight
> - Does not guarantee absence of errors in supervised agents
> - Requires integration with clinician escalation workflows

### 4.2 COU Scope Considerations

| Dimension | Narrow COU | Broad COU | Popper Strategy |
|-----------|------------|-----------|-----------------|
| **Disease Area** | CVD only | All chronic diseases | Start narrow (CVD), expand later |
| **Agent Type** | Specific agent architecture | Any AI/ML agent | Protocol-agnostic via Hermes |
| **Clinical Function** | Prescription management only | All clinical functions | Include all TA1 functions |
| **Population** | Adults only | All ages | Adults initially |

### 4.3 COU Expansion Strategy

MDDT qualification can be extended to broader COUs with supplemental evidence:

```
Phase 1: CVD Agents (ADVOCATE Program)
    │
    ▼ Additional validation data
Phase 2: Other Chronic Disease Agents
    │
    ▼ Additional validation data
Phase 3: General Clinical AI Supervision
```

---

## 5. Qualification Evidence Requirements

### 5.1 Performance Criteria

Per ARPA-H TA2 metrics, Popper must demonstrate:

| Metric | Phase 1A Target | Phase 1B Target | Evidence Source |
|--------|-----------------|-----------------|-----------------|
| Accuracy of clinical agent assessment | >85% | >95% | IV&V studies |
| High-quality recommendation recognition | >85% | >95% | IV&V studies |
| Hallucination rate quantification | >85% | >95% | IV&V studies |
| Uncertainty determination | >85% | >95% | IV&V studies |
| Clinical acuity/risk determination | >90% | >97% | IV&V studies |
| Task assignment appropriateness | >90% | >97% | IV&V studies |
| Response latency | <3s | <1s | Performance testing |
| Clinician UAT score | >80 | >90 | Usability testing |

### 5.2 Evidence Package Contents

| Evidence Type | Description | Source |
|---------------|-------------|--------|
| **Analytical Validation** | Popper correctly evaluates known inputs | Synthetic test cases |
| **Clinical Validation** | Popper decisions align with clinician judgment | IV&V with clinician adjudicators |
| **Reproducibility** | Consistent results across runs | Regression testing |
| **Edge Case Handling** | Appropriate behavior in unusual scenarios | IV&V edge case battery |
| **Latency Performance** | Meets timing requirements | Performance benchmarking |
| **Drift Detection** | Correctly identifies degraded agent performance | Simulated drift scenarios |

### 5.3 IV&V Integration

The ADVOCATE IV&V program provides key evidence for MDDT qualification:

| IV&V Phase | Timeline | Evidence Contribution |
|------------|----------|----------------------|
| Phase 1A | Month 9-11 | Synthetic data validation |
| Phase 1B | Month 21-23 | Human user validation |
| Phase 2 | Month 24-39 | Real-world deployment evidence |

---

## 6. Relevance to Clinical Agents

### 6.1 Popper Architecture for MDDT

**Key MDDT-Relevant Features:**

| Feature | Spec Reference | MDDT Relevance |
|---------|----------------|----------------|
| **Independence** | `01-popper-system-spec.md` §2.1 | Prevents conflict of interest |
| **Deterministic Engine** | `03-popper-safety-dsl.md` | Reproducible, auditable decisions |
| **Policy Versioning** | `03-popper-safety-dsl.md` | Traceability for qualification |
| **Disease Agnostic Core** | `01-popper-system-spec.md` §2.2 | Broad COU potential |
| **Export Bundles** | `04-popper-regulatory-export.md` | Regulatory data generation |

### 6.2 Policy Pack as Qualified Component

Popper's Safety DSL policy packs can be individually qualified:

```yaml
# Example: CVD Policy Pack for MDDT
policy_pack:
  id: "popper-cvd-v1.0.0"
  qualified_cou: "CVD agent supervision"
  rules:
    - id: "medication-protocol-required"
      condition: "proposal.kind == MEDICATION_ORDER && !proposal.clinician_protocol_ref"
      decision: ROUTE_TO_CLINICIAN
      reason_code: "needs_human_review"
```

**Qualification Scope:**
- Core Popper engine + CVD policy pack = Qualified MDDT
- New policy packs may require supplemental qualification

### 6.3 Hermes Protocol Integration

The Hermes protocol ensures MDDT-compatible interfaces:

| Hermes Feature | MDDT Requirement | Spec Reference |
|----------------|------------------|----------------|
| Versioned messages | Reproducibility | `02-hermes-contracts.md` §1.1 |
| Audit redaction | De-identification | `02-hermes-contracts.md` §1.4 |
| Trace context | Traceability | `02-hermes-contracts.md` §2.2 |
| Snapshot integrity | Evidence integrity | `02-hermes-contracts.md` §2.5 |

---

## 7. SEBQ Document Template

The Summary of Evidence and Basis of Qualification (SEBQ) is the public document FDA publishes upon qualification.

### 7.1 SEBQ Outline for Popper

```markdown
# SEBQ: Popper Supervisory Agent

## 1. MDDT Description
[Technical description of Popper]

## 2. Context of Use
[Qualified COU statement]

## 3. Qualification Evidence Summary
### 3.1 Analytical Validation
[Summary of synthetic testing results]

### 3.2 Clinical Validation
[Summary of IV&V and clinician agreement studies]

### 3.3 Performance Characteristics
[Accuracy, precision, latency data]

## 4. Advantages and Limitations
### 4.1 Advantages
- Disease-agnostic architecture
- Deterministic, auditable decisions
- Sub-second latency

### 4.2 Limitations
- Does not guarantee agent correctness
- Requires clinical escalation workflows
- Policy pack updates may require supplemental qualification

## 5. Qualification Basis
[Regulatory rationale for qualification]

## 6. Contact Information
[Submitter contact details]
```

---

## 8. Implementation Checklist

### Phase 1: Proposal Preparation (Months 1-6)

- [ ] Finalize COU statement
- [ ] Document Popper architecture and algorithms
- [ ] Define performance criteria with acceptance thresholds
- [ ] Draft Qualification Plan
- [ ] Prepare Phase 1A IV&V protocol
- [ ] Submit MDDT Proposal Package to FDA

### Phase 1 Review (Months 6-10)

- [ ] Respond to FDA questions
- [ ] Refine COU based on feedback
- [ ] Finalize Qualification Plan
- [ ] Receive acceptance into Qualification Program

### Phase 2: Qualification Preparation (Months 10-24)

- [ ] Execute Phase 1A IV&V studies
- [ ] Execute Phase 1B IV&V studies
- [ ] Compile evidence package
- [ ] Draft SEBQ document
- [ ] Conduct internal qualification review

### Phase 2 Submission (Month 24)

- [ ] Submit Full Qualification Package
- [ ] Respond to FDA information requests
- [ ] Finalize SEBQ

### Post-Qualification

- [ ] Monitor COU boundaries
- [ ] Plan supplemental qualifications for expanded COU
- [ ] Maintain evidence for requalification if needed

---

## 9. References

### FDA MDDT Guidance

- [Medical Device Development Tools (MDDT) Program](https://www.fda.gov/medical-devices/medical-device-development-tools-mddt)
- [Qualification of Medical Device Development Tools](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/qualification-medical-device-development-tools)
- [MDDT Proposal Submission Content](https://www.fda.gov/medical-devices/medical-device-development-tools-mddt/medical-device-development-tool-mddt-proposal-submission-content)

### Qualified MDDT Examples

- [Apple AFib History Feature SEBQ](https://www.fda.gov/medical-devices/medical-device-development-tools-mddt)
- [Sim4Life IMAnalytics SEBQ](https://www.fda.gov/media/166724/download)
- [Full List of Qualified MDDTs](https://www.fda.gov/medical-devices/medical-device-development-tools-mddt)

### ARPA-H ADVOCATE

- [ADVOCATE TA2 Requirements](../A-arpa-program-description.md)
- [Popper System Spec](../../02-popper-specs/01-popper-system-spec.md)
- [Popper Safety DSL](../../02-popper-specs/03-popper-safety-dsl.md)

### Supporting Standards

- ISO 14971:2019 - Risk management (basis for NAM qualification)
- IEC 62304:2015 - Software lifecycle (development practices)

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-24 | ADVOCATE Team | Initial release |
