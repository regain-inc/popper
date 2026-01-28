/**
 * Policy Packs schema for policy lifecycle management
 *
 * Implements ARPA-H TA2 §2.F requirements for adaptable policy management.
 * Supports versioned policy packs with lifecycle states:
 * DRAFT → REVIEW → STAGED → ACTIVE → ARCHIVED (+ REJECTED)
 *
 * @module schema/policy-packs
 */

import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * Policy pack lifecycle states
 *
 * State transitions:
 * - DRAFT → REVIEW (submit for review)
 * - REVIEW → STAGED (approve) or REJECTED (reject)
 * - STAGED → ACTIVE (activate)
 * - ACTIVE → ARCHIVED (archive when replaced)
 * - Any state → DRAFT (rollback creates new draft from content)
 */
export type PolicyPackState = 'DRAFT' | 'REVIEW' | 'STAGED' | 'ACTIVE' | 'ARCHIVED' | 'REJECTED';

/**
 * Policy pack content structure (matches DSL spec)
 */
export interface PolicyPackContent {
  policy_id: string;
  policy_version: string;
  metadata?: {
    description?: string;
    owner?: string;
    created_at?: string;
    sources?: Array<{ kind: 'policy' | 'guideline' | 'other'; citation: string }>;
  };
  staleness?: {
    thresholds: {
      wellness_hours: number;
      clinical_hours: number;
    };
    signals?: Record<string, string>;
    behavior: {
      low_risk_stale: 'REQUEST_MORE_INFO' | 'ROUTE_TO_CLINICIAN';
      high_risk_stale: 'ROUTE_TO_CLINICIAN' | 'HARD_STOP';
    };
  };
  rules: unknown[]; // PolicyRule[] - full structure in core/policy-engine/types.ts
}

/**
 * Validation result for policy pack
 */
export interface ValidationResult {
  passed: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    message?: string;
  }>;
  validated_at: string;
  validated_by: string;
}

/**
 * Policy packs table
 *
 * Stores versioned policy packs with lifecycle management.
 * Only one policy pack can be ACTIVE per organization at a time.
 */
export const policyPacks = pgTable(
  'policy_packs',
  {
    /** Unique record identifier */
    id: uuid('id').primaryKey().defaultRandom(),

    /** Organization ID (NULL = global/system-wide policy) */
    organizationId: text('organization_id'),

    /** Policy identifier (e.g., "popper-safety", "org-custom") */
    policyId: text('policy_id').notNull(),

    /** Semantic version (e.g., "1.2.0") */
    version: text('version').notNull(),

    /** Current lifecycle state */
    state: text('state').$type<PolicyPackState>().notNull().default('DRAFT'),

    /** Full policy pack content (YAML parsed to JSON) */
    content: jsonb('content').$type<PolicyPackContent>().notNull(),

    /** Who created this policy pack version */
    createdBy: text('created_by').notNull(),

    /** Who reviewed/approved this policy pack (set on REVIEW → STAGED) */
    reviewedBy: text('reviewed_by'),

    /** Validation results from gates check */
    validationResult: jsonb('validation_result').$type<ValidationResult>(),

    /** When the policy was submitted for review */
    submittedAt: timestamp('submitted_at', { withTimezone: true, mode: 'date' }),

    /** When the policy was approved (STAGED) */
    approvedAt: timestamp('approved_at', { withTimezone: true, mode: 'date' }),

    /** When the policy became ACTIVE */
    activatedAt: timestamp('activated_at', { withTimezone: true, mode: 'date' }),

    /** When the policy was ARCHIVED */
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'date' }),

    /** Reason for rejection (if state = REJECTED) */
    rejectionReason: text('rejection_reason'),

    /** Optional change notes describing what changed in this version */
    changeNotes: text('change_notes'),

    /** Record creation timestamp */
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),

    /** Last update timestamp */
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    // Unique constraint: only one version per policy per organization
    uniqueIndex('policy_packs_org_policy_version_idx').on(
      table.organizationId,
      table.policyId,
      table.version,
    ),

    // Find active policy for organization
    index('policy_packs_org_state_idx').on(table.organizationId, table.state),

    // Find by policy ID
    index('policy_packs_policy_id_idx').on(table.policyId),

    // Sort by activation date (for history)
    index('policy_packs_activated_at_idx').on(table.activatedAt),

    // Sort by creation date
    index('policy_packs_created_at_idx').on(table.createdAt),
  ],
);

export type PolicyPack = typeof policyPacks.$inferSelect;
export type NewPolicyPack = typeof policyPacks.$inferInsert;
