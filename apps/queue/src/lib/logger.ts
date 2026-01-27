/**
 * Logger configuration for queue worker
 * @module lib/logger
 */

import { configure, getConsoleSink, getLogger, type LogLevel } from '@logtape/logtape';
import { config } from './config';

/**
 * Setup logging with LogTape
 */
export async function setupLogger(): Promise<void> {
  await configure({
    sinks: {
      console: getConsoleSink(),
    },
    filters: {},
    loggers: [
      {
        category: 'queue',
        lowestLevel: config.log.level as LogLevel,
        sinks: ['console'],
      },
      {
        category: ['logtape', 'meta'],
        lowestLevel: 'warning',
        sinks: ['console'],
      },
    ],
  });
}

export const logger = getLogger(['queue']);
