/**
 * In-memory signal aggregator for testing/development without Redis
 *
 * Implements the same ISignalAggregator interface using a simple Map.
 * Max 10000 events per key (circular buffer behavior).
 *
 * @module in-memory-signal-aggregator
 */

import {
  type AggregatedSignals,
  computeAggregates,
  type ISignalAggregator,
  type SignalEvent,
} from './signal-aggregator';

/** Maximum events stored per org:instance key */
const MAX_EVENTS_PER_KEY = 10_000;

/** Default sliding window in minutes */
const DEFAULT_WINDOW_MINUTES = 60;

/**
 * In-memory signal aggregator backed by a Map.
 *
 * Events are stored in arrays keyed by `{org_id}:{instance_id}`.
 * When the array exceeds MAX_EVENTS_PER_KEY, oldest events are dropped.
 */
export class InMemorySignalAggregator implements ISignalAggregator {
  private readonly store = new Map<string, SignalEvent[]>();

  private buildKey(organizationId: string, instanceId: string): string {
    return `${organizationId}:${instanceId}`;
  }

  async record(event: SignalEvent): Promise<void> {
    const key = this.buildKey(event.organization_id, event.instance_id);

    let events = this.store.get(key);
    if (!events) {
      events = [];
      this.store.set(key, events);
    }

    events.push(event);

    // Circular buffer: drop oldest when exceeding max
    if (events.length > MAX_EVENTS_PER_KEY) {
      events.splice(0, events.length - MAX_EVENTS_PER_KEY);
    }
  }

  async getSignals(
    organizationId: string,
    instanceId: string,
    windowMinutes: number = DEFAULT_WINDOW_MINUTES,
  ): Promise<AggregatedSignals> {
    const key = this.buildKey(organizationId, instanceId);
    const now = Date.now();
    const windowStart = now - windowMinutes * 60 * 1000;

    const allEvents = this.store.get(key) ?? [];
    const windowEvents = allEvents.filter((e) => e.timestamp >= windowStart && e.timestamp <= now);

    return computeAggregates(windowEvents, windowStart, now);
  }

  /** Clear all stored events (for testing) */
  clear(): void {
    this.store.clear();
  }

  /** Get total stored keys (for testing) */
  get size(): number {
    return this.store.size;
  }
}
