/**
 * HTTP request/response logging plugin
 * Logs all requests with structured data
 * @module plugins/http-logger
 */

import { Elysia } from 'elysia';
import { httpLogger } from '../lib/logger';

/**
 * HTTP logging plugin for Elysia
 * Logs request start and response with timing
 */
export const httpLoggerPlugin = new Elysia({ name: 'http-logger' })
  .derive({ as: 'global' }, () => ({
    requestStartTime: Date.now(),
  }))
  .onRequest(({ request }) => {
    const url = new URL(request.url);

    // Skip logging for health/metrics endpoints to reduce noise
    if (
      url.pathname === '/health' ||
      url.pathname === '/live' ||
      url.pathname === '/ready' ||
      url.pathname === '/metrics'
    ) {
      return;
    }

    httpLogger.debug`--> ${request.method} ${url.pathname}`;
  })
  .onAfterResponse(({ request, set, requestStartTime }) => {
    const url = new URL(request.url);

    // Skip logging for health/metrics endpoints
    if (
      url.pathname === '/health' ||
      url.pathname === '/live' ||
      url.pathname === '/ready' ||
      url.pathname === '/metrics'
    ) {
      return;
    }

    const duration = Date.now() - requestStartTime;
    const status = set.status ?? 200;

    httpLogger.info`<-- ${request.method} ${url.pathname} ${status} ${duration}ms`;
  })
  .onError(({ request, error, set }) => {
    const url = new URL(request.url);
    const status = set.status ?? 500;

    httpLogger.error`!!! ${request.method} ${url.pathname} ${status} ${error.message}`;
  });
