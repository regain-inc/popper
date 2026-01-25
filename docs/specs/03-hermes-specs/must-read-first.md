# Clinician Feedback Integration — Dev Handoff Checklist

**Spec Version:** Hermes v1.6.0
**Date:** 2026-01-24
**Status:** Ready for implementation

---

## Quick Start

1. **Read these first** (in order):
   - [02-hermes-contracts.md](03-hermes-specs/02-hermes-contracts.md) §4 (Clinician Feedback)
   - [01-deutsch-system-spec.md](01-deutsch-specs/01-deutsch-system-spec.md) §6.5 (Feedback Integration)
   - [01-popper-system-spec.md](02-popper-specs/01-popper-system-spec.md) §X.X (Override Awareness)

2. **Validate your implementation against**:
   - `03-hermes-specs/schema/hermes-message.schema.json` (shape validation)
   - `03-hermes-specs/fixtures/` (reference payloads)

3. **Fill out before deployment**:
   - [TA3-SITE-INTEGRATION-PROFILE.template.md](03-hermes-specs/additional/TA3-SITE-INTEGRATION-PROFILE.template.md)

---

## Implementation Phases

### Phase 1: Gateway — ClinicianFeedbackEvent Emission

**Owner:** Gateway team
**Spec:** Hermes §4.2, §4.5

| Task | Spec Reference | Validation |
|------|----------------|------------|
| Parse TA3 clinical system events | §4.5.2 | TA3 event arrives, gateway translates |
| Emit `ClinicianFeedbackEvent` | §4.2.3 | Validate against `clinician_feedback_event.*.json` fixtures |
| Set `trace.producer.system = 'gateway'` | §4.5.2 (normative) | **MUST** — other values rejected |
| Include `rationale` (REQUIRED) | §4.2.3 | `rationale.summary` + `rationale.category` |
| Populate `response_time_seconds` | §4.2.3 | SHOULD for alert fatigue analysis |
| Sign events in `advocate_clinical` mode | §4.5.3 | SHOULD include `trace.signature` |

**Test fixtures:**
- `clinician_feedback_event.accepted.json`
- `clinician_feedback_event.rejected.json`
- `clinician_feedback_event.rejected.permanent.json`
- `clinician_feedback_event.modified.json`
- `clinician_feedback_event.deferred.json`
- `clinician_feedback_event.conflict.json`

---

### Phase 2: Deutsch — Consuming Override History

**Owner:** Deutsch team
**Spec:** Deutsch §6.5

| Task | Spec Reference | Validation |
|------|----------------|------------|
| Read `snapshot.prior_clinician_overrides` | §6.5.1 | Override history in snapshot |
| Check `unresolved_conflicts[]` | §6.5.1 | If non-empty, route to clinician |
| Apply override matching semantics | Hermes §4.3.2 | Medication class/specific, intervention kind |
| Implement override decay | §6.5.4 | 0-90d full, 91-180d declining, >180d informational |
| Handle re-evaluation triggers | §6.5.4 | Generate TRIAGE_ROUTE when trigger fires |
| Update ArgMed context | §6.5.2 | Generator/Verifier aware of overrides |
| Include disclosure bullets | §6.5.3 | "Adjusted based on prior clinician feedback" |

**Test fixtures:**
- `snapshot_with_override_history.json`
- `snapshot_with_override_history.conflicts.json`
- `snapshot_with_override_history.handoff.json`
- `snapshot_with_override_history.alert_fatigue.json`

---

### Phase 3: Deutsch — Emitting Feedback to Popper

**Owner:** Deutsch team
**Spec:** Deutsch §6.5.5, Hermes §3.4

| Task | Spec Reference | Validation |
|------|----------------|------------|
| Include `relevant_prior_overrides` in SupervisionRequest | Hermes §3.4 | When prior feedback may be relevant |
| Include `unresolved_override_conflicts` | Hermes §3.4 | When conflicts exist |
| Include `feedback_metrics` | Hermes §3.4 | Override rate, trend, response time |
| Respect size bounds | Hermes §4.3.1 | Max 50 overrides, 10 conflicts, 500 char summary |

**Test fixtures:**
- `supervision_request.with_prior_overrides.json`
- `supervision_request.with_unresolved_conflicts.json`
- `supervision_request.with_feedback_metrics.json`

---

### Phase 4: Popper — Override-Aware Evaluation

**Owner:** Popper team
**Spec:** Popper §X.X

| Task | Spec Reference | Validation |
|------|----------------|------------|
| Check `relevant_prior_overrides` | §X.X.1 | Compare against proposals |
| Route on unresolved conflicts | §X.X.2 | ROUTE_TO_CLINICIAN if conflict affects proposals |
| Detect alert fatigue patterns | §X.X.3 | Override rate >50% AND response time <30s |
| Weight by clinician role | §X.X.5 | Attending > Specialist > Primary care > NP/PA |
| Forward bias signals | §X.X.4 | Aggregate for drift monitoring |

---

### Phase 5: Popper — Bias Detection

**Owner:** Popper team
**Spec:** Hermes §4.4

| Task | Spec Reference | Validation |
|------|----------------|------------|
| Aggregate feedback by demographic dimensions | §4.4 | Age group, medication class, clinician specialty |
| Calculate bias metrics | §4.4 | Rate difference, rate ratio, statistical significance |
| Emit `BiasDetectionEvent` | §4.4 | Validate against `bias_detection_event.json` |
| Set severity thresholds | §4.4.1 | 15% warning, 25% critical |
| Require sample size >= 30 | §4.4 (normative) | Both affected and control groups |

**Test fixtures:**
- `bias_detection_event.json`

---

## Semantic Validation Gates

The JSON schema validates **shape only**. Implement these additional checks:

### ClinicianFeedbackEvent

```typescript
// §4.5.2 — Trust chain
if (event.trace.producer.system !== 'gateway') {
  log.warn('ClinicianFeedbackEvent from non-gateway producer');
  // MAY reject in advocate_clinical mode
}

// §4.2.3 — Required rationale
if (!event.rationale?.summary || !event.rationale?.category) {
  throw new ValidationError('rationale is REQUIRED');
}

// §4.2.3 — PHI check
if (containsDirectIdentifiers(event.rationale.summary)) {
  throw new ValidationError('rationale.summary MUST NOT include direct identifiers');
}
```

### SupervisionRequest with Feedback

```typescript
// Hermes §4.3.1 — Size bounds
if (request.relevant_prior_overrides?.length > 50) {
  log.warn('Exceeds 50 override limit, truncating');
  request.relevant_prior_overrides = truncateToMostRecent(50);
}

if (request.unresolved_override_conflicts?.length > 10) {
  log.error('More than 10 unresolved conflicts — systemic issue');
  // Escalate immediately
}
```

### BiasDetectionEvent

```typescript
// §4.4 — Sample size requirement
if (event.metrics.sample_size_affected < 30 ||
    event.metrics.sample_size_control < 30) {
  throw new ValidationError('Sample sizes must be >= 30 for statistical validity');
}

// §4.4 — Organization scope
if (event.subject) {
  throw new ValidationError('BiasDetectionEvent MUST NOT be patient-specific');
}
```

---

## CI Validation Requirements

Add to your CI pipeline:

```yaml
# .github/workflows/hermes-validation.yml
- name: Validate Hermes fixtures
  run: |
    npx ajv validate \
      -s docs/00-vision/00-clinical-agents/03-hermes-specs/schema/hermes-message.schema.json \
      -d "docs/00-vision/00-clinical-agents/03-hermes-specs/fixtures/*.json"

- name: Run semantic validators
  run: |
    # Implement your semantic validation tests
    npm run test:hermes-semantic
```

---

## Deployment Checklist

Before going live at a TA3 site:

- [ ] TA3 site integration profile filled out completely
- [ ] Gateway can receive TA3 clinical system events
- [ ] Gateway emits valid `ClinicianFeedbackEvent` with `producer.system = 'gateway'`
- [ ] Deutsch reads and applies `prior_clinician_overrides`
- [ ] Deutsch routes to clinician when `unresolved_conflicts` present
- [ ] Popper evaluates proposals against prior overrides
- [ ] Popper detects alert fatigue patterns (>50% rate, <30s response)
- [ ] Popper emits `BiasDetectionEvent` for demographic disparities
- [ ] All fixtures validate against schema in CI
- [ ] 6-year retention configured for feedback events
- [ ] State disclosure laws addressed (IL, TX 2026, UT HB 452) if applicable

---

## FAQ

**Q: Who emits ClinicianFeedbackEvent?**
A: The Hermes gateway, NOT Deutsch or Popper. See §4.5.2.

**Q: Is `rationale` optional?**
A: No. It's REQUIRED per malpractice documentation best practices. See §4.2.3.

**Q: How long do overrides last?**
A: Default 180 days unless `is_permanent: true` or explicit `valid_until`. See Deutsch §6.5.4.

**Q: What if clinicians disagree?**
A: `conflicts_with_prior_feedback` captures it. Deutsch MUST route to clinician. See §6.5.6.

**Q: Is this RLHF?**
A: No. RLHF is batch model training. This is real-time patient-specific case reassessment. See Deutsch §6.4.

---

## Contact

- **Hermes contracts:** See `02-hermes-contracts.md`
- **Deutsch integration:** See `01-deutsch-system-spec.md` §6.5
- **Popper integration:** See `01-popper-system-spec.md` §X.X
