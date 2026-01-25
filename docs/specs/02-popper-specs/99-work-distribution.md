---
version: 1.0.0
last-updated: 2026-01-25
status: active
owner: Popper Dev Team
tags: [popper, coordination, work-distribution]
---

# Popper Work Distribution & Coordination

## Team

| Developer | Role | Tickets | Focus Areas |
|-----------|------|---------|-------------|
| **Davron Yuldashev** | Backend/Safety | 17 | Core Engine, Safety DSL, Policy, Drift, ARPA compliance |
| **Harsh Manwani** | UI/Infra | 11 | Auth, Dashboard, Ops workflows, Testing |

---

## Ticket Assignment

### Davron (17 tickets)

```
PHASE 1: Foundation ✅ DONE
├── POP-001  Project Foundation Setup
├── POP-002  TimescaleDB Database Setup
└── POP-003  Basic Elysia Server

PHASE 2: Core Engine (CRITICAL PATH)
├── POP-004  Hermes Package Integration ← CURRENT
├── POP-005  Safety DSL Parser
├── POP-006  Policy Engine Evaluator
├── POP-007  Staleness Validator
└── POP-008  Decision Builder

PHASE 3: Supervision API
└── POP-009  Supervision API Endpoint

PHASE 4: Control Plane
├── POP-012  Safe-Mode Management
├── POP-013A Operational Settings API
└── POP-013B Policy Lifecycle (ARPA)

PHASE 5: Drift Monitoring
├── POP-015A Drift Baseline Calculation
├── POP-015B RLHF Feedback Loop (ARPA)
└── POP-016  Auto Safe-Mode Triggers

PHASE 8: Regulatory Export
├── POP-023A Export Bundle Generator
└── POP-023B TEFCA/USCDI Compliance (ARPA)
```

### Harsh (11 tickets)

```
PHASE 3: Supervision API
├── POP-010  Audit Event Emission
└── POP-011  Idempotency Cache

PHASE 5: Drift Monitoring
└── POP-014  Drift Counters

PHASE 6: Multi-Tenant & Auth (CAN START IMMEDIATELY)
├── POP-017  API Key Authentication
├── POP-018  Multi-Tenant Organization Management
└── POP-019  Rate Limiting

PHASE 7: Ops Dashboard
├── POP-020  Dashboard - Status View
├── POP-021  Dashboard - Audit Log Viewer
└── POP-022  Dashboard - Safe-Mode Controls

PHASE 8: Regulatory Export
├── POP-024  Incident Management
└── POP-025  Test Fixtures & E2E Suite
```

---

## Execution Timeline

### Days 1-3: Parallel Foundation

```
DAVRON                              HARSH
────────                            ─────
POP-004: Hermes Integration         POP-017: API Key Auth
POP-005: Safety DSL Parser          POP-018: Multi-Tenant Org
                                    POP-019: Rate Limiting
                                    + Dashboard UI scaffolding (mocks)

         ← NO COORDINATION NEEDED →
         (completely independent tracks)
```

**Harsh can start immediately** on:
1. **Phase 6** (Auth infrastructure) — zero dependencies on Core Engine
2. **Dashboard UI** — using `00-dashboard-harsh/` starter kit with mock data

See "Harsh's Dashboard Starter Kit" section below for details.

### Days 4-5: API Contracts

```
DAVRON                              HARSH
────────                            ─────
POP-006: Policy Engine              Dashboard UI scaffolding
POP-007: Staleness Validator        (with mock data)
POP-008: Decision Builder

         ← SYNC POINT 1 →
         API Contract Review (30 min)
```

**Sync Point 1**: Davron exports TypeScript interfaces for:
- `SupervisionRequest` / `SupervisionResponse`
- `AuditEvent`
- `StatusResponse`

Harsh can build Dashboard UI against these types with mock data.

### Days 6-7: Supervision API

```
DAVRON                              HARSH
────────                            ─────
POP-009: Supervision API Endpoint   POP-020: Status View (mocks)
                                    POP-021: Audit Log Viewer (mocks)

         ← SYNC POINT 2 →
         Schema Handoff (async)
```

**Sync Point 2**: Davron commits final API schemas. Harsh switches from mocks to real endpoints.

### Days 8-9: Control & Audit

```
DAVRON                              HARSH
────────                            ─────
POP-012: Safe-Mode Management       POP-010: Audit Event Emission
POP-013A: Operational Settings      POP-011: Idempotency Cache
                                    POP-022: Safe-Mode Controls

         ← SYNC POINT 3 →
         Safe-Mode API Contract (30 min)
```

**Sync Point 3**: Coordinate on safe-mode toggle API for Dashboard controls.

### Days 10-12: Drift & Polish

```
DAVRON                              HARSH
────────                            ─────
POP-013B: Policy Lifecycle          POP-014: Drift Counters
POP-015A: Drift Baseline            Dashboard integration
POP-015B: RLHF Feedback
POP-016: Auto Safe-Mode Triggers
```

### Days 13-15: Regulatory & Testing

```
DAVRON                              HARSH
────────                            ─────
POP-023A: Export Bundle             POP-024: Incident Management
POP-023B: TEFCA/USCDI               POP-025: E2E Test Suite

         ← SYNC POINT 4 →
         Integration Testing (2 hrs)
```

**Sync Point 4**: Joint E2E testing session. Harsh's tests validate Davron's APIs.

---

## Coordination Protocol

### Daily Standup (15 min)

- What was completed
- What's in progress
- Any blockers or questions

### Sync Points (4 total)

| Day | Sync | Format | Artifact |
|-----|------|--------|----------|
| 4 | API Contract Review | 30 min call | `packages/core/src/types/api.ts` |
| 7 | Schema Handoff | Async PR review | Final API schemas |
| 9 | Safe-Mode API | 30 min call | Control plane endpoints |
| 14 | Integration Testing | 2 hr pairing | E2E test environment |

### Async Communication

- **Type exports**: Davron commits types to `packages/core/src/types/`
- **Mock data**: Harsh creates fixtures in `packages/dashboard/src/mocks/`
- **API changes**: PR with `[API]` tag for Harsh to review

---

## Interface Contracts

### Types Davron Exports (Day 4)

```typescript
// packages/core/src/types/api.ts

export interface StatusResponse {
  safe_mode: {
    enabled: boolean;
    reason?: string;
    effective_since?: string;
  };
  ruleset_version: string;
  service_version: string;
  counters: {
    requests_total: number;
    hard_stops: number;
    routes: number;
  };
}

export interface AuditEventRow {
  event_id: string;
  trace_id: string;
  event_type: string;
  timestamp: string;
  tags: Record<string, string>;
}

export interface SafeModeRequest {
  enabled: boolean;
  reason: string;
  effective_at?: string;
  effective_until?: string;
}
```

### Mock Data Harsh Creates (Day 3)

```typescript
// packages/dashboard/src/mocks/status.ts

export const mockStatus: StatusResponse = {
  safe_mode: { enabled: false },
  ruleset_version: "popper-safety-1.0.0",
  service_version: "0.3.0",
  counters: {
    requests_total: 1523,
    hard_stops: 12,
    routes: 89,
  },
};
```

---

## Independent Work (No Coordination Needed)

### Harsh's Independent Tickets

| Ticket | Why Independent |
|--------|-----------------|
| POP-017 (API Key Auth) | Standard middleware pattern |
| POP-018 (Multi-Tenant) | Generic org management |
| POP-019 (Rate Limiting) | Infrastructure, no domain logic |
| Dashboard UI scaffolding | Uses mock data |

### Davron's Independent Tickets

| Ticket | Why Independent |
|--------|-----------------|
| POP-004-008 (Core Engine) | No external dependencies |
| POP-013B (Policy Lifecycle) | Internal safety logic |
| POP-015B (RLHF) | Internal feedback system |

---

## Risk Mitigation

### Blocker: Davron delayed on Core Engine

**Impact**: Harsh's Phase 3 tickets (POP-010, 011) wait
**Mitigation**: Harsh continues with Dashboard mocks + Phase 8 tickets

### Blocker: API schema changes late

**Impact**: Harsh rewrites Dashboard components
**Mitigation**: Davron exports types on Day 4, freezes API by Day 7

### Blocker: Integration issues

**Impact**: E2E tests fail
**Mitigation**: Daily standup surfaces issues early; sync on Day 9

---

## Success Criteria

- [ ] Phase 1 complete (Done)
- [ ] Core Engine (Phase 2) passing tests
- [ ] Supervision API (Phase 3) accepting requests
- [ ] Dashboard showing real data
- [ ] Safe-mode toggle working end-to-end
- [ ] E2E test suite passing
- [ ] All 28 tickets closed

---

## Harsh's Dashboard Starter Kit

Harsh has a complete starter kit at `docs/specs/02-popper-specs/00-dashboard-harsh/`:

| File | Purpose |
|------|---------|
| `00-dashboard-spec.md` | Full dashboard requirements (39KB) |
| `mock-data.json` | JSON fixtures for all API responses |
| `types.ts` | TypeScript interfaces matching Davron's API |

**Harsh can start building UI on Day 1** — no waiting for Davron's APIs. The types and mocks are already aligned with the API contracts.

### Recommended Harsh Day 1 Start

```
1. Review 00-dashboard-spec.md
2. Set up Next.js/React project structure
3. Import types.ts
4. Build Status View (POP-020) against mock-data.json
5. Build Audit Log Viewer (POP-021) against mock-data.json
```

When Davron's APIs are ready (Day 7), Harsh swaps mock imports for real API calls.

---

## References

- [Popper Context](./00-popper-specs-context.md)
- [System Spec](./01-popper-system-spec.md)
- [API Contracts](./02-popper-contracts-and-interfaces.md)
- [Dashboard Spec](./00-dashboard-harsh/00-dashboard-spec.md)
- [Dashboard Mock Data](./00-dashboard-harsh/mock-data.json)
- [Dashboard Types](./00-dashboard-harsh/types.ts)
