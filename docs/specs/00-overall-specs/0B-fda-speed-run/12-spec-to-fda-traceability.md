# Spec-to-FDA Traceability Matrix

> **Document Version:** 1.0.0
> **Last Updated:** 2026-01-24
> **Applies To:** Deutsch (TA1), Popper (TA2), Hermes Protocol
> **Purpose:** Cross-reference specifications to FDA requirements

---

## 1. Overview

This document provides a comprehensive traceability matrix mapping ADVOCATE specification sections to FDA regulatory requirements. It serves as:

1. **Compliance tracker** - Verify all requirements are addressed
2. **Gap identifier** - Highlight missing documentation
3. **Audit support** - Quick reference for regulatory review
4. **Development guide** - Ensure new features meet requirements

---

## 2. Traceability Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Fully addressed in spec |
| ⚠️ | Partially addressed - gap identified |
| ❌ | Not addressed - action required |
| N/A | Not applicable |
| 📝 | Documentation exists separately |

---

## 3. Deutsch (TA1) Traceability

### 3.1 Software Lifecycle (IEC 62304)

| IEC 62304 Section | Requirement | Spec Reference | Status | Gap/Action |
|-------------------|-------------|----------------|--------|------------|
| §5.1 Development Planning | Document development plan | ARPA-H milestones | ⚠️ | Formalize SDP |
| §5.2 Requirements Analysis | Document requirements | `01-deutsch-system-spec.md` | ✅ | - |
| §5.3 Architecture Design | Document architecture | `00-deutsch-popper-hermes-architecture.md` | ✅ | - |
| §5.4 Detailed Design | Document detailed design | `02-deutsch-contracts.md` | ✅ | - |
| §5.5 Unit Implementation | Follow coding standards | TypeScript strict mode | ✅ | - |
| §5.6 Integration Testing | Conduct integration tests | Hermes fixtures, CI | ✅ | - |
| §5.7 System Testing | Validate against requirements | IV&V studies | ✅ | - |
| §5.8 Release | Version management | Semver in specs | ✅ | - |
| §6 Maintenance | Document change process | PCCP framework | ⚠️ | See [09-pccp](./09-pccp-change-control.md) |

### 3.2 Risk Management (ISO 14971)

| ISO 14971 Section | Requirement | Spec Reference | Status | Gap/Action |
|-------------------|-------------|----------------|--------|------------|
| §4 Risk analysis | Identify hazards | `01-deutsch-system-spec.md` §4 | ⚠️ | Complete FMEA |
| §5 Risk evaluation | Apply acceptability criteria | Risk matrix needed | ❌ | Create risk matrix |
| §6 Risk control | Implement controls | Guardrails, Popper supervision | ✅ | - |
| §7 Residual risk | Assess overall risk | Not documented | ❌ | Document assessment |
| §8 Production info | Monitor in production | Popper monitoring | ✅ | - |
| §9 Risk management review | Periodic review | Not scheduled | ⚠️ | Schedule reviews |

### 3.3 GMLP Principles

| GMLP Principle | Requirement | Spec Reference | Status | Gap/Action |
|----------------|-------------|----------------|--------|------------|
| 1. Multi-disciplinary | Expert team | ARPA-H team structure | ✅ | - |
| 2. Good practices | Software engineering | IEC 62304 alignment | ✅ | - |
| 3. Representative data | Training data | TA3 requirements | ⚠️ | Document demographics |
| 4. Independent datasets | Train/test separation | IV&V protocol | ✅ | - |
| 5. Reference standards | Ground truth | Cardiologist benchmark | ✅ | - |
| 6. Model fit | Appropriate design | Foundation model approach | ✅ | - |
| 7. Human-AI team | Team performance | UAT metrics | ✅ | - |
| 8. Deployment testing | Clinical conditions | Phase 2 studies | ✅ | - |
| 9. User information | Transparency | DisclosureBundle | ✅ | - |
| 10. Monitoring | Performance tracking | Popper monitoring | ✅ | - |

### 3.4 Cybersecurity

| FDA Cybersecurity Req | Spec Reference | Status | Gap/Action |
|----------------------|----------------|--------|------------|
| Threat model | Not documented | ❌ | Create STRIDE analysis |
| SBOM | Not generated | ❌ | Implement SBOM generation |
| Security controls | `03-hermes-deployment-security.md` | ✅ | - |
| Vulnerability management | Not documented | ⚠️ | Create process |
| Incident response | Popper incident workflow | ✅ | - |

---

## 4. Popper (TA2) Traceability

### 4.1 MDDT Qualification

| MDDT Requirement | Spec Reference | Status | Gap/Action |
|------------------|----------------|--------|------------|
| Context of Use | `01-popper-system-spec.md` §2 | ⚠️ | Formalize COU statement |
| Tool description | `01-popper-system-spec.md` | ✅ | - |
| Performance criteria | TA2 metrics | ✅ | - |
| Qualification plan | Not documented | ❌ | Create qualification plan |
| Evidence package | IV&V data | ⚠️ | Compile evidence |
| SEBQ draft | Not started | ❌ | Draft SEBQ |

### 4.2 Safety DSL (Policy Engine)

| Requirement | Spec Reference | Status | Gap/Action |
|-------------|----------------|--------|------------|
| Deterministic decisions | `03-popper-safety-dsl.md` | ✅ | - |
| Versioned policies | Semver in policy packs | ✅ | - |
| Audit trail | Hermes audit events | ✅ | - |
| Test vectors | Fixtures required | ⚠️ | Add more test vectors |
| Default-to-safe | `01-popper-system-spec.md` §2.3 | ✅ | - |

### 4.3 Regulatory Export

| Requirement | Spec Reference | Status | Gap/Action |
|-------------|----------------|--------|------------|
| De-identification | `04-popper-regulatory-export.md` §4 | ✅ | - |
| Export bundles | `04-popper-regulatory-export.md` §3 | ✅ | - |
| Incident workflow | `04-popper-regulatory-export.md` §5 | ✅ | - |
| Retention policy | Not specified | ❌ | Define retention |

---

## 5. Hermes Protocol Traceability

### 5.1 Message Integrity

| Requirement | Spec Reference | Status | Gap/Action |
|-------------|----------------|--------|------------|
| Signature algorithm | `02-hermes-contracts.md` §2.2 | ✅ | - |
| Key management | `03-hermes-deployment-security.md` §1 | ✅ | - |
| Replay protection | `02-hermes-contracts.md` §3.3 | ✅ | - |
| Clock validation | `02-hermes-contracts.md` §1.2.1 | ✅ | - |
| Integrity failure handling | `03-hermes-deployment-security.md` §2 | ✅ | - |

### 5.2 Audit Requirements

| Requirement | Spec Reference | Status | Gap/Action |
|-------------|----------------|--------|------------|
| Audit event schema | `02-hermes-contracts.md` AuditEvent | ✅ | - |
| PHI redaction | `02-hermes-contracts.md` §1.4 | ✅ | - |
| Trace ID linking | `02-hermes-contracts.md` §2.2 | ✅ | - |
| Version tracking | hermes_version field | ✅ | - |

---

## 6. ARPA-H Requirements Traceability

### 6.1 TA1 Metrics

| Metric | Phase 1A Target | Phase 1B Target | Spec Reference | Status |
|--------|-----------------|-----------------|----------------|--------|
| Appropriateness of actions | >85% | >95% | TA1 requirements | ✅ |
| Appropriateness of triage | >85% | >95% | TA1 requirements | ✅ |
| Serious error rate | <5% | <3% | TA1 requirements | ✅ |
| UAT score | >85 | >95 | TA1 requirements | ✅ |
| FHIR/HL7v2 success | >95% | >97% | TA1 requirements | ✅ |
| Response latency | <3s | <1s | TA1 requirements | ✅ |

### 6.2 TA2 Metrics

| Metric | Phase 1A Target | Phase 1B Target | Spec Reference | Status |
|--------|-----------------|-----------------|----------------|--------|
| Agent accuracy assessment | >85% | >95% | TA2 requirements | ✅ |
| Recommendation recognition | >85% | >95% | TA2 requirements | ✅ |
| Hallucination quantification | >85% | >95% | TA2 requirements | ✅ |
| Uncertainty determination | >85% | >95% | TA2 requirements | ✅ |
| Acuity/risk determination | >90% | >97% | TA2 requirements | ✅ |
| Response latency | <3s | <1s | TA2 requirements | ✅ |

---

## 7. Gap Summary

### 7.1 Critical Gaps (Action Required)

| Gap ID | Description | Owner | Priority | Target Date |
|--------|-------------|-------|----------|-------------|
| GAP-001 | SBOM generation not implemented | DevOps | High | Phase 1A |
| GAP-002 | STRIDE threat model not documented | Security | High | Phase 1A |
| GAP-003 | ISO 14971 risk matrix not created | QA | High | Phase 1A |
| GAP-004 | MDDT qualification plan not written | RA | High | Phase 1A |
| GAP-005 | SEBQ draft not started | RA | Medium | Phase 1B |

### 7.2 Moderate Gaps (Enhancement Needed)

| Gap ID | Description | Owner | Priority | Target Date |
|--------|-------------|-------|----------|-------------|
| GAP-006 | SDP needs formalization | PM | Medium | Phase 1A |
| GAP-007 | Training data demographics not documented | Data | Medium | Phase 1A |
| GAP-008 | Vulnerability management process needed | Security | Medium | Phase 1A |
| GAP-009 | Additional test vectors for Popper | Test | Medium | Phase 1B |
| GAP-010 | Data retention policy not specified | Compliance | Medium | Phase 1B |

### 7.3 Minor Gaps (Documentation Only)

| Gap ID | Description | Owner | Priority | Target Date |
|--------|-------------|-------|----------|-------------|
| GAP-011 | Risk review schedule not established | QA | Low | Phase 1B |
| GAP-012 | Residual risk assessment not documented | QA | Low | Phase 1B |

---

## 8. Compliance Score

### 8.1 By Category

| Category | Total Requirements | Addressed | Partial | Gaps | Score |
|----------|-------------------|-----------|---------|------|-------|
| IEC 62304 | 9 | 7 | 2 | 0 | 89% |
| ISO 14971 | 6 | 2 | 2 | 2 | 50% |
| GMLP | 10 | 9 | 1 | 0 | 95% |
| Cybersecurity | 5 | 2 | 1 | 2 | 50% |
| MDDT | 6 | 2 | 2 | 2 | 50% |
| Hermes | 9 | 9 | 0 | 0 | 100% |
| **Overall** | **45** | **31** | **8** | **6** | **78%** |

### 8.2 By Component

| Component | Score | Primary Gaps |
|-----------|-------|--------------|
| **Deutsch** | 75% | Risk management, SBOM |
| **Popper** | 70% | MDDT documentation |
| **Hermes** | 95% | Minor documentation |

---

## 9. Action Plan

### 9.1 Phase 1A Priorities (Months 0-12)

| Priority | Action | Gap ID | Deliverable |
|----------|--------|--------|-------------|
| 1 | Create STRIDE threat model | GAP-002 | Threat model document |
| 2 | Implement SBOM generation | GAP-001 | Automated SBOM pipeline |
| 3 | Complete ISO 14971 risk analysis | GAP-003 | Risk management file |
| 4 | Formalize SDP | GAP-006 | Software Development Plan |
| 5 | Draft MDDT qualification plan | GAP-004 | MDDT proposal package |

### 9.2 Phase 1B Priorities (Months 12-24)

| Priority | Action | Gap ID | Deliverable |
|----------|--------|--------|-------------|
| 1 | Draft SEBQ document | GAP-005 | SEBQ draft |
| 2 | Establish vulnerability management | GAP-008 | VMP document |
| 3 | Complete residual risk assessment | GAP-012 | Risk assessment report |
| 4 | Add Popper test vectors | GAP-009 | Test fixture expansion |
| 5 | Define data retention policy | GAP-010 | Retention policy doc |

---

## 10. References

### FDA Alignment Documents

- [00-fda-alignment-overview.md](./00-fda-alignment-overview.md)
- [01-samd-classification-and-pathways.md](./01-samd-classification-and-pathways.md)
- [02-mddt-qualification-guide.md](./02-mddt-qualification-guide.md)
- [03-iec-62304-software-lifecycle.md](./03-iec-62304-software-lifecycle.md)
- [04-gmlp-ai-ml-principles.md](./04-gmlp-ai-ml-principles.md)
- [05-iso-14971-risk-management.md](./05-iso-14971-risk-management.md)
- [06-clinical-evidence-framework.md](./06-clinical-evidence-framework.md)
- [07-cybersecurity-requirements.md](./07-cybersecurity-requirements.md)
- [08-human-factors-usability.md](./08-human-factors-usability.md)
- [09-pccp-change-control.md](./09-pccp-change-control.md)
- [10-post-market-surveillance.md](./10-post-market-surveillance.md)
- [11-documentation-requirements.md](./11-documentation-requirements.md)
- [13-qualified-mddt-solutions.md](./13-qualified-mddt-solutions.md)

### ADVOCATE Specifications

- [Deutsch Specs](../../01-deutsch-specs/)
- [Popper Specs](../../02-popper-specs/)
- [Hermes Specs](../../03-hermes-specs/)
- [ARPA-H Program Description](../A-arpa-program-description.md)

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-24 | ADVOCATE Team | Initial release |
