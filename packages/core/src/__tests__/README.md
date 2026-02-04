# Test Architecture

This directory contains the test suite for Popper's core supervision logic, policy evaluation, and Hermes protocol conformance.

## Directory Structure

```
packages/core/src/__tests__/
├── README.md                          # This file
├── hermes-contract.test.ts            # Hermes schema validation tests
└── request-validation.test.ts         # Edge case validation tests
```

## Test Pyramid

Popper uses a three-layer testing pyramid:

```
        /\
       /  \      Layer 3: Integration Tests (Slow, E2E)
      /    \     - Real services, network I/O
     /------\    - Gated: ENABLE_INTEGRATION_TESTS=true
    /        \   - Located: apps/server/src/__tests__/
   /----------\
  /            \ Layer 2: Contract Tests (Fast, Fixtures)
 /    Layer 2   \ - Hermes schema validation
/________________\ - Uses @regain/hermes/fixtures
                   - Located: packages/core/src/__tests__/

        \|/        Layer 1: Unit Tests (Fast, In-Memory)
         |         - Pure functions, no I/O
         |         - Always runs in CI
                   - Located throughout codebase
```

## Contract Tests (Layer 2)

Contract tests validate that Popper correctly implements the Hermes protocol specification.

### Hermes Contract Tests

**File**: `hermes-contract.test.ts`

Validates all Hermes message fixtures against the schema:

- **Message Fixtures**: Top-level Hermes messages (requests, responses, audit events)
- **Fragment Fixtures**: Sub-message components (snapshots, findings, conflicts)
- **Deutsch Patterns**: Deutsch-specific request patterns and conventions

```typescript
// Example: Validate a fixture
const fixture = JSON.parse(await readFile('supervision_request.valid.json'));
const result = validateHermesMessage(fixture);
expect(result.valid).toBe(true);
```

**Coverage**:
- ✅ All supervision_request variants
- ✅ All supervision_response variants
- ✅ All audit_event types
- ✅ Clinician feedback events
- ✅ Bias detection events
- ✅ Deutsch-specific patterns (wellness, clinical, multi-proposal, safe-mode)

### Request Validation Tests

**File**: `request-validation.test.ts`

Tests edge cases and validation scenarios:

- **Basic Structure**: Required fields, message types, versions
- **Mode Field**: Valid modes (wellness, advocate_clinical)
- **Timestamps**: ISO8601 format validation
- **Trace Context**: Trace IDs, producer systems, versions
- **Idempotency Keys**: ULID format, uniqueness
- **Snapshot Sources**: Valid source enums (ehr, wearable, patient_reported, imaging, other)
- **Proposals**: Single, multiple, per-proposal validation
- **Audit Redaction**: Required fields, summaries
- **Deutsch Patterns**: Service versions, request conventions

```typescript
// Example: Test invalid mode
const request = createValidRequest();
request.mode = 'invalid_mode'; // Invalid
const result = validateHermesMessage(request);
expect(result.valid).toBe(false);
```

**Coverage**: 40+ test cases covering common errors and edge cases

## Hermes Fixtures

### Message Fixtures (Top-Level)

Located at `docs/specs/03-hermes-specs/fixtures/`:

#### Supervision Requests
- `supervision_request.valid.json` - Minimal valid request
- `supervision_request.valid.inline_snapshot.json` - Inline snapshot payload
- `supervision_request.with_conflicts.json` - Cross-domain conflicts
- `supervision_request.with_prior_overrides.json` - Override history
- `supervision_request.with_unresolved_conflicts.json` - Unresolved conflicts
- `supervision_request.with_feedback_metrics.json` - Clinician feedback metrics
- `supervision_request.multi_domain.json` - Multiple clinical domains
- `supervision_request.deutsch_wellness.json` - Deutsch wellness mode
- `supervision_request.deutsch_clinical.json` - Deutsch clinical mode
- `supervision_request.deutsch_multi_proposal.json` - Multiple proposals
- `supervision_request.deutsch_safe_mode_trigger.json` - Safe-mode test case

#### Supervision Responses
- `supervision_response.valid.json` - Standard approved response
- `supervision_response.partial_approval.json` - Mixed per-proposal decisions

#### Audit Events
- `audit_event.valid.json` - Standard audit event
- `clinician_feedback_event.accepted.json` - Clinician accepted proposal
- `clinician_feedback_event.rejected.json` - Temporary rejection
- `clinician_feedback_event.rejected.permanent.json` - Permanent rejection
- `clinician_feedback_event.modified.json` - Modified proposal
- `clinician_feedback_event.deferred.json` - Deferred decision
- `clinician_feedback_event.conflict.json` - Conflict detected
- `bias_detection_event.json` - Bias detection alert

### Fragment Fixtures (Sub-Components)

These are NOT standalone Hermes messages, but components used within messages:

- `snapshot.with_imaging.json` - Snapshot with imaging references
- `snapshot_with_override_history.json` - Override history example
- `snapshot_with_override_history.conflicts.json` - Override conflicts
- `snapshot_with_override_history.handoff.json` - Clinician handoff
- `snapshot_with_override_history.alert_fatigue.json` - Alert fatigue tracking
- `derived_finding.nodule_classification.json` - Imaging-derived finding
- `derived_finding.lvef.json` - Cardiac function finding
- `imaging_study_ref.cardiac_mri.json` - Imaging study reference
- `control_command.valid.json` - Control command example
- `cross_domain_conflict.valid.json` - Cross-domain conflict example

## Adding New Fixtures

When adding new Hermes fixtures:

1. **Create fixture file** in `docs/specs/03-hermes-specs/fixtures/`
2. **Add to fixture list** in `hermes-contract.test.ts`:
   ```typescript
   const HERMES_MESSAGE_FIXTURES = [
     // ... existing fixtures
     'your_new_fixture.json',
   ];
   ```
3. **Run tests** to validate:
   ```bash
   bun test packages/core/src/__tests__/hermes-contract.test.ts
   ```
4. **Add test case** if fixture demonstrates new pattern

## Running Tests

```bash
# Run all contract tests
bun test packages/core/src/__tests__/

# Run specific test file
bun test packages/core/src/__tests__/hermes-contract.test.ts

# Run with coverage
bun test --coverage packages/core/src/__tests__/

# Watch mode
bun test --watch packages/core/src/__tests__/
```

## Test Results

All contract tests should complete in < 5 seconds:

```
packages/core/src/__tests__/hermes-contract.test.ts:
 ✓ Hermes Contract Tests
   ✓ Message fixtures pass schema validation (17 tests)
   ✓ Fragment fixtures are valid JSON (9 tests)
   ✓ All fixture files are accounted for (1 test)
   ✓ Supervision request fixtures have required structure (11 tests)
   ✓ Supervision response fixtures have required structure (2 tests)
   ✓ Deutsch Request Patterns (8 tests)

packages/core/src/__tests__/request-validation.test.ts:
 ✓ Request Validation - Basic Structure (4 tests)
 ✓ Request Validation - Mode Field (4 tests)
 ✓ Request Validation - Timestamps (5 tests)
 ✓ Request Validation - Trace Context (6 tests)
 ✓ Request Validation - Idempotency Key (5 tests)
 ✓ Request Validation - Snapshot Sources (4 tests)
 ✓ Request Validation - Proposals (5 tests)
 ✓ Request Validation - Audit Redaction (4 tests)
 ✓ Request Validation - Deutsch Patterns (3 tests)

Total: 93 tests, 0 failures, 216 assertions
Time: ~5 seconds
```

## CI/CD Integration

Contract tests run on every commit:

```yaml
# .github/workflows/test.yml
unit-and-contract-tests:
  runs-on: ubuntu-latest
  steps:
    - uses: oven-sh/setup-bun@v1
    - run: bun install
    - run: bun test packages/core/src/__tests__/
```

**No environment variables required** - these tests are pure and deterministic.

## Best Practices

1. **Fast Tests**: Contract tests should complete in < 10 seconds total
2. **No I/O**: Never make network calls or read from disk (except fixtures)
3. **Deterministic**: Tests should always produce the same result
4. **Self-Contained**: Each test should be independent
5. **Clear Errors**: Use descriptive test names and assertions
6. **Fixture Reuse**: Prefer existing fixtures over creating new ones
7. **Schema First**: Always validate against Hermes schema using `validateHermesMessage()`

## Troubleshooting

### Test Fails: "Fixture not found"

Ensure fixture path is relative to monorepo root:

```typescript
const FIXTURES_DIR = resolve(import.meta.dir, '../../../../docs/specs/03-hermes-specs/fixtures');
```

### Test Fails: "Validation errors"

Check the validation errors output:

```typescript
if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
```

Common issues:
- Invalid enum value (e.g., wrong mode, invalid source)
- Missing required field
- Wrong data type
- Invalid timestamp format

### Test Passes Locally, Fails in CI

Check for:
- File path differences (case sensitivity)
- Timezone issues in timestamps
- Floating point precision
- Async timing

## Related Documentation

- [Integration Testing Guide](../../../docs/testing/integration-tests.md)
- [Hermes Specifications](../../../docs/specs/03-hermes-specs/)
- [Deutsch-Popper Integration](../../../../deutsch/docs/testing/popper-integration.md)
