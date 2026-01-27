/**
 * Safe-mode storage implementations
 *
 * @module safe-mode/stores
 */

import type { Redis } from 'ioredis';
import type {
  ISafeModeHistoryStore,
  ISafeModeStateStore,
  SafeModeHistoryEntry,
  SafeModeState,
} from './types';
import { SAFE_MODE_KEY_PREFIX } from './types';

/**
 * Redis-based safe-mode state store
 *
 * Provides fast reads for the supervision pipeline.
 */
export class RedisSafeModeStateStore implements ISafeModeStateStore {
  constructor(private readonly redis: Redis) {}

  private buildKey(organizationId: string): string {
    return `${SAFE_MODE_KEY_PREFIX}:${organizationId}`;
  }

  async get(organizationId: string): Promise<SafeModeState | null> {
    const key = this.buildKey(organizationId);
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data) as SafeModeState;
  }

  async set(state: SafeModeState): Promise<void> {
    const key = this.buildKey(state.organization_id);
    await this.redis.set(key, JSON.stringify(state));
  }

  async delete(organizationId: string): Promise<void> {
    const key = this.buildKey(organizationId);
    await this.redis.del(key);
  }
}

/**
 * In-memory safe-mode state store for testing/development
 */
export class InMemorySafeModeStateStore implements ISafeModeStateStore {
  private readonly states = new Map<string, SafeModeState>();

  async get(organizationId: string): Promise<SafeModeState | null> {
    return this.states.get(organizationId) ?? null;
  }

  async set(state: SafeModeState): Promise<void> {
    this.states.set(state.organization_id, state);
  }

  async delete(organizationId: string): Promise<void> {
    this.states.delete(organizationId);
  }

  /** Clear all states (for testing) */
  clear(): void {
    this.states.clear();
  }

  /** Get all states (for testing) */
  getAll(): SafeModeState[] {
    return Array.from(this.states.values());
  }
}

/**
 * In-memory safe-mode history store for testing/development
 */
export class InMemorySafeModeHistoryStore implements ISafeModeHistoryStore {
  private readonly entries: SafeModeHistoryEntry[] = [];
  private sequence = 0;
  private readonly sequenceMap = new Map<string, number>();

  async record(
    entry: Omit<SafeModeHistoryEntry, 'id' | 'created_at'>,
  ): Promise<SafeModeHistoryEntry> {
    const id = crypto.randomUUID();
    const fullEntry: SafeModeHistoryEntry = {
      ...entry,
      id,
      created_at: new Date(),
    };

    // Track insertion order for stable sorting
    this.sequenceMap.set(id, this.sequence++);
    this.entries.push(fullEntry);
    return fullEntry;
  }

  async getHistory(organizationId: string, limit = 100): Promise<SafeModeHistoryEntry[]> {
    return this.entries
      .filter((e) => e.organization_id === organizationId)
      .sort((a, b) => {
        // Sort by time descending, then by insertion order descending for equal times
        const timeDiff = b.created_at.getTime() - a.created_at.getTime();
        if (timeDiff !== 0) return timeDiff;
        return (this.sequenceMap.get(b.id) ?? 0) - (this.sequenceMap.get(a.id) ?? 0);
      })
      .slice(0, limit);
  }

  /** Clear all entries (for testing) */
  clear(): void {
    this.entries.length = 0;
    this.sequenceMap.clear();
    this.sequence = 0;
  }

  /** Get all entries (for testing) */
  getAll(): SafeModeHistoryEntry[] {
    return [...this.entries];
  }
}
