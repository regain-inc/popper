---
version: 1.0.0
last-updated: 2026-01-24
status: draft
owner: Deutsch Dev Team
tags: [advocate, ta1, deutsch, idk, uncertainty, fallibilism]
---

# Deutsch IDK Protocol Specification (v1)

## 0) Purpose

The **IDK (I Don't Know) Protocol** formalizes how Deutsch handles situations where it cannot make a confident recommendation. This embodies Deutschian fallibilism: acknowledging the limits of knowledge is a virtue, not a failure.

**Epistemological Foundations**: See [`../00-overall-specs/00-epistemology-foundations/04-fallibilism-and-error-correction.md`](../00-overall-specs/00-epistemology-foundations/04-fallibilism-and-error-correction.md)

---

## 1) Philosophy Grounding

### 1.1 Fallibilism

Karl Popper and David Deutsch emphasize that **all knowledge is provisional**. A system that never admits uncertainty is either:
1. Overconfident (will make errors silently), or
2. Useless (only makes trivially safe claims)

The IDK Protocol operationalizes honest uncertainty admission.

### 1.2 "Problems Are Soluble"

Deutsch's optimism states that all problems are soluble **given the right knowledge**. When Deutsch triggers IDK, it means:
- The current knowledge is insufficient
- Additional information could resolve the uncertainty
- The system is not claiming the problem is unsolvable

---

## 2) IDK Triggers

### 2.1 Primary Triggers

| Trigger | Condition | Default Action |
|---------|-----------|----------------|
| **Low HTV Score** | `htv_score.composite` below the configured minimum for this mode + claim type (see §2.2) | Route to clinician |
| **No Surviving Hypotheses** | All hypotheses refuted in ArgMed debate | Route to clinician |
| **Generator-Verifier Disagreement** | Both report insufficient data | Request more info |
| **Missing Required Signals** | `snapshot.quality.missing_signals` contains critical items | Request more info |
| **Conflicting Evidence** | `snapshot.quality.conflicting_signals` unresolved | Route to clinician |
| **Evidence Grade Too Low** | Minimum evidence grade below the configured minimum for this mode + claim type (see §2.2) | Route to clinician |
| **Stale Data** | Snapshot exceeds staleness threshold (mode-dependent) | Request refresh |
| **Out of Scope** | Query outside cartridge domain | Route or deflect |

### 2.2 Threshold Configuration

| Threshold | wellness | advocate_clinical |
|-----------|----------|-------------------|
| HTV minimum (treatment) | 0.3 | 0.4 |
| HTV minimum (lifestyle) | 0.2 | 0.3 |
| Evidence grade minimum (treatment) | `case_series` | `cohort` |
| Snapshot staleness | 24 hours | 4 hours |
| Missing signal tolerance | 3 non-critical | 1 critical or 2 non-critical |

---

## 3) Unknown Taxonomy

### 3.1 Data-Related Unknowns

| Category | Description | Example |
|----------|-------------|---------|
| `MISSING_DATA` | Required signal absent from snapshot | No recent potassium level for ACE-I titration |
| `STALE_DATA` | Data exists but exceeds freshness threshold | Weight from 30 days ago |
| `CONFLICTING_DATA` | Sources disagree on a value | Patient reports BP 120/80, wearable shows 150/95 |
| `AMBIGUOUS_DATA` | Interpretation unclear | "Sometimes dizzy" — frequency unknown |

### 3.2 Evidence-Related Unknowns

| Category | Description | Example |
|----------|-------------|---------|
| `INSUFFICIENT_EVIDENCE` | No supporting guideline or study | Novel drug combination not in guidelines |
| `CONFLICTING_EVIDENCE` | Guidelines disagree | European vs American recommendations differ |
| `LOW_GRADE_EVIDENCE` | Evidence exists but weak | Only case reports for this indication |
| `OUTDATED_EVIDENCE` | Evidence may be superseded | Guideline from 2015, newer data exists |

### 3.3 Reasoning-Related Unknowns

| Category | Description | Example |
|----------|-------------|---------|
| `LOW_HTV` | All hypotheses have poor explanatory quality | Vague symptoms, no clear pattern |
| `NO_SURVIVORS` | All hypotheses refuted in debate | Data contradicts all plausible explanations |
| `DEBATE_DISAGREEMENT` | Generator and Verifier cannot converge | High uncertainty in both components |
| `OUT_OF_SCOPE` | Query outside cartridge capability | Mental health query in CVD cartridge |

---

## 4) IDK Response Format

### 4.1 IDKResponse Type

```typescript
/**
 * Structured response when Deutsch cannot make a confident recommendation.
 * Implements honest uncertainty admission per Deutschian fallibilism.
 */
export interface IDKResponse {
  /** Always true when this response is present */
  idk_triggered: true;

  /** Primary reason for IDK */
  reason_code: IDKReasonCode;

  /** All contributing factors */
  contributing_factors: IDKFactor[];

  /** What specific information is missing */
  missing_information: MissingInformation[];

  /** Recommended next action for the patient/system */
  suggested_action: string;

  /** Is there a safe fallback we can offer? */
  safe_fallback_available: boolean;

  /** If safe_fallback_available, what is it? */
  safe_fallback?: SafeFallback;

  /** Patient-friendly explanation of the uncertainty */
  patient_explanation: string;

  /** Clinician-facing technical explanation */
  clinician_explanation: string;
}

export type IDKReasonCode =
  | 'MISSING_DATA'
  | 'STALE_DATA'
  | 'CONFLICTING_DATA'
  | 'AMBIGUOUS_DATA'
  | 'INSUFFICIENT_EVIDENCE'
  | 'CONFLICTING_EVIDENCE'
  | 'LOW_GRADE_EVIDENCE'
  | 'OUTDATED_EVIDENCE'
  | 'LOW_HTV'
  | 'NO_SURVIVORS'
  | 'DEBATE_DISAGREEMENT'
  | 'OUT_OF_SCOPE';

export interface IDKFactor {
  category: 'data' | 'evidence' | 'reasoning';
  reason_code: IDKReasonCode;
  severity: 'blocking' | 'significant' | 'minor';
  details: string;
}

export interface MissingInformation {
  signal_name: string;           // e.g., "serum_potassium"
  why_needed: string;            // Why this affects the recommendation
  how_to_obtain: string;         // How patient/clinician can provide it
  criticality: 'critical' | 'important' | 'helpful';
  estimated_resolution_time?: string; // e.g., "available with next lab draw"
}

export interface SafeFallback {
  action_type: 'general_guidance' | 'monitoring_recommendation' | 'lifestyle_only' | 'escalate';
  description: string;
  caveats: string[];
}
```

### 4.2 Example IDK Response

```json
{
  "idk_triggered": true,
  "reason_code": "MISSING_DATA",
  "contributing_factors": [
    {
      "category": "data",
      "reason_code": "MISSING_DATA",
      "severity": "blocking",
      "details": "No potassium level available in snapshot"
    },
    {
      "category": "data",
      "reason_code": "STALE_DATA",
      "severity": "significant",
      "details": "Last creatinine from 45 days ago"
    }
  ],
  "missing_information": [
    {
      "signal_name": "serum_potassium",
      "why_needed": "Required to safely assess ACE inhibitor titration risk",
      "how_to_obtain": "Lab draw at next appointment or urgent care if symptomatic",
      "criticality": "critical"
    },
    {
      "signal_name": "serum_creatinine",
      "why_needed": "Kidney function affects medication dosing",
      "how_to_obtain": "Lab draw at next appointment",
      "criticality": "important"
    }
  ],
  "suggested_action": "Please get updated lab work before we can safely recommend medication changes. Contact your care team to schedule labs.",
  "safe_fallback_available": true,
  "safe_fallback": {
    "action_type": "general_guidance",
    "description": "Continue current medications. Monitor for symptoms of fluid retention (weight gain, swelling, shortness of breath).",
    "caveats": [
      "This is general guidance only, not a treatment recommendation",
      "Seek immediate care if symptoms worsen"
    ]
  },
  "patient_explanation": "I don't have enough recent lab results to safely suggest changes to your heart medication. Your potassium and kidney function need to be checked first.",
  "clinician_explanation": "IDK triggered due to missing serum K+ (required for ACE-I titration safety) and stale creatinine (45 days). HTV score for titration hypothesis: 0.28. Recommend labs before medication optimization."
}
```

---

## 5) Decision Tree

### 5.1 IDK Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      IDK Decision Flow                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ArgMed Debate Complete                                         │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────┐                                        │
│  │ Any hypothesis      │ YES                                    │
│  │ with HTV ≥ 0.4?     │─────► Proceed with recommendation     │
│  └──────────┬──────────┘                                        │
│             │ NO                                                 │
│             ▼                                                    │
│  ┌─────────────────────┐                                        │
│  │ Is missing data     │ YES                                    │
│  │ the primary cause?  │─────► IDK: MISSING_DATA               │
│  └──────────┬──────────┘       └─► Request more info           │
│             │ NO                                                 │
│             ▼                                                    │
│  ┌─────────────────────┐                                        │
│  │ Is evidence         │ YES                                    │
│  │ insufficient?       │─────► IDK: INSUFFICIENT_EVIDENCE      │
│  └──────────┬──────────┘       └─► Route to clinician          │
│             │ NO                                                 │
│             ▼                                                    │
│  ┌─────────────────────┐                                        │
│  │ All hypotheses      │ YES                                    │
│  │ refuted?            │─────► IDK: NO_SURVIVORS               │
│  └──────────┬──────────┘       └─► Route to clinician          │
│             │ NO                                                 │
│             ▼                                                    │
│  IDK: LOW_HTV                                                   │
│  └─► Offer safe fallback if available, else route              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Action by IDK Reason

| IDK Reason | Primary Action | Secondary Action |
|------------|----------------|------------------|
| `MISSING_DATA` | Request more info | Offer safe fallback |
| `STALE_DATA` | Request snapshot refresh | Proceed with caveat |
| `CONFLICTING_DATA` | Route to clinician | Explain conflict |
| `AMBIGUOUS_DATA` | Ask clarifying questions | Request more info |
| `INSUFFICIENT_EVIDENCE` | Route to clinician | Explain limitation |
| `CONFLICTING_EVIDENCE` | Route to clinician | Present both views |
| `LOW_GRADE_EVIDENCE` | Route for high-risk; caveat for low-risk | Disclose grade |
| `OUTDATED_EVIDENCE` | Proceed with caveat | Flag for review |
| `LOW_HTV` | Route for high-risk | Offer safe fallback |
| `NO_SURVIVORS` | Route to clinician | Explain uncertainty |
| `DEBATE_DISAGREEMENT` | Route to clinician | Include both perspectives |
| `OUT_OF_SCOPE` | Deflect to appropriate resource | Acknowledge limitation |

---

## 6) Behavior by Mode

### 6.1 wellness Mode

In wellness mode, Deutsch prioritizes safety and patient education:

```typescript
function handleIDK_wellness(idk: IDKResponse): DeutschOutput {
  if (idk.safe_fallback_available) {
    return {
      patient_message_markdown: formatPatientMessage(idk, {
        include_fallback: true,
        emphasize_clinician_discussion: true,
        tone: 'supportive',
      }),
      proposed_interventions: [],  // No clinical interventions in wellness IDK
      supervision: { status: 'NOT_REQUIRED' },
      // ...
    };
  } else {
    return {
      patient_message_markdown: formatPatientMessage(idk, {
        include_fallback: false,
        emphasize_clinician_discussion: true,
        tone: 'supportive',
      }),
      proposed_interventions: [],
      supervision: { status: 'NOT_REQUIRED' },
      // ...
    };
  }
}
```

**Normative constraints (wellness)**:
- Deutsch MUST NOT propose treatment changes when IDK is triggered
- Deutsch SHOULD offer general wellness guidance as safe fallback
- Deutsch MUST encourage patient to discuss with clinician

### 6.2 advocate_clinical Mode

In advocate_clinical mode, Deutsch routes to clinician:

```typescript
function handleIDK_clinical(idk: IDKResponse): DeutschOutput {
  const triageProposal: TriageRouteProposal = {
    proposal_id: generateId(),
    kind: 'TRIAGE_ROUTE',
    created_at: now(),
    urgency: determineUrgency(idk),
    route_to: 'care_team',
    reason: idk.clinician_explanation,
    disclosure: {
      patient_summary: idk.patient_explanation,
      clinician_summary: idk.clinician_explanation,
      rationale_bullets: idk.contributing_factors.map(f => f.details),
      key_unknowns: idk.missing_information.map(m => m.signal_name),
      uncertainty: { level: 'high', notes: `IDK triggered: ${idk.reason_code}` },
    },
    audit_redaction: {
      summary: `IDK Protocol: ${idk.reason_code}. Routing to clinician.`,
    },
  };

  return {
    patient_message_markdown: formatPatientMessage(idk, {
      include_fallback: idk.safe_fallback_available,
      emphasize_clinician_discussion: true,
      tone: 'professional',
    }),
    proposed_interventions: [triageProposal],
    supervision: { status: 'RECEIVED', /* ... */ },
    // ...
  };
}
```

**Normative constraints (advocate_clinical)**:
- Deutsch MUST send a `SupervisionRequest` even for IDK (Popper audits IDK events)
- Deutsch MUST propose a `TRIAGE_ROUTE` intervention
- Deutsch MUST include the IDK reason in the disclosure bundle
- Deutsch MAY include safe fallback guidance in the patient message

---

## 7) Integration with Hermes

### 7.1 Mapping to SupervisionDecision

When Deutsch triggers IDK:

| IDK Reason | Hermes Decision | Notes |
|------------|-----------------|-------|
| `MISSING_DATA` | `REQUEST_MORE_INFO` | System can request data |
| `STALE_DATA` | `REQUEST_MORE_INFO` | System can request refresh |
| All others | `ROUTE_TO_CLINICIAN` | Human judgment required |

### 7.2 IDK in SupervisionRequest

```typescript
// Include IDK context in the request
const supervisionRequest: SupervisionRequest = {
  // ... standard fields ...
  proposals: [{
    kind: 'TRIAGE_ROUTE',
    // ... proposal fields ...
    disclosure: {
      // ... standard disclosure ...
      uncertainty: {
        level: 'high',
        notes: `IDK Protocol triggered: ${idk.reason_code}`,
      },
    },
  }],
  notes: `IDK: ${idk.reason_code}. Missing: ${idk.missing_information.map(m => m.signal_name).join(', ')}`,
};
```

### 7.3 Audit Events

```typescript
// Emit IDK audit event
emit({
  event_type: 'OTHER',
  other_event_type: 'IDK_PROTOCOL_TRIGGERED',
  summary: `IDK: ${idk.reason_code}. ${idk.contributing_factors.length} factors. Action: ${action}`,
  tags: {
    reason_code: idk.reason_code,
    factor_count: String(idk.contributing_factors.length),
    missing_signals: idk.missing_information.map(m => m.signal_name).join(','),
    safe_fallback_available: String(idk.safe_fallback_available),
    action_taken: action,  // 'request_more_info' | 'route_to_clinician' | 'safe_fallback'
  },
});
```

---

## 8) Patient Communication

### 8.1 Message Templates

**Missing Data**:
```markdown
I don't have all the information I need to give you a confident recommendation about [topic].

**What's missing**: [missing_information summary]

**What you can do**: [how_to_obtain guidance]

In the meantime: [safe_fallback.description if available]

Please discuss with your care team before making changes to your medications.
```

**Low Confidence**:
```markdown
Based on the information I have, I'm not confident enough to recommend [action].

This is because: [contributing_factors summary]

I recommend discussing this with your care team, who can review your full situation.

[safe_fallback if available]
```

**Out of Scope**:
```markdown
That question is outside my area of expertise. I'm designed to help with [cartridge_domain].

For [query_topic], please consult with [appropriate_resource].
```

### 8.2 Tone Guidelines

| Mode | Tone | Characteristics |
|------|------|-----------------|
| `wellness` | Supportive | Encouraging, non-alarming, educational |
| `advocate_clinical` | Professional | Clear, precise, action-oriented |

---

## 9) Testing Requirements

### 9.1 Unit Tests

- IDK triggers for each reason code
- Correct action mapping for each reason
- Safe fallback generation when applicable
- Patient message formatting

### 9.2 Integration Tests

- Full flow from ArgMed debate → IDK → Hermes message
- Audit events emitted correctly
- Popper receives and acknowledges IDK routing

### 9.3 Edge Cases

- Multiple IDK reasons simultaneously
- IDK in multi-domain composition
- IDK after partial hypothesis survival

---

## 10) References

- [04-fallibilism-and-error-correction.md](../00-overall-specs/00-epistemology-foundations/04-fallibilism-and-error-correction.md) — Philosophy grounding
- [07-deutsch-argmed-debate.md](./07-deutsch-argmed-debate.md) — ArgMed debate specification
- [04-hermes-epistemological-types.md](../03-hermes-specs/04-hermes-epistemological-types.md) — Type definitions
- [02-hermes-contracts.md](../03-hermes-specs/02-hermes-contracts.md) — Hermes contract

---

*Last updated: 2026-01-24*
