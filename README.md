# Popper

Policy engine for AI supervision using Hermes Protocol.

## Prerequisites

- **Bun** 1.3+ ([install](https://bun.sh/docs/installation))
- **TimescaleDB** (PostgreSQL 16) - installed locally
- **Redis** 6+

## Quick Start

### 1. Clone and install dependencies

```bash
git clone <repo-url>
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

Create the database:

```bash
createdb popper
```

Run migrations:

```bash
cd packages/db
bun run db:migrate
```

### 4. Start the server

Development mode with hot reload:

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
└── docs/specs/       # PRD and specifications
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

- **Runtime**: Bun
- **HTTP**: Elysia
- **Database**: TimescaleDB (PostgreSQL 16)
- **ORM**: Drizzle
- **Cache/Queue**: Redis + BullMQ
- **Types**: @regain/hermes
- **Linting**: Biome
- **Build**: Turborepo

## License

See [LICENSE](./LICENSE).
