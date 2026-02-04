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

  // Database (for future use)
  DATABASE_URL: t.Optional(t.String()),

  // Redis (for future use)
  REDIS_URL: t.Optional(t.String()),

  // S3/MinIO configuration for export bundle storage
  S3_ENDPOINT: t.Optional(t.String()),
  S3_ACCESS_KEY: t.Optional(t.String()),
  S3_SECRET_KEY: t.Optional(t.String()),
  S3_BUCKET: t.String({ default: 'popper-exports' }),
  S3_REGION: t.String({ default: 'us-east-1' }),

  // Policy configuration
  POLICIES_DIR: t.String({ default: './config/policies' }),

  // Admin API key for control plane endpoints
  POPPER_ADMIN_API_KEY: t.Optional(t.String()),
});

type Env = typeof envSchema.static;

function parseEnv(): Env {
  const env = {
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    PORT: Number(process.env.PORT) || 3000,
    HOST: process.env.HOST ?? '0.0.0.0',
    LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
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
    POLICIES_DIR: process.env.POLICIES_DIR ?? './config/policies',
    POPPER_ADMIN_API_KEY: process.env.POPPER_ADMIN_API_KEY,
  } satisfies Env;

  return env;
}

export const env = parseEnv();

export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
