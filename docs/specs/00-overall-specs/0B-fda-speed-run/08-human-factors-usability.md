# Human Factors and Usability Engineering

> **Document Version:** 1.0.0
> **Last Updated:** 2026-01-24
> **Applies To:** Deutsch (TA1), Popper (TA2 - Clinician Interface)
> **Related Specs:** TA3 UI/UX Testing Requirements

---

## 1. Overview

Human factors engineering (HFE) and usability engineering are critical for the ADVOCATE clinical agent system. FDA expects medical device manufacturers to apply HFE principles to minimize use errors that could cause patient harm. This document provides guidance based on FDA's HFE guidance and IEC 62366-1:2015.

### Key Users

| User Group | Interface | Critical Tasks |
|------------|-----------|----------------|
| **Patients** | Deutsch mobile/web | Report symptoms, follow recommendations, acknowledge alerts |
| **Clinicians** | Deutsch/Popper dashboard | Review escalations, approve actions, monitor performance |
| **Safety Operators** | Popper admin | Trigger safe-mode, review incidents, manage policies |

---

## 2. Regulatory Framework

### 2.1 FDA Human Factors Guidance

FDA's 2016 guidance "Applying Human Factors and Usability Engineering to Medical Devices" establishes:

- HFE process requirements
- Critical task identification
- Formative and summative evaluations
- Documentation requirements

### 2.2 IEC 62366-1:2015 Alignment

| FDA Term | IEC 62366 Term | Definition |
|----------|---------------|------------|
| Human factors engineering | Usability engineering | Process to minimize use errors |
| Critical task | Hazard-related use scenario | Task that could cause harm if performed incorrectly |
| Summative evaluation | Summative evaluation | Final validation testing |
| Formative evaluation | Formative evaluation | Iterative design testing |

### 2.3 Risk Hierarchy for Use Errors

FDA follows ISO 14971 hierarchy for use-related risk control:

1. **Eliminate** - Design out the hazard
2. **Reduce** - Make error less likely through design
3. **Protect** - Add barriers, interlocks, warnings
4. **Inform** - Instructions, training, labeling

---

## 3. Critical Task Identification

### 3.1 Definition

> **Critical Task**: A user task which, if performed incorrectly or not performed at all, would or could cause serious harm to the patient or user.

### 3.2 Deutsch Critical Tasks (Patient Interface)

| Task ID | Critical Task | Potential Harm | Use Error Risk |
|---------|---------------|----------------|----------------|
| DPT-001 | Report acute symptoms | Delayed emergency care | Under-reporting severity |
| DPT-002 | Confirm medication changes | Wrong dose taken | Misunderstanding instructions |
| DPT-003 | Respond to urgent alerts | Delayed care escalation | Alert ignored/missed |
| DPT-004 | Provide health data inputs | Wrong treatment decisions | Inaccurate data entry |
| DPT-005 | Acknowledge treatment plan | Non-adherence | Misunderstanding plan |

### 3.3 Deutsch Critical Tasks (Clinician Interface)

| Task ID | Critical Task | Potential Harm | Use Error Risk |
|---------|---------------|----------------|----------------|
| DCT-001 | Review patient escalations | Missed urgent findings | Overloaded dashboard |
| DCT-002 | Approve/modify prescriptions | Medication errors | Rushed review |
| DCT-003 | Override Deutsch recommendations | Inappropriate override | Automation bias |
| DCT-004 | Configure patient protocols | Wrong treatment boundaries | Configuration errors |

### 3.4 Popper Critical Tasks (Safety Operator)

| Task ID | Critical Task | Potential Harm | Use Error Risk |
|---------|---------------|----------------|----------------|
| POT-001 | Trigger safe-mode | Agent continues unsafe | Delayed activation |
| POT-002 | Review incident reports | Missed safety signals | Alert fatigue |
| POT-003 | Update policy configurations | Systematic safety gaps | Config errors |
| POT-004 | Generate regulatory exports | Incomplete evidence | Missing data |

---

## 4. Use-Related Risk Analysis

### 4.1 Use Error Categories

| Category | Description | Example |
|----------|-------------|---------|
| **Perception error** | User doesn't notice information | Missed alert |
| **Cognition error** | User misunderstands information | Misread dosage |
| **Action error** | User performs wrong action | Tap wrong button |
| **Memory error** | User forgets to perform task | Forget to log data |

### 4.2 Risk Analysis Matrix

| Task | Error Type | Likelihood | Severity | Risk Level | Mitigation |
|------|------------|------------|----------|------------|------------|
| DPT-001 | Perception | Medium | Critical | High | Multi-modal alerts |
| DPT-002 | Cognition | Medium | Serious | Medium | Plain language, confirmation |
| DCT-001 | Perception | High | Serious | High | Priority ordering, color coding |
| POT-001 | Action | Low | Critical | Medium | Confirmation dialog |

---

## 5. Formative Evaluations

### 5.1 Purpose

Formative evaluations are iterative tests during design to identify and correct usability issues.

### 5.2 Methods

| Method | When to Use | ADVOCATE Application |
|--------|-------------|---------------------|
| **Heuristic evaluation** | Early design | Expert review of wireframes |
| **Cognitive walkthrough** | Prototype stage | Task-based design review |
| **Usability testing** | Functional prototype | User testing with scenarios |
| **Think-aloud protocol** | Any stage | Observe user reasoning |

### 5.3 ADVOCATE Formative Plan

**Phase 1A Formative Evaluations:**
- Wireframe heuristic review (Month 2-3)
- Prototype usability testing (Month 4-6)
- Alpha testing with TA3 clinicians (Month 6-9)

**Phase 1B Formative Evaluations:**
- Beta testing with expanded user groups (Month 12-18)
- Iterative refinement based on feedback

**TA3 Integration:**
- UI/UX testing with clinicians at TA3 sites
- Patient interface testing with representative users

---

## 6. Summative Evaluation (Validation)

### 6.1 Purpose

Summative evaluation provides objective evidence that the final device design meets usability requirements and that residual use-related risks are acceptable.

### 6.2 Study Design

**Participants:**
- Representative of intended user populations
- Minimum 15 participants per user group (FDA recommendation)
- Include range of experience levels

**Tasks:**
- All critical tasks identified in §3
- Realistic use scenarios
- Appropriate task complexity

**Environment:**
- Simulated clinical/home environment
- Production or near-production software
- Realistic time pressure and distractions

### 6.3 Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Task completion** | >95% for critical tasks | Binary success/fail |
| **Use errors** | 0 use errors causing harm | Error counting |
| **Close calls** | <5% of attempts | Near-miss counting |
| **Time on task** | Within acceptable range | Time measurement |
| **User satisfaction** | UAT score >85 (1A), >95 (1B) | Questionnaire |

### 6.4 ARPA-H UAT Alignment

| Metric | Phase 1A Target | Phase 1B Target |
|--------|-----------------|-----------------|
| Patient UAT score | >85 | >95 |
| Clinician UAT score | >80 | >90 |
| Preference adaptation | >90% | >95% |

---

## 7. Design Principles for ADVOCATE

### 7.1 Patient Interface Design

| Principle | Implementation |
|-----------|---------------|
| **Plain language** | 6th-grade reading level for instructions |
| **Multi-modal alerts** | Visual + audio + haptic for urgent |
| **Progressive disclosure** | Show essential info first, details on demand |
| **Confirmation** | Require acknowledgment for critical actions |
| **Error prevention** | Constrain inputs, validate data |
| **Accessibility** | WCAG 2.1 AA compliance |

### 7.2 Clinician Interface Design

| Principle | Implementation |
|-----------|---------------|
| **Priority display** | Urgent items at top, color-coded |
| **Context preservation** | Full patient context with escalation |
| **Efficient workflow** | Minimal clicks for common actions |
| **Audit visibility** | Clear trail of agent decisions |
| **Override documentation** | Required reason for overrides |
| **Customization** | Configurable dashboards |

### 7.3 Safety Operator Interface Design

| Principle | Implementation |
|-----------|---------------|
| **System health visibility** | Real-time status indicators |
| **Threshold monitoring** | Clear visualization of triggers |
| **Action confirmation** | Two-step for safe-mode activation |
| **Incident workflow** | Guided resolution process |
| **Export simplicity** | One-click regulatory export |

---

## 8. Labeling and Training

### 8.1 Instructions for Use (IFU)

**Required Content:**
- Intended use and users
- Contraindications
- Warnings and precautions
- Operating instructions
- Troubleshooting
- Maintenance requirements

### 8.2 Training Requirements

| User Group | Training Type | Content |
|------------|---------------|---------|
| **Patients** | In-app onboarding | Basic usage, when to escalate |
| **Clinicians** | Formal training | Full functionality, clinical protocols |
| **Safety operators** | Comprehensive training | All features, incident response |

### 8.3 Competency Verification

- Training completion tracking
- Competency assessments before use
- Periodic refresher requirements

---

## 9. Documentation Requirements

### 9.1 HFE/UE Report

FDA expects an HFE Report in premarket submissions covering:

| Section | Content |
|---------|---------|
| Device description | User interface overview |
| User populations | Characteristics, experience levels |
| Use environments | Where device will be used |
| Critical tasks | Task identification and analysis |
| Use-related risk analysis | Hazards and mitigations |
| Formative evaluation summary | Methods, findings, changes made |
| Summative evaluation | Study design, results, conclusions |
| Residual use risks | Remaining risks and justification |

### 9.2 Usability Engineering File

Maintain throughout development:
- User requirements
- Use specifications
- Design rationale
- Evaluation protocols and reports
- Training materials
- Labeling

---

## 10. Implementation Checklist

### User Analysis

- [ ] Identify all user groups
- [ ] Document user characteristics
- [ ] Define use environments
- [ ] Assess user experience levels

### Critical Task Analysis

- [ ] Identify all user tasks
- [ ] Classify critical vs non-critical
- [ ] Analyze use error potential
- [ ] Prioritize risk mitigation

### Formative Evaluations

- [ ] Plan evaluation schedule
- [ ] Conduct heuristic evaluation
- [ ] Perform usability testing
- [ ] Document findings and changes
- [ ] Iterate design based on feedback

### Summative Evaluation

- [ ] Design validation study
- [ ] Recruit representative participants
- [ ] Conduct summative testing
- [ ] Analyze results vs criteria
- [ ] Document residual use risks

### Documentation

- [ ] Maintain usability engineering file
- [ ] Prepare HFE Report for submission
- [ ] Develop training materials
- [ ] Create Instructions for Use

---

## 11. References

### FDA Guidance

- [Applying Human Factors and Usability Engineering to Medical Devices (2016)](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/applying-human-factors-and-usability-engineering-medical-devices)
- [Human Factors Studies and Related Clinical Study Considerations](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/human-factors-studies-and-related-clinical-study-considerations)

### Standards

- [IEC 62366-1:2015+AMD1:2020 Usability engineering](https://www.iso.org/standard/63179.html)
- [ISO 14971:2019 Risk management](https://www.iso.org/standard/72704.html)
- [WCAG 2.1 Accessibility Guidelines](https://www.w3.org/WAI/standards-guidelines/wcag/)

### ADVOCATE Program

- [ARPA-H ADVOCATE TA1/TA3 UI/UX Requirements](../A-arpa-program-description.md)
- [TA1 UAT Metrics](../A-arpa-program-description.md)

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-24 | ADVOCATE Team | Initial release |
