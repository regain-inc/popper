---
version: 1.0.0
last-updated: 2026-01-23
status: draft
owner: Hermes Dev Team
tags: [advocate, hermes, security, integrity, key-management, deployment]
---

# Hermes Deployment Security Appendix — Key Custody, Integrity, and Failure Taxonomy

This document is a **deployment appendix** for Hermes v1.x.

- Hermes (`02-hermes-contracts.md`) defines message shapes and the canonical signing input bytes.
- This appendix defines **how deployments manage keys** and how integrity/auth failures are categorized for ops/regulatory audit.

## 1) Key custody and `key_id` lifecycle (normative for `advocate_clinical`)

In `advocate_clinical` deployments that use `TraceContext.signature`:

### 1.1 Key custody

Deployments MUST store signing keys in a dedicated key custody system:

- Preferred: HSM-backed KMS (AWS KMS / GCP KMS / Azure Key Vault) or Vault with HSM integration.
- Signing keys MUST NOT be stored in application config files or source code.
- Services MUST access keys via short-lived credentials (workload identity).

### 1.2 `key_id` format

`trace.signature.key_id` MUST be stable and resolvable within the deployment.

Recommended format:

- `kms://{provider}/{region}/{key_alias_or_arn}#{key_version}`
- `vault://{mount}/{path}#{key_version}`

### 1.3 Rotation and revocation

- Keys MUST be rotatable without downtime.
- Deployments MUST support verifying signatures from at least **N-1** key versions during a rotation window.
- Revocation MUST be possible within an operationally bounded timeframe (deployment-defined; recommended: <1 hour).

### 1.4 Verification requirements

- Receivers MUST verify the signature **before** acting on a supervision message.
- Verification failures MUST be treated as unsafe (see §2), and MUST be auditable.

### 1.5 Signature algorithm and encoding (normative)

To avoid cross-team cryptography drift in regulated deployments:

- In `advocate_clinical`, deployments that use signatures MUST use:
  - `trace.signature.alg = "jws"`
  - JWS Compact Serialization with `alg = "EdDSA"` (Ed25519)
  - base64url without padding for JWS segments
- `trace.signature.key_id` MUST be resolvable within the deployment and SHOULD match the JWS `kid` header when present.
- These constraints are normatively specified in Hermes:
  - `03-hermes-specs/02-hermes-contracts.md` §2.2.2

## 2) Integrity / auth / replay failure taxonomy (normative)

Hermes reason codes are intentionally small. Deployments MUST still be able to distinguish common failure classes for:

- clinician ops dashboards,
- incident triage,
- regulator export bundles.

### 2.1 Required audit tagging

When an integrity/auth/replay failure occurs, the emitting service MUST create a Hermes `AuditEvent` (PHI-minimized) with:

- `event_type = "VALIDATION_FAILED"`
- `tags.kind` in:
  - `auth_failed`
  - `signature_invalid`
  - `signature_missing`
  - `replay_suspected`
  - `clock_skew_rejected`
  - `snapshot_integrity_failed`
  - `unauthorized_org`
- optional tags:
  - `tags.key_id` (safe to include)
  - `tags.request_idempotency_key`
  - `tags.snapshot_id`

### 2.2 Recommended mapping to `SupervisionResponse.reason_codes`

When Popper returns a `SupervisionResponse` for an integrity-related failure, it SHOULD map to:

- `policy_violation` for:
  - signature invalid
  - replay suspected / idempotency mismatch
  - snapshot hash mismatch
  - unauthorized org/protocol access
- `schema_invalid` for:
  - missing fields required by regulated-mode constraints (e.g., missing `organization_id`, missing `request_timestamp`)

This keeps dashboards stable while preserving fine-grained classification in `AuditEvent.tags`.

### 2.3 Vulnerability Scoring Methodology (MITRE CVSS Rubric)

Hermes deployments MUST use the **MITRE Rubric for Applying CVSS to Medical Devices** (FDA MDDT-qualified October 2020, version 0.12.04) for vulnerability scoring.

#### 2.3.1 CVSS → Severity Mapping

**Regain Managed Service SLA** (applies to Hermes protocol implementation in managed service):

| CVSS Score | Medical Device Severity | Remediation SLA |
|------------|------------------------|-----------------|
| 0.0-3.9 | Low | Patch in next release |
| 4.0-6.9 | Medium | Patch within 30 days |
| 7.0-8.9 | High | Patch within 72 hours |
| 9.0-10.0 | Critical | Immediate mitigation + disclosure |

*Note: TA3 site deployments may define their own SLAs per `TA3-SITE-INTEGRATION-PROFILE.template.md` §6.5, but SHOULD meet or exceed these minimums for Hermes protocol components.*

#### 2.3.2 Security Event CVSS Scoring

When security-related `AuditEvent`s occur, implementations SHOULD include CVSS scoring:

| `tags.kind` | Typical CVSS Vector | Base Score | Patient Safety Impact |
|-------------|---------------------|------------|----------------------|
| `signature_invalid` | AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N | 7.5 (High) | medium |
| `replay_suspected` | AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N | 6.5 (Medium) | low |
| `unauthorized_org` | AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N | 8.1 (High) | high |
| `clock_skew_rejected` | AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:L/A:N | 3.7 (Low) | none |
| `snapshot_integrity_failed` | AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:L | 8.2 (High) | high |

#### 2.3.3 Extended AuditEvent Tags for CVSS

When `AuditEvent.event_type = "VALIDATION_FAILED"` for security events, implementations MAY include:

```ts
tags?: {
  kind: string;                   // Required: signature_invalid, replay_suspected, etc.
  cvss_vector?: string;           // CVSS v3.1 vector string
  cvss_score?: number;            // Base score (0.0-10.0)
  patient_safety_impact?: 'none' | 'low' | 'medium' | 'high';
};
```

**Reference:** [`../00-overall-specs/0B-FDA-alignment/13-qualified-mddt-solutions.md`](../00-overall-specs/0B-FDA-alignment/13-qualified-mddt-solutions.md) §7

## 3) Minimal required controls per TA3 deployment

Each TA3 deployment MUST define (and version-control) the following:

- The integrity strategy in regulated mode:
  - `TraceContext.signature` (preferred) or “mTLS equivalent” (explicitly documented)
- Replay protection window and idempotency cache persistence:
  - default: 5 minutes window; persistence at least in-memory with HA story
- Clock-skew tolerance (default ±5 minutes)
- Snapshot access policy:
  - whether Popper can fetch snapshots via `snapshot_uri`
  - timeout budget and fallback decisions for fetch/verify failures

These are captured in the **TA3 Site Integration Profile** template:
- `./additional/TA3-SITE-INTEGRATION-PROFILE.template.md`

