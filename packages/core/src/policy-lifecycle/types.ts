/**
 * Policy Lifecycle Types
 *
 * Types and interfaces for policy pack lifecycle management.
 * Implements ARPA-H TA2 §2.F requirements for adaptable policies.
 *
 * @see docs/specs/02-popper-specs/03-popper-safety-dsl.md §10
 * @module policy-lifecycle/types
 */

import type { PolicyPack } from '../policy-engine/types';

// =============================================================================
// Policy Pack State Machine
// =============================================================================

/**
 * Policy pack lifecycle states
 *
 * State transitions:
 * - DRAFT → REVIEW (submit for review)
 * - REVIEW → STAGED (approve) or REJECTED (reject)
 * - STAGED → ACTIVE (activate)
 * - ACTIVE → ARCHIVED (archive when replaced)
 */
export type PolicyPackState = 'DRAFT' | 'REVIEW' | 'STAGED' | 'ACTIVE' | 'ARCHIVED' | 'REJECTED';

/**
 * Valid state transitions
 */
export const VALID_STATE_TRANSITIONS: Record<PolicyPackState, PolicyPackState[]> = {
  DRAFT: ['REVIEW'],
  REVIEW: ['STAGED', 'REJECTED', 'DRAFT'], // Can go back to DRAFT for revision
  STAGED: ['ACTIVE', 'DRAFT'], // Can go back to DRAFT if activation is cancelled
  ACTIVE: ['ARCHIVED'],
  ARCHIVED: [], // Terminal state (but can be used as source for rollback)
  REJECTED: ['DRAFT'], // Can revise and resubmit
};

// =============================================================================
// Validation Gates
// =============================================================================

/**
 * Single validation check result
 */
export interface ValidationCheck {
  /** Check identifier */
  name: string;
  /** Whether the check passed */
  passed: boolean;
  /** Human-readable message (especially useful for failures) */
  message?: string;
  /** Severity if failed */
  severity?: 'warning' | 'error' | 'critical';
}

/**
 * Complete validation result for a policy pack
 */
export interface ValidationResult {
  /** Overall validation passed */
  passed: boolean;
  /** Individual check results */
  checks: ValidationCheck[];
  /** When validation was performed */
  validated_at: string;
  /** Who/what performed the validation */
  validated_by: string;
}

/**
 * Validation gate types (from §10.3)
 */
export type ValidationGateType =
  | 'regression_tests' // Test vectors pass
  | 'no_critical_deletions' // No critical rules removed without approval
  | 'threshold_bounds' // Threshold changes bounded (±20% max)
  | 'clinical_review' // Clinical review signed off
  | 'audit_trail'; // Change log with rationale complete

// =============================================================================
// Lifecycle Events (for Audit Trail)
// =============================================================================

/**
 * Policy lifecycle event types for audit
 */
export type PolicyLifecycleEventType =
  | 'POLICY_CREATED'
  | 'POLICY_SUBMITTED_FOR_REVIEW'
  | 'POLICY_APPROVED'
  | 'POLICY_REJECTED'
  | 'POLICY_ACTIVATED'
  | 'POLICY_ARCHIVED'
  | 'POLICY_ROLLBACK';

/**
 * Policy lifecycle event for audit trail
 */
export interface PolicyLifecycleEvent {
  /** Event type */
  event_type: PolicyLifecycleEventType;
  /** Policy pack ID */
  policy_pack_id: string;
  /** Policy identifier */
  policy_id: string;
  /** Version */
  version: string;
  /** Organization ID (null for global) */
  organization_id: string | null;
  /** Who triggered the event */
  actor: string;
  /** When the event occurred */
  timestamp: string;
  /** Previous state (for transitions) */
  previous_state?: PolicyPackState;
  /** New state (for transitions) */
  new_state?: PolicyPackState;
  /** Additional context */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Manager Interfaces
// =============================================================================

/**
 * Stored policy pack (from database)
 */
export interface StoredPolicyPack {
  id: string;
  organization_id: string | null;
  policy_id: string;
  version: string;
  state: PolicyPackState;
  content: PolicyPack;
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
 * Policy pack store interface (implemented by storage layer)
 */
export interface IPolicyPackStore {
  create(input: CreatePolicyPackInput): Promise<StoredPolicyPack>;
  getById(id: string): Promise<StoredPolicyPack | null>;
  getByVersion(
    organizationId: string | null,
    policyId: string,
    version: string,
  ): Promise<StoredPolicyPack | null>;
  getActive(organizationId: string | null, policyId: string): Promise<StoredPolicyPack | null>;
  getHistory(
    organizationId: string | null,
    policyId: string,
    limit?: number,
  ): Promise<StoredPolicyPack[]>;
  list(options: ListPolicyPacksOptions): Promise<StoredPolicyPack[]>;
  updateState(id: string, input: StateTransitionInput): Promise<StoredPolicyPack | null>;
  archiveOthers(organizationId: string | null, policyId: string, exceptId: string): Promise<number>;
  updateContent(
    id: string,
    content: PolicyPack,
    changeNotes?: string,
  ): Promise<StoredPolicyPack | null>;
}

/**
 * Input for creating a new policy pack
 */
export interface CreatePolicyPackInput {
  organization_id: string | null;
  policy_id: string;
  version: string;
  content: PolicyPack;
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
 * Options for listing policy packs
 */
export interface ListPolicyPacksOptions {
  organizationId?: string | null;
  policyId?: string;
  state?: PolicyPackState;
  limit?: number;
}

// =============================================================================
// Manager Actions
// =============================================================================

/**
 * Input for creating a draft policy pack
 */
export interface CreateDraftInput {
  organization_id: string | null;
  policy_id: string;
  version: string;
  content: PolicyPack;
  actor: string;
  change_notes?: string;
}

/**
 * Input for submitting a policy pack for review
 */
export interface SubmitForReviewInput {
  policy_pack_id: string;
  actor: string;
}

/**
 * Input for approving a policy pack (moves to STAGED)
 */
export interface ApproveInput {
  policy_pack_id: string;
  actor: string;
  validation_result: ValidationResult;
}

/**
 * Input for rejecting a policy pack
 */
export interface RejectInput {
  policy_pack_id: string;
  actor: string;
  reason: string;
}

/**
 * Input for activating a policy pack
 */
export interface ActivateInput {
  policy_pack_id: string;
  actor: string;
}

/**
 * Input for rollback to a previous version
 */
export interface RollbackInput {
  /** ID of the ARCHIVED policy pack to restore */
  source_policy_pack_id: string;
  actor: string;
  reason: string;
}

// =============================================================================
// Cache Interface
// =============================================================================

/** Redis key prefix for policy pack cache */
export const POLICY_PACK_CACHE_PREFIX = 'policy_pack';

/** Default TTL for cached policy packs (5 minutes) */
export const POLICY_PACK_CACHE_TTL_SECONDS = 300;

/** Organization ID placeholder for global policies */
export const GLOBAL_POLICY_ORG_ID = '__global__';

/**
 * Cache interface for active policy packs
 *
 * Provides fast reads for frequently accessed policies.
 */
export interface IPolicyPackCache {
  /** Get cached active policy pack */
  getActive(organizationId: string | null, policyId: string): Promise<StoredPolicyPack | null>;

  /** Set active policy pack in cache */
  setActive(pack: StoredPolicyPack, ttlSeconds?: number): Promise<void>;

  /** Delete cached active policy pack */
  deleteActive(organizationId: string | null, policyId: string): Promise<void>;

  /** Delete all cached policies for an organization */
  deleteAll(organizationId: string | null): Promise<void>;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Policy lifecycle error codes
 */
export type PolicyLifecycleErrorCode =
  | 'INVALID_STATE_TRANSITION'
  | 'POLICY_NOT_FOUND'
  | 'VERSION_ALREADY_EXISTS'
  | 'VALIDATION_FAILED'
  | 'UNAUTHORIZED'
  | 'INVALID_CONTENT';

/**
 * Policy lifecycle error
 */
export class PolicyLifecycleError extends Error {
  constructor(
    public readonly code: PolicyLifecycleErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'PolicyLifecycleError';
  }
}
