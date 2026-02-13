/**
 * Desired-State Manager
 *
 * Manages the desired configuration state for Popper instances.
 * Uses optimistic concurrency (version column) for safe updates
 * and logs all mutations to the audit log table.
 *
 * Mode conservatism order: NORMAL < RESTRICTED < SAFE_MODE < MAINTENANCE
 *
 * @module desired-state/manager
 */

import { and, type DrizzleDB, eq, popperDesiredState, popperDesiredStateLog } from '@popper/db';

/** Mode conservatism levels (higher = more conservative) */
const MODE_LEVELS: Record<string, number> = {
  NORMAL: 0,
  RESTRICTED: 1,
  SAFE_MODE: 2,
  MAINTENANCE: 3,
};

/** Input for updating desired state */
export interface DesiredStateUpdate {
  settings?: Array<{
    key: string;
    value: unknown;
    reason?: string;
    auto_revert_at?: string;
  }>;
  mode?: string;
  triggered_by: string;
  command_id?: string;
}

/** Result of a divergence computation */
export interface StateDivergence {
  divergent_settings: Array<{
    key: string;
    desired: unknown;
    actual: unknown;
  }>;
  mode_divergence?: {
    desired: string;
    actual: string;
  };
}

/** Desired state row as returned by the manager */
export interface DesiredStateRow {
  instance_id: string;
  organization_id: string;
  desired_settings: Record<string, unknown>;
  desired_mode: string;
  last_actual_state: Record<string, unknown> | null;
  last_reconciliation_at: Date | null;
  version: number;
  updated_at: Date;
  created_at: Date;
}

/**
 * DesiredStateManager — orchestrates desired-state CRUD with
 * optimistic concurrency and full audit logging.
 */
export class DesiredStateManager {
  constructor(private readonly db: DrizzleDB) {}

  /**
   * Get desired state for an instance, creating a default row if none exists.
   */
  async getDesiredState(instanceId: string, orgId: string): Promise<DesiredStateRow> {
    const [existing] = await this.db
      .select()
      .from(popperDesiredState)
      .where(
        and(
          eq(popperDesiredState.instanceId, instanceId),
          eq(popperDesiredState.organizationId, orgId),
        ),
      )
      .limit(1);

    if (existing) {
      return this.toRow(existing);
    }

    // Create default row
    const [inserted] = await this.db
      .insert(popperDesiredState)
      .values({
        instanceId,
        organizationId: orgId,
        desiredSettings: {},
        desiredMode: 'NORMAL',
        version: 1,
      })
      .onConflictDoNothing()
      .returning();

    // Handle race condition: another process might have inserted between SELECT and INSERT
    if (!inserted) {
      const [row] = await this.db
        .select()
        .from(popperDesiredState)
        .where(
          and(
            eq(popperDesiredState.instanceId, instanceId),
            eq(popperDesiredState.organizationId, orgId),
          ),
        )
        .limit(1);
      return this.toRow(row);
    }

    await this.log(instanceId, orgId, 'created', { mode: 'NORMAL', settings: {} }, 'system');

    return this.toRow(inserted);
  }

  /**
   * Update desired state with optimistic concurrency.
   *
   * @throws Error if version mismatch (concurrent update detected)
   */
  async updateDesiredState(
    instanceId: string,
    orgId: string,
    update: DesiredStateUpdate,
  ): Promise<DesiredStateRow> {
    const current = await this.getDesiredState(instanceId, orgId);
    const newSettings = { ...current.desired_settings };
    const changes: Record<string, unknown> = {};

    // Apply settings updates
    if (update.settings) {
      for (const { key, value, auto_revert_at } of update.settings) {
        newSettings[key] = auto_revert_at ? { value, auto_revert_at } : value;
        changes[`setting.${key}`] = { from: current.desired_settings[key], to: value };
      }
    }

    const newMode = update.mode ?? current.desired_mode;
    if (update.mode && update.mode !== current.desired_mode) {
      changes.mode = { from: current.desired_mode, to: update.mode };
    }

    const [updated] = await this.db
      .update(popperDesiredState)
      .set({
        desiredSettings: newSettings,
        desiredMode: newMode,
        version: current.version + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(popperDesiredState.instanceId, instanceId),
          eq(popperDesiredState.organizationId, orgId),
          eq(popperDesiredState.version, current.version),
        ),
      )
      .returning();

    if (!updated) {
      throw new Error(
        `Optimistic concurrency conflict: version ${current.version} no longer current for ${instanceId}/${orgId}`,
      );
    }

    await this.log(instanceId, orgId, 'updated', changes, update.triggered_by, update.command_id);

    return this.toRow(updated);
  }

  /**
   * Store the latest actual state snapshot and update reconciliation timestamp.
   */
  async updateActualState(
    instanceId: string,
    orgId: string,
    snapshot: Record<string, unknown>,
  ): Promise<void> {
    await this.db
      .update(popperDesiredState)
      .set({
        lastActualState: snapshot,
        lastReconciliationAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(popperDesiredState.instanceId, instanceId),
          eq(popperDesiredState.organizationId, orgId),
        ),
      );
  }

  /**
   * Compare desired vs actual state and return divergent fields.
   */
  computeDivergence(
    desiredState: DesiredStateRow,
    actualSnapshot: Record<string, unknown>,
  ): StateDivergence {
    const result: StateDivergence = { divergent_settings: [] };

    // Compare settings
    const desiredSettings = desiredState.desired_settings;
    for (const key of Object.keys(desiredSettings)) {
      const desiredValue = desiredSettings[key];
      // Unwrap auto_revert_at wrapper
      const effectiveDesired =
        desiredValue &&
        typeof desiredValue === 'object' &&
        'value' in (desiredValue as Record<string, unknown>)
          ? (desiredValue as Record<string, unknown>).value
          : desiredValue;

      const actualValue = actualSnapshot[key];

      if (JSON.stringify(effectiveDesired) !== JSON.stringify(actualValue)) {
        result.divergent_settings.push({
          key,
          desired: effectiveDesired,
          actual: actualValue ?? null,
        });
      }
    }

    // Compare mode
    const actualMode = (actualSnapshot.mode as string) ?? 'NORMAL';
    if (desiredState.desired_mode !== actualMode) {
      result.mode_divergence = {
        desired: desiredState.desired_mode,
        actual: actualMode,
      };
    }

    return result;
  }

  /**
   * Accept a self-transition if the actual mode is MORE conservative.
   *
   * If the instance has autonomously moved to a more restrictive mode
   * (e.g. NORMAL → SAFE_MODE), accept it by updating desired mode to match.
   *
   * @returns true if desired mode was updated, false otherwise
   */
  async acceptSelfTransition(
    instanceId: string,
    orgId: string,
    actualMode: string,
  ): Promise<boolean> {
    const current = await this.getDesiredState(instanceId, orgId);
    const desiredLevel = MODE_LEVELS[current.desired_mode] ?? 0;
    const actualLevel = MODE_LEVELS[actualMode] ?? 0;

    if (actualLevel <= desiredLevel) {
      return false; // Actual is not more conservative
    }

    await this.updateDesiredState(instanceId, orgId, {
      mode: actualMode,
      triggered_by: 'self_transition',
    });

    return true;
  }

  /**
   * Find settings with expired auto_revert_at and revert them.
   *
   * @returns Array of keys that were reverted
   */
  async processAutoReverts(instanceId: string, orgId: string): Promise<string[]> {
    const current = await this.getDesiredState(instanceId, orgId);
    const now = new Date();
    const revertedKeys: string[] = [];
    const newSettings = { ...current.desired_settings };

    for (const [key, value] of Object.entries(newSettings)) {
      if (
        value &&
        typeof value === 'object' &&
        'auto_revert_at' in (value as Record<string, unknown>)
      ) {
        const revertAt = new Date((value as Record<string, unknown>).auto_revert_at as string);
        if (revertAt <= now) {
          delete newSettings[key];
          revertedKeys.push(key);
        }
      }
    }

    if (revertedKeys.length === 0) return [];

    const [updated] = await this.db
      .update(popperDesiredState)
      .set({
        desiredSettings: newSettings,
        version: current.version + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(popperDesiredState.instanceId, instanceId),
          eq(popperDesiredState.organizationId, orgId),
          eq(popperDesiredState.version, current.version),
        ),
      )
      .returning();

    if (!updated) {
      throw new Error(
        `Optimistic concurrency conflict during auto-revert for ${instanceId}/${orgId}`,
      );
    }

    await this.log(instanceId, orgId, 'auto_reverted', { reverted_keys: revertedKeys }, 'system');

    return revertedKeys;
  }

  /**
   * Append an entry to the desired-state audit log.
   */
  private async log(
    instanceId: string,
    orgId: string,
    changeType: string,
    changes: Record<string, unknown>,
    triggeredBy: string,
    commandId?: string,
  ): Promise<void> {
    await this.db.insert(popperDesiredStateLog).values({
      instanceId,
      organizationId: orgId,
      changeType,
      changes,
      triggeredBy,
      commandId: commandId ?? null,
    });
  }

  private toRow(row: typeof popperDesiredState.$inferSelect): DesiredStateRow {
    return {
      instance_id: row.instanceId,
      organization_id: row.organizationId,
      desired_settings: (row.desiredSettings ?? {}) as Record<string, unknown>,
      desired_mode: row.desiredMode,
      last_actual_state: (row.lastActualState as Record<string, unknown>) ?? null,
      last_reconciliation_at: row.lastReconciliationAt,
      version: row.version,
      updated_at: row.updatedAt,
      created_at: row.createdAt,
    };
  }
}
