/**
 * Operational Settings types
 *
 * Versioned configuration management for staleness thresholds,
 * rate limits, and policy pack selection.
 *
 * @module settings/types
 */

/**
 * Available settings keys
 */
export const SETTINGS_KEYS = [
  'staleness.wellness_hours',
  'staleness.clinical_hours',
  'rate_limit.per_minute',
  'rate_limit.per_hour',
  'policy_pack',
] as const;

export type SettingsKey = (typeof SETTINGS_KEYS)[number];

/**
 * Default values for settings
 */
export const SETTINGS_DEFAULTS: Record<SettingsKey, unknown> = {
  'staleness.wellness_hours': 24,
  'staleness.clinical_hours': 4,
  'rate_limit.per_minute': 1000,
  'rate_limit.per_hour': 50000,
  policy_pack: 'popper-default',
} as const;

/**
 * Typed default getters
 */
export function getDefaultValue<K extends SettingsKey>(key: K): unknown {
  return SETTINGS_DEFAULTS[key];
}

/**
 * Operational setting record (stored in PostgreSQL)
 */
export interface OperationalSetting {
  /** Unique identifier */
  id: string;
  /** Organization ID (null = global default) */
  organization_id: string | null;
  /** Setting key */
  key: SettingsKey;
  /** Setting value (type depends on key) */
  value: unknown;
  /** When this setting becomes effective */
  effective_at: Date;
  /** Who made this change */
  created_by: string;
  /** Reason for the change */
  reason: string | null;
  /** When record was created */
  created_at: Date;
}

/**
 * Request to change a setting
 */
export interface SettingsChangeRequest {
  /** Organization ID (null = global default) */
  organization_id?: string | null;
  /** Setting key to change */
  key: SettingsKey;
  /** New value */
  value: unknown;
  /** Who is making this change */
  created_by: string;
  /** Reason for the change */
  reason?: string;
  /** When to make it effective (defaults to now) */
  effective_at?: Date;
}

/**
 * Effective settings combining global + org-specific overrides
 */
export interface EffectiveSettings {
  /** Effective values for each key */
  values: Record<SettingsKey, unknown>;
  /** Source of each value: 'global' | 'organization' | 'default' */
  sources: Record<SettingsKey, 'global' | 'organization' | 'default'>;
  /** Organization ID if scoped */
  organization_id: string | null;
  /** Snapshot timestamp */
  snapshot_at: string;
}

/**
 * Interface for settings storage (PostgreSQL)
 */
export interface ISettingsStore {
  /**
   * Get the latest setting for a key
   */
  getLatest(organizationId: string | null, key: SettingsKey): Promise<OperationalSetting | null>;

  /**
   * Get all latest settings for an organization
   */
  getAllLatest(organizationId: string | null): Promise<OperationalSetting[]>;

  /**
   * Create a new setting record (versions are append-only)
   */
  create(setting: Omit<OperationalSetting, 'id' | 'created_at'>): Promise<OperationalSetting>;

  /**
   * Get setting history for a key
   */
  getHistory(
    organizationId: string | null,
    key: SettingsKey,
    limit?: number,
  ): Promise<OperationalSetting[]>;
}

/**
 * Interface for settings cache (Redis)
 */
export interface ISettingsCache {
  /**
   * Get cached setting value
   */
  get(organizationId: string | null, key: SettingsKey): Promise<unknown | null>;

  /**
   * Cache a setting value
   */
  set(
    organizationId: string | null,
    key: SettingsKey,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<void>;

  /**
   * Invalidate cached setting
   */
  delete(organizationId: string | null, key: SettingsKey): Promise<void>;

  /**
   * Invalidate all settings for an organization
   */
  deleteAll(organizationId: string | null): Promise<void>;
}

/** Redis key prefix for settings cache */
export const SETTINGS_KEY_PREFIX = 'settings';

/** Default cache TTL in seconds (5 minutes) */
export const SETTINGS_CACHE_TTL_SECONDS = 300;

/** Special organization ID for global settings */
export const GLOBAL_SETTINGS_ORG_ID = '__global__';

/**
 * Check if a key is a valid settings key
 */
export function isValidSettingsKey(key: string): key is SettingsKey {
  return SETTINGS_KEYS.includes(key as SettingsKey);
}
