# 01 — Source Hierarchy for Popper Rules

> **Version**: 0.1.0
> **Date**: 2026-03-19

---

## Overview

Popper rules are derived from clinical, regulatory, and governance sources. Not all sources carry equal authority. This document defines the hierarchy that determines which sources take precedence when rules conflict, who owns approval for each layer, and how each layer should be updated.

---

## The Five-Layer Source Hierarchy

Rules are ordered from highest to lowest authority. Higher-authority sources override lower-authority sources when they conflict.

```
┌─────────────────────────────────────────────────────┐
│  LAYER 1: Hard Safety Facts                         │  ← Highest authority
│  Medication labels, contraindications, black box    │
│  warnings, REMS requirements                        │
├─────────────────────────────────────────────────────┤
│  LAYER 2: Consensus Society Guidelines              │
│  AHA/ACC, ADA, KDIGO, HRS — Class I/II COR          │
│  recommendations with evidence grades               │
├─────────────────────────────────────────────────────┤
│  LAYER 3: Local Site Protocols                      │
│  Formulary rules, escalation thresholds,            │
│  staffing-driven constraints, institutional policy  │
├─────────────────────────────────────────────────────┤
│  LAYER 4: Governance & Accreditation Requirements   │
│  FDA/CMS expectations, URAC/JC/IAC standards,       │
│  organizational governance policies                 │
├─────────────────────────────────────────────────────┤
│  LAYER 5: Emerging Evidence & Literature            │  ← Lowest authority
│  Recent RCTs, meta-analyses, safety signals,         │
│  post-market surveillance findings                  │
└─────────────────────────────────────────────────────┘
```

---

## Layer 1: Hard Safety Facts

### What it includes
- FDA-approved medication labels (structured product labeling via DailyMed)
- Contraindications (absolute and relative)
- Black box warnings
- REMS program requirements
- FDA safety communications (MedWatch alerts, safety reviews, drug safety communications) — these are regulatory actions, not provisional literature
- Known drug-drug interactions with clinical significance ratings
- Dose limits (maximum approved doses by indication and population)

### What it controls
- `HARD_STOP` rules for absolute contraindications
- `ROUTE_TO_CLINICIAN` rules for relative contraindications and interactions
- Dose-ceiling checks for medication proposals
- Population restrictions (e.g., age, renal function, pregnancy)

### Typical enforcement levels (summary; see `06-enforcement-levels-and-decision-taxonomy.md` for normative detail)
- Absolute contraindication → `HARD_STOP`
- Black box warning condition met → `ROUTE_TO_CLINICIAN` with mandatory clinician acknowledgment
- Relative contraindication → `ROUTE_TO_CLINICIAN`
- Drug interaction (major) → `ROUTE_TO_CLINICIAN`
- Drug interaction (moderate) → `REQUEST_MORE_INFO` or `APPROVED` with constraint

### Update cadence
- Within 72 hours of FDA label revision or new safety communication
- Immediate for safety recalls

### Approval owner
- **Clinical pharmacist or physician** reviews label changes
- **Engineering** implements rule updates
- **Clinical governance board** approves activation

### Why Layer 1 is highest
Medication labels are regulatory facts, not recommendations. A contraindication is not a suggestion — it is a documented condition under which a medication must not be used (or must be used with specific precautions). No guideline, protocol, or governance requirement can override a hard safety fact.

---

## Layer 2: Consensus Society Guidelines

### What it includes
- AHA/ACC/HFSA 2022 Heart Failure Guideline (+ 2024 ECDP update)
- AHA/ACC 2025 Hypertension Guideline
- ACC/AHA 2026 Dyslipidemia Guideline
- ADA 2026 Standards of Care (Sections 9-11)
- KDIGO 2024 CKD Guideline
- ACC/AHA/HRS 2023 Atrial Fibrillation Guideline
- Society expert consensus decision pathways (ECDPs)

### What it controls
- Clinical appropriateness checks for medication classes within supervised domains
- Therapy initiation and titration rules tied to specific COR/LOE recommendations
- Risk threshold logic (e.g., anticoagulation threshold based on stroke risk >=2%/year)
- Combination therapy sequencing (e.g., statin → ezetimibe → PCSK9i pathway)

### Typical enforcement levels (summary; see `06-enforcement-levels-and-decision-taxonomy.md` for normative detail)
- Class I (COR I) recommendation violated → `ROUTE_TO_CLINICIAN` (strong recommendation, clinician must confirm intent)
- Class IIa recommendation not followed → `REQUEST_MORE_INFO` (ask for clinical reasoning justifying deviation)
- Class IIb or III (no benefit) → no enforcement; informational only (logged in audit, no decision impact)
- Class III (harm) → `ROUTE_TO_CLINICIAN` or `HARD_STOP` depending on severity (governance board decides which)

### Update cadence
- Within 30 days of new guideline publication or focused update
- Annual review of all active guideline-derived rules

### Approval owner
- **Domain physician** (cardiologist, endocrinologist, nephrologist) reviews guideline interpretation
- **Clinical governance board** approves rule set
- **Engineering** implements and tests

### Important constraints
- Guidelines are recommendations, not mandates. They describe what should generally be done for a population, not what must be done for every patient.
- Popper should enforce guideline-derived rules as `ROUTE_TO_CLINICIAN` (requiring human review), not `HARD_STOP`, unless the guideline identifies a Class III (harm) recommendation.
- Clinician override of a guideline-based rule is expected and appropriate — the override must be logged with rationale (via Hermes `ClinicianFeedbackEvent`).

---

## Layer 3: Local Site Protocols

### What it includes
- Facility formulary (approved medications and preferred agents)
- Institutional escalation pathways (when to escalate to attending, specialist, pharmacist)
- Staffing-model constraints (e.g., NP/PA autonomous prescribing limits)
- Institutional treatment protocols (e.g., insulin sliding scale, heart failure pathway)
- Local order sets and standing orders

### What it controls
- Formulary compliance: proposals for non-formulary medications trigger review
- Escalation rules: certain proposal types require attending-level sign-off at specific sites
- Scope-of-practice enforcement: proposals requiring physician-level authorization when initiated by mid-level provider

### Typical enforcement levels
- Non-formulary medication → `ROUTE_TO_CLINICIAN`
- Exceeds NP/PA autonomous scope → `ROUTE_TO_CLINICIAN`
- Protocol deviation → `REQUEST_MORE_INFO` or `ROUTE_TO_CLINICIAN` depending on site config
- Informational protocol reminders → `APPROVED` with constraint note

### Update cadence
- As needed when site protocols change (P&T committee decisions, staffing changes)
- Quarterly review minimum

### Approval owner
- **Site medical director** or designee approves site protocol pack
- **Pharmacy & Therapeutics (P&T) committee** owns formulary decisions
- **Engineering** provides tooling; does not make clinical content decisions

### Important constraints
- Site protocols must not weaken Layer 1 or Layer 2 rules. A site cannot configure Popper to ignore a contraindication or bypass a guideline-derived safety check.
- Site protocols can add restrictions (more conservative) but cannot remove core safety restrictions (less conservative).
- See `07-site-protocol-pack-and-localization.md` for implementation details.

---

## Layer 4: Governance and Accreditation Requirements

### What it includes
- FDA AI/ML SaMD expectations (PCCP, lifecycle management)
- CMS Conditions of Participation (where AI supervision affects facility compliance)
- URAC Health Care AI Accreditation standards (risk management, operations, performance monitoring)
- Joint Commission/CHAI responsible AI guidance (governance, transparency, quality monitoring)
- IAC AI Task Force addendum (modality-specific AI standards)
- NIST AI RMF (Govern, Map, Measure, Manage functions)
- ISO 14971 risk management principles

### What it controls
- Audit completeness requirements (every decision must emit an audit event)
- Monitoring thresholds (drift detection, bias monitoring requirements)
- Documentation requirements (model cards, change logs, validation records)
- Reporting obligations (adverse event detection and flagging)
- Access control requirements (role-based access to audit data)

### Typical enforcement levels
- Governance requirements do **not** produce patient-level supervision decisions. They operate in the control plane (see `04-policy-pack-architecture.md` §4).
- They impose structural requirements on Popper's operation: "audit events must be emitted," "drift must be monitored," "safe-mode must be available."
- If a governance requirement implies clinician review for a class of decisions (e.g., CMS oversight), this should be encoded as a **Layer 2 guideline-derived rule or Layer 3 site protocol rule** — not as a Layer 4 governance rule injected into the decision loop. The governance layer defines *that* oversight is required; the clinical layer defines *how* it is enforced.

### Update cadence
- Upon publication of new guidance or standards
- Annual alignment review

### Approval owner
- **Compliance officer** or **regulatory affairs** reviews alignment
- **Clinical governance board** approves where clinical implications exist
- **Engineering** implements structural requirements

### Important constraints
- Governance requirements must not override hard clinical safety logic. If a governance standard says "the system should monitor for X," that does not mean Popper should ignore a contraindication while monitoring.
- Governance alignment is about how Popper is built and operated, not about what clinical decisions it makes.

---

## Layer 5: Emerging Evidence and Literature

### What it includes
- Recent RCTs not yet incorporated into society guidelines
- Meta-analyses and systematic reviews
- Post-market surveillance data (non-FDA)
- Real-world evidence from clinical practice
- Pre-print or single-study findings not yet replicated

**Note:** FDA safety communications (MedWatch alerts, drug safety communications) are **not** in this layer. They are regulatory actions and belong in Layer 1.

### What it controls
- New safety signals that may warrant increased clinician review
- Emerging drug interactions or population-specific risks
- Preliminary evidence for new therapeutic pathways

### Typical enforcement levels
- New safety signal → `ROUTE_TO_CLINICIAN` with reference to source (until guideline update incorporates finding)
- Emerging interaction → `REQUEST_MORE_INFO`
- Preliminary efficacy data → no enforcement; informational only
- **Emerging evidence should never produce `HARD_STOP` without clinical governance review and formal rule promotion to Layer 1 or Layer 2**

### Update cadence
- As safety signals emerge (no fixed cadence)
- Clinical governance board reviews quarterly for promotion or retirement

### Approval owner
- **Clinical governance board** reviews and decides whether to:
  - Promote to Layer 2 (when guidelines are updated)
  - Promote to Layer 1 (when label changes occur)
  - Retire (when evidence is superseded or retracted)
- **No individual clinician or engineer** can unilaterally promote emerging evidence to hard-stop rules

### Important constraints
- Emerging evidence is the lowest-authority layer for a reason. Medical knowledge evolves. Individual studies can be wrong, retracted, or superseded. Popper must not become a system that reacts to every preprint.
- The path from emerging evidence to hard-stop rule is: literature → clinical governance review → guideline incorporation → formal rule with provenance → activation.

---

## Conflict Resolution Between Layers

When sources from different layers produce conflicting rule implications:

| Scenario | Resolution |
|---|---|
| Layer 1 contraindication vs. Layer 2 guideline recommendation | Layer 1 wins. Contraindication is enforced regardless of guideline. |
| Layer 2 guideline vs. Layer 3 site protocol | Layer 2 wins for safety; Layer 3 can add restrictions but not remove guideline-based protections. |
| Layer 3 site protocol vs. Layer 4 governance | Layer 3 clinical decisions take precedence over governance process requirements. Governance controls how the system operates, not what clinical decisions it makes. |
| Layer 4 governance vs. Layer 5 emerging evidence | Governance requirements are structural and always apply. Emerging evidence is provisional and subject to review. |
| Multiple Layer 2 guidelines conflict (e.g., ADA vs. KDIGO on SGLT2i threshold) | Clinical governance board adjudicates. Rule uses the more conservative recommendation until resolved. |

---

## Implementation in Policy Packs

`source_layer` lives inside `provenance` (not as a top-level rule field). See `05-rule-provenance-and-evidence-model.md` for the canonical `RuleProvenance` type. The policy engine should validate that no lower-layer rule overrides a higher-layer rule for the same clinical scenario. See `04-policy-pack-architecture.md` for pack composition details.

```yaml
# Example: Layer 1 rule (highest authority, priority 700-799)
- rule_id: acei_angioedema_contraindication
  priority: 750
  provenance:
    source_type: contraindication
    source_layer: 1
    citation: "Lisinopril SPL, Section 4 — History of angioedema related to previous ACE inhibitor treatment"
    source_url: "https://dailymed.nlm.nih.gov/dailymed/..."
  # ...

# Example: Layer 2 rule (priority 100-299)
- rule_id: sglt2i_hfref_guideline_check
  priority: 200
  provenance:
    source_type: society_guideline
    source_layer: 2
    citation: "2022 AHA/ACC/HFSA HF Guideline §7.3.2, Class I, LOE A"
    source_url: "https://doi.org/10.1161/CIR.0000000000001063"
  # ...
```
