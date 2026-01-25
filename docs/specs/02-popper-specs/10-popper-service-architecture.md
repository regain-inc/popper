---
version: 1.0.0
last-updated: 2026-01-25
status: draft
owner: Popper Dev Team
tags: [advocate, ta2, popper, architecture, service, open-source]
---

# Popper Service Architecture — v1

## 0) Executive Summary

This document specifies the **technical architecture** for Popper Service — the independent supervisory safety system for clinical agents. Popper is designed as an **open source project** that can supervise any clinical reasoning agent ("Brain"), not just Deutsch.

**Key design decisions:**

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **Runtime** | Bun | Fast startup, native TypeScript, excellent performance |
| **Framework** | Elysia | Type-safe, fast, consistent with ecosystem |
| **Database** | PostgreSQL | Audit events, settings, policy versions |
| **Cache** | Redis | Idempotency, safe-mode state, drift counters |
| **Object Storage** | Minio (S3-compatible) | Audit export bundles, de-identified data |
| **Transport** | HTTP/2 REST | Open source friendly, standard tooling |
| **Schema** | @regain/hermes | Shared types, validation |

## 1) Technology Stack

### 1.1 Core Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Runtime** | Bun | 1.x | JavaScript/TypeScript runtime |
| **Language** | TypeScript | 5.x | Type safety, Hermes compatibility |
| **Framework** | Elysia | 1.x | HTTP server, validation, OpenAPI |
| **Validation** | Zod (via Hermes) | 3.x | Schema validation |
| **Database ORM** | Drizzle | 0.x | Type-safe SQL, migrations |

### 1.2 Data Storage

| Store | Technology | Purpose |
|-------|------------|---------|
| **Primary DB** | PostgreSQL 16 | Audit events, settings, policy versions |
| **Cache** | Redis 7.x | Idempotency cache, safe-mode state, counters |
| **Object Storage** | Minio | Audit export bundles (S3-compatible) |

### 1.3 Observability

| Aspect | Technology | Purpose |
|--------|------------|---------|
| **Metrics** | Prometheus format | Decision latency, drift signals |
| **Logging** | Structured JSON | Audit trail, debugging |
| **Tracing** | OpenTelemetry | Distributed tracing (trace_id) |

## 2) Repository Structure

```
popper/
├── apps/
│   └── server/                     # HTTP server application
│       ├── src/
│       │   ├── routes/
│       │   │   ├── supervise.ts    # POST /v1/popper/supervise
│       │   │   ├── control.ts      # POST /v1/popper/control/*
│       │   │   ├── status.ts       # GET /v1/popper/status
│       │   │   └── health.ts       # GET /health, GET /metrics
│       │   ├── middleware/
│       │   │   ├── auth.ts         # API key / OAuth validation
│       │   │   ├── rate-limit.ts   # Per-tenant rate limiting
│       │   │   └── trace.ts        # trace_id propagation
│       │   └── index.ts            # Elysia app entry point
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── core/                       # Core decision logic (hot path)
│   │   ├── src/
│   │   │   ├── policy-engine/      # Safety DSL evaluator
│   │   │   │   ├── evaluator.ts    # Rule evaluation loop
│   │   │   │   ├── parser.ts       # YAML policy pack parser
│   │   │   │   └── conditions.ts   # Condition implementations
│   │   │   ├── decision/           # Decision builder
│   │   │   │   ├── builder.ts      # SupervisionResponse construction
│   │   │   │   └── aggregator.ts   # Multi-rule aggregation
│   │   │   ├── staleness/          # Snapshot staleness validator
│   │   │   │   ├── validator.ts    # Staleness checks
│   │   │   │   └── config.ts       # Threshold configuration
│   │   │   ├── htv/                # HTV score evaluation
│   │   │   │   ├── evaluator.ts    # HTV threshold checks
│   │   │   │   └── thresholds.ts   # Per-proposal thresholds
│   │   │   ├── conflict/           # Cross-domain conflict evaluation
│   │   │   │   └── evaluator.ts    # Conflict rule checks
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── validation/                 # Hermes validation layer
│   │   ├── src/
│   │   │   ├── schema.ts           # Hermes schema validation
│   │   │   ├── clock-skew.ts       # Request timestamp validation
│   │   │   ├── idempotency.ts      # Idempotency cache logic
│   │   │   └── multi-tenant.ts     # Organization authorization
│   │   └── package.json
│   │
│   ├── audit/                      # Audit event emission
│   │   ├── src/
│   │   │   ├── emitter.ts          # AuditEvent producer
│   │   │   ├── storage/
│   │   │   │   ├── postgres.ts     # PostgreSQL storage
│   │   │   │   └── interface.ts    # Storage interface
│   │   │   └── export/
│   │   │       ├── bundle.ts       # De-identified bundle generator
│   │   │       └── redaction.ts    # PHI redaction rules
│   │   └── package.json
│   │
│   ├── control-plane/              # Safe-mode + settings
│   │   ├── src/
│   │   │   ├── safe-mode.ts        # Safe-mode state management
│   │   │   ├── settings.ts         # Operational settings
│   │   │   └── store/
│   │   │       ├── redis.ts        # Redis state store
│   │   │       └── postgres.ts     # Persistent settings
│   │   └── package.json
│   │
│   └── drift/                      # Drift monitoring
│       ├── src/
│       │   ├── counters.ts         # Metric counters
│       │   ├── thresholds.ts       # Alert thresholds
│       │   ├── triggers.ts         # Auto safe-mode triggers
│       │   └── baseline.ts         # Baseline calculation
│       └── package.json
│
├── config/
│   ├── policies/                   # YAML policy packs
│   │   ├── default.yaml            # Default policy pack
│   │   └── advocate-clinical.yaml  # Clinical mode policies
│   └── popper-config.yaml          # Service configuration
│
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml          # Local development
│
├── docs/
│   ├── README.md
│   ├── api.md                      # API documentation
│   └── self-hosting.md             # Self-hosting guide
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/                   # Hermes test fixtures
│
├── package.json                    # Workspace root
├── turbo.json                      # Turborepo config
├── bunfig.toml
└── LICENSE                         # Apache 2.0 (open source)
```

## 3) Data Storage Schema

### 3.1 PostgreSQL Tables

```sql
-- Audit events (append-only)
CREATE TABLE audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trace_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    organization_id TEXT,
    subject_id TEXT,
    payload JSONB NOT NULL,
    tags JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Indexes for query patterns
    INDEX idx_audit_trace_id (trace_id),
    INDEX idx_audit_org_created (organization_id, created_at DESC),
    INDEX idx_audit_event_type (event_type, created_at DESC)
);

-- Operational settings (versioned)
CREATE TABLE operational_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT,                    -- NULL = global default
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    effective_at TIMESTAMPTZ NOT NULL,
    created_by TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (organization_id, key, effective_at)
);

-- Safe-mode history (for audit trail)
CREATE TABLE safe_mode_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT,                    -- NULL = global
    enabled BOOLEAN NOT NULL,
    reason TEXT NOT NULL,
    effective_at TIMESTAMPTZ NOT NULL,
    effective_until TIMESTAMPTZ,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Policy pack versions (for reproducibility)
CREATE TABLE policy_pack_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pack_name TEXT NOT NULL,
    version TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    content JSONB NOT NULL,
    activated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (pack_name, version)
);

-- Drift baselines (per organization)
CREATE TABLE drift_baselines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT,                    -- NULL = global
    signal_name TEXT NOT NULL,
    baseline_value NUMERIC NOT NULL,
    calculated_at TIMESTAMPTZ NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    sample_count INTEGER NOT NULL,

    UNIQUE (organization_id, signal_name, calculated_at)
);
```

### 3.2 Redis Keys

```yaml
# Idempotency cache
idempotency:{org_id}:{idempotency_key}:
  type: hash
  fields:
    request_hash: "sha256..."
    response: "{...json...}"
    created_at: "2026-01-25T10:00:00Z"
  ttl: 300  # 5 minutes

# Safe-mode state (fast reads)
safe_mode:{org_id}:
  type: hash
  fields:
    enabled: "true" | "false"
    effective_at: "2026-01-25T10:00:00Z"
    effective_until: "2026-01-25T18:00:00Z"
    reason: "Drift detected"

# Drift counters (sliding window)
drift:{org_id}:{signal}:{window}:
  type: string (counter)
  ttl: 3600  # 1 hour

# Rate limiting
rate_limit:{org_id}:{endpoint}:{minute}:
  type: string (counter)
  ttl: 60
```

### 3.3 Minio Buckets

```yaml
buckets:
  popper-audit-exports:
    purpose: De-identified regulatory export bundles
    retention: 7 years (configurable)
    structure: /{org_id}/{year}/{month}/{export_id}.json.gz

  popper-incident-bundles:
    purpose: Incident investigation packages
    retention: 7 years
    structure: /{org_id}/incidents/{incident_id}/bundle.json.gz
```

## 4) Core Processing Pipeline

### 4.1 Request Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SupervisionRequest                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. INGRESS (apps/server)                                                    │
│  ├── Auth middleware → Validate API key / OAuth token                       │
│  ├── Rate limit check → Per-tenant quotas                                   │
│  ├── trace_id extraction / generation                                       │
│  └── Request logging (PHI-safe)                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  2. VALIDATION (packages/validation)                                         │
│  ├── Hermes schema validation (@regain/hermes)                              │
│  ├── Clock-skew check (±5 min for advocate_clinical)                        │
│  ├── Idempotency check (Redis lookup)                                       │
│  │   ├── Cache hit + same payload → Return cached response                  │
│  │   └── Cache hit + diff payload → HARD_STOP (replay suspected)            │
│  └── Multi-tenant auth (org_id authorization)                               │
│                                                                              │
│  On validation failure → Return HARD_STOP with reason_codes                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  3. DETERMINISTIC POLICY ENGINE (packages/core) — Target: <20ms             │
│                                                                              │
│  3.1 State snapshot                                                          │
│  ├── Fetch safe-mode state from Redis                                       │
│  └── Snapshot at request start (consistent evaluation)                      │
│                                                                              │
│  3.2 Staleness validation (AUTHORITATIVE)                                   │
│  ├── Check snapshot.created_at against thresholds                           │
│  ├── wellness: 24h, advocate_clinical: 4h (configurable)                    │
│  └── If stale → REQUEST_MORE_INFO or ROUTE_TO_CLINICIAN                     │
│                                                                              │
│  3.3 Safety DSL evaluation                                                  │
│  ├── Load policy pack (YAML → parsed rules)                                 │
│  ├── Evaluate conditions in priority order                                  │
│  │   ├── schema_invalid                                                     │
│  │   ├── safe_mode_enabled                                                  │
│  │   ├── missing_governance_ref                                             │
│  │   ├── high_uncertainty                                                   │
│  │   ├── htv_score_below (threshold checks)                                 │
│  │   ├── missing_evidence                                                   │
│  │   └── ... (other policy rules)                                           │
│  └── First matching rule determines base decision                           │
│                                                                              │
│  3.4 Cross-domain conflict evaluation (if conflicts present)                │
│  ├── Check resolution confidence                                            │
│  ├── Check evidence presence                                                │
│  └── Override decision if needed                                            │
│                                                                              │
│  3.5 Per-proposal decisions (if mixed risk levels)                          │
│  └── Build per_proposal_decisions[] array                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  4. DECISION ASSEMBLY (packages/core/decision)                               │
│  ├── Aggregate rule results                                                  │
│  ├── Apply conservatism principle (most strict wins)                        │
│  ├── Build SupervisionResponse                                              │
│  │   ├── decision: APPROVED | HARD_STOP | ROUTE_TO_CLINICIAN | ...          │
│  │   ├── reason_codes: string[]                                             │
│  │   ├── explanation: string                                                │
│  │   ├── required_action?: RequiredAction                                   │
│  │   └── per_proposal_decisions?: PerProposalDecision[]                     │
│  └── Include audit_redaction for exports                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│  5. AUDIT EMISSION   │ │  6. DRIFT TRACKING   │ │  7. RESPONSE         │
│  (packages/audit)    │ │  (packages/drift)    │ │                      │
│                      │ │                      │ │  Return to Deutsch   │
│  Emit AuditEvent:    │ │  Increment counters: │ │  (SupervisionResp)   │
│  - trace_id          │ │  - hard_stop_count   │ │                      │
│  - event_type        │ │  - route_count       │ │  Cache response in   │
│  - decision          │ │  - validation_fails  │ │  idempotency store   │
│  - reason_codes      │ │                      │ │                      │
│  - policy_version    │ │  Check thresholds:   │ │                      │
│  - safe_mode_state   │ │  - Trigger alerts    │ │                      │
│                      │ │  - Auto safe-mode    │ │                      │
│  Store → PostgreSQL  │ │                      │ │                      │
└──────────────────────┘ └──────────────────────┘ └──────────────────────┘
```

### 4.2 Latency Budget

| Stage | Target | Notes |
|-------|--------|-------|
| Ingress + Auth | <5ms | In-memory API key validation |
| Validation | <5ms | Schema validation, Redis lookup |
| Policy Engine | <20ms | Deterministic rules, no I/O |
| Decision Assembly | <2ms | In-memory aggregation |
| Audit Emission | <3ms | Async write (non-blocking) |
| **Total** | **<35ms** | Well under 100ms requirement |

## 5) Transport: Deutsch ↔ Popper

### 5.1 Protocol Choice: HTTP/2 REST

**Decision**: HTTP/2 REST with persistent connections.

**Rationale:**

| Factor | HTTP/2 REST | gRPC | Decision Driver |
|--------|-------------|------|-----------------|
| **Open source friendly** | ✅ Any HTTP client | ⚠️ Requires codegen | Open source priority |
| **Tooling** | curl, Postman, browsers | Specialized tools | Developer experience |
| **Hermes compatibility** | ✅ Native JSON | Needs transcoding | Natural fit |
| **Latency** | 2-8ms overhead | 1-5ms overhead | Acceptable |
| **Debugging** | Easy (JSON logs) | Binary (harder) | Observability |

### 5.2 Connection Configuration

```yaml
# Deutsch client configuration for Popper
popper_client:
  base_url: "http://popper.internal:3000"  # Internal service URL

  connection_pool:
    max_connections: 100
    keep_alive: true
    keep_alive_timeout_ms: 30000

  timeouts:
    connect_ms: 1000
    request_ms: 100          # Strict timeout for fusion protocol

  retry:
    max_attempts: 2          # Limited retries (fail-safe to ROUTE)
    backoff_ms: 10

  circuit_breaker:
    failure_threshold: 5
    reset_timeout_ms: 30000
    half_open_requests: 1
```

### 5.3 Internal vs External Access

| Deployment | Deutsch → Popper | Third-party Brain → Popper |
|------------|------------------|---------------------------|
| **Regain SaaS** | Internal (same cluster) | Via public API with auth |
| **Self-hosted** | Same network | N/A (single Brain) |
| **B2B Platform** | N/A | Public API with tenant auth |

```yaml
# Popper network exposure
endpoints:
  internal:
    # For Deutsch (same cluster)
    url: "http://popper.internal:3000"
    auth: service-to-service mTLS (optional)

  external:
    # For third-party Brains (B2B)
    url: "https://api.popper.health/v1"
    auth: API key / OAuth 2.0
    rate_limits: per-tenant
```

## 6) Configuration

### 6.1 Service Configuration (popper-config.yaml)

```yaml
# popper-config.yaml
version: "1.0"

server:
  port: 3000
  host: "0.0.0.0"

# Staleness thresholds (Popper is AUTHORITATIVE)
staleness:
  thresholds:
    wellness_hours: 24
    clinical_hours: 4
  behavior:
    low_risk_stale: "REQUEST_MORE_INFO"
    high_risk_stale: "ROUTE_TO_CLINICIAN"

# Clock skew validation
clock_skew:
  tolerance_minutes: 5
  enforce_in_clinical: true

# Idempotency cache
idempotency:
  enabled: true
  ttl_seconds: 300
  storage: redis

# Safe-mode defaults
safe_mode:
  default_duration_hours: 4
  auto_triggers:
    validation_failure_spike: 5x
    hard_stop_spike: 5x

# Drift monitoring
drift:
  baseline_window_days: 7
  warning_multiplier: 2
  critical_multiplier: 5
  signals:
    - validation_failure_rate
    - hard_stop_rate
    - route_to_clinician_rate
    - decision_latency_p95

# Policy packs
policies:
  default_pack: "default"
  clinical_pack: "advocate-clinical"
  pack_directory: "./config/policies"

# Audit
audit:
  storage: postgres
  export_bucket: "popper-audit-exports"
  retention_days: 2555  # 7 years

# Database connections
database:
  postgres:
    connection_string: "${POSTGRES_URL}"
    pool_size: 20
  redis:
    url: "${REDIS_URL}"

# Object storage
storage:
  minio:
    endpoint: "${MINIO_ENDPOINT}"
    access_key: "${MINIO_ACCESS_KEY}"
    secret_key: "${MINIO_SECRET_KEY}"
    bucket: "popper-audit-exports"
```

### 6.2 Policy Pack Format (default.yaml)

```yaml
# config/policies/default.yaml
version: "1.0"
name: "default"
description: "Default policy pack for wellness mode"

# Staleness configuration (can override global)
staleness:
  thresholds:
    wellness_hours: 24

# Policy rules (evaluated in priority order)
rules:
  - id: "schema_invalid"
    priority: 1000
    condition:
      kind: "schema_validation_failed"
    action: "HARD_STOP"
    reason_codes: ["schema_invalid"]

  - id: "snapshot_missing"
    priority: 900
    condition:
      kind: "snapshot_missing"
    action: "REQUEST_MORE_INFO"
    reason_codes: ["snapshot_missing"]

  - id: "snapshot_stale_clinical"
    priority: 850
    condition:
      kind: "and"
      conditions:
        - kind: "mode_equals"
          mode: "advocate_clinical"
        - kind: "snapshot_stale"
    action: "ROUTE_TO_CLINICIAN"
    reason_codes: ["snapshot_stale"]

  - id: "safe_mode_medication"
    priority: 800
    condition:
      kind: "and"
      conditions:
        - kind: "safe_mode_enabled"
        - kind: "proposal_kind_equals"
          proposal_kind: "MEDICATION_ORDER_PROPOSAL"
    action: "ROUTE_TO_CLINICIAN"
    reason_codes: ["policy_violation", "risk_too_high"]

  - id: "missing_governance_ref"
    priority: 700
    condition:
      kind: "and"
      conditions:
        - kind: "proposal_kind_equals"
          proposal_kind: "MEDICATION_ORDER_PROPOSAL"
        - kind: "missing_clinician_protocol_ref"
    action: "ROUTE_TO_CLINICIAN"
    reason_codes: ["policy_violation"]

  - id: "high_uncertainty"
    priority: 600
    condition:
      kind: "uncertainty_level_equals"
      level: "high"
    action: "ROUTE_TO_CLINICIAN"
    reason_codes: ["high_uncertainty"]

  - id: "htv_below_medication"
    priority: 500
    condition:
      kind: "and"
      conditions:
        - kind: "proposal_kind_equals"
          proposal_kind: "MEDICATION_ORDER_PROPOSAL"
        - kind: "htv_score_below"
          threshold: 0.5
    action: "ROUTE_TO_CLINICIAN"
    reason_codes: ["high_uncertainty"]

  - id: "default_approve"
    priority: 0
    condition:
      kind: "always"
    action: "APPROVED"
    reason_codes: []
```

## 7) Local Development

### 7.1 Docker Compose

```yaml
# docker/docker-compose.yml
version: "3.8"

services:
  popper:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - POSTGRES_URL=postgres://popper:popper@postgres:5432/popper
      - REDIS_URL=redis://redis:6379
      - MINIO_ENDPOINT=minio:9000
      - MINIO_ACCESS_KEY=minioadmin
      - MINIO_SECRET_KEY=minioadmin
    depends_on:
      - postgres
      - redis
      - minio

  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: popper
      POSTGRES_PASSWORD: popper
      POSTGRES_DB: popper
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio_data:/data

volumes:
  postgres_data:
  minio_data:
```

### 7.2 Development Commands

```bash
# Install dependencies
bun install

# Run all services (local)
docker compose -f docker/docker-compose.yml up -d

# Run Popper in dev mode
bun run dev

# Run tests
bun test                    # All tests
bun test:unit              # Unit tests only
bun test:integration       # Integration tests

# Database migrations
bun run db:generate        # Generate migrations
bun run db:migrate         # Apply migrations
bun run db:studio          # Drizzle Studio

# Lint & typecheck
bun run lint
bun run typecheck

# Build for production
bun run build
```

## 8) API Quick Reference

See [02-popper-contracts-and-interfaces.md](./02-popper-contracts-and-interfaces.md) for full API specification.

### 8.1 Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/popper/supervise` | Evaluate SupervisionRequest |
| `POST` | `/v1/popper/control/safe-mode` | Set safe-mode state |
| `POST` | `/v1/popper/control/settings` | Update operational setting |
| `GET` | `/v1/popper/status` | Get service status |
| `GET` | `/health` | Health check |
| `GET` | `/metrics` | Prometheus metrics |

### 8.2 Example Request

```bash
curl -X POST http://localhost:3000/v1/popper/supervise \
  -H "Content-Type: application/json" \
  -H "X-API-Key: pk_test_..." \
  -d '{
    "trace": {
      "trace_id": "tr_abc123",
      "span_id": "sp_def456"
    },
    "mode": "wellness",
    "subject": {
      "subject_id": "patient_anon_123"
    },
    "proposals": [{
      "proposal_id": "prop_001",
      "kind": "OTHER",
      "description": "Recommend increased water intake"
    }],
    "snapshot": {
      "snapshot_id": "snap_789",
      "created_at": "2026-01-25T10:00:00Z"
    }
  }'
```

## References

- [00-popper-specs-context.md](./00-popper-specs-context.md) — Popper overview and scope
- [01-popper-system-spec.md](./01-popper-system-spec.md) — System behavior specification
- [02-popper-contracts-and-interfaces.md](./02-popper-contracts-and-interfaces.md) — API contracts
- [03-popper-safety-dsl.md](./03-popper-safety-dsl.md) — Safety DSL specification
- [../03-hermes-specs/02-hermes-contracts.md](../03-hermes-specs/02-hermes-contracts.md) — Hermes types
