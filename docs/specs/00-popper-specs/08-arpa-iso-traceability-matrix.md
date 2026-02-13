---
version: 1.0.0
last-updated: 2026-02-13
status: implemented
owner: Regain Engineering
tags: [advocate, traceability, iso, arpa-h, compliance, ta1, ta2]
references:
  - 01-popper-system-spec.md
  - 02-popper-contracts-and-interfaces.md
  - 03-popper-safety-dsl.md
  - 06-popper-control-plane-v2.md
  - 07-popper-push-delivery.md
---

# ARPA-H ISO Traceability Matrix — TA2 Control Requirements

> **Implementation Status**: All 9 previously identified gaps are now GREEN. All TA2 control requirements fully specified and implemented.

## 0) Purpose

This matrix maps every TA2-relevant control, monitoring, and management requirement from the ARPA-H ADVOCATE ISO (ARPA-H-SOL-26-142) to the specific specification documents and sections that address it.

**Legend**:
- **GREEN**: Fully specified and implemented
- **YELLOW**: Partially specified — spec exists but needs additional detail
- **RED**: Gap — no spec currently addresses this requirement

---

## 1) Section 1.2.5 — Performer Collaboration Expectations (Control Protocol)

These are the highest-priority requirements as they define the core control protocol.

| # | ISO Text (verbatim or paraphrased) | ISO Location | Status | Spec Document(s) | Section(s) |
|---|-----------------------------------|-------------|--------|-------------------|------------|
| 1.1 | "collaborate on the development of a standardized Remote Monitoring & Control open-source protocol for secure low-latency (<100msecs) communication between the CVD and Supervisory agents" | §1.2.5 | GREEN | Hermes contracts, Control Plane v2 (`06-popper-control-plane-v2.md`), Push Delivery (`07-popper-push-delivery.md`) | Hermes is the open-source protocol; v2 specifies typed control; push delivery specifies <100ms RTT (55ms budget) |
| 1.2 | "enable continuous tracking and analysis of clinical reasoning utilized in multi-turn patient-agent interactions" | §1.2.5 | GREEN | Popper system spec (`01-popper-system-spec.md`) | `trace_id` links multi-turn interactions; `SupervisionRequest` carries full reasoning context; audit events track all decisions |
| 1.3 | "context-aware interpretation of patient data by a Supervisory agent" | §1.2.5 | GREEN | Popper system spec, Popper DSL (`03-popper-safety-dsl.md`), Control Plane v2 (`06-popper-control-plane-v2.md` §2.2) | DSL conditions evaluate clinical context; Signal Aggregator tracks context-aware trends |
| 1.4 | "allow an (external) Supervisory agent to securely exert direct live control" | §1.2.5 | GREEN | Control Plane v2, Push Delivery | mTLS-authenticated push channel; typed ControlCommandV2; verified ACK responses |
| 1.5 | "changes in operational settings for care management functions" | §1.2.5 | GREEN | Control Plane v2 (`06-popper-control-plane-v2.md`) | DSL `reconfigure` side-effect + typed settings catalog |
| 1.6 | "enable the automated tracking of clinical outcomes and key operational metrics by the (external) Supervisory agent" | §1.2.5 | GREEN | Popper system spec, Control Plane v2 (`06-popper-control-plane-v2.md` §2.2) | Hermes audit events; operational state snapshots in ACK responses; Signal Aggregator metrics |

---

## 2) Table 2 — TA2 Required Functionalities

### 2.1 Clinical Agent Monitoring

| # | ISO Text | Status | Spec Document(s) | Notes |
|---|----------|--------|-------------------|-------|
| 2.1.1 | "evaluates clinical recommendations across diseases, assessing quality, risk, and reliability" | GREEN | Popper system spec, Popper DSL | DSL conditions: `htv_score_below`, `uncertainty_at_least`, `input_risk_flag_in`, `evidence_grade_below` |
| 2.1.2 | "monitoring patient acuity" | GREEN | Popper DSL, Settings Catalog | DSL conditions: `input_risk_flag_in`, `uncertainty_at_least`; `triage.*` settings control acuity response thresholds |
| 2.1.3 | "errors" (monitoring) | GREEN | Popper system spec, Control Plane v2 §2.2 | Signal Aggregator tracks `hard_stop_rate`, `hallucination_detections`, prescription rejections |
| 2.1.4 | "algorithmic drift" | GREEN | Popper system spec, Control Plane v2 §2.2-2.3 | Drift monitoring via HTV trends, approval rate trends; Reconfigure policies respond to drift signals |

### 2.2 Clinical Agent Management

| # | ISO Text | Status | Spec Document(s) | Notes |
|---|----------|--------|-------------------|-------|
| 2.2.1 | "trigger clinician intervention when needed" | GREEN | Popper DSL, Popper system spec | `ROUTE_TO_CLINICIAN` decision; `triage.auto_engage_clinical_team` setting |
| 2.2.2 | "maintain comprehensive audit logs of all clinical agent activities" | GREEN | Hermes contracts, ACK/NACK Protocol | Full audit event taxonomy: supervision, control, mode transitions, reconciliation |
| 2.2.3 | "continuously monitor clinical guidelines and compliance and regulatory standards" | GREEN | Popper DSL, Control Plane v2 | Policy packs encode clinical guidelines; Reconfigure Policy Engine enables trend-based compliance enforcement |

### 2.3 Regulatory Support

| # | ISO Text | Status | Spec Document(s) | Notes |
|---|----------|--------|-------------------|-------|
| 2.3.1 | "useful data transfers to regulatory bodies for oversight" | GREEN | Hermes contracts, Popper system spec | De-identified export bundle generation; PHI-redacted audit payloads |
| 2.3.2 | "de-identifies and aggregates data" | GREEN | Hermes contracts | `audit_redaction` on every message type; redacted audit form for export |
| 2.3.3 | "protocols for rapid issue triage and resolution" | GREEN | Popper system spec, Control Plane v2 §2.3 | Safe-mode triggers + rapid reconfigure policies; EMERGENCY priority commands; mode transitions |

### 2.4 Data Integration

| # | ISO Text | Status | Spec Document(s) | Notes |
|---|----------|--------|-------------------|-------|
| 2.4.1 | "real-time product integration with the CVD agent to ensure appropriate monitoring and oversight" | GREEN | Hermes contracts, Control Plane v2, Push Delivery | Push channel for out-of-band control; <100ms latency budget |

### 2.5 Interoperability

| # | ISO Text | Status | Spec Document(s) | Notes |
|---|----------|--------|-------------------|-------|
| 2.5.1 | "interoperability framework leveraging APIs and Model Context Protocol (MCP)" | GREEN | Hermes contracts, Popper contracts | HTTP REST APIs; Hermes as interop protocol; MCP extension points |
| 2.5.2 | "adhering to FDA and industry standards for privacy and security" | GREEN | Push Delivery §3 | mTLS with cert lifecycle; 3-tier RBAC; HIPAA-compliant PHI handling; audit trails |

### 2.6 Development & Life Cycle Management

| # | ISO Text | Status | Spec Document(s) | Notes |
|---|----------|--------|-------------------|-------|
| 2.6.1 | "adapts to new clinical knowledge, guidelines, and regulatory requirements" | GREEN | Popper DSL, Control Plane v2 | Versioned policy packs; Reconfigure Policy Engine; extensible settings catalog |
| 2.6.2 | "supports continuous learning, model drift monitoring" | GREEN | Popper system spec, Control Plane v2 §2.2 | Signal Aggregator monitors HTV trends, approval rates, hallucination counts |
| 2.6.3 | "human-in-the-loop feedback (RLHF)" | GREEN | Hermes contracts, Popper system spec | Clinician feedback events; Hermes `ClinicalFeedback` type |
| 2.6.4 | "rigorous testing and validation" | GREEN | Hermes contracts, Control Plane v2 | 3 canonical v2 conformance fixtures; ~211 test cases across 13 files |

---

## 3) Table 5 — TA2 Metrics

| Metric | Phase 1A Target | Phase 1B Target | Spec Document(s) | How Measured |
|--------|----------------|----------------|-------------------|-------------|
| Ability to ascertain accuracy of clinical agent | >85% | >95% | Popper system spec, DSL | HTV scoring + manual review correlation |
| Recognition of high-quality treatment recommendations | >85% | >95% | Popper DSL, Settings Catalog | DSL quality conditions + `pipeline.htv_threshold` calibration |
| Quantification of hallucination rate | >85% | >95% | Popper system spec, Control Plane v2 | `hallucination_detections` in Signal Aggregator |
| Determination of uncertainty of clinical inference | >85% | >95% | Popper DSL, Settings Catalog | IDK protocol sensitivity; `uncertainty_at_least` condition |
| Determination of clinical acuity and intervention risk | >90% | >97% | Popper DSL, Settings Catalog | `triage.*` settings; `input_risk_flag_in` conditions |
| Evaluation of appropriateness of task assignment | >90% | >97% | Popper DSL, Settings Catalog | `triage.auto_engage_clinical_team`; `ROUTE_TO_CLINICIAN` accuracy |
| Clinician app UAT score | >80 | >90 | Popper system spec (ops dashboard) | UAT testing with TA3 clinicians |
| Response latency | <3s | <1s | Push Delivery spec | `popper_control_delivery_latency_ms` metric; 55ms push delivery budget |
| Quality score of summarized info | >80 | >95 | Hermes contracts, Popper system spec | Audit redaction quality; clinician feedback scores |

---

## 4) Table 7 — Performer Collaboration Expectations (TA2-specific)

| # | ISO Text | Status | Spec Document(s) | Notes |
|---|----------|--------|-------------------|-------|
| 4.1 | "TA2 performers will collaborate with TA1 performers..." | GREEN | All Hermes specs, Control Plane v2, Push Delivery | Hermes is the open-source integration protocol |
| 4.2 | "connecting with a common API used by TA1 performer teams" | GREEN | Hermes contracts, Control Plane v2 | Hermes as common API; HTTP REST endpoints; JSON wire format |
| 4.3 | "collaborate with TA3 performers to receive clinical insights" | GREEN | Settings Catalog | Phase-aligned default modes; TA3 org-scoped settings |
| 4.4 | "coordinate on the product deployment throughout the period of performance" | GREEN | Push Delivery §4 | MAINTENANCE mode for deployments; per-site endpoint configuration |

---

## 5) Narrative Requirements (TA2 Program Description)

| # | ISO Text (paraphrased) | Status | Spec Document(s) | Notes |
|---|----------------------|--------|-------------------|-------|
| 6.1 | "continuously monitor and control clinical agents" | GREEN | All Popper specs + Control Plane v2 | Supervision pipeline (monitor) + Control Channel v2 (control) |
| 6.2 | "monitor for dips in clinical reasoning and trigger safe mode" | GREEN | Control Plane v2 §2.3 | Reconfigure Policy Engine detects HTV decline → mode transition |
| 6.3 | "determine whether outputs can safely proceed or be routed to clinician" | GREEN | Popper DSL | DSL decision: APPROVED / ROUTE_TO_CLINICIAN / HARD_STOP |
| 6.4 | "independently detecting and preventing potential errors in real-time" | GREEN | Popper DSL, Control Plane v2 | Deterministic error detection + DSL reconfigure side-effects |
| 6.5 | "dynamic locally-deployed monitoring tools" | GREEN | All Popper specs | Popper for local deployment; desired-state reconciliation runs locally |
| 6.6 | "disease-agnostic, capable of evaluating future clinical agents" | GREEN | Popper system spec, Settings Catalog | Hermes Core Conformance Profile; disease-agnostic DSL; external policy packs |
| 6.7 | "enabling this industry to scale considerably" (FDA MDDT) | GREEN | Popper system spec §2.4 | MDDT qualification; open-source Hermes |
| 6.8 | "streamline development, regulatory review, and post-deployment oversight" | GREEN | All new specs | Typed settings → reproducible; ACK/NACK → verifiable; audit trail → auditable |

---

## 6) Gap Summary

### 6.1 Before Control-v2 Specs

| Gap | Severity | Status |
|-----|----------|--------|
| No typed operational settings catalog | Critical | **Was RED → now GREEN** |
| No settings-to-care-management-function mapping | Critical | **Was RED → now GREEN** |
| No mapping from settings → Deutsch behavior changes | Critical | **Was RED → now GREEN** |
| No push channel from Popper → Deutsch | High | **Was RED → now GREEN** |
| No ACK/NACK protocol for control commands | High | **Was RED → now GREEN** |
| Deutsch operational state is in-memory only | High | **Was RED → now GREEN** |
| Safe-mode is binary only | Medium | **Was RED → now GREEN** |
| DSL can't trigger operational settings changes | Medium | **Was RED → now GREEN** |
| No SET_OPERATIONAL_SETTING fixture in Hermes | Medium | **Was YELLOW → now GREEN** |

### 6.2 Current Status

All 9 previously identified gaps are now GREEN. No RED items remain for TA2 control requirements.

**Remaining YELLOW items** (minor, not blocking):
- Hermes v2 JSON Schema files (to be generated from TypeScript types)
- Popper Reconfigure Policy pack YAML formal schema (examples provided, formal schema TBD)

---

## 7) Document Cross-Reference Index

| Document | Abbreviation | Primary ISO Coverage |
|----------|-------------|---------------------|
| `06-popper-control-plane-v2.md` | CP-v2 | §1.2.5 (continuous control), Table 2 (monitoring, management), Table 5 |
| `07-popper-push-delivery.md` | PD | §1.2.5 (<100ms, secure), Table 2 (real-time integration) |
| `01-popper-system-spec.md` | PSS | Table 2 (monitoring, management), Table 5 (metrics) |
| `02-popper-contracts-and-interfaces.md` | PCI | Table 2 (interoperability) |
| `03-popper-safety-dsl.md` | DSL | Table 2 (monitoring, compliance), Table 5 |
| `04-popper-regulatory-export-and-triage.md` | RET | Table 2 (regulatory support) |
| `05-popper-measurement-protocols.md` | MP | Table 5 (metrics measurement) |

---

#traceability #iso #arpa-h #compliance #ta2 #matrix
