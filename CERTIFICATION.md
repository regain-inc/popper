# [PROPOSED] Regain Popper™ Certification Program

> **Status: Roadmap 2026 (Draft)**
> This document outlines the proposed certification program for Regain Popper™ implementations. These tiers and requirements are subject to change as the system evolves. We are currently inviting early partners to help shape these standards.

## Overview

The Regain Popper™ Certification Program establishes trust in the clinical AI ecosystem by verifying that supervisory agent implementations correctly follow the Hermes protocol and meet clinical safety standards.

Certification provides hospitals, medical centers, and regulators with assurance that a Popper deployment can reliably evaluate clinical AI decisions, enforce safety policies, and maintain auditable decision trails.

---

## Certification Tiers

### Tier 1: Popper Compatible (Free)
**Self-certification for basic protocol compliance.**

*   **Requirements:**
    *   Pass the automated `popper-conformance` test suite.
    *   Correct implementation of Hermes schemas (`SupervisionRequest`, `SupervisionResponse`).
    *   Proper handling of `trace_id` and `HealthStateSnapshotRef`.
    *   Valid Safety DSL policy pack loading and evaluation.
*   **Benefits:**
    *   Authorized use of the "Popper Compatible" badge.
    *   Listing in the official compatible implementations directory.
*   **Cost:** Free.

### Tier 2: Popper Certified (Paid)
**Regain-reviewed certification for production implementations.**

*   **Requirements:**
    *   All Tier 1 requirements.
    *   Code review of the Popper integration by a Regain, Inc. engineer.
    *   Verification of audit trail integrity and `trace_id` propagation.
    *   Policy pack structure and safety rule validation.
    *   Designated support contact.
*   **Benefits:**
    *   Official "Popper Certified" badge.
    *   Priority support channel for protocol extensions.
    *   Quarterly roadmap sync calls with the Regain team.
*   **Cost:** Paid (pricing available on request).

### Tier 3: Popper Certified Clinical (Paid)
**Full clinical audit for autonomous or semi-autonomous deployment.**

*   **Requirements:**
    *   All Tier 2 requirements.
    *   Audit of clinical policy pack validity and clinical reasoning traceability.
    *   Verification of Hard2Vary™ scoring implementation (if applicable).
    *   Full security and HIPAA-compliance review of the PHI/PII boundary.
    *   Provision of FDA Pre-market Submission documentation templates.
*   **Benefits:**
    *   "Popper Certified for Clinical Use" badge.
    *   Direct advisory support for regulatory (FDA/IMDRF) submissions.
    *   Monthly sync calls with Regain's clinical and AI research teams.
*   **Cost:** Paid (pricing available on request).

---

## The Certification Process

1.  **Preparation**: Download and run the `@regain/popper-conformance` CLI against your implementation.
2.  **Application**: Email your conformance report and project details to **team@regain.ai**.
3.  **Review**: For Tier 2 and 3, the Regain, Inc. team will schedule a technical and/or clinical review within 30 days.
4.  **Issuance**: Upon approval, you will receive a digital certificate ID and authorized badges for use in your marketing and product UI.

---

## Conformance Test Suite

The conformance suite ensures your system handles:
*   **Schema Validation**: Every message matches the Hermes Zod/JSON definitions.
*   **Protocol Behavior**: Idempotency, trace propagation, and error format compliance.
*   **Safety DSL Evaluation**: Correct policy loading, rule matching, and decision output.
*   **Clinical Scenarios**: Correct handling of `HARD_STOP`, `ROUTE_TO_CLINICIAN`, and `APPROVED` decisions.

To get started:
```bash
# Conformance tool is currently in private beta
# Contact team@regain.ai for access
```

---

## Contact

For inquiries regarding the certification program, please contact **team@regain.ai**.

---

## Related

- [Regain Hermes™](https://github.com/regain-inc/hermes) — The underlying protocol specification
- [Governance](./GOVERNANCE.md) — Project governance model

*Regain Popper™ and Hermes Certified™ are trademarks of Regain, Inc.*
