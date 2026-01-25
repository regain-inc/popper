# ISO 14971 Risk Management for Medical Devices

> **Document Version:** 1.0.0
> **Last Updated:** 2026-01-24
> **Applies To:** Deutsch (TA1), Popper (TA2), Hermes Protocol
> **Related Specs:** All clinical agent specifications

---

## 1. Overview

ISO 14971:2019 defines the international standard for risk management in medical devices. FDA expects compliance with this standard for all medical device submissions, including SaMD. This document provides guidance on applying ISO 14971 to the ADVOCATE clinical agent system.

### Risk Management Framework

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ISO 14971 Risk Management Process                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐               │
│  │   Risk      │   │   Risk      │   │   Risk      │               │
│  │  Analysis   │──►│ Evaluation  │──►│  Control    │               │
│  └─────────────┘   └─────────────┘   └──────┬──────┘               │
│         │                                    │                       │
│         │                                    ▼                       │
│         │              ┌─────────────────────────────┐              │
│         │              │ Overall Residual Risk       │              │
│         │              │ Acceptability               │              │
│         │              └─────────────────────────────┘              │
│         │                          │                                 │
│         │                          ▼                                 │
│         │              ┌─────────────────────────────┐              │
│         │              │ Production & Post-Production│              │
│         └─────────────►│ Information                 │              │
│                        └─────────────────────────────┘              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Regulatory Framework

### 2.1 ISO 14971:2019 Scope

ISO 14971 applies to:
- Identification of hazards associated with medical devices
- Estimation and evaluation of associated risks
- Control of risks and monitoring effectiveness
- All lifecycle phases (design through post-market)

### 2.2 FDA Requirements

FDA recognizes ISO 14971:2019 and requires:
- Risk analysis in premarket submissions
- Risk-benefit analysis for device approval
- Post-market risk monitoring

### 2.3 Integration with Other Standards

| Standard | Integration Point |
|----------|-------------------|
| IEC 62304 | Risk-derived software requirements |
| IEC 62366 | Use-related risk analysis |
| ISO 13485 | QMS risk management requirements |
| IEC 81001-5-1 | Cybersecurity risk |

---

## 3. Risk Analysis for Clinical Agents

### 3.1 Hazard Identification

**AI/ML-Specific Hazards:**

| Hazard Category | Examples | ADVOCATE Relevance |
|-----------------|----------|-------------------|
| **Incorrect Output** | Wrong diagnosis, inappropriate prescription | Deutsch clinical decisions |
| **Delayed Output** | Latency causing missed urgent conditions | Response time requirements |
| **Omission** | Failure to escalate critical findings | Triage failures |
| **Incorrect Timing** | Prescription at wrong interval | Medication management |
| **Use Error** | Misinterpretation of recommendations | Patient/clinician interface |
| **Cybersecurity** | Data breach, system compromise | Hermes communication |
| **Algorithmic Drift** | Performance degradation over time | Model maintenance |
| **Bias** | Underperformance in subpopulations | Training data limitations |

### 3.2 Hazard Analysis for Deutsch

| Hazard ID | Hazard | Potential Harm | Severity | Probability | Risk Level |
|-----------|--------|----------------|----------|-------------|------------|
| D-001 | Incorrect medication dose | Drug toxicity, ADE | Serious | Occasional | High |
| D-002 | Missed contraindication | Adverse drug reaction | Serious | Occasional | High |
| D-003 | Delayed escalation | Delayed treatment of acute event | Critical | Remote | High |
| D-004 | Wrong diagnosis | Inappropriate treatment | Serious | Occasional | High |
| D-005 | Inappropriate reassurance | Delayed care seeking | Moderate | Occasional | Medium |
| D-006 | Hallucinated recommendation | Patient confusion, harm | Serious | Remote | Medium |
| D-007 | Latency in response | Missed urgent symptom | Moderate | Remote | Low |
| D-008 | System unavailability | Care gaps | Moderate | Occasional | Medium |

### 3.3 Hazard Analysis for Popper

| Hazard ID | Hazard | Potential Harm | Severity | Probability | Risk Level |
|-----------|--------|----------------|----------|-------------|------------|
| P-001 | Failure to detect unsafe output | Patient harm from Deutsch | Serious | Remote | Medium |
| P-002 | False positive (excessive routing) | Alert fatigue, delayed care | Moderate | Occasional | Medium |
| P-003 | Latency in supervision | Unsafe action proceeds | Serious | Remote | Medium |
| P-004 | Policy misconfiguration | Systematic safety gaps | Serious | Remote | Medium |
| P-005 | Communication failure | Deutsch operates unsupervised | Serious | Remote | Medium |

### 3.4 Hazard Analysis for Hermes

| Hazard ID | Hazard | Potential Harm | Severity | Probability | Risk Level |
|-----------|--------|----------------|----------|-------------|------------|
| H-001 | Message integrity failure | Corrupted clinical data | Serious | Remote | Medium |
| H-002 | Authentication bypass | Unauthorized access | Serious | Remote | Medium |
| H-003 | Replay attack | Duplicate actions | Moderate | Remote | Low |
| H-004 | Clock skew | Incorrect decision timing | Moderate | Occasional | Low |
| H-005 | Schema validation failure | System crash | Moderate | Occasional | Medium |

---

## 4. Risk Evaluation

### 4.1 Risk Acceptability Matrix

| Severity | Negligible | Marginal | Serious | Critical | Catastrophic |
|----------|------------|----------|---------|----------|--------------|
| **Frequent** | Low | Medium | High | Unacceptable | Unacceptable |
| **Probable** | Low | Medium | High | Unacceptable | Unacceptable |
| **Occasional** | Low | Medium | **High** | High | Unacceptable |
| **Remote** | Low | Low | **Medium** | High | High |
| **Improbable** | Low | Low | Low | Medium | Medium |

### 4.2 ADVOCATE Risk Criteria

| Risk Level | Acceptability | Required Action |
|------------|---------------|-----------------|
| **Unacceptable** | Not acceptable under any circumstances | Must eliminate hazard or redesign |
| **High** | Not acceptable without risk reduction | Implement risk controls, verify effectiveness |
| **Medium** | ALARP (As Low As Reasonably Practicable) | Implement controls if feasible, document justification |
| **Low** | Generally acceptable | Document, monitor |

---

## 5. Risk Control Measures

### 5.1 Risk Control Hierarchy

ISO 14971 requires prioritizing controls in this order:

1. **Inherent Safety by Design** - Eliminate hazard through design
2. **Protective Measures** - Implement barriers, interlocks, warnings
3. **Information for Safety** - Labeling, IFU, training

### 5.2 Deutsch Risk Controls

| Hazard ID | Control Type | Control Measure | Spec Reference |
|-----------|--------------|-----------------|----------------|
| D-001 | Design | Popper supervision of all medication proposals | `01-popper-system-spec.md` §4 |
| D-001 | Design | Clinician protocol reference required | `01-deutsch-system-spec.md` §4 |
| D-002 | Design | Contraindication checking in CVD cartridge | `03-deutsch-cvd-cartridge-spec.md` |
| D-003 | Design | Urgent triage patterns trigger immediate escalation | Red flag registry |
| D-004 | Design | Evidence refs required for diagnosis proposals | DisclosureBundle |
| D-005 | Protective | High uncertainty → ROUTE_TO_CLINICIAN | Popper policy |
| D-006 | Protective | Hallucination rate monitoring | Popper §5 |
| D-007 | Design | <1s latency requirement (Phase 1B) | TA1 metrics |
| D-008 | Protective | Fallback to clinician workflow | Degraded mode |

### 5.3 Popper Risk Controls

| Hazard ID | Control Type | Control Measure | Spec Reference |
|-----------|--------------|-----------------|----------------|
| P-001 | Design | Deterministic policy engine (no LLM) | `03-popper-safety-dsl.md` |
| P-001 | Design | Default-to-safe behavior | §2.3 |
| P-002 | Design | Calibrated thresholds via IV&V | Policy tuning |
| P-003 | Design | <100ms supervision latency target | ARPA-H TA2 |
| P-004 | Protective | Policy pack versioning and testing | Semver + CI |
| P-005 | Design | HARD_STOP when Popper unavailable | Deutsch fallback |

### 5.4 Hermes Risk Controls

| Hazard ID | Control Type | Control Measure | Spec Reference |
|-----------|--------------|-----------------|----------------|
| H-001 | Design | JWS signature verification | `02-hermes-contracts.md` §2.2 |
| H-002 | Design | mTLS or equivalent transport security | `03-hermes-deployment-security.md` |
| H-003 | Design | Idempotency key + replay window | §3.3 |
| H-004 | Protective | Clock skew validation (±5 min) | §3.3 |
| H-005 | Design | Schema validation before processing | Contract validation |

---

## 6. Residual Risk Assessment

### 6.1 Residual Risk After Controls

| Hazard ID | Initial Risk | Controls Applied | Residual Risk | Acceptable? |
|-----------|--------------|------------------|---------------|-------------|
| D-001 | High | Popper + protocol ref | Low | ✅ Yes |
| D-002 | High | Contraindication check + Popper | Low | ✅ Yes |
| D-003 | High | Triage patterns + escalation | Medium | ⚠️ ALARP |
| D-004 | High | Evidence refs + Popper | Medium | ⚠️ ALARP |
| D-005 | Medium | Uncertainty routing | Low | ✅ Yes |
| D-006 | Medium | Hallucination monitoring | Low | ✅ Yes |
| P-001 | Medium | Deterministic + default-safe | Low | ✅ Yes |
| H-001 | Medium | JWS signatures | Low | ✅ Yes |

### 6.2 Overall Residual Risk Acceptability

**Conclusion:** The overall residual risk of the ADVOCATE clinical agent system is **acceptable** when:
1. All specified risk controls are implemented
2. Popper supervision is operational
3. Clinician escalation pathways are functional
4. Post-market monitoring is active

**Risk-Benefit Analysis:**
- **Benefits:** 24/7 specialist-level care access, reduced hospitalizations, improved adherence
- **Residual Risks:** Primarily mitigated to Low/ALARP levels
- **Conclusion:** Benefits outweigh residual risks for intended population

---

## 7. Production and Post-Production Information

### 7.1 Information Collection

| Source | Information Type | Use |
|--------|------------------|-----|
| Popper audit logs | Safety signal trends | Drift detection |
| Hermes audit events | System performance | Reliability monitoring |
| TA3 clinical data | Patient outcomes | Effectiveness validation |
| User feedback | Usability issues | Use error identification |
| Adverse events | Actual harms | Risk model validation |

### 7.2 Risk Management File Updates

The Risk Management File must be updated when:
- New hazards are identified
- Post-market data indicates changed probability/severity
- Controls are found ineffective
- Significant design changes occur

---

## 8. FMEA Integration

### 8.1 Failure Mode and Effects Analysis

FMEA extends hazard analysis to specific failure modes:

| Component | Failure Mode | Effect | Severity | Occurrence | Detection | RPN |
|-----------|--------------|--------|----------|------------|-----------|-----|
| Deutsch LLM | Hallucinates medication | Wrong prescription | 8 | 3 | 7 | 168 |
| Deutsch LLM | Misses key symptom | Delayed diagnosis | 7 | 4 | 6 | 168 |
| Popper policy | Rule not triggered | Unsafe action proceeds | 8 | 2 | 6 | 96 |
| Hermes sig | Verification fails | Message rejected | 5 | 2 | 9 | 90 |
| Hermes msg | Schema invalid | System error | 4 | 3 | 9 | 108 |

*RPN = Severity × Occurrence × Detection (lower is better)*

### 8.2 FMEA Action Thresholds

| RPN Range | Action |
|-----------|--------|
| >150 | Immediate action required |
| 100-150 | Action required |
| 50-100 | Consider action |
| <50 | Monitor |

---

## 9. Implementation Checklist

### Risk Management Planning

- [ ] Define risk acceptability criteria
- [ ] Establish risk management team
- [ ] Create Risk Management File structure
- [ ] Define risk management activities timeline

### Risk Analysis

- [ ] Identify hazards (use checklist above as starting point)
- [ ] Estimate risk for each hazard
- [ ] Document in hazard analysis table
- [ ] Conduct FMEA for critical components

### Risk Evaluation

- [ ] Apply acceptability matrix
- [ ] Identify unacceptable/high risks
- [ ] Document risk evaluation rationale

### Risk Control

- [ ] Design controls for unacceptable/high risks
- [ ] Verify control effectiveness
- [ ] Assess residual risk
- [ ] Evaluate overall residual risk acceptability

### Documentation

- [ ] Maintain Risk Management File
- [ ] Include in Design History File
- [ ] Reference in premarket submission
- [ ] Plan post-market updates

---

## 10. References

### Standards

- [ISO 14971:2019 Medical devices — Application of risk management](https://www.iso.org/standard/72704.html)
- [ISO/TR 24971:2020 Guidance on ISO 14971](https://www.iso.org/standard/74437.html)
- [IMDRF N81: Software-Specific Risk (2025)](https://www.imdrf.org/documents)

### FDA Guidance

- [Content of Premarket Submissions for Device Software Functions](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/content-premarket-submissions-device-software-functions)
- [Factors to Consider When Making Benefit-Risk Determinations](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/factors-consider-when-making-benefit-risk-determinations-medical-devices)

### ADVOCATE Specs

- [Deutsch System Spec](../../01-deutsch-specs/01-deutsch-system-spec.md)
- [Popper System Spec](../../02-popper-specs/01-popper-system-spec.md)
- [Hermes Contracts](../../03-hermes-specs/02-hermes-contracts.md)
- [Safety Escalation](../../../01-product/technical-specs/18-safety-escalation.md)

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-24 | ADVOCATE Team | Initial release |
