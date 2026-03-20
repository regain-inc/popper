# Popper SA Deployment Guide

Руководство по деплою Popper на сервер Saudi Arabia (Oracle VM).

## Окружение

- **Server**: 84.8.112.8 (Oracle VM, Ubuntu)
- **Web Dashboard**: https://popper.regain.ai
- **API Server**: https://popper.regain.ai
- **Branch**: `sa`

## Архитектура

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   popper-web    │────▶│  popper-server  │────▶│   TimescaleDB   │
│   (Next.js)     │     │    (Elysia)     │     │   PostgreSQL    │
│   Port: 3002    │     │   Port: 9001    │     │   Port: 5432    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │  popper-queue   │
                        │   (BullMQ)      │
                        └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │     Redis       │
                        │   Port: 6379    │
                        └─────────────────┘
```

### Ключевые принципы

1. **Web app не имеет прямого доступа к БД** — все операции через API server
2. **Eden Treaty** для type-safe клиент-серверного взаимодействия
3. **Bun compile** для production binary серверных приложений
4. **Distroless images** для минимального размера контейнеров

## Структура файлов

```
/mnt/volume/projects/popper/
├── .env                          # Environment variables
├── scripts/
│   └── deploy-sa.sh              # Deployment script
├── infra/
│   └── docker/
│       ├── Dockerfile.server     # API server image
│       ├── Dockerfile.web        # Web dashboard image
│       ├── Dockerfile.queue      # Queue worker image
│       └── docker-compose.sa.yml # SA compose config
```

## Environment Variables

Файл `.env` должен содержать:

```bash
# Database
DATABASE_URL=postgres://popper:password@host.docker.internal:5432/popper

# Redis
REDIS_URL=redis://host.docker.internal:6379

# Auth
BETTER_AUTH_SECRET=<random-32-char-secret>
BETTER_AUTH_URL=https://popper.regain.ai

# CORS
CORS_ORIGIN=https://popper.regain.ai

# Web
NEXT_PUBLIC_API_URL=https://popper.regain.ai
```

## Деплой

### Автоматический (рекомендуется)

```bash
ssh -i ~/.ssh/sa ubuntu@84.8.112.8
cd /mnt/volume/projects/popper
sudo ./scripts/deploy-sa.sh
```

Скрипт выполняет:
1. `git pull origin sa`
2. Сборка Docker образов (server, web, queue)
3. Остановка старых контейнеров
4. Запуск новых контейнеров
5. Health checks

### Ручной

```bash
# Pull changes
cd /mnt/volume/projects/popper
sudo git fetch origin sa --force
sudo git reset --hard origin/sa

# Build images
sudo docker build -f infra/docker/Dockerfile.server -t popper-server:latest .
sudo docker build -f infra/docker/Dockerfile.web -t popper-web:latest .
sudo docker build -f infra/docker/Dockerfile.queue -t popper-queue:latest .

# Restart containers
sudo docker compose -f infra/docker/docker-compose.sa.yml down
sudo docker compose -f infra/docker/docker-compose.sa.yml up -d
```

## Мониторинг

### Health Checks

```bash
# API Server
curl https://popper.regain.ai/health

# Web Dashboard
curl -I https://popper.regain.ai/
```

### Логи

```bash
# Все контейнеры
sudo docker compose -f infra/docker/docker-compose.sa.yml logs -f

# Конкретный сервис
sudo docker logs -f popper-server
sudo docker logs -f popper-web
sudo docker logs -f popper-queue
```

### Grafana

- URL: http://84.8.112.8:3000
- Loki для логов
- Tempo для трейсинга

## CI/CD

GitHub Actions workflow `.github/workflows/deploy-sa.yml`:

- Триггер: push в ветку `sa`
- Runner: self-hosted с label `sa`
- Автоматически запускает `deploy-sa.sh`

## Observability (LGTM Stack)

Popper интегрирован с существующим LGTM стеком на сервере.

### Компоненты

| Сервис | Порт | Описание |
|--------|------|----------|
| Loki | 3100 | Хранилище логов |
| Grafana | 3000 | Визуализация |
| Tempo | 4317/4318 | Распределённый трейсинг |
| Promtail | — | Сбор логов из Docker |
| Prometheus | 9090 | Метрики |

### Логи

Promtail автоматически собирает логи из всех Docker контейнеров:

```bash
# Запрос логов через Loki API
curl -s "http://localhost:3100/loki/api/v1/query_range" \
  --data-urlencode 'query={container="popper-server"}' \
  --data-urlencode "limit=10"

# Логи через docker
sudo docker logs -f popper-server
```

### Grafana

- URL: http://84.8.112.8:3000
- Datasources: Loki, Tempo, Prometheus
- Dashboards: предустановлены для мониторинга

### OpenTelemetry (трейсы)

Конфигурация в `.env`:

```bash
OTEL_ENABLED=true
OTEL_SERVICE_NAME=popper-server
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

## Troubleshooting

### Docker build fails

```bash
# Очистить кэш
sudo docker builder prune -af

# Пересобрать без кэша
sudo docker build --no-cache -f infra/docker/Dockerfile.server -t popper-server:latest .
```

### Container не запускается

```bash
# Проверить логи
sudo docker logs popper-server

# Проверить .env файл
cat .env
```

### Database connection error

```bash
# Проверить доступность PostgreSQL
psql -h localhost -U popper -d popper -c "SELECT 1"

# Проверить что host.docker.internal работает
sudo docker exec popper-server ping -c 1 host.docker.internal
```

### Web app не может подключиться к API

1. Проверить `NEXT_PUBLIC_API_URL` в `.env`
2. Проверить CORS настройки (`CORS_ORIGIN`)
3. Проверить SSL сертификаты на nginx
