/**
 * Logger configuration for queue worker
 * Structured JSON logging with optional Loki sink
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
import { config } from './config';
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
 * Setup logging with LogTape
 */
export async function setupLogger(): Promise<void> {
  const isDev = process.env.NODE_ENV !== 'production';
  const level = config.log.level as LogLevel;

  const devFormatter = getAnsiColorFormatter({
    timestamp: 'time',
    level: 'ABBR',
    category: '.',
  });

  const prodFormatter = getJsonLinesFormatter({
    timestamp: 'rfc3339',
    categorySeparator: '.',
  });

  const consoleSink = getConsoleSink({
    formatter: isDev ? devFormatter : prodFormatter,
  });

  // Build sinks map — console always present, Loki when configured
  const sinks: Record<string, Sink> = {
    console: consoleSink,
  };

  const lokiUrl = process.env.LOKI_URL;
  if (lokiUrl) {
    lokiSinkInstance = createLokiSink({
      url: lokiUrl,
      labels: {
        service: 'popper-queue',
        environment: process.env.NODE_ENV ?? 'development',
      },
      batchSize: Number(process.env.LOKI_BATCH_SIZE) || 100,
      flushIntervalMs: Number(process.env.LOKI_FLUSH_INTERVAL_MS) || 1000,
      headers: parseLokiHeaders(process.env.LOKI_HEADERS),
    });
    sinks.loki = lokiSinkInstance;
  }

  const allSinks = lokiUrl ? ['console', 'loki'] : ['console'];

  await configure({
    sinks,
    filters: {},
    loggers: [
      {
        category: 'queue',
        lowestLevel: level,
        sinks: allSinks,
      },
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

export const logger = getLogger(['queue']);
