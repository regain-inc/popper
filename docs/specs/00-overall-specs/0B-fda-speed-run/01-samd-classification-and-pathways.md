# SaMD Classification and Regulatory Pathways

> **Document Version:** 1.0.0
> **Last Updated:** 2026-01-24
> **Applies To:** Deutsch (TA1 - CVD Agent)
> **Related Specs:** `01-deutsch-specs/`, ARPA-H ADVOCATE TA1

---

## 1. Overview

This document provides guidance on Software as a Medical Device (SaMD) classification and FDA submission pathways for the Deutsch CVD Agent (TA1). Proper classification is the foundation of the regulatory strategy and determines:

- Which submission pathway applies (510(k), De Novo, PMA)
- Level of clinical evidence required
- Pre-market documentation requirements
- Post-market surveillance obligations

### Key Determination for Deutsch

Based on the intended use (autonomous prescription management for heart failure and post-MI patients), Deutsch is classified as:

| Attribute | Classification |
|-----------|----------------|
| **FDA Definition** | Software as a Medical Device (SaMD) |
| **IMDRF Category** | **Category III** (Serious condition, Treatment/Diagnosis) |
| **FDA Risk Class** | Class II (likely) |
| **Submission Pathway** | 510(k) with PCCP or De Novo |

---

## 2. Regulatory Framework

### 2.1 What is SaMD?

Per FDA and IMDRF definitions:

> **Software as a Medical Device (SaMD)**: Software intended to be used for one or more medical purposes that perform these purposes without being part of a hardware medical device.

Deutsch qualifies as SaMD because it:
- Is standalone software (not embedded in hardware)
- Performs medical purposes (diagnosis, treatment recommendations, prescription management)
- Processes patient health data to generate clinical outputs

### 2.2 IMDRF Risk Categorization Framework

The International Medical Device Regulators Forum (IMDRF) provides a two-dimensional framework:

#### Dimension 1: State of Healthcare Situation

| State | Definition | Examples |
|-------|------------|----------|
| **Critical** | Life-threatening or requires immediate intervention | Cardiac arrest, stroke |
| **Serious** | Could deteriorate to critical if not addressed | Heart failure, uncontrolled hypertension |
| **Non-serious** | Does not pose immediate health threat | General wellness, minor symptoms |

#### Dimension 2: Significance of Information

| Significance | Definition | Examples |
|--------------|------------|----------|
| **Treat or Diagnose** | Directly informs treatment or provides diagnosis | Prescription changes, diagnostic conclusions |
| **Drive Clinical Management** | Aids in determining treatment direction | Risk scoring, monitoring trends |
| **Inform Clinical Management** | Provides supplementary information | General health information, reminders |

#### IMDRF Category Matrix

| | Treat/Diagnose | Drive Management | Inform Management |
|---|---|---|---|
| **Critical** | IV | III | II |
| **Serious** | **III** | II | I |
| **Non-serious** | II | I | I |

### 2.3 Deutsch Classification Rationale

**State of Healthcare Situation: Serious**
- Heart failure and post-MI are serious chronic conditions
- Untreated or improperly treated, they can progress to critical
- ADVOCATE targets patients requiring ongoing management

**Significance of Information: Treat or Diagnose**
- Deutsch autonomously manages prescriptions (treatment)
- Generates differential diagnoses
- Makes treatment recommendations

**Result: IMDRF Category III**

This places Deutsch in the higher-risk tier requiring robust clinical evidence.

---

## 3. FDA Submission Pathways

### 3.1 Pathway Options

| Pathway | Criteria | Timeline | Evidence Level |
|---------|----------|----------|----------------|
| **510(k)** | Substantial equivalence to predicate | 3-6 months | Moderate |
| **De Novo** | Novel, low-moderate risk, no predicate | 6-12 months | Moderate-High |
| **PMA** | High-risk, Class III | 12-24 months | Extensive clinical trials |

### 3.2 510(k) Pathway

**When to Use:**
A 510(k) is appropriate if a substantially equivalent predicate device exists.

**Predicate Device Requirements:**
- Same intended use
- Same technological characteristics, OR
- Different technology but same intended use with no new safety/effectiveness questions

**Potential Predicates for Deutsch:**
Based on FDA's AI/ML authorized device database:

| Device | Manufacturer | 510(k) # | Indication |
|--------|--------------|----------|------------|
| Tempus ECG-Low EF | Tempus | K232XXX | Heart failure detection from ECG |
| Viz.ai Cardio | Viz.ai | K201XXX | Cardiovascular care coordination |
| Eko AFIB Detection | Eko Health | K200XXX | AFib detection and monitoring |

**Considerations for Deutsch:**
- Autonomous prescription authority may exceed predicate scope
- Multi-modal input (EHR, wearables, voice) may differ technologically
- Consider partial predicate strategy (different predicates for different functions)

### 3.3 De Novo Pathway

**When to Use:**
De Novo is appropriate when:
- No legally marketed predicate exists
- Device presents low-to-moderate risk
- General and special controls can mitigate risks

**De Novo Benefits:**
- Creates new device classification
- Establishes predicate for future devices
- May be faster than PMA for novel devices

**De Novo Requirements:**
1. Risk-based classification request
2. Proposed special controls
3. Performance data demonstrating safety/effectiveness
4. Proposed labeling

**Recommended for Deutsch if:**
- Autonomous prescription management lacks suitable predicate
- Novel agentic architecture requires new classification

### 3.4 Breakthrough Device Designation

**Eligibility Criteria:**
1. Provides more effective treatment/diagnosis of life-threatening or irreversibly debilitating disease
2. Represents breakthrough technology, OR
3. No approved alternatives exist, OR
4. Offers significant advantages over existing alternatives

**Benefits:**
- Prioritized FDA review
- Interactive communication during review
- Senior FDA involvement
- Flexible clinical study design

**Application for Deutsch:**
Deutsch may qualify based on:
- Novel autonomous agentic architecture
- Addresses cardiology access gaps (49% of US counties lack cardiologists)
- Potential to significantly improve HF management outcomes

**Application Process:**
1. Submit BDD Request with intended use, regulatory pathway, and breakthrough justification
2. FDA responds within 60 days
3. If granted, establish pre-submission communication plan

---

## 4. Relevance to Clinical Agents

### 4.1 Deutsch (TA1) Application

**Intended Use Statement (Draft):**

> The Deutsch CVD Agent is a software-based clinical decision support system intended to provide autonomous and semi-autonomous cardiovascular care management for adult patients with heart failure or post-myocardial infarction, under the supervision of a healthcare provider. The device analyzes patient data from electronic health records, wearable devices, and patient-reported inputs to:
>
> 1. Generate differential diagnoses and treatment recommendations
> 2. Autonomously adjust medications for hypertension, hyperlipidemia, heart failure, and atrial fibrillation within clinician-approved protocols
> 3. Provide care navigation and health coaching
> 4. Triage and escalate urgent findings to the clinical team
>
> The device operates in conjunction with the Popper Supervisory Agent for continuous safety monitoring.

**Classification Implications:**

| Function | Risk Level | Classification Impact |
|----------|------------|----------------------|
| Autonomous prescriptions | High | Drives Category III classification |
| Treatment recommendations | High | Requires clinical validation |
| Care navigation | Low-Moderate | May be exempt under enforcement discretion |
| Health coaching | Low | Wellness function, not device |

### 4.2 Mode-Based Classification

Deutsch operates in two modes with different regulatory implications:

| Mode | Regulated? | Evidence Required |
|------|------------|-------------------|
| `advocate_clinical` | Yes - SaMD | Full 510(k)/De Novo package |
| `wellness` | Enforcement discretion | Minimal (general wellness) |

**Spec Reference:** `01-deutsch-system-spec.md` §2.1, `02-hermes-contracts.md` §2.3

### 4.3 Popper Integration Impact

The Deutsch-Popper architecture provides regulatory advantages:

1. **Separation of Concerns**: Independent safety monitoring (Popper) reduces single-point-of-failure risk
2. **Audit Trail**: Hermes protocol ensures traceable decision documentation
3. **Fail-Safe Design**: Popper's default-to-safe behavior mitigates risk

**Spec Reference:** `01-popper-system-spec.md` §2.1 (Independence)

---

## 5. Pre-Submission (Q-Sub) Preparation

### 5.1 Q-Sub Overview

A Pre-Submission (Q-Sub) is a formal FDA meeting request to obtain feedback before a marketing submission.

**Types of Pre-Submissions:**

| Type | Purpose | Format |
|------|---------|--------|
| **Pre-Sub** | General feedback on any regulatory question | Written or meeting |
| **Informational** | Share information without feedback request | Written |
| **Study Risk Determination** | IDE requirement determination | Written or meeting |

### 5.2 Recommended Q-Sub Topics for Deutsch

1. **Classification Confirmation**
   - Is 510(k) or De Novo appropriate?
   - Which predicates (if any) are acceptable?

2. **Intended Use Boundaries**
   - Scope of autonomous functions
   - Distinction between device and non-device functions

3. **Clinical Evidence Strategy**
   - Non-inferiority study design (vs. cardiologist)
   - Acceptance criteria for IV&V studies
   - Real-world evidence considerations

4. **PCCP Approach**
   - Algorithm update categories
   - Re-validation requirements for model changes

5. **Supervisory Agent (Popper) Integration**
   - Does Popper affect Deutsch classification?
   - Can Popper's MDDT qualification streamline Deutsch review?

### 5.3 Q-Sub Timeline

| Milestone | Timeline | Notes |
|-----------|----------|-------|
| Draft Q-Sub Package | Month 1-2 | Include all questions + supporting info |
| Submit to FDA | Month 3 | 60 days before desired meeting |
| FDA Preliminary Response | ~30 days | Written feedback on questions |
| Q-Sub Meeting | Month 5-6 | If requested |
| Final Meeting Minutes | 30 days post-meeting | Document agreement points |

---

## 6. Implementation Checklist

### Pre-Submission Phase

- [ ] Draft intended use statement
- [ ] Complete IMDRF classification analysis
- [ ] Identify potential predicate devices
- [ ] Document technological comparison (same/different)
- [ ] Prepare Q-Sub question list
- [ ] Submit Q-Sub package (60 days before desired meeting)

### Submission Preparation

- [ ] Establish Design History File (DHF) structure
- [ ] Document software development lifecycle (IEC 62304)
- [ ] Complete risk analysis (ISO 14971)
- [ ] Prepare software documentation per FDA guidance
- [ ] Generate clinical performance data (IV&V studies)
- [ ] Develop labeling and Instructions for Use (IFU)
- [ ] Prepare PCCP for algorithm updates

### Breakthrough Device (Optional)

- [ ] Assess BDD eligibility criteria
- [ ] Draft BDD request justification
- [ ] Submit BDD request
- [ ] Establish interactive review plan with FDA

---

## 7. References

### FDA Guidance Documents

- [Software as a Medical Device (SaMD)](https://www.fda.gov/medical-devices/digital-health-center-excellence/software-medical-device-samd)
- [De Novo Classification Process](https://www.fda.gov/medical-devices/premarket-submissions-selecting-and-preparing-correct-submission/de-novo-classification-request)
- [The 510(k) Program: Evaluating Substantial Equivalence](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/510k-program-evaluating-substantial-equivalence-premarket-notifications-510k)
- [Breakthrough Devices Program](https://www.fda.gov/medical-devices/how-study-and-market-your-device/breakthrough-devices-program)
- [Requests for Feedback and Meetings for Medical Device Submissions](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/requests-feedback-and-meetings-medical-device-submissions-q-submission-program)
- [Clinical Decision Support Software](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software)

### IMDRF Documents

- [N12: SaMD Possible Framework for Risk Categorization](https://www.imdrf.org/documents/software-medical-device-possible-framework-risk-categorization-and-corresponding-considerations)
- [N23: SaMD Application of Quality Management System](https://www.imdrf.org/documents/software-medical-device-samd-application-quality-management-system)

### FDA AI/ML Resources

- [Artificial Intelligence and Machine Learning in Software as a Medical Device](https://www.fda.gov/medical-devices/software-medical-device-samd/artificial-intelligence-and-machine-learning-software-medical-device)
- [Artificial Intelligence and Machine Learning (AI/ML)-Enabled Medical Devices](https://www.fda.gov/medical-devices/software-medical-device-samd/artificial-intelligence-and-machine-learning-aiml-enabled-medical-devices)

### Regulations

- [21 CFR Part 807 Subpart E - Premarket Notification Procedures](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-807/subpart-E)
- [21 CFR Part 860 - Medical Device Classification Procedures](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-860)

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-24 | ADVOCATE Team | Initial release |
