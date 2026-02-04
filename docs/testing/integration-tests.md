# Popper Integration Testing Guide

This guide explains how to run and develop integration tests for the Popper supervision service.

## Test Architecture

Popper uses a three-layer testing pyramid:

### Layer 1: Unit Tests (Fast, In-Memory)
- Located: `packages/core/src/__tests__/`
- Validates core logic, policy evaluation, DSL parsing
- No external dependencies
- Always runs in CI

### Layer 2: Contract Tests (Fast, Fixtures)
- Located: `packages/core/src/__tests__/hermes-contract.test.ts`
- Uses `@regain/hermes/fixtures` to validate schema conformance
- Tests all Hermes message types (requests, responses, audit events)
- Always runs in CI

### Layer 3: Integration Tests (Slow, Real Services)
- Located: `apps/server/src/__tests__/`
- Full end-to-end tests with real database and HTTP server
- Gated behind `ENABLE_INTEGRATION_TESTS=true`
- Optional in CI (runs on PR/main)

## Running Tests

### Run All Tests (Fast)
```bash
bun test
```

This runs unit and contract tests (Layers 1 & 2). No environment setup required.

### Run Integration Tests (Slow, Requires Setup)
```bash
# Set environment variables
export ENABLE_INTEGRATION_TESTS=true
export DATABASE_URL="postgresql://user:pass@localhost:5432/popper_test"
export POPPER_API_KEY="your-test-api-key"

# Run integration tests
bun test --filter="integration"
```

**Note**: Integration tests are skipped by default. Set `ENABLE_INTEGRATION_TESTS=true` to enable them.

## Environment Setup for Integration Tests

### PostgreSQL + TimescaleDB

Integration tests require a PostgreSQL database with TimescaleDB extension:

```bash
# macOS (Homebrew)
brew install timescaledb

# Initialize database
createdb popper_test
psql popper_test -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"

# Run migrations
DATABASE_URL="postgresql://user:pass@localhost:5432/popper_test" bun run db:migrate
```

### API Keys

Integration tests require an API key with appropriate scopes:

```bash
# Create an organization
bun run create-org --id org_integration_test --name "Integration Test Org"

# Create an API key with all scopes
bun run create-api-key \
  --org org_integration_test \
  --scopes supervision:write,control:read,control:write \
  --description "Integration test key"

# Export for tests
export POPPER_API_KEY="popper_key_..."
```

## Test Server Harness

The test harness provides a lightweight Popper server for integration tests:

```typescript
import { startPopperTestServer } from '@/apps/server/src/__tests__/test-utils/server-harness';

// Start test server
const { url, port, stop } = await startPopperTestServer({
  databaseUrl: process.env.DATABASE_URL!,
  port: 0, // Random port
});

// Run tests against url
const response = await fetch(`${url}/v1/popper/supervise`, { ... });

// Stop server
await stop();
```

### Test Server Features
- **In-memory caches**: No Redis required (idempotency, rate limiting, baselines)
- **PostgreSQL storage**: Audit events, incidents, settings
- **Policy loading**: Loads from `config/policies/`
- **Random port**: Avoids conflicts with dev server

## Test Fixtures

### Hermes Fixtures

Located at `docs/specs/03-hermes-specs/fixtures/`:

- `supervision_request.valid.json` - Minimal valid request
- `supervision_request.deutsch_wellness.json` - Deutsch wellness mode
- `supervision_request.deutsch_clinical.json` - Deutsch clinical mode
- `supervision_request.deutsch_multi_proposal.json` - Multiple proposals
- `supervision_request.deutsch_safe_mode_trigger.json` - Safe-mode test case

### Using Fixtures in Tests

```typescript
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const fixturePath = resolve(__dirname, '../../../docs/specs/03-hermes-specs/fixtures/supervision_request.deutsch_wellness.json');
const fixture = JSON.parse(await readFile(fixturePath, 'utf-8'));

const response = await client.requestSupervision(fixture, 'test-trace-id');
```

## Writing Integration Tests

### Test File Naming

- Unit tests: `*.test.ts`
- Integration tests: `*.integration.test.ts`

### Gating Integration Tests

Always gate integration tests behind environment variable:

```typescript
describe.skipIf(!process.env.ENABLE_INTEGRATION_TESTS)(
  'My Integration Tests',
  () => {
    test('my test', async () => {
      // Test implementation
    });
  }
);
```

### Test Organization

```typescript
import { describe, test, beforeAll, afterAll, expect } from 'bun:test';

describe.skipIf(!process.env.ENABLE_INTEGRATION_TESTS)(
  'Feature Integration Tests',
  () => {
    let server: PopperTestServer;
    let client: PopperClient;

    beforeAll(async () => {
      server = await startPopperTestServer({ ... });
      client = new PopperClient({ baseUrl: server.url, ... });
    });

    afterAll(async () => {
      await server.stop();
    });

    test('scenario 1', async () => { ... });
    test('scenario 2', async () => { ... });
  }
);
```

## Troubleshooting

### Tests Timeout

Integration tests have a default timeout of 5 seconds. For slow operations:

```typescript
test('slow operation', async () => {
  // Test implementation
}, 30000); // 30 second timeout
```

### Database Connection Failed

Ensure PostgreSQL is running and DATABASE_URL is correct:

```bash
psql $DATABASE_URL -c "SELECT 1;"
```

### Rate Limit Tests Failing

Rate limit tests may be sensitive to timing. Increase delays if flaky:

```typescript
await new Promise(resolve => setTimeout(resolve, 1000)); // Increase delay
```

### Policy Packs Not Loading

Verify policy packs exist in `config/policies/`:

```bash
ls -la config/policies/
```

## CI/CD Integration

### GitHub Actions Workflow

Integration tests run in CI on PR and main branch:

```yaml
integration-tests:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: timescale/timescaledb:latest-pg16
      env:
        POSTGRES_PASSWORD: postgres
        POSTGRES_DB: popper_test
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
  steps:
    - uses: actions/checkout@v4
    - uses: oven-sh/setup-bun@v1
    - run: bun install
    - run: bun run db:migrate
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/popper_test
    - run: bun test --filter="integration"
      env:
        ENABLE_INTEGRATION_TESTS: true
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/popper_test
        POPPER_API_KEY: ${{ secrets.POPPER_TEST_API_KEY }}
```

### Test Coverage

Integration tests are tracked separately in CI:

```bash
# Generate coverage report
bun test --coverage

# View coverage by test type
bun test --coverage --filter="integration"
```

## Best Practices

1. **Fast by Default**: Unit and contract tests should run in < 10 seconds total
2. **Gate Slow Tests**: Always gate integration tests behind `ENABLE_INTEGRATION_TESTS`
3. **Cleanup**: Always stop servers and clean up resources in `afterAll`
4. **Idempotent**: Tests should not depend on execution order
5. **Test Data**: Use unique IDs per test to avoid conflicts
6. **Fixtures Over Mocks**: Prefer real Hermes fixtures for contract tests
7. **Clear Assertions**: Use descriptive error messages in assertions

## Related Documentation

- [Test Architecture README](../packages/core/src/__tests__/README.md)
- [Deutsch-Popper Integration Guide](../../deutsch/docs/testing/popper-integration.md)
- [Hermes Specifications](../docs/specs/03-hermes-specs/)
