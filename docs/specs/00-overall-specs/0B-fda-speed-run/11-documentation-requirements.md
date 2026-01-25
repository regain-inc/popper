# FDA Documentation Requirements for Medical Device Software

> **Document Version:** 1.0.0
> **Last Updated:** 2026-01-24
> **Applies To:** Deutsch (TA1), Popper (TA2)
> **Related Specs:** All clinical agent specifications

---

## 1. Overview

This document provides guidance on documentation requirements for FDA premarket submissions for the ADVOCATE clinical agent system. Proper documentation demonstrates design control, risk management, and quality assurance throughout the software development lifecycle.

### Documentation Hierarchy

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Medical Device Documentation                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐                                                │
│  │ Design History  │  Evidence of design controls                   │
│  │ File (DHF)      │  Verification and validation                   │
│  └────────┬────────┘                                                │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────┐                                                │
│  │ Device Master   │  Manufacturing specifications                  │
│  │ Record (DMR)    │  How to build the cleared device               │
│  └────────┬────────┘                                                │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────┐                                                │
│  │ Device History  │  Production records                            │
│  │ Record (DHR)    │  Build and test evidence per DMR               │
│  └─────────────────┘                                                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Regulatory Framework

### 2.1 Quality System Regulation

21 CFR Part 820 (transitioning to ISO 13485 alignment by February 2026):

| Section | Requirement | Software Relevance |
|---------|-------------|-------------------|
| 820.30 | Design controls | Software development |
| 820.40 | Document controls | Version management |
| 820.100 | CAPA | Problem resolution |
| 820.180 | General requirements | Record retention |
| 820.181 | DHR requirements | Build records |
| 820.184 | DHF requirements | Design records |

### 2.2 Documentation Levels (2023 FDA Guidance)

FDA replaced Major/Moderate/Minor with Basic/Enhanced:

| Level | Criteria | ADVOCATE Classification |
|-------|----------|------------------------|
| **Basic** | Minimal risk software | Not applicable |
| **Enhanced** | Malfunction could cause hazard (serious injury/death) | Deutsch, Popper |

### 2.3 eSTAR Program

FDA's Electronic Submission, Tracking, and Reporting program provides:
- Structured submission templates
- Pre-defined sections
- Validation before submission

---

## 3. Design History File (DHF)

### 3.1 Purpose

The DHF contains records documenting the design history of a finished device. It demonstrates that the design was developed in accordance with the approved design plan and design control requirements.

### 3.2 DHF Contents

| Section | Content | ADVOCATE Implementation |
|---------|---------|------------------------|
| **Design Plan** | Development approach, schedule | Sprint planning, milestones |
| **Design Input** | Requirements | Spec documents |
| **Design Output** | Specifications, drawings | Architecture docs, contracts |
| **Design Review** | Review records | PR reviews, design reviews |
| **Design Verification** | Test reports | Unit tests, integration tests |
| **Design Validation** | Clinical evidence | IV&V studies |
| **Design Transfer** | Production specifications | Deployment procedures |
| **Design Changes** | Change history | Git history, PCCP records |
| **Risk Management** | Risk file | ISO 14971 documentation |

### 3.3 Software-Specific DHF Content

| Document | Purpose | Evidence |
|----------|---------|----------|
| Software Development Plan | Define process | IEC 62304 alignment |
| Software Requirements Spec | Functional requirements | Spec files |
| Software Architecture | Design decisions | Architecture docs |
| Detailed Design | Component specs | Contract files |
| Unit Test Reports | Code verification | Jest/Vitest results |
| Integration Test Reports | System testing | CI pipeline results |
| Traceability Matrix | Req → Test mapping | Requirements coverage |
| Anomaly List | Known issues | Bug tracker exports |

---

## 4. Device Master Record (DMR)

### 4.1 Purpose

The DMR contains procedures and specifications for a finished device. It describes how the cleared device will be built, tested, labeled, and serviced.

### 4.2 DMR Contents for Software

| Section | Content | ADVOCATE Implementation |
|---------|---------|------------------------|
| **Software specifications** | Released version details | Version manifests |
| **Build procedures** | How to build from source | CI/CD documentation |
| **Test procedures** | Acceptance testing | Test suites |
| **Labeling** | IFU, labels | Labeling files |
| **Packaging** | Deployment packaging | Container specs |
| **Installation** | Deployment procedures | Installation guides |

---

## 5. Premarket Submission Content

### 5.1 510(k) Software Documentation

| Section | Basic | Enhanced | ADVOCATE |
|---------|-------|----------|----------|
| Device description | ✓ | ✓ | Required |
| Intended use | ✓ | ✓ | Required |
| Software documentation | ✓ | ✓ | Required |
| Hazard analysis | ✓ | ✓ | Required |
| Software requirements spec | - | ✓ | Required |
| Architecture design | - | ✓ | Required |
| Software design spec | - | ✓ | Required |
| Traceability matrix | - | ✓ | Required |
| V&V documentation | ✓ | ✓ | Required |
| Revision history | ✓ | ✓ | Required |
| Unresolved anomalies | ✓ | ✓ | Required |

### 5.2 Enhanced Documentation Details

**Software Requirements Specification:**
- All functional requirements
- Performance requirements
- Interface requirements
- Safety requirements

**Architecture Design Chart:**
- Component decomposition
- Data flow diagrams
- External interfaces
- Safety-critical paths

**Software Design Specification:**
- Detailed component design
- Algorithm descriptions
- Data structures
- Interface definitions

**Traceability Matrix:**

| Requirement ID | Description | Test ID | Test Result | Risk ID |
|----------------|-------------|---------|-------------|---------|
| REQ-001 | ... | TEST-001 | Pass | RISK-003 |

### 5.3 AI/ML-Specific Documentation

| Document | Content |
|----------|---------|
| Algorithm description | Model architecture, training approach |
| Training data | Dataset description, demographics |
| Performance metrics | Accuracy, sensitivity, specificity |
| Limitations | Known failure modes |
| PCCP (if applicable) | Change control plan |

---

## 6. Cybersecurity Documentation

### 6.1 Required Documents (per FDA 2025 guidance)

| Document | Content |
|----------|---------|
| Cybersecurity Management Plan | Ongoing security posture |
| Security Risk Analysis | Threat model, risk assessment |
| Security Risk Management Report | Controls, residual risk |
| SBOM | All software components |
| Architecture Diagrams | Data flows, trust boundaries |
| Vulnerability Disclosure | Reporting process |

### 6.2 eSTAR Cybersecurity Sections

~12 cybersecurity documents required for cyber devices:
- Threat model documentation
- Security testing results
- Cryptographic module information
- Update mechanism description
- Incident response plan

---

## 7. ADVOCATE Documentation Structure

### 7.1 Proposed DHF Organization

```
DHF/
├── 01-design-planning/
│   ├── development-plan.md
│   ├── arpa-h-milestones.md
│   └── team-qualifications.md
├── 02-design-input/
│   ├── 01-deutsch-specs/
│   ├── 02-popper-specs/
│   ├── 03-hermes-specs/
│   └── requirements-matrix.xlsx
├── 03-design-output/
│   ├── architecture/
│   ├── detailed-design/
│   └── interface-specs/
├── 04-design-review/
│   ├── review-meeting-notes/
│   └── pr-review-summary.md
├── 05-verification/
│   ├── unit-test-reports/
│   ├── integration-test-reports/
│   └── traceability-matrix.xlsx
├── 06-validation/
│   ├── ivv-phase1a/
│   ├── ivv-phase1b/
│   └── scalability-studies/
├── 07-risk-management/
│   ├── hazard-analysis.xlsx
│   ├── fmea.xlsx
│   └── risk-management-report.md
├── 08-design-transfer/
│   ├── build-procedures.md
│   └── deployment-specs.md
└── 09-design-changes/
    └── change-history.md
```

### 7.2 Spec-to-DHF Mapping

| Spec File | DHF Section | Document Type |
|-----------|-------------|---------------|
| `01-deutsch-system-spec.md` | 02-design-input | Requirements |
| `02-deutsch-contracts.md` | 03-design-output | Interface spec |
| `01-popper-system-spec.md` | 02-design-input | Requirements |
| `03-popper-safety-dsl.md` | 03-design-output | Algorithm spec |
| `02-hermes-contracts.md` | 03-design-output | Interface spec |
| `fixtures/` | 05-verification | Test artifacts |
| IV&V reports | 06-validation | Validation evidence |

---

## 8. Record Retention

### 8.1 Retention Requirements

| Record Type | Retention Period |
|-------------|------------------|
| DHF | Life of device + 2 years |
| DMR | Life of device + 2 years |
| DHR | 2 years beyond expected device life |
| Complaint files | 2 years beyond expected device life |
| MDRs | 2 years beyond expected device life |

### 8.2 Storage Requirements

| Requirement | Implementation |
|-------------|---------------|
| Secure storage | Access-controlled systems |
| Backup | Regular backups with verification |
| Integrity | Version control, checksums |
| Accessibility | Retrievable for FDA inspection |

---

## 9. Document Control

### 9.1 Version Control

| Requirement | Implementation |
|-------------|---------------|
| Unique identification | Document ID + version |
| Change tracking | Git or equivalent |
| Approval records | Signed reviews |
| Distribution control | Access permissions |

### 9.2 Change Control

| Change Type | Process |
|-------------|---------|
| Minor (editorial) | Author + reviewer approval |
| Major (technical) | Formal change request |
| Design change | Full design review |

---

## 10. Implementation Checklist

### DHF Setup

- [ ] Create DHF folder structure
- [ ] Map existing specs to DHF sections
- [ ] Identify documentation gaps
- [ ] Establish document templates

### Requirements Documentation

- [ ] Convert specs to formal requirements format
- [ ] Assign requirement IDs
- [ ] Create traceability matrix
- [ ] Link requirements to tests

### Verification Documentation

- [ ] Compile test reports
- [ ] Document test coverage
- [ ] List unresolved anomalies
- [ ] Complete traceability

### Validation Documentation

- [ ] Document IV&V protocols
- [ ] Compile IV&V results
- [ ] Prepare clinical evidence summary

### Submission Preparation

- [ ] Review eSTAR requirements
- [ ] Prepare submission package
- [ ] Conduct internal review
- [ ] Complete eSTAR template

---

## 11. References

### FDA Guidance

- [Content of Premarket Submissions for Device Software Functions](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/content-premarket-submissions-device-software-functions)
- [Guidance for the Content of Premarket Submissions for Medical Devices Containing Software](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/guidance-content-premarket-submissions-software-contained-medical-devices)
- [eSTAR Program](https://www.fda.gov/medical-devices/how-study-and-market-your-device/device-advice-comprehensive-regulatory-assistance/medical-device-registration-and-listing/electronic-submission-template-and-resource-estar)

### Regulations

- [21 CFR Part 820 - Quality System Regulation](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-820)
- [ISO 13485:2016 - Quality management systems](https://www.iso.org/standard/59752.html)

### Standards

- IEC 62304:2015 - Software lifecycle
- ISO 14971:2019 - Risk management

### ADVOCATE Specs

- [Deutsch Specs](../../01-deutsch-specs/)
- [Popper Specs](../../02-popper-specs/)
- [Hermes Specs](../../03-hermes-specs/)

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-24 | ADVOCATE Team | Initial release |
