/**
 * Dead-Letter Queue
 *
 * PostgreSQL-backed dead-letter queue for failed ControlCommandV2 commands.
 * Commands that exhaust retries are stored here for manual investigation
 * and resolution.
 *
 * @module push-delivery/dead-letter-queue
 */

import type { DrizzleDB } from '@popper/db';
import { popperControlDeadLetters } from '@popper/db';
import { eq, isNull, sql } from 'drizzle-orm';
import { getDefaultEmitter } from '../audit/emitter';
import type { AuditEventTag } from '../audit/types';
import type { ControlCommandV2 } from '../control-v2/types';

/**
 * DeadLetterQueue stores failed ControlCommandV2 commands in PostgreSQL
 * for manual investigation, retry, and resolution.
 */
export class DeadLetterQueue {
  constructor(private readonly db: DrizzleDB) {}

  /**
   * Add a failed command to the dead-letter queue.
   *
   * Emits an audit event for tracking. If the command has EMERGENCY priority,
   * emits a P0 alert (EMERGENCY_DELIVERY_FAILURE).
   */
  async add(command: ControlCommandV2, failureReason: string, retryCount: number): Promise<void> {
    await this.db.insert(popperControlDeadLetters).values({
      commandId: command.command_id,
      idempotencyKey: command.idempotency_key,
      targetInstanceId: command.target.instance_id ?? 'unknown',
      organizationId: command.target.organization_id ?? 'unknown',
      priority: command.priority,
      commandPayload: command as unknown as Record<string, unknown>,
      failureReason,
      retryCount,
      lastAttemptAt: new Date(),
    });

    // Emit audit event
    getDefaultEmitter()
      .emit({
        eventType: 'CONTROL_COMMAND_TIMEOUT',
        traceId: command.command_id,
        subjectId: 'system',
        organizationId: command.target.organization_id ?? 'unknown',
        policyPackVersion: 'N/A',
        payload: {
          command_id: command.command_id,
          failure_reason: failureReason,
          retry_count: retryCount,
          priority: command.priority,
        },
        tags: ['control_v2'] as AuditEventTag[],
      })
      .catch(() => {});

    // P0 alert for EMERGENCY priority failures
    if (command.priority === 'EMERGENCY') {
      getDefaultEmitter()
        .emit({
          eventType: 'CONTROL_COMMAND_TIMEOUT',
          traceId: command.command_id,
          subjectId: 'system',
          organizationId: command.target.organization_id ?? 'unknown',
          policyPackVersion: 'N/A',
          payload: {
            command_id: command.command_id,
            failure_reason: failureReason,
            severity: 'P0',
            alert_type: 'EMERGENCY_DELIVERY_FAILURE',
          },
          tags: ['control_v2'] as AuditEventTag[],
        })
        .catch(() => {});
    }
  }

  /**
   * Get all unresolved dead-letter entries.
   * Optionally filter by target instance ID.
   */
  async getUnresolved(targetInstanceId?: string): Promise<unknown[]> {
    if (targetInstanceId) {
      return this.db
        .select()
        .from(popperControlDeadLetters)
        .where(
          sql`${popperControlDeadLetters.resolvedAt} IS NULL AND ${popperControlDeadLetters.targetInstanceId} = ${targetInstanceId}`,
        );
    }

    return this.db
      .select()
      .from(popperControlDeadLetters)
      .where(isNull(popperControlDeadLetters.resolvedAt));
  }

  /**
   * Retrieve a dead-letter entry for retry.
   * Returns the command payload if the entry exists and is not resolved, null otherwise.
   */
  async retry(id: number): Promise<ControlCommandV2 | null> {
    const results = await this.db
      .select()
      .from(popperControlDeadLetters)
      .where(eq(popperControlDeadLetters.id, id));

    const entry = results[0];
    if (!entry || entry.resolvedAt !== null) {
      return null;
    }

    return entry.commandPayload as unknown as ControlCommandV2;
  }

  /**
   * Mark a dead-letter entry as resolved.
   */
  async resolve(id: number): Promise<void> {
    await this.db
      .update(popperControlDeadLetters)
      .set({ resolvedAt: new Date() })
      .where(eq(popperControlDeadLetters.id, id));
  }

  /**
   * Get the count of unresolved dead-letter entries.
   */
  async getDepth(): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(popperControlDeadLetters)
      .where(isNull(popperControlDeadLetters.resolvedAt));

    return Number(result[0]?.count ?? 0);
  }
}
