/**
 * LogTape sink for Grafana Loki
 *
 * Pushes structured logs to Loki Push API with batching, retry, and graceful shutdown.
 * Activated when LOKI_URL is set. Console sink always remains active.
 *
 * @module lib/loki-sink
 */

import type { LogRecord, Sink } from '@logtape/logtape';

export interface LokiSinkOptions {
  readonly url: string;
  readonly labels?: Readonly<Record<string, string>>;
  readonly batchSize?: number;
  readonly flushIntervalMs?: number;
  readonly maxRetries?: number;
  readonly retryBaseDelayMs?: number;
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

function renderMessage(message: readonly unknown[]): string {
  return message.map((part) => (typeof part === 'string' ? part : String(part))).join('');
}

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

function msToNs(ms: number): string {
  return `${ms}000000`;
}

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

  if (typeof interval === 'object' && 'unref' in interval) {
    interval.unref();
  }

  function scheduleFlush(): void {
    flushPromise = flushPromise.then(() => flush()).catch(() => {});
  }

  async function flush(): Promise<void> {
    if (buffer.length === 0) return;

    const batch = buffer.splice(0);

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

      if (response.ok) return;

      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxRetries) {
          await sleep(retryBaseDelayMs * 2 ** attempt);
          continue;
        }
      }

      return;
    } catch {
      if (attempt < maxRetries) {
        await sleep(retryBaseDelayMs * 2 ** attempt);
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
