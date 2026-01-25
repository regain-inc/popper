---
version: 0.3.0
last-updated: 2026-01-24
status: template
owner: TA3 Site + Regain Integration Team
tags: [advocate, ta3, deployment, governance, integration-profile, consent, feedback]
---

# TA3 Site Integration Profile (Template)

This document is a **TA3-site-specific, version-controlled profile** that pins operational and governance parameters required to deploy Deutsch/Popper/Hermes safely in `advocate_clinical` mode.

> Copy this template to a site-specific file (example):
> - `TA3-SITE-INTEGRATION-PROFILE.org_<your_org_id>.md`

---

## 1) Site identity

- **organization_id (Hermes)**: `org_<replace_me>`
- **TA3 site name**: `<replace_me>`
- **Primary technical contact**: `<name/email>`
- **Primary clinical governance contact**: `<name/email>`
- **Effective date**: `<YYYY-MM-DD>`

---

## 2) Mode enablement

| Product deployment | Hermes `mode` | Enabled? | Notes |
|---|---|---:|---|
| Wellness (D2C) | `wellness` | ☐ | |
| Regulated clinical (ADVOCATE) | `advocate_clinical` | ☐ | |

---

## 3) Snapshot access & verification (Popper independence)

### 3.1 Snapshot access mode (required for regulated deployments)

Hermes v1.4.0 requires Popper to have access to the snapshot **bytes** used for supervision, via one of:

- ☐ **A) Fetch by `snapshot_uri`** (preferred)
  - **Snapshot URI scheme(s) used**: `phi://snapshots/<id>` / `http://internal/...` / other: `<describe>`
  - **Is `snapshot_uri` resolvable by Popper?**: ☐ yes ☐ no

- ☐ **B) Inline `snapshot_payload`** (when Popper cannot/should not fetch snapshots over the network)
  - **Max inline payload size**: `<KB>` (recommend setting a hard limit)
  - **Who computes `snapshot_hash`**: snapshot builder / gateway / other: `<describe>`
  - **Hash verification required**: ☐ yes (recommended)

### 3.2 Snapshot verification policy

- **snapshot_hash required in advocate_clinical**: ☐ yes ☐ no
- **Popper snapshot fetch timeout** (mode A): `<ms>` (default recommended: 50ms)
- **Behavior when snapshot fetch fails (high-risk)** (mode A): `ROUTE_TO_CLINICIAN` (required default) / other: `<describe>`
- **Behavior when hash mismatch occurs** (mode A or B): `HARD_STOP` (recommended default) / other: `<describe>`

### 3.3 Snapshot quality flags

- **Canonical signal keys** used in `snapshot.quality.missing_signals` / `conflicting_signals`:
  - `<list keys; must align with protocol registry required_snapshot_signals>`

---

## 4) Protocol registry & allowlists (governance boundary)

### 4.1 Protocol allowlist source of truth

- ☐ Popper owns allowlist (local config/policy pack)
- ☐ External TA3 governance service (Popper calls it)
- ☐ Both (define precedence): `<describe>`

### 4.2 Approved protocol refs

List the allowed `clinician_protocol_ref` entries for this `organization_id` (or reference a controlled registry file).

---

## 5) Safety settings (staleness thresholds, safe-mode)

### 5.1 Staleness thresholds (override from defaults)

- **wellness staleness threshold**: `<hours>` (default 24h)
- **advocate_clinical staleness threshold**: `<hours>` (default 4h)
- **Change-control process for threshold updates**: `<describe>`

### 5.2 Safe-mode governance

- **Who can enable safe-mode** (roles/groups): `<describe>`
- **Who can disable safe-mode** (roles/groups): `<describe>`
- **Maximum safe-mode duration without review**: `<duration>`

### 5.3 Multi-domain composition thresholds (if using composition)

These settings override defaults in the Popper Safety DSL for multi-domain composition scenarios. See [`../../02-popper-specs/03-popper-safety-dsl.md`](../../02-popper-specs/03-popper-safety-dsl.md) §7.

- **Cross-domain conflict count threshold**: `<number>` (default 5)
  - Requests with more conflicts than this threshold are routed to clinician (`risk_too_high`)
- **Require evidence for all conflicts**: ☐ yes (recommended) ☐ no (requires justification)
  - If no, list exempt conflict types: `<describe>`
- **Graceful degradation categories**:
  - Categories that allow clinical recommendations to proceed if failed: ☐ `lifestyle` ☐ `behavioral` ☐ `preventive` ☐ `rehabilitative`
    - Recommended default: **only** `lifestyle` (others require explicit TA3 governance approval + rationale)
  - Categories that HARD_STOP if failed (cannot be overridden): `clinical` (always), `rule_engine` (always)
- **Domain interaction registries** (organization-specific overrides):
  - Registry URI: `registries://org_<org_id>/overrides`
  - Version: `<semver>`
  - Change-control process: `<describe>`

---

## 6) Integrity, auth, and replay protection (regulated mode)

### 6.1 Integrity strategy

- ☐ `TraceContext.signature` (preferred)
- ☐ “mTLS equivalent” (must document service identity + replay protection)

### 6.2 Key custody (if using signatures)

- **Key custody system**: KMS/Vault/HSM: `<describe>`
- **`key_id` format**: `<describe>`
- **Rotation cadence**: `<describe>`
- **Revocation procedure**: `<describe>`

### 6.3 Replay protection window

- **Idempotency replay window**: `<minutes>` (default 5 minutes)
- **Idempotency cache persistence/HA**: `<describe>`

### 6.4 Clock-skew tolerance

- **Clock-skew tolerance**: `<minutes>` (default ±5 minutes)
- **NTP/clock monitoring**: `<describe>`

### 6.5 Cybersecurity Vulnerability Management (MITRE CVSS Rubric)

Sites MUST use the **FDA-qualified MITRE Rubric for Applying CVSS to Medical Devices** (v0.12.04) for vulnerability assessment.

#### Vulnerability Disclosure SLA (Site-Level)

**TA3 Site Vulnerability Response** (site-level processes; Regain managed service may have stricter SLAs per Hermes spec §2.3.1):

| Severity | Discovery → Internal | Internal → Fix | Fix → Disclosure |
|----------|---------------------|----------------|------------------|
| Critical (CVSS 9.0-10.0) | 24 hours | 72 hours | Immediate |
| High (CVSS 7.0-8.9) | 48 hours | 7 days | 30 days |
| Medium (CVSS 4.0-6.9) | 7 days | 30 days | 90 days |
| Low (CVSS 0.0-3.9) | 30 days | 90 days | Next release |

*Note: "Internal → Fix" refers to site infrastructure changes. Hermes protocol vulnerabilities are patched by Regain per managed service SLA (High = 72 hours end-to-end).*

#### MITRE CVSS Implementation

- ☐ **Premarket vulnerability assessment** using MITRE CVSS Rubric
- ☐ **Post-market vulnerability tracking** with CVSS scoring
- ☐ **Patient safety impact scoring** included in security audit events
- **Vulnerability disclosure contact**: `<security@org.example>`

**Reference:** [`../../00-overall-specs/0B-FDA-alignment/13-qualified-mddt-solutions.md`](../../00-overall-specs/0B-FDA-alignment/13-qualified-mddt-solutions.md) §7

---

## 7) Interoperability connector path (FHIR / HL7v2 / TEFCA)

- **Primary EHR vendor**: `<replace_me>`
- **FHIR R4 available?**: ☐ yes ☐ no
- **HL7v2 available?**: ☐ yes ☐ no
- **TEFCA/QHIN path available?**: ☐ yes ☐ no
- **Minimum resources/messages guaranteed**: `<list>`

---

## 8) Audit logs & export bundles

### 8.1 Audit log environment

- **Audit logs stored in PHI-approved environment?**: ☐ yes ☐ no
- **If no**, confirm logs are strictly `audit_redaction` only: ☐ yes
- **Retention policy**: `<describe>`
- **Tamper-evident / WORM requirement**: `<describe>`

### 8.2 Export bundle recipients

- **Recipients**: TA3 site / ARPA-H / FDA / other: `<describe>`
- **Snapshot URI inclusion in bundles**: ☐ include (recipient has access) ☐ omit (hash-only)

---

## 9) Informed Consent & AI Disclosure (State Law Compliance)

### 9.1 Applicable State Disclosure Laws

Per Illinois, Texas (eff. Jan 2026), Utah HB 452, and similar state disclosure requirements, TA3 sites MUST configure appropriate informed consent workflows.

**Jurisdiction applicability:**
- ☐ Illinois (requires informing patients of AI use and obtaining consent)
- ☐ Texas (eff. Jan 2026: written disclosure prior to or on date of service)
- ☐ Utah HB 452 (disclosure of generative AI in regulated services)
- ☐ Other states: `<list>`
- ☐ No state AI disclosure requirements apply

### 9.2 Disclosure Configuration

**Patient-facing AI disclosure:**
- ☐ Acknowledge AI-assisted decision support in patient output (required if any box checked above)
- ☐ Include statement that clinician will review and make final decisions
- ☐ Custom disclosure text: `<paste jurisdiction-specific text if required>`

**Disclosure timing:**
- ☐ At enrollment/onboarding (once per patient)
- ☐ Per session (each interaction)
- ☐ Per clinical decision (each AI recommendation)
- ☐ Other: `<describe>`

### 9.3 Consent Workflow

**Consent capture mechanism:**
- ☐ EHR-integrated consent form
- ☐ App-based consent screen
- ☐ Separate consent document
- ☐ Other: `<describe>`

**Consent storage:**
- ☐ EHR patient record
- ☐ Separate consent database
- ☐ Other: `<describe>`

**Consent audit trail:**
- ☐ Consent event logged with `trace_id` linkage
- ☐ Consent version tracked (for policy updates)

### 9.4 Clinician Feedback Documentation

Per malpractice documentation best practices, clinician decisions on AI recommendations MUST be documented:

**Documentation requirements:**
- ☐ Clinician rationale required for all overrides (see Hermes §4.2.3)
- ☐ Response time tracking enabled (for alert fatigue analysis)
- ☐ Retention period: `<years>` (minimum 6 years per HIPAA)

**Alert fatigue monitoring:**
- ☐ Override rate alerts enabled at: `<percentage>` threshold
- ☐ Response time alerts enabled at: `<seconds>` threshold
- ☐ Alert fatigue reports sent to: `<role/email>`

---

## 10) Clinician Override Configuration

### 10.1 Override History Settings

**Override decay (see Deutsch §6.5.4):**
- **Default decay threshold**: `<days>` (default 180 days)
- **High-confidence extension**: `<days>` (default +90 days for high-confidence overrides)
- **Permanent override expiration check**: ☐ enabled (recommended for patient transfers)

### 10.2 Conflict Resolution Settings

**Resolution hierarchy (see Deutsch §6.5.6):**
- Default hierarchy: Attending > Specialist > Primary Care > NP/PA
  - Hermes role values: `attending`, `specialist`, `primary_care`, `nurse_practitioner`, `physician_assistant`
- ☐ Use default hierarchy
- ☐ Custom hierarchy: `<describe>`

**Conflict persistence:**
- ☐ Conflicts persist until attending resolves (recommended)
- ☐ Conflicts auto-resolve after: `<days>`

### 10.3 Care Continuity (Handoffs)

**Patient transfer settings (see Deutsch §6.5.7):**
- ☐ Override history transfers with patient (recommended)
- **Transferred override weight**: `<0.0-1.0>` (default 0.8)
- ☐ Permanent contraindications require re-confirmation after transfer

**Reference:** [`../../01-deutsch-specs/01-deutsch-system-spec.md`](../../01-deutsch-specs/01-deutsch-system-spec.md) §6.5

