# 12 - Audit Event Hermes Mapping

> G5 gap closure: Popper audit events use a different type system from Hermes `AuditEvent`. This document defines the canonical mapping and recommends a bridge strategy.

## 1. Event Type Mapping

| Popper `AuditEventType` | Hermes `AuditEventType` | Notes |
|---|---|---|
| `SUPERVISION_DECISION` | `SUPERVISION_RESPONSE_DECIDED` | Semantic equivalent. Popper bundles request+response into one event. |
| `VALIDATION_FAILED` | `VALIDATION_FAILED` | 1:1 match. |
| `SAFE_MODE_CHANGED` | `SAFE_MODE_ENABLED` or `SAFE_MODE_DISABLED` | Disambiguated at runtime using `payload.safe_mode.active`. |
| `CONTROL_COMMAND` | `CONTROL_COMMAND_ISSUED` | Popper uses a generic name; Hermes distinguishes issued vs applied. |
| `CONTROL_COMMAND_ISSUED` | `CONTROL_COMMAND_ISSUED` | 1:1 match. |
| `CONTROL_COMMAND_TIMEOUT` | `OTHER` | No Hermes equivalent. `other_event_type` = `"CONTROL_COMMAND_TIMEOUT"`. |
| `CONTROL_STATE_DIVERGENCE` | `OTHER` | No Hermes equivalent. `other_event_type` = `"CONTROL_STATE_DIVERGENCE"`. |
| `CONTROL_RECONCILIATION_FAILED` | `OTHER` | No Hermes equivalent. `other_event_type` = `"CONTROL_RECONCILIATION_FAILED"`. |
| `POLICY_LIFECYCLE` | `OTHER` | No Hermes equivalent. `other_event_type` = `"POLICY_LIFECYCLE"`. |
| `EXPORT_GENERATED` | `OTHER` | No Hermes equivalent. `other_event_type` = `"EXPORT_GENERATED"`. |
| `EXPORT_DOWNLOADED` | `OTHER` | No Hermes equivalent. `other_event_type` = `"EXPORT_DOWNLOADED"`. |
| `EXPORT_ACCESSED` | `OTHER` | No Hermes equivalent. `other_event_type` = `"EXPORT_ACCESSED"`. |
| `OTHER` | `OTHER` | 1:1 match. |

## 2. Field-Level Mapping

| Popper `AuditEventInput` field | Hermes `AuditEvent` field | Transformation |
|---|---|---|
| `eventType` | `event_type` | Mapped per table above. |
| _(derived)_ | `other_event_type` | Set when Hermes event_type is `OTHER` and the Popper type has no direct equivalent. |
| `traceId` | `trace.trace_id` | Wrapped in `TraceContext` object. |
| _(generated)_ | `trace.created_at` | Set to `occurred_at` value. |
| _(hardcoded)_ | `trace.producer.system` | `'popper'` |
| `policyPackVersion` | `trace.producer.ruleset_version` | Policy version maps to ruleset version. |
| _(generated)_ | `hermes_version` | `CURRENT_HERMES_VERSION` from `@regain/hermes`. |
| _(literal)_ | `message_type` | Always `'audit_event'`. |
| _(generated)_ | `occurred_at` | `new Date().toISOString()` as `IsoDateTime`. |
| `payload?.mode` or `'wellness'` | `mode` | Extracted from payload or defaults to `'wellness'`. |
| `subjectId` | `subject.subject_id` | Wrapped in `SubjectRef`. |
| `organizationId` | `subject.organization_id` | Wrapped in `SubjectRef`. |
| _(literal)_ | `subject.subject_type` | Always `'patient'`. |
| `payload` (serialized) | `summary` | PHI-free summary string built from event type + decision + reason codes. |
| `tags[]` (string array) | `tags` (Record<string, string>) | Popper tags are converted to `{ [tag]: 'true' }` entries. |

## 3. Fields with No Hermes Equivalent

These Popper fields have no place in the Hermes `AuditEvent` envelope. They are preserved in the `tags` map for auditability:

- `decision` -- stored as `tags.decision`
- `reasonCodes` -- stored as `tags.reason_codes` (comma-joined)
- `latencyMs` -- stored as `tags.latency_ms`
- `proposalCount` -- stored as `tags.proposal_count`
- `safeModeActive` -- stored as `tags.safe_mode_active`
- `ruleProvenance` -- stored as `tags.rule_id`, `tags.source_type`, `tags.citation`

## 4. Recommended Strategy: Bridge (not unify)

**Recommendation: maintain a mapping bridge rather than importing Hermes types directly into Popper's audit module.**

Rationale:

1. **Popper-specific types serve a purpose.** Types like `POLICY_LIFECYCLE`, `EXPORT_*`, and `CONTROL_COMMAND_TIMEOUT` are domain-specific to Popper's policy engine and have no semantic equivalent in Hermes. Forcing them into the Hermes enum would pollute the protocol.

2. **Hermes is a wire protocol.** Popper's internal audit types are richer (they carry `decision`, `reasonCodes`, `ruleProvenance`, `payload`) and are designed for operational storage. Hermes `AuditEvent` is designed for cross-system observability with a minimal PHI-free envelope.

3. **Decoupled evolution.** Popper can add new audit event types without requiring a Hermes protocol version bump. The bridge maps new types to `OTHER` with `other_event_type` automatically.

4. **Single conversion point.** The `toHermesAuditEvent()` bridge function in `hermes-bridge.ts` is the one place to update when either type system changes.

## 5. Implementation

The bridge is implemented in `packages/core/src/audit/hermes-bridge.ts` and exported from the audit module index. See that file for the `toHermesAuditEvent()` function.

## 6. Testing

The bridge function should be tested for:

- Each direct mapping (SUPERVISION_DECISION, VALIDATION_FAILED, etc.)
- SAFE_MODE_CHANGED disambiguation (active=true vs active=false)
- Popper-only types falling through to OTHER with correct `other_event_type`
- Tag conversion from string array to Record
- Summary generation with PHI-free content
- Popper-specific fields preserved in tags
