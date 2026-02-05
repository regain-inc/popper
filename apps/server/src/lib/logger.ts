/**
 * LogTape logger configuration
 * Structured JSON logging for production, pretty output for development
 *
 * Loki push sink activated when LOKI_URL is set.
 * @module lib/logger
 */

import {
  configure,
  getAnsiColorFormatter,
  getConsoleSink,
  getJsonLinesFormatter,
  getLogger,
  type LogLevel,
  type Sink,
} from '@logtape/logtape';
import { env, isDev } from '../config/env';
import { createLokiSink } from './loki-sink';

/** Loki sink reference for graceful shutdown */
let lokiSinkInstance: (Sink & AsyncDisposable) | null = null;

/**
 * Parse LOKI_HEADERS env var (format: "key=value,key2=value2")
 */
function parseLokiHeaders(raw: string | undefined): Record<string, string> | undefined {
  if (!raw) return undefined;
  const headers: Record<string, string> = {};
  for (const pair of raw.split(',')) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx > 0) {
      headers[pair.slice(0, eqIdx).trim()] = pair.slice(eqIdx + 1).trim();
    }
  }
  return Object.keys(headers).length > 0 ? headers : undefined;
}

/**
 * Initialize LogTape logging
 * Call this once at application startup
 */
export async function setupLogger(): Promise<void> {
  const level = env.LOG_LEVEL as LogLevel;

  // Use built-in formatters
  const devFormatter = getAnsiColorFormatter({
    timestamp: 'time',
    level: 'ABBR',
    category: '.',
  });

  const prodFormatter = getJsonLinesFormatter();

  // Use getConsoleSink for both dev and prod (Bun's process.stdout doesn't support getWriter)
  const consoleSink = getConsoleSink({
    formatter: isDev ? devFormatter : prodFormatter,
  });

  // Build sinks map — console always present, Loki when configured
  const sinks: Record<string, Sink> = {
    console: consoleSink,
  };

  if (env.LOKI_URL) {
    lokiSinkInstance = createLokiSink({
      url: env.LOKI_URL,
      labels: {
        service: env.OTEL_SERVICE_NAME,
        environment: env.NODE_ENV,
      },
      batchSize: env.LOKI_BATCH_SIZE,
      flushIntervalMs: env.LOKI_FLUSH_INTERVAL_MS,
      headers: parseLokiHeaders(env.LOKI_HEADERS),
    });
    sinks.loki = lokiSinkInstance;
  }

  const allSinks = env.LOKI_URL ? ['console', 'loki'] : ['console'];

  await configure({
    sinks,
    filters: {},
    loggers: [
      // Root logger for popper
      {
        category: ['popper'],
        lowestLevel: level,
        sinks: allSinks,
      },
      // HTTP request logging
      {
        category: ['popper', 'http'],
        lowestLevel: level,
        sinks: allSinks,
      },
      // Elysia internals (less verbose)
      {
        category: ['elysia'],
        lowestLevel: 'warning',
        sinks: ['console'],
      },
      // LogTape meta logger (suppress info messages)
      {
        category: ['logtape', 'meta'],
        lowestLevel: 'warning',
        sinks: ['console'],
      },
    ],
  });
}

/**
 * Flush and shut down the Loki sink.
 * Call during graceful shutdown to ensure all buffered logs are sent.
 */
export async function shutdownLogger(): Promise<void> {
  if (lokiSinkInstance) {
    await lokiSinkInstance[Symbol.asyncDispose]();
    lokiSinkInstance = null;
  }
}

/**
 * Get a logger instance for a specific category
 * @example
 * const log = createLogger('http');
 * log.info`Request received: ${method} ${path}`;
 */
export function createLogger(category: string) {
  return getLogger(['popper', category]);
}

// Pre-configured loggers for common use cases
export const logger = getLogger(['popper']);
export const httpLogger = getLogger(['popper', 'http']);
