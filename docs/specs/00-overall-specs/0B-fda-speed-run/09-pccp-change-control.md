# Predetermined Change Control Plans (PCCP)

> **Document Version:** 1.0.0
> **Last Updated:** 2026-01-24
> **Applies To:** Deutsch (TA1), Popper (TA2)
> **Related Specs:** GMLP Principle 10, Algorithm Updates

---

## 1. Overview

A Predetermined Change Control Plan (PCCP) enables manufacturers to make pre-specified modifications to AI/ML-enabled medical devices without submitting a new premarket application for each change. FDA's December 2024 final guidance establishes the framework for PCCPs.

### Strategic Value

| Benefit | Description |
|---------|-------------|
| **Agility** | Faster algorithm improvements without full review |
| **Continuous learning** | Enable model updates from real-world data |
| **Competitive advantage** | Rapid iteration on AI performance |
| **Regulatory efficiency** | Reduced submission burden |

### PCCP Applicability

| Component | PCCP Needed? | Rationale |
|-----------|--------------|-----------|
| **Deutsch** | Yes | Algorithm updates, model retraining |
| **Popper** | Possibly | Policy pack updates (if SaMD) |
| **Hermes** | No | Protocol changes require versioning |

---

## 2. Regulatory Framework

### 2.1 PCCP Definition

Per FDA guidance:

> A **Predetermined Change Control Plan (PCCP)** describes the specific modifications a manufacturer plans to make to a device, as well as the methodology the manufacturer will use to implement and control those modifications while maintaining assurance of the device's safety and effectiveness.

### 2.2 PCCP Components

| Component | Description | Requirement |
|-----------|-------------|-------------|
| **Description of Modifications (DOM)** | Types of changes covered | Required |
| **Modification Protocol (MP)** | How changes will be developed and tested | Required |
| **Impact Assessment (IA)** | Evaluation of change effects | Required |

### 2.3 Guiding Principles

FDA/HC/MHRA PCCP Guiding Principles (2023):

1. **Focused changes** - Limited to clearly defined modifications
2. **Transparent documentation** - Clear plans before marketing
3. **Risk management** - Controls maintained throughout
4. **Performance monitoring** - Ongoing evaluation post-change
5. **Update communication** - Users informed of changes

---

## 3. Description of Modifications (DOM)

### 3.1 Modification Categories

| Category | Examples | ADVOCATE Application |
|----------|----------|---------------------|
| **Training data** | New EHR data, expanded demographics | Deutsch model retraining |
| **Model architecture** | Layer adjustments, attention mechanisms | Deutsch LLM fine-tuning |
| **Performance optimization** | Improved accuracy, reduced latency | Both agents |
| **Input processing** | New data sources, feature extraction | Wearable integration |
| **Output formatting** | Improved explanations, new report formats | Disclosure bundle |

### 3.2 Deutsch DOM Specification

**Covered Modifications:**

| Modification ID | Description | Scope Boundaries |
|-----------------|-------------|------------------|
| D-MOD-001 | Model retraining with additional CVD data | Same intended use, population |
| D-MOD-002 | Fine-tuning for improved diagnostic accuracy | Within specified metrics |
| D-MOD-003 | Performance optimization (latency, cost) | No functional changes |
| D-MOD-004 | New wearable data integration | Validated data types only |
| D-MOD-005 | Improved natural language generation | Same clinical content |

**Excluded Modifications (require new submission):**

- Changes to intended use or indications
- New clinical functions (e.g., new disease area)
- Significant changes to safety-critical algorithms
- Changes that could reduce effectiveness below thresholds

### 3.3 Popper DOM Specification (If Applicable)

| Modification ID | Description | Scope Boundaries |
|-----------------|-------------|------------------|
| P-MOD-001 | Policy pack updates for new guidelines | Same safety framework |
| P-MOD-002 | Threshold adjustments based on data | Within pre-specified ranges |
| P-MOD-003 | New reason codes | Compatible with existing taxonomy |

---

## 4. Modification Protocol (MP)

### 4.1 Development Practices

| Practice | Requirement | Implementation |
|----------|-------------|----------------|
| **Data management** | Quality controls for training data | Data validation pipeline |
| **Model development** | Reproducible training process | Version-controlled configs |
| **Testing** | Comprehensive evaluation | Automated test suites |
| **Documentation** | Change records | Git + artifact tracking |

### 4.2 Re-training Practices

**Data Quality Requirements:**

| Aspect | Requirement | Verification |
|--------|-------------|--------------|
| **Representativeness** | Matches intended population | Demographic analysis |
| **Labeling** | Consistent ground truth | Inter-rater reliability |
| **Independence** | Separate from test data | Data split verification |
| **Completeness** | No critical gaps | Coverage analysis |

**Model Training Controls:**

| Control | Description |
|---------|-------------|
| Reproducibility | Fixed random seeds, versioned dependencies |
| Hyperparameters | Document all training parameters |
| Checkpointing | Save model states for rollback |
| Validation | Hold-out set performance tracking |

### 4.3 Performance Evaluation

**Evaluation Requirements:**

| Metric Category | Metrics | Acceptance Criteria |
|-----------------|---------|---------------------|
| **Effectiveness** | Accuracy, sensitivity, specificity | ≥ baseline |
| **Safety** | Error rates, missed escalations | ≤ baseline |
| **Performance** | Latency, throughput | Within spec |
| **Subgroup** | Demographic subgroup performance | No degradation |

**Study Design:**

| Study Type | When Required | Sample Size |
|------------|---------------|-------------|
| **Retrospective** | All changes | Powered for metrics |
| **Prospective** | Major changes | Pre-specified |
| **Real-world** | Post-deployment monitoring | Continuous |

---

## 5. Impact Assessment (IA)

### 5.1 Safety Impact Analysis

For each modification, assess:

| Impact Area | Assessment Questions |
|-------------|---------------------|
| **Intended use** | Does modification affect intended use? |
| **Risk profile** | Are new risks introduced? |
| **Effectiveness** | Could effectiveness be reduced? |
| **User experience** | Are workflows affected? |
| **Interoperability** | Are integrations affected? |

### 5.2 Risk-Benefit Analysis

| Change Category | Potential Benefit | Potential Risk | Mitigation |
|-----------------|-------------------|----------------|------------|
| Training data expansion | Improved generalization | Performance variability | Subgroup testing |
| Model fine-tuning | Better accuracy | Unexpected behaviors | Regression testing |
| Threshold adjustment | Optimized sensitivity | Changed specificity | Trade-off analysis |

### 5.3 Decision Matrix

| Impact Assessment Result | Action |
|--------------------------|--------|
| No impact on safety/effectiveness | Proceed under PCCP |
| Minor impact with mitigation | Proceed with additional controls |
| Significant impact | Evaluate if within PCCP scope |
| Outside PCCP scope | New submission required |

---

## 6. Update Procedures

### 6.1 Deployment Process

| Step | Activity | Verification |
|------|----------|--------------|
| 1 | Change development | Code review |
| 2 | Testing per MP | Test reports |
| 3 | Impact assessment | IA documentation |
| 4 | Approval | Sign-off record |
| 5 | Staged deployment | Canary release |
| 6 | Monitoring | Performance dashboards |
| 7 | Full rollout | Go/no-go decision |

### 6.2 Rollback Criteria

**Automatic Rollback Triggers:**

| Trigger | Threshold | Action |
|---------|-----------|--------|
| Error rate spike | >2x baseline | Immediate rollback |
| Latency degradation | >3s response | Staged rollback |
| User complaints | >5 safety-related | Investigation + possible rollback |
| Popper escalation rate | >2x baseline | Investigation |

### 6.3 User Communication

**Required Notifications:**

| Audience | Timing | Content |
|----------|--------|---------|
| Clinicians | Before deployment | Change summary, impact |
| Patients | As appropriate | Relevant updates |
| FDA | Per PCCP requirements | Periodic reporting |

---

## 7. Real-World Performance Monitoring

### 7.1 Monitoring Requirements

| Metric Category | Metrics | Frequency |
|-----------------|---------|-----------|
| **Effectiveness** | Diagnostic accuracy, treatment appropriateness | Continuous |
| **Safety** | Error rates, escalation patterns | Continuous |
| **Drift** | Performance trend over time | Weekly analysis |
| **Subgroup** | Demographic performance | Monthly analysis |

### 7.2 Popper Integration

Popper provides real-world monitoring infrastructure:

| Monitoring Function | Popper Implementation |
|--------------------|-----------------------|
| Accuracy tracking | Quality signals |
| Drift detection | Hard-stop analysis triggers |
| Anomaly detection | Validation failure spikes |
| Trend analysis | Audit event aggregation |

### 7.3 Feedback Loop

```
Real-world Data → Performance Analysis → Modification Need Identified
       ↓                                              ↓
   Popper Monitoring                         PCCP Modification Process
       ↓                                              ↓
   Export Bundles                           Testing + Validation
       ↓                                              ↓
   Incident Triage ←←←←←← Rollback if needed ←←←← Deployment
```

---

## 8. Documentation Requirements

### 8.1 PCCP Submission Content

| Section | Content |
|---------|---------|
| **Description of Modifications** | All covered changes with boundaries |
| **Modification Protocol** | Development, testing, validation procedures |
| **Impact Assessment** | Risk-benefit analysis framework |
| **Update Procedures** | Deployment, monitoring, rollback |
| **Performance Metrics** | Acceptance criteria and thresholds |
| **Communication Plan** | User notification procedures |

### 8.2 Post-Deployment Records

| Record Type | Content | Retention |
|-------------|---------|-----------|
| Change log | All modifications made | Permanent |
| Test reports | Validation results | 5+ years |
| Impact assessments | Per-change analysis | 5+ years |
| Performance data | Real-world metrics | Ongoing |
| Incident reports | Any issues encountered | Permanent |

---

## 9. Implementation Checklist

### PCCP Development

- [ ] Identify modification categories for DOM
- [ ] Define scope boundaries for each category
- [ ] Document modification protocol
- [ ] Establish acceptance criteria
- [ ] Create impact assessment framework

### Pre-Submission

- [ ] Draft PCCP document
- [ ] Include in premarket submission
- [ ] Address FDA feedback
- [ ] Finalize approved PCCP

### Operational Readiness

- [ ] Implement testing pipeline
- [ ] Set up performance monitoring (Popper)
- [ ] Establish rollback procedures
- [ ] Create user communication templates
- [ ] Train team on PCCP processes

### Ongoing Compliance

- [ ] Maintain change records
- [ ] Document all modifications
- [ ] Conduct periodic PCCP review
- [ ] Report to FDA per requirements

---

## 10. References

### FDA Guidance

- [Marketing Submission Recommendations for PCCP (Dec 2024)](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/marketing-submission-recommendations-predetermined-change-control-plan-artificial-intelligence)
- [PCCP Guiding Principles (2023)](https://www.fda.gov/medical-devices/software-medical-device-samd/predetermined-change-control-plans-machine-learning-enabled-medical-devices-guiding-principles)
- [AI-Enabled Device Software Functions Lifecycle (Jan 2025)](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/artificial-intelligence-enabled-device-software-functions-lifecycle-management-and-marketing)

### Standards

- ISO 14971:2019 - Risk management
- IEC 62304:2015 - Software lifecycle

### ADVOCATE Specs

- [Popper System Spec](../../02-popper-specs/01-popper-system-spec.md)
- [GMLP Principles](./04-gmlp-ai-ml-principles.md)
- [Post-Market Surveillance](./10-post-market-surveillance.md)

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-24 | ADVOCATE Team | Initial release |
