/**
 * Safe-mode types
 *
 * Safe-mode is a global safety override that routes all non-trivial
 * actions to clinicians when enabled.
 *
 * @see docs/specs/02-popper-specs/01-popper-system-spec.md §4.2
 * @module safe-mode/types
 */

/**
 * How safe-mode was triggered
 */
export type SafeModeTrigger = 'manual' | 'drift_breach' | 'incident';

/**
 * Current safe-mode state (stored in Redis for fast reads)
 */
export interface SafeModeState {
  /** Whether safe-mode is currently enabled */
  enabled: boolean;
  /** Reason for current state */
  reason: string;
  /** How it was triggered */
  triggered_by: SafeModeTrigger;
  /** Organization ID (or 'global' for system-wide) */
  organization_id: string;
  /** Actor who triggered the change (null if automatic) */
  actor_id: string | null;
  /** Linked incident ID if any */
  incident_id: string | null;
  /** When the state became effective */
  effective_at: string;
  /** When the state was last updated */
  updated_at: string;
}

/**
 * Request to change safe-mode state
 */
export interface SafeModeChangeRequest {
  /** Enable or disable safe-mode */
  enabled: boolean;
  /** Reason for the change */
  reason: string;
  /** How it was triggered */
  triggered_by: SafeModeTrigger;
  /** Organization ID (optional, defaults to 'global') */
  organization_id?: string;
  /** Actor who triggered the change */
  actor_id?: string;
  /** Linked incident ID */
  incident_id?: string;
  /** When to make it effective (defaults to now) */
  effective_at?: string;
}

/**
 * History entry for safe-mode changes (stored in PostgreSQL)
 */
export interface SafeModeHistoryEntry {
  id: string;
  organization_id: string;
  enabled: boolean;
  reason: string;
  triggered_by: SafeModeTrigger;
  actor_id: string | null;
  incident_id: string | null;
  effective_at: Date;
  created_at: Date;
}

/**
 * Interface for safe-mode state storage (Redis)
 */
export interface ISafeModeStateStore {
  /** Get current state for organization */
  get(organizationId: string): Promise<SafeModeState | null>;
  /** Set state for organization */
  set(state: SafeModeState): Promise<void>;
  /** Delete state for organization */
  delete(organizationId: string): Promise<void>;
}

/**
 * Interface for safe-mode history storage (PostgreSQL)
 */
export interface ISafeModeHistoryStore {
  /** Record a state change */
  record(entry: Omit<SafeModeHistoryEntry, 'id' | 'created_at'>): Promise<SafeModeHistoryEntry>;
  /** Get history for organization */
  getHistory(organizationId: string, limit?: number): Promise<SafeModeHistoryEntry[]>;
}

/**
 * System organization ID for global/system-wide safe-mode
 * Must match SYSTEM_ORG_ID in @popper/db
 */
export const GLOBAL_ORG_ID = '00000000-0000-0000-0000-000000000000';

/** Redis key prefix for safe-mode state */
export const SAFE_MODE_KEY_PREFIX = 'safe-mode';
