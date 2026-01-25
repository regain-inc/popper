# Popper Project Guidelines

## Database Development Flow (TimescaleDB + Drizzle)

### Обязательный workflow для работы с базой данных:

1. **Проектирование схемы**
   - ВСЕГДА использовать `pg aiguide` MCP tool или skill `pg:setup-timescaledb-hypertables`
   - Не торопиться — сначала продумать структуру таблиц

2. **Требования TimescaleDB hypertables**
   - Composite Primary Key ОБЯЗАТЕЛЕН — partition column (timestamp) должен быть частью PK
   - `segment_by` — колонка для частых фильтров (>100 rows per chunk)
   - `order_by` — обычно `timestamp DESC`
   - Использовать правильные типы: `TIMESTAMPTZ`, `TEXT`, `DOUBLE PRECISION`

3. **Drizzle workflow**
   ```bash
   # 1. Создать/обновить схемы в src/schema/
   # 2. Сгенерировать миграцию
   bun run db:generate

   # 3. Отредактировать SQL файл — добавить TimescaleDB специфику:
   #    - WITH (tsdb.hypertable, tsdb.partition_column=..., ...)
   #    - Compression policies: CALL add_columnstore_policy(...)
   #    - Retention policies: SELECT add_retention_policy(...)
   #    - Continuous aggregates: CREATE MATERIALIZED VIEW ... WITH (timescaledb.continuous)

   # 4. Применить миграцию
   bun run db:migrate
   ```

4. **НЕ делать**
   - НЕ создавать отдельные migrate.ts скрипты — использовать drizzle-kit
   - НЕ использовать Docker для БД — TimescaleDB установлен локально
   - НЕ торопиться с реализацией — сначала валидация через pg aiguide

### TimescaleDB Best Practices

- **Chunk interval**: 1 day для high-volume, 1 week для low-volume
- **Compression**: после 7 дней для большинства случаев
- **Retention**: согласовать с бизнес-требованиями (7 years для audit)
- **Continuous aggregates**: hourly для dashboards, daily для baselines
- **Real-time aggregation**: отключена по умолчанию в v2.13+, включать только если нужны up-to-the-minute данные

## Project Structure

```
popper/
├── apps/server/          # Elysia HTTP server
├── packages/
│   ├── core/             # Policy engine, DSL parser
│   └── db/               # Drizzle schemas, migrations
├── config/policies/      # YAML policy packs
└── docs/specs/           # PRD и спецификации
```

## Tech Stack

- **Runtime**: Bun 1.3+
- **HTTP**: Elysia
- **Database**: TimescaleDB (PostgreSQL 16)
- **ORM**: Drizzle
- **Types**: @regain/hermes (npm package)
- **Linting**: Biome 2.x
- **Build**: Turborepo

## Hermes Package (@regain/hermes)

> **ВАЖНО**: НЕ создавать локальный packages/hermes. Использовать готовый npm пакет.

- **npm**: https://www.npmjs.com/package/@regain/hermes
- **Source code**: `/Users/macbookpro/development/hermes`
- **Version**: 1.0.3+ (Hermes Protocol v1.6.0)

### Что использовать из пакета:

```typescript
// Types
import type {
  SupervisionRequest,
  SupervisionResponse,
  ProposedIntervention,
  AuditEvent,
  ReasonCode,
  SupervisionDecision,
} from '@regain/hermes';

// Validation (AJV-based)
import { validateHermesMessage, parseHermesMessage } from '@regain/hermes';

// Builders
import { createSupervisionResponse, HTVScoreBuilder } from '@regain/hermes';

// Utilities
import { computeHTVScore, meetsHTVThreshold } from '@regain/hermes';

// Constants
import { REASON_CODES, SUPERVISION_DECISIONS, CURRENT_HERMES_VERSION } from '@regain/hermes';

// Test fixtures
import { approvedSupervisionResponse, fullSupervisionRequest } from '@regain/hermes/fixtures';
```

### Type guards:

```typescript
import { isSupervisionRequest, isSupervisionResponse, isAuditEvent } from '@regain/hermes';
```

## Key References

- PRD: `/PRD.md`
- Popper specs: `/docs/specs/02-popper-specs/`
- Hermes contracts: `/docs/specs/03-hermes-specs/`
- Hermes source: `/Users/macbookpro/development/hermes`
