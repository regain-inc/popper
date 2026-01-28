/**
 * Drizzle-based policy pack storage for PostgreSQL
 *
 * Implements policy pack lifecycle management with versioning.
 * Supports DRAFT → REVIEW → STAGED → ACTIVE → ARCHIVED states.
 *
 * @module storage/policy-pack-storage
 */

import { and, desc, eq, isNull, ne } from 'drizzle-orm';
import type { DrizzleDB } from '../db';
import {
  type PolicyPack,
  type PolicyPackContent,
  type PolicyPackState,
  policyPacks,
  type ValidationResult,
} from '../schema/policy-packs';

/**
 * API-facing policy pack record
 */
export interface ApiPolicyPack {
  id: string;
  organization_id: string | null;
  policy_id: string;
  version: string;
  state: PolicyPackState;
  content: PolicyPackContent;
  created_by: string;
  reviewed_by: string | null;
  validation_result: ValidationResult | null;
  submitted_at: Date | null;
  approved_at: Date | null;
  activated_at: Date | null;
  archived_at: Date | null;
  rejection_reason: string | null;
  change_notes: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Input for creating a new policy pack
 */
export interface CreatePolicyPackInput {
  organization_id: string | null;
  policy_id: string;
  version: string;
  content: PolicyPackContent;
  created_by: string;
  change_notes?: string;
}

/**
 * Input for state transition
 */
export interface StateTransitionInput {
  state: PolicyPackState;
  reviewed_by?: string;
  validation_result?: ValidationResult;
  rejection_reason?: string;
}

/**
 * DrizzlePolicyPackStorage - Production policy pack storage
 */
export class DrizzlePolicyPackStorage {
  constructor(private readonly db: DrizzleDB) {}

  /**
   * Create a new policy pack draft
   */
  async create(input: CreatePolicyPackInput): Promise<ApiPolicyPack> {
    const now = new Date();

    const [inserted] = await this.db
      .insert(policyPacks)
      .values({
        organizationId: input.organization_id,
        policyId: input.policy_id,
        version: input.version,
        state: 'DRAFT',
        content: input.content,
        createdBy: input.created_by,
        changeNotes: input.change_notes,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return this.toApiPolicyPack(inserted);
  }

  /**
   * Get a policy pack by ID
   */
  async getById(id: string): Promise<ApiPolicyPack | null> {
    const [row] = await this.db.select().from(policyPacks).where(eq(policyPacks.id, id)).limit(1);

    return row ? this.toApiPolicyPack(row) : null;
  }

  /**
   * Get a specific version of a policy pack
   */
  async getByVersion(
    organizationId: string | null,
    policyId: string,
    version: string,
  ): Promise<ApiPolicyPack | null> {
    const condition =
      organizationId === null
        ? and(
            isNull(policyPacks.organizationId),
            eq(policyPacks.policyId, policyId),
            eq(policyPacks.version, version),
          )
        : and(
            eq(policyPacks.organizationId, organizationId),
            eq(policyPacks.policyId, policyId),
            eq(policyPacks.version, version),
          );

    const [row] = await this.db.select().from(policyPacks).where(condition).limit(1);

    return row ? this.toApiPolicyPack(row) : null;
  }

  /**
   * Get the currently ACTIVE policy pack for an organization
   */
  async getActive(organizationId: string | null, policyId: string): Promise<ApiPolicyPack | null> {
    const condition =
      organizationId === null
        ? and(
            isNull(policyPacks.organizationId),
            eq(policyPacks.policyId, policyId),
            eq(policyPacks.state, 'ACTIVE'),
          )
        : and(
            eq(policyPacks.organizationId, organizationId),
            eq(policyPacks.policyId, policyId),
            eq(policyPacks.state, 'ACTIVE'),
          );

    const [row] = await this.db.select().from(policyPacks).where(condition).limit(1);

    return row ? this.toApiPolicyPack(row) : null;
  }

  /**
   * Get policy pack history (all versions) for an organization
   */
  async getHistory(
    organizationId: string | null,
    policyId: string,
    limit = 100,
  ): Promise<ApiPolicyPack[]> {
    const condition =
      organizationId === null
        ? and(isNull(policyPacks.organizationId), eq(policyPacks.policyId, policyId))
        : and(eq(policyPacks.organizationId, organizationId), eq(policyPacks.policyId, policyId));

    const rows = await this.db
      .select()
      .from(policyPacks)
      .where(condition)
      .orderBy(desc(policyPacks.createdAt))
      .limit(limit);

    return rows.map((row) => this.toApiPolicyPack(row));
  }

  /**
   * List policy packs with optional filters
   */
  async list(options: {
    organizationId?: string | null;
    policyId?: string;
    state?: PolicyPackState;
    limit?: number;
  }): Promise<ApiPolicyPack[]> {
    const conditions = [];

    if (options.organizationId !== undefined) {
      if (options.organizationId === null) {
        conditions.push(isNull(policyPacks.organizationId));
      } else {
        conditions.push(eq(policyPacks.organizationId, options.organizationId));
      }
    }

    if (options.policyId) {
      conditions.push(eq(policyPacks.policyId, options.policyId));
    }

    if (options.state) {
      conditions.push(eq(policyPacks.state, options.state));
    }

    const query = this.db
      .select()
      .from(policyPacks)
      .orderBy(desc(policyPacks.createdAt))
      .limit(options.limit ?? 100);

    const rows = conditions.length > 0 ? await query.where(and(...conditions)) : await query;

    return rows.map((row) => this.toApiPolicyPack(row));
  }

  /**
   * Update policy pack state (state machine transition)
   */
  async updateState(id: string, input: StateTransitionInput): Promise<ApiPolicyPack | null> {
    const now = new Date();

    const updateData: Partial<typeof policyPacks.$inferInsert> = {
      state: input.state,
      updatedAt: now,
    };

    // Set timestamps based on state
    switch (input.state) {
      case 'REVIEW':
        updateData.submittedAt = now;
        break;
      case 'STAGED':
        updateData.reviewedBy = input.reviewed_by;
        updateData.validationResult = input.validation_result;
        updateData.approvedAt = now;
        break;
      case 'ACTIVE':
        updateData.activatedAt = now;
        break;
      case 'ARCHIVED':
        updateData.archivedAt = now;
        break;
      case 'REJECTED':
        updateData.reviewedBy = input.reviewed_by;
        updateData.rejectionReason = input.rejection_reason;
        break;
    }

    const [updated] = await this.db
      .update(policyPacks)
      .set(updateData)
      .where(eq(policyPacks.id, id))
      .returning();

    return updated ? this.toApiPolicyPack(updated) : null;
  }

  /**
   * Archive all non-archived versions except the specified one
   * Used when activating a new version to archive the previous active one
   */
  async archiveOthers(
    organizationId: string | null,
    policyId: string,
    exceptId: string,
  ): Promise<number> {
    const now = new Date();

    const condition =
      organizationId === null
        ? and(
            isNull(policyPacks.organizationId),
            eq(policyPacks.policyId, policyId),
            eq(policyPacks.state, 'ACTIVE'),
            ne(policyPacks.id, exceptId),
          )
        : and(
            eq(policyPacks.organizationId, organizationId),
            eq(policyPacks.policyId, policyId),
            eq(policyPacks.state, 'ACTIVE'),
            ne(policyPacks.id, exceptId),
          );

    const result = await this.db
      .update(policyPacks)
      .set({
        state: 'ARCHIVED',
        archivedAt: now,
        updatedAt: now,
      })
      .where(condition)
      .returning();

    return result.length;
  }

  /**
   * Update policy pack content (only allowed in DRAFT state)
   */
  async updateContent(
    id: string,
    content: PolicyPackContent,
    changeNotes?: string,
  ): Promise<ApiPolicyPack | null> {
    const now = new Date();

    const [updated] = await this.db
      .update(policyPacks)
      .set({
        content,
        changeNotes,
        updatedAt: now,
      })
      .where(and(eq(policyPacks.id, id), eq(policyPacks.state, 'DRAFT')))
      .returning();

    return updated ? this.toApiPolicyPack(updated) : null;
  }

  /**
   * Convert database row to API format
   */
  private toApiPolicyPack(row: PolicyPack): ApiPolicyPack {
    return {
      id: row.id,
      organization_id: row.organizationId,
      policy_id: row.policyId,
      version: row.version,
      state: row.state,
      content: row.content,
      created_by: row.createdBy,
      reviewed_by: row.reviewedBy,
      validation_result: row.validationResult,
      submitted_at: row.submittedAt,
      approved_at: row.approvedAt,
      activated_at: row.activatedAt,
      archived_at: row.archivedAt,
      rejection_reason: row.rejectionReason,
      change_notes: row.changeNotes,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }
}
