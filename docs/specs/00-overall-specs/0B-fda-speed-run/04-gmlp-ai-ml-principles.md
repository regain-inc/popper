# Good Machine Learning Practice (GMLP) for AI/ML Medical Devices

> **Document Version:** 1.0.0
> **Last Updated:** 2026-01-24
> **Applies To:** Deutsch (TA1), Popper (TA2)
> **Related Specs:** All AI/ML components

---

## 1. Overview

Good Machine Learning Practice (GMLP) provides guiding principles for the development of safe, effective, and high-quality AI/ML-enabled medical devices. Originally published in October 2021 by FDA, Health Canada, and UK MHRA, and updated by IMDRF in January 2025, these principles apply to both Deutsch (clinical AI) and Popper (supervisory AI).

### GMLP Applicability

| Component | GMLP Applicability | Key Principles |
|-----------|-------------------|----------------|
| **Deutsch** | Full - Patient-facing AI/ML | Principles 1-10 (all) |
| **Popper** | Partial - Evaluation AI | Principles 1-3, 5, 10 |
| **Hermes** | Indirect - Infrastructure | Supports Principles 2, 9 |

---

## 2. The 10 GMLP Guiding Principles

### Principle 1: Multi-Disciplinary Expertise Throughout TPLC

> "Multi-disciplinary expertise is leveraged throughout the total product life cycle."

**Requirement:** Medical device manufacturers should involve experts across data science, clinical practice, human factors, and regulatory affairs throughout the device lifecycle.

**ADVOCATE Implementation:**

| Expertise Area | Role in ADVOCATE | Spec Reference |
|----------------|------------------|----------------|
| Clinical (Cardiology) | CVD cartridge design, guardrails | `03-deutsch-cvd-cartridge-spec.md` |
| Data Science | Model training, validation | Deutsch LLM pipeline |
| Human Factors | Patient/clinician interfaces | TA3 UI/UX testing |
| Regulatory | FDA strategy, MDDT qualification | This document series |
| Cybersecurity | Hermes security design | `03-hermes-deployment-security.md` |
| Quality/Risk | Risk management, V&V | ISO 14971 alignment |

**Gap:** Ensure cardiology clinical expertise is formally involved in Popper policy pack design.

---

### Principle 2: Good Software Engineering and Security Practices

> "Good software engineering and security practices are implemented."

**Requirement:** Model design should include good software engineering practices, data quality assurance, data management, and robust cybersecurity practices.

**ADVOCATE Implementation:**

| Practice | Implementation | Evidence |
|----------|---------------|----------|
| Software lifecycle | IEC 62304 compliance | [03-iec-62304-software-lifecycle.md](./03-iec-62304-software-lifecycle.md) |
| Data quality | EHR/wearable validation | TA1 data integration specs |
| Cybersecurity | Hermes JWS signatures, mTLS | `03-hermes-deployment-security.md` |
| Risk management | ISO 14971 framework | [05-iso-14971-risk-management.md](./05-iso-14971-risk-management.md) |
| Audit trails | Hermes audit events | `02-hermes-contracts.md` §AuditEvent |

**Spec Alignment:**
- Hermes integrity verification provides security
- Popper deterministic engine ensures reproducibility
- Version control for all policy packs

---

### Principle 3: Representative Training Data

> "Clinical study participants and datasets are representative of the intended patient population."

**Requirement:** Training, tuning, and testing datasets should be representative of the intended patient population, considering factors like age, gender, race, and clinical characteristics.

**ADVOCATE Implementation:**

| Population Factor | Requirement | ADVOCATE Approach |
|-------------------|-------------|-------------------|
| **Age** | Adequate older adult representation | TA3 enrollment criteria |
| **Sex/Gender** | Balanced representation | IV&V demographics tracking |
| **Race/Ethnicity** | US population representative | TA3 site diversity |
| **Disease Severity** | Spectrum of HF/post-MI severity | Inclusion criteria |
| **Comorbidities** | Common CVD comorbidities included | Training data curation |
| **EHR System** | Multiple vendors (2+) | TA3 multi-vendor requirement |
| **Geographic** | Urban/rural, access-gap areas | TA3 site selection |

**ARPA-H Alignment:**
- TA3 performers selected for demographic variance
- IV&V studies track population representativeness
- Phase 2 scalability studies ensure real-world diversity

**Gap:** Document formal demographic requirements for training data.

---

### Principle 4: Independence of Training and Test Datasets

> "Training data sets are independent of test sets."

**Requirement:** Separation of training, tuning, and testing datasets to ensure valid performance evaluation.

**ADVOCATE Implementation:**

| Dataset | Purpose | Separation Strategy |
|---------|---------|-------------------|
| Training | Model development | Phase 1A data from TA3 sites |
| Tuning | Hyperparameter optimization | Held-out validation set |
| Testing | Performance evaluation | IV&V study data (independent) |
| Real-world | Post-market monitoring | Phase 2 scalability study data |

**Critical Requirement:**
- TA1 and TA2 must maintain **technical independence** (ARPA-H requirement)
- Popper cannot be trained on Deutsch's training data
- IV&V partner provides independent evaluation

---

### Principle 5: Reference Standard Selection

> "Selected reference datasets are based upon the best available methods."

**Requirement:** Reference standards (ground truth) should be clinically meaningful and based on established methods.

**ADVOCATE Implementation:**

| Function | Reference Standard | Justification |
|----------|-------------------|---------------|
| Diagnosis | Cardiologist adjudication | Clinical gold standard |
| Treatment | Guideline-concordant care | AHA/ACC guidelines |
| Triage | Emergency department outcomes | Objective outcome measure |
| Prescription | Clinical appropriateness | Expert panel review |

**IV&V Approach:**
- Phase 1A: Synthetic patients with known outcomes
- Phase 1B: Simulated patients with cardiologist benchmark
- Phase 2: Real-world clinical outcomes

---

### Principle 6: Model Fit for Purpose

> "Model design is tailored to the available data and reflects the intended use of the device."

**Requirement:** Model complexity should match data availability and intended clinical application.

**ADVOCATE Implementation:**

| Design Choice | Rationale | Spec Reference |
|--------------|-----------|----------------|
| Foundation model (not from scratch) | Leverages validated base | ARPA-H TA1 requirement |
| CVD-specific cartridge | Tailored to intended use | `03-deutsch-cvd-cartridge-spec.md` |
| Deterministic Popper | Appropriate for safety function | `03-popper-safety-dsl.md` |
| Policy-based guardrails | Explainable risk controls | Deutsch §4 (guardrails) |

---

### Principle 7: Human-AI Team Performance

> "Focus is placed on the performance of the Human-AI Team."

**Requirement:** Device performance should be evaluated in the context of human use, considering the combined human-AI system.

**ADVOCATE Implementation:**

| Human Role | AI Support | Team Performance Metric |
|------------|------------|------------------------|
| Patient | Deutsch guidance | Adherence, satisfaction (UAT) |
| Clinician | Triage/escalation | Time savings, appropriate escalation |
| Care team | Care navigation | Coordination efficiency |
| Supervisor | Popper alerts | Alert fatigue, response time |

**ARPA-H Metrics:**
- UAT score (>85 Phase 1A, >95 Phase 1B)
- Clinician engagement and uptake
- Patient preference adaptation (>90% Phase 1A, >95% Phase 1B)

---

### Principle 8: Clinical Validation Reflects Deployment

> "Testing demonstrates device performance during clinically relevant conditions."

**Requirement:** Clinical testing should occur under conditions representative of actual deployment.

**ADVOCATE Implementation:**

| Testing Phase | Conditions | Deployment Representativeness |
|---------------|------------|------------------------------|
| Phase 1A | Synthetic data | Low (development only) |
| Phase 1B | Simulated patients + real users | Moderate |
| Phase 2 | Real clinical deployment | High (production environment) |

**TA3 Alignment:**
- Pre-production EHR environment testing
- Production deployment in scalability studies
- Multiple health system types and EHR vendors

---

### Principle 9: Clear User Information

> "Users are provided clear, essential information."

**Requirement:** Users should understand device purpose, intended use, known limitations, and appropriate interpretation of outputs.

**ADVOCATE Implementation:**

| Information Type | Audience | Implementation |
|------------------|----------|----------------|
| Intended use | Clinicians | Labeling, IFU |
| Limitations | Clinicians | Labeling, in-app |
| Uncertainty | Patients/Clinicians | DisclosureBundle |
| Confidence levels | Clinicians | Proposal metadata |
| Evidence basis | Clinicians | EvidenceRef pointers |

**Spec Alignment:**
- `DisclosureBundle` in Hermes provides transparency
- Uncertainty levels (low/medium/high) communicated
- Key unknowns explicitly stated

**FDA Transparency Guidance (June 2024):**
- Model characteristics transparency
- Intended population description
- Input/output data types
- Performance metrics and limitations

---

### Principle 10: Deployed Models Are Monitored

> "Deployed models are monitored for performance and re-training risks are managed."

**Requirement:** Post-deployment monitoring should detect performance degradation, and updates should be managed through appropriate change control.

**ADVOCATE Implementation:**

| Monitoring Aspect | Implementation | Spec Reference |
|-------------------|----------------|----------------|
| Performance tracking | Popper quality signals | `01-popper-system-spec.md` §5-6 |
| Drift detection | Hard-stop analysis triggers | `01-popper-system-spec.md` §6 |
| Incident management | Safe-mode + export bundles | `04-popper-regulatory-export.md` |
| Change control | PCCP framework | [09-pccp-change-control.md](./09-pccp-change-control.md) |
| Re-training management | Algorithm update protocols | PCCP |

**Popper as GMLP Principle 10 Implementation:**
The Popper Supervisory Agent directly implements Principle 10:
- Continuous monitoring of Deutsch outputs
- Drift detection via quality signals
- Automated safe-mode transitions
- Regulatory export for oversight

---

## 3. FDA Transparency Principles (2024)

In June 2024, FDA released "Transparency for Machine Learning-Enabled Medical Devices" guidance, building on GMLP Principle 9.

### Transparency Recommendations

| Category | Recommendation | ADVOCATE Implementation |
|----------|---------------|------------------------|
| **Intended Use** | Clear population and use case | Draft intended use statement |
| **Data Characteristics** | Describe training data | Document demographics |
| **Model Architecture** | General description | Foundation model + cartridge |
| **Performance Metrics** | Sensitivity, specificity, AUC | TA1/TA2 metrics |
| **Limitations** | Known failure modes | Guardrail documentation |
| **Updates** | PCCP or re-submission | PCCP framework |

---

## 4. PCCP Integration

GMLP Principle 10 connects directly to Predetermined Change Control Plans:

| GMLP 10 Aspect | PCCP Implementation |
|----------------|-------------------|
| "Performance monitored" | Post-market data collection |
| "Re-training risks managed" | Modification protocols |
| "Update procedures" | Deployment and rollback plans |

See [09-pccp-change-control.md](./09-pccp-change-control.md) for detailed PCCP guidance.

---

## 5. Implementation Checklist

### Multi-Disciplinary Team

- [ ] Document team composition with expertise areas
- [ ] Ensure clinical cardiology input on all patient-facing decisions
- [ ] Include human factors expertise for interface design
- [ ] Involve regulatory affairs in design decisions

### Data Representativeness

- [ ] Define demographic requirements for training data
- [ ] Document dataset separation (train/tune/test)
- [ ] Establish reference standard justification
- [ ] Plan IV&V with representative populations

### Software Practices

- [ ] Implement IEC 62304 lifecycle
- [ ] Deploy cybersecurity controls (Hermes security)
- [ ] Establish audit trail mechanisms
- [ ] Document risk management integration

### Transparency

- [ ] Design user-facing uncertainty communication
- [ ] Document model limitations
- [ ] Plan labeling content per FDA guidance
- [ ] Implement DisclosureBundle in outputs

### Monitoring

- [ ] Implement Popper monitoring infrastructure
- [ ] Define drift detection thresholds
- [ ] Establish PCCP for updates
- [ ] Plan post-market surveillance

---

## 6. References

### FDA/Regulatory Guidance

- [Good Machine Learning Practice for Medical Device Development (FDA)](https://www.fda.gov/medical-devices/software-medical-device-samd/good-machine-learning-practice-medical-device-development-guiding-principles)
- [Transparency for Machine Learning-Enabled Medical Devices (FDA June 2024)](https://www.fda.gov/medical-devices/software-medical-device-samd/transparency-machine-learning-enabled-medical-devices-guiding-principles)
- [Predetermined Change Control Plans Guiding Principles (FDA)](https://www.fda.gov/medical-devices/software-medical-device-samd/predetermined-change-control-plans-machine-learning-enabled-medical-devices-guiding-principles)

### IMDRF Documents

- [GMLP Guiding Principles (IMDRF 2025)](https://www.imdrf.org/documents/good-machine-learning-practice-medical-device-development-guiding-principles)
- [SaMD Clinical Evaluation (IMDRF N41)](https://www.imdrf.org/documents/software-medical-device-samd-clinical-evaluation)

### Standards

- IEC 62304:2015 - Software lifecycle
- ISO 14971:2019 - Risk management

### ADVOCATE Specs

- [Popper System Spec](../../02-popper-specs/01-popper-system-spec.md)
- [Popper Safety DSL](../../02-popper-specs/03-popper-safety-dsl.md)
- [Hermes Contracts](../../03-hermes-specs/02-hermes-contracts.md)

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-24 | ADVOCATE Team | Initial release |
