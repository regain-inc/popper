# Popper — Project Tasks

> Формат задач готов для импорта в Linear

---

## Linear Integration

| Task ID | Linear ID | Status | Assignee |
|---------|-----------|--------|----------|
| POP-001 | [SAL-596](https://linear.app/salomatic/issue/SAL-596) | ✅ Done | Davron |
| POP-002 | [SAL-597](https://linear.app/salomatic/issue/SAL-597) | ✅ Done | Davron |
| POP-003 | [SAL-598](https://linear.app/salomatic/issue/SAL-598) | Backlog | Davron |
| POP-004 | [SAL-599](https://linear.app/salomatic/issue/SAL-599) | Backlog | Davron |
| POP-005 | [SAL-600](https://linear.app/salomatic/issue/SAL-600) | Backlog | Davron |
| POP-006 | [SAL-601](https://linear.app/salomatic/issue/SAL-601) | Backlog | Davron |
| POP-007 | [SAL-602](https://linear.app/salomatic/issue/SAL-602) | Backlog | Davron |
| POP-008 | [SAL-603](https://linear.app/salomatic/issue/SAL-603) | Backlog | Davron |
| POP-009 | [SAL-604](https://linear.app/salomatic/issue/SAL-604) | Backlog | Davron |
| POP-010 | [SAL-605](https://linear.app/salomatic/issue/SAL-605) | Backlog | Davron |
| POP-011 | [SAL-606](https://linear.app/salomatic/issue/SAL-606) | Backlog | Davron |
| POP-012 | [SAL-607](https://linear.app/salomatic/issue/SAL-607) | Backlog | Davron |
| POP-013 | [SAL-608](https://linear.app/salomatic/issue/SAL-608) | Backlog | Davron |
| POP-014 | [SAL-609](https://linear.app/salomatic/issue/SAL-609) | Backlog | Davron |
| POP-015 | [SAL-610](https://linear.app/salomatic/issue/SAL-610) | Backlog | Davron |
| POP-016 | [SAL-611](https://linear.app/salomatic/issue/SAL-611) | Backlog | Davron |
| POP-017 | [SAL-612](https://linear.app/salomatic/issue/SAL-612) | Backlog | Davron |
| POP-018 | [SAL-613](https://linear.app/salomatic/issue/SAL-613) | Backlog | Davron |
| POP-019 | [SAL-614](https://linear.app/salomatic/issue/SAL-614) | Backlog | Davron |
| POP-020 | [SAL-615](https://linear.app/salomatic/issue/SAL-615) | Backlog | Harsh |
| POP-021 | [SAL-616](https://linear.app/salomatic/issue/SAL-616) | Backlog | Harsh |
| POP-022 | [SAL-617](https://linear.app/salomatic/issue/SAL-617) | Backlog | Harsh |
| POP-023 | [SAL-618](https://linear.app/salomatic/issue/SAL-618) | Backlog | Davron |
| POP-024 | [SAL-619](https://linear.app/salomatic/issue/SAL-619) | Backlog | Davron |

---

## Development Guidelines

> **ВАЖНО**: Все задачи должны выполняться в строгом соответствии с документацией проекта.

### Обязательные документы

| Документ | Путь | Описание |
|----------|------|----------|
| **PRD** | `/PRD.md` | Главный источник истины — архитектура, стек, схема БД, API |
| **Popper Specs** | `/docs/specs/02-popper-specs/` | Детальные спецификации системы |
| **Hermes Contracts** | `/docs/specs/03-hermes-specs/` | Типы, контракты, fixtures |
| **Overall Architecture** | `/docs/specs/00-overall-specs/` | Общая архитектура Deutsch/Popper/Hermes |

### Правила разработки

1. **Перед началом задачи** — прочитать PRD и релевантные specs
2. **При проектировании БД** — использовать `pg aiguide` MCP tool (TimescaleDB)
3. **Типы и контракты** — строго по Hermes specs (docs/specs/03-hermes-specs/02-hermes-contracts.md)
4. **Safety DSL** — по спецификации (docs/specs/02-popper-specs/03-popper-safety-dsl.md)
5. **API endpoints** — по контрактам (docs/specs/02-popper-specs/02-popper-contracts-and-interfaces.md)
6. **При расхождении** — PRD имеет приоритет, обновить specs если нужно

### Ключевые specs по задачам

| Область | Основной spec |
|---------|---------------|
| System behavior | `02-popper-specs/01-popper-system-spec.md` |
| API contracts | `02-popper-specs/02-popper-contracts-and-interfaces.md` |
| Safety DSL | `02-popper-specs/03-popper-safety-dsl.md` |
| Regulatory export | `02-popper-specs/04-popper-regulatory-export-and-triage.md` |
| Measurement | `02-popper-specs/05-popper-measurement-protocols.md` |
| Architecture | `02-popper-specs/10-popper-service-architecture.md` |
| Hermes types | `03-hermes-specs/02-hermes-contracts.md` |

---

## Team

| Member | Role | Availability | Focus |
|--------|------|--------------|-------|
| **Davron Yuldashev** | Backend / DevOps | Available now | All backend, DB, infrastructure |
| **Harsh Manwani** | Frontend / Mobile | Later | Ops Dashboard (web UI) |

---

## Phase 1: Foundation (v0.1)

**Goal**: Базовая инфраструктура проекта

### POP-001: Project Foundation Setup

**Assignee**: @davron-yuldashev
**Labels**: `phase-1`, `setup`, `infrastructure`
**Estimate**: 3 points
**Priority**: P0

**Description**:
Initialize Popper monorepo with modern TypeScript stack.

**Acceptance Criteria**:
- [ ] Bun workspace monorepo structure (apps/server, packages/*)
- [ ] TypeScript 5.x with strict mode
- [ ] Turborepo configuration
- [ ] ESLint + Prettier setup
- [ ] Pre-commit hooks (husky + lint-staged)
- [ ] Basic package.json scripts (dev, build, test, lint)
- [ ] LICENSE file (Apache 2.0)

**Technical Notes**:
- Runtime: Bun 1.x
- Structure per PRD section 4

**Reference Docs**:
- `PRD.md` — section 4 (Repository Structure)
- `docs/specs/02-popper-specs/10-popper-service-architecture.md` — section 2

---

### POP-002: TimescaleDB Database Setup

**Assignee**: @davron-yuldashev
**Labels**: `phase-1`, `database`, `timescaledb`
**Estimate**: 5 points
**Priority**: P0
**Blocked by**: POP-001

**Description**:
Set up TimescaleDB with Drizzle ORM and create initial schema.

**Acceptance Criteria**:
- [ ] Docker compose with TimescaleDB 16 + Redis 7 + Minio
- [ ] Drizzle ORM configuration
- [ ] TimescaleDB extension enabled
- [ ] Hypertables created:
  - `audit_events` (partition: created_at, chunk: 1 day)
  - `drift_baselines` (partition: calculated_at, chunk: 1 week)
  - `safe_mode_history` (partition: created_at, chunk: 1 week)
- [ ] Compression policies (7 days)
- [ ] Retention policies (7 years for audit)
- [ ] Continuous aggregates: `audit_events_hourly`, `audit_events_daily`
- [ ] Regular tables: operational_settings, policy_pack_versions, incidents, clinician_queue, api_keys, organizations
- [ ] Migration scripts working

**Technical Notes**:
- Use `pg aiguide` MCP tool for schema validation and hypertable setup

**Reference Docs**:
- `PRD.md` — section 3.3 (DB Design Principles), section 5 (Schema)
- `docs/specs/02-popper-specs/10-popper-service-architecture.md` — section 3

---

### POP-003: Basic Elysia Server

**Assignee**: @davron-yuldashev
**Labels**: `phase-1`, `api`, `elysia`
**Estimate**: 2 points
**Priority**: P0
**Blocked by**: POP-001

**Description**:
Create basic Elysia HTTP server with health and metrics endpoints.

**Acceptance Criteria**:
- [ ] Elysia 1.x server in apps/server
- [ ] GET /health endpoint (liveness check)
- [ ] GET /metrics endpoint (Prometheus format)
- [ ] Structured JSON logging (pino)
- [ ] OpenTelemetry trace_id propagation middleware
- [ ] Graceful shutdown handling
- [ ] Environment configuration (dotenv)

**Endpoints**:
```
GET /health → { status: "healthy", version, uptime_seconds }
GET /metrics → Prometheus text format
```

**Technical Notes**:
- Port: 3000 (configurable)

**Reference Docs**:
- `PRD.md` — section 6.1 (Core Endpoints)
- `docs/specs/02-popper-specs/10-popper-service-architecture.md` — section 1

---

## Phase 2: Core Engine (v0.2)

**Goal**: Deterministic policy engine

### POP-004: Hermes Package Integration

**Assignee**: @davron-yuldashev
**Labels**: `phase-2`, `types`, `hermes`
**Estimate**: 2 points
**Priority**: P0
**Blocked by**: POP-001

**Description**:
Integrate existing `@regain/hermes` npm package into Popper for schema validation.

> **ВАЖНО**: НЕ создавать собственный packages/hermes. Использовать готовый npm пакет `@regain/hermes` (v1.0.3+, Hermes Protocol v1.6.0).
>
> Исходный код пакета: `/Users/macbookpro/development/hermes`

**Acceptance Criteria**:
- [ ] `@regain/hermes` добавлен как dependency в apps/server и packages/core
- [ ] Импорты типов работают: SupervisionRequest, SupervisionResponse, ProposedIntervention, AuditEvent, ReasonCode, SupervisionDecision
- [ ] AJV валидация работает через `validateHermesMessage()` и `parseHermesMessage()`
- [ ] Test fixtures импортируются из `@regain/hermes/fixtures`
- [ ] HTV utilities используются из пакета (computeHTVScore, meetsHTVThreshold)
- [ ] Builders используются для создания responses (createSupervisionResponse)
- [ ] TypeScript strict mode совместим с типами пакета

**Что уже есть в @regain/hermes**:
- Все типы: SupervisionRequest/Response, ProposedIntervention (8 видов), AuditEvent (11 типов)
- Enums: ReasonCode (13), SupervisionDecision (4), ProposedInterventionKind (8)
- Validation: JSON Schema + AJV validators
- Builders: createSupervisionRequest/Response, HTVScoreBuilder
- Utilities: HTV scoring, uncertainty calculation, datetime, trace
- Fixtures: comprehensive test fixtures for all message types

**Technical Notes**:
- Package uses AJV (not Zod) for runtime validation — это OK
- Type guards доступны: isSupervisionRequest(), isSupervisionResponse(), etc.
- Constants exported: REASON_CODES, SUPERVISION_DECISIONS, CURRENT_HERMES_VERSION

**Reference Docs**:
- npm: https://www.npmjs.com/package/@regain/hermes
- Source: `/Users/macbookpro/development/hermes`
- `docs/specs/03-hermes-specs/02-hermes-contracts.md` — спецификация протокола
- `PRD.md` — section 6.2 (Supervision Endpoint types)

---

### POP-005: Safety DSL Parser

**Assignee**: @davron-yuldashev
**Labels**: `phase-2`, `core`, `safety-dsl`
**Estimate**: 5 points
**Priority**: P0
**Blocked by**: POP-004

**Description**:
Implement YAML policy pack parser for Safety DSL.

**Acceptance Criteria**:
- [ ] packages/core/policy-engine created
- [ ] YAML policy pack loader
- [ ] PolicyPack type with rules, staleness config
- [ ] RuleCondition parser (all_of, any_of, not, etc.)
- [ ] All condition kinds supported:
  - `schema_invalid`, `safe_mode_enabled`, `missing_field`
  - `proposal_kind_in`, `uncertainty_at_least`
  - `snapshot_stale`, `snapshot_missing`
  - `htv_score_below`, `evidence_grade_below`
  - `conflict_*` conditions
- [ ] RuleAction parser with decision, reason_codes, explanation
- [ ] Policy pack version tracking
- [ ] Default policy pack (config/policies/default.yaml)
- [ ] Unit tests for parser

**Reference Docs**:
- `PRD.md` — section 7 (Safety DSL)
- `docs/specs/02-popper-specs/03-popper-safety-dsl.md` — полная спецификация DSL
- `config/policies/default.yaml` — пример policy pack

---

### POP-006: Policy Engine Evaluator

**Assignee**: @davron-yuldashev
**Labels**: `phase-2`, `core`, `policy-engine`
**Estimate**: 5 points
**Priority**: P0
**Blocked by**: POP-005

**Description**:
Implement deterministic policy engine that evaluates rules against SupervisionRequest.

**Acceptance Criteria**:
- [ ] PolicyEvaluator class
- [ ] Evaluate rules in priority order (highest first)
- [ ] Boolean condition evaluation (all_of, any_of, not)
- [ ] First-match-wins semantics (unless continue: true)
- [ ] Conservatism principle: HARD_STOP > ROUTE > REQUEST_MORE_INFO > APPROVED
- [ ] Reason codes aggregation (deduplicated)
- [ ] Default rule fallback (ROUTE_TO_CLINICIAN if no match)
- [ ] Rule execution trace for audit
- [ ] Target latency: <20ms p95
- [ ] Unit tests with test vectors

**Reference Docs**:
- `docs/specs/02-popper-specs/03-popper-safety-dsl.md` — section 4 (Evaluation semantics)
- `PRD.md` — section 7.1 (Policy Pack Format)

---

### POP-007: Staleness Validator

**Assignee**: @davron-yuldashev
**Labels**: `phase-2`, `core`, `staleness`
**Estimate**: 3 points
**Priority**: P0
**Blocked by**: POP-004

**Description**:
Implement snapshot staleness validation. Popper is AUTHORITATIVE - does NOT trust Brain's validation.

**Acceptance Criteria**:
- [ ] StalenessValidator class
- [ ] Configurable thresholds:
  - wellness: 24 hours (default)
  - advocate_clinical: 4 hours (default)
- [ ] Mode-aware validation
- [ ] Return appropriate decision:
  - Low-risk + stale → REQUEST_MORE_INFO
  - High-risk + stale → ROUTE_TO_CLINICIAN
  - Clinical mode + stale → ROUTE_TO_CLINICIAN
  - Snapshot missing → HARD_STOP
- [ ] required_action with refresh_snapshot details
- [ ] Configuration via popper-config.yaml
- [ ] Unit tests

**Reference Docs**:
- `docs/specs/02-popper-specs/01-popper-system-spec.md` — section 5.1.1 (Staleness)
- `PRD.md` — section 3.3 (Staleness thresholds table)

---

### POP-008: Decision Builder

**Assignee**: @davron-yuldashev
**Labels**: `phase-2`, `core`, `decision`
**Estimate**: 3 points
**Priority**: P0
**Blocked by**: POP-006, POP-007

**Description**:
Implement SupervisionResponse builder that aggregates evaluation results.

**Acceptance Criteria**:
- [ ] DecisionBuilder class
- [ ] Aggregate multiple rule results
- [ ] Apply conservatism principle (strictest wins)
- [ ] Build complete SupervisionResponse:
  - decision, reason_codes, explanation
  - required_action (when applicable)
  - per_proposal_decisions (for partial approval)
  - approved_constraints
  - trace context with producer info
  - audit_redaction hints
- [ ] Include policy_pack version in trace
- [ ] Include safe_mode state in response
- [ ] Unit tests

**Reference Docs**:
- `PRD.md` — section 6.2 (Supervision Endpoint)
- `docs/specs/03-hermes-specs/02-hermes-contracts.md` — SupervisionResponse type

---

## Phase 3: Supervision API (v0.3)

**Goal**: Working supervision endpoint

### POP-009: Supervision API Endpoint

**Assignee**: @davron-yuldashev
**Labels**: `phase-3`, `api`, `supervision`
**Estimate**: 5 points
**Priority**: P0
**Blocked by**: POP-003, POP-008

**Description**:
Implement POST /v1/popper/supervise endpoint - the core supervision API.

**Acceptance Criteria**:
- [ ] POST /v1/popper/supervise route
- [ ] Request validation via Hermes Zod schema
- [ ] Clock-skew validation (±5 min for advocate_clinical)
- [ ] Full evaluation pipeline:
  1. Schema validation
  2. Staleness check
  3. Policy engine evaluation
  4. Decision building
- [ ] Return Hermes-compliant SupervisionResponse
- [ ] Error handling with appropriate HTTP status codes
- [ ] Request/response logging (PHI-safe)
- [ ] Latency tracking (target <100ms e2e)
- [ ] Integration tests

**Reference Docs**:
- `docs/specs/02-popper-specs/02-popper-contracts-and-interfaces.md` — API contracts
- `docs/specs/03-hermes-specs/02-hermes-contracts.md` — Request/Response types
- `PRD.md` — section 6.2, section 9 (Latency Budget)

---

### POP-010: Audit Event Emission

**Assignee**: @davron-yuldashev
**Labels**: `phase-3`, `audit`, `timescaledb`
**Estimate**: 3 points
**Priority**: P0
**Blocked by**: POP-002, POP-009

**Description**:
Implement audit event emission to TimescaleDB hypertable.

**Acceptance Criteria**:
- [ ] AuditEmitter class
- [ ] Emit events for:
  - SUPERVISION_DECISION (every decision)
  - VALIDATION_FAILED (schema/clock-skew failures)
- [ ] Events joinable by trace_id
- [ ] Async write (non-blocking, <3ms)
- [ ] PHI redaction before storage
- [ ] Include: trace_id, event_type, decision, reason_codes, organization_id, subject_id, policy versions, safe_mode state, tags, payload
- [ ] Batch insert optimization
- [ ] Error handling (don't fail request on audit failure)
- [ ] Integration tests

**Reference Docs**:
- `PRD.md` — section 5.2 (Hypertables)
- `docs/specs/02-popper-specs/01-popper-system-spec.md` — section 7 (Audit)

---

### POP-011: Idempotency Cache

**Assignee**: @davron-yuldashev
**Labels**: `phase-3`, `security`, `redis`
**Estimate**: 3 points
**Priority**: P1
**Blocked by**: POP-002, POP-009

**Description**:
Implement idempotency cache to prevent replay attacks and duplicate processing.

**Acceptance Criteria**:
- [ ] Redis-based idempotency cache
- [ ] Key format: `idempotency:{org_id}:{idempotency_key}`
- [ ] Store: request_hash, response, created_at
- [ ] TTL: 5 minutes (configurable)
- [ ] Behavior:
  - Cache hit + same payload → return cached response
  - Cache hit + different payload → HARD_STOP (replay_suspected)
- [ ] Audit event on replay detection
- [ ] Unit tests

**Reference Docs**:
- `PRD.md` — section 5.4 (Redis Keys)
- `docs/specs/02-popper-specs/01-popper-system-spec.md` — section 3.3 (Idempotency)

---

## Phase 4: Control Plane (v0.4)

**Goal**: Safe-mode and settings management

### POP-012: Safe-Mode Management

**Assignee**: @davron-yuldashev
**Labels**: `phase-4`, `control-plane`, `safe-mode`
**Estimate**: 5 points
**Priority**: P0
**Blocked by**: POP-009, POP-011

**Description**:
Implement safe-mode control plane for global safety override.

**Acceptance Criteria**:
- [ ] SafeModeManager class
- [ ] Redis state store for fast reads
- [ ] PostgreSQL safe_mode_history for audit trail
- [ ] Safe-mode semantics:
  - When enabled: never APPROVE medication proposals
  - Route all high-risk proposals
- [ ] Effective time handling (effective_at, effective_until)
- [ ] Mid-flight consistency: snapshot state at request start
- [ ] POST /v1/popper/control/safe-mode endpoint
- [ ] Include safe_mode state in SupervisionResponse
- [ ] Audit event on state change
- [ ] Unit tests

**Reference Docs**:
- `docs/specs/02-popper-specs/01-popper-system-spec.md` — section 4.2 (Safe-mode)
- `PRD.md` — section 7 (Safe-mode rules in DSL)

---

### POP-013: Operational Settings API

**Assignee**: @davron-yuldashev
**Labels**: `phase-4`, `control-plane`, `settings`
**Estimate**: 3 points
**Priority**: P1
**Blocked by**: POP-012

**Description**:
Implement versioned operational settings management.

**Acceptance Criteria**:
- [ ] SettingsManager class
- [ ] PostgreSQL storage with version history
- [ ] Global vs per-organization settings
- [ ] Settings: staleness overrides, rate limits, policy pack selection
- [ ] POST /v1/popper/control/settings endpoint
- [ ] GET /v1/popper/status includes active settings
- [ ] Audit trail for all changes
- [ ] Unit tests

**Reference Docs**:
- `PRD.md` — section 6.3 (Control Plane Endpoints)
- `docs/specs/02-popper-specs/01-popper-system-spec.md` — section 4

---

## Phase 5: Drift Monitoring (v0.5)

**Goal**: Automated quality monitoring

### POP-014: Drift Counters

**Assignee**: @davron-yuldashev
**Labels**: `phase-5`, `drift`, `redis`
**Estimate**: 3 points
**Priority**: P1
**Blocked by**: POP-010

**Description**:
Implement Redis-based drift signal counters for real-time monitoring.

**Acceptance Criteria**:
- [ ] DriftCounters class
- [ ] Redis counters with sliding window (TTL: 1 hour)
- [ ] Signals: validation_failure_count, hard_stop_count, route_to_clinician_count, high_uncertainty_count, missing_evidence_count, htv_below_threshold_count, request_count
- [ ] Increment on each supervision decision
- [ ] Rate calculation helpers
- [ ] Prometheus metrics export
- [ ] Unit tests

**Reference Docs**:
- `PRD.md` — section 5.4 (Redis Keys), section 8 (Drift Monitoring)
- `docs/specs/02-popper-specs/01-popper-system-spec.md` — section 6 (Drift)

---

### POP-015: Drift Baseline Calculation

**Assignee**: @davron-yuldashev
**Labels**: `phase-5`, `drift`, `timescaledb`
**Estimate**: 3 points
**Priority**: P1
**Blocked by**: POP-014

**Description**:
Implement baseline calculation using continuous aggregates.

**Acceptance Criteria**:
- [ ] BaselineCalculator class
- [ ] Use audit_events_daily continuous aggregate
- [ ] 7-day rolling baselines per signal
- [ ] Store in drift_baselines hypertable
- [ ] Per-organization baselines (after 30-day stabilization)
- [ ] Global baselines as fallback
- [ ] Recalculation triggers: weekly scheduled, manual, after model update
- [ ] Unit tests

**Reference Docs**:
- `PRD.md` — section 5.2 (Continuous Aggregates), section 8.2 (Baseline Calculation)
- `docs/specs/02-popper-specs/01-popper-system-spec.md` — section 6

---

### POP-016: Auto Safe-Mode Triggers

**Assignee**: @davron-yuldashev
**Labels**: `phase-5`, `drift`, `safe-mode`
**Estimate**: 3 points
**Priority**: P1
**Blocked by**: POP-015, POP-012

**Description**:
Implement automatic safe-mode triggers based on drift thresholds.

**Acceptance Criteria**:
- [ ] DriftTriggers class
- [ ] Thresholds: Warning (2x baseline), Critical (5x baseline)
- [ ] Critical triggers auto safe-mode for: validation_failure_rate, hard_stop_rate
- [ ] Create incident record on trigger
- [ ] Configurable trigger rules (YAML)
- [ ] Cooldown period to prevent flapping
- [ ] Unit tests

**Reference Docs**:
- `PRD.md` — section 8.1 (Drift Thresholds table)
- `docs/specs/02-popper-specs/01-popper-system-spec.md` — section 6.2 (Auto triggers)

---

## Phase 6: Multi-Tenant & Auth (v0.6)

**Goal**: Production-ready authentication

### POP-017: API Key Authentication

**Assignee**: @davron-yuldashev
**Labels**: `phase-6`, `auth`, `security`
**Estimate**: 3 points
**Priority**: P0
**Blocked by**: POP-009

**Description**:
Implement API key authentication for multi-tenant access.

**Acceptance Criteria**:
- [ ] Auth middleware
- [ ] X-API-Key header validation
- [ ] API keys: SHA256 hash, key_prefix, organization_id, scopes, rate limits
- [ ] Key generation utility
- [ ] Key revocation support
- [ ] Last used tracking
- [ ] 401 on invalid/revoked key
- [ ] Unit tests

**Reference Docs**:
- `PRD.md` — section 5.3 (api_keys table)
- `docs/specs/02-popper-specs/10-popper-service-architecture.md` — section 5.3

---

### POP-018: Multi-Tenant Organization Management

**Assignee**: @davron-yuldashev
**Labels**: `phase-6`, `multi-tenant`, `security`
**Estimate**: 3 points
**Priority**: P1
**Blocked by**: POP-017

**Description**:
Implement organization-level isolation and configuration.

**Acceptance Criteria**:
- [ ] Organization CRUD (admin only)
- [ ] Per-org config: allowed_modes, rate_limits, default_policy_pack, staleness overrides
- [ ] advocate_clinical requires organization_id
- [ ] Validate caller authorized for org
- [ ] Cross-tenant leakage prevention
- [ ] Scoped audit queries
- [ ] Unit tests

**Reference Docs**:
- `PRD.md` — section 5.3 (organizations table)
- `docs/specs/02-popper-specs/01-popper-system-spec.md` — section 2.5 (Multi-tenant)

---

### POP-019: Rate Limiting

**Assignee**: @davron-yuldashev
**Labels**: `phase-6`, `rate-limiting`, `redis`
**Estimate**: 2 points
**Priority**: P1
**Blocked by**: POP-017

**Description**:
Implement per-tenant rate limiting using Redis.

**Acceptance Criteria**:
- [ ] Rate limit middleware
- [ ] Redis counters per minute/hour
- [ ] Default limits from organizations table
- [ ] Per-API-key overrides
- [ ] Response headers (X-RateLimit-*)
- [ ] 429 on limit exceeded
- [ ] Unit tests

**Reference Docs**:
- `PRD.md` — section 5.4 (Redis rate limiting keys)
- `docs/specs/02-popper-specs/10-popper-service-architecture.md` — section 5.2

---

## Phase 7: Ops Dashboard (v0.7)

**Goal**: Web UI for operations

### POP-020: Ops Dashboard - Status View

**Assignee**: @harsh-manwani
**Labels**: `phase-7`, `dashboard`, `frontend`
**Estimate**: 5 points
**Priority**: P2
**Blocked by**: POP-013

**Description**:
Create web dashboard for Popper operational status monitoring.

**Acceptance Criteria**:
- [ ] Web app (Next.js)
- [ ] Service status: health, version, uptime
- [ ] Safe-mode status (global + per-org)
- [ ] Active policy packs
- [ ] Drift signals visualization
- [ ] Real-time updates
- [ ] Authentication

**Reference Docs**:
- `PRD.md` — section 6.3 (StatusResponse)
- `docs/specs/02-popper-specs/01-popper-system-spec.md` — system status

---

### POP-021: Ops Dashboard - Audit Log Viewer

**Assignee**: @harsh-manwani
**Labels**: `phase-7`, `dashboard`, `audit`
**Estimate**: 5 points
**Priority**: P2
**Blocked by**: POP-020

**Description**:
Create audit log viewer for searching and filtering supervision decisions.

**Acceptance Criteria**:
- [ ] Audit log list with pagination
- [ ] Filters: trace_id, organization, event_type, decision, date range, reason_codes
- [ ] Detail view for single event
- [ ] Export to JSON/CSV
- [ ] Time-series chart

**Reference Docs**:
- `PRD.md` — section 5.2 (audit_events hypertable)
- `docs/specs/02-popper-specs/04-popper-regulatory-export-and-triage.md`

---

### POP-022: Ops Dashboard - Safe-Mode Controls

**Assignee**: @harsh-manwani
**Labels**: `phase-7`, `dashboard`, `safe-mode`
**Estimate**: 3 points
**Priority**: P2
**Blocked by**: POP-020

**Description**:
Create UI for managing safe-mode state.

**Acceptance Criteria**:
- [ ] Safe-mode toggle (global + per-org)
- [ ] Reason input (required)
- [ ] Duration selector
- [ ] History view
- [ ] Confirmation dialog

**Reference Docs**:
- `PRD.md` — section 6.3 (SetSafeModeRequest)
- `docs/specs/02-popper-specs/01-popper-system-spec.md` — section 4.2

---

## Phase 8: Regulatory Export (v0.8)

**Goal**: FDA/regulatory compliance support

### POP-023: Export Bundle Generator

**Assignee**: @davron-yuldashev
**Labels**: `phase-8`, `export`, `regulatory`
**Estimate**: 5 points
**Priority**: P1
**Blocked by**: POP-010

**Description**:
Implement de-identified export bundle generation for regulatory review.

**Acceptance Criteria**:
- [ ] ExportBundleGenerator class
- [ ] Bundle: AuditEvents, audit_redaction, policy versions, decision summary
- [ ] De-identification: hash subject_id, apply redaction rules
- [ ] Output: JSON, gzip compressed
- [ ] POST /v1/popper/export endpoint
- [ ] Store in Minio
- [ ] Unit tests

**Reference Docs**:
- `PRD.md` — section 5.5 (Minio Buckets)
- `docs/specs/02-popper-specs/04-popper-regulatory-export-and-triage.md` — export specs
- `docs/specs/02-popper-specs/01-popper-system-spec.md` — section 7 (Audit)

---

### POP-024: Incident Management

**Assignee**: @davron-yuldashev
**Labels**: `phase-8`, `incidents`, `regulatory`
**Estimate**: 3 points
**Priority**: P1
**Blocked by**: POP-023, POP-016

**Description**:
Implement incident tracking for hard-stop analysis and safety events.

**Acceptance Criteria**:
- [ ] Incident creation on drift breach, manual safe-mode, critical failures
- [ ] Status workflow: open → investigating → resolved
- [ ] Auto-generate export bundle
- [ ] Incident API: list, detail, update status
- [ ] Unit tests

**Reference Docs**:
- `PRD.md` — section 5.3 (incidents table)
- `docs/specs/02-popper-specs/01-popper-system-spec.md` — section 6.2 (Incidents)
- `docs/specs/02-popper-specs/04-popper-regulatory-export-and-triage.md`

---

## Summary

| Phase | Tasks | Points | Assignee | Dependencies |
|-------|-------|--------|----------|--------------|
| **Phase 1** | POP-001, 002, 003 | 10 | Davron | - |
| **Phase 2** | POP-004, 005, 006, 007, 008 | 18 | Davron | Phase 1 |
| **Phase 3** | POP-009, 010, 011 | 11 | Davron | Phase 2 |
| **Phase 4** | POP-012, 013 | 8 | Davron | Phase 3 |
| **Phase 5** | POP-014, 015, 016 | 9 | Davron | Phase 4 |
| **Phase 6** | POP-017, 018, 019 | 8 | Davron | Phase 3 |
| **Phase 7** | POP-020, 021, 022 | 13 | Harsh | Phase 4 |
| **Phase 8** | POP-023, 024 | 8 | Davron | Phase 3, 5 |

**Total**: 24 tasks, 85 points

---

## Milestones

| Milestone | Tasks | Goal |
|-----------|-------|------|
| **v0.1 - Foundation** | POP-001..003 | Infrastructure ready |
| **v0.2 - Core Engine** | POP-004..008 | Policy engine working |
| **v0.3 - MVP** | POP-009..011 | Supervision API working |
| **v0.4 - Control Plane** | POP-012..013 | Safe-mode ready |
| **v0.5 - Monitoring** | POP-014..016 | Drift detection |
| **v0.6 - Production** | POP-017..019 | Multi-tenant auth |
| **v0.7 - Dashboard** | POP-020..022 | Ops UI |
| **v0.8 - Compliance** | POP-023..024 | Regulatory export |

---

*Generated: 2026-01-25*
