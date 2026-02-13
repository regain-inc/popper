---
version: 2.0.0
last-updated: 2026-02-13
status: implemented
owner: Popper Dev Team
tags: [advocate, popper, control-plane, dsl, reconfigure, ta2, iso-compliance]
depends-on:
  - "@regain/hermes (v2.0.0) — ControlCommandV2, ControlCommandResponse types"
  - 01-popper-system-spec.md
  - 03-popper-safety-dsl.md
implementation:
  packages:
    - packages/core/src/control-v2/ (builder, types, conformance fixtures)
    - packages/core/src/desired-state/manager.ts
    - packages/core/src/reconfigure-policy/evaluator.ts
    - packages/core/src/push-delivery/ (delivery pipeline)
    - packages/cache/src/signal-aggregator.ts
    - apps/server/src/plugins/control-v2.ts
  db-schemas:
    - packages/db/src/schema/desired-state.ts
    - packages/db/drizzle/0011_popper_control_v2.sql
  tests: "~211 test cases across 13 files"
---

# Popper Control Plane v2 Spec

> **Implementation Status**: Fully implemented. All 18 MUST requirements verified GREEN.
> See `packages/core/src/control-v2/`, `packages/core/src/desired-state/`, `packages/core/src/reconfigure-policy/`, and `apps/server/src/plugins/control-v2.ts`.

## 0) Purpose

Popper v1 provides a control plane with binary safe-mode and 5 infrastructure settings (`staleness.*`, `rate_limit.*`, `policy_pack`). The v1 DSL can trigger `SET_SAFE_MODE` and `SET_OPERATIONAL_SETTING` as `RuleAction.control_commands`, but there is no mechanism for Popper to **decide when to reconfigure** Deutsch's operational settings based on supervision signals.

The ARPA-H ISO (§1.2.5) requires the Supervisory agent to "securely exert direct live control and changes in operational settings for care management functions." This spec extends Popper's control plane to:

1. **Decide** when Deutsch settings should change (DSL `reconfigure` side-effect on any rule action)
2. **Track** desired-state vs actual-state for all Deutsch settings
3. **Reconcile** state divergence using the ACK/NACK protocol
4. **Trigger** operational mode transitions on Deutsch

---

## 1) DSL Extension: Reconfigure Side-Effect

### 1.1 Extended RuleAction

The Popper Safety DSL `RuleAction` (see `03-popper-safety-dsl.md` §3) gains an optional `reconfigure` field. The four existing decision types are unchanged:

```ts
export interface RuleAction {
  // Unchanged — supervision decision for the current request
  decision: 'APPROVED' | 'HARD_STOP' | 'ROUTE_TO_CLINICIAN' | 'REQUEST_MORE_INFO';

  // Existing fields...
  reason_codes: ReasonCode[];
  explanation: string;

  // NEW: Optional reconfigure side-effect (controls future requests, not this one)
  reconfigure?: ReconfigureEffect;

  // Existing: control_commands for v1 compatibility
  control_commands?: ControlCommandInline[];
}

export interface ReconfigureEffect {
  // Settings to change on the target (Deutsch)
  settings?: Array<{
    key: string;                // From operational settings catalog
    value: unknown;             // Typed per catalog
    reason: string;             // Why this change is being triggered
  }>;

  // Optional: trigger a mode transition instead of/in addition to individual settings
  mode_transition?: {
    target_mode: 'NORMAL' | 'RESTRICTED' | 'SAFE_MODE' | 'MAINTENANCE';
    reason: string;
  };

  // Priority for the resulting ControlCommandV2
  priority?: 'ROUTINE' | 'URGENT' | 'EMERGENCY';  // Default: ROUTINE
}
```

> **Impl**: `ReconfigureEffect` and `ReconfigureSettingChange` types in `packages/core/src/policy-engine/types.ts`. The `mergeReconfigureEffects()` function in `packages/core/src/policy-engine/evaluator.ts` handles merging effects from multiple matching rules.

### 1.2 Side-Effect Semantics

The `reconfigure` field is a **side-effect** — it modifies Deutsch's operational settings for *future* requests. It does NOT affect the supervision decision for the current request. A single rule can:
- APPROVE the current request AND reconfigure settings for future requests
- ROUTE_TO_CLINICIAN the current request AND reduce autonomy for future requests
- HARD_STOP the current request AND transition Deutsch to RESTRICTED mode

The supervision decision and the reconfigure effect are evaluated and applied independently.

### 1.3 Merging Rules

The DSL decision priority chain is unchanged:
```
HARD_STOP > ROUTE_TO_CLINICIAN > REQUEST_MORE_INFO > APPROVED
```

When multiple `continue: true` rules match:
- **Supervision decisions** follow standard Popper "most conservative wins" semantics.
- **Reconfigure effects** are merged separately: if the same setting key appears in multiple rules, the rule with higher priority wins. If priorities are equal, the more conservative value wins. `EMERGENCY` effects override `URGENT` override `ROUTINE`.

### 1.4 Auditability

When a DSL rule fires with `reconfigure` present, the system MUST:
1. Emit `CONTROL_COMMAND_ISSUED` audit event referencing the `rule_id` and `policy_id` that triggered the reconfiguration.
2. Log the reconfigure effect separately from the supervision decision, enabling independent audit queries for "what changed Deutsch's settings" vs "what happened to this request."
3. The resulting `ControlCommandV2` MUST include `audit_redaction.summary` describing the trigger.

> **Impl**: Audit event types `CONTROL_COMMAND_ISSUED`, `CONTROL_COMMAND_TIMEOUT`, `CONTROL_STATE_DIVERGENCE`, `CONTROL_RECONCILIATION_FAILED` defined in `packages/core/src/audit/types.ts`.

---

## 2) Control Decision Engine

### 2.1 Architecture

The Control Decision Engine is a new component in Popper that evaluates supervision signals and determines when to change Deutsch's operational settings.

```
┌─────────────────────────────────────────────┐
│ Popper Core                                  │
│                                              │
│  ┌──────────┐   ┌──────────────────────┐    │
│  │ DSL      │──▶│ Control Decision     │    │
│  │ Engine   │   │ Engine               │    │
│  └──────────┘   │                      │    │
│       │         │  ┌─────────────────┐ │    │
│       │         │  │ Signal          │ │    │
│       │         │  │ Aggregator      │ │    │
│       ▼         │  └────────┬────────┘ │    │
│  Supervision    │  ┌────────▼────────┐ │    │
│  Decision       │  │ Reconfigure     │ │    │
│                 │  │ Policy Engine   │ │    │
│                 │  └────────┬────────┘ │    │
│                 │  ┌────────▼────────┐ │    │
│                 │  │ Desired-State   │ │    │
│                 │  │ Manager         │ │    │
│                 │  └────────┬────────┘ │    │
│                 └───────────┼──────────┘    │
│                             ▼                │
│                    ControlCommandV2          │
│                    (via Push Delivery)        │
└─────────────────────────────────────────────┘
```

### 2.2 Signal Aggregator

The Signal Aggregator collects evidence from multiple supervision cycles to inform reconfiguration decisions:

```ts
export interface AggregatedSignals {
  // Window-based metrics
  window_duration_minutes: number;   // Sliding window size (default: 60)

  // Supervision outcome statistics
  approval_rate: number;
  hard_stop_rate: number;
  route_to_clinician_rate: number;
  request_more_info_rate: number;

  // Quality metrics
  mean_htv_score: number;
  htv_trend: 'improving' | 'stable' | 'declining';
  hallucination_detections: number;
  idk_trigger_count: number;

  // Risk metrics
  high_risk_proposal_rate: number;
  mean_risk_score: number;
  risk_trend: 'improving' | 'stable' | 'worsening';

  // Domain-specific counters
  prescription_proposal_count: number;
  prescription_rejection_count: number;
  triage_escalation_count: number;

  // Staleness and data quality
  stale_snapshot_rate: number;
  missing_source_rate: Record<string, number>;
}
```

> **Impl**: Redis-backed `SignalAggregator` in `packages/cache/src/signal-aggregator.ts` using sorted sets. `InMemorySignalAggregator` for dev/test. HTV trend computed via linear regression. 24h auto-prune. 18 tests.

### 2.3 Reconfigure Policy Engine

The Reconfigure Policy Engine evaluates aggregated signals against configurable thresholds to generate reconfiguration actions. These are separate from the per-request DSL rules — they represent **trend-based adjustments**.

```ts
export interface ReconfigurePolicy {
  policy_id: string;
  description: string;
  priority: number;

  when: ReconfigureTrigger;
  then: ReconfigureEffect;

  cooldown_minutes: number;
  auto_revert?: boolean;
  revert_after_minutes?: number;
}

export type ReconfigureTrigger =
  | { kind: 'hard_stop_rate_above'; threshold: number }
  | { kind: 'htv_trend_declining_for'; minutes: number }
  | { kind: 'hallucination_count_above'; threshold: number; window_minutes: number }
  | { kind: 'prescription_rejection_rate_above'; threshold: number }
  | { kind: 'stale_snapshot_rate_above'; threshold: number }
  | { kind: 'approval_rate_below'; threshold: number }
  | { kind: 'risk_trend_worsening_for'; minutes: number }
  | { kind: 'all_of'; triggers: ReconfigureTrigger[] }
  | { kind: 'any_of'; triggers: ReconfigureTrigger[] };
```

> **Impl**: `ReconfigurePolicyEvaluator` in `packages/core/src/reconfigure-policy/evaluator.ts` with 9 trigger kinds (7 leaf + 2 composite). Cooldown per-organization. Auto-revert inheritance. YAML policy loading. 30+ tests.

### 2.4 Example Reconfigure Policies

```yaml
reconfigure_policies:
  - policy_id: "drift-response-restrict"
    description: "Reduce autonomy when quality metrics are declining"
    priority: 100
    when:
      kind: all_of
      triggers:
        - kind: htv_trend_declining_for
          minutes: 30
        - kind: hard_stop_rate_above
          threshold: 0.1
    then:
      settings:
        - key: autonomy.max_risk_level
          value: "low"
          reason: "Quality decline detected: HTV trending down + elevated hard-stop rate"
        - key: pipeline.htv_threshold
          value: 0.85
          reason: "Raising quality bar during quality decline"
      priority: URGENT
    cooldown_minutes: 30
    auto_revert: true
    revert_after_minutes: 120

  - policy_id: "hallucination-emergency"
    description: "Transition to RESTRICTED mode on repeated hallucinations"
    priority: 200
    when:
      kind: hallucination_count_above
      threshold: 3
      window_minutes: 15
    then:
      mode_transition:
        target_mode: RESTRICTED
        reason: "Multiple hallucinations detected in 15-minute window"
      priority: EMERGENCY
    cooldown_minutes: 60
    auto_revert: false

  - policy_id: "prescription-safety-gate"
    description: "Disable autonomous prescriptions when rejection rate is high"
    priority: 150
    when:
      kind: prescription_rejection_rate_above
      threshold: 0.2
    then:
      settings:
        - key: prescriptions.enabled
          value: false
          reason: "Prescription rejection rate exceeds 20% — disabling until reviewed"
      priority: URGENT
    cooldown_minutes: 120
    auto_revert: false
```

> **Impl**: Default policy pack at `config/policies/reconfigure/default.yaml` with 3 policies.

---

## 3) Desired-State Manager

### 3.1 State Model

Popper maintains a **desired-state** for each Deutsch instance it supervises:

```ts
export interface DesiredState {
  instance_id: string;
  organization_id: string;

  settings: Record<string, {
    value: unknown;
    set_by: string;
    set_at: string;
    auto_revert_at?: string;
    original_value?: unknown;
  }>;

  operational_mode: 'NORMAL' | 'RESTRICTED' | 'SAFE_MODE' | 'MAINTENANCE';

  last_actual_state?: OperationalStateSnapshot;
  last_reconciliation_at?: string;
}
```

> **Impl**: `DesiredStateManager` class in `packages/core/src/desired-state/manager.ts` with methods: `getDesiredState()`, `updateDesiredState()`, `updateActualState()`, `computeDivergence()`, `acceptSelfTransition()`, `processAutoReverts()`. 14 tests.

### 3.2 State Persistence

Desired-state MUST be persisted to PostgreSQL (table: `popper_desired_state`):
- Survives Popper restarts
- Supports audit queries ("what was the desired state at time T?")
- Includes full change history (append-only log)

> **Impl**: Two DB tables in `packages/db/src/schema/desired-state.ts`:
> - `popper_desired_state` — PK=(instance_id, organization_id), optimistic concurrency via `version` column
> - `popper_desired_state_log` — append-only audit of all desired-state mutations

### 3.3 Reconciliation Loop

The Desired-State Manager runs a reconciliation loop:

1. After every ACK response: compare `settings_snapshot` against desired-state.
2. Every 60 seconds (during active supervision): issue `GET_OPERATIONAL_STATE` and compare.
3. **Every 300 seconds when idle** (no active supervision cycles): issue `GET_OPERATIONAL_STATE` as a health check.
4. On divergence:
   - If Deutsch has a setting value that differs from Popper's desired-state:
     - Log `CONTROL_STATE_DIVERGENCE` audit event.
     - Re-issue `SET_OPERATIONAL_SETTINGS` command for divergent settings.
   - If divergence persists after 3 retries:
     - Escalate: log `CONTROL_RECONCILIATION_FAILED` and alert safety-ops.
     - Consider transitioning to RESTRICTED or SAFE_MODE.
5. On `GET_OPERATIONAL_STATE` failure (network error, timeout, HTTP 5xx):
   - Log `CONTROL_STATE_FETCH_FAILED` audit event.
   - If 3 consecutive failures: trigger P1 safety-ops alert.

> **Impl**: `DeliveryManager` in `packages/core/src/push-delivery/delivery-manager.ts` orchestrates reconciliation with configurable intervals (env: `RECONCILIATION_INTERVAL_MS=60000`, `IDLE_RECONCILIATION_INTERVAL_MS=300000`). Startup reconciliation fires on server boot.

### 3.4 Respecting TA1 Self-Transitions

When reconciliation detects that Deutsch has self-transitioned to a **more conservative** mode (e.g., NORMAL → RESTRICTED, or RESTRICTED → SAFE_MODE), Popper MUST NOT automatically restore the previous mode. Self-transitions to more conservative states are safety-driven and require explicit clinician or operator authorization to reverse.

Specifically:
- If Deutsch reports `operational_mode = SAFE_MODE` but Popper's desired-state says `NORMAL`, Popper MUST NOT issue `SET_OPERATIONAL_MODE { target_mode: NORMAL }`.
- Instead, Popper logs `CONTROL_STATE_DIVERGENCE` with `tags.cause = "ta1_self_transition"` and updates its desired-state to match Deutsch's reported mode.
- Reverting to a less conservative mode requires a new operator command with `operator_id`.

> **Impl**: `acceptSelfTransition()` method with mode conservativeness ordering: NORMAL(0) < RESTRICTED(1) < SAFE_MODE(2) < MAINTENANCE(3).

---

## 4) Operational Settings Lifecycle

The full lifecycle of an operational setting change:

```
1. Trigger detected
   ├── DSL rule fires with reconfigure side-effect
   ├── Reconfigure Policy Engine threshold crossed
   └── Manual operator command via Popper control API

2. Desired-state updated
   └── Popper updates its desired-state record

3. Command issued
   ├── ControlCommandV2 generated
   ├── CONTROL_COMMAND_ISSUED audit event emitted
   └── Sent via Push Delivery (or piggyback for ROUTINE)

4. Response received
   ├── APPLIED → update last_actual_state, verify match
   ├── REJECTED → log, decide whether to retry or escalate
   ├── DEFERRED → schedule follow-up check
   └── Timeout → retry per protocol, escalate if persistent

5. Reconciliation
   └── Periodic state polling confirms settings remain as desired
```

---

## 5) Popper Control API v2 Extensions

### 5.1 New Endpoints

In addition to existing v1 endpoints (`/v1/popper/control/safe-mode`, `/v1/popper/control/settings`), v2 adds:

#### Batch settings change
`POST /v2/popper/control/settings`

Request:
```json
{
  "target_instance_id": "deutsch-uihealth-01",
  "settings": [
    { "key": "autonomy.max_risk_level", "value": "low" },
    { "key": "prescriptions.enabled", "value": false }
  ],
  "priority": "URGENT",
  "reason": "Clinician-initiated safety restriction",
  "operator_id": "clinician_dr_kim"
}
```

Response: `ControlCommandV2` that was sent + initial ACK status.

#### Mode transition
`POST /v2/popper/control/mode`

Request:
```json
{
  "target_instance_id": "deutsch-uihealth-01",
  "target_mode": "RESTRICTED",
  "reason": "Entering maintenance window for model update",
  "operator_id": "admin_ops_team"
}
```

#### Get desired state
`GET /v2/popper/control/state/{instance_id}`

Response: Current `DesiredState` for the specified Deutsch instance.

#### Get reconciliation status
`GET /v2/popper/control/reconciliation/{instance_id}`

Response: Last reconciliation result, including any divergences.

#### Manual reconciliation trigger
`POST /v2/popper/control/reconciliation/{instance_id}`

Triggers an immediate reconciliation cycle for the specified instance.

> **Impl**: All 5 endpoints in `apps/server/src/plugins/control-v2.ts`, 8 tests.

### 5.2 v1 Endpoint Compatibility

Existing v1 endpoints remain functional and map to v2 internally:
- `POST /v1/popper/control/safe-mode` → generates `SET_SAFE_MODE` ControlCommandV2
- `POST /v1/popper/control/settings` → generates single-setting `SET_OPERATIONAL_SETTINGS` ControlCommandV2

---

## 6) ISO Compliance Mapping

| ISO Requirement | How This Spec Addresses It |
|----------------|---------------------------|
| "securely exert direct live control" (§1.2.5) | ControlCommandV2 with mTLS, RBAC, ACK verification |
| "changes in operational settings for care management functions" (§1.2.5) | DSL `reconfigure` side-effect + typed settings catalog covering all care functions |
| "continuously monitor and control clinical agents" (TA2 narrative) | Signal Aggregator + Reconfigure Policy Engine for continuous trend-based control |
| "trigger a hard-stop analysis with a transition to safe mode" (TA2 narrative) | DSL `HARD_STOP` + `SET_SAFE_MODE` + `SET_OPERATIONAL_MODE` to SAFE_MODE |
| "monitor for dips in clinical reasoning" (TA2 narrative) | HTV trend detection triggers reconfigure policies |
| "dynamic locally-deployed monitoring tools" (§1.1) | Desired-State Manager with local reconciliation |
| "comprehensive audit logs" (Table 2 — Clinical Agent Management) | Full audit trail: ISSUED → RECEIVED → APPLIED/REJECTED + reconciliation events |

---

## 7) Implementation Inventory

| Component | Location | Tests |
|-----------|----------|-------|
| CC-v2 types & builder | `packages/core/src/control-v2/` | 30 (builder + conformance) |
| Desired-State Manager | `packages/core/src/desired-state/manager.ts` | 14 |
| Reconfigure Policy Engine | `packages/core/src/reconfigure-policy/evaluator.ts` | 30+ |
| Signal Aggregator | `packages/cache/src/signal-aggregator.ts` | 18 |
| Push Delivery Pipeline | `packages/core/src/push-delivery/` | 92 (across 5 files) |
| Server Plugin (control-v2) | `apps/server/src/plugins/control-v2.ts` | 8 |
| DB Schemas | `packages/db/src/schema/desired-state.ts` | — |
| Migration | `packages/db/drizzle/0011_popper_control_v2.sql` | — |
| Default Policies | `config/policies/reconfigure/default.yaml` | — |

---

#control-plane #popper #dsl #reconfigure #ta2 #iso-compliance
