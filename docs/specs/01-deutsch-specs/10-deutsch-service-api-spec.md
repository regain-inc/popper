---
version: 1.0.0
last-updated: 2026-01-25
status: draft
owner: Deutsch Dev Team
tags: [advocate, ta1, deutsch, api, service, saas]
---

# Deutsch Service API Specification — v1

## 0) Executive Summary

This document specifies the HTTP API for **Deutsch Service** — the primary deployment model for Deutsch (TA1). Deutsch Service is a centralized SaaS platform that provides clinical reasoning capabilities via a RESTful API with streaming support.

**Key design decisions:**

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **Deployment** | Centralized SaaS | Monetization, consistency, observability, compliance |
| **Session model** | Stateful (server-side) | Smaller payloads, context management, analytics |
| **Response style** | Streaming (SSE) | Progressive UX during ArgMed debate (2-5 sec) |
| **Snapshot access** | Hybrid (ref or inline) | Flexibility for different PHI architectures |
| **D↔P communication** | Deutsch calls Popper | Single API surface for clients |

## 1) API Overview

### 1.1 Base URL

```
Production:  https://api.deutsch.health/v1
Staging:     https://staging.api.deutsch.health/v1
```

### 1.2 Authentication

All API requests require authentication:

| Method | Header | Use Case |
|--------|--------|----------|
| **API Key** | `X-API-Key: dk_live_...` | Server-to-server integration |
| **OAuth 2.0** | `Authorization: Bearer <token>` | User-context requests |

API keys are tenant-scoped and support:
- Read/write permissions
- Rate limit tiers
- IP allowlisting (optional)

### 1.3 Content Types

```
Request:   Content-Type: application/json
Response:  Content-Type: application/json (sync)
           Content-Type: text/event-stream (streaming)
```

## 2) Session Management

### 2.1 Create Session

Creates a new reasoning session for a patient.

```http
POST /sessions
```

**Request Body:**

```typescript
interface CreateSessionRequest {
  // Required
  patient_ref: string;              // Pseudonymous patient ID (NOT PII)
  mode: "wellness" | "advocate_clinical";
  domains: string[];                // Domain modules to load, e.g., ["cardiology", "nutrition"]

  // Snapshot (one of these SHOULD be provided)
  snapshot_ref?: string;            // "phi://snapshots/{id}" — Deutsch will fetch
  snapshot_payload?: HealthStateSnapshot;  // Inline snapshot (≤1MB)

  // Configuration
  config?: {
    streaming?: boolean;            // Default: true
    webhook_url?: string;           // Callback URL for async results
    session_ttl_minutes?: number;   // Default: 30, max: 1440 (24h)
  };
}
```

**Response (201 Created):**

```typescript
interface CreateSessionResponse {
  session_id: string;               // UUID
  expires_at: string;               // ISO 8601 timestamp
  domains_loaded: Array<{
    domain_id: string;
    version: string;
    status: "success" | "degraded" | "failed";
    failure_reason?: string;
  }>;
  snapshot_status: {
    source: "ref" | "inline" | "none";
    created_at?: string;
    staleness_warning?: boolean;
  };
}
```

**Example:**

```bash
curl -X POST https://api.deutsch.health/v1/sessions \
  -H "X-API-Key: dk_live_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_ref": "patient_anon_12345",
    "mode": "wellness",
    "domains": ["cardiology", "nutrition"],
    "snapshot_ref": "phi://snapshots/snap_98765"
  }'
```

### 2.2 Get Session

Retrieves session state and metadata.

```http
GET /sessions/{session_id}
```

**Response (200 OK):**

```typescript
interface GetSessionResponse {
  session_id: string;
  patient_ref: string;
  mode: "wellness" | "advocate_clinical";
  domains: Array<{
    domain_id: string;
    version: string;
    status: "success" | "degraded" | "failed";
  }>;
  message_count: number;
  created_at: string;
  expires_at: string;
  last_activity: string;
  config: {
    streaming: boolean;
    webhook_url?: string;
  };
}
```

### 2.3 Delete Session

Explicitly closes a session and releases resources.

```http
DELETE /sessions/{session_id}
```

**Response (204 No Content)**

Note: Audit data is preserved; only session state is released.

## 3) Messaging API

### 3.1 Send Message

Sends a message and receives clinical reasoning response.

```http
POST /sessions/{session_id}/messages
```

**Request Body:**

```typescript
interface SendMessageRequest {
  content: string;                  // User message text
  attachments?: Array<{
    type: "voice" | "image" | "file";
    data: string;                   // Base64 encoded
    mime_type: string;
  }>;
  snapshot_refresh?: boolean;       // Re-fetch snapshot before reasoning
}
```

**Response (200 OK, streaming=false):**

```typescript
interface SendMessageResponse {
  message_id: string;
  response: string;                 // Patient-facing text
  ui_instructions: UIInstruction[];
  supervision_result: {
    outcome: "APPROVED" | "HARD_STOP" | "ROUTE_TO_CLINICIAN" | "REQUEST_MORE_INFO";
    trace_id: string;
    reason_code?: string;
    reason_text?: string;
  };
  disclosure: DisclosureBundle;
  contributing_domains: Array<{
    domain_id: string;
    status: "success" | "degraded" | "failed";
  }>;
  cross_domain_conflicts?: CrossDomainConflict[];
}
```

**Response (200 OK, streaming=true):**

Server-Sent Events stream:

```
event: status
data: {"phase": "understanding", "message": "Processing your message..."}

event: status
data: {"phase": "reasoning", "message": "Analyzing health data..."}

event: status
data: {"phase": "debating", "message": "Evaluating options..."}

event: partial
data: {"content": "Based on your recent"}

event: partial
data: {"content": " weight measurements, I notice"}

event: status
data: {"phase": "supervising", "message": "Checking safety..."}

event: supervision
data: {"status": "approved", "trace_id": "tr_abc123"}

event: conflict
data: {"conflict_type": "drug_nutrient_interaction", "domains": ["cardiology", "nutrition"], "resolution": "constrain"}

event: complete
data: {"message_id": "msg_xyz", "response": "Based on your recent weight measurements...", "ui_instructions": [...], "disclosure": {...}}
```

### 3.2 Streaming Event Types

| Event | Description | Data Fields |
|-------|-------------|-------------|
| `status` | Phase transition | `phase`, `message` |
| `partial` | Incremental response text | `content` |
| `supervision` | Popper decision received | `status`, `trace_id` |
| `conflict` | Cross-domain conflict detected | `conflict_type`, `domains`, `resolution` |
| `complete` | Final response ready | Full `SendMessageResponse` |
| `error` | Error occurred | `code`, `message`, `retriable` |

### 3.3 Phases

| Phase | Description | Typical Duration |
|-------|-------------|------------------|
| `understanding` | Parsing message, extracting intent | 100-300ms |
| `reasoning` | Loading context, preparing hypotheses | 200-500ms |
| `debating` | ArgMed conjecture-refutation loop | 1-4 sec |
| `supervising` | Popper supervision request | 50-200ms |
| `responding` | Generating patient-friendly output | 200-500ms |

## 4) Audit & Tracing

### 4.1 Get Session Trace

Retrieves full audit trail for a session.

```http
GET /sessions/{session_id}/trace
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `from` | ISO 8601 | Start timestamp (optional) |
| `to` | ISO 8601 | End timestamp (optional) |
| `event_types` | string[] | Filter by event type (optional) |

**Response (200 OK):**

```typescript
interface SessionTraceResponse {
  session_id: string;
  trace_id: string;
  events: AuditEvent[];             // Hermes audit format
  summary: {
    total_events: number;
    supervision_requests: number;
    outcomes: {
      approved: number;
      hard_stop: number;
      routed: number;
    };
  };
}
```

## 5) Health & Metrics

### 5.1 Health Check

```http
GET /health
```

**Response (200 OK):**

```typescript
interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  version: string;
  components: {
    popper: { status: string; latency_ms: number };
    phi_service: { status: string; latency_ms: number };
    database: { status: string };
    cache: { status: string };
  };
}
```

### 5.2 Metrics

```http
GET /metrics
```

Returns Prometheus-format metrics:

```
# HELP deutsch_sessions_active Number of active sessions
# TYPE deutsch_sessions_active gauge
deutsch_sessions_active{tenant="acme"} 42

# HELP deutsch_messages_total Total messages processed
# TYPE deutsch_messages_total counter
deutsch_messages_total{tenant="acme",outcome="approved"} 1234

# HELP deutsch_supervision_latency_seconds Popper supervision latency
# TYPE deutsch_supervision_latency_seconds histogram
deutsch_supervision_latency_seconds_bucket{le="0.05"} 890
deutsch_supervision_latency_seconds_bucket{le="0.1"} 950
```

## 6) Error Handling

### 6.1 Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string;                   // Machine-readable code
    message: string;                // Human-readable message
    details?: Record<string, any>;  // Additional context
    trace_id?: string;              // For support reference
    retriable: boolean;             // Whether client should retry
  };
}
```

### 6.2 Error Codes

| HTTP Status | Code | Description | Retriable |
|-------------|------|-------------|-----------|
| 400 | `invalid_request` | Malformed request body | No |
| 400 | `invalid_snapshot` | Snapshot validation failed | No |
| 401 | `unauthorized` | Missing or invalid credentials | No |
| 403 | `forbidden` | Insufficient permissions | No |
| 404 | `session_not_found` | Session does not exist | No |
| 404 | `session_expired` | Session TTL exceeded | No |
| 409 | `session_conflict` | Concurrent modification | Yes |
| 422 | `domain_unavailable` | Required domain failed to load | No |
| 429 | `rate_limited` | Too many requests | Yes |
| 500 | `internal_error` | Server error | Yes |
| 502 | `popper_unavailable` | Popper service unreachable | Yes |
| 503 | `service_unavailable` | Deutsch service overloaded | Yes |
| 504 | `supervision_timeout` | Popper response timeout | Yes |

### 6.3 Rate Limiting

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1706189460
Retry-After: 30  # Only on 429 responses
```

## 7) Snapshot Access Patterns

### 7.1 Pattern A: Reference (Deutsch Fetches)

Client provides `snapshot_ref`, Deutsch fetches from phi-service.

```json
{
  "patient_ref": "patient_anon_123",
  "mode": "wellness",
  "domains": ["cardiology"],
  "snapshot_ref": "phi://snapshots/snap_456"
}
```

**Requirements:**
- Deutsch Service must have read access to phi-service
- Tenant credentials must authorize access to the patient's snapshot
- Fetch timeout: 50ms (fail-safe if exceeded)

### 7.2 Pattern B: Inline (Client Provides)

Client provides full snapshot in request.

```json
{
  "patient_ref": "patient_anon_123",
  "mode": "wellness",
  "domains": ["cardiology"],
  "snapshot_payload": {
    "snapshot_id": "snap_456",
    "created_at": "2026-01-25T10:00:00Z",
    "conditions": [...],
    "medications": [...],
    "vitals": [...]
  }
}
```

**Requirements:**
- Snapshot must be ≤1MB
- Snapshot must pass Hermes validation
- Client is responsible for snapshot freshness

### 7.3 Pattern C: Hybrid (Base + Delta)

Client provides both for optimization: base snapshot from cache + real-time delta.

```json
{
  "patient_ref": "patient_anon_123",
  "mode": "wellness",
  "domains": ["cardiology"],
  "snapshot_ref": "phi://snapshots/snap_456",
  "snapshot_payload": {
    "delta": true,
    "vitals": [{"type": "weight", "value": 185, "timestamp": "2026-01-25T09:30:00Z"}]
  }
}
```

## 8) Multi-Tenancy

### 8.1 Tenant Isolation

| Resource | Isolation Level |
|----------|-----------------|
| Sessions | Tenant-scoped (no cross-tenant access) |
| Audit logs | Tenant-scoped |
| Rate limits | Per-tenant quotas |
| API keys | Tenant-specific |
| Metrics | Tenant-labeled |

### 8.2 Tenant Configuration

Tenants can configure:

```yaml
tenant_config:
  id: "acme_health"

  # Rate limits
  rate_limits:
    sessions_per_minute: 100
    messages_per_minute: 1000

  # Session defaults
  session_defaults:
    ttl_minutes: 30
    streaming: true

  # Domain access
  allowed_domains:
    - cardiology
    - nutrition
    - exercise

  # Mode restrictions
  allowed_modes:
    - wellness
    # advocate_clinical requires additional contract

  # Security
  ip_allowlist:
    - "10.0.0.0/8"
  require_mtls: false
```

## 9) Pricing Models

### 9.1 Usage-Based Pricing

| Metric | Unit | Description |
|--------|------|-------------|
| **Sessions** | Per session created | Covers session lifecycle |
| **Messages** | Per message processed | Main consumption metric |
| **Supervision** | Per Popper call | High-risk action checks |
| **Compute time** | Per second of reasoning | ArgMed debate duration |

### 9.2 Subscription Tiers

| Tier | Sessions/mo | Messages/mo | Support |
|------|-------------|-------------|---------|
| **Starter** | 1,000 | 10,000 | Email |
| **Growth** | 10,000 | 100,000 | Chat |
| **Enterprise** | Unlimited | Unlimited | Dedicated |

### 9.3 Enterprise Add-ons

- Dedicated infrastructure (single-tenant)
- Custom SLAs (99.9%+)
- On-prem deployment option
- HIPAA BAA
- SOC 2 Type II attestation
- Custom domain support

## 10) Security Requirements

### 10.1 Transport Security

| Requirement | Implementation |
|-------------|----------------|
| TLS version | 1.3 required, 1.2 accepted |
| Cipher suites | AEAD only (AES-GCM, ChaCha20-Poly1305) |
| Certificate | Let's Encrypt / DigiCert |
| HSTS | Enabled, max-age=31536000 |

### 10.2 Data Security

| Data Type | Handling |
|-----------|----------|
| PHI in transit | Encrypted, never logged in full |
| PHI at rest | Not stored (stateless reasoning) |
| Session state | Encrypted, TTL-bounded |
| Audit logs | Encrypted, PHI-redacted |

### 10.3 Compliance

| Standard | Status |
|----------|--------|
| HIPAA | BAA available |
| SOC 2 Type II | In progress |
| HITRUST | Planned |
| GDPR | Compliant (EU region available) |

## 11) SDK Support

### 11.1 Official SDKs

| Language | Package | Status |
|----------|---------|--------|
| TypeScript | `@regain/deutsch-client` | Available |
| Python | `regain-deutsch` | Planned |
| Go | `github.com/regain-health/deutsch-go` | Planned |

### 11.2 TypeScript SDK Example

```typescript
import { DeutschClient } from '@regain/deutsch-client';

const client = new DeutschClient({
  apiKey: process.env.DEUTSCH_API_KEY,
});

// Create session
const session = await client.sessions.create({
  patientRef: 'patient_anon_123',
  mode: 'wellness',
  domains: ['cardiology', 'nutrition'],
  snapshotRef: 'phi://snapshots/snap_456',
});

// Send message with streaming
const stream = await client.messages.send(session.sessionId, {
  content: 'I gained 3 pounds this week and my ankles are swollen',
});

for await (const event of stream) {
  switch (event.type) {
    case 'status':
      console.log(`Phase: ${event.data.phase}`);
      break;
    case 'partial':
      process.stdout.write(event.data.content);
      break;
    case 'complete':
      console.log('\n\nFinal response:', event.data.response);
      break;
  }
}

// Close session
await client.sessions.delete(session.sessionId);
```

## 12) Appendix: OpenAPI Specification

Full OpenAPI 3.1 specification available at:
- **Production**: https://api.deutsch.health/v1/openapi.json
- **Docs**: https://docs.deutsch.health/api

## References

- [00-deutsch-popper-hermes-architecture.md](../00-overall-specs/00-deutsch-popper-hermes-architecture.md) — System architecture
- [02-hermes-contracts.md](../03-hermes-specs/02-hermes-contracts.md) — Hermes type definitions
- [04-multi-domain-composition-spec.md](./04-multi-domain-composition-spec.md) — Multi-domain composition
- [07-deutsch-argmed-debate.md](./07-deutsch-argmed-debate.md) — ArgMed reasoning engine
