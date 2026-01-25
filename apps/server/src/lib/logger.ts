/**
 * LogTape logger configuration
 * Structured JSON logging for production, pretty output for development
 * @module lib/logger
 */

import {
  configure,
  getAnsiColorFormatter,
  getConsoleSink,
  getJsonLinesFormatter,
  getLogger,
  getStreamSink,
  type LogLevel,
} from '@logtape/logtape';
import { env, isDev } from '../config/env';

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

  const prodFormatter = getJsonLinesFormatter({
    timestamp: 'rfc3339',
    categorySeparator: '.',
  });

  const consoleSink = isDev
    ? getConsoleSink({ formatter: devFormatter })
    : getStreamSink(process.stdout, { formatter: prodFormatter });

  await configure({
    sinks: {
      console: consoleSink,
    },
    filters: {},
    loggers: [
      // Root logger for popper
      {
        category: ['popper'],
        level,
        sinks: ['console'],
      },
      // HTTP request logging
      {
        category: ['popper', 'http'],
        level,
        sinks: ['console'],
      },
      // Elysia internals (less verbose)
      {
        category: ['elysia'],
        level: 'warning',
        sinks: ['console'],
      },
      // LogTape meta logger (suppress info messages)
      {
        category: ['logtape', 'meta'],
        level: 'warning',
        sinks: ['console'],
      },
    ],
  });
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
