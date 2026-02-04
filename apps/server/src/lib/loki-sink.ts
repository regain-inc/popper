/**
 * LogTape sink for Grafana Loki
 *
 * Pushes structured logs to Loki Push API with:
 *   - Batching (configurable size + interval)
 *   - Low-cardinality labels for Loki indexing (service, environment, level)
 *   - Structured metadata (category, traceId) — filterable but not indexed
 *   - Retry with exponential backoff on failure
 *   - Graceful shutdown via AsyncDisposable (flushes pending logs)
 *
 * Activated when LOKI_URL is set. Console sink always remains active.
 *
 * @module lib/loki-sink
 */

import type { LogRecord, Sink } from '@logtape/logtape';

export interface LokiSinkOptions {
  /** Loki base URL (e.g. http://loki:3100) */
  readonly url: string;
  /** Static labels applied to every log stream */
  readonly labels?: Readonly<Record<string, string>>;
  /** Max records to buffer before triggering flush (default: 100) */
  readonly batchSize?: number;
  /** Auto-flush interval in ms (default: 1000) */
  readonly flushIntervalMs?: number;
  /** Max retry attempts per flush (default: 3) */
  readonly maxRetries?: number;
  /** Base delay for exponential backoff in ms (default: 500) */
  readonly retryBaseDelayMs?: number;
  /** Additional HTTP headers (e.g. for Loki auth) */
  readonly headers?: Readonly<Record<string, string>>;
}

interface LokiStream {
  stream: Record<string, string>;
  values: [string, string, Record<string, string>?][];
}

interface LokiPushBody {
  streams: LokiStream[];
}

interface BufferedEntry {
  readonly timestampNs: string;
  readonly line: string;
  readonly level: string;
  readonly metadata: Record<string, string>;
}

/**
 * Render a LogRecord's message array into a plain string.
 * LogTape message is `readonly unknown[]` with interleaved template + values.
 */
function renderMessage(message: readonly unknown[]): string {
  return message.map((part) => (typeof part === 'string' ? part : String(part))).join('');
}

/**
 * Format a LogRecord as a JSON log line for Loki.
 */
function formatLogLine(record: LogRecord): string {
  return JSON.stringify({
    level: record.level,
    category: record.category.join('.'),
    message: renderMessage(record.message),
    timestamp: new Date(record.timestamp).toISOString(),
    ...(Object.keys(record.properties).length > 0 && {
      properties: record.properties,
    }),
  });
}

/**
 * Convert ms timestamp to nanosecond string (Loki requirement).
 */
function msToNs(ms: number): string {
  return `${ms}000000`;
}

/**
 * Create a LogTape sink that pushes logs to Grafana Loki.
 *
 * Returns a Sink function with AsyncDisposable support for graceful shutdown.
 * The sink buffers records and flushes them in batches to reduce HTTP overhead.
 */
export function createLokiSink(options: LokiSinkOptions): Sink & AsyncDisposable {
  const pushUrl = `${options.url.replace(/\/$/, '')}/loki/api/v1/push`;
  const staticLabels = options.labels ?? {};
  const batchSize = options.batchSize ?? 100;
  const flushIntervalMs = options.flushIntervalMs ?? 1000;
  const maxRetries = options.maxRetries ?? 3;
  const retryBaseDelayMs = options.retryBaseDelayMs ?? 500;
  const extraHeaders = options.headers ?? {};

  const buffer: BufferedEntry[] = [];
  let flushPromise: Promise<void> = Promise.resolve();
  let disposed = false;

  const interval = setInterval(() => {
    scheduleFlush();
  }, flushIntervalMs);

  // Unref the interval so it doesn't keep the process alive
  if (typeof interval === 'object' && 'unref' in interval) {
    interval.unref();
  }

  /**
   * Chain flush operations to preserve ordering.
   */
  function scheduleFlush(): void {
    flushPromise = flushPromise.then(() => flush()).catch(() => {});
  }

  /**
   * Flush buffered entries to Loki, grouped by level label.
   */
  async function flush(): Promise<void> {
    if (buffer.length === 0) return;

    const batch = buffer.splice(0);

    // Group entries by level (Loki streams are per-label-set)
    const byLevel = new Map<string, BufferedEntry[]>();
    for (const entry of batch) {
      const existing = byLevel.get(entry.level);
      if (existing) {
        existing.push(entry);
      } else {
        byLevel.set(entry.level, [entry]);
      }
    }

    const streams: LokiStream[] = [];
    for (const [level, entries] of byLevel) {
      streams.push({
        stream: { ...staticLabels, level },
        values: entries.map((e) => [e.timestampNs, e.line, e.metadata]),
      });
    }

    const body: LokiPushBody = { streams };
    await sendWithRetry(pushUrl, body, maxRetries, retryBaseDelayMs, extraHeaders);
  }

  /**
   * The sink function — called synchronously by LogTape for each record.
   */
  const sink: Sink & AsyncDisposable = Object.assign(
    (record: LogRecord): void => {
      if (disposed) return;

      buffer.push({
        timestampNs: msToNs(record.timestamp),
        line: formatLogLine(record),
        level: record.level,
        metadata: {
          category: record.category.join('.'),
        },
      });

      if (buffer.length >= batchSize) {
        scheduleFlush();
      }
    },
    {
      [Symbol.asyncDispose]: async (): Promise<void> => {
        disposed = true;
        clearInterval(interval);
        await flushPromise;
        await flush();
      },
    },
  );

  return sink;
}

/**
 * Send a batch to Loki with exponential backoff retry.
 */
async function sendWithRetry(
  url: string,
  body: LokiPushBody,
  maxRetries: number,
  retryBaseDelayMs: number,
  extraHeaders: Readonly<Record<string, string>>,
): Promise<void> {
  const payload = JSON.stringify(body);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...extraHeaders,
        },
        body: payload,
      });

      // 204 No Content = success, 2xx = success
      if (response.ok) return;

      // 429 Too Many Requests or 5xx — retryable
      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxRetries) {
          await sleep(retryBaseDelayMs * 2 ** attempt);
          continue;
        }
      }

      // 4xx (except 429) — not retryable, drop batch
      return;
    } catch {
      // Network error — retry
      if (attempt < maxRetries) {
        await sleep(retryBaseDelayMs * 2 ** attempt);
      }
      // All retries exhausted — silently drop batch
      // (logging from a logger sink would cause infinite recursion)
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
