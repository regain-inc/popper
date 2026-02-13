---
version: 2.0.0
last-updated: 2026-02-13
status: implemented
owner: Popper Dev Team
tags: [advocate, popper, push, delivery, transport, ta2, reliability]
depends-on:
  - "@regain/hermes (v2.0.0) — ControlCommandV2, ControlCommandResponse types"
  - 02-popper-contracts-and-interfaces.md
implementation:
  packages:
    - packages/core/src/push-delivery/http-client.ts
    - packages/core/src/push-delivery/circuit-breaker.ts
    - packages/core/src/push-delivery/dead-letter-queue.ts
    - packages/core/src/push-delivery/delivery-manager.ts
    - packages/core/src/push-delivery/target-config.ts
    - apps/server/src/plugins/dead-letters.ts
    - apps/server/src/plugins/push-metrics.ts
  db-schemas:
    - packages/db/src/schema/dead-letters.ts
    - packages/db/drizzle/0011_popper_control_v2.sql
  tests: "92 test cases across 7 files"
---

# Popper Push Delivery Spec

> **Implementation Status**: Fully implemented. All delivery guarantees, circuit breaker, DLQ, retry strategy, and observability verified GREEN.
> See `packages/core/src/push-delivery/` and `apps/server/src/plugins/`.

## 0) Purpose

In Hermes v1, control commands are delivered exclusively via `SupervisionResponse.control_commands` — they piggyback on supervision responses. This means Popper can only send control commands **during an active supervision cycle**, and there is no way to push commands to Deutsch out-of-band.

This is inadequate for the ISO requirement because:
1. Trend-based reconfiguration decisions (from the Control Decision Engine) may occur between supervision cycles.
2. `URGENT` and `EMERGENCY` commands cannot wait for the next supervision request.
3. Manual operator commands (clinician safety-ops) need immediate delivery.
4. Startup reconciliation requires sending commands without a supervision context.

This spec defines the **Push Delivery** infrastructure for sending `ControlCommandV2` messages from Popper to Deutsch via a dedicated HTTP channel.

---

## 1) Transport Selection Rationale

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| **HTTP POST** | Simple, matches request-response ACK pattern, stateless, existing infra | Requires Deutsch to expose endpoint | **Selected** |
| SSE (Server-Sent Events) | Persistent connection, low latency | One-directional (no ACK), connection management complexity | Rejected |
| WebSocket | Bidirectional, low latency | Connection lifecycle management, harder to load-balance, overkill for command frequency | Rejected |
| Message queue (NATS, RabbitMQ) | Decoupled, persistent, at-least-once | Additional infrastructure dependency, increased ops burden | Deferred to v3 |

HTTP POST was selected because:
- Control commands are **low-frequency** (typically < 1/minute, burst < 10/minute during incidents).
- The ACK/NACK protocol naturally maps to HTTP request/response.
- No additional infrastructure beyond the Deutsch HTTP server.
- Simpler failure semantics (HTTP status codes + response body).

---

## 2) Endpoint Contract

### 2.1 Deutsch Control Endpoint

Deutsch MUST expose:

```
POST /v1/deutsch/control
```

**Request**: `ControlCommandV2` (JSON body)

**Response**: `ControlCommandResponse` (JSON body)

**HTTP Status Codes**:

| Status | Meaning |
|--------|---------|
| `200 OK` | Command processed (check `ControlCommandResponse.status` for result) |
| `400 Bad Request` | Malformed request (schema validation failure before processing) |
| `401 Unauthorized` | Authentication failure |
| `403 Forbidden` | Authenticated but not authorized for this organization/instance |
| `409 Conflict` | Idempotency key collision with different command content |
| `429 Too Many Requests` | Rate limited (include `Retry-After` header) |
| `500 Internal Server Error` | Unexpected failure |
| `503 Service Unavailable` | Deutsch temporarily unable to process (include `Retry-After`) |

**Note**: `APPLIED`, `REJECTED`, and `DEFERRED` statuses are all returned as `200 OK` — the distinction is in the response body, not the HTTP status.

### 2.2 Request Headers

```
Content-Type: application/json
X-Hermes-Version: 2.0.0
X-Command-Priority: URGENT          // Allows receivers to prioritize before parsing body
X-Idempotency-Key: 01JQXK3M7N...   // Duplicate of body field for fast dedup
```

### 2.3 Response Headers

```
Content-Type: application/json
X-Processing-Time-Ms: 18            // Command processing time for latency tracking
```

> **Impl**: `ControlHttpClient` in `packages/core/src/push-delivery/http-client.ts` sends all required headers. Supports both `api_key` and `mtls` authentication. 20 tests.

---

## 3) Authentication, Authorization & Certificate Lifecycle

### 3.1 mTLS (Required)

All push delivery connections MUST use mutual TLS:
- Popper presents a client certificate identifying itself as a known Supervisory agent.
- Deutsch validates the client certificate against its trust store.
- Certificates are issued per-deployment, scoped to TA3 organization.

### 3.2 Certificate Lifecycle

| Event | Procedure |
|-------|-----------|
| **Issuance** | Certificates issued by the TA3 org's PKI (or ADVOCATE program CA for Phase 1). Each Popper instance receives a unique client cert with `CN=popper-{org_id}-{instance_id}` and `O={ta3_org}`. |
| **Rotation** | Certificates MUST be rotated at least every 90 days. During rotation, both old and new certificates are valid for a 7-day overlap window. |
| **Revocation** | Compromised certificates are revoked via CRL or OCSP. Deutsch MUST check revocation status on every TLS handshake. |
| **Break-glass** | If Popper's certificate is compromised: safety-ops can invoke Deutsch's control endpoint directly using a pre-provisioned break-glass certificate. Usage triggers P0 alert + mandatory post-incident review. |

### 3.3 RBAC Roles

| Role | Identity Source | Authorized Actions |
|------|----------------|-------------------|
| **Popper (system)** | mTLS client cert CN | `SET_OPERATIONAL_SETTINGS` (any priority), `SET_SAFE_MODE`, `SET_OPERATIONAL_MODE` (to more conservative modes only), `GET_OPERATIONAL_STATE` |
| **Clinician** | `operator_id` validated against TA3 IdP | All Popper actions + `SET_OPERATIONAL_MODE` (to any mode, including less conservative) |
| **Admin / Safety-Ops** | `operator_id` with admin role in TA3 IdP | All clinician actions + `MAINTENANCE` mode transitions, break-glass cert usage, dead-letter queue retry |

---

## 4) Endpoint Discovery

### 4.1 Static Configuration (v2)

Deutsch control endpoints are configured statically in Popper's deployment configuration:

```yaml
control_targets:
  - instance_id: "deutsch-uihealth-01"
    organization_id: "org_ta3_uihealth"
    control_endpoint: "https://deutsch-uihealth.internal:8443/v1/deutsch/control"
    mtls:
      client_cert: "/etc/popper/certs/popper-uihealth.pem"
      client_key: "/etc/popper/certs/popper-uihealth.key"
      ca_cert: "/etc/popper/certs/ta3-uihealth-ca.pem"
```

> **Impl**: `loadTargetsFromEnv()` and `loadTargetsFromYaml()` in `packages/core/src/push-delivery/target-config.ts`. Env vars: `DEUTSCH_CONTROL_ENDPOINT`, `DEUTSCH_INSTANCE_ID`, `DEUTSCH_ORGANIZATION_ID`, `POPPER_PUSH_API_KEY`. 14 tests.

### 4.2 Service Registry (v3, future)

In v3, endpoint discovery MAY use a Hermes service registry with health-checked endpoints and automatic failover.

---

## 5) Delivery Guarantees

### 5.1 At-Least-Once Delivery

Push delivery provides **at-least-once** semantics:
- Every command includes an `idempotency_key`.
- Popper retries on failure (see §5.3).
- Deutsch deduplicates by `idempotency_key` (cache TTL: 24 hours).
- Duplicate deliveries receive the cached `ControlCommandResponse`.

### 5.2 Ordering

Commands are delivered in **send order** but due to retries, they may arrive out of order. Deutsch MUST handle this using the `command_id` field, which is a ULID (monotonically increasing, embeds timestamp):
- For conflicting settings (same key), Deutsch applies the command with the **lexicographically greater `command_id`**.

**Single-writer-per-target constraint**: In HA deployments with multiple Popper replicas, each Deutsch target MUST be assigned to exactly one Popper writer at any given time.

### 5.3 Retry Strategy

| Failure Type | Retry Strategy |
|-------------|---------------|
| Network error / timeout | Retry with exponential backoff: 100ms, 500ms, 2s, 8s, 30s (5 retries max) |
| `429 Too Many Requests` | Respect `Retry-After` header |
| `503 Service Unavailable` | Respect `Retry-After` header; if absent, same as network error |
| `500 Internal Server Error` | Retry once after 1s; if still 500, log and escalate |
| `400 Bad Request` | Do NOT retry (command is malformed, fix and re-issue) |
| `401/403` | Do NOT retry (auth issue, requires operator intervention) |
| `409 Conflict` | Do NOT retry (idempotency key conflict, investigate) |

> **Impl**: `DeliveryManager.sendWithRetry()` in `packages/core/src/push-delivery/delivery-manager.ts`. Default backoff intervals: `[100, 500, 2000, 8000, 30000]`. HTTP client distinguishes retryable (429, 500, 503, network) from non-retryable (400, 401, 403, 409). 16 tests.

### 5.4 Circuit Breaker

Popper MUST implement a circuit breaker for each Deutsch endpoint:

| State | Behavior |
|-------|----------|
| **CLOSED** (normal) | Commands sent normally |
| **OPEN** (tripped) | Commands queued in dead-letter buffer; no HTTP calls for `recovery_timeout` |
| **HALF-OPEN** | Next command sent as probe; if successful, transition to CLOSED |

Trip condition: 5 consecutive failures or >50% failure rate in 30-second window.

Recovery timeout: 30 seconds (configurable per deployment).

When circuit breaker is OPEN:
- `EMERGENCY` commands bypass the circuit breaker and attempt delivery anyway.
- Queued commands are replayed when circuit closes (in `created_at` order).
- If queue exceeds 100 commands, oldest `ROUTINE` commands are dropped (logged as `CONTROL_COMMAND_DROPPED`).

> **Impl**: `CircuitBreaker` class in `packages/core/src/push-delivery/circuit-breaker.ts`. States: CLOSED/OPEN/HALF_OPEN. Trip conditions: consecutive >= 5 OR failure rate > 50% (min 5 samples). EMERGENCY bypass. Max 100 queue with ROUTINE pruning. 29 tests.

---

## 6) Dead-Letter Queue

Commands that fail delivery after all retries are moved to a dead-letter queue (PostgreSQL table: `popper_control_dead_letters`):

```sql
CREATE TABLE popper_control_dead_letters (
  id SERIAL PRIMARY KEY,
  command_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  target_instance_id TEXT NOT NULL,
  priority TEXT NOT NULL,
  command_payload JSONB NOT NULL,
  failure_reason TEXT NOT NULL,
  retry_count INTEGER NOT NULL,
  last_attempt_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Dead-letter queue entries:
- Are reviewed by safety-ops (via Popper ops dashboard).
- Can be manually retried via `POST /v2/popper/control/dead-letters/{id}/retry`.
- `EMERGENCY` dead-letter entries trigger immediate safety-ops alerts (P0).

> **Impl**: `DeadLetterQueue` class in `packages/core/src/push-delivery/dead-letter-queue.ts` (PostgreSQL-backed, P0 EMERGENCY_DELIVERY_FAILURE alerts). DLQ API plugin in `apps/server/src/plugins/dead-letters.ts` with GET list + POST retry. 20 tests total.

---

## 7) Latency Budget

All timing is **sender-observed round-trip** (command sent → response received).

| Phase | Budget | Notes |
|-------|--------|-------|
| Command generation | 5ms | In-memory, from DSL/policy evaluation |
| TLS handshake | 0ms | Amortized via persistent connections |
| Network transit (Popper → Deutsch) | 5ms | Same datacenter / VPC |
| Deutsch processing | 40ms | Validation + state persistence + ACK generation |
| Network transit (Deutsch → Popper) | 5ms | Return path |
| **Total round-trip** | **55ms** | Well within 100ms EMERGENCY budget |
| **Headroom** | **45ms** | Absorbs GC pauses, network jitter, retransmits |

The 100ms EMERGENCY budget is the hard deadline. The 55ms estimate is the typical-case target, leaving 45ms headroom.

> **Impl**: Priority-based timeouts in `ControlHttpClient`: EMERGENCY=100ms, URGENT=500ms, ROUTINE=2000ms.

---

## 8) Monitoring & Observability

Push delivery exposes the following metrics:

| Metric | Type | Description |
|--------|------|-------------|
| `popper_control_commands_sent_total` | Counter | Total commands sent, labeled by priority and target |
| `popper_control_commands_acked_total` | Counter | Total commands acknowledged, labeled by status |
| `popper_control_delivery_latency_ms` | Histogram | Round-trip delivery time |
| `popper_control_retries_total` | Counter | Total retry attempts |
| `popper_control_circuit_breaker_state` | Gauge | Current circuit breaker state per target (0=closed, 1=half-open, 2=open) |
| `popper_control_dead_letter_depth` | Gauge | Number of commands in dead-letter queue |

Alerts:
- Circuit breaker OPEN for any target → P1 alert to safety-ops.
- Dead-letter queue depth > 10 → P2 alert.
- `EMERGENCY` command delivery failure → P0 alert (immediate page).

> **Impl**: `apps/server/src/plugins/push-metrics.ts` exposes all 6 metrics in both Prometheus text and JSON format. 12 tests.

---

## 9) Implementation Inventory

| Component | Location | Tests |
|-----------|----------|-------|
| HTTP Client | `packages/core/src/push-delivery/http-client.ts` | 20 |
| Circuit Breaker | `packages/core/src/push-delivery/circuit-breaker.ts` | 29 |
| Dead-Letter Queue | `packages/core/src/push-delivery/dead-letter-queue.ts` | 13 |
| Delivery Manager | `packages/core/src/push-delivery/delivery-manager.ts` | 16 |
| Target Config | `packages/core/src/push-delivery/target-config.ts` | 14 |
| DLQ API Plugin | `apps/server/src/plugins/dead-letters.ts` | 7 |
| Metrics Plugin | `apps/server/src/plugins/push-metrics.ts` | 12 |
| DB Schema | `packages/db/src/schema/dead-letters.ts` | — |

---

#push #delivery #transport #popper #reliability #ta2
