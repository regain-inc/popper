/**
 * Control HTTP Client
 *
 * Sends ControlCommandV2 messages to Deutsch instance control endpoints.
 * Handles auth, priority-based timeouts, and retryable classification.
 *
 * @module push-delivery/http-client
 */

import type { ControlCommandV2 } from '../control-v2/types';

/** Target Deutsch instance for push delivery */
export interface ControlTarget {
  instance_id: string;
  organization_id: string;
  control_endpoint: string;
  auth:
    | { mode: 'api_key'; api_key: string }
    | { mode: 'mtls'; cert_path: string; key_path: string; ca_path?: string };
}

/** Result of a single delivery attempt */
export interface DeliveryResult {
  success: boolean;
  status_code?: number;
  response?: unknown;
  error?: string;
  latency_ms: number;
  retryable: boolean;
}

/** Priority-based timeout map (ms) */
const PRIORITY_TIMEOUTS: Record<string, number> = {
  EMERGENCY: 100,
  URGENT: 500,
  ROUTINE: 2000,
};

/** Status codes that indicate a retryable failure */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 503]);

/** Status codes that indicate a non-retryable failure */
const _NON_RETRYABLE_STATUS_CODES = new Set([400, 401, 403, 409]);

/**
 * HTTP client for pushing ControlCommandV2 messages to Deutsch instances.
 * Does NOT retry internally -- callers handle retry logic.
 */
export class ControlHttpClient {
  /**
   * Send a ControlCommandV2 to a target. Does NOT retry internally.
   */
  async send(command: ControlCommandV2, target: ControlTarget): Promise<DeliveryResult> {
    const timeout = this.getTimeout(command.priority);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Hermes-Version': command.hermes_version,
      'X-Command-Priority': command.priority,
      'X-Idempotency-Key': command.idempotency_key,
    };

    if (target.auth.mode === 'api_key') {
      headers['X-API-Key'] = target.auth.api_key;
    }

    const start = performance.now();

    try {
      const response = await fetch(target.control_endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(command),
        keepalive: true,
        signal: AbortSignal.timeout(timeout),
      });

      const latency_ms = performance.now() - start;

      if (response.ok) {
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          body = undefined;
        }

        return {
          success: true,
          status_code: response.status,
          response: body,
          latency_ms,
          retryable: false,
        };
      }

      // Non-2xx response
      const retryable = RETRYABLE_STATUS_CODES.has(response.status);
      let errorText: string;
      try {
        errorText = await response.text();
      } catch {
        errorText = `HTTP ${response.status}`;
      }

      return {
        success: false,
        status_code: response.status,
        error: errorText,
        latency_ms,
        retryable,
      };
    } catch (error: unknown) {
      const latency_ms = performance.now() - start;
      const message = error instanceof Error ? error.message : 'Unknown network error';

      return {
        success: false,
        error: message,
        latency_ms,
        retryable: true,
      };
    }
  }

  /**
   * Get timeout in ms for a given priority level.
   */
  private getTimeout(priority: string): number {
    return PRIORITY_TIMEOUTS[priority] ?? PRIORITY_TIMEOUTS.ROUTINE;
  }
}
