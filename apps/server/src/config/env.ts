/**
 * Environment configuration with validation
 * @module config/env
 */

import { t } from 'elysia';

const envSchema = t.Object({
  NODE_ENV: t.Union([t.Literal('development'), t.Literal('production'), t.Literal('test')], {
    default: 'development',
  }),
  PORT: t.Number({ default: 3000 }),
  HOST: t.String({ default: '0.0.0.0' }),
  LOG_LEVEL: t.Union(
    [
      t.Literal('debug'),
      t.Literal('info'),
      t.Literal('warning'),
      t.Literal('error'),
      t.Literal('fatal'),
    ],
    { default: 'info' },
  ),

  // OpenTelemetry
  OTEL_ENABLED: t.Boolean({ default: false }),
  OTEL_SERVICE_NAME: t.String({ default: 'popper' }),
  OTEL_EXPORTER_OTLP_ENDPOINT: t.Optional(t.String()),

  // Database (required)
  DATABASE_URL: t.String(),

  // Redis (for future use)
  REDIS_URL: t.Optional(t.String()),

  // S3/MinIO configuration for export bundle storage
  S3_ENDPOINT: t.Optional(t.String()),
  S3_ACCESS_KEY: t.Optional(t.String()),
  S3_SECRET_KEY: t.Optional(t.String()),
  S3_BUCKET: t.String({ default: 'popper-exports' }),
  S3_REGION: t.String({ default: 'us-east-1' }),

  // Loki
  LOKI_URL: t.Optional(t.String()),
  LOKI_BATCH_SIZE: t.Number({ default: 100 }),
  LOKI_FLUSH_INTERVAL_MS: t.Number({ default: 1000 }),
  LOKI_HEADERS: t.Optional(t.String()),

  // CORS
  CORS_ORIGIN: t.String({ default: 'http://localhost:3002' }),

  // Policy configuration
  POLICIES_DIR: t.String({ default: './config/policies' }),

  // Admin API key for control plane endpoints
  POPPER_ADMIN_API_KEY: t.Optional(t.String()),

  // Push delivery configuration
  DEUTSCH_CONTROL_ENDPOINT: t.Optional(t.String()),
  DEUTSCH_INSTANCE_ID: t.Optional(t.String()),
  DEUTSCH_ORGANIZATION_ID: t.Optional(t.String()),
  POPPER_PUSH_API_KEY: t.Optional(t.String()),
  CONTROL_TARGETS_FILE: t.Optional(t.String()),
  RECONCILIATION_INTERVAL_MS: t.Number({ default: 60000 }),
  IDLE_RECONCILIATION_INTERVAL_MS: t.Number({ default: 300000 }),
});

type Env = typeof envSchema.static;

function parseEnv(): Env {
  if (!process.env.DATABASE_URL) {
    console.error('FATAL: DATABASE_URL environment variable is required but not set.');
    console.error('Set DATABASE_URL to a valid PostgreSQL connection string.');
    process.exit(1);
  }

  const env = {
    NODE_ENV: (process.env.NODE_ENV ?? 'development') as 'development' | 'production' | 'test',
    PORT: Number(process.env.PORT) || 3000,
    HOST: process.env.HOST ?? '0.0.0.0',
    LOG_LEVEL: (process.env.LOG_LEVEL ?? 'info') as
      | 'debug'
      | 'info'
      | 'warning'
      | 'error'
      | 'fatal',
    OTEL_ENABLED: process.env.OTEL_ENABLED === 'true',
    OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME ?? 'popper',
    OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    S3_ENDPOINT: process.env.S3_ENDPOINT,
    S3_ACCESS_KEY: process.env.S3_ACCESS_KEY,
    S3_SECRET_KEY: process.env.S3_SECRET_KEY,
    S3_BUCKET: process.env.S3_BUCKET ?? 'popper-exports',
    S3_REGION: process.env.S3_REGION ?? 'us-east-1',
    LOKI_URL: process.env.LOKI_URL,
    LOKI_BATCH_SIZE: Number(process.env.LOKI_BATCH_SIZE) || 100,
    LOKI_FLUSH_INTERVAL_MS: Number(process.env.LOKI_FLUSH_INTERVAL_MS) || 1000,
    LOKI_HEADERS: process.env.LOKI_HEADERS,
    CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:3002',
    POLICIES_DIR: process.env.POLICIES_DIR ?? './config/policies',
    POPPER_ADMIN_API_KEY: process.env.POPPER_ADMIN_API_KEY,
    DEUTSCH_CONTROL_ENDPOINT: process.env.DEUTSCH_CONTROL_ENDPOINT,
    DEUTSCH_INSTANCE_ID: process.env.DEUTSCH_INSTANCE_ID,
    DEUTSCH_ORGANIZATION_ID: process.env.DEUTSCH_ORGANIZATION_ID,
    POPPER_PUSH_API_KEY: process.env.POPPER_PUSH_API_KEY,
    CONTROL_TARGETS_FILE: process.env.CONTROL_TARGETS_FILE,
    RECONCILIATION_INTERVAL_MS: Number(process.env.RECONCILIATION_INTERVAL_MS) || 60000,
    IDLE_RECONCILIATION_INTERVAL_MS: Number(process.env.IDLE_RECONCILIATION_INTERVAL_MS) || 300000,
  } satisfies Env;

  return env;
}

export const env = parseEnv();

export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
