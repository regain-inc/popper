# 04 — Policy Pack Architecture

> **Version**: 0.1.0
> **Date**: 2026-03-19

---

## Overview

Popper's policy engine currently loads a single policy pack (`config/policies/default.yaml`) containing 32 rules. This document specifies how policy packs should be structured, composed, versioned, and loaded to support clinically grounded, site-configurable, domain-specific supervision.

---

## Pack Types

### 1. Core Safety Pack (universal, always loaded)

**Purpose:** Hard safety rules that apply regardless of clinical domain, site, or configuration.

**Contains:**
- Schema validation rules (priority 1000+)
- Staleness rules (priority 900-999)
- Safe-mode enforcement rules (priority 800-899)
- Input risk / prompt injection rules (priority 700-799)
- Hallucination detection rules (priority 400-499)
- System failure rules (priority 300-399)
- Default fallback route-to-clinician (priority 0)

**Override policy:** Cannot be overridden by any other pack. Site packs and domain packs can add rules but cannot weaken or disable core safety rules.

**Current state:** The existing `default.yaml` is effectively the core safety pack, though it also contains evidence quality and acuity rules that may be better placed in domain packs.

**Proposed pack ID:** `popper-core-safety`

### 2. Domain Packs (loaded per clinical domain)

**Purpose:** Clinical rules derived from society guidelines and medication labels for a specific domain.

**Examples:**
- `cardiometabolic-hf` — Heart failure medication supervision
- `cardiometabolic-htn` — Hypertension management rules
- `cardiometabolic-lipids` — Lipid therapy sequencing and monitoring
- `cardiometabolic-diabetes-cv` — Diabetes cardiovascular risk management
- `cardiometabolic-ckd` — Renal safety rules overlapping with CV medications
- `cardiometabolic-af` — Atrial fibrillation / anticoagulation supervision

**Contains:**
- Medication-specific contraindication checks (from Layer 1 sources)
- Guideline-derived therapy appropriateness rules (from Layer 2 sources)
- Cross-guideline rules where multiple sources govern the same clinical scenario
- Each rule carries structured provenance (see `05-rule-provenance-and-evidence-model.md`)

**Priority range:** Domain packs occupy two disjoint sub-ranges:
- **700-799:** Layer 1 domain rules (contraindications, label safety, drug interactions, allergy matches). These sit ABOVE the core pack's evidence-quality rules (600-699) so that a patient-specific contraindication check always fires before generic evidence-quality checks.
- **100-299:** Layer 2 domain rules (guideline-derived therapy appropriateness, monitoring requirements). These fire after acuity and conflict checks but before default approval.

**Why 700-799 for Layer 1 domain rules:** The existing core pack uses 700-799 for input risk flags (prompt injection, jailbreak). Layer 1 domain rules (contraindications) are safety-critical and should evaluate at the same tier. The core pack's input risk rules use `kind: input_risk_flag_in` which will not match against medication proposals, so there is no condition-overlap conflict — the rules target different scenarios at the same priority tier.

**Why not interleave with 600-699:** The current evaluator uses first-match-wins without `continue`. If a Layer 1 contraindication rule at priority 650 is placed alongside a generic `medication_missing_evidence` rule at priority 650, evaluation order becomes nondeterministic. Placing Layer 1 domain rules at 700-799 guarantees they evaluate before generic evidence checks.

**Normative priority table (referenced by all Popper specs):**

| Priority Range | Owner | Contents |
|---|---|---|
| 1000+ | Core safety | Schema/security (immutable) |
| 900-999 | Core safety | Staleness (immutable) |
| 800-899 | Core safety | Safe-mode (immutable) |
| 700-799 | Core safety + **Domain L1** | Input risk flags (core) + contraindications, label safety, drug interactions, allergy matches (domain Layer 1) |
| 600-699 | Core safety | Evidence quality, HTV score, evidence grade (core) |
| 500-599 | Core safety | Uncertainty (core) |
| 400-499 | Core safety | Hallucination detection (core) |
| 300-399 | Core safety | Cross-domain conflicts (core) |
| 200-299 | Core safety + **Domain L2** | Acuity/intervention risk (core) + guideline-derived therapy rules (domain Layer 2) |
| 100-199 | **Domain L2** | Additional guideline rules, monitoring requirements |
| 50-99 | **Site packs** | Formulary, escalation, scope-of-practice |
| 0-10 | Core safety | Default approval (wellness) + default fallback route-to-clinician |

**Override policy:** Domain packs can be more restrictive than core but cannot weaken core safety rules. Multiple domain packs can be loaded simultaneously; rules are merged and evaluated by priority.

**Proposed naming convention:** `domain-{specialty}-{subdomain}`

### 3. Site Protocol Packs (loaded per organization/facility)

**Purpose:** Local institutional rules that customize supervision for a specific medical center.

**Contains:**
- Formulary compliance rules
- Escalation pathway customization
- Scope-of-practice enforcement
- Institutional protocol references
- Local threshold adjustments (within governed bounds)

**Priority range:** 50-99 (below domain packs, above default approval)

**Override policy:** Can add restrictions (more conservative). Cannot remove or weaken Layer 1 or Layer 2 rules. See `07-site-protocol-pack-and-localization.md`.

**Proposed naming convention:** `site-{org_id}-{site_id}`

### 4. Governance / Monitoring Configuration (control-plane, NOT request-time)

**Purpose:** Governance and accreditation requirements operate at the control-plane level, not as patient-level rules in the supervision decision loop.

**Contains:**
- Audit completeness enforcement (emitter configuration, not per-request rules)
- Drift detection thresholds and monitoring configuration
- Compliance export requirements
- Bias monitoring thresholds (when implemented)
- Review-due-date alerting for rules and source registry

**Execution model:** Governance requirements are NOT merged into the first-match rule list alongside contraindications and staleness checks. They are:
- **Configuration** loaded by the control plane (`apps/server/src/plugins/control.ts`)
- **Validators** that run as pre/post hooks around supervision (e.g., "verify audit event was emitted")
- **Cron-driven monitors** that check rule review status, drift baselines, and source registry freshness

This separation is important. Audit completeness, drift thresholds, and export obligations are structural concerns about how Popper operates, not patient-level decisions about whether a specific proposal is safe. Mixing them into the same first-match-wins decision loop creates the wrong abstraction boundary.

**Proposed config ID:** `popper-governance`

### 5. Modality Packs (loaded when imaging data is present)

**Purpose:** Imaging-specific quality and provenance validation rules. See `03-imaging-and-modality-extension-map.md`.

**Not yet implemented.** Architecture defined for future use.

---

## Pack Composition Model

### Loading

When Popper evaluates a `SupervisionRequest`, it loads and composes packs based on:

1. **Core safety pack** — always loaded
2. **Domain packs** — loaded based on `contributing_domains` in the request, or based on organization configuration
3. **Site protocol pack** — loaded based on `organization_id` in the request
4. **Governance pack** — loaded if governance monitoring is enabled for the organization
5. **Modality packs** — loaded if `snapshot.imaging_studies` or `snapshot.imaging_findings` are present

### Merge Strategy

All clinical packs are merged into a single rule list, sorted by priority (descending). The existing first-match-wins evaluation semantics apply. Governance configuration is NOT in this merge.

```
Merged rules = sort_by_priority_desc(
  core_safety.rules
  + domain_pack_1.rules
  + domain_pack_2.rules
  + site_pack.rules
  + modality_pack.rules (if applicable)
)
```

**First-match-wins** means the highest-priority matching rule determines the decision. This ensures core safety rules (priority 1000+) always take precedence over domain Layer 1 rules (700-799) which take precedence over core evidence/uncertainty checks (500-699) which take precedence over domain Layer 2 rules (100-299) which take precedence over site rules (50-99). See the normative priority table above for the complete ordering.

### Conflict Detection

The pack loader should validate at load time that:

1. **No site rule weakens a core safety rule.** If a site pack contains a rule that would produce `APPROVED` for a scenario where the core pack produces `HARD_STOP`, the pack should be rejected.
2. **No two rules from different packs may share the same priority.** The loader MUST reject a pack if it introduces a rule at a priority already occupied by another loaded pack's rule. This eliminates nondeterministic evaluation order under first-match-wins. Within a single pack, the pack author controls ordering and may use identical priorities intentionally (evaluated in declared order).
3. **Pack versions are compatible.** Each pack declares a minimum core pack version it is compatible with.
4. **Tie-break invariant:** If the evaluator encounters two rules at the same priority (which should only happen within one pack), the rule declared first in the YAML file wins. This is already the behavior of array-order iteration but must be documented as normative.

---

## Pack Versioning

### Version Format

Each pack uses semantic versioning:

```yaml
policy_id: domain-cardiometabolic-hf
policy_version: 1.2.0  # major.minor.patch
```

- **Major:** Breaking changes to rule IDs or conditions (may require site pack updates)
- **Minor:** New rules added, no existing rules removed or changed
- **Patch:** Rule description or explanation text changes only

### Version Pinning

Site packs should pin to a major version of their parent domain pack:

```yaml
# site-pack.yaml
depends_on:
  - pack_id: domain-cardiometabolic-hf
    version_constraint: ">=1.0.0, <2.0.0"
  - pack_id: popper-core-safety
    version_constraint: ">=1.0.0"
```

### Version in Audit Trail

The `TraceContext.producer.ruleset_version` field in every `SupervisionResponse` should include the composite version of all loaded packs:

```
ruleset_version: "core:1.1.0+hf:1.2.0+site-regain-chi:0.3.0"
```

This ensures every decision is traceable to the exact pack versions that were active.

---

## Pack File Structure

### Proposed directory layout

```
config/policies/
├── core/
│   └── safety.yaml                    # Core safety pack (refactored from default.yaml)
├── domains/
│   ├── cardiometabolic-hf.yaml
│   ├── cardiometabolic-htn.yaml
│   ├── cardiometabolic-lipids.yaml
│   ├── cardiometabolic-diabetes-cv.yaml
│   ├── cardiometabolic-ckd.yaml
│   └── cardiometabolic-af.yaml
├── sites/
│   ├── regain-chi/                    # Example: Regain Health Chicago site
│   │   ├── protocol.yaml
│   │   └── formulary.yaml
│   └── regain-sa/                     # Example: Regain Health Saudi Arabia site
│       ├── protocol.yaml
│       └── formulary.yaml
├── governance/
│   └── monitoring.yaml
├── modalities/                        # Future
│   ├── echo.yaml
│   ├── cardiac-ct.yaml
│   └── nuclear-pet.yaml
└── reconfigure/
    └── default.yaml                   # Existing drift-response policies
```

### Pack YAML Schema Extension

Each pack should include the following metadata fields (extending the existing `PolicyPackMetadata`):

```yaml
policy_id: domain-cardiometabolic-hf
policy_version: 1.0.0
pack_type: domain  # core | domain | site | governance | modality

metadata:
  description: Heart failure medication supervision rules
  owner: Clinical Governance Board
  clinical_reviewer: "Dr. [Name], Cardiology"
  approved_at: "2026-04-15"
  review_interval_days: 365
  created_at: "2026-03-19"
  jurisdiction: US  # Regulatory jurisdiction (US, SA, EU, global)
  sources:
    - kind: guideline
      citation: "2022 AHA/ACC/HFSA HF Guideline, Circulation 2022;145:e895-e1032"
      source_url: "https://doi.org/10.1161/CIR.0000000000001063"
    - kind: guideline
      citation: "2024 ACC ECDP for HFrEF Treatment"
      source_url: "https://doi.org/10.1016/j.jacc.2023.12.024"

depends_on:
  - pack_id: popper-core-safety
    version_constraint: ">=1.0.0"

rules:
  # ...
```

---

## Migration Path from Current State

### Step 1: Refactor default.yaml into core safety pack
- Move structural safety rules (schema, staleness, safe-mode, input risk, hallucination, system failure, default) into `core/safety.yaml`
- Move evidence quality rules (evidence_missing, htv_score, evidence_grade) and acuity/intervention risk rules into a new `domains/cardiometabolic-general.yaml` (or keep in core if they should be domain-agnostic)
- Maintain backward compatibility: `default.yaml` can remain as an alias that loads both packs

### Step 2: Build first domain pack
- Create `domains/cardiometabolic-hf.yaml` with rules derived from Wave 1 sources (medication labels + 2022 HF guideline)
- Each rule includes structured provenance
- Clinical governance review before activation

### Step 3: Build pack composition in the policy engine
- Update `packages/core/src/policy-engine/loader.ts` to support loading multiple packs
- Implement merge logic with priority-based ordering
- Add conflict detection

### Step 4: Build site protocol pack support
- Define site pack schema
- Implement override validation (cannot weaken core/domain rules)
- Create first site pack for testing

---

## Implementation Notes

### Changes Needed in policy-engine

| Component | Change |
|---|---|
| `loader.ts` | Support loading multiple packs from different directories |
| `parser.ts` | Validate new metadata fields (`pack_type`, `depends_on`, rule-level `provenance`) |
| `evaluator.ts` | Accept merged rule list from multiple packs (existing first-match-wins semantics work as-is) |
| `types.ts` | Add `pack_type`, `depends_on`, `provenance` to `PolicyPack` and `PolicyRule` types |

### Changes Needed in Hermes

| Field | Change |
|---|---|
| `TraceContext.producer.ruleset_version` | Include composite pack versions |
| New `RuleProvenance` type | Structured provenance per rule (see `05-rule-provenance-and-evidence-model.md`) |

### No Changes Needed

- The evaluation semantics (first-match-wins, priority ordering) do not change
- The decision types (`APPROVED`, `HARD_STOP`, `ROUTE_TO_CLINICIAN`, `REQUEST_MORE_INFO`) do not change
- The existing supervision HTTP endpoint does not change
- Audit event emission does not change (though events may carry richer rule citation data)
