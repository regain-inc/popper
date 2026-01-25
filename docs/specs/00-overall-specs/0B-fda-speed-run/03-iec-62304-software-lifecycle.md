# IEC 62304 Software Lifecycle Compliance

> **Document Version:** 1.0.0
> **Last Updated:** 2026-01-24
> **Applies To:** Deutsch (TA1), Popper (TA2), Hermes Protocol
> **Related Specs:** All clinical agent specifications

---

## 1. Overview

IEC 62304:2015+AMD1:2020 is the international standard for medical device software lifecycle processes. FDA recognizes this standard and expects compliance for SaMD submissions. This document provides guidance on applying IEC 62304 to the ADVOCATE clinical agent system.

### Safety Classification Summary

| Component | IEC 62304 Safety Class | Rationale |
|-----------|------------------------|-----------|
| **Deutsch** | **Class C** | Incorrect output could result in serious injury (wrong prescription, missed diagnosis) |
| **Popper** | **Class B** | Contributes to safety but failure can be detected; doesn't directly harm patients |
| **Hermes** | **Class B** | Infrastructure; failures result in fallback behaviors |

---

## 2. Regulatory Framework

### 2.1 IEC 62304 Scope

IEC 62304 applies to:
- Medical device software development
- Medical device software maintenance
- Configuration management
- Problem resolution

**Key Principle:** Software safety class determines the rigor of lifecycle activities.

### 2.2 FDA Recognition

FDA has formally recognized IEC 62304:2015+AMD1:2020 as a consensus standard. Manufacturers can:
- Declare conformity to the standard in submissions
- Use standard compliance to satisfy regulatory requirements
- Reference standard sections in lieu of detailed explanations

### 2.3 Relationship to Other Standards

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Medical Device Software Standards                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐     ┌─────────────────┐                        │
│  │  ISO 13485      │     │  ISO 14971      │                        │
│  │  QMS Foundation │     │  Risk Management│                        │
│  └────────┬────────┘     └────────┬────────┘                        │
│           │                       │                                  │
│           └───────────┬───────────┘                                  │
│                       │                                              │
│                       ▼                                              │
│           ┌─────────────────────┐                                    │
│           │     IEC 62304       │                                    │
│           │  Software Lifecycle │                                    │
│           └──────────┬──────────┘                                    │
│                      │                                               │
│       ┌──────────────┼──────────────┐                                │
│       ▼              ▼              ▼                                │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐                            │
│  │IEC 62366│   │IEC 82304│   │IEC 81001│                            │
│  │Usability│   │Health SW│   │Security │                            │
│  └─────────┘   └─────────┘   └─────────┘                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Safety Classification

### 3.1 Classification Criteria

| Class | Definition | Consequence of Failure |
|-------|------------|------------------------|
| **Class A** | No injury or damage to health possible | Software cannot contribute to hazardous situation |
| **Class B** | Non-serious injury possible | Failure can result in non-serious injury OR serious injury that can be detected/mitigated |
| **Class C** | Death or serious injury possible | Failure can result in death or serious injury without detection |

### 3.2 Deutsch Classification: Class C

**Rationale:**
- Autonomous prescription management could result in:
  - Incorrect medication dosing (serious injury)
  - Missed contraindications (serious injury or death)
  - Delayed critical escalation (death)
- These failures may not be immediately detectable
- Patient relies on Deutsch for clinical decisions

**Implications:**
- Full IEC 62304 compliance required
- All lifecycle activities mandatory
- Complete traceability required

### 3.3 Popper Classification: Class B

**Rationale:**
- Popper failure could allow unsafe Deutsch actions
- However, multiple detection mechanisms exist:
  - Deutsch has independent guardrails
  - Clinician review in escalation pathway
  - Hermes audit trail enables post-hoc detection
- Popper doesn't directly interact with patients

**Implications:**
- Most IEC 62304 activities required
- Some simplification allowed (e.g., software unit verification)
- Traceability still required

### 3.4 Hermes Classification: Class B

**Rationale:**
- Protocol failure could disrupt agent communication
- Fallback behaviors prevent patient harm:
  - Default-to-safe when communication fails
  - Signature verification failures trigger HARD_STOP
- Hermes doesn't make clinical decisions

**Implications:**
- Protocol specification requires formal verification
- Contract testing satisfies verification requirements

---

## 4. Lifecycle Processes

### 4.1 Software Development Planning (§5.1)

**Requirements:**

| Activity | Class A | Class B | Class C | ADVOCATE Implementation |
|----------|---------|---------|---------|------------------------|
| Development plan | Required | Required | Required | Sprint planning docs |
| Standards/methods | — | Required | Required | IEC 62304, Agile/TDD |
| Tool qualification | — | — | Required | CI/CD pipeline validation |
| Traceability matrix | — | Required | Required | Requirements → Tests |

**Spec Alignment:**
- Development planning reflected in ARPA-H milestones
- Tool qualification for LLM training pipelines needed

### 4.2 Software Requirements Analysis (§5.2)

**Requirements:**

| Activity | Class A | Class B | Class C | ADVOCATE Implementation |
|----------|---------|---------|---------|------------------------|
| Define functional requirements | Required | Required | Required | Spec documents |
| Define performance requirements | — | Required | Required | TA1/TA2 metrics |
| Risk-derived requirements | — | Required | Required | From ISO 14971 analysis |
| Requirements documentation | Required | Required | Required | Spec files in repo |

**Spec Alignment:**
- `01-deutsch-system-spec.md` defines functional requirements
- ARPA-H TA1/TA2 metrics define performance requirements
- Risk-derived requirements from guardrail definitions

### 4.3 Software Architectural Design (§5.3)

**Requirements:**

| Activity | Class A | Class B | Class C | ADVOCATE Implementation |
|----------|---------|---------|---------|------------------------|
| Architecture documentation | Required | Required | Required | Architecture spec |
| Identify software items | — | Required | Required | Component breakdown |
| Segregation of safety features | — | — | Required | Popper independence |

**Spec Alignment:**
- `00-deutsch-popper-hermes-architecture.md` documents architecture
- Popper/Deutsch separation provides safety segregation
- Hermes protocol defines interfaces

### 4.4 Software Detailed Design (§5.4)

**Requirements:**

| Activity | Class A | Class B | Class C | ADVOCATE Implementation |
|----------|---------|---------|---------|------------------------|
| Detailed design documentation | — | Required | Required | Contract specs |
| Algorithm specifications | — | — | Required | Safety DSL spec |
| Data structure definitions | — | Required | Required | Hermes contracts |

**Spec Alignment:**
- `02-hermes-contracts.md` provides detailed interface design
- `03-popper-safety-dsl.md` specifies algorithms
- TypeScript interfaces provide data structure definitions

### 4.5 Software Unit Implementation (§5.5)

**Requirements:**

| Activity | Class A | Class B | Class C | ADVOCATE Implementation |
|----------|---------|---------|---------|------------------------|
| Implement per detailed design | Required | Required | Required | Source code |
| Follow coding standards | — | Required | Required | TypeScript strict mode |
| Static analysis | — | — | Required | Linting, type checking |

**Spec Alignment:**
- TypeScript with strict mode provides type safety
- ESLint/TSLint for static analysis
- Code review required for merges

### 4.6 Software Unit Verification (§5.5.5)

**Requirements:**

| Activity | Class A | Class B | Class C | ADVOCATE Implementation |
|----------|---------|---------|---------|------------------------|
| Unit testing | — | As needed | Required | Jest/Vitest tests |
| Code review | — | As needed | Required | PR review process |
| Static analysis | — | — | Required | CI pipeline |

**Spec Alignment:**
- Test fixtures in spec directories
- CI-compatible regression testing
- TDD approach via test-writer expert

### 4.7 Software Integration and Testing (§5.6)

**Requirements:**

| Activity | Class A | Class B | Class C | ADVOCATE Implementation |
|----------|---------|---------|---------|------------------------|
| Integration testing | — | Required | Required | IV&V studies |
| Regression testing | — | Required | Required | CI test suite |
| Content verification | Required | Required | Required | Contract validation |

**Spec Alignment:**
- Hermes fixture validation in CI
- Phase 1A/1B IV&V provides integration evidence
- Cross-component testing via test vectors

### 4.8 Software System Testing (§5.7)

**Requirements:**

| Activity | Class A | Class B | Class C | ADVOCATE Implementation |
|----------|---------|---------|---------|------------------------|
| Test against requirements | Required | Required | Required | IV&V metrics |
| Test in intended environment | — | Required | Required | TA3 deployment |
| Regression after changes | — | Required | Required | Automated CI |

**Spec Alignment:**
- ARPA-H IV&V validates against TA1/TA2 requirements
- TA3 sites provide production-like environment
- Scalability Studies test real-world deployment

### 4.9 Software Release (§5.8)

**Requirements:**

| Activity | Class A | Class B | Class C | ADVOCATE Implementation |
|----------|---------|---------|---------|------------------------|
| Version documentation | Required | Required | Required | Semver in specs |
| Release package | Required | Required | Required | Container images |
| Archiving | Required | Required | Required | Git + artifact storage |

**Spec Alignment:**
- Hermes version field on all messages
- Policy pack versioning in Safety DSL
- Service version tracking

---

## 5. Maintenance Process (§6)

### 5.1 Problem Resolution (§6.1)

**Requirements:**
- Document problems discovered post-release
- Analyze problems for root cause
- Implement corrective actions
- Verify corrections

**Spec Alignment:**
- Popper incident workflow (`04-popper-regulatory-export.md`)
- Hermes audit events for problem tracking
- Safe-mode triggers for issue detection

### 5.2 Change Management (§6.2)

**Requirements:**
- Document change requests
- Analyze impact of changes
- Approve changes before implementation
- Maintain traceability

**Spec Alignment:**
- Policy pack versioning (semver)
- PCCP framework for algorithm updates (see [09-pccp-change-control.md](./09-pccp-change-control.md))
- Hermes compatibility versioning

---

## 6. Relevance to Clinical Agents

### 6.1 Deutsch Compliance Map

| IEC 62304 Section | Deutsch Implementation | Evidence |
|-------------------|----------------------|----------|
| §5.1 Development Planning | Sprint planning, ARPA-H milestones | Project documentation |
| §5.2 Requirements | System spec §1-4 | `01-deutsch-system-spec.md` |
| §5.3 Architecture | Cartridge architecture | `03-deutsch-cvd-cartridge-spec.md` |
| §5.4 Detailed Design | Contracts and interfaces | `02-deutsch-contracts.md` |
| §5.5 Implementation | TypeScript source | Codebase |
| §5.6 Integration | Hermes protocol testing | CI pipeline |
| §5.7 System Testing | IV&V studies | ARPA-H data |
| §5.8 Release | Version management | Deployment artifacts |

### 6.2 Popper Compliance Map

| IEC 62304 Section | Popper Implementation | Evidence |
|-------------------|----------------------|----------|
| §5.1 Development Planning | Independent development track | Project documentation |
| §5.2 Requirements | System spec §2-6 | `01-popper-system-spec.md` |
| §5.3 Architecture | Policy engine architecture | System spec §4-5 |
| §5.4 Detailed Design | Safety DSL specification | `03-popper-safety-dsl.md` |
| §5.5 Implementation | Deterministic engine | Codebase |
| §5.6 Integration | Hermes integration testing | CI pipeline |
| §5.7 System Testing | IV&V studies | ARPA-H data |
| §5.8 Release | Policy pack versioning | Version tracking |

### 6.3 Hermes Compliance Map

| IEC 62304 Section | Hermes Implementation | Evidence |
|-------------------|----------------------|----------|
| §5.2 Requirements | Protocol requirements | `01-hermes-system-spec.md` |
| §5.3 Architecture | Message-based architecture | System spec |
| §5.4 Detailed Design | TypeScript contracts | `02-hermes-contracts.md` |
| §5.5 Implementation | Schema validation | Contract code |
| §5.6 Integration | Fixture validation | `fixtures/` directory |
| §5.7 System Testing | Cross-agent testing | IV&V |

---

## 7. Implementation Checklist

### Safety Classification

- [ ] Document safety classification rationale for each component
- [ ] Review classification with QA/RA team
- [ ] Update specs with explicit class declarations

### Development Planning

- [ ] Create software development plan (SDP)
- [ ] Define coding standards document
- [ ] Document tool qualification requirements
- [ ] Establish traceability matrix template

### Requirements

- [ ] Review specs for completeness per IEC 62304 §5.2
- [ ] Ensure risk-derived requirements are documented
- [ ] Verify performance requirements are measurable

### Design

- [ ] Document component decomposition
- [ ] Verify interface specifications complete
- [ ] Review safety segregation (Popper independence)

### Verification & Validation

- [ ] Define unit test coverage targets (Class C: >80%)
- [ ] Establish integration test plan
- [ ] Define IV&V acceptance criteria

### Configuration Management

- [ ] Establish version control procedures
- [ ] Define release packaging process
- [ ] Document archival requirements

---

## 8. References

### Standards

- [IEC 62304:2015+AMD1:2020 Medical device software — Software life cycle processes](https://www.iso.org/standard/38421.html)
- [ISO 14971:2019 Medical devices — Application of risk management](https://www.iso.org/standard/72704.html)
- [ISO 13485:2016 Medical devices — Quality management systems](https://www.iso.org/standard/59752.html)

### FDA Guidance

- [Content of Premarket Submissions for Device Software Functions](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/content-premarket-submissions-device-software-functions)
- [FDA Recognized Consensus Standards Database](https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfStandards/search.cfm)

### Implementation Guidance

- [IEC 62304 Implementation Guide (Ketryx)](https://www.ketryx.com/blog/a-comprehensive-guide-to-iec-62304-navigating-the-standard-for-medical-device-software)
- [IEC 62304 QMS Checklist](https://www.greenlight.guru/blog/how-to-leverage-iec-62304-to-improve-samd-development-processes)

### ADVOCATE Specs

- [Deutsch System Spec](../../01-deutsch-specs/01-deutsch-system-spec.md)
- [Popper System Spec](../../02-popper-specs/01-popper-system-spec.md)
- [Hermes System Spec](../../03-hermes-specs/01-hermes-system-spec.md)

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-24 | ADVOCATE Team | Initial release |
