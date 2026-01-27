/**
 * Organization Service
 *
 * Handles organization lifecycle management:
 * - Create organizations
 * - Get organization by ID
 * - Update organization settings
 * - List organizations
 *
 * @module services/organization-service
 */

import { and, desc, eq } from 'drizzle-orm';
import type { DrizzleDB } from '../db';
import { organizations, type SupervisionMode } from '../schema';

// Re-export types for convenience
export type { SupervisionMode } from '../schema/organizations';

/**
 * Options for creating a new organization
 */
export interface CreateOrganizationOptions {
  /** Unique identifier (e.g., "org_abc123") */
  id: string;
  /** Human-readable organization name */
  name: string;
  /** Array of allowed supervision modes */
  allowedModes?: SupervisionMode[];
  /** Rate limit in requests per minute */
  rateLimitPerMinute?: number;
  /** Rate limit in requests per hour */
  rateLimitPerHour?: number;
  /** Default policy pack to use */
  defaultPolicyPack?: string;
  /** Staleness threshold for wellness mode in hours */
  stalenessWellnessHours?: number | null;
  /** Staleness threshold for clinical mode in hours */
  stalenessClinicalHours?: number | null;
  /** Whether the organization is active */
  isActive?: boolean;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Options for updating an organization
 */
export interface UpdateOrganizationOptions {
  /** Human-readable organization name */
  name?: string;
  /** Array of allowed supervision modes */
  allowedModes?: SupervisionMode[];
  /** Rate limit in requests per minute */
  rateLimitPerMinute?: number;
  /** Rate limit in requests per hour */
  rateLimitPerHour?: number;
  /** Default policy pack to use */
  defaultPolicyPack?: string;
  /** Staleness threshold for wellness mode in hours */
  stalenessWellnessHours?: number | null;
  /** Staleness threshold for clinical mode in hours */
  stalenessClinicalHours?: number | null;
  /** Whether the organization is active */
  isActive?: boolean;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Stored organization data (from database)
 */
export interface StoredOrganization {
  id: string;
  name: string;
  allowedModes: SupervisionMode[];
  rateLimitPerMinute: number;
  rateLimitPerHour: number;
  defaultPolicyPack: string;
  stalenessWellnessHours: number | null;
  stalenessClinicalHours: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

/**
 * Options for listing organizations
 */
export interface ListOrganizationsOptions {
  /** Include inactive organizations */
  includeInactive?: boolean;
  /** Maximum number of organizations to return */
  limit?: number;
}

/**
 * Organization validation result
 */
export type OrganizationValidationResult =
  | { valid: true; organization: StoredOrganization }
  | { valid: false; error: 'not_found' | 'inactive' | 'mode_not_allowed' | 'unauthorized' };

// =============================================================================
// Organization Service
// =============================================================================

/**
 * Organization Service
 *
 * Manages organization lifecycle with database storage.
 */
export class OrganizationService {
  constructor(private readonly db: DrizzleDB) {}

  /**
   * Create a new organization
   */
  async create(options: CreateOrganizationOptions): Promise<StoredOrganization> {
    const [inserted] = await this.db
      .insert(organizations)
      .values({
        id: options.id,
        name: options.name,
        allowedModes: options.allowedModes ?? ['wellness'],
        rateLimitPerMinute: options.rateLimitPerMinute ?? 1000,
        rateLimitPerHour: options.rateLimitPerHour ?? 50000,
        defaultPolicyPack: options.defaultPolicyPack ?? 'popper-default',
        stalenessWellnessHours: options.stalenessWellnessHours ?? null,
        stalenessClinicalHours: options.stalenessClinicalHours ?? null,
        isActive: options.isActive ?? true,
        metadata: options.metadata ?? {},
      })
      .returning();

    return this.mapToStoredOrganization(inserted);
  }

  /**
   * Get an organization by ID
   */
  async getById(orgId: string): Promise<StoredOrganization | null> {
    const org = await this.db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    });

    if (!org) {
      return null;
    }

    return this.mapToStoredOrganization(org);
  }

  /**
   * Update an organization
   */
  async update(
    orgId: string,
    options: UpdateOrganizationOptions,
  ): Promise<StoredOrganization | null> {
    const updateValues: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (options.name !== undefined) {
      updateValues.name = options.name;
    }
    if (options.allowedModes !== undefined) {
      updateValues.allowedModes = options.allowedModes;
    }
    if (options.rateLimitPerMinute !== undefined) {
      updateValues.rateLimitPerMinute = options.rateLimitPerMinute;
    }
    if (options.rateLimitPerHour !== undefined) {
      updateValues.rateLimitPerHour = options.rateLimitPerHour;
    }
    if (options.defaultPolicyPack !== undefined) {
      updateValues.defaultPolicyPack = options.defaultPolicyPack;
    }
    if (options.stalenessWellnessHours !== undefined) {
      updateValues.stalenessWellnessHours = options.stalenessWellnessHours;
    }
    if (options.stalenessClinicalHours !== undefined) {
      updateValues.stalenessClinicalHours = options.stalenessClinicalHours;
    }
    if (options.isActive !== undefined) {
      updateValues.isActive = options.isActive;
    }
    if (options.metadata !== undefined) {
      updateValues.metadata = options.metadata;
    }

    const [updated] = await this.db
      .update(organizations)
      .set(updateValues)
      .where(eq(organizations.id, orgId))
      .returning();

    if (!updated) {
      return null;
    }

    return this.mapToStoredOrganization(updated);
  }

  /**
   * List organizations
   */
  async list(options: ListOrganizationsOptions = {}): Promise<StoredOrganization[]> {
    const { includeInactive = false, limit = 100 } = options;

    const conditions = [];

    if (!includeInactive) {
      conditions.push(eq(organizations.isActive, true));
    }

    const orgs = await this.db
      .select()
      .from(organizations)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(organizations.createdAt))
      .limit(limit);

    return orgs.map((org) => this.mapToStoredOrganization(org));
  }

  /**
   * Check if an organization exists and is active
   */
  async isValidOrg(orgId: string): Promise<boolean> {
    const org = await this.db.query.organizations.findFirst({
      where: and(eq(organizations.id, orgId), eq(organizations.isActive, true)),
      columns: { id: true },
    });

    return org !== undefined;
  }

  /**
   * Validate organization for supervision request
   *
   * Checks:
   * 1. Organization exists
   * 2. Organization is active
   * 3. Requested mode is allowed for the organization
   */
  async validateForSupervision(
    orgId: string,
    mode: SupervisionMode,
  ): Promise<OrganizationValidationResult> {
    const org = await this.getById(orgId);

    if (!org) {
      return { valid: false, error: 'not_found' };
    }

    if (!org.isActive) {
      return { valid: false, error: 'inactive' };
    }

    if (!org.allowedModes.includes(mode)) {
      return { valid: false, error: 'mode_not_allowed' };
    }

    return { valid: true, organization: org };
  }

  /**
   * Map database row to StoredOrganization
   */
  private mapToStoredOrganization(org: typeof organizations.$inferSelect): StoredOrganization {
    return {
      id: org.id,
      name: org.name,
      allowedModes: org.allowedModes as SupervisionMode[],
      rateLimitPerMinute: org.rateLimitPerMinute,
      rateLimitPerHour: org.rateLimitPerHour,
      defaultPolicyPack: org.defaultPolicyPack,
      stalenessWellnessHours: org.stalenessWellnessHours,
      stalenessClinicalHours: org.stalenessClinicalHours,
      isActive: org.isActive,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
      metadata: (org.metadata ?? {}) as Record<string, unknown>,
    };
  }
}
