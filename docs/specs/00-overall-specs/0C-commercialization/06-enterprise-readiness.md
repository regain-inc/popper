# Enterprise Readiness: Clinical Agents System

## Executive Summary

This document addresses enterprise procurement requirements for Regain's clinical agents system. It covers compliance posture, security architecture, deployment options, and operational commitments required for health system and enterprise sales.

---

## 1. Compliance & Certification Roadmap

### Current Status

| Certification | Status | Target Date | Notes |
|---------------|--------|-------------|-------|
| **HIPAA Compliance** | ✅ In place | - | BAA available |
| **SOC 2 Type I** | 🔄 In progress | M6 | Audit scheduled |
| **SOC 2 Type II** | 📋 Planned | M12 | Post Type I |
| **HITRUST CSF** | 📋 Planned | M18 | After SOC 2 Type II |
| **FedRAMP Moderate** | 📋 Planned | M30 | For VA/DoD customers |
| **ISO 27001** | 📋 Planned | M24 | International expansion |

### SOC 2 Scope

| Trust Service Principle | In Scope | Evidence |
|------------------------|----------|----------|
| **Security** | ✅ Yes | Access controls, encryption, vulnerability management |
| **Availability** | ✅ Yes | SLAs, redundancy, disaster recovery |
| **Processing Integrity** | ✅ Yes | Audit trails, deterministic safety rules |
| **Confidentiality** | ✅ Yes | Data classification, encryption at rest/transit |
| **Privacy** | ✅ Yes | PHI handling, minimum necessary, consent |

---

## 2. BAA (Business Associate Agreement) Posture

### Covered Services

| Service | BAA Coverage | Notes |
|---------|--------------|-------|
| **Popper Managed Service** | ✅ Covered | Health tier and above |
| **Deutsch API** | ✅ Covered | Clinical tier and above |
| **Hermes Protocol** | N/A | No PHI handling (schemas only) |
| **Cartridge Licensing** | ✅ Covered | When deployed with PHI |

### BAA Terms Summary

| Requirement | Our Commitment |
|-------------|----------------|
| **PHI Encryption** | AES-256 at rest, TLS 1.3 in transit |
| **Access Controls** | RBAC, MFA required, audit logging |
| **Breach Notification** | Within 24 hours of discovery |
| **Subcontractor Management** | All subprocessors under BAA |
| **Data Deletion** | PHI deleted within 30 days of termination (see retention policy below) |
| **Audit Rights** | Annual third-party audit; customer audit with notice |

### Data Retention Policy

| Data Type | Contains PHI? | Retention | Deletion on Termination | Legal Basis |
|-----------|---------------|-----------|-------------------------|-------------|
| **Health state snapshots** | Yes (minimized) | Process only, not stored | N/A (not persisted) | HIPAA minimum necessary |
| **Request/response logs** | No (trace_id only) | 90 days | Deleted within 30 days | Operational |
| **Audit trail** | No (decisions, timestamps) | 7 years | Retained (regulatory) | SOC 2 TSC CC7.2; exceeds HIPAA §164.530(j)(2) 6-year minimum |
| **Customer configuration** | No | Duration of contract | Deleted within 30 days | Contractual |
| **De-identified exports** | No (Safe Harbor) | Per customer request | Customer controls | Research/regulatory |

**Key distinction**: Audit logs contain no PHI—only trace IDs, decision outcomes, and timestamps. This allows 7-year regulatory retention without HIPAA deletion conflicts. Customers can verify via audit log schema review.

### Subprocessors

| Provider | Service | Location | BAA Status |
|----------|---------|----------|------------|
| AWS | Cloud infrastructure | US regions | ✅ Signed |
| Microsoft Azure | Azure OpenAI (LLM inference) | US regions | ✅ Signed |
| Datadog | Monitoring (no PHI) | US | ✅ Signed |
| PagerDuty | Incident management (no PHI) | US | N/A |

### LLM Provider Posture

Deutsch reasoning requires LLM inference. We offer multiple deployment options:

| Option | Provider | PHI Handling | BAA Status | Availability |
|--------|----------|--------------|------------|--------------|
| **Regain-hosted (default)** | Azure OpenAI | PHI-minimized prompts | ✅ Covered by Regain BAA | ✅ Available |
| **Self-hosted LLM** | Customer-managed | PHI never leaves customer env | N/A (customer controls) | 📋 Enterprise tier |
| **Bedrock** | AWS Anthropic | PHI-minimized prompts | ✅ Covered via AWS BAA | 📋 Planned (M12) |

**PHI-minimized prompts**: Deutsch uses health state snapshots (structured data), not free-text clinical notes. Prompts contain:
- Vital signs (numeric values)
- Lab results (structured)
- Medication lists (coded)
- Safety zone classification

**What is NOT sent to LLM**:
- Patient identifiers (name, MRN, SSN)
- Free-text clinical notes
- Images or documents
- Full EHR data

**Enterprise options**:
- **Self-hosted LLM**: Deploy open-weight models (Llama, Mistral) in customer VPC
- **Dedicated Azure OpenAI**: Customer's own Azure subscription with isolated endpoint
- **Air-gapped**: Fully offline with self-hosted models (requires custom contract)

**Compliance documentation**:
- [Azure OpenAI HIPAA compliance](https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/security) - Azure OpenAI is covered under Microsoft's HIPAA BAA
- [AWS HIPAA Eligible Services](https://aws.amazon.com/compliance/hipaa-eligible-services-reference/) - Amazon Bedrock is a HIPAA-eligible service
- [Microsoft Azure BAA](https://learn.microsoft.com/en-us/azure/compliance/offerings/offering-hipaa-us) - HIPAA/HITECH attestation details

---

## 3. Data Flow & PHI Boundaries

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     CUSTOMER ENVIRONMENT                        │
│                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│  │   EHR/App    │────▶│   PHI Data   │────▶│  Hermes SDK  │   │
│  │   (Client)   │     │   Sources    │     │  (Schemas)   │   │
│  └──────────────┘     └──────────────┘     └──────┬───────┘   │
│                                                    │           │
└────────────────────────────────────────────────────│───────────┘
                                                     │
                            SupervisionRequest       │  ← PHI-minimized snapshot
                            (Hermes Protocol)        │    (TLS 1.3 encrypted)
                                                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                     REGAIN MANAGED SERVICE                      │
│                     (SOC 2 / HIPAA Compliant)                   │
│                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│  │   Deutsch    │◀───▶│   Popper     │────▶│  Audit Log   │   │
│  │ (Reasoning)  │     │ (Safety Eval)│     │  (Immutable) │   │
│  └──────────────┘     └──────────────┘     └──────────────┘   │
│         │                    ▲                                  │
│         │  Supervision call  │                                  │
│         └────────────────────┘                                  │
│                                                                 │
│  Flow: Request → Deutsch (reasoning) → Popper (supervision)    │
│        → Deutsch (applies safety decision) → Response          │
│                                                                 │
│  PHI Handling:                                                  │
│  - Minimum necessary (only health state snapshot, no full EHR)  │
│  - No persistent PHI storage (process in-memory, discard)       │
│  - Audit logs retain trace_id, decision, timestamps (no PHI)    │
│  - De-identified exports available                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key architectural notes**:
- **Hermes SDK**: Schema validation library (no PHI processing)
- **Deutsch**: Reasoning engine that calls Popper for safety supervision
- **Popper**: Deterministic safety layer (evaluates rules, no LLM inference)

### PHI Handling Principles

| Principle | Implementation |
|-----------|----------------|
| **Minimum Necessary** | Only health state snapshot fields required for safety evaluation |
| **Process, Don't Store** | PHI processed in-memory, not persisted to disk |
| **Audit Without PHI** | Logs contain trace_id, decision, timestamps—no clinical content |
| **De-identification** | Regulatory exports use Safe Harbor de-identification |
| **Encryption** | TLS 1.3 in transit; AES-256 at rest (for any temporary storage) |

### Data Residency Options

| Region | Availability | Notes |
|--------|--------------|-------|
| **US (default)** | ✅ Available | AWS us-east-1, us-west-2 |
| **US GovCloud** | 📋 Planned (M24) | FedRAMP Moderate |
| **EU** | 📋 Planned (M30) | AWS eu-west-1 (MDR compliance) |
| **Canada** | 📋 Planned (M30) | AWS ca-central-1 |

---

## 4. Deployment Options

### Cloud (Default)

| Tier | Isolation | SLA | Best For |
|------|-----------|-----|----------|
| **Pro** | Shared multi-tenant | 99.9% | Startups, SMBs |
| **Health** | Dedicated compute | 99.95% | Mid-market |
| **Audit** | Dedicated VPC | 99.99% | Enterprise |

### Dedicated Cloud

- Dedicated VPC per customer
- Customer-managed encryption keys (BYOK)
- Private endpoints (no public internet)
- +25-50% over base tier pricing

### On-Premise

| Component | Deployment Method | Requirements |
|-----------|-------------------|--------------|
| **Popper** | Helm chart (Kubernetes) | K8s 1.25+, 4 vCPU, 8GB RAM per replica |
| **Deutsch** | Helm chart (Kubernetes) | K8s 1.25+, 8 vCPU, 16GB RAM, GPU optional |
| **Hermes SDK** | npm package | Node.js 18+ |

**On-premise kit includes**:
- Docker images (signed, SBOM included)
- Helm charts with configurable values
- Installation guide
- Upgrade runbook
- Support SLA (response times per tier)

### Air-Gapped Deployment

- Full offline operation (no telemetry, no license checks)
- Manual update process (signed bundles)
- Additional +100% license fee
- Dedicated support engineer required

---

## 5. Security Architecture

### Encryption

| Layer | Method | Key Management |
|-------|--------|----------------|
| **In Transit** | TLS 1.3, minimum TLS 1.2 | AWS ACM or customer certs |
| **At Rest** | AES-256-GCM | AWS KMS (default) or BYOK |
| **Application** | Field-level encryption for sensitive fields | Envelope encryption |

### Access Controls

| Control | Implementation | Status |
|---------|----------------|--------|
| **Authentication** | OAuth 2.0 / OIDC | ✅ Available |
| **Enterprise SSO** | SAML 2.0 | 📋 Planned (M6) |
| **Authorization** | RBAC with principle of least privilege | ✅ Available |
| **MFA** | Required for all administrative access | ✅ Available |
| **API Keys** | Scoped, rotatable, audit-logged | ✅ Available |
| **Session Management** | Short-lived tokens, secure cookie flags | ✅ Available |

### Network Security

| Layer | Controls |
|-------|----------|
| **Perimeter** | WAF (AWS WAF), DDoS protection (Shield) |
| **Network** | VPC isolation, security groups, NACLs |
| **Application** | Rate limiting, input validation, output encoding |
| **Monitoring** | IDS/IPS, anomaly detection, SIEM integration |

### Vulnerability Management

| Activity | Frequency | Tool |
|----------|-----------|------|
| **Dependency scanning** | Every build | Snyk, Dependabot |
| **Container scanning** | Every build | Trivy |
| **SAST** | Every PR | CodeQL |
| **DAST** | Weekly | OWASP ZAP |
| **Penetration testing** | Annual | Third-party firm |
| **Bug bounty** | Ongoing | Planned (M12) |

### SBOM (Software Bill of Materials)

- Generated for every release
- Available in SPDX and CycloneDX formats
- Includes all dependencies (direct and transitive)
- Vulnerability alerts pushed to customers

---

## 6. Incident Response

### Response SLA by Severity

| Severity | Definition | Response Time | Update Frequency |
|----------|------------|---------------|------------------|
| **P1 (Critical)** | Service down, PHI breach | 15 minutes | Hourly |
| **P2 (High)** | Degraded service, security incident | 1 hour | Every 4 hours |
| **P3 (Medium)** | Feature unavailable, non-urgent | 4 hours | Daily |
| **P4 (Low)** | Minor issue, question | 24 hours | As resolved |

### Incident Process

1. **Detection**: Automated monitoring or customer report
2. **Triage**: Severity classification within 15 minutes
3. **Response**: Incident commander assigned
4. **Communication**: Customer notification per SLA
5. **Resolution**: Fix deployed, verified
6. **Post-mortem**: Root cause analysis within 5 business days
7. **Report**: Customer receives incident report

### Breach Notification

| Event | Notification Timeline | Recipient |
|-------|----------------------|-----------|
| **Suspected PHI breach** | Within 24 hours | Customer security contact |
| **Confirmed PHI breach** | Within 48 hours | Customer + HHS (if required) |
| **Security incident (no PHI)** | Within 72 hours | Customer security contact |

---

## 7. Business Continuity & Disaster Recovery

### Recovery Objectives

| Metric | Target | Tested |
|--------|--------|--------|
| **RPO (Recovery Point Objective)** | 1 hour | Quarterly |
| **RTO (Recovery Time Objective)** | 4 hours | Quarterly |

### Redundancy

| Component | Redundancy | Failover |
|-----------|------------|----------|
| **Compute** | Multi-AZ | Automatic |
| **Database** | Multi-AZ with read replicas | Automatic |
| **Storage** | S3 cross-region replication | Manual (for DR) |
| **DNS** | Route 53 health checks | Automatic |

### Backup Policy

| Data Type | Frequency | Retention | Encryption |
|-----------|-----------|-----------|------------|
| **Configuration** | Daily | 90 days | AES-256 |
| **Audit logs** | Continuous | 7 years | AES-256 |
| **Customer data** | Daily | Per contract | AES-256 |

---

## 8. Support Tiers

| Tier | Response Time | Channels | Named Contact |
|------|---------------|----------|---------------|
| **Pro** | 48 hours | Email | No |
| **Health** | 4 hours (P1-P2) | Email, Chat | Yes |
| **Audit** | 1 hour (P1) | Email, Chat, Phone | Yes + TAM |
| **On-Premise** | Custom | All | Dedicated engineer |

### Support Scope

| Included | Not Included |
|----------|--------------|
| Configuration assistance | Custom development |
| Integration troubleshooting | Customer code debugging |
| Performance optimization | Infrastructure management (on-prem) |
| Security guidance | Regulatory consulting |
| Upgrade planning | Clinical validation |

---

## 9. Procurement Checklist

### Documents Available on Request

| Document | Format | Request Process |
|----------|--------|-----------------|
| **SOC 2 Type I Report** | PDF | NDA required |
| **SOC 2 Type II Report** | PDF | NDA required (when available) |
| **Penetration Test Summary** | PDF | NDA required |
| **SBOM** | SPDX/CycloneDX | Public (per release) |
| **Architecture Diagram** | PDF | Sales request |
| **Data Flow Diagram** | PDF | Sales request |
| **BAA Template** | DOCX | Sales request |
| **Security Questionnaire (SIG/CAIQ)** | XLSX | Sales request |

### Pre-Sales Security Review

1. **Initial call**: Security architecture overview
2. **Questionnaire**: Complete customer security questionnaire
3. **Technical deep-dive**: Architecture review with customer security team
4. **Penetration test review**: Share summary findings (NDA)
5. **Contract review**: BAA, MSA, security addendum

---

## 10. Roadmap: Enterprise Features

| Feature | Target | Description |
|---------|--------|-------------|
| **BYOK (Bring Your Own Key)** | M6 | Customer-managed encryption keys |
| **SSO (SAML 2.0)** | M6 | Enterprise identity integration |
| **Audit log export** | M9 | SIEM integration (Splunk, Datadog) |
| **Private Link** | M12 | No public internet exposure |
| **FedRAMP Moderate** | M30 | Government customers |
| **HITRUST CSF** | M18 | Healthcare-specific certification |

---

## Sources

- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
- [SOC 2 Trust Service Criteria](https://www.aicpa.org/resources/article/trust-services-criteria)
- [HITRUST CSF](https://hitrustalliance.net/csf/)
- [FedRAMP](https://www.fedramp.gov/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
