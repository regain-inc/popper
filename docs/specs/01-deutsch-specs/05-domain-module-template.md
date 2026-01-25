---
version: 1.0.0
last-updated: 2026-01-24
status: template
owner: Deutsch Dev Team
tags: [advocate, ta1, deutsch, domain, template]
---

# Domain Module Template

## 0) Purpose

This template defines the structure for creating domain modules (clinical, lifestyle, behavioral, etc.) that compose with other domains in multi-domain Deutsch sessions.

All domain modules MUST follow this template to ensure compatibility with the Universal Domain Composer.

## 1) Module Structure

Every domain module repository/package SHOULD follow this structure:

```
packages/domains/{domain_id}/
├── src/
│   ├── index.ts              # Module exports
│   ├── module.ts             # DomainModule implementation
│   ├── ontology.ts           # Domain vocabulary and concepts
│   ├── guardrails.ts         # Hard and soft constraints
│   ├── proposals.ts          # Proposal generation logic
│   └── health.ts             # Health check implementation
├── registries/
│   ├── interactions/         # Interaction rules this domain provides
│   │   └── {domain}-{other}.yaml
│   └── conflict-types/       # Custom conflict types (if any)
│       └── {domain}-types.yaml
├── tests/
│   ├── scenarios/            # Test scenarios
│   │   └── *.scenario.yaml
│   └── integration/          # Integration tests with other domains
└── package.json
```

## 2) Required Sections

### 2.1 Module Definition

```ts
// src/module.ts

import { DomainModule, DomainCategory, PriorityRule, ModuleHealth } from '@deutsch/core';

export const MyDomainModule: DomainModule = {
  // ═══════════════════════════════════════════════════════════════
  // IDENTITY
  // ═══════════════════════════════════════════════════════════════

  domain_id: "my_domain",           // Unique identifier (snake_case)
  domain_version: "1.0.0",          // Semver
  cartridge_id: "my_domain",        // For ClinicalCartridge compatibility
  cartridge_version: "1.0.0",

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY
  // ═══════════════════════════════════════════════════════════════

  domain_category: "lifestyle",     // clinical | lifestyle | behavioral | preventive | rehabilitative | other

  // Supported modes (governance boundary)
  supported_modes: ["wellness", "advocate_clinical"],

  // ═══════════════════════════════════════════════════════════════
  // SNAPSHOT REQUIREMENTS
  // ═══════════════════════════════════════════════════════════════

  required_snapshot_signals: [
    "conditions",                   // List conditions this domain needs
    "medications",                  // List medications for interaction checking
    // Add domain-specific signals
  ],

  // ═══════════════════════════════════════════════════════════════
  // CONFLICT POTENTIAL
  // ═══════════════════════════════════════════════════════════════

  potential_conflict_types: [
    "drug_nutrient_interaction",    // Conflict types this domain may trigger
    "condition_lifestyle_incompatibility",
  ],

  // ═══════════════════════════════════════════════════════════════
  // PRIORITY RULES
  // ═══════════════════════════════════════════════════════════════

  default_priority: 50,             // Base priority (1-100)

  priority_rules: [
    // See §2.2 for examples
  ],

  // ═══════════════════════════════════════════════════════════════
  // INTERACTION REGISTRIES
  // ═══════════════════════════════════════════════════════════════

  interaction_registry_refs: [
    "registries://internal/my_domain-interactions",
    // Reference external registries as needed
  ],

  // ═══════════════════════════════════════════════════════════════
  // METHODS (from ClinicalCartridge)
  // ═══════════════════════════════════════════════════════════════

  get_guardrails: () => [...],      // See §2.3
  propose_interventions: async (input) => [...],  // See §2.4
  render_patient_message: async (input) => "...", // See §2.5
  health_check: async () => ({...}),              // See §2.6
};
```

### 2.2 Priority Rules

Priority rules determine when this domain should have higher or lower priority:

```ts
priority_rules: [
  // ───────────────────────────────────────────────────────────────
  // ELEVATION RULES (increase priority)
  // ───────────────────────────────────────────────────────────────
  {
    rule_id: "critical_condition",
    condition: "snapshot.conditions.includes('CRITICAL_CONDITION')",
    priority_adjustment: +30,
    reason: "Critical condition requires this domain's priority"
  },
  {
    rule_id: "active_treatment",
    condition: "snapshot.active_treatments.some(t => t.domain === 'my_domain')",
    priority_adjustment: +20,
    reason: "Active treatment in this domain"
  },

  // ───────────────────────────────────────────────────────────────
  // REDUCTION RULES (decrease priority)
  // ───────────────────────────────────────────────────────────────
  {
    rule_id: "preventive_only",
    condition: "snapshot.mode === 'wellness' && !snapshot.has_condition_in_domain",
    priority_adjustment: -15,
    reason: "Preventive/wellness context only"
  },
  {
    rule_id: "stable_maintenance",
    condition: "snapshot.domain_status === 'stable' && snapshot.last_change_days > 90",
    priority_adjustment: -10,
    reason: "Stable maintenance phase"
  },
]
```

### 2.3 Guardrails

Define hard and soft constraints for this domain:

```ts
get_guardrails: () => [
  // ───────────────────────────────────────────────────────────────
  // HARD GUARDRAILS (must force conservative behavior)
  // ───────────────────────────────────────────────────────────────
  {
    id: "no_diagnosis",
    description: "Never provide diagnoses; frame as assessment/explanation",
    severity: "hard"
  },
  {
    id: "defer_to_specialist",
    description: "Defer to specialist for [specific conditions]",
    severity: "hard"
  },
  {
    id: "missing_critical_data",
    description: "Route to clinician if critical data is missing",
    severity: "hard"
  },

  // ───────────────────────────────────────────────────────────────
  // SOFT GUARDRAILS (prefer caution)
  // ───────────────────────────────────────────────────────────────
  {
    id: "prefer_clarification",
    description: "Prefer clarifying questions over assumptions",
    severity: "soft"
  },
  {
    id: "conservative_recommendations",
    description: "Start with conservative recommendations",
    severity: "soft"
  },
]
```

### 2.4 Proposal Generation

Generate proposals using Hermes types:

```ts
propose_interventions: async (input: {
  trace: TraceContext;
  mode: Mode;
  subject: SubjectRef;
  snapshot: HealthStateSnapshotRef;
  user_message: UserMessage;
}): Promise<ProposedIntervention[]> => {
  const proposals: ProposedIntervention[] = [];

  // Domain-specific logic to generate proposals
  // ...

  // Example: Generate an OTHER proposal for this domain
  proposals.push({
    proposal_id: generateId(),
    kind: 'OTHER',
    other_kind: 'MY_DOMAIN_RECOMMENDATION',
    created_at: new Date().toISOString(),

    payload: {
      recommendation_type: "...",
      details: {...},
    },

    evidence_refs: [
      {
        evidence_id: "guideline.my-domain.2024",
        evidence_type: "guideline",
        citation: "My Domain Guideline 2024",
      }
    ],

    disclosure: {
      patient_summary: "...",
      clinician_summary: "...",
      rationale_bullets: [...],
      key_unknowns: [...],
      uncertainty: { level: "low" },
    },

    audit_redaction: {
      summary: "Domain recommendation based on [PHI-safe description]"
    }
  });

  return proposals;
}
```

### 2.5 Patient Message Rendering

Render patient-safe messages:

```ts
render_patient_message: async (input: {
  mode: Mode;
  interventions: ProposedIntervention[];
}): Promise<string> => {
  // Generate patient-friendly message
  // MUST be safe, clear, and actionable
  // MUST NOT include clinical jargon without explanation
  // MUST include appropriate caveats

  return `
Based on your information, here are some recommendations for [domain]:

${formatRecommendations(input.interventions)}

Remember to discuss any changes with your healthcare provider.
  `.trim();
}
```

### 2.6 Health Check

Implement health monitoring:

```ts
health_check: async (): Promise<ModuleHealth> => {
  try {
    // Check dependencies
    const registryStatus = await checkRegistries();
    const dataSourceStatus = await checkDataSources();

    if (registryStatus.failed || dataSourceStatus.failed) {
      return {
        status: 'failed',
        details: `Registry: ${registryStatus.message}, Data: ${dataSourceStatus.message}`,
        last_check: new Date().toISOString()
      };
    }

    if (registryStatus.degraded || dataSourceStatus.degraded) {
      return {
        status: 'degraded',
        details: `Operating with reduced capability`,
        last_check: new Date().toISOString()
      };
    }

    return {
      status: 'healthy',
      last_check: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'failed',
      details: error.message,
      last_check: new Date().toISOString()
    };
  }
}
```

## 3) Ontology Definition

Define domain vocabulary in `src/ontology.ts`:

```ts
// src/ontology.ts

export const MyDomainOntology = {
  // ═══════════════════════════════════════════════════════════════
  // CONCEPTS
  // ═══════════════════════════════════════════════════════════════

  concepts: {
    // Domain-specific concepts
    example_concept: {
      id: "example_concept",
      label: "Example Concept",
      description: "Description of this concept",
      related_to: ["other_concept"],
    },
    // ...
  },

  // ═══════════════════════════════════════════════════════════════
  // RECOMMENDATION TYPES
  // ═══════════════════════════════════════════════════════════════

  recommendation_types: [
    "type_a",
    "type_b",
    // ...
  ],

  // ═══════════════════════════════════════════════════════════════
  // RED FLAGS (require escalation)
  // ═══════════════════════════════════════════════════════════════

  red_flags: [
    {
      id: "red_flag_1",
      description: "Description of concerning pattern",
      action: "ROUTE_URGENT",
    },
    // ...
  ],

  // ═══════════════════════════════════════════════════════════════
  // INTERACTION POINTS
  // ═══════════════════════════════════════════════════════════════

  // What this domain interacts with in other domains
  interaction_points: {
    medications: ["class_a", "class_b"],  // Medication classes we care about
    conditions: ["condition_x"],           // Conditions that affect our recommendations
    signals: ["signal_y"],                 // Signals from other domains we need
  },
};
```

## 4) Interaction Rules

Define interaction rules in `registries/interactions/`:

```yaml
# registries/interactions/my_domain-cardiology.yaml

registry_id: "my_domain-cardiology-interactions"
version: "1.0.0"
description: "Interaction rules between my_domain and cardiology"

rules:
  - rule_id: "my_domain-cardiology-001"
    trigger:
      domain_a: "my_domain"
      domain_b: "cardiology"
      medication_class: "BETA_BLOCKER"
    conflict_type: "drug_domain_interaction"
    severity: "medium"
    resolution:
      strategy: "constrain"
      constraint: "Adjust recommendation for beta-blocker effects"
    evidence_refs:
      - evidence_id: "study.beta-blocker-mydomain.2023"
        evidence_type: "study"
        citation: "Beta-blocker effects on my domain"

  - rule_id: "my_domain-cardiology-002"
    trigger:
      domain_a: "my_domain"
      domain_b: "cardiology"
      condition: "HF"
    conflict_type: "condition_lifestyle_incompatibility"
    severity: "high"
    resolution:
      strategy: "constrain"
      constraint: "Modify recommendations for HF limitations"
    evidence_refs:
      - evidence_id: "guideline.aha-hf-mydomain.2024"
        evidence_type: "guideline"
        citation: "AHA HF Guideline section on my domain"
```

## 5) Test Scenarios

Define test scenarios in `tests/scenarios/`:

```yaml
# tests/scenarios/basic.scenario.yaml

scenario_id: "my_domain-basic-001"
description: "Basic recommendation generation"

snapshot:
  conditions: []
  medications: []
  signals:
    relevant_signal: 50

user_message:
  text: "I'd like recommendations for my domain"
  channel: "app"

expected:
  proposal_kinds: ["OTHER"]
  other_kinds: ["MY_DOMAIN_RECOMMENDATION"]
  requires_supervision: false
  min_evidence_refs: 1
```

```yaml
# tests/scenarios/conflict.scenario.yaml

scenario_id: "my_domain-conflict-001"
description: "Conflict with cardiology domain"

domains: ["my_domain", "cardiology"]

snapshot:
  conditions: ["HF"]
  medications:
    - name: "metoprolol"
      class: "BETA_BLOCKER"
  signals:
    relevant_signal: 75

user_message:
  text: "I need recommendations considering my heart condition"
  channel: "app"

expected:
  conflict_detected: true
  conflict_types: ["condition_lifestyle_incompatibility"]
  resolution_strategy: "constrain"
  requires_supervision: true
```

## 6) Example Domain Modules

### 6.1 Nutrition Domain (Skeleton)

```ts
export const NutritionDomainModule: DomainModule = {
  domain_id: "nutrition",
  domain_version: "1.0.0",
  domain_category: "lifestyle",

  required_snapshot_signals: [
    "conditions",
    "medications",
    "allergies",
    "dietary_restrictions",
    "weight_trend",
    "lab_values.glucose",
    "lab_values.lipids",
    "lab_values.kidney_function",
  ],

  potential_conflict_types: [
    "drug_nutrient_interaction",
    "condition_nutrient_restriction",
    "allergy_food_conflict",
  ],

  default_priority: 50,

  priority_rules: [
    {
      rule_id: "renal_diet",
      condition: "snapshot.conditions.includes('CKD') && snapshot.ckd_stage >= 3",
      priority_adjustment: +25,
      reason: "Renal diet is medically necessary"
    },
    {
      rule_id: "diabetes_diet",
      condition: "snapshot.conditions.includes('T2DM')",
      priority_adjustment: +20,
      reason: "Diabetic diet management"
    },
    {
      rule_id: "eating_disorder",
      condition: "snapshot.conditions.some(c => c.includes('eating_disorder'))",
      priority_adjustment: +35,
      reason: "Eating disorder requires nutrition priority"
    },
  ],

  interaction_registry_refs: [
    "registries://nutrition/drug-nutrient",
    "registries://nutrition/condition-diet",
  ],

  // ... methods
};
```

### 6.2 Mental Health Domain (Skeleton)

```ts
export const MentalHealthDomainModule: DomainModule = {
  domain_id: "mental_health",
  domain_version: "1.0.0",
  domain_category: "behavioral",

  required_snapshot_signals: [
    "conditions",
    "medications",
    "mood_assessments",
    "sleep_quality",
    "stress_level",
    "therapy_history",
  ],

  potential_conflict_types: [
    "drug_behavioral_interaction",
    "condition_behavioral_contraindication",
    "temporal_scheduling",
  ],

  default_priority: 45,

  priority_rules: [
    {
      rule_id: "active_mh_condition",
      condition: "snapshot.conditions.some(c => MH_CONDITIONS.includes(c))",
      priority_adjustment: +30,
      reason: "Active mental health condition"
    },
    {
      rule_id: "crisis_indicators",
      condition: "snapshot.crisis_risk_level === 'elevated'",
      priority_adjustment: +50,
      reason: "Crisis indicators present"
    },
  ],

  interaction_registry_refs: [
    "registries://mental_health/drug-behavioral",
    "registries://mental_health/condition-behavioral",
  ],

  // ... methods
};
```

## 7) Checklist for New Domains

Before submitting a new domain module:

- [ ] Module implements `DomainModule` interface completely
- [ ] All required snapshot signals documented
- [ ] Potential conflict types listed
- [ ] Priority rules defined with clear conditions
- [ ] At least one interaction registry defined
- [ ] Hard guardrails include safety-critical constraints
- [ ] Health check covers all dependencies
- [ ] Test scenarios cover basic, edge, and conflict cases
- [ ] Integration tests with at least 2 other domains
- [ ] Patient message rendering is safe and clear
- [ ] PHI handling follows Hermes audit_redaction requirements
- [ ] Version follows semver
- [ ] ARPA TA1/TA2 compliance verified
