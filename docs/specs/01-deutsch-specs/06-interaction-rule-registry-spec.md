---
version: 1.0.0
last-updated: 2026-01-24
status: draft
owner: Deutsch Dev Team
tags: [advocate, ta1, deutsch, registry, interactions, rules]
---

# Interaction Rule Registry Spec — v1

## 0) Executive Summary

This spec defines the format and semantics for interaction rule registries. These registries contain the rules that the Interaction Rule Engine uses to detect and resolve cross-domain conflicts.

**Key principles:**

1. **Rules are data, not code** — Registries are declarative YAML/JSON
2. **Versioned and auditable** — Every rule change is tracked
3. **Composable** — Multiple registries can be loaded together
4. **Evidence-backed** — Every resolution must cite evidence

## 1) Registry Types

### 1.1 Registry Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                     Registry Hierarchy                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Core Registries (shipped with Deutsch)                        │
│  ├── conflict-types://core/v1                                  │
│  ├── drug-interactions://rxnorm/v1                             │
│  └── condition-interactions://core/v1                          │
│                                                                 │
│  Domain Registries (shipped with domain modules)               │
│  ├── registries://nutrition/drug-nutrient                      │
│  ├── registries://cardiology/condition-lifestyle               │
│  └── registries://nephrology/condition-diet                    │
│                                                                 │
│  Organization Registries (TA3 site-specific)                   │
│  ├── registries://org_ta3_alpha/protocols                      │
│  ├── registries://org_ta3_alpha/overrides                      │
│  └── registries://org_ta3_alpha/custom-rules                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Registry Precedence

When rules conflict:

1. **Organization registries** override domain registries
2. **Domain registries** override core registries
3. **More specific rules** override more general rules
4. **Later effective dates** override earlier dates

## 2) Registry Format

### 2.1 Registry Envelope

```yaml
# Every registry file MUST have this envelope
registry_id: "registries://domain/name"
version: "1.0.0"
description: "Human-readable description"
created_at: "2026-01-24T00:00:00Z"
updated_at: "2026-01-24T00:00:00Z"

# Compatibility
min_engine_version: "1.0.0"
max_engine_version: null  # null = no upper bound

# Ownership
owner: "team-name"
maintainers:
  - "person@example.com"

# Dependencies (other registries this one extends/requires)
dependencies:
  - registry_id: "conflict-types://core/v1"
    min_version: "1.0.0"

# The rules themselves
rules:
  - # ... rule definitions
```

### 2.2 Rule Structure

```yaml
rules:
  - rule_id: "unique-rule-identifier"
    version: "1.0.0"
    status: "active"  # active | deprecated | experimental

    # ═══════════════════════════════════════════════════════════
    # TRIGGER: When does this rule apply?
    # ═══════════════════════════════════════════════════════════
    trigger:
      domain_a: "nutrition"           # First domain
      domain_b: "cardiology"          # Second domain (or "*" for any)

      # Optional: Narrow the trigger
      condition: "HF"                 # Specific condition
      medication_class: "ACE_INHIBITOR"  # Medication class
      medication_name: null           # Specific medication (rare)
      signal_pattern: "potassium > 5.0"  # Signal threshold
      mode: null                      # "wellness" | "advocate_clinical" | null (both)

    # ═══════════════════════════════════════════════════════════
    # CONFLICT: What kind of conflict is this?
    # ═══════════════════════════════════════════════════════════
    conflict_type: "drug_nutrient_interaction"
    severity: "high"                  # low | medium | high | critical
    description: "ACE inhibitors can cause hyperkalemia; potassium-rich foods may exacerbate"

    # ═══════════════════════════════════════════════════════════
    # RESOLUTION: How should it be resolved?
    # ═══════════════════════════════════════════════════════════
    resolution:
      strategy: "constrain"           # override | constrain | merge | sequence | escalate

      # For 'override': which domain wins
      winning_domain: null

      # For 'constrain': what constraint to apply
      constraint: "potassium_limit_3500mg"
      constraint_details:
        nutrient: "potassium"
        limit_mg: 3500
        rationale: "Reduce hyperkalemia risk"

      # For 'sequence': ordering
      sequence: null

      # For 'merge': how to combine
      merge_strategy: null

      # For all: what the modified recommendation should say
      modified_recommendation: "Limit potassium intake to <3500mg/day while on ACE inhibitor"

    # ═══════════════════════════════════════════════════════════
    # EVIDENCE: Why is this resolution correct?
    # ═══════════════════════════════════════════════════════════
    evidence_refs:
      - evidence_id: "interaction.ace-potassium.lexicomp"
        evidence_type: "policy"
        citation: "Lexicomp Drug Interaction Database"
        uri: "evidence://lexicomp/ace-potassium"

      - evidence_id: "guideline.aha-hf-nutrition.2022"
        evidence_type: "guideline"
        citation: "2022 AHA/ACC/HFSA HF Guideline, Section 9.1"
        uri: "evidence://guidelines/aha-hf-nutrition-2022"

    # ═══════════════════════════════════════════════════════════
    # METADATA
    # ═══════════════════════════════════════════════════════════
    effective_date: "2024-01-01"
    expiration_date: null             # null = no expiration
    supersedes: null                  # Previous rule_id this replaces
    tags:
      - "hyperkalemia"
      - "ace-inhibitor"
      - "dietary-restriction"

    # ═══════════════════════════════════════════════════════════
    # AUDIT
    # ═══════════════════════════════════════════════════════════
    audit_redaction:
      summary: "Drug-nutrient interaction requiring dietary modification"
```

## 3) Trigger Specification

### 3.1 Domain Matching

```yaml
# Exact match
domain_a: "nutrition"
domain_b: "cardiology"

# Wildcard (matches any domain)
domain_a: "nutrition"
domain_b: "*"

# Category match (matches any domain in category)
domain_a: "nutrition"
domain_b_category: "clinical"  # All clinical domains
```

### 3.2 Condition Matching

```yaml
# Exact condition
condition: "HF"

# Multiple conditions (OR)
condition:
  any_of: ["HF", "HFrEF", "HFpEF"]

# Multiple conditions (AND)
condition:
  all_of: ["HF", "CKD"]

# Condition with stage/severity
condition:
  name: "CKD"
  stage: ">= 3"

# Condition category
condition_category: "cardiovascular"
```

### 3.3 Medication Matching

```yaml
# Medication class
medication_class: "ACE_INHIBITOR"

# Multiple classes (OR)
medication_class:
  any_of: ["ACE_INHIBITOR", "ARB"]

# Specific medication
medication_name: "lisinopril"

# Medication with dose threshold
medication:
  class: "DIURETIC"
  dose_threshold: "> 40mg furosemide equivalent"
```

### 3.4 Signal Pattern Matching

```yaml
# Simple threshold
signal_pattern: "potassium > 5.0"

# Complex pattern
signal_pattern:
  all_of:
    - "potassium > 4.5"
    - "creatinine > 1.5"

# Trend-based
signal_pattern:
  signal: "weight"
  trend: "increasing"
  period_days: 7
  threshold_change: "+3 lbs"
```

## 4) Resolution Strategies

### 4.1 Override

One domain's recommendation completely replaces another's:

```yaml
resolution:
  strategy: "override"
  winning_domain: "cardiology"
  rationale: "Clinical safety takes precedence"
```

**Use when:**
- Clear safety contraindication
- One recommendation is clearly wrong in context
- Guideline explicitly prohibits the other recommendation

### 4.2 Constrain

Modify a recommendation to make it compatible:

```yaml
resolution:
  strategy: "constrain"
  constraint: "intensity_limit_moderate"
  constraint_details:
    parameter: "exercise_intensity"
    limit: "moderate"
    original_recommendation: "high_intensity"
    modified_recommendation: "moderate_intensity"
  rationale: "HF limits exercise intensity tolerance"
```

**Use when:**
- Recommendation is valid but needs adjustment
- Both domains can coexist with modification
- Limits/thresholds can resolve the conflict

### 4.3 Merge

Combine compatible parts of recommendations:

```yaml
resolution:
  strategy: "merge"
  merge_strategy: "intersection"
  merged_elements:
    - from: "nutrition"
      elements: ["low_sodium", "high_fiber"]
    - from: "cardiology"
      elements: ["fluid_restriction", "low_sodium"]
  result: "Combined dietary plan with low sodium, fluid restriction, and high fiber"
```

**Use when:**
- Recommendations have overlapping compatible elements
- A unified plan is better than separate plans
- No direct conflicts, just need coordination

### 4.4 Sequence

Time-order the recommendations:

```yaml
resolution:
  strategy: "sequence"
  sequence:
    - domain: "cardiology"
      action: "stabilize_medications"
      timing: "first"
      duration: "2_weeks"
    - domain: "exercise"
      action: "begin_cardiac_rehab"
      timing: "after_medication_stable"
  rationale: "Medication stability required before exercise progression"
```

**Use when:**
- Both recommendations are valid but have timing dependencies
- One must happen before the other
- Phased approach is clinically appropriate

### 4.5 Escalate

Cannot auto-resolve; requires clinician review:

```yaml
resolution:
  strategy: "escalate"
  escalation_reason: "guideline_disagreement"
  domains_in_conflict: ["domain_a", "domain_b"]
  options_for_clinician:
    - option: "follow_domain_a"
      rationale: "..."
    - option: "follow_domain_b"
      rationale: "..."
    - option: "custom_resolution"
      rationale: "Clinician to determine"
```

**Use when:**
- Genuine guideline disagreement
- High uncertainty in resolution
- Clinical judgment required
- Risk too high for auto-resolution

## 5) Conflict Type Registry

### 5.1 Core Conflict Types

Shipped with Deutsch core:

```yaml
# conflict-types://core/v1

registry_id: "conflict-types://core/v1"
version: "1.0.0"
description: "Core conflict type definitions"

types:
  drug_nutrient_interaction:
    description: "Medication interacts with food, supplement, or nutrient"
    severity_default: "high"
    requires_evidence: true
    auto_escalate_if_uncertain: true
    example: "Warfarin interaction with vitamin K"

  drug_activity_contraindication:
    description: "Medication affects ability to perform physical activity"
    severity_default: "high"
    requires_evidence: true
    auto_escalate_if_uncertain: true
    example: "Beta-blocker limiting heart rate response during exercise"

  condition_nutrient_restriction:
    description: "Medical condition requires dietary modification"
    severity_default: "medium"
    requires_evidence: true
    auto_escalate_if_uncertain: false
    example: "CKD requiring phosphorus restriction"

  condition_activity_restriction:
    description: "Medical condition limits physical activity"
    severity_default: "high"
    requires_evidence: true
    auto_escalate_if_uncertain: true
    example: "Severe HF limiting exercise intensity"

  temporal_scheduling:
    description: "Timing conflict between recommendations"
    severity_default: "low"
    requires_evidence: false
    auto_escalate_if_uncertain: false
    example: "Medication timing vs meal timing"

  resource_competition:
    description: "Same resource needed differently by domains"
    severity_default: "medium"
    requires_evidence: false
    auto_escalate_if_uncertain: false
    example: "Caloric intake: weight loss goal vs energy for exercise"

  guideline_disagreement:
    description: "Two clinical guidelines provide conflicting recommendations"
    severity_default: "high"
    requires_evidence: true
    auto_escalate_if_uncertain: true
    example: "Specialty society A vs specialty society B disagree"

  uncertainty_propagation:
    description: "Uncertainty in one domain affects recommendations in another"
    severity_default: "medium"
    requires_evidence: false
    auto_escalate_if_uncertain: false
    example: "Uncertain diagnosis affecting dietary recommendations"
```

### 5.2 Custom Conflict Types

Domains can register custom types:

```yaml
# registries://oncology/conflict-types

registry_id: "registries://oncology/conflict-types"
version: "1.0.0"
description: "Oncology-specific conflict types"

extends: "conflict-types://core/v1"

types:
  chemotherapy_diet_timing:
    description: "Chemotherapy schedule affects meal timing and tolerance"
    severity_default: "medium"
    requires_evidence: true
    auto_escalate_if_uncertain: false
    example: "Anti-nausea dietary strategies around infusion"

  immunosuppression_activity_risk:
    description: "Immunosuppressed state affects activity recommendations"
    severity_default: "high"
    requires_evidence: true
    auto_escalate_if_uncertain: true
    example: "Neutropenia limiting group exercise"
```

## 6) Registry Management

### 6.1 Versioning Rules

- Registries follow semver
- **Patch** (1.0.x): Bug fixes, evidence updates, no behavior change
- **Minor** (1.x.0): New rules, deprecated rules (backward compatible)
- **Major** (x.0.0): Breaking changes, removed rules, changed semantics

### 6.2 Rule Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    Rule Lifecycle                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  experimental ──▶ active ──▶ deprecated ──▶ removed        │
│       │              │            │                         │
│       │              │            └── Still applied but     │
│       │              │                warning logged        │
│       │              │                                      │
│       │              └── Normal operation                   │
│       │                                                     │
│       └── Applied with warning, may change                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 Supersession

When a rule is updated:

```yaml
rules:
  - rule_id: "nutrition-cardiology-ace-potassium-v2"
    version: "2.0.0"
    supersedes: "nutrition-cardiology-ace-potassium-v1"
    # ... new rule definition

  - rule_id: "nutrition-cardiology-ace-potassium-v1"
    version: "1.0.0"
    status: "deprecated"
    deprecated_by: "nutrition-cardiology-ace-potassium-v2"
    deprecation_date: "2026-01-24"
```

### 6.4 Organization Overrides

TA3 sites can override rules:

```yaml
# registries://org_ta3_alpha/overrides

registry_id: "registries://org_ta3_alpha/overrides"
version: "1.0.0"
description: "Site-specific rule overrides"

overrides:
  - base_rule_id: "nutrition-cardiology-ace-potassium-v2"
    override_type: "modify"
    modifications:
      constraint_details:
        limit_mg: 3000  # More restrictive than default 3500
    rationale: "Site protocol requires stricter potassium limits"
    approved_by: "clinical_governance_committee"
    approval_date: "2026-01-15"
```

## 7) Engine Integration

### 7.1 Registry Loading

```ts
interface RegistryLoader {
  // Load a single registry
  load(ref: string): Promise<Registry>;

  // Load multiple registries with dependency resolution
  loadAll(refs: string[]): Promise<RegistryLoadResult>;

  // Validate registry format
  validate(registry: Registry): ValidationResult;

  // Check compatibility
  checkCompatibility(
    registries: Registry[],
    engineVersion: string
  ): CompatibilityResult;
}

interface RegistryLoadResult {
  registries: Registry[];
  load_order: string[];           // Dependency-resolved order
  failed: Array<{
    ref: string;
    error: string;
  }>;
  warnings: string[];
  total_rules: number;
  active_rules: number;
}
```

### 7.2 Rule Matching

```ts
interface RuleMatcher {
  // Find rules that apply to a domain pair
  findRules(
    domain_a: string,
    domain_b: string,
    context: MatchContext
  ): MatchedRule[];

  // Check if a specific proposal triggers any rules
  checkProposal(
    proposal: ProposedIntervention,
    other_proposals: ProposedIntervention[],
    context: MatchContext
  ): TriggeredRule[];
}

interface MatchContext {
  snapshot: HealthStateSnapshot;
  mode: Mode;
  active_conditions: string[];
  active_medications: MedicationInfo[];
  signals: Record<string, number>;
}

interface MatchedRule {
  rule: InteractionRule;
  match_reason: string;
  specificity_score: number;      // Higher = more specific match
}
```

### 7.3 Conflict Resolution

```ts
interface ConflictResolver {
  // Apply resolution strategy
  resolve(
    conflict: DetectedConflict,
    rule: InteractionRule
  ): ResolutionResult;

  // Check if resolution is valid
  validateResolution(
    resolution: ResolutionResult
  ): ValidationResult;
}

interface ResolutionResult {
  conflict_id: string;
  rule_id: string;
  strategy: ResolutionStrategy;
  resolved_proposal?: ProposedIntervention;
  escalated: boolean;
  confidence: 'low' | 'medium' | 'high';
  evidence_refs: EvidenceRef[];
  audit_redaction: { summary: string };
}
```

## 8) Testing & Validation

### 8.1 Registry Validation

Every registry MUST pass:

```yaml
validation_rules:
  - Each rule has unique rule_id
  - All rule_ids follow naming convention
  - All evidence_refs have valid URIs
  - All trigger fields are valid
  - All resolution strategies are valid
  - No circular supersession chains
  - Dependencies are available
  - Version compatibility is satisfied
```

### 8.2 Rule Testing

Each rule SHOULD have test cases:

```yaml
# In registry file or separate test file
test_cases:
  - rule_id: "nutrition-cardiology-ace-potassium-v2"
    cases:
      - name: "should_trigger_for_ace_inhibitor"
        context:
          medications: [{ class: "ACE_INHIBITOR", name: "lisinopril" }]
          proposals:
            - domain: "nutrition"
              recommendation: "increase_potassium"
        expected:
          triggered: true
          conflict_type: "drug_nutrient_interaction"

      - name: "should_not_trigger_without_ace"
        context:
          medications: [{ class: "STATIN", name: "atorvastatin" }]
          proposals:
            - domain: "nutrition"
              recommendation: "increase_potassium"
        expected:
          triggered: false
```

## 9) Example Registries

### 9.1 Cardiology-Nutrition Interactions

```yaml
registry_id: "registries://cardiology/nutrition-interactions"
version: "1.0.0"
description: "Interactions between cardiology and nutrition domains"

rules:
  - rule_id: "cardiology-nutrition-ace-potassium"
    trigger:
      domain_a: "cardiology"
      domain_b: "nutrition"
      medication_class: "ACE_INHIBITOR"
    conflict_type: "drug_nutrient_interaction"
    severity: "high"
    resolution:
      strategy: "constrain"
      constraint: "potassium_limit_3500mg"
    evidence_refs:
      - evidence_id: "interaction.ace-potassium"
        evidence_type: "policy"
        citation: "ACE Inhibitor-Potassium Interaction"

  - rule_id: "cardiology-nutrition-hf-sodium"
    trigger:
      domain_a: "cardiology"
      domain_b: "nutrition"
      condition: "HF"
    conflict_type: "condition_nutrient_restriction"
    severity: "medium"
    resolution:
      strategy: "constrain"
      constraint: "sodium_limit_2000mg"
    evidence_refs:
      - evidence_id: "guideline.aha-hf-nutrition"
        evidence_type: "guideline"
        citation: "AHA HF Guideline - Sodium Restriction"

  - rule_id: "cardiology-nutrition-hf-fluid"
    trigger:
      domain_a: "cardiology"
      domain_b: "nutrition"
      condition: "HF"
      signal_pattern: "bnp > 500"
    conflict_type: "condition_nutrient_restriction"
    severity: "high"
    resolution:
      strategy: "constrain"
      constraint: "fluid_limit_2L"
    evidence_refs:
      - evidence_id: "guideline.aha-hf-fluid"
        evidence_type: "guideline"
        citation: "AHA HF Guideline - Fluid Management"
```

### 9.2 Nephrology-Nutrition Interactions

```yaml
registry_id: "registries://nephrology/nutrition-interactions"
version: "1.0.0"
description: "Interactions between nephrology and nutrition domains"

rules:
  - rule_id: "nephrology-nutrition-ckd-potassium"
    trigger:
      domain_a: "nephrology"
      domain_b: "nutrition"
      condition:
        name: "CKD"
        stage: ">= 3b"
    conflict_type: "condition_nutrient_restriction"
    severity: "high"
    resolution:
      strategy: "constrain"
      constraint: "potassium_limit_2000mg"  # More restrictive than cardiac!
      constraint_details:
        nutrient: "potassium"
        limit_mg: 2000
        rationale: "Prevent hyperkalemia in advanced CKD"
    evidence_refs:
      - evidence_id: "guideline.kdigo-nutrition"
        evidence_type: "guideline"
        citation: "KDIGO CKD Nutrition Guideline"

  - rule_id: "nephrology-nutrition-ckd-phosphorus"
    trigger:
      domain_a: "nephrology"
      domain_b: "nutrition"
      condition:
        name: "CKD"
        stage: ">= 3"
    conflict_type: "condition_nutrient_restriction"
    severity: "high"
    resolution:
      strategy: "constrain"
      constraint: "phosphorus_limit_800mg"
    evidence_refs:
      - evidence_id: "guideline.kdigo-ckd-mbd"
        evidence_type: "guideline"
        citation: "KDIGO CKD-MBD Guideline"

  - rule_id: "nephrology-nutrition-dialysis-timing"
    trigger:
      domain_a: "nephrology"
      domain_b: "nutrition"
      condition: "on_dialysis"
    conflict_type: "temporal_scheduling"
    severity: "low"
    resolution:
      strategy: "sequence"
      sequence:
        - action: "meal"
          timing: "before_dialysis"
          rationale: "Prevent hypoglycemia during dialysis"
    evidence_refs:
      - evidence_id: "practice.dialysis-nutrition-timing"
        evidence_type: "policy"
        citation: "Dialysis Nutrition Best Practice"
```
