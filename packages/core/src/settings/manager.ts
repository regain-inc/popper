/**
 * Settings manager
 *
 * Manages operational settings with fast reads from cache
 * and versioned history in PostgreSQL.
 *
 * @module settings/manager
 */

import {
  type EffectiveSettings,
  type ISettingsCache,
  type ISettingsStore,
  type OperationalSetting,
  SETTINGS_DEFAULTS,
  SETTINGS_KEYS,
  type SettingsChangeRequest,
  type SettingsKey,
} from './types';

export interface SettingsManagerConfig {
  /** Settings store (PostgreSQL) */
  store: ISettingsStore;
  /** Settings cache (Redis) */
  cache: ISettingsCache;
}

/**
 * Settings manager
 *
 * Provides consistent settings management with:
 * - Fast reads from cache for supervision pipeline
 * - Versioned history in PostgreSQL for audit
 * - Inheritance: org settings override global settings
 */
export class SettingsManager {
  private readonly store: ISettingsStore;
  private readonly cache: ISettingsCache;

  constructor(config: SettingsManagerConfig) {
    this.store = config.store;
    this.cache = config.cache;
  }

  /**
   * Get a single setting value
   *
   * Resolution order:
   * 1. Cache (if available)
   * 2. Database (if not in cache)
   * 3. Default value
   *
   * Does NOT apply inheritance - use getEffectiveSettings for that.
   */
  async getSetting<T = unknown>(organizationId: string | null, key: SettingsKey): Promise<T> {
    // Try cache first
    const cached = await this.cache.get(organizationId, key);
    if (cached !== null) {
      return cached as T;
    }

    // Try database
    const setting = await this.store.getLatest(organizationId, key);
    if (setting) {
      // Cache for future reads (fire and forget)
      this.cache.set(organizationId, key, setting.value).catch(() => {});
      return setting.value as T;
    }

    // Return default
    return SETTINGS_DEFAULTS[key] as T;
  }

  /**
   * Set a setting value
   *
   * Creates a new version record (settings are append-only).
   * Invalidates cache after write.
   */
  async setSetting(request: SettingsChangeRequest): Promise<OperationalSetting> {
    const effectiveAt = request.effective_at ?? new Date();

    const setting = await this.store.create({
      organization_id: request.organization_id ?? null,
      key: request.key,
      value: request.value,
      effective_at: effectiveAt,
      created_by: request.created_by,
      reason: request.reason ?? null,
    });

    // Invalidate cache
    await this.cache.delete(request.organization_id ?? null, request.key);

    return setting;
  }

  /**
   * Get all settings for an organization (direct values only)
   *
   * Does NOT apply inheritance - use getEffectiveSettings for that.
   */
  async getAllSettings(
    organizationId: string | null,
  ): Promise<Partial<Record<SettingsKey, unknown>>> {
    const settings = await this.store.getAllLatest(organizationId);
    const result: Partial<Record<SettingsKey, unknown>> = {};

    for (const setting of settings) {
      result[setting.key] = setting.value;
    }

    return result;
  }

  /**
   * Get effective settings for an organization
   *
   * Applies inheritance: org settings override global settings.
   * Falls back to defaults for missing settings.
   */
  async getEffectiveSettings(organizationId: string | null): Promise<EffectiveSettings> {
    const values: Record<SettingsKey, unknown> = {} as Record<SettingsKey, unknown>;
    const sources: Record<SettingsKey, 'global' | 'organization' | 'default'> = {} as Record<
      SettingsKey,
      'global' | 'organization' | 'default'
    >;

    // Get global settings (always needed for inheritance)
    const globalSettings = await this.store.getAllLatest(null);

    // Get org-specific settings (only if organizationId provided)
    const orgSettings =
      organizationId !== null ? await this.store.getAllLatest(organizationId) : [];

    // Build maps for quick lookup
    const globalMap = new Map<SettingsKey, unknown>();
    for (const s of globalSettings) {
      globalMap.set(s.key, s.value);
    }

    const orgMap = new Map<SettingsKey, unknown>();
    for (const s of orgSettings) {
      orgMap.set(s.key, s.value);
    }

    // Resolve each setting with priority: org > global > default
    for (const key of SETTINGS_KEYS) {
      if (organizationId !== null && orgMap.has(key)) {
        values[key] = orgMap.get(key);
        sources[key] = 'organization';
      } else if (globalMap.has(key)) {
        values[key] = globalMap.get(key);
        sources[key] = 'global';
      } else {
        values[key] = SETTINGS_DEFAULTS[key];
        sources[key] = 'default';
      }
    }

    return {
      values,
      sources,
      organization_id: organizationId,
      snapshot_at: new Date().toISOString(),
    };
  }

  /**
   * Get history of setting changes
   */
  async getHistory(
    organizationId: string | null,
    key: SettingsKey,
    limit = 100,
  ): Promise<OperationalSetting[]> {
    return this.store.getHistory(organizationId, key, limit);
  }

  /**
   * Invalidate all cached settings for an organization
   */
  async invalidateCache(organizationId: string | null): Promise<void> {
    await this.cache.deleteAll(organizationId);
  }
}
