# Popper Ops Dashboard — Spec for Harsh

> **This is a self-contained spec.** You do NOT need to read other Popper or Hermes specs.

---

## 1) What You Need to Know (30 seconds)

**Popper** is a safety supervisor service. When our AI (Deutsch) wants to give health advice to a patient, it asks Popper "is this safe?" Popper responds with APPROVED, HARD_STOP, or ROUTE_TO_CLINICIAN.

**Safe-Mode** is an emergency brake. When enabled, Popper becomes extra cautious — it routes more decisions to human clinicians instead of approving them automatically. Ops can enable safe-mode manually, or it triggers automatically when something looks wrong (drift).

**Audit Events** are logs of every decision Popper makes. They're used for compliance, debugging, and monitoring. Each event has a `trace_id` that links it to a specific patient interaction.

**That's it.** You don't need to understand HOW Popper makes decisions — just that it does, and the dashboard shows what's happening.

---

## 1.5) Who This Dashboard Is For

**This dashboard is for the internal Safety Ops team, NOT for doctors or clinicians.**

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              POPPER SERVICE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   When Popper decides "ROUTE_TO_CLINICIAN":                                 │
│                                                                              │
│   ┌──────────────────┐         ┌──────────────────────────────┐             │
│   │ Popper Engine    │────────▶│ MISS         │             │
│   │                  │  FHIR   │                              │             │
│   │ "This medication │  Alert  │ Doctor sees:                 │             │
│   │  needs review"   │         │ "Patient X needs your review │             │
│   └──────────────────┘         │  - medication proposal"      │             │
│                                └──────────────────────────────┘             │
│                                         ↑                                    │
│                                    Doctors/Clinicians                        │
│                                                                              │
│   ┌──────────────────┐                                                      │
│   │ Popper Ops       │◀──── Safety Ops team (internal)                      │
│   │ Dashboard        │      "Is Popper working correctly?"                  │
│   │ (THIS PROJECT)   │      "Any drift? Enable safe-mode?"                  │
│   └──────────────────┘                                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Two Separate Systems

| System                                  | Users                          | Purpose                                                                |
| --------------------------------------- | ------------------------------ | ---------------------------------------------------------------------- |
| **MISS**                                | Doctors, clinicians            | See routed patient cases, approve/reject proposals, patient care       |
| **Popper Ops Dashboard** (this project) | Safety Ops, DevOps, Compliance | Monitor Popper's health, drift signals, safe-mode controls, audit logs |

### Primary Users of THIS Dashboard

| Role           | What They Do                                                                       |
| -------------- | ---------------------------------------------------------------------------------- |
| **Safety Ops** | Monitor drift signals, enable safe-mode during incidents, review audit patterns    |
| **DevOps/SRE** | Check service health, uptime, system metrics                                       |
| **Compliance** | Access de-identified audit logs for regulatory review, export FDA-required bundles |

### What This Dashboard Does NOT Do

- **Does NOT show patient-identifiable data** (only anonymized subject IDs)
- **Does NOT let doctors approve/reject proposals** (that's MISS)
- **Does NOT manage patient care workflows** (that's the mobile app + MIS)

### Why Separate?

> "The FDA demands safety. By making Popper a separate entity that _only_ checks for errors (and doesn't try to be helpful), we avoid 'conflict of interest.' Popper is the strict auditor who doesn't care if the patient is happy, only if they are safe."

The ops dashboard monitors this "safety auditor" — it's the control room for the safety system itself.

---

## 2) What You're Building

Three pages/components:

| Component              | Ticket  | Purpose                            |
| ---------------------- | ------- | ---------------------------------- |
| **Status View**        | POP-020 | "Is the system healthy right now?" |
| **Audit Log Viewer**   | POP-021 | "What decisions were made?"        |
| **Safe-Mode Controls** | POP-022 | "Enable/disable emergency brake"   |

---

## 3) Authentication

All dashboard endpoints require authentication.

### Auth Method: API Key + Session

```typescript
// Request headers (all endpoints)
headers: {
  "X-API-Key": "pk_live_xxxxx",     // Service API key
  "Authorization": "Bearer <token>" // User session token (from Better Auth)
}
```

### Roles Required

| Action                   | Required Role          |
| ------------------------ | ---------------------- |
| View status, audit logs  | `ops_viewer` or higher |
| Enable/disable safe-mode | `ops_admin`            |
| Change settings          | `ops_admin`            |

### Auth Flow

1. User logs in via Better Auth (same as main app)
2. Frontend stores session token
3. Include token in all Popper API calls
4. On 401 → redirect to `/login`

**For development:** Use mock auth or set `POPPER_AUTH_DISABLED=true`

---

## 4) Multi-Tenant Support

Popper supports **per-organization** status and safe-mode. The dashboard must handle this.

### Organization Selector

All pages should have an org selector in the header:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  POPPER DASHBOARD          [Organization: Regain Health ▼]    [👤 ops@...]  │
├─────────────────────────────────────────────────────────────────────────────┤
```

| Selection           | Behavior                     |
| ------------------- | ---------------------------- |
| "All Organizations" | Shows global/aggregate view  |
| Specific org        | Filters all data to that org |

### API: organization_id Parameter

Most endpoints accept `organization_id` query param:

| Endpoint                  | Without org_id   | With org_id         |
| ------------------------- | ---------------- | ------------------- |
| `GET /status`             | Global status    | Org-specific status |
| `GET /audit-events`       | All events       | Events for org only |
| `GET /safe-mode`          | Global safe-mode | Org's safe-mode     |
| `POST /control/safe-mode` | Set global       | Set for org only    |

---

## 5) API Contracts

Base URL: `http://localhost:3000` (dev) or `https://popper.internal` (prod)

All endpoints require authentication headers (see section 3).

---

### 5.1 Status View API

#### `GET /v1/popper/status`

**Query Parameters:**

| Param             | Type   | Required | Description                              |
| ----------------- | ------ | -------- | ---------------------------------------- |
| `organization_id` | string | No       | Filter to specific org (omit for global) |

**Response:**

```typescript
interface StatusResponse {
  // Organization context (null = global view)
  organization: {
    id: string | null; // null if global view
    name: string | null; // e.g., "Regain Health"
  };

  // Service info
  service: {
    name: "popper";
    version: string; // e.g., "1.0.0"
    uptime_seconds: number;
    healthy: boolean;
  };

  // Safe-mode state (global OR org-specific based on query)
  safe_mode: {
    enabled: boolean;
    reason: string | null; // Why it was enabled
    effective_at: string | null; // ISO timestamp
    effective_until: string | null; // ISO timestamp (null = indefinite)
    enabled_by: string | null; // Who enabled it
    scope: "global" | "organization"; // Which scope this applies to
  };

  // Policy info
  policy: {
    active_pack: string; // e.g., "default" or "advocate-clinical"
    version: string; // e.g., "1.0.0"
    rules_count: number;
  };

  // Counters (last 24 hours)
  counters: {
    requests_total: number;
    decisions: {
      approved: number;
      hard_stop: number;
      route_to_clinician: number;
      request_more_info: number;
    };
    validation_failures: number;
  };

  // Drift signals (anomaly detection)
  drift: {
    status: "normal" | "warning" | "critical";
    signals: DriftSignal[];
  };
}

interface DriftSignal {
  name: string; // e.g., "hard_stop_rate"
  current_value: number; // e.g., 0.15 (15%)
  baseline_value: number; // e.g., 0.05 (5%)
  threshold_warning: number; // e.g., 0.10
  threshold_critical: number; // e.g., 0.25
  status: "normal" | "warning" | "critical";
}
```

**Example Response:**

```json
{
  "service": {
    "name": "popper",
    "version": "1.0.0",
    "uptime_seconds": 86400,
    "healthy": true
  },
  "safe_mode": {
    "enabled": false,
    "reason": null,
    "effective_at": null,
    "effective_until": null,
    "enabled_by": null
  },
  "policy": {
    "active_pack": "default",
    "version": "1.0.0",
    "rules_count": 12
  },
  "counters": {
    "requests_total": 1523,
    "decisions": {
      "approved": 1401,
      "hard_stop": 12,
      "route_to_clinician": 98,
      "request_more_info": 12
    },
    "validation_failures": 3
  },
  "drift": {
    "status": "normal",
    "signals": [
      {
        "name": "hard_stop_rate",
        "current_value": 0.008,
        "baseline_value": 0.01,
        "threshold_warning": 0.05,
        "threshold_critical": 0.15,
        "status": "normal"
      },
      {
        "name": "route_to_clinician_rate",
        "current_value": 0.064,
        "baseline_value": 0.06,
        "threshold_warning": 0.12,
        "threshold_critical": 0.3,
        "status": "normal"
      }
    ]
  }
}
```

---

### 5.2 Audit Log Viewer API

#### `GET /v1/popper/audit-events`

**Query Parameters:**

| Param             | Type   | Required | Description                                                                            |
| ----------------- | ------ | -------- | -------------------------------------------------------------------------------------- |
| `limit`           | number | No       | Max events to return (default: 50, max: 200)                                           |
| `offset`          | number | No       | Pagination offset                                                                      |
| `organization_id` | string | No       | Filter by organization                                                                 |
| `trace_id`        | string | No       | Filter by trace ID                                                                     |
| `event_type`      | string | No       | Filter by event type (comma-separated for multiple)                                    |
| `decision`        | string | No       | Filter by decision: `APPROVED`, `HARD_STOP`, `ROUTE_TO_CLINICIAN`, `REQUEST_MORE_INFO` |
| `reason_codes`    | string | No       | Filter by reason codes (comma-separated, e.g., `high_uncertainty,policy_violation`)    |
| `since`           | string | No       | ISO timestamp (events after this time)                                                 |
| `until`           | string | No       | ISO timestamp (events before this time)                                                |

**Example with filters:**

```
GET /v1/popper/audit-events?organization_id=org_regain&decision=HARD_STOP&since=2026-01-24T00:00:00Z
```

**Response:**

```typescript
interface AuditEventsResponse {
  events: AuditEvent[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

interface AuditEvent {
  id: string; // UUID
  event_type: AuditEventType;
  occurred_at: string; // ISO timestamp

  // Trace info (links events together)
  trace: {
    trace_id: string;
    span_id?: string;
    parent_span_id?: string;
  };

  // Context
  mode: "wellness" | "advocate_clinical";
  subject: {
    subject_id: string; // Anonymized patient ID
    organization_id?: string;
  };

  // Human-readable summary (PHI-redacted)
  summary: string;

  // Optional tags for filtering
  tags?: Record<string, string>;
}

type AuditEventType =
  | "SUPERVISION_REQUEST_RECEIVED"
  | "SUPERVISION_RESPONSE_DECIDED"
  | "CONTROL_COMMAND_ISSUED"
  | "SAFE_MODE_ENABLED"
  | "SAFE_MODE_DISABLED"
  | "VALIDATION_FAILED"
  | "OTHER";
```

**Example Response:**

```json
{
  "events": [
    {
      "id": "evt_abc123",
      "event_type": "SUPERVISION_RESPONSE_DECIDED",
      "occurred_at": "2026-01-25T14:32:15.123Z",
      "trace": {
        "trace_id": "tr_xyz789",
        "span_id": "sp_001"
      },
      "mode": "wellness",
      "subject": {
        "subject_id": "anon_patient_456",
        "organization_id": "org_regain"
      },
      "summary": "APPROVED lifestyle recommendation",
      "tags": {
        "decision": "APPROVED",
        "proposal_kind": "LIFESTYLE_MODIFICATION_PROPOSAL"
      }
    },
    {
      "id": "evt_def456",
      "event_type": "SUPERVISION_RESPONSE_DECIDED",
      "occurred_at": "2026-01-25T14:30:02.456Z",
      "trace": {
        "trace_id": "tr_abc123",
        "span_id": "sp_002"
      },
      "mode": "advocate_clinical",
      "subject": {
        "subject_id": "anon_patient_789",
        "organization_id": "org_regain"
      },
      "summary": "ROUTE_TO_CLINICIAN: medication proposal requires review",
      "tags": {
        "decision": "ROUTE_TO_CLINICIAN",
        "proposal_kind": "MEDICATION_ORDER_PROPOSAL",
        "reason_code": "high_uncertainty"
      }
    },
    {
      "id": "evt_ghi789",
      "event_type": "SAFE_MODE_ENABLED",
      "occurred_at": "2026-01-25T10:00:00.000Z",
      "trace": {
        "trace_id": "tr_system",
        "span_id": "sp_sys_001"
      },
      "mode": "wellness",
      "subject": {
        "subject_id": "system",
        "organization_id": "org_regain"
      },
      "summary": "Safe-mode enabled by ops: Drift detected",
      "tags": {
        "enabled_by": "ops@regain.ai",
        "reason": "Drift detected: hard_stop_rate elevated"
      }
    }
  ],
  "pagination": {
    "total": 1523,
    "limit": 50,
    "offset": 0,
    "has_more": true
  }
}
```

#### `GET /v1/popper/audit-events/timeseries`

Returns event counts bucketed by time for charting.

**Query Parameters:**

| Param             | Type   | Required | Description                                              |
| ----------------- | ------ | -------- | -------------------------------------------------------- |
| `organization_id` | string | No       | Filter by organization                                   |
| `since`           | string | Yes      | Start of time range (ISO timestamp)                      |
| `until`           | string | No       | End of time range (default: now)                         |
| `bucket`          | string | No       | Time bucket: `hour`, `day`, `week` (default: `hour`)     |
| `group_by`        | string | No       | Group by: `decision`, `event_type` (default: `decision`) |

**Response:**

```typescript
interface AuditTimeseriesResponse {
  buckets: TimeseriesBucket[];
  total_events: number;
}

interface TimeseriesBucket {
  timestamp: string; // Start of bucket (ISO)
  counts: Record<string, number>; // e.g., { "APPROVED": 45, "HARD_STOP": 2 }
  total: number;
}
```

**Example Response:**

```json
{
  "buckets": [
    {
      "timestamp": "2026-01-25T10:00:00Z",
      "counts": { "APPROVED": 145, "HARD_STOP": 3, "ROUTE_TO_CLINICIAN": 12 },
      "total": 160
    },
    {
      "timestamp": "2026-01-25T11:00:00Z",
      "counts": { "APPROVED": 132, "HARD_STOP": 1, "ROUTE_TO_CLINICIAN": 8 },
      "total": 141
    },
    {
      "timestamp": "2026-01-25T12:00:00Z",
      "counts": { "APPROVED": 98, "HARD_STOP": 5, "ROUTE_TO_CLINICIAN": 22 },
      "total": 125
    }
  ],
  "total_events": 426
}
```

---

### 5.3 Safe-Mode Controls API

#### `GET /v1/popper/safe-mode`

Returns current safe-mode state.

**Query Parameters:**

| Param             | Type   | Required | Description                              |
| ----------------- | ------ | -------- | ---------------------------------------- |
| `organization_id` | string | No       | Get org-specific state (omit for global) |

**Response:**

```typescript
interface SafeModeState {
  enabled: boolean;
  reason: string | null;
  effective_at: string | null;
  effective_until: string | null;
  enabled_by: string | null;
  scope: "global" | "organization";
  organization_id: string | null; // null if global
}
```

#### `POST /v1/popper/control/safe-mode`

Enable or disable safe-mode (global or per-org).

**Request:**

```typescript
interface SafeModeRequest {
  enabled: boolean;
  reason: string; // REQUIRED - why are you changing it?
  organization_id?: string; // Omit for global, include for org-specific
  effective_at?: string; // ISO timestamp (default: now)
  effective_until?: string | null; // ISO timestamp (null = indefinite)
}
```

**Example Request (enable):**

```json
{
  "enabled": true,
  "reason": "Investigating spike in route_to_clinician decisions",
  "effective_until": "2026-01-25T18:00:00.000Z"
}
```

**Example Request (disable):**

```json
{
  "enabled": false,
  "reason": "Investigation complete, metrics back to normal"
}
```

**Response:**

```typescript
interface SafeModeResponse {
  success: boolean;
  safe_mode: SafeModeState;
  control_command: {
    command_id: string;
    command_type: "SET_SAFE_MODE";
    issued_at: string;
  };
}
```

#### `GET /v1/popper/safe-mode/history`

Get history of safe-mode changes.

**Query Parameters:**

| Param   | Type   | Required | Description               |
| ------- | ------ | -------- | ------------------------- |
| `limit` | number | No       | Max records (default: 20) |
| `since` | string | No       | ISO timestamp             |

**Response:**

```typescript
interface SafeModeHistoryResponse {
  history: SafeModeHistoryEntry[];
}

interface SafeModeHistoryEntry {
  id: string;
  enabled: boolean;
  reason: string;
  effective_at: string;
  effective_until: string | null;
  created_by: string;
  created_at: string;
}
```

---

## 6) UI Requirements

### 6.1 Status View (POP-020)

**Layout:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  POPPER STATUS        [Org: Regain Health ▼]              [Auto-refresh: 30s]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │  SERVICE    │  │  SAFE-MODE  │  │   POLICY    │  │    DRIFT    │       │
│  │  ● Healthy  │  │  ○ Disabled │  │  default    │  │  ● Normal   │       │
│  │  v1.0.0     │  │             │  │  v1.0.0     │  │             │       │
│  │  24h uptime │  │             │  │  12 rules   │  │             │       │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  DECISIONS (Last 24h)                                    Total: 1523│   │
│  │  ┌──────────────────────────────────────────────────────────────┐  │   │
│  │  │ ████████████████████████████████████████████░░░░░░░░░░░░░░░░ │  │   │
│  │  │ Approved: 1401 (92%)  Route: 98 (6.4%)  Stop: 12  Info: 12   │  │   │
│  │  └──────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  DRIFT SIGNALS                                                      │   │
│  │                                                                     │   │
│  │  hard_stop_rate        [====●==========] 0.8% (baseline: 1%)       │   │
│  │  route_to_clinician    [=====●=========] 6.4% (baseline: 6%)       │   │
│  │  validation_failures   [==●============] 0.2% (baseline: 0.1%)     │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Requirements:**

- [ ] **Organization selector** in header (dropdown with "All Organizations" + list)
- [ ] Auto-refresh every 30 seconds (configurable)
- [ ] Service health: green dot = healthy, red dot = unhealthy
- [ ] Safe-mode card: shows enabled/disabled + scope (global vs org), if enabled show reason and duration
- [ ] Policy card: shows active pack name and version
- [ ] Drift status: green/yellow/red based on `drift.status`
- [ ] Decision bar chart: stacked horizontal bar showing distribution
- [ ] Drift signals: gauge or progress bar showing current vs baseline vs thresholds

**Colors:**

| Status               | Color            |
| -------------------- | ---------------- |
| Healthy / Normal     | Green `#22c55e`  |
| Warning              | Yellow `#eab308` |
| Critical / Unhealthy | Red `#ef4444`    |
| Safe-mode enabled    | Orange `#f97316` |

---

### 6.2 Audit Log Viewer (POP-021)

**Layout:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  AUDIT LOG                      [Org: Regain Health ▼]      [Export CSV]    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  EVENT VOLUME (Last 24h)                                              │ │
│  │  ▲                                                                    │ │
│  │  │     ██                                                             │ │
│  │  │  ██ ██ ██    ██                           ██ ██                   │ │
│  │  │  ██ ██ ██ ██ ██ ██    ██ ██ ██ ██ ██ ██ ██ ██ ██ ██              │ │
│  │  └──────────────────────────────────────────────────────────────▶    │ │
│  │    10  11  12  13  14  15  16  17  18  19  20  21  22  23  00       │ │
│  │  ■ Approved  ■ Route  ■ Hard Stop                                    │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Filters:                                                                   │
│  [Event Type ▼] [Decision ▼] [Reason Codes ▼] [Date Range] [trace_id...] │
│                                                                   [Apply]  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Time           │ Event Type      │ Decision │ Mode     │ Summary          │
│─────────────────┼─────────────────┼──────────┼──────────┼──────────────────│
│  14:32:15       │ RESPONSE_DECIDED│ APPROVED │ wellness │ Approved lifes...│
│  14:30:02       │ RESPONSE_DECIDED│ ROUTE    │ clinical │ Route: medicati..│
│  14:28:45       │ REQUEST_RECEIVED│ -        │ wellness │ Received superv..│
│  10:00:00       │ SAFE_MODE_ON    │ -        │ -        │ Safe-mode enabl..│
│  ...            │                 │          │          │                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Showing 1-50 of 1523                              [< Prev] [1] [2] [Next >]│
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────────────────────────────────┐
                              │  EVENT DETAIL (expanded row)                │
Click row to expand →         │                                             │
                              │  Trace ID: tr_xyz789                        │
                              │  Event ID: evt_abc123                       │
                              │  Subject: anon_patient_456                  │
                              │  Organization: org_regain                   │
                              │                                             │
                              │  Tags:                                      │
                              │    decision: APPROVED                       │
                              │    proposal_kind: LIFESTYLE_MODIFICATION    │
                              │    reason_codes: (none)                     │
                              │                                             │
                              │  [Copy Trace ID]  [View Related Events]     │
                              └─────────────────────────────────────────────┘
```

**Requirements:**

- [ ] **Time-series chart** at top showing event volume over time
  - Stacked bar chart by decision type
  - Clickable bars to filter table to that time bucket
  - Use `/audit-events/timeseries` endpoint
- [ ] **Organization filter** (dropdown, inherits from header or override)
- [ ] Data table with sortable columns
- [ ] Filters:
  - [ ] Event type dropdown (multi-select)
  - [ ] **Decision dropdown** (APPROVED, HARD_STOP, ROUTE_TO_CLINICIAN, REQUEST_MORE_INFO)
  - [ ] **Reason codes dropdown** (multi-select: high_uncertainty, policy_violation, schema_invalid, etc.)
  - [ ] Date range picker
  - [ ] Trace ID search
- [ ] Pagination (50 per page)
- [ ] Click row to expand and show full details
- [ ] "Copy Trace ID" button
- [ ] "View Related Events" filters by same trace_id
- [ ] Export to CSV button (respects current filters)
- [ ] Export to JSON button
- [ ] Event type badges with colors:

| Event Type                   | Badge Color |
| ---------------------------- | ----------- |
| SUPERVISION_RESPONSE_DECIDED | Blue        |
| SUPERVISION_REQUEST_RECEIVED | Gray        |
| SAFE_MODE_ENABLED            | Orange      |
| SAFE_MODE_DISABLED           | Green       |
| VALIDATION_FAILED            | Red         |
| CONTROL_COMMAND_ISSUED       | Purple      |

| Decision (in tags) | Badge Color |
| ------------------ | ----------- |
| APPROVED           | Green       |
| HARD_STOP          | Red         |
| ROUTE_TO_CLINICIAN | Yellow      |
| REQUEST_MORE_INFO  | Blue        |

---

### 6.3 Safe-Mode Controls (POP-022)

**Layout:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SAFE-MODE CONTROLS                         [Org: Regain Health ▼]          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  GLOBAL SAFE-MODE                                                   │   │
│  │                                                                     │   │
│  │   Status:   ○ DISABLED                              [ Enable ]     │   │
│  │                                                                     │   │
│  │   Affects ALL organizations. Use for system-wide incidents.        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ORGANIZATION SAFE-MODE (Regain Health)                             │   │
│  │                                                                     │   │
│  │   Status:   ○ DISABLED                              [ Enable ]     │   │
│  │                                                                     │   │
│  │   Affects only this organization.                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  HISTORY (showing: org + global)                   [Filter: All ▼] │   │
│  │                                                                     │   │
│  │  Jan 25, 10:00  │ ENABLED   │ GLOBAL │ "Drift detected"   │ ops@  │   │
│  │  Jan 25, 14:00  │ DISABLED  │ GLOBAL │ "Metrics normal"   │ ops@  │   │
│  │  Jan 20, 09:15  │ ENABLED   │ ORG    │ "Org maintenance"  │ admin │   │
│  │  Jan 20, 11:00  │ DISABLED  │ ORG    │ "Complete"         │ admin │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘


                    ┌─────────────────────────────────────────┐
                    │  ENABLE SAFE-MODE (modal)               │
Click [Enable] →    │                                         │
                    │  Scope:                                 │
                    │  ○ Global (all organizations)           │
                    │  ● This organization only               │
                    │                                         │
                    │  Reason: [________________________]     │
                    │  (Required, min 10 characters)          │
                    │                                         │
                    │  Duration:                              │
                    │  ○ 1 hour                               │
                    │  ○ 4 hours (recommended)                │
                    │  ○ 8 hours                              │
                    │  ○ Indefinite (until manually disabled) │
                    │                                         │
                    │  ⚠️  This will cause more decisions to   │
                    │     be routed to clinicians.            │
                    │                                         │
                    │          [Cancel]  [Enable Safe-Mode]   │
                    └─────────────────────────────────────────┘
```

**Requirements:**

- [ ] **Two sections**: Global safe-mode + Organization safe-mode
- [ ] **Scope selector** in modal: global vs org-specific
- [ ] Big toggle/button showing current state for each scope
- [ ] Enable button opens confirmation modal
- [ ] Modal requires reason (text input, min 10 chars)
- [ ] Duration selector: 1h, 4h, 8h, indefinite
- [ ] Warning text about impact (different text for global vs org)
- [ ] Disable button (when enabled) also requires reason
- [ ] History table showing past state changes
  - [ ] Scope column (GLOBAL or ORG name)
  - [ ] Filter dropdown: All, Global only, This org only
- [ ] Real-time update when state changes
- [ ] If global is ON, org toggle should be disabled with message "Global safe-mode is active"

---

## 7) Component Suggestions (shadcn/ui)

Use these shadcn components:

| UI Element               | Component                                                          |
| ------------------------ | ------------------------------------------------------------------ |
| Status cards             | `Card`, `Badge`                                                    |
| Decision bar             | Custom or `Progress`                                               |
| Drift gauges             | Custom or `Progress` with marks                                    |
| **Time-series chart**    | `recharts` (already in project) - use `BarChart` with stacked bars |
| Data table               | `Table` + `DataTable` pattern                                      |
| Filters                  | `Select`, `DatePicker`, `Input`                                    |
| **Multi-select filters** | `MultiSelect` or `Popover` + `Checkbox`                            |
| Pagination               | `Pagination`                                                       |
| Toggle                   | `Switch` or `Button`                                               |
| Modal                    | `Dialog`                                                           |
| Duration select          | `RadioGroup`                                                       |
| Scope select             | `RadioGroup` (Global vs Org)                                       |
| Org selector             | `Select` in header                                                 |
| Tooltips                 | `Tooltip`                                                          |

### Chart Library

Use `recharts` for the time-series chart:

```tsx
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

<ResponsiveContainer width="100%" height={200}>
  <BarChart data={timeseriesData}>
    <XAxis dataKey="timestamp" tickFormatter={formatHour} />
    <YAxis />
    <Tooltip />
    <Legend />
    <Bar dataKey="APPROVED" stackId="a" fill="#22c55e" />
    <Bar dataKey="ROUTE_TO_CLINICIAN" stackId="a" fill="#eab308" />
    <Bar dataKey="HARD_STOP" stackId="a" fill="#ef4444" />
  </BarChart>
</ResponsiveContainer>;
```

---

## 8) Error States

Handle these error cases:

| Error            | UI Response                                          |
| ---------------- | ---------------------------------------------------- |
| API unreachable  | Show "Unable to connect to Popper" with retry button |
| 401 Unauthorized | Redirect to login or show "Session expired"          |
| 500 Server Error | Show "Something went wrong" with error ID            |
| Empty audit log  | Show "No events found" with filter reset option      |

---

## 9) Questions?

If anything is unclear, ask **Davron** (backend) or **Anton** (product).

You do NOT need to read:

- Hermes specs
- Popper system spec
- Safety DSL docs
- MISS specs — that's a separate system for doctors
- Any other technical docs

This spec has everything you need.

---

## 10) Key Reminders

1. **This is an internal ops tool** — not patient-facing, not doctor-facing
2. **All data is de-identified** — you'll see `anon_patient_456`, never real names/PHI
3. **Safe-mode affects Popper's behavior** — when enabled, more decisions go to clinicians (via Regain Medical, not this dashboard)
4. **The dashboard monitors the safety system** — it's the "control room" for the safety auditor
