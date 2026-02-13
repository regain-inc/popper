/**
 * DeadLetterQueue Tests
 */

import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { DrizzleDB } from '@popper/db';
import { AuditEmitter, InMemoryAuditStorage, setDefaultEmitter } from '../audit/emitter';
import type { ControlCommandV2 } from '../control-v2/types';
import { DeadLetterQueue } from './dead-letter-queue';

/** Create a DLQ with a mock DB, containing the type cast in one place */
function makeDlq(mockDb: ReturnType<typeof createMockDb>) {
  return new DeadLetterQueue(mockDb as unknown as DrizzleDB);
}

// =============================================================================
// Helpers
// =============================================================================

function makeCommand(overrides?: Partial<ControlCommandV2>): ControlCommandV2 {
  return {
    hermes_version: '2.0.0',
    message_type: 'control_command_v2',
    command_id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    source: { system: 'popper', service_version: '1.0.0' },
    target: {
      system: 'deutsch',
      instance_id: 'deutsch-1',
      organization_id: 'org-1',
    },
    kind: 'SET_OPERATIONAL_SETTINGS',
    priority: 'ROUTINE',
    settings: [{ key: 'test', value: 1 }],
    idempotency_key: crypto.randomUUID(),
    audit_redaction: { redact: false },
    ...overrides,
  };
}

// =============================================================================
// Mock DB
// =============================================================================

interface MockDeadLetterRow {
  id: number;
  commandId: string;
  idempotencyKey: string;
  targetInstanceId: string;
  organizationId: string;
  priority: string;
  commandPayload: Record<string, unknown>;
  failureReason: string;
  retryCount: number;
  lastAttemptAt: Date;
  resolvedAt: Date | null;
  createdAt: Date;
}

let rows: MockDeadLetterRow[];
let nextId: number;
let auditStorage: InMemoryAuditStorage;

function createMockDb() {
  // Mock chainable query builder
  const createSelectChain = (filterFn?: (row: MockDeadLetterRow) => boolean) => {
    let _fromCalled = false;
    return {
      from: mock(() => {
        _fromCalled = true;
        const chain = {
          where: mock(() => {
            const filtered = filterFn ? rows.filter(filterFn) : rows;
            return Promise.resolve(filtered);
          }),
        };
        return chain;
      }),
    };
  };

  // biome-ignore lint/suspicious/noExplicitAny: mock DB stubs
  const mockDb: any = {
    insert: mock((_table: unknown) => ({
      values: mock((values: Record<string, unknown>) => {
        const row: MockDeadLetterRow = {
          id: nextId++,
          commandId: values.commandId,
          idempotencyKey: values.idempotencyKey,
          targetInstanceId: values.targetInstanceId,
          organizationId: values.organizationId,
          priority: values.priority,
          commandPayload: values.commandPayload,
          failureReason: values.failureReason,
          retryCount: values.retryCount,
          lastAttemptAt: values.lastAttemptAt,
          resolvedAt: null,
          createdAt: new Date(),
        };
        rows.push(row);
        return Promise.resolve();
      }),
    })),

    select: mock((columns?: Record<string, unknown>) => {
      if (columns && columns.count !== undefined) {
        // count query
        return {
          from: mock(() => ({
            where: mock(() => {
              const unresolvedCount = rows.filter((r) => r.resolvedAt === null).length;
              return Promise.resolve([{ count: unresolvedCount }]);
            }),
          })),
        };
      }
      // Normal select - returns all columns
      return createSelectChain();
    }),

    update: mock((_table: unknown) => ({
      set: mock((_values: unknown) => ({
        where: mock((_condition: unknown) => {
          // Simple mock: resolve the row based on the most recent update call context
          // We track the id from the test's perspective
          return Promise.resolve();
        }),
      })),
    })),
  };

  return mockDb;
}

// Specialized mock DB that supports the actual query patterns
function _createTestDb() {
  const db = {
    _rows: rows,

    insert: mock(() => ({
      values: mock((values: Record<string, unknown>) => {
        const row: MockDeadLetterRow = {
          id: nextId++,
          ...(values as Omit<MockDeadLetterRow, 'id' | 'resolvedAt' | 'createdAt'>),
          resolvedAt: null,
          createdAt: new Date(),
        };
        rows.push(row);
        return Promise.resolve();
      }),
    })),

    select: mock((...args: unknown[]) => {
      const isCount = args.length > 0 && args[0]?.count !== undefined;

      return {
        from: mock(() => ({
          where: mock(() => {
            if (isCount) {
              const count = rows.filter((r) => r.resolvedAt === null).length;
              return Promise.resolve([{ count }]);
            }
            // For select() with no count, return unresolved rows
            // The actual filtering depends on the where clause,
            // but for our mock we return all unresolved by default
            return Promise.resolve(rows.filter((r) => r.resolvedAt === null));
          }),
        })),
      };
    }),

    update: mock(() => ({
      set: mock((_values: unknown) => ({
        where: mock(() => {
          // Find the row and update it
          // In tests, we track the target id separately
          return Promise.resolve();
        }),
      })),
    })),
  };

  return db;
}

beforeEach(() => {
  rows = [];
  nextId = 1;
  auditStorage = new InMemoryAuditStorage();
  setDefaultEmitter(new AuditEmitter(auditStorage, { batchEnabled: false, asyncWrites: false }));
});

// =============================================================================
// Tests: add()
// =============================================================================

describe('DeadLetterQueue.add', () => {
  test('inserts command into dead-letter table', async () => {
    const mockDb = createMockDb();
    const dlq = makeDlq(mockDb);
    const command = makeCommand();

    await dlq.add(command, 'Server error', 3);

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].commandId).toBe(command.command_id);
    expect(rows[0].failureReason).toBe('Server error');
    expect(rows[0].retryCount).toBe(3);
    expect(rows[0].priority).toBe('ROUTINE');
    expect(rows[0].targetInstanceId).toBe('deutsch-1');
    expect(rows[0].organizationId).toBe('org-1');
  });

  test('emits audit event on add', async () => {
    const mockDb = createMockDb();
    const dlq = makeDlq(mockDb);
    const command = makeCommand();

    await dlq.add(command, 'Network timeout', 5);

    const events = auditStorage.getEvents();
    expect(events.length).toBeGreaterThanOrEqual(1);

    const deadLetterEvent = events.find(
      (e) =>
        e.eventType === 'CONTROL_COMMAND_TIMEOUT' && e.payload?.command_id === command.command_id,
    );
    expect(deadLetterEvent).toBeDefined();
  });

  test('emits P0 alert for EMERGENCY priority', async () => {
    const mockDb = createMockDb();
    const dlq = makeDlq(mockDb);
    const command = makeCommand({ priority: 'EMERGENCY' });

    await dlq.add(command, 'Delivery failed', 5);

    const events = auditStorage.getEvents();
    const p0Event = events.find(
      (e) => e.payload?.severity === 'P0' && e.payload?.alert_type === 'EMERGENCY_DELIVERY_FAILURE',
    );
    expect(p0Event).toBeDefined();
  });

  test('does not emit P0 alert for ROUTINE priority', async () => {
    const mockDb = createMockDb();
    const dlq = makeDlq(mockDb);
    const command = makeCommand({ priority: 'ROUTINE' });

    await dlq.add(command, 'Delivery failed', 5);

    const events = auditStorage.getEvents();
    const p0Event = events.find((e) => e.payload?.severity === 'P0');
    expect(p0Event).toBeUndefined();
  });

  test('handles missing instance_id and organization_id', async () => {
    const mockDb = createMockDb();
    const dlq = makeDlq(mockDb);
    const command = makeCommand({
      target: { system: 'deutsch' },
    });

    await dlq.add(command, 'No target', 0);

    expect(rows[0].targetInstanceId).toBe('unknown');
    expect(rows[0].organizationId).toBe('unknown');
  });
});

// =============================================================================
// Tests: getUnresolved()
// =============================================================================

describe('DeadLetterQueue.getUnresolved', () => {
  test('returns unresolved entries', async () => {
    const mockDb = createMockDb();
    const dlq = makeDlq(mockDb);

    // Add two commands
    await dlq.add(makeCommand(), 'Error 1', 1);
    await dlq.add(makeCommand(), 'Error 2', 2);

    const entries = await dlq.getUnresolved();
    expect(entries).toHaveLength(2);
  });

  test('returns empty array when no entries', async () => {
    const mockDb = createMockDb();
    const dlq = makeDlq(mockDb);

    const entries = await dlq.getUnresolved();
    expect(entries).toHaveLength(0);
  });
});

// =============================================================================
// Tests: retry()
// =============================================================================

describe('DeadLetterQueue.retry', () => {
  test('returns command payload for unresolved entry', async () => {
    const mockDb = createMockDb();
    const dlq = makeDlq(mockDb);
    const command = makeCommand();

    await dlq.add(command, 'Error', 3);

    // Override select for retry (needs to find by id)
    mockDb.select.mockImplementationOnce(() => ({
      from: mock(() => ({
        where: mock(() => Promise.resolve([rows[0]])),
      })),
    }));

    const result = await dlq.retry(1);
    expect(result).not.toBeNull();
    expect((result as unknown as ControlCommandV2).command_id).toBe(command.command_id);
  });

  test('returns null for resolved entry', async () => {
    const mockDb = createMockDb();
    const dlq = makeDlq(mockDb);
    const command = makeCommand();

    await dlq.add(command, 'Error', 3);
    rows[0].resolvedAt = new Date();

    mockDb.select.mockImplementationOnce(() => ({
      from: mock(() => ({
        where: mock(() => Promise.resolve([rows[0]])),
      })),
    }));

    const result = await dlq.retry(1);
    expect(result).toBeNull();
  });

  test('returns null for non-existent entry', async () => {
    const mockDb = createMockDb();
    const dlq = makeDlq(mockDb);

    mockDb.select.mockImplementationOnce(() => ({
      from: mock(() => ({
        where: mock(() => Promise.resolve([])),
      })),
    }));

    const result = await dlq.retry(999);
    expect(result).toBeNull();
  });
});

// =============================================================================
// Tests: resolve()
// =============================================================================

describe('DeadLetterQueue.resolve', () => {
  test('marks entry as resolved', async () => {
    const mockDb = createMockDb();
    const dlq = makeDlq(mockDb);

    await dlq.add(makeCommand(), 'Error', 3);
    await dlq.resolve(1);

    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// Tests: getDepth()
// =============================================================================

describe('DeadLetterQueue.getDepth', () => {
  test('returns count of unresolved entries', async () => {
    const mockDb = createMockDb();
    const dlq = makeDlq(mockDb);

    await dlq.add(makeCommand(), 'Error 1', 1);
    await dlq.add(makeCommand(), 'Error 2', 2);

    // Override select for count query
    mockDb.select.mockImplementationOnce((_columns: unknown) => ({
      from: mock(() => ({
        where: mock(() => {
          const count = rows.filter((r) => r.resolvedAt === null).length;
          return Promise.resolve([{ count }]);
        }),
      })),
    }));

    const depth = await dlq.getDepth();
    expect(depth).toBe(2);
  });

  test('returns 0 when no unresolved entries', async () => {
    const mockDb = createMockDb();
    const dlq = makeDlq(mockDb);

    mockDb.select.mockImplementationOnce((_columns: unknown) => ({
      from: mock(() => ({
        where: mock(() => Promise.resolve([{ count: 0 }])),
      })),
    }));

    const depth = await dlq.getDepth();
    expect(depth).toBe(0);
  });
});
