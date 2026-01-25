# Popper PRD — Независимая Система Безопасности для Клинических Агентов

**Версия**: 1.0.0
**Дата**: 2026-01-25
**Статус**: Draft

---

## 1. Обзор Проекта

### 1.1 Что такое Popper?

**Popper (TA2)** — это независимый супервизорный агент безопасности ("Щит" / "Рефери"), который:

- Отслеживает действия, которые хочет выполнить Deutsch (TA1 — клинический агент)
- Оценивает риск, неопределённость и соответствие политикам
- Принимает решения: **APPROVED**, **HARD_STOP**, **ROUTE_TO_CLINICIAN**, **REQUEST_MORE_INFO**
- Может принудительно включить "safe mode" при возникновении проблем
- Создаёт аудиторские артефакты для регуляторов

### 1.2 Философия

Popper реализует **аспект демаркации** попперианской эпистемологии — определение того, что безопасно vs. небезопасно для пациента.

**Ключевые принципы:**

| Принцип | Реализация в Popper |
|---------|---------------------|
| **Fallibilism** | По умолчанию — безопасность при неопределённости |
| **Error Correction** | Оценка точности + обнаружение галлюцинаций |
| **Hard-to-Vary** | Оценка HTV score + пороги Evidence Grade |
| **Demarcation** | Safety DSL определяет границы |

### 1.3 Ключевые характеристики

- **Независимость**: Отдельный репозиторий, отдельный деплой, не доверяет Deutsch
- **Disease-agnostic**: Никакой hardcoded логики по заболеваниям
- **Open Source**: Может супервизировать любого клинического агента ("Brain"), не только Deutsch
- **Default-to-safe**: При неопределённости всегда route или hard stop

---

## 2. Архитектура

### 2.1 Место в системе

```
┌──────────────────────────────────────────────────────────────┐
│                  UNIVERSAL LAYER (SaaS Platform)              │
│                                                               │
│   Hermes ← (Shared Contract/Schema)                          │
│      ↑                                                        │
│   Deutsch (TA1, Brain) ──SupervisionRequest──► Popper (TA2)  │
│      ↑                          │                             │
│      │                          ▼                             │
│      └──────────── SupervisionResponse ──────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Core Pipeline

```
SupervisionRequest
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  1. INGRESS (HTTP)                                           │
│     ├── Auth middleware                                      │
│     ├── Rate limiting                                        │
│     └── trace_id propagation                                 │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  2. VALIDATION                                               │
│     ├── Hermes schema validation                             │
│     ├── Clock-skew check (±5 min for advocate_clinical)     │
│     ├── Idempotency check (Redis)                           │
│     └── Multi-tenant authorization                           │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  3. DETERMINISTIC POLICY ENGINE (<20ms)                      │
│     ├── Safe-mode state snapshot                             │
│     ├── Staleness validation (AUTHORITATIVE)                │
│     │   ├── wellness: 24h threshold                         │
│     │   └── advocate_clinical: 4h threshold                 │
│     ├── Safety DSL evaluation                                │
│     │   ├── schema_invalid                                   │
│     │   ├── safe_mode_enabled                               │
│     │   ├── missing_governance_ref                          │
│     │   ├── high_uncertainty                                │
│     │   ├── htv_score_below                                  │
│     │   └── missing_evidence                                 │
│     └── Cross-domain conflict evaluation                     │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  4. DECISION ASSEMBLY                                        │
│     ├── Aggregate rule results                               │
│     ├── Apply conservatism (most strict wins)               │
│     └── Build SupervisionResponse                            │
└─────────────────────────────────────────────────────────────┘
        │
        ├───────────────┬───────────────┐
        ▼               ▼               ▼
   ┌─────────┐    ┌─────────┐    ┌─────────────┐
   │  AUDIT  │    │  DRIFT  │    │  RESPONSE   │
   │ (PG)    │    │ (Redis) │    │ (to Brain)  │
   └─────────┘    └─────────┘    └─────────────┘
```

---

## 3. Технический Стек

### 3.1 Core Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Runtime** | Bun | 1.x | JavaScript/TypeScript runtime |
| **Language** | TypeScript | 5.x | Type safety, Hermes compatibility |
| **Framework** | Elysia | 1.x | HTTP server, validation, OpenAPI |
| **Validation** | Zod (via Hermes) | 3.x | Schema validation |
| **ORM** | Drizzle | 0.x | Type-safe SQL, migrations |

### 3.2 Data Storage

| Store | Technology | Purpose |
|-------|------------|---------|
| **Primary DB** | TimescaleDB (PostgreSQL 16) | Audit events (hypertables), settings, policy versions |
| **Cache** | Redis 7.x | Idempotency cache, safe-mode state, counters |
| **Object Storage** | Minio (S3) | Audit export bundles |

### 3.3 Принципы Проектирования Базы Данных

> **ВАЖНО**: При проектировании и изменении архитектуры базы данных **ВСЕГДА** использовать MCP tool `pg aiguide` для получения актуальных best practices по PostgreSQL и TimescaleDB.

**Почему TimescaleDB:**

| Требование | Решение TimescaleDB |
|------------|---------------------|
| **Time-series audit events** | Hypertables с автоматическим партиционированием по времени |
| **Drift metrics** | Continuous aggregates для real-time аналитики |
| **7-year retention** | Compression policies + retention policies |
| **High write throughput** | Оптимизированные chunk-based inserts |
| **Fast time-range queries** | Автоматические индексы по времени |

**Обязательные действия при работе с БД:**

1. **Перед созданием таблиц** — использовать `pg:design-postgres-tables` skill для проверки типов данных, индексов, constraints
2. **Для time-series данных** — использовать `pg:setup-timescaledb-hypertables` skill для настройки hypertables, compression, retention
3. **При миграции** — использовать `pg:migrate-postgres-tables-to-hypertables` skill
4. **Для анализа существующих таблиц** — использовать `pg:find-hypertable-candidates` skill

**Таблицы-кандидаты для hypertables:**

| Таблица | Partition Column | Chunk Interval | Compression | Retention |
|---------|------------------|----------------|-------------|-----------|
| `audit_events` | `created_at` | 1 day | After 7 days | 7 years |
| `drift_baselines` | `calculated_at` | 1 week | After 30 days | 1 year |
| `safe_mode_history` | `created_at` | 1 week | After 30 days | 7 years |
| `clinician_queue` | `created_at` | 1 day | After 7 days | 1 year |

### 3.4 Observability

| Aspect | Technology | Purpose |
|--------|------------|---------|
| **Metrics** | Prometheus format | Decision latency, drift signals |
| **Logging** | Structured JSON | Audit trail, debugging |
| **Tracing** | OpenTelemetry | Distributed tracing (trace_id) |

---

## 4. Структура Репозитория

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
│   │   └── src/
│   │       ├── policy-engine/      # Safety DSL evaluator
│   │       │   ├── evaluator.ts    # Rule evaluation loop
│   │       │   ├── parser.ts       # YAML policy pack parser
│   │       │   └── conditions.ts   # Condition implementations
│   │       ├── decision/           # Decision builder
│   │       │   ├── builder.ts      # SupervisionResponse construction
│   │       │   └── aggregator.ts   # Multi-rule aggregation
│   │       ├── staleness/          # Snapshot staleness validator
│   │       │   ├── validator.ts
│   │       │   └── config.ts
│   │       ├── htv/                # HTV score evaluation
│   │       │   ├── evaluator.ts
│   │       │   └── thresholds.ts
│   │       └── conflict/           # Cross-domain conflict evaluation
│   │           └── evaluator.ts
│   │
│   ├── validation/                 # Hermes validation layer
│   │   └── src/
│   │       ├── schema.ts           # Hermes schema validation
│   │       ├── clock-skew.ts       # Request timestamp validation
│   │       ├── idempotency.ts      # Idempotency cache logic
│   │       └── multi-tenant.ts     # Organization authorization
│   │
│   ├── audit/                      # Audit event emission
│   │   └── src/
│   │       ├── emitter.ts          # AuditEvent producer
│   │       ├── storage/
│   │       │   ├── postgres.ts
│   │       │   └── interface.ts
│   │       └── export/
│   │           ├── bundle.ts       # De-identified bundle generator
│   │           └── redaction.ts    # PHI redaction rules
│   │
│   ├── control-plane/              # Safe-mode + settings
│   │   └── src/
│   │       ├── safe-mode.ts
│   │       ├── settings.ts
│   │       └── store/
│   │           ├── redis.ts
│   │           └── postgres.ts
│   │
│   ├── drift/                      # Drift monitoring
│   │   └── src/
│   │       ├── counters.ts
│   │       ├── thresholds.ts
│   │       ├── triggers.ts
│   │       └── baseline.ts
│   │
│   # NOTE: Hermes types используются из npm пакета @regain/hermes
│   # Исходный код: /Users/macbookpro/development/hermes
│   # НЕ создавать локальный packages/hermes — использовать готовый пакет
│
├── config/
│   ├── policies/                   # YAML policy packs
│   │   ├── default.yaml
│   │   └── advocate-clinical.yaml
│   └── popper-config.yaml          # Service configuration
│
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── migrations/                     # Drizzle migrations
│   └── ...
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/                   # Hermes test fixtures
│
├── docs/
│   ├── PRD.md                      # This file
│   ├── api.md
│   └── self-hosting.md
│
├── package.json                    # Workspace root
├── turbo.json
├── bunfig.toml
├── drizzle.config.ts
└── LICENSE                         # Apache 2.0
```

---

## 5. Схема Базы Данных

> **ВАЖНО**: Используется TimescaleDB. При любых изменениях схемы — консультироваться с `pg aiguide` MCP tool.

### 5.1 TimescaleDB Setup

```sql
-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;
```

### 5.2 Hypertables (Time-Series Data)

```sql
-- ═══════════════════════════════════════════════════════════════
-- AUDIT EVENTS (hypertable — основная таблица аудита)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE audit_events (
    -- NO UUID PRIMARY KEY for hypertables — use composite key
    trace_id TEXT NOT NULL,
    span_id TEXT,
    event_type TEXT NOT NULL,  -- SUPERVISION_DECISION, VALIDATION_FAILED, SAFE_MODE_CHANGED, etc.
    organization_id TEXT,
    subject_id TEXT,           -- Pseudonymous patient ID (NOT PII)

    -- Core decision data
    decision TEXT,             -- APPROVED, HARD_STOP, ROUTE_TO_CLINICIAN, REQUEST_MORE_INFO
    reason_codes TEXT[],

    -- Full payload (PHI-redacted)
    payload JSONB NOT NULL,

    -- Searchable tags
    tags JSONB DEFAULT '{}',

    -- Policy versioning for reproducibility
    policy_pack_id TEXT,
    policy_pack_version TEXT,

    -- Safe-mode state at decision time
    safe_mode_enabled BOOLEAN,

    -- Partition column (MUST be part of any unique constraint)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Composite primary key for hypertable
    PRIMARY KEY (trace_id, created_at)
);

-- Convert to hypertable
SELECT create_hypertable('audit_events', by_range('created_at', INTERVAL '1 day'));

-- Indexes for common query patterns (TimescaleDB auto-creates time index)
CREATE INDEX idx_audit_org_created ON audit_events(organization_id, created_at DESC);
CREATE INDEX idx_audit_event_type ON audit_events(event_type, created_at DESC);
CREATE INDEX idx_audit_decision ON audit_events(decision, created_at DESC) WHERE decision IS NOT NULL;
CREATE INDEX idx_audit_tags ON audit_events USING gin(tags);

-- Compression policy (compress chunks older than 7 days)
ALTER TABLE audit_events SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'organization_id',
    timescaledb.compress_orderby = 'created_at DESC'
);
SELECT add_compression_policy('audit_events', INTERVAL '7 days');

-- Retention policy (keep 7 years)
SELECT add_retention_policy('audit_events', INTERVAL '7 years');

-- ═══════════════════════════════════════════════════════════════
-- DRIFT BASELINES (hypertable — per organization metrics)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE drift_baselines (
    organization_id TEXT,               -- NULL = global
    signal_name TEXT NOT NULL,          -- validation_failure_rate, hard_stop_rate, etc.
    baseline_value NUMERIC NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    sample_count INTEGER NOT NULL,
    calculated_at TIMESTAMPTZ NOT NULL,

    PRIMARY KEY (organization_id, signal_name, calculated_at)
);

SELECT create_hypertable('drift_baselines', by_range('calculated_at', INTERVAL '1 week'));

-- Compression (after 30 days)
ALTER TABLE drift_baselines SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'organization_id, signal_name',
    timescaledb.compress_orderby = 'calculated_at DESC'
);
SELECT add_compression_policy('drift_baselines', INTERVAL '30 days');

-- Retention (1 year)
SELECT add_retention_policy('drift_baselines', INTERVAL '1 year');

-- ═══════════════════════════════════════════════════════════════
-- SAFE MODE HISTORY (hypertable — audit trail for safe-mode changes)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE safe_mode_history (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    organization_id TEXT,               -- NULL = global
    enabled BOOLEAN NOT NULL,
    reason TEXT NOT NULL,
    trigger_source TEXT,                -- manual, drift_threshold, incident, etc.
    effective_at TIMESTAMPTZ NOT NULL,
    effective_until TIMESTAMPTZ,        -- NULL = indefinite
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (id, created_at)
);

SELECT create_hypertable('safe_mode_history', by_range('created_at', INTERVAL '1 week'));

ALTER TABLE safe_mode_history SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'organization_id',
    timescaledb.compress_orderby = 'created_at DESC'
);
SELECT add_compression_policy('safe_mode_history', INTERVAL '30 days');
SELECT add_retention_policy('safe_mode_history', INTERVAL '7 years');

CREATE INDEX idx_safe_mode_org_effective ON safe_mode_history(organization_id, effective_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- CONTINUOUS AGGREGATES (real-time drift monitoring)
-- ═══════════════════════════════════════════════════════════════

-- Hourly decision stats for drift monitoring
CREATE MATERIALIZED VIEW audit_events_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', created_at) AS bucket,
    organization_id,
    decision,
    COUNT(*) AS decision_count,
    COUNT(*) FILTER (WHERE 'high_uncertainty' = ANY(reason_codes)) AS high_uncertainty_count,
    COUNT(*) FILTER (WHERE 'schema_invalid' = ANY(reason_codes)) AS validation_failure_count
FROM audit_events
GROUP BY bucket, organization_id, decision
WITH NO DATA;

-- Refresh policy: refresh every 5 minutes, keep 7 days real-time
SELECT add_continuous_aggregate_policy('audit_events_hourly',
    start_offset => INTERVAL '7 days',
    end_offset => INTERVAL '5 minutes',
    schedule_interval => INTERVAL '5 minutes'
);

-- Daily summary for long-term trends
CREATE MATERIALIZED VIEW audit_events_daily
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', created_at) AS bucket,
    organization_id,
    decision,
    COUNT(*) AS total_count,
    COUNT(DISTINCT trace_id) AS unique_traces,
    COUNT(*) FILTER (WHERE decision = 'HARD_STOP') AS hard_stop_count,
    COUNT(*) FILTER (WHERE decision = 'ROUTE_TO_CLINICIAN') AS route_count
FROM audit_events
GROUP BY bucket, organization_id, decision
WITH NO DATA;

SELECT add_continuous_aggregate_policy('audit_events_daily',
    start_offset => INTERVAL '30 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour'
);
```

### 5.3 Regular Tables (Non-Hypertable)

```sql
-- ═══════════════════════════════════════════════════════════════
-- OPERATIONAL SETTINGS (versioned configuration)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE operational_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT,               -- NULL = global default
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    effective_at TIMESTAMPTZ NOT NULL,
    created_by TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (organization_id, key, effective_at)
);

CREATE INDEX idx_settings_org_key ON operational_settings(organization_id, key, effective_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- POLICY PACK VERSIONS (for reproducibility)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE policy_pack_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pack_name TEXT NOT NULL,
    version TEXT NOT NULL,
    content_hash TEXT NOT NULL,         -- SHA256 of content
    content JSONB NOT NULL,             -- Full policy pack (for audit)
    activated_at TIMESTAMPTZ,           -- When this version became active
    deactivated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (pack_name, version)
);

CREATE INDEX idx_policy_pack_active ON policy_pack_versions(pack_name, activated_at DESC)
    WHERE activated_at IS NOT NULL AND deactivated_at IS NULL;

-- ═══════════════════════════════════════════════════════════════
-- INCIDENTS (for hard-stop analysis and triage)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT,
    incident_type TEXT NOT NULL,        -- drift_spike, hard_stop_spike, validation_failure_spike, etc.
    severity TEXT NOT NULL,             -- warning, critical

    -- Related audit events
    trigger_audit_event_id UUID REFERENCES audit_events(id),
    related_trace_ids TEXT[],

    -- Status
    status TEXT NOT NULL DEFAULT 'open', -- open, investigating, resolved, false_positive
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT,
    resolution_notes TEXT,

    -- Safe-mode triggered?
    safe_mode_triggered BOOLEAN DEFAULT FALSE,
    safe_mode_history_id UUID REFERENCES safe_mode_history(id),

    -- Export bundle
    export_bundle_path TEXT,            -- S3/Minio path

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_incidents_org_status ON incidents(organization_id, status, created_at DESC);
CREATE INDEX idx_incidents_type ON incidents(incident_type, created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- CLINICIAN QUEUE (for ROUTE_TO_CLINICIAN decisions)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE clinician_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL,
    trace_id TEXT NOT NULL,              -- Soft reference to audit_events (join via trace_id)
    audit_event_created_at TIMESTAMPTZ,  -- For joining with hypertable

    -- Patient context (pseudonymized)
    subject_id TEXT NOT NULL,

    -- Routing context
    reason_codes TEXT[],
    priority TEXT NOT NULL DEFAULT 'normal', -- low, normal, high, urgent
    proposal_summary TEXT,              -- PHI-safe summary

    -- Status
    status TEXT NOT NULL DEFAULT 'pending', -- pending, claimed, resolved, expired
    claimed_by TEXT,
    claimed_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolution TEXT,                    -- approved, rejected, escalated
    resolution_notes TEXT,

    -- Expiry
    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clinician_queue_org_status ON clinician_queue(organization_id, status, priority, created_at);
CREATE INDEX idx_clinician_queue_trace ON clinician_queue(trace_id);

-- ═══════════════════════════════════════════════════════════════
-- API KEYS (for multi-tenant auth)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL,
    key_hash TEXT NOT NULL,             -- SHA256 of the key
    key_prefix TEXT NOT NULL,           -- First 8 chars for identification
    name TEXT NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT ARRAY['supervise'],

    -- Rate limits (NULL = use org defaults)
    rate_limit_per_minute INTEGER,
    rate_limit_per_hour INTEGER,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at TIMESTAMPTZ,

    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    revoked_by TEXT
);

CREATE UNIQUE INDEX idx_api_keys_hash ON api_keys(key_hash) WHERE is_active = TRUE;
CREATE INDEX idx_api_keys_org ON api_keys(organization_id) WHERE is_active = TRUE;

-- ═══════════════════════════════════════════════════════════════
-- ORGANIZATIONS (multi-tenant configuration)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE organizations (
    id TEXT PRIMARY KEY,                -- e.g., "org_abc123"
    name TEXT NOT NULL,

    -- Mode configuration
    allowed_modes TEXT[] NOT NULL DEFAULT ARRAY['wellness'],

    -- Rate limits
    rate_limit_per_minute INTEGER NOT NULL DEFAULT 1000,
    rate_limit_per_hour INTEGER NOT NULL DEFAULT 50000,

    -- Policy configuration
    default_policy_pack TEXT NOT NULL DEFAULT 'default',

    -- Staleness overrides (NULL = use global defaults)
    staleness_wellness_hours INTEGER,
    staleness_clinical_hours INTEGER,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 5.4 Redis Keys

```yaml
# ═══════════════════════════════════════════════════════════════
# IDEMPOTENCY CACHE
# ═══════════════════════════════════════════════════════════════
idempotency:{org_id}:{idempotency_key}:
  type: hash
  fields:
    request_hash: "sha256..."          # Hash of canonicalized request
    response: "{...json...}"           # Cached SupervisionResponse
    created_at: "2026-01-25T10:00:00Z"
  ttl: 300  # 5 minutes

# ═══════════════════════════════════════════════════════════════
# SAFE MODE STATE (fast reads)
# ═══════════════════════════════════════════════════════════════
safe_mode:{org_id}:
  type: hash
  fields:
    enabled: "true" | "false"
    effective_at: "2026-01-25T10:00:00Z"
    effective_until: "2026-01-25T18:00:00Z"
    reason: "Drift detected"
    trigger_source: "drift_threshold"

safe_mode:global:
  # Same structure, applies when org-specific not set

# ═══════════════════════════════════════════════════════════════
# DRIFT COUNTERS (sliding window)
# ═══════════════════════════════════════════════════════════════
drift:{org_id}:{signal}:{window_minute}:
  type: string (counter)
  ttl: 3600  # 1 hour

# Signals tracked:
# - validation_failure_count
# - hard_stop_count
# - route_to_clinician_count
# - high_uncertainty_count
# - missing_evidence_count
# - htv_below_threshold_count
# - request_count (total)

# ═══════════════════════════════════════════════════════════════
# RATE LIMITING
# ═══════════════════════════════════════════════════════════════
rate_limit:{org_id}:minute:{minute_ts}:
  type: string (counter)
  ttl: 60

rate_limit:{org_id}:hour:{hour_ts}:
  type: string (counter)
  ttl: 3600

# ═══════════════════════════════════════════════════════════════
# ACTIVE POLICY PACK CACHE
# ═══════════════════════════════════════════════════════════════
policy_pack:{pack_name}:active:
  type: hash
  fields:
    version: "1.2.3"
    content_hash: "sha256..."
    content: "{...json...}"
  ttl: 300  # 5 min cache, refresh on miss

# ═══════════════════════════════════════════════════════════════
# SESSION LOCKS (for control plane operations)
# ═══════════════════════════════════════════════════════════════
lock:safe_mode:{org_id}:
  type: string
  value: "{operator_id}"
  ttl: 30  # Lock timeout
```

### 5.5 Minio Buckets

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

  popper-policy-archive:
    purpose: Historical policy pack versions (backup)
    retention: 7 years
    structure: /{pack_name}/{version}.yaml
```

---

## 6. API Specification

### 6.1 Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/popper/supervise` | Evaluate SupervisionRequest |
| `POST` | `/v1/popper/control/safe-mode` | Set safe-mode state |
| `POST` | `/v1/popper/control/settings` | Update operational setting |
| `GET` | `/v1/popper/status` | Get service status |
| `GET` | `/v1/popper/audit` | Query audit events |
| `POST` | `/v1/popper/export` | Generate export bundle |
| `GET` | `/health` | Health check |
| `GET` | `/metrics` | Prometheus metrics |

### 6.2 Supervision Endpoint

```typescript
// POST /v1/popper/supervise
// Headers: X-API-Key, X-Trace-ID (optional)

interface SupervisionRequest {
  // Hermes trace context
  trace: {
    trace_id: string;
    span_id?: string;
    producer?: {
      agent_id: string;
      agent_version: string;
    };
  };

  // Operating mode
  mode: 'wellness' | 'advocate_clinical';

  // Subject (pseudonymized)
  subject: {
    subject_id: string;
    organization_id?: string;  // Required in advocate_clinical
  };

  // Proposals to evaluate
  proposals: ProposedIntervention[];

  // Health state snapshot
  snapshot: {
    snapshot_id: string;
    created_at: string;        // ISO timestamp
    snapshot_uri?: string;     // URI to fetch full snapshot
    snapshot_hash?: string;    // SHA256 for integrity
    quality?: {
      missing_signals?: string[];
      conflicting_signals?: string[];
    };
  };

  // Optional inline snapshot (≤1MB)
  snapshot_payload?: HealthStateSnapshot;

  // Cross-domain conflicts (from DomainComposer)
  cross_domain_conflicts?: CrossDomainConflict[];

  // Composition metadata
  composition_metadata?: CompositionMetadata;

  // Input risk assessment (from Deutsch)
  input_risk?: {
    flags?: string[];         // prompt_injection_suspected, etc.
  };

  // Idempotency
  idempotency_key?: string;
  request_timestamp?: string;

  // Clinician feedback context
  relevant_prior_overrides?: PriorOverride[];
  feedback_metrics?: FeedbackMetrics;
}

interface SupervisionResponse {
  // Primary decision
  decision: 'APPROVED' | 'HARD_STOP' | 'ROUTE_TO_CLINICIAN' | 'REQUEST_MORE_INFO';

  // Reason codes
  reason_codes: ReasonCode[];

  // Human-readable explanation
  explanation: string;

  // Required action (for REQUEST_MORE_INFO)
  required_action?: {
    kind: 'refresh_snapshot' | 'provide_evidence' | 'clarify_proposal';
    details: Record<string, unknown>;
  };

  // Per-proposal decisions (for partial approval)
  per_proposal_decisions?: {
    proposal_id: string;
    decision: 'APPROVED' | 'HARD_STOP' | 'ROUTE_TO_CLINICIAN';
    reason_codes: ReasonCode[];
  }[];

  // Constraints on approved actions
  approved_constraints?: {
    must_route_after?: string;
    allowed_actions?: string[];
  };

  // Trace context for audit
  trace: {
    trace_id: string;
    span_id: string;
    producer: {
      agent_id: 'popper';
      agent_version: string;
      ruleset_version: string;
    };
  };

  // Audit redaction hints
  audit_redaction?: {
    fields_redacted: string[];
  };
}
```

### 6.3 Control Plane Endpoints

```typescript
// POST /v1/popper/control/safe-mode
interface SetSafeModeRequest {
  enabled: boolean;
  reason: string;
  effective_until?: string;    // ISO timestamp, NULL = indefinite
  organization_id?: string;    // NULL = global
}

// POST /v1/popper/control/settings
interface UpdateSettingRequest {
  key: string;
  value: unknown;
  organization_id?: string;
  reason: string;
}

// GET /v1/popper/status
interface StatusResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime_seconds: number;
  safe_mode: {
    global: boolean;
    organizations: Record<string, boolean>;
  };
  active_policy_packs: {
    name: string;
    version: string;
  }[];
  drift_signals: {
    signal: string;
    current_rate: number;
    baseline_rate: number;
    status: 'normal' | 'warning' | 'critical';
  }[];
}
```

---

## 7. Safety DSL

### 7.1 Policy Pack Format

```yaml
# config/policies/default.yaml
version: "1.0"
name: "default"
description: "Default policy pack for wellness mode"

# Staleness configuration
staleness:
  thresholds:
    wellness_hours: 24
    clinical_hours: 4
  behavior:
    low_risk_stale: "REQUEST_MORE_INFO"
    high_risk_stale: "ROUTE_TO_CLINICIAN"

# Policy rules (evaluated in priority order, highest first)
rules:
  # ════════════════════════════════════════
  # VALIDATION RULES (priority 1000+)
  # ════════════════════════════════════════

  - rule_id: "schema_invalid"
    priority: 1000
    description: "Invalid Hermes schema"
    when:
      kind: "schema_invalid"
    then:
      decision: "HARD_STOP"
      reason_codes: ["schema_invalid"]
      explanation: "Request does not conform to Hermes schema."

  - rule_id: "snapshot_missing"
    priority: 950
    description: "No snapshot provided"
    when:
      kind: "snapshot_missing"
    then:
      decision: "HARD_STOP"
      reason_codes: ["snapshot_missing", "schema_invalid"]
      explanation: "No health state snapshot provided."

  # ════════════════════════════════════════
  # STALENESS RULES (priority 900+)
  # ════════════════════════════════════════

  - rule_id: "snapshot_stale_clinical"
    priority: 900
    description: "Stale snapshot in advocate_clinical mode"
    when:
      kind: "all_of"
      conditions:
        - kind: "snapshot_stale"
        - kind: "other"
          expr: "mode === 'advocate_clinical'"
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["snapshot_stale", "high_uncertainty"]
      explanation: "Health state snapshot is stale for clinical decisions."

  - rule_id: "snapshot_stale_high_risk"
    priority: 850
    description: "Stale snapshot for high-risk proposal"
    when:
      kind: "all_of"
      conditions:
        - kind: "snapshot_stale"
        - kind: "proposal_kind_in"
          kinds: ["MEDICATION_ORDER_PROPOSAL", "TRIAGE_ROUTE"]
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["snapshot_stale", "risk_too_high"]
      explanation: "Health state is stale for high-risk action."

  - rule_id: "snapshot_stale_low_risk"
    priority: 800
    description: "Stale snapshot for low-risk proposal"
    when:
      kind: "snapshot_stale"
    then:
      decision: "REQUEST_MORE_INFO"
      reason_codes: ["snapshot_stale"]
      explanation: "Please refresh patient data."

  # ════════════════════════════════════════
  # SAFE MODE RULES (priority 700+)
  # ════════════════════════════════════════

  - rule_id: "safe_mode_medication"
    priority: 750
    description: "Safe mode blocks medication proposals"
    when:
      kind: "all_of"
      conditions:
        - kind: "safe_mode_enabled"
        - kind: "proposal_kind_in"
          kinds: ["MEDICATION_ORDER_PROPOSAL"]
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["policy_violation", "risk_too_high"]
      explanation: "Safe mode is active. Medication changes require clinician review."

  - rule_id: "safe_mode_high_risk"
    priority: 700
    description: "Safe mode routes high-risk proposals"
    when:
      kind: "all_of"
      conditions:
        - kind: "safe_mode_enabled"
        - kind: "proposal_kind_in"
          kinds: ["ESCALATE_TO_CARE_TEAM", "TRIAGE_ROUTE"]
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["policy_violation"]
      explanation: "Safe mode is active."

  # ════════════════════════════════════════
  # GOVERNANCE RULES (priority 600+)
  # ════════════════════════════════════════

  - rule_id: "missing_protocol_ref"
    priority: 650
    description: "Medication proposal without clinician protocol"
    when:
      kind: "all_of"
      conditions:
        - kind: "proposal_kind_in"
          kinds: ["MEDICATION_ORDER_PROPOSAL"]
        - kind: "missing_field"
          field_path: "clinician_protocol_ref"
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["policy_violation"]
      explanation: "Medication proposal requires clinician protocol reference."

  - rule_id: "missing_evidence"
    priority: 600
    description: "High-risk proposal without evidence"
    when:
      kind: "all_of"
      conditions:
        - kind: "proposal_kind_in"
          kinds: ["MEDICATION_ORDER_PROPOSAL", "TRIAGE_ROUTE"]
        - kind: "proposal_missing_field"
          field_path: "evidence_refs"
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["insufficient_evidence"]
      explanation: "High-risk action requires supporting evidence."

  # ════════════════════════════════════════
  # UNCERTAINTY RULES (priority 500+)
  # ════════════════════════════════════════

  - rule_id: "high_uncertainty"
    priority: 550
    description: "High uncertainty disclosed"
    when:
      kind: "uncertainty_at_least"
      level: "high"
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["high_uncertainty"]
      explanation: "Agent disclosed high uncertainty."

  - rule_id: "htv_below_medication"
    priority: 500
    description: "Low HTV score for medication"
    when:
      kind: "all_of"
      conditions:
        - kind: "proposal_kind_in"
          kinds: ["MEDICATION_ORDER_PROPOSAL"]
        - kind: "htv_score_below"
          threshold: 0.5
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["low_htv_score", "high_uncertainty"]
      explanation: "Explanation quality (HTV) below threshold for medication."

  - rule_id: "htv_below_triage"
    priority: 450
    description: "Low HTV score for triage"
    when:
      kind: "all_of"
      conditions:
        - kind: "proposal_kind_in"
          kinds: ["TRIAGE_ROUTE"]
        - kind: "htv_score_below"
          threshold: 0.4
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["low_htv_score"]
      explanation: "Explanation quality (HTV) below threshold for triage."

  # ════════════════════════════════════════
  # CONFLICT RULES (priority 400+)
  # ════════════════════════════════════════

  - rule_id: "conflict_escalated"
    priority: 450
    description: "Cross-domain conflict marked for escalation"
    when:
      kind: "conflict_escalated"
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["needs_human_review"]
      explanation: "Cross-domain conflict requires clinician review."

  - rule_id: "conflict_missing_evidence"
    priority: 400
    description: "Conflict resolution lacks evidence"
    when:
      kind: "conflict_missing_evidence"
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["insufficient_evidence"]
      explanation: "Cross-domain conflict resolution lacks supporting evidence."

  - rule_id: "rule_engine_failed"
    priority: 1000
    description: "Domain rule engine failed"
    when:
      kind: "rule_engine_failed"
    then:
      decision: "HARD_STOP"
      reason_codes: ["policy_violation"]
      explanation: "Domain rule engine failure."

  # ════════════════════════════════════════
  # INPUT RISK RULES (priority 300+)
  # ════════════════════════════════════════

  - rule_id: "prompt_injection"
    priority: 350
    description: "Prompt injection suspected"
    when:
      kind: "input_risk_flag_in"
      flags: ["prompt_injection_suspected"]
    then:
      decision: "ROUTE_TO_CLINICIAN"
      reason_codes: ["policy_violation"]
      explanation: "Input risk detected."

  # ════════════════════════════════════════
  # DEFAULT RULE (priority 0)
  # ════════════════════════════════════════

  - rule_id: "default_approve"
    priority: 0
    description: "Default: approve if no rules triggered"
    when:
      kind: "always"
    then:
      decision: "APPROVED"
      reason_codes: []
      explanation: "All safety checks passed."
```

---

## 8. Drift Monitoring

### 8.1 Tracked Signals

| Signal | Warning (2x baseline) | Critical (5x baseline) | Action |
|--------|----------------------|------------------------|--------|
| `validation_failure_rate` | Alert ops | Enable safe-mode | Review schema issues |
| `hard_stop_rate` | Alert ops | Enable safe-mode | Review Deutsch quality |
| `route_to_clinician_rate` | Alert ops | Review | Check proposal quality |
| `high_uncertainty_rate` | Monitor | Alert ops | Review Deutsch confidence |
| `htv_below_threshold_rate` | Monitor | Alert ops | Review explanation quality |
| `decision_latency_p95` | >500ms: Alert | >1000ms: Alert | Technical review |

### 8.2 Baseline Calculation

- **Default window**: 7-day rolling average
- **Per-org baselines**: After 30-day stabilization
- **Recalibration triggers**:
  - Major Deutsch model update
  - Policy pack version change
  - Manual reset by ops

---

## 9. Latency Budget

| Stage | Target | Notes |
|-------|--------|-------|
| Ingress + Auth | <5ms | In-memory API key validation |
| Validation | <5ms | Schema validation, Redis lookup |
| Policy Engine | <20ms | Deterministic rules, no I/O |
| Decision Assembly | <2ms | In-memory aggregation |
| Audit Emission | <3ms | Async write (non-blocking) |
| **Total** | **<35ms** | Well under 100ms requirement |

---

## 10. Acceptance Criteria

### 10.1 MVP (v1.0)

- [ ] Supervision API работает и возвращает Hermes-compliant responses
- [ ] Safety DSL evaluator корректно обрабатывает все condition types
- [ ] Staleness validation работает для обоих режимов (wellness/clinical)
- [ ] Safe-mode control plane функционален
- [ ] Audit events записываются в PostgreSQL с trace_id
- [ ] Idempotency cache предотвращает replay
- [ ] Basic drift counters в Redis
- [ ] Health/metrics endpoints для observability
- [ ] Docker compose для локальной разработки
- [ ] Unit tests для всех policy rules

### 10.2 v1.1 Additions

- [ ] Multi-tenant isolation (organization_id)
- [ ] HTV score evaluation
- [ ] Cross-domain conflict evaluation
- [ ] Per-proposal decisions
- [ ] Export bundle generation
- [ ] Incident management
- [ ] Clinician queue integration

### 10.3 v1.2 Additions

- [ ] Accuracy ascertainment sampling
- [ ] Hallucination detection
- [ ] Bias monitoring
- [ ] FDA MDDT qualification preparation

---

## 11. Development Commands

```bash
# Install dependencies
bun install

# Run infrastructure (PostgreSQL, Redis, Minio)
docker compose -f docker/docker-compose.yml up -d

# Run database migrations
bun run db:migrate

# Run Popper in dev mode
bun run dev

# Run tests
bun test                    # All tests
bun test:unit              # Unit tests only
bun test:integration       # Integration tests

# Lint & typecheck
bun run lint
bun run typecheck

# Build for production
bun run build
```

---

## 12. References

- **Hermes Contract**: `@regain/hermes` package
- **ARPA-H TA2 Specs**: Original requirements document
- **FDA MDDT Guidance**: Non-Clinical Assessment Model (NAM) pathway
- **Popperian Epistemology**: Karl Popper's demarcation principle

---

*Этот документ является единственным источником истины для проекта Popper.*
