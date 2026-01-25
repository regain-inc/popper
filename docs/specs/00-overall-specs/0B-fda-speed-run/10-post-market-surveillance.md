# Post-Market Surveillance for AI/ML Medical Devices

> **Document Version:** 1.0.0
> **Last Updated:** 2026-01-24
> **Applies To:** Deutsch (TA1), Popper (TA2)
> **Related Specs:** `04-popper-regulatory-export-and-triage.md`

---

## 1. Overview

Post-market surveillance (PMS) is essential for AI/ML-enabled medical devices to ensure ongoing safety and effectiveness. FDA's Total Product Lifecycle (TPLC) approach emphasizes continuous monitoring. This document provides guidance on PMS requirements and how Popper serves as a post-market monitoring infrastructure.

### TPLC Concept

```
┌─────────────────────────────────────────────────────────────────────┐
│                Total Product Lifecycle (TPLC)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐             │
│  │Premarket│──►│ Launch  │──►│  Post-  │──►│ Update/ │             │
│  │ Review  │   │         │   │ Market  │   │ Retire  │             │
│  └─────────┘   └─────────┘   └────┬────┘   └─────────┘             │
│                                   │                                  │
│                                   ▼                                  │
│                     ┌─────────────────────────┐                     │
│                     │ Continuous Monitoring   │                     │
│                     │ • Real-world performance│                     │
│                     │ • Safety signals        │                     │
│                     │ • Drift detection       │◄── Popper           │
│                     │ • Adverse events        │                     │
│                     └─────────────────────────┘                     │
│                                   │                                  │
│                                   ▼                                  │
│                     ┌─────────────────────────┐                     │
│                     │ Feedback to Development │                     │
│                     │ (PCCP modifications)    │                     │
│                     └─────────────────────────┘                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Regulatory Framework

### 2.1 FDA PMS Requirements

FDA requires post-market surveillance activities including:

| Requirement | Description | Applicability |
|-------------|-------------|---------------|
| **MDR reporting** | Medical Device Reports for adverse events | All devices |
| **Corrections/removals** | Report safety-related changes | All devices |
| **522 studies** | Mandated post-market studies | Select devices |
| **Real-world monitoring** | Performance in clinical use | AI/ML devices |

### 2.2 AI/ML-Specific Considerations

FDA's September 2025 Request for Public Comment highlighted:

- Performance changes over time in dynamic environments
- Systematic performance monitoring requirements
- Data drift and model degradation detection
- Subpopulation performance variation

### 2.3 PCCP Post-Market Obligations

For devices with approved PCCPs:
- Ongoing performance data collection
- Demonstration of continued safety/effectiveness
- Change documentation and reporting

---

## 3. Performance Monitoring Framework

### 3.1 Key Performance Indicators

| Category | Metric | Threshold | Action if Exceeded |
|----------|--------|-----------|-------------------|
| **Effectiveness** | Appropriateness of actions | <85% | Investigation |
| **Safety** | Serious error rate | >3% | Safe-mode evaluation |
| **Latency** | Response time | >1s (Phase 1B) | Technical review |
| **Drift** | Trend away from baseline | >10% degradation | Model evaluation |
| **Escalation** | Clinician routing rate | >2x baseline | Threshold review |

### 3.2 Monitoring Frequency

| Metric Type | Frequency | Responsible Party |
|-------------|-----------|-------------------|
| Real-time safety | Continuous | Popper |
| Performance dashboards | Daily | Operations |
| Trend analysis | Weekly | Data science |
| Subgroup analysis | Monthly | Clinical |
| Comprehensive review | Quarterly | QA/RA |

### 3.3 Data Sources

| Source | Data Type | Use |
|--------|-----------|-----|
| Popper audit logs | Decision patterns | Safety monitoring |
| Hermes audit events | System performance | Reliability |
| EHR integration | Patient outcomes | Effectiveness |
| User feedback | Usability issues | UX improvement |
| Adverse event reports | Harm occurrences | Safety signals |

---

## 4. Popper as PMS Infrastructure

### 4.1 Popper Monitoring Functions

**Spec Reference:** `01-popper-system-spec.md` §5-6

| Function | Description | PMS Contribution |
|----------|-------------|------------------|
| **Quality signals** | Real-time performance metrics | Drift detection |
| **Validation tracking** | Schema/policy compliance | Error trending |
| **Decision auditing** | All supervision decisions logged | Pattern analysis |
| **Incident management** | Safe-mode and export workflow | Issue response |
| **Regulatory export** | De-identified data bundles | FDA reporting |

### 4.2 Drift Detection

**Monitored Signals:**

| Signal | Baseline | Alert Threshold |
|--------|----------|-----------------|
| `validation_failure_count` | Established baseline | 2x baseline |
| `hard_stop_count` | Established baseline | 2x baseline |
| `route_to_clinician_count` | Established baseline | 1.5x baseline |
| `high_uncertainty_count` | Established baseline | 2x baseline |

**Hard-Stop Analysis Triggers:**

| Trigger | Action |
|---------|--------|
| Spike in validation failures | Enable safe-mode, investigate |
| Policy violation surge | Review policy pack |
| Integrity failure pattern | Security investigation |
| Performance degradation | Technical review |

### 4.3 Regulatory Export Bundles

**Spec Reference:** `04-popper-regulatory-export-and-triage.md`

| Bundle Component | Content | Purpose |
|------------------|---------|---------|
| `bundle_manifest.json` | Metadata, versions | Traceability |
| `audit_events.jsonl` | De-identified events | Pattern analysis |
| `supervision_receipts.jsonl` | Decision summaries | Decision review |
| `incidents.jsonl` | Incident records | Safety analysis |

---

## 5. Adverse Event Reporting

### 5.1 Medical Device Reporting (MDR)

**Reportable Events:**

| Event Type | Reporting Timeline | Report To |
|------------|-------------------|-----------|
| Death or serious injury | 30 days | FDA |
| Malfunction that could cause harm | 30 days | FDA |
| Awareness of unreported events | 5 days after awareness | FDA |

### 5.2 MDR Workflow for ADVOCATE

```
Adverse Event Detected
        │
        ▼
┌───────────────────────┐
│ Popper incident record│
│ Safe-mode if needed   │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ Causality assessment  │
│ Device-related?       │
└───────────┬───────────┘
            │
    ┌───────┴───────┐
    ▼               ▼
  Yes              No
    │               │
    ▼               ▼
┌─────────┐   ┌─────────┐
│ MDR     │   │ Document│
│ Filing  │   │ Only    │
└─────────┘   └─────────┘
```

### 5.3 MedWatch Reporting

- Use FDA Form 3500A for mandatory reports
- Include Popper export bundle as attachment
- Document causality assessment rationale

---

## 6. Real-World Data Collection

### 6.1 Data Categories

| Category | Data Elements | Collection Method |
|----------|---------------|-------------------|
| **Performance** | Accuracy, latency, errors | Automated logging |
| **Safety** | Adverse events, near-misses | Incident reporting |
| **Effectiveness** | Clinical outcomes | EHR integration |
| **Usability** | User feedback, complaints | Feedback channels |
| **Demographics** | Subpopulation performance | Stratified analysis |

### 6.2 Data Quality Requirements

| Requirement | Implementation |
|-------------|---------------|
| **Completeness** | Automated data capture |
| **Accuracy** | Validation at source |
| **Timeliness** | Real-time or near-real-time |
| **Consistency** | Standardized formats |
| **Privacy** | De-identification per spec |

### 6.3 FDA Real-World Evidence (2025)

Per December 2025 guidance, RWE can support:
- Expanded indications
- Post-market commitments
- Performance claims
- Safety monitoring

---

## 7. Scalability Study Integration

### 7.1 Phase 2 as PMS Validation

The ARPA-H Phase 2 Scalability Studies serve as intensive PMS validation:

| Study Element | PMS Relevance |
|---------------|---------------|
| Real-world deployment | Production environment data |
| Randomized design | Comparative effectiveness |
| Multi-site | Generalizability assessment |
| Outcome tracking | Clinical endpoints |

### 7.2 Outcome Measures

| Outcome | Measurement | Reporting |
|---------|-------------|-----------|
| HF/CVD hospitalizations | EHR + claims | Quarterly |
| ED/UC visits | EHR tracking | Monthly |
| CV death | Death registry | Quarterly |
| Serious adverse events | Incident reports | Continuous |

---

## 8. Continuous Improvement

### 8.1 Feedback Loop

| Data Source | Analysis | Action |
|-------------|----------|--------|
| Performance trends | Drift assessment | PCCP modification |
| Safety signals | Root cause analysis | Design update |
| User feedback | Usability review | UX enhancement |
| Clinical outcomes | Effectiveness validation | Algorithm refinement |

### 8.2 PCCP Integration

Post-market data informs PCCP modifications:

| Finding | PCCP Response |
|---------|---------------|
| Performance improvement opportunity | Retrain with new data |
| Subpopulation gap | Targeted fine-tuning |
| New clinical evidence | Algorithm update |
| Safety signal | Risk mitigation |

---

## 9. Reporting Requirements

### 9.1 Internal Reporting

| Report | Frequency | Audience |
|--------|-----------|----------|
| Safety dashboard | Daily | Operations |
| Performance summary | Weekly | Leadership |
| Trend analysis | Monthly | QA/RA |
| Comprehensive PMS review | Quarterly | Executive |

### 9.2 Regulatory Reporting

| Report | Timing | Content |
|--------|--------|---------|
| MDRs | Within 30 days | Individual adverse events |
| Annual reports | Per CFR requirements | Aggregate safety data |
| PCCP reports | Per PCCP requirements | Modification summaries |
| 522 study reports | If applicable | Study results |

---

## 10. Implementation Checklist

### Infrastructure

- [ ] Configure Popper monitoring dashboards
- [ ] Set up drift detection alerts
- [ ] Implement export bundle automation
- [ ] Establish data warehouse for PMS data

### Processes

- [ ] Define adverse event classification criteria
- [ ] Create MDR filing procedures
- [ ] Establish causality assessment process
- [ ] Document escalation procedures

### Reporting

- [ ] Create internal reporting templates
- [ ] Set up regulatory reporting workflows
- [ ] Define reporting responsibilities
- [ ] Schedule periodic reviews

### PCCP Integration

- [ ] Link PMS data to PCCP decision-making
- [ ] Define thresholds triggering modification
- [ ] Document feedback loop process

---

## 11. References

### FDA Guidance

- [Postmarket Surveillance Under Section 522](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/postmarket-surveillance-under-section-522-federal-food-drug-and-cosmetic-act)
- [Medical Device Reporting](https://www.fda.gov/medical-devices/postmarket-requirements-devices/medical-device-reporting-mdr-how-report-medical-device-problems)
- [Methods for AI Postmarket Monitoring (FDA Research)](https://www.fda.gov/medical-devices/medical-device-regulatory-science-research-programs-conducted-osel/methods-and-tools-effective-postmarket-monitoring-artificial-intelligence-ai-enabled-medical-devices)
- [Request for Public Comment on AI Evaluation (Sept 2025)](https://www.fda.gov/medical-devices/digital-health-center-excellence/request-public-comment-measuring-and-evaluating-artificial-intelligence-enabled-medical-device)

### Regulations

- [21 CFR Part 803 - Medical Device Reporting](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-803)
- [21 CFR Part 806 - Corrections and Removals](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-806)

### ADVOCATE Specs

- [Popper System Spec](../../02-popper-specs/01-popper-system-spec.md)
- [Popper Regulatory Export](../../02-popper-specs/04-popper-regulatory-export-and-triage.md)
- [PCCP Guidance](./09-pccp-change-control.md)

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-24 | ADVOCATE Team | Initial release |
