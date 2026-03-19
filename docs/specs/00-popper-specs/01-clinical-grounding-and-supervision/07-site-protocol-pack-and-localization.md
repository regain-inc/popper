# 07 — Site Protocol Pack and Localization

> **Version**: 0.1.0
> **Date**: 2026-03-19

---

## Overview

Different medical centers operate under different formularies, escalation pathways, staffing models, and institutional protocols. Popper must support site-specific customization without becoming a custom-services burden and without allowing sites to weaken core safety rules.

This document specifies how site protocol packs work, what they can and cannot override, and how they are validated and maintained.

---

## What Site Protocol Packs Customize

### 1. Formulary Rules

Each facility has a Pharmacy & Therapeutics (P&T) committee that approves a formulary — the list of medications available at that facility. Popper should enforce formulary compliance:

```yaml
# Example: site formulary rule
- rule_id: site_chi_non_formulary_check
  description: Non-formulary medication proposed at Chicago site
  priority: 80
  provenance:
    source_type: formulary_rule
    source_layer: 3
    citation: "Regain Health Chicago P&T Formulary v2026-Q1"
    approved_by: "P&T Committee Chair"
    effective_date: "2026-01-15"
    review_interval_days: 90
    review_due: "2026-04-15"
  when:
    kind: medication_not_in_formulary
    formulary_ref: "chi-formulary-2026q1"
  then:
    decision: ROUTE_TO_CLINICIAN
    reason_codes:
      - policy_violation
      - needs_human_review
    explanation: >
      Proposed medication is not on the Chicago site formulary.
      Clinician review required for non-formulary orders.
```

**Implementation note:** This requires a new condition kind (`medication_not_in_formulary`) and a formulary data file that the site pack references. The formulary data file lists approved medications by class and name.

### 2. Escalation Thresholds

Sites may have different thresholds for when a proposal requires attending-level review vs. mid-level provider authorization:

```yaml
# Example: site escalation rule
- rule_id: site_chi_attending_required_for_anticoagulation
  description: Anticoagulation initiation requires attending at Chicago site
  priority: 75
  provenance:
    source_type: site_protocol
    source_layer: 3
    citation: "Regain Health Chicago Anticoagulation Protocol v3.1"
    approved_by: "Dr. [Name], CMO"
    effective_date: "2026-02-01"
    review_interval_days: 180
    review_due: "2026-08-01"
  when:
    kind: all_of
    conditions:
      - kind: proposal_kind_in
        kinds: [MEDICATION_ORDER_PROPOSAL]
      - kind: medication_class_in
        classes: ["B01AF", "B01AA", "B01AE"]  # DOACs + warfarin + dabigatran
  then:
    decision: ROUTE_TO_CLINICIAN
    reason_codes:
      - needs_human_review
    explanation: >
      Chicago site protocol requires attending-level review for
      all anticoagulation initiation orders.
```

### 3. Staffing Model Differences

Sites with different clinician staffing models (physician-led vs. NP/PA-led) may have different scope-of-practice rules:

```yaml
# Example: scope-of-practice rule
- rule_id: site_sa_np_scope_limit
  description: NP-initiated medication changes require physician co-sign at SA site
  priority: 70
  provenance:
    source_type: site_protocol
    source_layer: 3
    citation: "Regain Health SA Scope of Practice Policy v1.0"
    approved_by: "Medical Director, SA"
    effective_date: "2026-01-01"
    review_interval_days: 365
    review_due: "2027-01-01"
  when:
    kind: all_of
    conditions:
      - kind: proposal_kind_in
        kinds: [MEDICATION_ORDER_PROPOSAL]
      # Clinician role check would need to be passed in the request context
  then:
    decision: ROUTE_TO_CLINICIAN
    reason_codes:
      - needs_human_review
    explanation: >
      SA site policy requires physician co-signature for NP-initiated
      medication changes.
```

### 4. Local Approval Workflows

Sites may require specific approval workflows that differ from the default:

| Workflow Customization | Example |
|---|---|
| Two-physician sign-off for high-risk medications | Site requires cardiology + primary care approval for anticoagulation |
| Pharmacy review before medication order | Site requires pharmacist review for all new medication starts |
| Time-limited approval | Site requires re-authorization every 30 days for certain medications |

### 5. Protocol References

Sites may have institutional protocols that Popper should reference in explanations:

```yaml
# Site protocol reference in a rule explanation
explanation: >
  Per Chicago Heart Failure Protocol (CHF-P-2026-01), all new ARNI
  initiations require baseline renal function within 72 hours.
  Current snapshot does not contain recent creatinine/eGFR.
```

---

## What Site Packs Cannot Do

### Cannot weaken Layer 1 rules

A site pack cannot create a rule that produces `APPROVED` for a scenario where a Layer 1 rule (medication label, contraindication, black box warning) produces `HARD_STOP` or `ROUTE_TO_CLINICIAN`.

**Enforcement:** The pack loader validates that no site rule at priority 50-99 would override a core or domain rule at priority 100+ for the same conditions.

### Cannot weaken Layer 2 rules

A site pack cannot remove or lower the enforcement level of a guideline-derived domain rule. If a domain pack says "SGLT2i initiation requires eGFR ≥20 per KDIGO 2024 → REQUEST_MORE_INFO when eGFR is missing," the site pack cannot change this to `APPROVED`.

**Enforcement:** Site rules can only produce decisions at the same or more restrictive level as the domain pack rules they might overlap with.

### Cannot change decision types for safety rules

Site packs can add new rules (more restrictive). They cannot change the decision type of existing core or domain rules.

### Cannot modify core pack priorities

Site rules must use priority range 50-99. They cannot use priorities above 99.

---

## Site Pack Validation

### At load time

The pack loader performs the following validation when loading a site pack:

1. **Priority range check:** All rules must have priority 50-99
2. **Pack type check:** `pack_type` must be `site`
3. **Dependency check:** Required domain packs must be loaded
4. **Override check:** No site rule weakens a loaded core or domain rule
5. **Provenance check:** All rules must have `provenance` with `source_type: site_protocol` or `formulary_rule`
6. **Approval check:** `provenance.approved_by` must be non-empty

### At review time

The clinical governance board reviews site packs on the schedule defined by each rule's `review_interval_days`. Review checks:

1. Are formulary references current?
2. Have escalation pathways changed?
3. Has the staffing model changed?
4. Are protocol references still valid?
5. Has the site medical director changed (requiring re-approval)?

---

## Site Pack File Structure

```
config/policies/sites/
├── regain-chi/
│   ├── protocol.yaml       # Escalation and scope rules
│   ├── formulary.yaml       # Formulary compliance rules
│   └── formulary-data.yaml  # Formulary medication list (referenced by rules)
├── regain-sa/
│   ├── protocol.yaml
│   ├── formulary.yaml
│   └── formulary-data.yaml
└── _template/
    ├── protocol.yaml.template   # Template for new sites
    ├── formulary.yaml.template
    └── README.md                # Instructions for creating a new site pack
```

### Formulary Data Format

```yaml
# formulary-data.yaml
formulary_id: chi-formulary-2026q1
formulary_version: "2026-Q1"
approved_by: "P&T Committee"
effective_date: "2026-01-15"
review_due: "2026-04-15"

medications:
  acei:
    - name: lisinopril
      max_dose_mg: 40
      formulary_status: preferred
    - name: enalapril
      max_dose_mg: 40
      formulary_status: approved
    - name: ramipril
      max_dose_mg: 10
      formulary_status: approved
  arb:
    - name: losartan
      max_dose_mg: 100
      formulary_status: preferred
    - name: valsartan
      max_dose_mg: 320
      formulary_status: approved
  # ...

non_formulary_policy: ROUTE_TO_CLINICIAN
# Options: ROUTE_TO_CLINICIAN, REQUEST_MORE_INFO
```

---

## Change Control

### Adding a new site pack

1. Site medical director requests site pack creation
2. Engineering creates pack from template
3. Site medical director and P&T committee (for formulary) provide clinical content
4. Clinical governance board reviews pack for safety (no Layer 1/2 weakening)
5. Engineering loads pack in staging for validation
6. Site medical director approves activation
7. Pack is loaded in production with the site's `organization_id`

### Modifying an existing site pack

1. Change request from site (P&T decision, protocol update, staffing change)
2. Engineering updates pack
3. Clinical governance board reviews if change affects clinical rules
4. Site medical director approves
5. New version loaded in production
6. Previous version archived (not deleted)

### Deactivating a site pack

1. If a site is decommissioned or no longer uses Popper, the site pack is archived
2. Core and domain rules continue to apply for any remaining traffic from that `organization_id`
3. Archived packs are retained for audit purposes

---

## Multi-Jurisdiction Considerations

Some sites operate under different regulatory jurisdictions:

| Jurisdiction | Considerations |
|---|---|
| US | FDA-regulated medications, US-specific formulary, HIPAA requirements |
| Saudi Arabia (KSA) | SFDA-regulated medications, different formulary, different scope-of-practice rules |
| Future jurisdictions | Different regulatory bodies, different approved medications, different clinical standards |

Site packs should carry a `jurisdiction` field:

```yaml
metadata:
  jurisdiction: US  # or SA, EU, etc.
```

Jurisdiction affects:
- Which medication labels are authoritative (FDA vs. SFDA vs. EMA)
- Which regulatory governance requirements apply
- Which scope-of-practice rules are valid

**Jurisdiction affects Layer 1 rules more than one might expect.** While pharmacological drug interactions are consistent across jurisdictions, label-defined contraindications, approved indications, maximum doses, and approved populations can differ between FDA, SFDA, and EMA. A medication approved for a specific indication in the US may have different labeled contraindications in the EU. Domain packs should therefore carry a `jurisdiction` field, and Layer 1 rules should reference jurisdiction-specific labels. Formulary, scope-of-practice, and governance rules are also jurisdiction-specific.
