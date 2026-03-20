# 05 — Rule Provenance and Evidence Model

> **Version**: 0.1.0
> **Date**: 2026-03-19
> **Priority**: This is the most important file in this spec set.

---

## Overview

Every clinically grounded rule in Popper must carry structured provenance — a machine-readable record of where the rule came from, what authority it represents, when it was approved, and when it should be reviewed. This document specifies the provenance data model, how it maps to existing Hermes and Popper types, and what schema changes are needed.

---

## Why Provenance Matters

Without provenance, a rule like `medication_missing_evidence` (current default.yaml, rule priority 650) is a black box to anyone outside the engineering team. It fires when `evidence_refs` is empty on a medication proposal. But:

- Why does missing evidence warrant `ROUTE_TO_CLINICIAN` rather than `REQUEST_MORE_INFO`?
- Which clinical authority says evidence references are required for medication proposals?
- When was this rule last reviewed?
- Who approved it?
- If a guideline changes, which rules are affected?

With provenance, the same rule becomes traceable:

```yaml
- rule_id: medication_missing_evidence
  provenance:
    source_type: internal_policy
    citation: "Popper Safety DSL v1, §5 — Minimum required rules"
    evidence_grade: policy
    jurisdiction: global
    clinical_domain: general
    approved_by: "Popper Dev Team"
    effective_date: "2026-01-26"
    review_interval_days: 365
    review_due: "2027-01-26"
```

And a clinically grounded rule becomes even more precise:

```yaml
- rule_id: acei_angioedema_contraindication
  provenance:
    source_type: contraindication
    source_layer: 1
    citation: "Lisinopril SPL, Section 4 — Contraindications"
    citation_subsection: "History of angioedema related to previous ACE inhibitor treatment"
    source_url: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=..."
    evidence_grade: policy  # Label = regulatory fact, not evidence-graded
    jurisdiction: US
    clinical_domain: cardiovascular
    applicable_population: "Patients with documented history of ACEi-related angioedema"
    approved_by: "Dr. [Name], Clinical Pharmacy"
    effective_date: "2026-04-15"
    review_interval_days: 365
    review_due: "2027-04-15"
    superseded_by: null
    local_protocol_dependency: null
```

**Note on example choice:** This uses a real Section 4 contraindication from the lisinopril label (history of angioedema). Earlier drafts incorrectly used "bilateral renal artery stenosis" as a Section 4 example — that condition appears in Warnings/Precautions (Section 5), not Contraindications. The distinction matters: Section 4 contraindications may warrant `HARD_STOP`; Section 5 warnings typically warrant `ROUTE_TO_CLINICIAN`.

---

## Provenance Data Model

### `RuleProvenance` Type

**Dependency:** This type uses `NativeGrading` from Hermes (`06-hermes-clinical-supervision-contract.md` §4.2). Popper MUST import or re-export the exact Hermes definition — not maintain a local copy.

```typescript
import type { EvidenceGrade, NativeGrading, GovernanceApproval } from '@regain/hermes';

/**
 * Structured provenance for a policy rule.
 * Every clinically grounded rule MUST have a provenance record.
 * Core safety rules (schema, staleness, safe-mode) MAY have provenance
 * with source_type: 'internal_policy'.
 */
interface RuleProvenance {
  // ─── Source identification ───────────────────────────────────

  /** What kind of source this rule derives from */
  source_type:
    | 'medication_label'        // FDA-approved SPL (Layer 1)
    | 'black_box_warning'       // FDA boxed warning (Layer 1)
    | 'contraindication'        // SPL contraindication section (Layer 1)
    | 'drug_interaction'        // SPL or clinical database (Layer 1)
    | 'rems_requirement'        // FDA REMS program (Layer 1)
    | 'society_guideline'       // AHA/ACC, ADA, KDIGO, etc. (Layer 2)
    | 'expert_consensus'        // ECDP, expert consensus statement (Layer 2)
    | 'site_protocol'           // Local institutional protocol (Layer 3)
    | 'formulary_rule'          // P&T committee decision (Layer 3)
    | 'governance_requirement'  // FDA/URAC/JC/IAC requirement (Layer 4)
    | 'emerging_evidence'       // Recent literature not yet in guidelines (Layer 5)
    | 'internal_policy';        // Popper engineering policy (structural rules)

  /** Which hierarchy layer (1-5) this source belongs to */
  source_layer: 1 | 2 | 3 | 4 | 5;

  // ─── Citation ────────────────────────────────────────────────

  /** Full citation string */
  citation: string;

  /** Specific section, table, or subsection within the source */
  citation_subsection?: string;

  /** URL to the authoritative source document */
  source_url?: string;

  /** For guidelines: DOI if available */
  doi?: string;

  // ─── Evidence strength ───────────────────────────────────────

  /**
   * Evidence grade of the source.
   * Uses the existing Hermes EvidenceGrade enum.
   * For medication labels: 'policy' (regulatory fact)
   * For guidelines: maps from native grading to Hermes grade (see mapping tables below)
   */
  evidence_grade: EvidenceGrade;

  /**
   * Native recommendation grading from the source guideline.
   * Different societies use different grading systems. Store the native
   * representation rather than forcing normalization to one system.
   *
   * Only one of these should be populated per rule, matching the source's
   * native grading system.
   */
  /**
   * Uses the NativeGrading type defined in Hermes 06-hermes-clinical-supervision-contract.md §4.2.
   * Popper MUST use the exact Hermes NativeGrading shape — not a local variant.
   */
  native_grading?: NativeGrading;  // imported from @regain/hermes

  // ─── Scope ───────────────────────────────────────────────────

  /** Regulatory jurisdiction (e.g., 'US', 'SA', 'global') */
  jurisdiction: string;

  /** Clinical domain this rule applies to */
  clinical_domain: string;

  /** Population this rule applies to, if restricted */
  applicable_population?: string;

  /** Whether this rule depends on a local site protocol for full context */
  local_protocol_dependency?: string;

  // ─── Governance ─────────────────────────────────────────────

  /**
   * Structured governance approval from Hermes governance module.
   * Preferred over the free-text `approved_by` field.
   * See `07-hermes-governance-types.md` for the GovernanceApproval type.
   */
  approval?: GovernanceApproval;

  // ─── Lifecycle ───────────────────────────────────────────────

  /**
   * Who approved this rule for activation.
   * @deprecated Use `approval` (GovernanceApproval) instead. Retained for
   * backwards compatibility with existing policy packs.
   */
  approved_by: string;

  /** Date the rule became effective */
  effective_date: string;  // ISO date

  /** How often this rule should be reviewed (days) */
  review_interval_days: number;

  /** When the next review is due */
  review_due: string;  // ISO date

  /**
   * If this rule has been superseded by another, reference the new rule.
   * Superseded rules should be deactivated, not deleted.
   */
  superseded_by?: string;

  /**
   * True if this rule was activated via emergency procedure
   * (see 09-clinical-governance-review-workflow.md, Emergency Safety Update).
   * Emergency rules must be ratified by the governance board within ratification_due.
   */
  emergency?: boolean;

  /** ISO date by which emergency rules must be ratified by governance board */
  ratification_due?: string;

  /**
   * Additional provenance entries when a rule derives from multiple sources.
   * Example: a CKD + HF cross-guideline rule references both KDIGO and AHA/ACC.
   * Each additional source carries the same fields as primary provenance
   * (minus lifecycle fields which are shared across all sources for one rule).
   */
  additional_sources?: Array<{
    source_type: RuleProvenance['source_type'];
    source_layer: RuleProvenance['source_layer'];
    citation: string;
    citation_subsection?: string;
    source_url?: string;
    doi?: string;
    evidence_grade: EvidenceGrade;
    native_grading?: RuleProvenance['native_grading'];
    jurisdiction?: string;
  }>;
}
```

### Native Grading to Hermes EvidenceGrade Mapping

Different guideline families use different grading systems. Each maps to Hermes `EvidenceGrade` differently.

#### AHA/ACC System (HF, HTN, Lipids, AF guidelines)

| COR | LOE | Hermes EvidenceGrade | Typical Enforcement |
|---|---|---|---|
| I | A | `systematic_review` or `rct` | `ROUTE_TO_CLINICIAN` if violated |
| I | B-R | `rct` | `ROUTE_TO_CLINICIAN` if violated |
| I | B-NR | `cohort` | `ROUTE_TO_CLINICIAN` if violated |
| I | C-LD | `case_series` | `ROUTE_TO_CLINICIAN` if violated (with lower confidence) |
| I | C-EO | `expert_opinion` | `ROUTE_TO_CLINICIAN` or `REQUEST_MORE_INFO` |
| IIa | any | varies | Informational or `REQUEST_MORE_INFO` |
| IIb | any | varies | No enforcement |
| III (harm) | any | varies | `ROUTE_TO_CLINICIAN` or `HARD_STOP` |
| III (no benefit) | any | varies | No enforcement |

#### ADA System (Standards of Care in Diabetes)

| ADA Grade | Meaning | Hermes EvidenceGrade | Typical Enforcement |
|---|---|---|---|
| A | Clear evidence from well-conducted RCTs/meta-analyses | `rct` | `ROUTE_TO_CLINICIAN` if violated |
| B | Supportive evidence from well-conducted cohort studies | `cohort` | `ROUTE_TO_CLINICIAN` or `REQUEST_MORE_INFO` |
| C | Supportive evidence from poorly controlled or uncontrolled studies | `case_series` | `REQUEST_MORE_INFO` |
| E | Expert consensus or clinical experience | `expert_opinion` | Informational |

#### KDIGO System (CKD guidelines)

| KDIGO | Meaning | Hermes EvidenceGrade | Typical Enforcement |
|---|---|---|---|
| 1A | Recommend, high quality | `rct` | `ROUTE_TO_CLINICIAN` if violated |
| 1B | Recommend, moderate quality | `cohort` | `ROUTE_TO_CLINICIAN` if violated |
| 1C/1D | Recommend, low/very low quality | `case_series` or `expert_opinion` | `ROUTE_TO_CLINICIAN` if violated (clinician may have reason to deviate) |
| 2A-2D | Suggest (weaker) | varies | `REQUEST_MORE_INFO` or informational |
| Practice Point | Expert-informed, no formal evidence grading | `expert_opinion` | Informational |

---

## Schema Changes Required

### In PolicyRule (policy-engine/types.ts)

Add `provenance` as an optional field on `PolicyRule`:

```typescript
export interface PolicyRule {
  rule_id: string;
  description: string;
  priority: number;
  requires_human_review?: boolean;
  when: RuleCondition;
  then: RuleAction;

  // NEW: Structured provenance
  provenance?: RuleProvenance;
}
```

**Why optional:** Core safety rules that predate this spec set may not have full provenance initially. The migration path is to add provenance incrementally, starting with new clinically grounded rules.

### In PolicyPackMetadata (policy-engine/types.ts)

Extend `PolicySource` with additional fields:

```typescript
export interface PolicySource {
  kind: 'policy' | 'guideline' | 'medication_label' | 'governance' | 'other';
  citation: string;
  source_url?: string;
  doi?: string;
  version_date?: string;  // When the source was published/updated
}
```

### In SupervisionResponse (Hermes schema)

Consider adding a `rule_citations` field to the response so that clinicians receiving routed proposals can see which sources drove the decision:

```typescript
// In SupervisionResponse, new optional field:
rule_citations?: Array<{
  rule_id: string;
  source_type: string;
  citation: string;
  citation_subsection?: string;
}>;
```

This is a Hermes schema change and should go through the Hermes versioning process. It is not required for the initial implementation — provenance can live in audit events before it appears in the response.

### In AuditEvent (Hermes schema)

Audit events already support `tags: Record<string, string>`. Rule provenance can be included in tags immediately without schema changes:

```json
{
  "tags": {
    "decision": "ROUTE_TO_CLINICIAN",
    "rule_id": "acei_angioedema_contraindication",
    "source_type": "contraindication",
    "source_layer": "1",
    "citation": "Lisinopril SPL, Section 4 — History of angioedema"
  }
}
```

For richer provenance in audit events, a structured `rule_provenance` field could be added in a future Hermes version.

---

## YAML Representation

In policy pack YAML files, provenance is expressed per-rule:

```yaml
rules:
  - rule_id: sglt2i_egfr_initiation_check
    description: SGLT2i initiation requires eGFR verification per guideline and labeling
    priority: 200  # Layer 2 domain rule: 100-299 per normative priority table
    provenance:
      source_type: society_guideline
      source_layer: 2
      citation: "KDIGO 2024 CKD Guideline"
      citation_subsection: "Recommendation 3.8.1 — initiate SGLT2i at eGFR ≥20"
      source_url: "https://kdigo.org/wp-content/uploads/2024/03/KDIGO-2024-CKD-Guideline.pdf"
      evidence_grade: rct
      native_grading:
        system: KDIGO
        kdigo_strength: "1"
        kdigo_quality: A
      jurisdiction: global
      clinical_domain: cardiovascular
      applicable_population: "Patients initiating SGLT2i therapy"
      approved_by: "Dr. [Name], Cardiology"
      effective_date: "2026-04-15"
      review_interval_days: 365
      review_due: "2027-04-15"
      additional_sources:
        - source_type: medication_label
          source_layer: 1
          citation: "Empagliflozin (Jardiance) SPL, Section 2.2 — Dosage and Administration, Renal Impairment"
          source_url: "https://dailymed.nlm.nih.gov/dailymed/..."
          evidence_grade: policy
          native_grading:
            system: FDA_LABEL
            fda_label_section: "2.2"
    when:
      kind: all_of
      conditions:
        - kind: proposal_kind_in
          kinds: [MEDICATION_ORDER_PROPOSAL]
        - kind: medication_class_in       # NEW condition kind (requires Phase 0 contract)
          classes: ["A10BK"]            # ATC 4th-level: SGLT2 inhibitors
        - kind: snapshot_lab_missing      # NEW condition kind
          lab: egfr
    then:
      decision: REQUEST_MORE_INFO
      reason_codes:
        - data_quality_warning
        - needs_human_review
      explanation: >
        SGLT2i initiation requires verification of current eGFR per KDIGO 2024
        (initiate at eGFR ≥20) and FDA labeling. Current snapshot does not
        contain eGFR. Please provide recent renal function data.
```

**Note on this example:** Earlier drafts incorrectly labeled SGLT2i eGFR <20 as a Section 4 contraindication. For current U.S. empagliflozin labeling, the eGFR threshold appears in Section 2 (Dosage and Administration), not Section 4 (Contraindications). The KDIGO guideline recommends initiation at eGFR ≥20. The rule above checks for missing eGFR data (the prerequisite check); a separate rule would check if eGFR < 20 when the value is present.

---

## New Condition Kinds Needed

To support clinically grounded rules, the policy engine needs new condition kinds that can match on clinical content in proposals and snapshots:

| Condition Kind | Purpose | Example |
|---|---|---|
| `medication_class_in` | Match proposals involving specific medication classes | `classes: ["A10BK", "C09AA", "C09CA"]` (ATC 4th-level codes; see Hermes `06` §5.4) |
| `medication_name_in` | Match proposals for specific medications | `names: ["empagliflozin", "dapagliflozin"]` (normalized generic names) |
| `snapshot_lab_below` | Check if a lab value in the snapshot is below threshold | `lab: "egfr", threshold: 20` |
| `snapshot_lab_above` | Check if a lab value is above threshold | `lab: "potassium", threshold: 5.5` |
| `snapshot_condition_present` | Check if a condition is documented in the snapshot | `condition: "angioedema_history"` |
| `snapshot_lab_missing` | Check if a required lab value is not in the snapshot | `lab: "egfr"` |
| `dose_exceeds_max` | Check if proposed dose exceeds maximum | `max_dose_mg: 10, medication: "lisinopril"` |
| `combination_present` | Check if two medication classes would be combined | `class_a: "C09AA", class_b: "C09CA"` (ACEi + ARB dual RAS blockade) |
| `allergy_match` | Check if proposal medication matches a documented allergy | `match_on: "atc_class"` or `match_on: "substance"` (matches proposal against `snapshot_payload.medication_allergies`) |
| `snapshot_field_missing` | Check if a required snapshot field is null (data unavailable) | `field: "active_medications"` (distinguishes null/unavailable from empty/confirmed-none) |

These condition kinds consume upstream data from typed Hermes proposals and clinical snapshot payloads:

| Condition Kind | Upstream Data Source | Contract Reference |
|---|---|---|
| `medication_class_in` | `proposal.medication.atc_class` | Hermes `02` §3.3 + `06` §2.1 |
| `medication_name_in` | `proposal.medication.name` | Hermes `02` §3.3 |
| `snapshot_lab_below/above` | `snapshot_payload.recent_labs[].lab_id + .value` | Hermes `06` §1.5 |
| `snapshot_lab_missing` | `snapshot_payload.recent_labs` | Hermes `06` §1.5 |
| `snapshot_condition_present` | `snapshot_payload.active_conditions[].condition_id` | Hermes `06` §1.6 |
| `dose_exceeds_max` | `proposal.structured_dose.to.value + .unit` | Hermes `06` §1.4 |
| `combination_present` | `snapshot_payload.active_medications[].atc_class` + `proposal.medication.atc_class` | Hermes `06` §1.3 |
| `allergy_match` | `snapshot_payload.medication_allergies[].atc_class` or `.substance` + `proposal.medication.atc_class` or `.name` | Hermes `06` §1.8 |
| `snapshot_field_missing` | `snapshot_payload.{field}` is `null` (data unavailable, not confirmed empty) | Hermes `06` §1.2 + Deutsch `11` §3.4 |

**Contract status:** The Hermes contract defines all required fields (see `06-hermes-clinical-supervision-contract.md`). The Hermes JSON schema types them. Vocabulary tables define canonical coding systems (RxNorm for meds, LOINC for labs, SNOMED for conditions, ATC for classes).

**Runtime status:** Deutsch does not yet populate these fields. The migration is defined in Deutsch `11-deutsch-to-popper-clinical-projection-spec.md` and tracked as Phase 0 in the roadmap. **These condition kinds should not be added to the Popper evaluator until Phase 0 runtime migration is complete and integration-tested.**

**Implementation note:** These condition kinds should be added incrementally as domain packs are built. The first domain pack (HF) will identify the minimum set needed.

---

## Provenance Registry

Beyond per-rule provenance, Popper should maintain a **source registry** — a catalog of all authoritative sources that rules can reference:

```yaml
# config/sources/registry.yaml
sources:
  - source_id: aha-acc-hf-2022
    title: "2022 AHA/ACC/HFSA Guideline for the Management of Heart Failure"
    type: society_guideline
    issuing_body: "AHA/ACC/HFSA"
    publication_date: "2022-04-01"
    doi: "10.1161/CIR.0000000000001063"
    url: "https://www.ahajournals.org/doi/10.1161/CIR.0000000000001063"
    supersedes: null
    superseded_by: null
    review_status: active
    last_reviewed: "2026-03-19"
    next_review_due: "2027-03-19"
    rules_derived: 12  # count of rules referencing this source

  - source_id: dailymed-lisinopril
    title: "Lisinopril Structured Product Labeling"
    type: medication_label
    issuing_body: "FDA/NLM"
    publication_date: "2025-08-01"
    url: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=..."
    label_revision_date: "2025-08-01"
    review_status: active
    last_reviewed: "2026-03-19"
    next_review_due: "2026-06-19"  # 90-day review for labels
    rules_derived: 4
```

The source registry enables:
- **Impact analysis:** When a guideline is updated, query all rules derived from that source
- **Review tracking:** Which sources are overdue for review?
- **Completeness audit:** Are there sources in the registry with no derived rules?
- **Regulatory documentation:** Export the source registry for accreditation reviews

---

## Validation Rules for Provenance

The policy pack loader should enforce:

1. **Domain pack rules MUST have provenance.** Rules in domain packs without a `provenance` field should be rejected at load time.
2. **Core safety rules SHOULD have provenance.** Not enforced at load time, but flagged in a completeness report.
3. **Site protocol rules MUST reference an approved site protocol.** The `local_protocol_dependency` field should be non-null.
4. **Review dates must not be in the past.** Rules with expired `review_due` dates should trigger a governance alert (not a policy engine failure).
5. **Source layer must match source type.** A `medication_label` source type must have `source_layer: 1`. A `society_guideline` must have `source_layer: 2`. The loader should validate this.
