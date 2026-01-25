# Clinical Evidence Framework for SaMD

> **Document Version:** 1.0.0
> **Last Updated:** 2026-01-24
> **Applies To:** Deutsch (TA1), Popper (TA2)
> **Related Specs:** ARPA-H ADVOCATE IV&V, Scalability Studies

---

## 1. Overview

This document provides guidance on clinical evidence requirements for the ADVOCATE clinical agent system, based on the IMDRF N41 framework adopted by FDA. Clinical evidence is required to demonstrate that Deutsch (TA1) is safe and effective for its intended use, and that Popper (TA2) performs reliably for MDDT qualification.

### Evidence Framework Summary

The IMDRF/FDA framework establishes three pillars of clinical evidence:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Clinical Evidence Framework                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐                                                │
│  │ 1. SCIENTIFIC   │ Valid clinical association between             │
│  │    VALIDITY     │ SaMD output and clinical condition             │
│  └────────┬────────┘                                                │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────┐                                                │
│  │ 2. ANALYTICAL   │ SaMD correctly processes inputs                │
│  │    VALIDATION   │ to generate accurate outputs                   │
│  └────────┬────────┘                                                │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────┐                                                │
│  │ 3. CLINICAL     │ SaMD outputs achieve clinical                  │
│  │    VALIDATION   │ benefit in intended population                 │
│  └─────────────────┘                                                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Regulatory Framework

### 2.1 IMDRF N41 Clinical Evaluation

FDA adopted the IMDRF N41 guidance "Software as a Medical Device: Clinical Evaluation" which establishes:

- Three-pillar evidence framework
- Risk-proportionate evidence requirements
- Continuous clinical evaluation throughout lifecycle

### 2.2 Evidence Requirements by SaMD Category

| IMDRF Category | Scientific Validity | Analytical Validation | Clinical Validation |
|----------------|--------------------|-----------------------|---------------------|
| **Category I** | Published evidence sufficient | Basic testing | May not be required |
| **Category II** | Strong published evidence | Rigorous testing | Limited study |
| **Category III** | Excellent published + original | Comprehensive testing | Clinical study required |
| **Category IV** | Extensive evidence package | Exhaustive testing | Robust clinical study |

**Deutsch Classification: Category III** → Requires clinical study evidence

### 2.3 Real-World Evidence (2025)

FDA's December 2025 guidance expands RWE use:
- RWE acceptable for training AI/ML algorithms
- RWE can support label expansion
- RWE can provide primary clinical evidence in some cases

---

## 3. Pillar 1: Scientific Validity

### 3.1 Definition

Scientific validity (valid clinical association) demonstrates that the SaMD output is based on well-founded scientific principles and corresponds to the clinical condition.

### 3.2 Evidence Sources

| Evidence Type | Strength | Example |
|---------------|----------|---------|
| Peer-reviewed literature | High | Meta-analyses, RCTs |
| Clinical guidelines | High | AHA/ACC guidelines |
| Consensus standards | Medium | Society recommendations |
| Expert opinion | Low | When other evidence lacking |

### 3.3 Deutsch Scientific Validity Evidence

| SaMD Function | Clinical Association | Evidence Source |
|---------------|---------------------|-----------------|
| **HF medication titration** | GDMT improves outcomes | PARADIGM-HF, DAPA-HF trials |
| **Hypertension management** | BP control reduces CV events | SPRINT, ACCORD-BP |
| **Post-MI care** | Secondary prevention effective | ACC/AHA Guidelines |
| **AFib anticoagulation** | Stroke prevention | ROCKET-AF, ARISTOTLE |
| **Symptom monitoring** | Early detection improves outcomes | TIM-HF2, GUIDE-HF |

### 3.4 Evidence Documentation

For each clinical function, document:
1. Clinical question addressed
2. Evidence search methodology
3. Evidence quality assessment
4. Clinical association strength
5. Gaps requiring original research

---

## 4. Pillar 2: Analytical Validation

### 4.1 Definition

Analytical validation demonstrates that the SaMD correctly processes input data to generate accurate, reliable, and precise outputs.

### 4.2 Validation Components

| Component | Definition | Metric |
|-----------|------------|--------|
| **Accuracy** | Closeness to true value | Concordance with ground truth |
| **Precision** | Reproducibility | Coefficient of variation |
| **Sensitivity** | True positive rate | Correctly identified positive cases |
| **Specificity** | True negative rate | Correctly identified negative cases |
| **Reliability** | Consistency across conditions | Inter-rater reliability |

### 4.3 Deutsch Analytical Validation

**ARPA-H TA1 Metrics:**

| Metric | Phase 1A Target | Phase 1B Target | Test Method |
|--------|-----------------|-----------------|-------------|
| Appropriateness of agentic actions | >85% | >95% | Expert review |
| Appropriateness of triage | >85% | >95% | Case review |
| Serious error rate | <5% | <3% | Safety review |
| FHIR/HL7v2 success ratio | >95% | >97% | Technical testing |
| Data summarization quality | >80% | >85% | Claim recall |
| Error auto-correction | >85% | >90% | Error injection |

### 4.4 Popper Analytical Validation

**ARPA-H TA2 Metrics:**

| Metric | Phase 1A Target | Phase 1B Target | Test Method |
|--------|-----------------|-----------------|-------------|
| Accuracy of clinical agent assessment | >85% | >95% | Clinician adjudication |
| High-quality recommendation recognition | >85% | >95% | Expert panel |
| Hallucination rate quantification | >85% | >95% | Known-answer testing |
| Uncertainty determination | >85% | >95% | Calibration analysis |
| Clinical acuity/risk determination | >90% | >97% | Case review |

### 4.5 Test Dataset Requirements

| Requirement | Description | ADVOCATE Implementation |
|-------------|-------------|------------------------|
| **Representative** | Reflects intended population | TA3 site diversity |
| **Independent** | Separate from training data | IV&V data separation |
| **Labeled** | Ground truth available | Clinician adjudication |
| **Sufficient size** | Statistical power | Power analysis for metrics |

---

## 5. Pillar 3: Clinical Validation

### 5.1 Definition

Clinical validation demonstrates that the SaMD outputs achieve the intended clinical purpose in the intended patient population during clinical care.

### 5.2 Study Design Options

| Design | Strength | Use Case |
|--------|----------|----------|
| **Randomized Controlled Trial** | Highest | Definitive efficacy |
| **Prospective cohort** | High | Real-world effectiveness |
| **Retrospective cohort** | Medium | Supportive evidence |
| **Case-control** | Medium | Rare outcomes |
| **Cross-sectional** | Low | Prevalence, associations |

### 5.3 ADVOCATE Clinical Validation Plan

**Phase 1A: Synthetic Data (Months 0-12)**
- Simulated patients with known outcomes
- Tests non-inferiority vs cardiologist benchmark
- Limited generalizability (development phase)

**Phase 1B: Simulated Patients (Months 12-24)**
- Real users with simulated patient scenarios
- Cardiologist comparison study
- Human factors validation

**Phase 2: Scalability Studies (Months 24-39)**
- Real patients in production environment
- Randomized design: CVD agent vs usual care
- Clinical outcome endpoints

### 5.4 Phase 2 Scalability Study Design

**Study Type:** Multi-site randomized controlled trial

**Population:**
- Adults with heart failure or post-MI
- Enrolled through outpatient clinics or inpatient discharge
- Adequate representation of older adults

**Intervention:**
- CVD agent (Deutsch) + Supervisory agent (Popper)
- Integrated with EHR and clinical workflow

**Control:**
- Usual care (standard clinical management)

**Endpoints:**

| Endpoint Type | Endpoint | Measurement |
|---------------|----------|-------------|
| **Primary** | HF/CVD hospitalizations | Time to first hospitalization |
| **Secondary** | ED/UC visits | Count over study period |
| **Secondary** | CV death | Survival analysis |
| **Safety** | Serious adverse events | Incidence, causality |
| **Process** | Treatment adherence | Prescription fills, monitoring |
| **Experience** | Patient satisfaction | UAT score |

**Sample Size:**
- Powered for non-inferiority on hospitalization endpoint
- Sample size calculation based on expected effect size

---

## 6. Evidence for MDDT Qualification (Popper)

### 6.1 MDDT Evidence Requirements

MDDT qualification requires demonstrating the tool performs reliably within its Context of Use.

**Popper Evidence Package:**

| Evidence Type | Purpose | Source |
|---------------|---------|--------|
| Analytical validation | Popper correctly evaluates Deutsch | Synthetic test cases |
| Clinical correlation | Popper decisions align with clinicians | IV&V adjudication |
| Reproducibility | Consistent results | Regression testing |
| Generalizability | Works across agent types | Multiple TA1 integration |

### 6.2 MDDT-Specific Metrics

| Metric | Target | Evidence Source |
|--------|--------|-----------------|
| Inter-rater reliability (Popper vs clinician) | κ >0.8 | IV&V studies |
| False positive rate (unnecessary routing) | <20% | Phase 2 data |
| False negative rate (missed unsafe) | <5% | Safety monitoring |
| Drift detection sensitivity | >95% | Simulated drift testing |

---

## 7. Comparator Selection

### 7.1 Cardiologist Benchmark

ADVOCATE uses cardiologist performance as the comparator:

**Justification:**
- Represents current standard of care
- Clinically meaningful comparison
- Achievable benchmark (not perfection)

**Comparison Domains:**
- Diagnostic accuracy
- Treatment plan quality
- Contextual awareness
- Empathy/communication
- Clinical reasoning
- Appropriateness of actions

### 7.2 Non-Inferiority Design

**Margin Selection:**
- Based on clinically acceptable difference
- Accounts for statistical uncertainty
- Justified by risk-benefit analysis

**Example:**
- Cardiologist appropriateness: 90%
- Non-inferiority margin: -5%
- Deutsch must achieve: ≥85% (lower bound of 95% CI)

---

## 8. Demographics and Representation

### 8.1 FDA Requirements

Per GMLP Principle 3, datasets must represent the intended patient population:

| Factor | Consideration | ADVOCATE Approach |
|--------|---------------|-------------------|
| **Age** | Older adults adequately represented | Enrollment targets by age |
| **Sex** | Balanced male/female | Stratified enrollment |
| **Race/Ethnicity** | US population representative | TA3 site diversity |
| **Geography** | Urban/rural | Access-gap area inclusion |
| **Comorbidities** | Common CVD comorbidities | Inclusion criteria |

### 8.2 Subgroup Analysis Plan

Pre-specified subgroup analyses for:
- Age groups (<65, 65-75, >75)
- Sex (male, female)
- Race/ethnicity
- Disease severity (NYHA class)
- EHR vendor
- Geographic region

---

## 9. Continuous Clinical Evaluation

### 9.1 Post-Market Evidence Collection

Clinical evaluation is ongoing throughout the device lifecycle:

| Phase | Evidence Type | Purpose |
|-------|---------------|---------|
| Pre-market | IV&V, Scalability Studies | Authorization |
| Launch | Initial real-world data | Confirm performance |
| Post-market | Ongoing monitoring | Detect changes |
| Updates | Re-validation | Confirm after changes |

### 9.2 Post-Market Data Sources

| Source | Data Type | Use |
|--------|-----------|-----|
| Popper audit logs | Performance metrics | Drift detection |
| EHR integration | Patient outcomes | Effectiveness tracking |
| Adverse event reports | Safety signals | Risk identification |
| User feedback | Usability | Interface improvement |

---

## 10. Implementation Checklist

### Scientific Validity

- [ ] Identify clinical associations for each function
- [ ] Conduct literature search
- [ ] Document evidence quality assessment
- [ ] Identify gaps requiring original research
- [ ] Map to clinical guidelines

### Analytical Validation

- [ ] Define performance metrics with targets
- [ ] Create independent test datasets
- [ ] Establish ground truth labeling protocol
- [ ] Conduct validation testing
- [ ] Document results in validation report

### Clinical Validation

- [ ] Design Phase 2 Scalability Study protocol
- [ ] Obtain IRB approval
- [ ] Establish enrollment targets (demographics)
- [ ] Define primary and secondary endpoints
- [ ] Plan statistical analysis

### MDDT Evidence (Popper)

- [ ] Define MDDT-specific metrics
- [ ] Plan clinician adjudication studies
- [ ] Conduct reproducibility testing
- [ ] Document Context of Use validation

---

## 11. References

### FDA Guidance

- [Software as a Medical Device: Clinical Evaluation](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/software-medical-device-samd-clinical-evaluation)
- [Use of Real-World Evidence to Support Regulatory Decision-Making (2025)](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/use-real-world-evidence-support-regulatory-decision-making-medical-devices)
- [Clinical Performance Assessment](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-performance-assessment-considerations-computer-assisted-detection-devices-applied-radiology)

### IMDRF Documents

- [N41: SaMD Clinical Evaluation](https://www.imdrf.org/documents/software-medical-device-samd-clinical-evaluation)
- [N12: SaMD Possible Framework for Risk Categorization](https://www.imdrf.org/documents/software-medical-device-possible-framework-risk-categorization-and-corresponding-considerations)

### ADVOCATE Program

- [ARPA-H ADVOCATE TA1/TA2 Metrics](../A-arpa-program-description.md)
- [IV&V Requirements](../A-arpa-program-description.md)

### Clinical Guidelines

- [AHA/ACC Heart Failure Guidelines](https://www.ahajournals.org/doi/10.1161/CIR.0000000000001063)
- [AHA/ACC Post-MI Secondary Prevention](https://www.ahajournals.org/doi/10.1161/CIR.0000000000001133)

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-24 | ADVOCATE Team | Initial release |
