# FDA Cybersecurity Requirements for Medical Devices

> **Document Version:** 1.0.0
> **Last Updated:** 2026-01-24
> **Applies To:** Deutsch (TA1), Popper (TA2), Hermes Protocol
> **Related Specs:** `03-hermes-deployment-security.md`

---

## 1. Overview

This document provides guidance on FDA cybersecurity requirements for the ADVOCATE clinical agent system based on the June 2025 final guidance "Cybersecurity in Medical Devices: Quality System Considerations and Content of Premarket Submissions."

### Cyber Device Definition

Per FDA Section 524B of the FD&C Act:

> A **cyber device** is a device that contains software or is itself software.

All ADVOCATE components (Deutsch, Popper, Hermes) are cyber devices and must comply with cybersecurity requirements.

---

## 2. Regulatory Framework

### 2.1 Key FDA Requirements

The June 2025 final guidance requires:

| Requirement | Description | Submission Impact |
|-------------|-------------|-------------------|
| **Cybersecurity Management Plan** | Continuous security posture maintenance | Required in premarket |
| **Security Risk Analysis** | Threat modeling and risk assessment | Required in premarket |
| **Software Bill of Materials** | Component transparency | Mandatory for cyber devices |
| **Architecture Documentation** | Data flows, communication protocols | Required in premarket |
| **Vulnerability Disclosure** | Process for receiving security reports | Required |

### 2.2 Quality System Regulation Changes

- FDA final rule (February 2024) aligns 21 CFR Part 820 with ISO 13485
- Effective February 2, 2026
- Emphasizes cybersecurity in design controls

### 2.3 Standards Alignment

| Standard | Scope | ADVOCATE Relevance |
|----------|-------|-------------------|
| **NIST Cybersecurity Framework** | General security practices | Baseline framework |
| **IEC 81001-5-1:2021** | Health software security | Security lifecycle |
| **IEC 62443** | Industrial automation security | Network security |
| **HIPAA Security Rule** | PHI protection | Data handling |

---

## 3. Premarket Submission Requirements

### 3.1 Cybersecurity Management Plan (CMP)

**Required Elements:**

| Element | Description | ADVOCATE Implementation |
|---------|-------------|------------------------|
| Security risk management | Ongoing threat assessment | Hermes security reviews |
| Vulnerability monitoring | CVE tracking, patch management | Dependency scanning |
| Incident response | Security event handling | Popper incident workflow |
| Coordinated disclosure | Reporting vulnerabilities | Disclosure policy |
| Update mechanism | Secure software updates | PCCP + deployment |

### 3.2 Security Risk Analysis (SRA)

**Threat Modeling Approach:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    STRIDE Threat Model                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  S - Spoofing Identity                                              │
│      └── Hermes: JWS signatures, mTLS authentication                │
│                                                                      │
│  T - Tampering with Data                                            │
│      └── Hermes: Message integrity, snapshot hashing                │
│                                                                      │
│  R - Repudiation                                                    │
│      └── Hermes: Audit events, trace IDs, signed receipts           │
│                                                                      │
│  I - Information Disclosure                                         │
│      └── PHI minimization, encryption at rest/transit               │
│                                                                      │
│  D - Denial of Service                                              │
│      └── Rate limiting, fallback behaviors                          │
│                                                                      │
│  E - Elevation of Privilege                                         │
│      └── RBAC, organization isolation, least privilege              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.3 Security Risk Management Report (SMR)

**Required Content:**

| Section | Content | Evidence |
|---------|---------|----------|
| Threat model | STRIDE analysis | Threat documentation |
| Asset inventory | Protected resources | Data flow diagrams |
| Risk assessment | Likelihood × Impact | Risk matrix |
| Risk controls | Mitigations implemented | Control descriptions |
| Residual risk | Remaining vulnerabilities | Acceptance rationale |

---

## 4. Software Bill of Materials (SBOM)

### 4.1 SBOM Requirements

SBOM is **mandatory** for all cyber devices as of 2024.

**Required Information:**

| Field | Description | Format |
|-------|-------------|--------|
| Component name | Package/library name | String |
| Version | Exact version | Semver |
| Supplier | Manufacturer/maintainer | String |
| Dependency relationship | Direct/transitive | Graph |
| Hash/checksum | Integrity verification | SHA-256 |

### 4.2 SBOM Formats

| Format | Standard | Preference |
|--------|----------|------------|
| **CycloneDX** | OWASP | Recommended |
| **SPDX** | Linux Foundation | Accepted |
| **SWID** | ISO/IEC 19770-2 | Accepted |

### 4.3 SBOM Generation

**ADVOCATE SBOM Scope:**

| Component | SBOM Coverage |
|-----------|---------------|
| Deutsch | All npm/Python dependencies |
| Popper | All npm/Python dependencies |
| Hermes | Schema libraries, crypto libraries |
| LLM Foundation | Model provenance, training data summary |

**Automation:**
```bash
# Generate CycloneDX SBOM
npm install -g @cyclonedx/cdxgen
cdxgen -o sbom.json

# For Python
pip install cyclonedx-bom
cyclonedx-py > sbom.xml
```

---

## 5. Architecture and Data Flow Documentation

### 5.1 Required Diagrams

| Diagram Type | Purpose | ADVOCATE Content |
|--------------|---------|------------------|
| **System Architecture** | Component relationships | Deutsch↔Popper↔Hermes |
| **Data Flow** | Information movement | PHI paths, audit data |
| **Network Topology** | Connection points | TA3 EHR integration |
| **Trust Boundaries** | Security zones | Internal vs external |

### 5.2 Communication Interface Disclosure

**Required Disclosures:**

| Interface | Protocol | Security |
|-----------|----------|----------|
| Deutsch ↔ Popper | Hermes/HTTPS | JWS + mTLS |
| Deutsch ↔ EHR | FHIR/HL7v2 | OAuth 2.0 + TLS |
| Deutsch ↔ Patient | HTTPS/WSS | TLS 1.3 |
| Popper ↔ Export | HTTPS | mTLS |
| Wearable data | Device APIs | Vendor-specific |

---

## 6. ADVOCATE Cybersecurity Controls

### 6.1 Hermes Security Controls

**Spec Reference:** `03-hermes-deployment-security.md`

| Control | Implementation | Requirement Met |
|---------|---------------|-----------------|
| **Message Signing** | JWS with EdDSA (Ed25519) | Integrity, non-repudiation |
| **Transport Security** | mTLS or equivalent | Confidentiality |
| **Replay Protection** | Idempotency key + 5-min window | Freshness |
| **Clock Validation** | ±5 min skew tolerance | Timing attacks |
| **Key Management** | HSM-backed KMS | Key protection |
| **Key Rotation** | N-1 version support | Continuity |

### 6.2 Access Control

| Control Type | Implementation | Spec Reference |
|--------------|---------------|----------------|
| **Authentication** | mTLS certificates, OAuth | Hermes §2.2 |
| **Authorization** | RBAC per organization | Hermes §2.4 |
| **Multi-tenant isolation** | org_id enforcement | Popper §2.4 |
| **Audit logging** | All access recorded | Hermes AuditEvent |

### 6.3 Data Protection

| Data Type | Protection | Implementation |
|-----------|------------|----------------|
| **PHI in transit** | TLS 1.3 encryption | Transport layer |
| **PHI at rest** | AES-256 encryption | Storage layer |
| **PHI in logs** | Redaction | audit_redaction field |
| **Keys** | HSM storage | Key custody spec |

---

## 7. Integrity Failure Handling

### 7.1 Failure Taxonomy

**Spec Reference:** `03-hermes-deployment-security.md` §2

| Failure Type | Audit Tag | Response |
|--------------|-----------|----------|
| `auth_failed` | Authentication failure | Reject request |
| `signature_invalid` | Bad JWS signature | HARD_STOP |
| `signature_missing` | Missing required signature | HARD_STOP (clinical mode) |
| `replay_suspected` | Duplicate idempotency key | Reject request |
| `clock_skew_rejected` | Timestamp out of tolerance | Reject request |
| `snapshot_integrity_failed` | Hash mismatch | HARD_STOP |
| `unauthorized_org` | Cross-tenant access | Reject + alert |

### 7.2 Response Actions

| Severity | Actions |
|----------|---------|
| **Critical** | HARD_STOP, safe-mode, incident creation, regulatory export |
| **High** | ROUTE_TO_CLINICIAN, alert ops, log event |
| **Medium** | Log event, aggregate for trending |
| **Low** | Log event only |

---

## 8. Vulnerability Management

### 8.1 Vulnerability Disclosure Process

**Required Elements:**

| Element | Implementation |
|---------|---------------|
| **Reporting channel** | security@[domain].com |
| **Response timeline** | Acknowledge within 48 hours |
| **Triage process** | Severity assessment within 7 days |
| **Remediation** | Based on severity |
| **Disclosure coordination** | 90-day disclosure timeline |

### 8.2 Patch Management

| Severity | Remediation Timeline |
|----------|---------------------|
| **Critical** | 24-48 hours |
| **High** | 7 days |
| **Medium** | 30 days |
| **Low** | Next scheduled release |

### 8.3 CVE Monitoring

- Automated dependency scanning (Dependabot, Snyk)
- NVD monitoring for relevant CVEs
- SBOM-based vulnerability correlation

---

## 9. eSTAR Cybersecurity Documentation

### 9.1 Required Documents (~12)

| Document | Content |
|----------|---------|
| Cybersecurity Risk Management Report | Full risk analysis |
| Threat Model | STRIDE or equivalent |
| Cybersecurity Controls Matrix | Controls vs threats |
| Software Bill of Materials | All components |
| Architecture Diagrams | System and data flow |
| Vulnerability Management Plan | Patching, disclosure |
| Incident Response Plan | Security event handling |
| Security Testing Summary | Penetration testing results |
| Cryptographic Module Information | Algorithms, key lengths |
| Update Mechanism Description | Secure update process |
| Interoperability Considerations | Third-party security |
| Labeling Cybersecurity Information | User-facing security info |

### 9.2 eSTAR Submission Tips

- Use FDA's editable PDF format
- Reference NIST CSF mappings
- Include test evidence summaries
- Cross-reference to full reports

---

## 10. Implementation Checklist

### Threat Modeling

- [ ] Complete STRIDE analysis for all components
- [ ] Document trust boundaries
- [ ] Identify attack surfaces
- [ ] Assess threat likelihood and impact

### SBOM Generation

- [ ] Generate SBOM for each component
- [ ] Validate SBOM completeness
- [ ] Set up automated SBOM updates
- [ ] Correlate SBOM with CVE databases

### Security Controls

- [ ] Implement Hermes message signing (JWS)
- [ ] Configure mTLS for inter-service communication
- [ ] Set up HSM-backed key management
- [ ] Implement replay protection
- [ ] Configure RBAC and multi-tenant isolation

### Documentation

- [ ] Create architecture diagrams
- [ ] Document data flow diagrams
- [ ] Write Cybersecurity Risk Management Report
- [ ] Prepare Security Testing Summary
- [ ] Draft vulnerability disclosure policy

### Ongoing

- [ ] Set up dependency scanning
- [ ] Configure CVE monitoring
- [ ] Establish patch management process
- [ ] Plan incident response procedures
- [ ] Schedule penetration testing

---

## 11. References

### FDA Guidance

- [Cybersecurity in Medical Devices: Quality System Considerations (2025)](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/cybersecurity-medical-devices-quality-system-considerations-and-content-premarket-submissions)
- [Content of Premarket Submissions for Device Software Functions](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/content-premarket-submissions-device-software-functions)
- [SBOM Data Normalization White Paper (2024)](https://www.fda.gov/medical-devices/digital-health-center-excellence/cybersecurity)

### Standards

- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [IEC 81001-5-1:2021 Health software security](https://www.iso.org/standard/76528.html)
- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html)

### SBOM Resources

- [CycloneDX Specification](https://cyclonedx.org/)
- [SPDX Specification](https://spdx.dev/)

### ADVOCATE Specs

- [Hermes Deployment Security](../../03-hermes-specs/03-hermes-deployment-security.md)
- [Hermes Contracts](../../03-hermes-specs/02-hermes-contracts.md)
- [Popper Regulatory Export](../../02-popper-specs/04-popper-regulatory-export-and-triage.md)

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-24 | ADVOCATE Team | Initial release |
