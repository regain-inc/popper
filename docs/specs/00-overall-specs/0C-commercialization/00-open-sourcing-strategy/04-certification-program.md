# Hermes Certification Program

## Overview

The Hermes Certification Program establishes trust in the ecosystem by verifying that implementations correctly follow the Hermes protocol and meet quality standards.

**Note:** This program launches 6-12 months after open-source release, when there's demand. This document is forward planning.

---

## Certification Tiers

### Tier 1: Hermes Compatible (Free)

**Self-certification for basic protocol compliance.**

| Requirement | How to Verify |
|-------------|---------------|
| Pass conformance test suite | Run `hermes-conformance` CLI |
| Use correct message schemas | Automated validation |
| Handle required error cases | Test suite coverage |

**Benefits:**
- May use "Hermes Compatible" badge
- Listed in community directory (self-submitted)

**Process:**
1. Run conformance tests: `npx hermes-conformance ./your-impl`
2. Tests pass → self-certify
3. Submit PR to add to compatible-implementations.md

**Cost:** Free

---

### Tier 2: Hermes Certified ($10-25K/year)

**Regain-reviewed certification for production implementations.**

| Requirement | How to Verify |
|-------------|---------------|
| Pass conformance test suite | Regain verifies |
| Code review of integration | Regain engineer review |
| Documentation quality | Regain review |
| Support contact designated | Required |

**Benefits:**
- Official "Hermes Certified" badge
- Listed on hermes-protocol.dev (verified)
- Priority GitHub issue support
- Quarterly sync calls with Regain
- Early access to protocol changes

**Process:**
1. Apply at hermes-protocol.dev/certify
2. Pay certification fee
3. Submit implementation for review
4. Regain reviews within 30 days
5. Pass → receive certification
6. Annual renewal required

**Pricing:**

| Organization Size | Annual Fee |
|-------------------|------------|
| Startup (<50 employees) | $10,000 |
| Mid-size (50-500) | $15,000 |
| Enterprise (500+) | $25,000 |

---

### Tier 3: Hermes Certified for Clinical Use ($50-100K/year)

**Full audit for clinical deployment.**

| Requirement | How to Verify |
|-------------|---------------|
| All Tier 2 requirements | Included |
| Clinical validation documentation | Regain clinical review |
| Security audit | Third-party or Regain |
| FDA regulatory alignment | Documentation review |
| Incident response plan | Required |

**Benefits:**
- All Tier 2 benefits
- "Hermes Certified for Clinical Use" badge
- Clinical advisory support
- FDA submission documentation templates
- Incident response coordination
- Monthly sync calls

**Process:**
1. Complete Tier 2 certification first
2. Submit clinical documentation package
3. Security audit (provide or purchase)
4. Regain clinical team review
5. Pass → receive clinical certification
6. Annual renewal + audit required

**Pricing:**

| Organization Size | Annual Fee |
|-------------------|------------|
| Startup (<50 employees) | $50,000 |
| Mid-size (50-500) | $75,000 |
| Enterprise (500+) | $100,000 |

---

## Conformance Test Suite

### What It Tests

```
hermes-conformance/
├── schema-validation/
│   ├── supervision-request.test.ts
│   ├── supervision-response.test.ts
│   ├── control-command.test.ts
│   └── audit-event.test.ts
├── protocol-behavior/
│   ├── trace-context-propagation.test.ts
│   ├── idempotency.test.ts
│   ├── error-handling.test.ts
│   └── safe-mode-transitions.test.ts
├── edge-cases/
│   ├── malformed-input.test.ts
│   ├── missing-fields.test.ts
│   └── boundary-values.test.ts
└── clinical-scenarios/
    ├── prescription-flow.test.ts
    ├── escalation-flow.test.ts
    └── hard-stop-flow.test.ts
```

### Running Tests

```bash
# Install
npm install -g @regain/hermes-conformance

# Run against your implementation
hermes-conformance --endpoint http://localhost:3000/supervise

# Run with specific test suites
hermes-conformance --endpoint http://localhost:3000/supervise \
  --suites schema-validation,protocol-behavior

# Generate report
hermes-conformance --endpoint http://localhost:3000/supervise \
  --report conformance-report.json
```

### Test Output

```
Hermes Conformance Test Suite v1.0.0

Running 127 tests...

Schema Validation
  ✓ SupervisionRequest validates correctly (23 tests)
  ✓ SupervisionResponse validates correctly (18 tests)
  ✓ ControlCommand validates correctly (12 tests)
  ✓ AuditEvent validates correctly (15 tests)

Protocol Behavior
  ✓ Trace context propagates correctly (8 tests)
  ✓ Idempotency works as specified (6 tests)
  ✓ Errors return correct format (14 tests)

Edge Cases
  ✓ Malformed input handled safely (11 tests)
  ✓ Missing fields rejected appropriately (9 tests)

Clinical Scenarios
  ✓ Prescription flow works correctly (6 tests)
  ✓ Escalation triggers appropriately (5 tests)

Results: 127 passed, 0 failed
Status: CONFORMANT

Certificate ID: HC-2026-001234
Valid until: 2027-01-15
```

---

## Certification Badges

### Badge Designs

```
[Hermes Compatible]     - Gray/silver, self-certified
[Hermes Certified]      - Blue, Regain-verified
[Hermes Clinical]       - Green, clinical-grade
```

### Badge Usage

```html
<!-- Hermes Compatible (Tier 1) -->
<img src="https://hermes-protocol.dev/badges/compatible.svg"
     alt="Hermes Compatible" />

<!-- Hermes Certified (Tier 2) -->
<img src="https://hermes-protocol.dev/badges/certified.svg"
     alt="Hermes Certified" />

<!-- Hermes Certified for Clinical Use (Tier 3) -->
<img src="https://hermes-protocol.dev/badges/clinical.svg"
     alt="Hermes Certified for Clinical Use" />
```

### Badge Verification

Each badge links to verification page:
```
https://hermes-protocol.dev/verify/HC-2026-001234
```

Shows:
- Organization name
- Certification tier
- Certification date
- Expiration date
- Scope of certification

---

## Certification Agreement (Summary)

Full legal agreement to be drafted with lawyer. Key terms:

### Grant
- Non-exclusive license to use certification marks
- Limited to certified implementation only
- Revocable for non-compliance

### Requirements
- Maintain conformance with certified version
- Report material changes to implementation
- Allow verification audits (Tier 2+)
- Display certification accurately

### Restrictions
- Cannot imply broader endorsement
- Cannot use marks after expiration
- Cannot transfer certification

### Revocation
Certification may be revoked for:
- Failing conformance tests
- Security vulnerabilities (unpatched)
- Misuse of certification marks
- Non-payment of fees

---

## Revenue Projections

### Year 1 (Soft Launch)
| Tier | Customers | Revenue |
|------|-----------|---------|
| Tier 1 | 20 | $0 |
| Tier 2 | 2 | $30,000 |
| Tier 3 | 0 | $0 |
| **Total** | | **$30,000** |

### Year 2
| Tier | Customers | Revenue |
|------|-----------|---------|
| Tier 1 | 50 | $0 |
| Tier 2 | 8 | $140,000 |
| Tier 3 | 2 | $150,000 |
| **Total** | | **$290,000** |

### Year 3
| Tier | Customers | Revenue |
|------|-----------|---------|
| Tier 1 | 100 | $0 |
| Tier 2 | 15 | $270,000 |
| Tier 3 | 5 | $400,000 |
| **Total** | | **$670,000** |

---

## Implementation Timeline

| When | Milestone |
|------|-----------|
| Launch + 3 months | Conformance test suite v1.0 |
| Launch + 6 months | Tier 1 self-certification live |
| Launch + 9 months | Tier 2 certification process ready |
| Launch + 12 months | First Tier 2 certifications issued |
| Launch + 18 months | Tier 3 clinical certification ready |

---

## Team Requirements

### For Tier 2 Certification
- 1 engineer (part-time) for reviews
- Process: ~8 hours per certification

### For Tier 3 Certification
- 1 engineer for technical review
- 1 clinical advisor for clinical review
- Process: ~40 hours per certification

### Scaling
At 20+ certifications/year, consider dedicated certification team.

---

## FAQ

**Q: Can we certify before the program launches?**
A: No, but you can run conformance tests and prepare documentation.

**Q: What if we fail certification?**
A: You receive detailed feedback. Fix issues and resubmit (no additional fee within 90 days).

**Q: Is certification required to use Hermes?**
A: No. Hermes is Apache 2.0. Certification is optional verification.

**Q: Can competitors get certified?**
A: Yes. Certification is open to all conformant implementations.

**Q: What about ARPA-H TA2 performers?**
A: TA2 performers using Hermes may apply for certification. ARPA-H affiliation doesn't affect process.
