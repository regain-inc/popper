---
version: 1.0.0
last-updated: 2026-01-24
status: draft
owner: Deutsch Dev Team
tags: [advocate, ta1, deutsch, multi-domain, composition, universal]
---

# Deutsch Multi-Domain Composition Spec — v1

## 0) Executive Summary

This spec defines how multiple clinical and lifestyle domain modules compose into a unified Deutsch session while maintaining TA2 supervisory visibility.

**Key principles:**

1. **Domain-agnostic** — No hardcoded disease vs lifestyle hierarchy
2. **Data-driven rules** — Interaction rules loaded from registries, not code
3. **Context-dependent priority** — Patient state determines domain precedence
4. **Transparent supervision** — All conflicts surfaced to Popper for independent evaluation

This architecture supports any combination of domains:
- CVD + Nutrition + Exercise
- Nephrology + Nutrition + Meditation
- Oncology + Nutrition + Exercise + Mental Health
- Any future combination

## 1) Scope

### In scope (v1)

- Universal domain module interface
- Interaction rule engine and registry format
- Cross-domain conflict detection and resolution
- Transparent conflict surfacing to Popper (TA2 compliance)
- Graceful degradation on partial module failure
- Context-dependent priority computation
- Per-module data quality tracking

### Out of scope (v1)

- Dynamic module loading at runtime (modules declared at session start)
- Cross-patient module sharing
- Real-time rule registry updates during session

## 2) Architecture

### 2.1 Universal Composition Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    Universal Domain Composer                     │
│                    (disease-agnostic)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │            Interaction Rule Engine                       │   │
│  │                                                         │   │
│  │  Loads rules from registries:                           │   │
│  │  • drug-interactions://rxnorm/v1                        │   │
│  │  • condition-interactions://core/v1                     │   │
│  │  • registries://org_ta3_alpha/overrides                 │   │
│  │                                                         │   │
│  │  Rules are DATA, not CODE                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│  ┌────────────────────────┼────────────────────────┐           │
│  │         Priority Computer (context-aware)        │           │
│  │  • Evaluates patient snapshot                   │           │
│  │  • Applies priority rules per domain            │           │
│  │  • No hardcoded hierarchy                       │           │
│  └────────────────────────┼────────────────────────┘           │
│                           │                                     │
│     ┌─────────────────────┼─────────────────────┐              │
│     ▼                     ▼                     ▼              │
│  ┌──────────┐       ┌──────────┐          ┌──────────┐        │
│  │ Domain A │       │ Domain B │          │ Domain N │        │
│  │ (any)    │       │ (any)    │          │ (any)    │        │
│  └──────────┘       └──────────┘          └──────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Domain Categories

Domains are categorized for informational purposes, NOT for priority:

| Category | Description | Examples |
|----------|-------------|----------|
| `clinical` | Disease-focused medical domains | Cardiology, Nephrology, Oncology, Endocrinology |
| `lifestyle` | Health behavior domains | Nutrition, Exercise, Sleep hygiene |
| `behavioral` | Mental and behavioral health | Mental health, Meditation, Stress management |
| `preventive` | Screening and prevention | Preventive care, Vaccination, Screening |
| `rehabilitative` | Recovery and rehabilitation | Cardiac rehab, Physical therapy, Pulmonary rehab |
| `other` | Domain does not fit core set | Rare / future domains |

**Important:** Category does NOT determine priority. A `lifestyle` domain (nutrition) may have higher priority than a `clinical` domain for a preventive wellness patient.

### 2.3 No "Primary" Module

Unlike single-cartridge Deutsch, multi-domain composition has no fixed primary:

- Priority is computed from patient context at runtime
- Any domain can be highest priority depending on patient state
- Ties are resolved by evidence strength, then uncertainty level

## 3) Domain Module Interface

### 3.1 DomainModule (extends ClinicalCartridge)

Every domain module MUST implement this interface:

```ts
interface DomainModule extends ClinicalCartridge {
  // Identity
  domain_id: string;              // e.g., "cardiology", "nutrition", "mental_health"
  domain_version: string;         // semver

  // Category (informational, not for priority)
  domain_category: DomainCategory;

  // Modes this domain module supports.
  // Example: a nutrition module may support both; a medication-ordering module may support only advocate_clinical.
  supported_modes: Mode[];

  // What this domain requires from the snapshot
  required_snapshot_signals: string[];

  // What conflict types this domain may participate in
  potential_conflict_types: string[];

  // Priority rules (evaluated against patient context)
  priority_rules: PriorityRule[];
  default_priority: number;       // 1-100, used when no rules match

  // Interaction registries this domain uses
  interaction_registry_refs: string[];

  // Health check for graceful degradation
  health_check(): Promise<ModuleHealth>;
}

type DomainCategory =
  | 'clinical'
  | 'lifestyle'
  | 'behavioral'
  | 'preventive'
  | 'rehabilitative'
  | 'other';

interface PriorityRule {
  rule_id: string;
  condition: string;              // Expression evaluated against snapshot
  priority_adjustment: number;    // Added to default_priority
  reason: string;                 // Human-readable explanation
}

interface ModuleHealth {
  status: 'healthy' | 'degraded' | 'failed';
  details?: string;
  last_check: string;             // ISO timestamp
}
```

**Normative mapping:** `DomainModule.health_check().status` MUST map to Hermes `ContributingDomain.status` as:
- `healthy` → `success`
- `degraded` → `degraded`
- `failed` → `failed`

### 3.2 Priority Computation (Normative)

Priority is computed at session start and when snapshot changes significantly:

```ts
function computeDomainPriority(
  module: DomainModule,
  snapshot: HealthStateSnapshot
): { priority: number; reasons: string[] } {
  let priority = module.default_priority;
  const reasons: string[] = [];

  for (const rule of module.priority_rules) {
    if (evaluateCondition(rule.condition, snapshot)) {
      priority += rule.priority_adjustment;
      reasons.push(rule.reason);
    }
  }

  // Clamp to valid range
  priority = Math.max(1, Math.min(100, priority));

  return { priority, reasons };
}
```

### 3.3 Example Priority Rules

**Cardiology domain:**

```yaml
priority_rules:
  - rule_id: "active_hf"
    condition: "snapshot.conditions.includes('HF') && snapshot.status.hf_stable === false"
    priority_adjustment: +30
    reason: "Active heart failure requires clinical priority"

  - rule_id: "recent_mi"
    condition: "snapshot.events.any(e => e.type === 'MI' && e.days_ago < 90)"
    priority_adjustment: +40
    reason: "Recent MI requires close monitoring"

  - rule_id: "preventive_only"
    condition: "snapshot.conditions.length === 0 && snapshot.risk_factors.cvd_risk < 0.1"
    priority_adjustment: -20
    reason: "Low-risk preventive context"
```

**Nutrition domain:**

```yaml
priority_rules:
  - rule_id: "renal_diet_required"
    condition: "snapshot.conditions.includes('CKD') && snapshot.ckd_stage >= 3"
    priority_adjustment: +25
    reason: "Renal diet is medically necessary"

  - rule_id: "active_eating_disorder"
    condition: "snapshot.conditions.any(c => c.category === 'eating_disorder')"
    priority_adjustment: +35
    reason: "Eating disorder requires nutrition priority"

  - rule_id: "general_wellness"
    condition: "snapshot.mode === 'wellness' && !snapshot.has_clinical_nutrition_need"
    priority_adjustment: -10
    reason: "General wellness context"
```

## 4) Interaction Rule Engine

### 4.1 Purpose

The Interaction Rule Engine detects and resolves conflicts between domain recommendations. Rules are loaded from registries, not hardcoded.

### 4.2 Rule Engine Interface

```ts
interface InteractionRuleEngine {
  // Load rules from registries
  load_registries(refs: string[]): Promise<RegistryLoadResult>;

  // Find applicable rules for domain pair + context
  find_applicable_rules(
    domain_a: string,
    domain_b: string,
    context: RuleContext
  ): InteractionRule[];

  // Detect conflicts in a set of proposals
  detect_conflicts(
    proposals: ProposedIntervention[],
    contributing_domains: string[],
    context: RuleContext
  ): DetectedConflict[];

  // Propose resolutions for detected conflicts
  resolve_conflicts(
    conflicts: DetectedConflict[]
  ): ConflictResolution[];
}

interface RuleContext {
  snapshot: HealthStateSnapshot;
  conditions: string[];
  medications: MedicationInfo[];
  signals: Record<string, number>;
  mode: Mode;
}

interface RegistryLoadResult {
  loaded: string[];
  failed: Array<{ ref: string; error: string }>;
  rule_count: number;
}
```

### 4.3 Interaction Rule Structure

See `06-interaction-rule-registry-spec.md` for full registry format.

```ts
interface InteractionRule {
  rule_id: string;
  rule_source: string;            // Registry URI
  version: string;

  // When this rule applies
  trigger: {
    domain_a: string;             // e.g., "cardiology"
    domain_b: string;             // e.g., "nutrition"
    condition?: string;           // e.g., "HF"
    medication_class?: string;    // e.g., "ACE_INHIBITOR"
    signal_pattern?: string;      // e.g., "potassium > 5.0"
  };

  // What conflict it represents
  conflict_type: string;          // Extensible, not enum
  severity: 'low' | 'medium' | 'high' | 'critical';

  // How to resolve
  resolution: {
    strategy: ResolutionStrategy;
    winning_domain?: string;
    constraint?: string;
    modified_recommendation?: string;
  };

  // Evidence
  evidence_refs: EvidenceRef[];

  // Metadata
  effective_date: string;
  expiration_date?: string;
  supersedes?: string;
}

type ResolutionStrategy =
  | 'override'      // One domain's recommendation wins
  | 'constrain'     // Modify recommendation with limits
  | 'merge'         // Combine compatible parts
  | 'sequence'      // Time-order the recommendations
  | 'escalate';     // Cannot auto-resolve, route to clinician
```

## 5) Conflict Detection & Resolution

### 5.1 Conflict Detection Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Conflict Detection                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Collect proposals from all domains                      │
│                    │                                        │
│                    ▼                                        │
│  2. For each domain pair (A, B):                           │
│     • Find applicable rules from registries                │
│     • Check if proposals trigger any rule                  │
│                    │                                        │
│                    ▼                                        │
│  3. For each triggered rule:                               │
│     • Create DetectedConflict record                       │
│     • Include original proposals from both domains         │
│                    │                                        │
│                    ▼                                        │
│  4. Apply resolution strategy per rule                     │
│     • Generate resolved proposal OR                        │
│     • Mark as 'escalate' for clinician                     │
│                    │                                        │
│                    ▼                                        │
│  5. Surface ALL conflicts to Popper                        │
│     (even resolved ones, for independent evaluation)       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Conflict Types (Extensible Registry)

Conflict types are NOT a closed enum. They're loaded from a registry:

```ts
interface ConflictTypeRegistry {
  registry_id: string;
  version: string;

  types: Record<string, ConflictTypeDefinition>;
}

interface ConflictTypeDefinition {
  type_id: string;
  description: string;
  severity_default: 'low' | 'medium' | 'high' | 'critical';
  requires_evidence: boolean;
  auto_escalate_if_uncertain: boolean;
  example: string;
}
```

**Core conflict types (shipped with Deutsch):**

| Type ID | Description | Default Severity |
|---------|-------------|------------------|
| `drug_nutrient_interaction` | Medication interacts with food/supplement | high |
| `drug_activity_contraindication` | Medication affects exercise capacity | high |
| `condition_nutrient_restriction` | Condition requires dietary modification | medium |
| `condition_activity_restriction` | Condition limits physical activity | high |
| `temporal_scheduling` | Timing conflict between recommendations | low |
| `resource_competition` | Same resource needed differently | medium |
| `guideline_disagreement` | Two guidelines conflict | high |
| `uncertainty_propagation` | Uncertainty in one affects another | medium |

**Domains can register additional types via their registries.**

### 5.3 Resolution Requirements (Normative)

Every resolved conflict MUST include:

| Field | Required | Description |
|-------|----------|-------------|
| `conflict_id` | Yes | Unique identifier |
| `conflict_type` | Yes | From registry |
| `triggering_rule_id` | Yes | Which rule detected this |
| `conflicting_domains` | Yes | Which domains conflicted |
| `original_proposals` | Yes | What each domain proposed |
| `resolution_strategy` | Yes | How it was resolved |
| `resolved_proposal` | If not escalate | The merged/modified recommendation |
| `evidence_refs` | Yes (≥1) | Evidence for the resolution |
| `resolution_confidence` | Yes | low/medium/high |
| `uncertainty` | Yes | Uncertainty assessment |
| `audit_redaction` | Yes | PHI-safe summary |

### 5.4 Unresolvable Conflicts (Normative)

A conflict is **unresolvable** when:

- No rule provides a resolution strategy
- Rule specifies `strategy: "escalate"`
- Resolution confidence would be `low` with `severity: "critical"`
- Multiple rules conflict about resolution

Unresolvable conflicts MUST:

1. Set `resolution_strategy: "escalate"`
2. Set `resolution_confidence: "low"` or omit `resolved_proposal`
3. NOT produce a merged recommendation
4. Be surfaced to Popper, which will `ROUTE_TO_CLINICIAN`

## 6) Data & Snapshot Handling

### 6.1 Per-Domain Data Quality

Each domain reports its data quality independently:

```ts
interface DomainDataQuality {
  domain_id: string;
  data_sources: Array<'ehr' | 'wearable' | 'patient_reported' | 'other'>;

  staleness: {
    oldest_signal_age_seconds: number;
    newest_signal_age_seconds: number;
  };

  completeness: {
    required_signals: string[];
    available_signals: string[];
    missing_signals: string[];
  };

  conflicts: {
    conflicting_signals: string[];
    resolution_used: Record<string, string>;  // signal → source used
  };
}
```

### 6.2 Composite Staleness (Normative)

For proposals involving multiple domains:

- **Effective staleness** = age of oldest contributing signal
- Staleness thresholds apply to the composite
- If any contributing domain exceeds threshold → entire composition is stale

### 6.3 Source Conflict Resolution (Normative)

When data sources conflict (e.g., wearable weight ≠ EHR weight):

1. **Prefer authoritative source:** EHR > wearable > self-report for clinical values
2. **Prefer recent:** Within same tier, prefer more recent
3. **Disclose conflict:** Add to `snapshot.quality.conflicting_signals`
4. **Increase uncertainty:** Proposals using conflicting data get elevated uncertainty

### 6.4 Missing Data Handling

| Scenario | Behavior |
|----------|----------|
| Required signal missing for one domain | Domain reports `degraded`, composition continues |
| Required signal missing for conflict detection | Treat as potential conflict, increase uncertainty |
| Critical signal missing for clinical domain | Domain reports `failed`, fail-safe behavior |

## 7) Partial Failure Handling

### 7.1 Module Failure Modes

| Failure Type | Behavior | Supervision |
|--------------|----------|-------------|
| Lifestyle domain timeout | Proceed without that domain | Disclose in `contributing_domains` |
| Clinical domain failure | **FAIL CLOSED** | Emit `VALIDATION_FAILED`, no recommendations |
| Rule engine failure | **FAIL CLOSED** | Cannot guarantee safety |
| Single registry load failure | Proceed with other registries | Log warning, disclose gap |
| All registries fail | **FAIL CLOSED** | Cannot detect conflicts |

### 7.2 Graceful Degradation (Normative)

When a non-critical domain fails:

```ts
interface CompositionResult {
  proposals: ProposedIntervention[];
  cross_domain_conflicts: CrossDomainConflict[];

  // Degradation disclosure
  contributing_domains: Array<{
    domain_id: string;
    status: 'success' | 'degraded' | 'failed';
    failure_reason?: string;
  }>;

  degraded_capabilities: string[];  // What couldn't be done
}
```

Patient output MUST acknowledge limitations:

> "Nutrition recommendations are temporarily unavailable. Your cardiac care recommendations are shown below."

## 8) Supervision Integration (TA2 Compliance)

### 8.1 Transparency Requirement

All cross-domain conflicts MUST be surfaced to Popper for independent evaluation. This includes:

- Conflicts that were successfully resolved
- Conflicts that were escalated
- Conflict detection metadata (which rules fired)

### 8.2 SupervisionRequest Extensions

See `../03-hermes-specs/02-hermes-contracts.md` for full type definitions.

```ts
// Fields added to SupervisionRequest
interface SupervisionRequest {
  // ... existing fields ...

  // Multi-domain composition fields
  cross_domain_conflicts?: CrossDomainConflict[];

  contributing_domains?: ContributingDomain[];

  composition_metadata?: CompositionMetadata; // Hermes contract type
}
```

### 8.3 What Popper Evaluates (Normative)

Popper evaluates conflict resolution **process quality**, not domain correctness:

| Check | Popper Action |
|-------|---------------|
| Conflict resolved without evidence | `ROUTE_TO_CLINICIAN` |
| Resolution confidence = low | `ROUTE_TO_CLINICIAN` |
| Conflict explicitly escalated | `ROUTE_TO_CLINICIAN` |
| Too many conflicts (>5) | `ROUTE_TO_CLINICIAN` |
| Clinical domain failed | `HARD_STOP` |
| Rule engine failed | `HARD_STOP` |
| Registry load failures | Increased scrutiny |

### 8.4 Per-Proposal Decisions

Popper MAY return different decisions per proposal:

- Low-risk proposals may be approved while high-risk are routed
- Interdependent proposals get the strictest decision applied to all
- Partial approval requires coherent patient output

## 9) Mode Handling

### 9.1 Strictest-Mode-Wins (Normative)

When domains have different mode requirements:

- `advocate_clinical` + `wellness` → entire request treated as `advocate_clinical`
- Ensures clinical-level supervision for mixed requests

### 9.2 Mode Determination

```ts
function determineCompositeMode(domains: DomainModule[]): Mode {
  // This spec intentionally does NOT infer mode from “clinical vs lifestyle”.
  // Mode is an explicit governance boundary chosen by the deployment (gateway/site policy)
  // and passed into the composition session.

  // Recommended policy:
  // - If any configured domain module does not support `wellness` (supported_modes excludes it),
  //   the composition MUST run in `advocate_clinical`.
  // - Otherwise, the deployment MAY choose `wellness` for non-regulated contexts.

  const anyDomainRequiresClinical = domains.some(
    (d) => !d.supported_modes.includes('wellness')
  );

  return anyDomainRequiresClinical ? 'advocate_clinical' : 'wellness';
}
```

## 10) Versioning & Compatibility

### 10.1 Composition Version Tracking

```ts
interface CompositionVersion {
  composition_id: string;           // e.g., "cvd-lifestyle-v1"
  composition_version: string;      // semver of the composition config

  domains: Array<{
    domain_id: string;
    domain_version: string;
  }>;

  registries: Array<{
    registry_ref: string;
    registry_version: string;
    loaded_at: string;
  }>;

  composer_version: string;         // Deutsch composer version
}
```

### 10.2 Compatibility Requirements

- Domains declare minimum composer version they support
- Registries declare minimum engine version
- Startup MUST fail if incompatible versions detected
- `trace.producer.ruleset_version` MUST include composition version

## 11) Testing Requirements

### 11.1 Required Test Categories

| Category | Purpose | Example |
|----------|---------|---------|
| Pairwise conflict | Each conflict type with 2 domains | ACE-inhibitor + potassium recommendation |
| 3+ domain conflict | Multiple domains with cascading effects | CVD meds → exercise limits → nutrition adjustments |
| Priority inversion | Context changes domain priority | Wellness patient vs acute HF patient |
| Unresolvable conflict | Verify escalation behavior | Genuine guideline disagreement |
| Partial failure | Each domain failure mode | Nutrition module timeout |
| Mixed staleness | Different data ages per domain | EHR data 2h old, wearable real-time |
| Partial approval | Popper approves some, rejects others | Medication routed, lifestyle approved |
| Registry failure | Missing/corrupt registry | Graceful degradation |

### 11.2 Domain Combination Matrix

Test infrastructure MUST support arbitrary domain combinations:

```yaml
test_combinations:
  - domains: [cardiology, nutrition, exercise]
    patient_context: "HF patient on GDMT"

  - domains: [nephrology, nutrition, mental_health]
    patient_context: "CKD stage 4 on dialysis with anxiety"

  - domains: [oncology, nutrition, exercise, mental_health]
    patient_context: "Breast cancer patient on chemotherapy"

  - domains: [endocrinology, nutrition, exercise]
    patient_context: "Type 2 diabetes with obesity"
```

## 12) ARPA TA1/TA2 Alignment

| TA Requirement | How This Spec Addresses It |
|----------------|---------------------------|
| TA1: Agentic execution | Universal composer enables multi-domain reasoning |
| TA1: Disease-agnostic design | Domain modules, not hardcoded diseases |
| TA1: Non-device functions | Lifestyle/behavioral domains for care navigation |
| TA2: Independent oversight | All conflicts surfaced for Popper evaluation |
| TA2: Evaluate recommendations | Popper sees all proposals + conflicts + evidence |
| TA2: Assess uncertainty | Uncertainty propagated through composition |
| TA2: Disease agnostic | Popper evaluates process, not domain knowledge |
| TA2: Drift monitoring | Per-domain health checks, registry versioning |
