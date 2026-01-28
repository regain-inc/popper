# Regain Popper™

**Open-source policy engine for clinical AI safety**

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

---

> **Alpha Release** — This is early-stage software.
> - APIs may change without notice
> - Not recommended for production use
> - Feedback welcome via [Issues](https://github.com/regain-inc/popper/issues)

---

> **Clinical Disclaimer**: This software is NOT validated for clinical use.
> Policy packs are examples only. Organizations deploying in clinical settings
> are responsible for clinical validation, regulatory compliance, and patient safety.

---

## What is Popper?

Popper is a **brain-agnostic** supervisory agent for clinical AI systems. It evaluates proposed clinical interventions against safety policies and returns one of four decisions:

| Decision | Meaning |
|----------|---------|
| `APPROVED` | Safe to proceed |
| `HARD_STOP` | Block immediately — too risky |
| `ROUTE_TO_CLINICIAN` | Escalate for human review |
| `REQUEST_MORE_INFO` | Need additional data to decide |

Popper implements the [Hermes protocol](https://github.com/regain-inc/hermes) for communication between clinical reasoning agents and safety supervisors.

**Brain-agnostic** means Popper can supervise ANY clinical AI system, not just specific implementations. It validates independently and makes no assumptions about the reasoning agent it supervises.

## Key Features

- **Deterministic Safety DSL** — Declarative YAML policies for safety rules
- **Hermes Protocol** — Standard message types via `@regain/hermes`
- **Audit Logging** — Every decision logged with `trace_id` for accountability
- **Safe-Mode Controls** — Operational settings and emergency overrides
- **Policy-First** — Hard-stop decisions without LLM calls

## Prerequisites

- **Bun** 1.3+ ([install](https://bun.sh/docs/installation))
- **TimescaleDB** (PostgreSQL 16) — installed locally
- **Redis** 6+

## Quick Start

### 1. Clone and install dependencies

```bash
git clone https://github.com/regain-inc/popper.git
cd popper
bun install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your local settings:

```
DATABASE_URL=postgres://localhost:5432/popper
REDIS_URL=redis://localhost:6379
PORT=3000
NODE_ENV=development
```

### 3. Setup database

```bash
createdb popper
cd packages/db
bun run db:migrate
```

### 4. Start the server

```bash
bun run dev
```

## Project Structure

```
popper/
├── apps/
│   ├── server/       # Elysia HTTP server
│   └── queue/        # BullMQ worker
├── packages/
│   ├── core/         # Policy engine, DSL parser
│   ├── db/           # Drizzle schemas, migrations
│   └── cache/        # Redis caching layer
├── config/policies/  # YAML policy packs
└── docs/specs/       # Specifications
```

## Available Scripts

From root directory:

| Command | Description |
|---------|-------------|
| `bun run dev` | Start all apps in dev mode |
| `bun run build` | Build all packages |
| `bun run test` | Run all tests |
| `bun run lint` | Lint all packages |
| `bun run lint:fix` | Fix lint issues |
| `bun run check` | Run Biome checks |
| `bun run clean` | Clean build artifacts |

Database scripts (from `packages/db`):

| Command | Description |
|---------|-------------|
| `bun run db:generate` | Generate migration from schema changes |
| `bun run db:migrate` | Apply migrations |
| `bun run db:push` | Push schema directly (dev only) |
| `bun run db:studio` | Open Drizzle Studio |

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Runtime | Bun | 1.3+ |
| HTTP | Elysia | - |
| Database | TimescaleDB | PostgreSQL 16 |
| ORM | Drizzle | - |
| Cache/Queue | Redis + BullMQ | 6+ |
| Types | @regain/hermes | - |
| Linting | Biome | - |
| Build | Turborepo | - |

## Documentation

- [Vision](./VISION.md) — Project vision and design philosophy
- [Governance](./GOVERNANCE.md) — How the project is managed
- [Contributing](./CONTRIBUTING.md) — How to contribute
- [Code of Conduct](./CODE_OF_CONDUCT.md) — Community standards
- [Certification](./CERTIFICATION.md) — Certification program (coming soon)
- [Trademark Policy](./TRADEMARK.md) — Trademark usage guidelines
- [Changelog](./CHANGELOG.md) — Version history

## License

Apache 2.0 — See [LICENSE](./LICENSE)

---

*Regain Hermes™, Regain Deutsch™, Regain Popper™, Popper™, and Hard2Vary™ are trademarks of Regain, Inc. All rights reserved.*
