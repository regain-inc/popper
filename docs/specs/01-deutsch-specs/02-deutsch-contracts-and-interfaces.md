---
version: 1.0.0
last-updated: 2026-01-24
status: draft
owner: Deutsch Dev Team
tags: [advocate, ta1, deutsch, api, contracts]
---

# Deutsch Contracts & Interfaces (v1)

This file defines:
- the **internal interface** Deutsch Service exposes (used by the HTTP API layer)
- the **cartridge plugin interface** (domain modules)
- how Deutsch consumes the **Hermes v1 contract** for supervision, auditability, and interoperability

> **Deployment Model**: Deutsch is deployed as a **centralized SaaS Service** (primary). The HTTP API specification is in [`10-deutsch-service-api-spec.md`](./10-deutsch-service-api-spec.md). This file defines the internal contracts used by the Service implementation.

## 1) Deutsch internal interface (core engine)

The Deutsch core engine implements this interface. The HTTP API layer (see `10-deutsch-service-api-spec.md`) wraps this interface with session management, streaming, and multi-tenancy.

### 1.1 Types

```ts
export type Mode = 'wellness' | 'advocate_clinical';

export interface DeutschInput {
  trace_id?: string; // optional for callers; Deutsch MUST generate one before emitting any Hermes messages if missing
  mode: Mode;

  subject: {
    subject_id: string;          // pseudonymous stable ID
    organization_id?: string;
  };

  // Snapshot reference is Hermes-compatible so Popper can reproduce decisions.
  snapshot: HealthStateSnapshotRef;

  user_message: {
    text: string;
    channel: 'app' | 'web' | 'sms' | 'voice';
    created_at: string;
  };

  // Optional multimodal inputs (TA1 requirement).
  // Implementations MAY keep these behind internal URIs and only include hashes/refs here.
  attachments?: Array<{
    kind: 'image' | 'video' | 'audio' | 'file';
    uri: string; // internal pointer
    content_hash?: string;
  }>;
}

export interface UIInstruction {
  // Minimal server-driven UI contract for v1 (extend as needed).
  kind: 'markdown' | 'card' | 'cta' | 'form' | 'pro_questionnaire' | 'timeline_event';
  title?: string;
  body_markdown?: string;
  cta?: { label: string; action: string };
  fields?: Array<{
    key: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'rating_scale' | 'likert_5' | 'visual_analog';
    options?: string[];
    min?: number;  // For rating_scale and visual_analog
    max?: number;
  }>;

  // PRO questionnaire-specific fields (when kind === 'pro_questionnaire')
  questionnaire_id?: 'KCCQ-23' | 'KCCQ-12' | 'MLHFQ-21' | 'INSPIRE' | 'WOUND-Q';
  questionnaire_version?: string;
}

export interface DeutschOutput {
  trace_id: string;
  mode: Mode;

  // Patient-safe final message (Deutsch MUST ensure policy-safe wording).
  patient_message_markdown: string;

  // Optional UI actions for thin clients.
  ui_instructions: UIInstruction[];

  // If Deutsch proposed actions, return them for debugging/ops visibility.
  // (Execution still depends on Popper decision and host app.)
  proposed_interventions: ProposedIntervention[];

  // Supervision outcome. Deutsch MUST NOT fabricate a Popper response.
  // - If Popper responds and the response validates, include it under `response`.
  // - If Popper is unreachable/invalid, include a safe fallback decision (for host orchestration)
  //   and log/emit audit events explaining the failure.
  supervision: {
    status: 'NOT_REQUIRED' | 'RECEIVED' | 'FAILED';
    response?: SupervisionResponse; // present iff status === 'RECEIVED'
    safe_fallback?: {
      decision: SupervisionDecision;
      reason_codes: ReasonCode[];
      explanation: string;
    }; // present iff status === 'FAILED'
    failure?: {
      code: 'popper_unreachable' | 'timeout' | 'invalid_response' | 'schema_invalid' | 'other';
      message: string;
    }; // present iff status === 'FAILED'
  };

  // Audit events emitted by Deutsch during processing.
  audit_events: AuditEvent[];
}
```

#### 1.1.1 Trace ID generation rules (normative)

- If `DeutschInput.trace_id` is provided, Deutsch MUST use it verbatim.
- If `DeutschInput.trace_id` is missing, Deutsch MUST generate a stable ID (UUID or ULID) **before**:
  - creating any Hermes `TraceContext`
  - emitting any Hermes `AuditEvent`
  - creating any Hermes `SupervisionRequest`
- All Hermes messages emitted as part of the same “one supervised action” flow MUST share the same `trace_id`.

#### 1.1.2 Attachments (PHI + prompt-injection safety) — normative

Attachments are operationally sensitive:

- `attachments[].uri` MUST be an **internal pointer** (never a public URL).
- `attachments[].content_hash` SHOULD be included for integrity and reproducibility.
- Deutsch MUST NOT include raw attachment content in any Hermes `audit_redaction` fields.
- In `advocate_clinical` mode, Deutsch MUST:
  - scan attachments for PHI before using them in reasoning
  - scan for prompt-injection / instruction-following attacks in multimodal inputs
  - if high-risk injection is detected, default to safety (route / request clinician review)
  - populate Hermes `SupervisionRequest.input_risk` so Popper can be conservative (PHI-minimized flags only)

#### 1.1.4 Safe fallback decision rules (normative)

When `supervision.status === "FAILED"`, Deutsch MUST provide a safe fallback decision suitable for host orchestration.

Minimum required behavior:
- If `mode === "advocate_clinical"` and supervision was required:
  - default `safe_fallback.decision = "ROUTE_TO_CLINICIAN"`
  - `safe_fallback.reason_codes` SHOULD include `high_uncertainty` (and MAY include `policy_violation` for integrity-like failures such as `invalid_response`)
- If `mode === "wellness"` and supervision was required:
  - default `safe_fallback.decision = "HARD_STOP"` (no treatment-changing actions)
  - `safe_fallback.reason_codes` SHOULD include `high_uncertainty`

Failure-code mapping guidance:
- `failure.code = "invalid_response"` MUST NOT be mapped to `reason_codes = ["schema_invalid"]` (that is request-shape oriented). Prefer `policy_violation` + an explanatory message.

Audit tagging guidance:
- For failures to reach/validate Popper, Deutsch SHOULD emit `AuditEvent.event_type = "VALIDATION_FAILED"` with tags like `tags.dependency = "popper"` and `tags.failure_code = <failure.code>`.

#### 1.1.3 Regulated replay protection (normative)

When `mode === "advocate_clinical"`, Deutsch MUST populate Hermes replay-protection fields on the `SupervisionRequest`:

- `idempotency_key` (stable across retries)
- `request_timestamp` (ISO-8601 UTC)

Deutsch MUST bind Popper’s response to the original request by verifying `request_idempotency_key` (when present) matches the request it sent.

#### 1.1.4 Regulated snapshot access (normative)

In `advocate_clinical`, Deutsch MUST ensure Popper can access snapshot bytes for supervision, via at least one of:

- `snapshot.snapshot_uri` present and resolvable within the deployment boundary, OR
- `snapshot_payload` present inline on the `SupervisionRequest`.

If Deutsch cannot provide either access mode for a high-risk proposal, Deutsch MUST default to safety (route to clinician) and MUST emit `VALIDATION_FAILED` audit events explaining the missing snapshot access.

#### 1.1.5 Partial approval + interdependency (normative)

Hermes supports partial approvals via `SupervisionResponse.per_proposal_decisions`.

Deutsch MUST:

- **Signal interdependency**: when multiple `ProposedIntervention` items must be treated atomically (e.g., “do A only if B is also approved”), Deutsch MUST set the same `interdependency_group_id` on each proposal in the group.
- **Honor per-proposal decisions**:
  - If `per_proposal_decisions` is present, Deutsch (and/or its host wrapper) MUST treat it as authoritative for execution: only proposals with `decision === "APPROVED"` may proceed.
  - If any proposal in an `interdependency_group_id` is not approved, Deutsch/host MUST treat the entire group as not approved.
- **Validate response coherence**:
  - If `per_proposal_decisions` is present but missing entries for any `proposal_id` in the request, Deutsch MUST treat the response as invalid and fall back to safety (see §1.1.4).
  - If `per_proposal_decisions` contains contradictory decisions within an `interdependency_group_id`, Deutsch MUST treat as invalid and fall back to safety.
- **Patient messaging**:
  - Deutsch MUST ensure `patient_message_markdown` does not instruct the patient to perform actions that were not approved.
  - If some proposals are routed and others approved, Deutsch SHOULD present approved low-risk items while clearly stating that routed items require clinician review.

### 1.2 Function signature

```ts
export interface PopperClient {
  supervise(req: SupervisionRequest): Promise<SupervisionResponse>;
}

export interface DeutschRuntimeDeps {
  popper: PopperClient;
  now: () => string; // ISO time
}

export async function handleDeutschMessage(
  input: DeutschInput,
  deps: DeutschRuntimeDeps,
  cartridge: ClinicalCartridge,
): Promise<DeutschOutput>;
```

#### 1.2.1 Popper call timeouts + retries (normative)

Deutsch MUST treat Popper supervision as a hard safety dependency for high-risk actions.

- **Timeout**: Deutsch MUST apply a timeout to the Popper call (default: **200ms**, configurable per deployment).
- **Retry**: Deutsch SHOULD avoid retries on the user-perceived path. If a retry is used for transient transport failures:
  - it MUST reuse the same `idempotency_key` (when present)
  - it MUST be bounded (default: at most **1** retry)
  - it MUST use short backoff (default: 25–50ms jittered)
- **Failure behavior**: on timeout/unreachable/invalid response, Deutsch MUST fail safe:
  - do not execute high-risk proposals
  - route or hard-stop per mode/governance
  - emit `VALIDATION_FAILED` audit event(s)

## 2) Optional Deutsch HTTP API (if you ship a service wrapper)

### 2.1 Endpoint

`POST /v1/deutsch/message`

Request body: `DeutschInput`  
Response body: `DeutschOutput`

### 2.2 Error behavior
- If Popper is unreachable or Hermes validation fails, Deutsch MUST return a safe response and include:
  - `supervision.status = "FAILED"`
  - `supervision.safe_fallback` (usually `ROUTE_TO_CLINICIAN`, or `HARD_STOP` when appropriate)
  - at least one Hermes `AuditEvent` with `event_type = "VALIDATION_FAILED"` (and details in `summary`/`tags`)

## 3) Cartridge interface (the “plug-in” contract)

Deutsch Engine MUST only talk to disease specifics through this interface.

```ts
export interface ClinicalCartridge {
  cartridge_id: string;         // e.g. "cvd"
  cartridge_version: string;    // semver

  // Provide vocabulary and known safe constraints.
  get_guardrails(): Array<{ id: string; description: string; severity: 'hard' | 'soft' }>;

  // Given current case context, propose interventions (structured).
  propose_interventions(input: {
    trace: TraceContext;
    mode: Mode;
    subject: SubjectRef;
    snapshot: HealthStateSnapshotRef;
    user_message: DeutschInput['user_message'];
  }): Promise<ProposedIntervention[]>;

  // Produce patient-facing wording rules/templates (reduce unsafe phrasing).
  render_patient_message(input: {
    mode: Mode;
    interventions: ProposedIntervention[];
  }): Promise<string>;
}
```

## 4) Hermes contract dependency (normative)

Deutsch MUST implement supervision and auditability using the Hermes v1 contract:
- **Canonical contract**: [`../03-hermes-specs/02-hermes-contracts.md`](../03-hermes-specs/02-hermes-contracts.md)

Deutsch MUST use Hermes types/schemas for:
- `TraceContext`, `SubjectRef`, `HealthStateSnapshotRef`
- `EvidenceRef`, `DisclosureBundle`
- `ProposedIntervention` (including `kind: "OTHER"` when needed)
- `SupervisionRequest`, `SupervisionResponse`, `ControlCommand`
- `AuditEvent`, `HermesError`, `InteropPayloadRef`

## 5) Audit events (Deutsch emits these)

Deutsch MUST emit Hermes `AuditEvent` objects (see Hermes contract) that are joinable by `trace_id`.

Minimum required event emission for v1:
- **When supervision is required and sent**: `event_type = "SUPERVISION_REQUEST_SENT"`
- **When a valid response is received**: `event_type = "SUPERVISION_RESPONSE_RECEIVED"`
- **When returning the final output**: `event_type = "OUTPUT_RETURNED"`
- **When supervision fails** (Popper unreachable, timeout, invalid schema): `event_type = "VALIDATION_FAILED"`

Optional (recommended):
- For “no supervision needed” cases, use `event_type = "OTHER"` with:
  - `other_event_type = "SUPERVISION_SKIPPED_LOW_RISK"`
  - `tags.reason = "low_risk"`

## 6) ControlCommand handling (Popper → Deutsch) — normative

Popper may return `control_commands` in `SupervisionResponse` (Hermes `ControlCommand`) to enable safe-mode and operational setting changes.

Deutsch (and/or its host wrapper) MUST:
- **Not ignore** `SupervisionResponse.control_commands` when present.
- **Apply** supported commands deterministically and persist the updated control state for subsequent requests.
  - In the primary SaaS deployment, the **Deutsch Service** owns persistence of control state.
  - In secondary on-prem deployments (library embedding), the **host application** MAY own persistence, but Deutsch MUST still surface the commands and required audit events.
- **Atomicity & timing**:
  - Apply commands **atomically per response** (either all supported commands apply, or treat as a failure).
  - Commands take effect **immediately after** the response is received (they do not retroactively change the decision for the already-supervised action).
- **Emit audit receipts**:
  - For each successfully applied command: emit `AuditEvent.event_type = "CONTROL_COMMAND_APPLIED"` (PHI-minimized) with tags such as `tags.command_id`, `tags.command_kind`, `tags.applied = "true"`.
  - If a command cannot be applied: emit `VALIDATION_FAILED` and default to safety for any high-risk actions until control state is known-good again.

## 7) Multi-Domain Composition Interface

For multi-domain composition (see [`04-multi-domain-composition-spec.md`](./04-multi-domain-composition-spec.md)), domain modules MUST implement the extended interface below.

### 7.1 DomainModule Interface

```ts
type DomainCategory =
  | 'clinical'        // Cardiology, Nephrology, Oncology, etc.
  | 'lifestyle'       // Nutrition, Exercise, Sleep hygiene
  | 'behavioral'      // Mental health, Meditation, Stress management
  | 'preventive'      // Screening, Vaccination, Preventive care
  | 'rehabilitative'  // Cardiac rehab, Physical therapy, Pulmonary rehab
  | 'other';          // Use when a domain doesn't fit the core set

interface PriorityRule {
  rule_id: string;
  condition: string;              // Expression evaluated against snapshot
  priority_adjustment: number;    // Added to default_priority (-50 to +50)
  reason: string;                 // Human-readable explanation
}

interface ModuleHealth {
  status: 'healthy' | 'degraded' | 'failed';
  details?: string;
  last_check: string;             // ISO timestamp
}

interface DomainModule extends ClinicalCartridge {
  // Identity
  domain_id: string;              // e.g., "cardiology", "nutrition", "mental_health"
  domain_version: string;         // semver

  // Category (informational, not for priority determination)
  domain_category: DomainCategory;

  // Modes this domain module supports (governance boundary).
  supported_modes: Mode[];        // e.g., ["wellness", "advocate_clinical"]

  // What this domain requires from the snapshot
  required_snapshot_signals: string[];

  // What conflict types this domain may participate in
  potential_conflict_types: string[];

  // Priority is computed from patient context, not hardcoded
  default_priority: number;       // 1-100, base priority
  priority_rules: PriorityRule[]; // Context-dependent adjustments

  // Interaction registries this domain uses
  interaction_registry_refs: string[];

  // Health check for graceful degradation
  health_check(): Promise<ModuleHealth>;
}
```

### 7.2 DomainComposer Interface

```ts
interface CompositionConfig {
  domains: DomainModule[];
  interaction_registries: string[];   // Additional registries beyond domain defaults
  mode: Mode;
  organization_id?: string;           // For org-specific registry overrides
}

interface CompositionResult {
  proposals: ProposedIntervention[];
  cross_domain_conflicts: CrossDomainConflict[];  // See Hermes contracts
  contributing_domains: ContributingDomain[];
  composition_metadata: CompositionMetadata;      // See Hermes contracts
}

interface ContributingDomain {
  domain_id: string;
  domain_version: string;
  domain_category: DomainCategory;
  status: 'success' | 'degraded' | 'failed';
  failure_reason?: string;
  proposal_ids: string[];             // Which proposals came from this domain

  // Optional PHI-minimized data quality summary (mirrors Hermes ContributingDomain.data_quality).
  data_quality?: {
    staleness_seconds: number;
    missing_signals: string[];
    conflicting_signals: string[];
  };
}

interface CompositionMetadata {
  composer_version: string;

  registries_loaded: Array<{
    registry_ref: string;
    registry_version: string;
    rule_count: number;
  }>;

  priority_snapshot: Record<string, number>;     // domain_id → computed priority (1–100)

  rule_engine_status: 'healthy' | 'degraded' | 'failed';
}

interface DomainComposer {
  // Compose multiple domains into unified session
  compose(config: CompositionConfig): Promise<ComposedSession>;

  // Get computed priorities for snapshot
  computePriorities(
    domains: DomainModule[],
    snapshot: HealthStateSnapshotRef
  ): Record<string, { priority: number; reasons: string[] }>;

  // Validate domain compatibility
  validateCompatibility(domains: DomainModule[]): Promise<{
    compatible: boolean;
    issues: string[];
  }>;
}

interface ComposedSession {
  session_id: string;
  domains: DomainModule[];
  priorities: Record<string, number>;

  // Process a message through all domains
  handleMessage(input: DeutschInput): Promise<CompositionResult>;
}
```

### 7.3 Usage Example

```ts
import { DomainComposer, CardiologyDomain, NutritionDomain, ExerciseDomain } from '@deutsch/domains';

const composer = new DomainComposer();

// Validate compatibility first
const compatibility = await composer.validateCompatibility([
  CardiologyDomain,
  NutritionDomain,
  ExerciseDomain,
]);

if (!compatibility.compatible) {
  throw new Error(`Incompatible domains: ${compatibility.issues.join(', ')}`);
}

// Create composed session
const session = await composer.compose({
  domains: [CardiologyDomain, NutritionDomain, ExerciseDomain],
  interaction_registries: [
    'registries://org_ta3_alpha/overrides',  // Site-specific overrides
  ],
  mode: 'advocate_clinical',
  organization_id: 'org_ta3_alpha',
});

// Process patient message
const result = await session.handleMessage(input);

// Result includes:
// - proposals from all domains
// - cross_domain_conflicts (surfaced for Popper)
// - contributing_domains with status
// - composition_metadata for audit
```

See [`04-multi-domain-composition-spec.md`](./04-multi-domain-composition-spec.md) for full specification.
