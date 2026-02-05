/**
 * OpenTelemetry tracing plugin
 * Provides distributed tracing with trace_id propagation
 * @module plugins/tracing
 */

import { opentelemetry } from '@elysiajs/opentelemetry';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { Elysia } from 'elysia';
import { env } from '../config/env';
import { createLogger } from '../lib/logger';

const log = createLogger('tracing');

// Log OTEL config at module load time
log.info`OpenTelemetry config: enabled=${env.OTEL_ENABLED}, service=${env.OTEL_SERVICE_NAME}, endpoint=${env.OTEL_EXPORTER_OTLP_ENDPOINT}`;

/**
 * OpenTelemetry tracing plugin for Elysia
 * Automatically instruments HTTP requests and propagates trace context
 */
export const tracingPlugin = new Elysia({ name: 'tracing' }).use(() => {
  if (!env.OTEL_ENABLED) {
    return new Elysia();
  }

  log.info`OpenTelemetry tracing started`;

  const exporterConfig = env.OTEL_EXPORTER_OTLP_ENDPOINT
    ? { url: env.OTEL_EXPORTER_OTLP_ENDPOINT }
    : undefined;

  return opentelemetry({
    serviceName: env.OTEL_SERVICE_NAME,
    spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter(exporterConfig))],
  });
});
