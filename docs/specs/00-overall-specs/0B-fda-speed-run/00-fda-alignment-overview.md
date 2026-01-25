# FDA Alignment Overview for ADVOCATE Clinical Agents

> **Document Version:** 1.0.0
> **Last Updated:** 2026-01-24
> **Applies To:** Deutsch (TA1), Popper (TA2), Hermes Protocol

---

## 1. Executive Summary

This document series provides comprehensive FDA regulatory alignment guidance for the ARPA-H ADVOCATE program's clinical agent system. The system comprises three integrated components:

| Component | Role | FDA Pathway |
|-----------|------|-------------|
| **Deutsch** (TA1) | Patient-facing CVD agent with autonomous clinical functions | **SaMD** (Software as a Medical Device) → 510(k) or De Novo |
| **Popper** (TA2) | Independent supervisory agent for safety monitoring | **MDDT** (Medical Device Development Tool) Qualification |
| **Hermes** | Inter-agent communication protocol | Supporting infrastructure (not independently regulated) |

### Regulatory Strategy Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ADVOCATE Regulatory Strategy                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  TA1 (Deutsch)                    TA2 (Popper)                      │
│  ┌─────────────────┐              ┌─────────────────┐               │
│  │  SaMD Class II  │              │  MDDT (NAM)     │               │
│  │  ─────────────  │              │  ─────────────  │               │
│  │  • 510(k) or    │              │  • Proposal     │               │
│  │    De Novo      │              │  • Qualification│               │
│  │  • PCCP for     │◄────────────►│  • COU: AI      │               │
│  │    updates      │   Hermes     │    Supervision  │               │
│  └────────┬────────┘   Protocol   └────────┬────────┘               │
│           │                                 │                        │
│           ▼                                 ▼                        │
│  ┌─────────────────────────────────────────────────────────┐        │
│  │              Phase 2: Scalability Studies (TA3)          │        │
│  │  • Real-world clinical evidence                          │        │
│  │  • Post-market surveillance validation                   │        │
│  │  • CMS reimbursement evidence                           │        │
│  └─────────────────────────────────────────────────────────┘        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Document Series Navigation

This FDA alignment reference library consists of 13 documents. Use this guide to find what you need:

### Core Regulatory Framework

| Doc | Title | Read When... |
|-----|-------|--------------|
| [01](./01-samd-classification-and-pathways.md) | **SaMD Classification & Pathways** | Determining Deutsch's FDA classification and submission pathway |
| [02](./02-mddt-qualification-guide.md) | **MDDT Qualification Guide** | Understanding Popper's qualification process |
| [03](./03-iec-62304-software-lifecycle.md) | **IEC 62304 Software Lifecycle** | Establishing software development process compliance |
| [05](./05-iso-14971-risk-management.md) | **ISO 14971 Risk Management** | Implementing risk management framework |

### AI/ML-Specific Requirements

| Doc | Title | Read When... |
|-----|-------|--------------|
| [04](./04-gmlp-ai-ml-principles.md) | **GMLP AI/ML Principles** | Applying Good Machine Learning Practice to development |
| [09](./09-pccp-change-control.md) | **PCCP Change Control** | Planning for algorithm updates post-market |
| [10](./10-post-market-surveillance.md) | **Post-Market Surveillance** | Designing real-world monitoring systems |

### Evidence & Validation

| Doc | Title | Read When... |
|-----|-------|--------------|
| [06](./06-clinical-evidence-framework.md) | **Clinical Evidence Framework** | Planning validation studies (IV&V, Scalability) |
| [08](./08-human-factors-usability.md) | **Human Factors & Usability** | Designing patient/clinician interfaces |

### Security & Documentation

| Doc | Title | Read When... |
|-----|-------|--------------|
| [07](./07-cybersecurity-requirements.md) | **Cybersecurity Requirements** | Implementing security controls and SBOM |
| [11](./11-documentation-requirements.md) | **Documentation Requirements** | Preparing DHF, DMR, and submission packages |

### Compliance Tracking

| Doc | Title | Read When... |
|-----|-------|--------------|
| [12](./12-spec-to-fda-traceability.md) | **Spec-to-FDA Traceability** | Mapping specifications to FDA requirements |

---

## 3. Key Terminology Glossary

### FDA & Regulatory Terms

| Term | Definition |
|------|------------|
| **SaMD** | Software as a Medical Device - software intended for medical purposes without being part of a hardware device |
| **MDDT** | Medical Device Development Tool - qualified tool that can be used in device development without re-validation |
| **510(k)** | Premarket notification demonstrating substantial equivalence to a predicate device |
| **De Novo** | Classification pathway for novel low-to-moderate risk devices without predicates |
| **PMA** | Premarket Approval - most stringent pathway for high-risk devices |
| **Q-Sub** | Pre-Submission meeting request to FDA for guidance before formal submission |
| **PCCP** | Predetermined Change Control Plan - approved framework for making algorithm changes post-market |
| **TPLC** | Total Product Lifecycle - FDA's approach to continuous oversight of AI/ML devices |
| **BDD** | Breakthrough Device Designation - expedited pathway for transformative technologies |
| **IDE** | Investigational Device Exemption - allows clinical studies of unapproved devices |

### Standards & Frameworks

| Term | Definition |
|------|------------|
| **IEC 62304** | International standard for medical device software lifecycle processes |
| **ISO 14971** | International standard for medical device risk management |
| **ISO 13485** | Quality management system standard for medical devices |
| **IEC 62366** | Usability engineering standard for medical devices |
| **GMLP** | Good Machine Learning Practice - guiding principles for AI/ML development |
| **IMDRF** | International Medical Device Regulators Forum - harmonized guidance body |

### ADVOCATE-Specific Terms

| Term | Definition |
|------|------------|
| **TA1** | Technical Area 1 - Patient-facing CVD Agent (Deutsch) |
| **TA2** | Technical Area 2 - Supervisory Agent (Popper) |
| **TA3** | Technical Area 3 - Health system integration and scalability studies |
| **IV&V** | Independent Verification & Validation - third-party testing |
| **NAM** | Non-clinical Assessment Model - MDDT category for computational tools |
| **COU** | Context of Use - specific application scope for MDDT qualification |

---

## 4. Regulatory Pathway Decision Tree

### For Deutsch (TA1 - CVD Agent)

```
                        Is Deutsch a Medical Device?
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │ YES - Autonomous prescriptions │
                    │ and treatment recommendations  │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                        What is the risk level?
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
        ┌───────────────────┐           ┌───────────────────┐
        │ Serious condition │           │ High-risk clinical│
        │ (Heart Failure)   │           │ decisions         │
        │ Treatment impact  │           │ (prescriptions)   │
        └─────────┬─────────┘           └─────────┬─────────┘
                  │                               │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                    ┌───────────────────────────────┐
                    │ IMDRF Category III            │
                    │ (Serious, Treatment/Diagnosis)│
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    Is there a suitable predicate?
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
        ┌───────────────────┐           ┌───────────────────┐
        │ YES - Similar AI  │           │ NO - Novel        │
        │ CDS software      │           │ autonomous agent  │
        └─────────┬─────────┘           └─────────┬─────────┘
                  │                               │
                  ▼                               ▼
        ┌───────────────────┐           ┌───────────────────┐
        │     510(k)        │           │     De Novo       │
        │   with PCCP       │           │   with PCCP       │
        └───────────────────┘           └───────────────────┘
```

### For Popper (TA2 - Supervisory Agent)

```
                    Is Popper a Medical Device?
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │ NO - It's a development tool  │
                    │ not used directly on patients │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    Should Popper be qualified as MDDT?
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │ YES - Enables scalable AI     │
                    │ oversight across devices      │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                        Which MDDT category?
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
        ┌───────────────────┐           ┌───────────────────┐
        │ NAM (Non-clinical │           │ Not BT or COA     │
        │ Assessment Model) │           │ (no biomarkers or │
        │ - Computational   │           │ patient outcomes) │
        │ evaluation tool   │           │                   │
        └─────────┬─────────┘           └───────────────────┘
                  │
                  ▼
        ┌───────────────────────────────────────────┐
        │ MDDT Qualification Pathway                │
        │ Phase 1: Proposal (COU + Qualification    │
        │          Plan)                            │
        │ Phase 2: Full Qualification Package       │
        └───────────────────────────────────────────┘
```

---

## 5. ARPA-H ADVOCATE Program Alignment

### TA1/TA2/TA3 Regulatory Milestones

| Phase | Timeline | TA1 (Deutsch) | TA2 (Popper) | TA3 (Sites) |
|-------|----------|---------------|--------------|-------------|
| **1A** | Months 0-12 | Prototype + IV&V (synthetic) | Prototype + IV&V | EHR integration |
| **1B** | Months 12-24 | 513(g) meeting, IDE prep | MDDT Proposal | IRB approval |
| **2** | Months 24-39 | Scalability Study, Submission | MDDT Qualification | RCT execution |

### Key FDA Engagement Points

1. **Q-Submission (Pre-Sub)** - Month 3-6
   - Clarify classification (510(k) vs De Novo)
   - Discuss MDDT pathway for Popper
   - Review PCCP strategy

2. **Breakthrough Device Designation** - Month 6-9
   - Submit BDD request if applicable
   - Enables interactive FDA review

3. **513(g) Meeting** - Month 18
   - Formal classification request
   - Review submission strategy

4. **IDE Submission** - Month 21
   - For Scalability Studies
   - Required for Phase 2 RCT

---

## 6. Specification Cross-References

### Deutsch Specs → FDA Requirements

| Deutsch Section | FDA Requirement | Reference Doc |
|-----------------|-----------------|---------------|
| `01-deutsch-system-spec.md` §2.2 (Risk Management) | ISO 14971 | [05](./05-iso-14971-risk-management.md) |
| `01-deutsch-system-spec.md` §4 (High-Risk Actions) | IEC 62304 Class C | [03](./03-iec-62304-software-lifecycle.md) |
| `02-deutsch-contracts.md` §TraceContext | Cybersecurity audit | [07](./07-cybersecurity-requirements.md) |
| `03-deutsch-cvd-cartridge.md` §4 (Guardrails) | Risk controls | [05](./05-iso-14971-risk-management.md) |

### Popper Specs → FDA Requirements

| Popper Section | FDA Requirement | Reference Doc |
|----------------|-----------------|---------------|
| `01-popper-system-spec.md` §2.1 (Independence) | MDDT COU | [02](./02-mddt-qualification-guide.md) |
| `03-popper-safety-dsl.md` (Policy Packs) | GMLP Principle 10 | [04](./04-gmlp-ai-ml-principles.md) |
| `04-popper-regulatory-export.md` | Post-market surveillance | [10](./10-post-market-surveillance.md) |

### Hermes Specs → FDA Requirements

| Hermes Section | FDA Requirement | Reference Doc |
|----------------|-----------------|---------------|
| `02-hermes-contracts.md` §2.2 (Signatures) | Cybersecurity | [07](./07-cybersecurity-requirements.md) |
| `03-hermes-deployment-security.md` | SBOM, key management | [07](./07-cybersecurity-requirements.md) |
| `02-hermes-contracts.md` §AuditEvent | DHF traceability | [11](./11-documentation-requirements.md) |

---

## 7. Compliance Status Dashboard

### Current State (as of 2026-01-24)

| Requirement Category | Status | Gap | Action Required |
|---------------------|--------|-----|-----------------|
| **SaMD Classification** | ⚠️ Partial | No formal classification | File Q-Sub |
| **MDDT COU Definition** | ⚠️ Partial | COU not formalized | Document in [02](./02-mddt-qualification-guide.md) |
| **IEC 62304 Compliance** | ⚠️ Partial | Safety class not declared | Add to specs |
| **ISO 14971 Framework** | ✅ Aligned | - | Formalize FMEA |
| **GMLP Principles** | ✅ Aligned | - | Document mapping |
| **Clinical Evidence** | ⚠️ Partial | IV&V protocol needed | [06](./06-clinical-evidence-framework.md) |
| **Cybersecurity** | ✅ Aligned | SBOM generation | [07](./07-cybersecurity-requirements.md) |
| **Human Factors** | ⚠️ Partial | HFE plan needed | [08](./08-human-factors-usability.md) |
| **PCCP** | ⚠️ Partial | Framework needed | [09](./09-pccp-change-control.md) |
| **Post-Market** | ✅ Aligned | - | Formalize in [10](./10-post-market-surveillance.md) |
| **Documentation** | ⚠️ Partial | DHF structure needed | [11](./11-documentation-requirements.md) |

---

## 8. Quick Start: Priority Actions

### Immediate (Next 30 Days)

1. **Request Q-Submission Meeting** with FDA
   - Primary topic: SaMD classification for Deutsch
   - Secondary topic: MDDT pathway for Popper
   - See: [01-samd-classification-and-pathways.md](./01-samd-classification-and-pathways.md)

2. **Declare IEC 62304 Safety Classifications**
   - Deutsch: Class C (potential for serious injury)
   - Popper: Class B (contributes to safety)
   - See: [03-iec-62304-software-lifecycle.md](./03-iec-62304-software-lifecycle.md)

3. **Draft MDDT Context of Use** for Popper
   - Define supervisory AI scope
   - Specify performance metrics
   - See: [02-mddt-qualification-guide.md](./02-mddt-qualification-guide.md)

### Near-Term (Phase 1A)

4. **Establish Risk Management Framework**
   - Create hazard analysis
   - Document risk controls
   - See: [05-iso-14971-risk-management.md](./05-iso-14971-risk-management.md)

5. **Design IV&V Study Protocol**
   - Align with IMDRF clinical evidence framework
   - See: [06-clinical-evidence-framework.md](./06-clinical-evidence-framework.md)

6. **Begin PCCP Development**
   - Identify modification categories
   - Define update protocols
   - See: [09-pccp-change-control.md](./09-pccp-change-control.md)

---

## 9. References

### FDA Guidance Documents

- [Software as a Medical Device (SaMD)](https://www.fda.gov/medical-devices/digital-health-center-excellence/software-medical-device-samd)
- [Medical Device Development Tools (MDDT)](https://www.fda.gov/medical-devices/medical-device-development-tools-mddt)
- [Content of Premarket Submissions for Device Software Functions](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/content-premarket-submissions-device-software-functions)
- [Good Machine Learning Practice](https://www.fda.gov/medical-devices/software-medical-device-samd/good-machine-learning-practice-medical-device-development-guiding-principles)
- [PCCP for AI-Enabled Device Software Functions](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/marketing-submission-recommendations-predetermined-change-control-plan-artificial-intelligence)
- [Cybersecurity in Medical Devices (2025)](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/cybersecurity-medical-devices-quality-system-considerations-and-content-premarket-submissions)

### Standards

- IEC 62304:2015+AMD1:2020 - Medical device software lifecycle
- ISO 14971:2019 - Risk management for medical devices
- ISO 13485:2016 - Quality management systems
- IEC 62366-1:2015 - Usability engineering

### IMDRF Documents

- [N12: SaMD Possible Framework for Risk Categorization](https://www.imdrf.org/documents/software-medical-device-possible-framework-risk-categorization-and-corresponding-considerations)
- [N41: SaMD Clinical Evaluation](https://www.imdrf.org/documents/software-medical-device-samd-clinical-evaluation)
- [GMLP Guiding Principles (2025)](https://www.imdrf.org/documents/good-machine-learning-practice-medical-device-development-guiding-principles)

### ARPA-H ADVOCATE Program

- [ARPA-H ADVOCATE ISO (ARPA-H-SOL-26-142)](https://solutions.arpa-h.gov/)

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-24 | ADVOCATE Team | Initial release |
