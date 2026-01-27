/**
 * Safe-mode manager
 *
 * Manages safe-mode state with fast reads from Redis
 * and audit trail in PostgreSQL.
 *
 * @see docs/specs/02-popper-specs/01-popper-system-spec.md §4.2
 * @module safe-mode/manager
 */

import {
  GLOBAL_ORG_ID,
  type ISafeModeHistoryStore,
  type ISafeModeStateStore,
  type SafeModeChangeRequest,
  type SafeModeState,
} from './types';

export interface SafeModeManagerConfig {
  /** State store (Redis) */
  stateStore: ISafeModeStateStore;
  /** History store (PostgreSQL) */
  historyStore: ISafeModeHistoryStore;
  /** Default organization ID */
  defaultOrgId?: string;
}

/**
 * Safe-mode manager
 *
 * Provides consistent safe-mode state management with:
 * - Fast reads from Redis for supervision pipeline
 * - Audit trail in PostgreSQL for compliance
 * - Snapshot semantics for mid-flight consistency
 */
export class SafeModeManager {
  private readonly stateStore: ISafeModeStateStore;
  private readonly historyStore: ISafeModeHistoryStore;
  private readonly defaultOrgId: string;

  constructor(config: SafeModeManagerConfig) {
    this.stateStore = config.stateStore;
    this.historyStore = config.historyStore;
    this.defaultOrgId = config.defaultOrgId ?? GLOBAL_ORG_ID;
  }

  /**
   * Get current safe-mode state for organization
   *
   * Used by supervision pipeline to check if safe-mode is enabled.
   * Returns null if never set (defaults to disabled).
   */
  async getState(organizationId?: string): Promise<SafeModeState | null> {
    const orgId = organizationId ?? this.defaultOrgId;
    return this.stateStore.get(orgId);
  }

  /**
   * Check if safe-mode is enabled for organization
   *
   * Convenience method for supervision pipeline.
   * Returns false if state is not set.
   */
  async isEnabled(organizationId?: string): Promise<boolean> {
    const state = await this.getState(organizationId);
    return state?.enabled ?? false;
  }

  /**
   * Snapshot safe-mode state for a request
   *
   * Per spec §4.2.1: when Popper starts evaluating a SupervisionRequest,
   * it MUST snapshot the current safe-mode state and use it consistently
   * for the entire evaluation.
   */
  async snapshot(organizationId?: string): Promise<SafeModeState> {
    const state = await this.getState(organizationId);

    // If no state exists, return default (disabled)
    if (!state) {
      const now = new Date().toISOString();
      return {
        enabled: false,
        reason: 'Default state (never configured)',
        triggered_by: 'manual',
        organization_id: organizationId ?? this.defaultOrgId,
        actor_id: null,
        incident_id: null,
        effective_at: now,
        updated_at: now,
      };
    }

    return state;
  }

  /**
   * Change safe-mode state
   *
   * Updates Redis state and records in PostgreSQL history.
   * Both operations are done synchronously for consistency.
   */
  async setState(request: SafeModeChangeRequest): Promise<SafeModeState> {
    const orgId = request.organization_id ?? this.defaultOrgId;
    const now = new Date();
    const effectiveAt = request.effective_at ? new Date(request.effective_at) : now;

    // Build new state
    const state: SafeModeState = {
      enabled: request.enabled,
      reason: request.reason,
      triggered_by: request.triggered_by,
      organization_id: orgId,
      actor_id: request.actor_id ?? null,
      incident_id: request.incident_id ?? null,
      effective_at: effectiveAt.toISOString(),
      updated_at: now.toISOString(),
    };

    // Record in history first (PostgreSQL) - sync write
    await this.historyStore.record({
      organization_id: orgId,
      enabled: request.enabled,
      reason: request.reason,
      triggered_by: request.triggered_by,
      actor_id: request.actor_id ?? null,
      incident_id: request.incident_id ?? null,
      effective_at: effectiveAt,
    });

    // Update state (Redis)
    await this.stateStore.set(state);

    return state;
  }

  /**
   * Enable safe-mode
   *
   * Convenience method for enabling safe-mode.
   */
  async enable(
    reason: string,
    options: {
      organization_id?: string;
      triggered_by?: SafeModeChangeRequest['triggered_by'];
      actor_id?: string;
      incident_id?: string;
    } = {},
  ): Promise<SafeModeState> {
    return this.setState({
      enabled: true,
      reason,
      triggered_by: options.triggered_by ?? 'manual',
      organization_id: options.organization_id,
      actor_id: options.actor_id,
      incident_id: options.incident_id,
    });
  }

  /**
   * Disable safe-mode
   *
   * Convenience method for disabling safe-mode.
   */
  async disable(
    reason: string,
    options: {
      organization_id?: string;
      actor_id?: string;
    } = {},
  ): Promise<SafeModeState> {
    return this.setState({
      enabled: false,
      reason,
      triggered_by: 'manual',
      organization_id: options.organization_id,
      actor_id: options.actor_id,
    });
  }

  /**
   * Get history of safe-mode changes
   */
  async getHistory(organizationId?: string, limit = 100): Promise<SafeModeState[]> {
    const orgId = organizationId ?? this.defaultOrgId;
    const entries = await this.historyStore.getHistory(orgId, limit);

    return entries.map((entry) => ({
      enabled: entry.enabled,
      reason: entry.reason,
      triggered_by: entry.triggered_by,
      organization_id: entry.organization_id,
      actor_id: entry.actor_id,
      incident_id: entry.incident_id,
      effective_at: entry.effective_at.toISOString(),
      updated_at: entry.created_at.toISOString(),
    }));
  }
}
