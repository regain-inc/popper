/**
 * Policy Lifecycle Manager
 *
 * Manages the full lifecycle of policy packs:
 * DRAFT → REVIEW → STAGED → ACTIVE → ARCHIVED
 *
 * Implements ARPA-H TA2 §2.F requirements for adaptable policy management.
 *
 * @see docs/specs/02-popper-specs/03-popper-safety-dsl.md §10
 * @module policy-lifecycle/manager
 */

import { parsePolicyPack } from '../policy-engine/parser';
import type { PolicyPack } from '../policy-engine/types';
import {
  type ActivateInput,
  type ApproveInput,
  type CreateDraftInput,
  type IPolicyPackCache,
  type IPolicyPackStore,
  type ListPolicyPacksOptions,
  PolicyLifecycleError,
  type PolicyLifecycleEvent,
  type PolicyPackState,
  type RejectInput,
  type RollbackInput,
  type StoredPolicyPack,
  type SubmitForReviewInput,
  VALID_STATE_TRANSITIONS,
  type ValidationCheck,
  type ValidationResult,
} from './types';

// =============================================================================
// Configuration
// =============================================================================

export interface PolicyLifecycleManagerConfig {
  /** Store for policy pack persistence */
  store: IPolicyPackStore;
  /** Optional cache for fast policy lookups */
  cache?: IPolicyPackCache;
  /** Optional callback for lifecycle events (audit trail) */
  onLifecycleEvent?: (event: PolicyLifecycleEvent) => void | Promise<void>;
  /** Optional callback for validation (custom validation gates) */
  customValidation?: (
    pack: StoredPolicyPack,
    previousActive: StoredPolicyPack | null,
  ) => Promise<ValidationCheck[]>;
  /**
   * Optional callback when a policy is activated.
   * Use this to integrate with policyRegistry for runtime supervision.
   */
  onPolicyActivated?: (pack: StoredPolicyPack) => void | Promise<void>;
}

// =============================================================================
// Manager Implementation
// =============================================================================

/**
 * PolicyLifecycleManager - Manages policy pack lifecycle
 *
 * Handles state transitions, validation gates, and rollback functionality.
 */
export class PolicyLifecycleManager {
  private readonly store: IPolicyPackStore;
  private readonly cache?: IPolicyPackCache;
  private readonly onLifecycleEvent?: (event: PolicyLifecycleEvent) => void | Promise<void>;
  private readonly customValidation?: (
    pack: StoredPolicyPack,
    previousActive: StoredPolicyPack | null,
  ) => Promise<ValidationCheck[]>;
  private readonly onPolicyActivated?: (pack: StoredPolicyPack) => void | Promise<void>;

  constructor(config: PolicyLifecycleManagerConfig) {
    this.store = config.store;
    this.cache = config.cache;
    this.onLifecycleEvent = config.onLifecycleEvent;
    this.customValidation = config.customValidation;
    this.onPolicyActivated = config.onPolicyActivated;
  }

  // ===========================================================================
  // Create Draft
  // ===========================================================================

  /**
   * Create a new policy pack draft
   *
   * @param input - Draft creation input
   * @returns Created policy pack in DRAFT state
   */
  async createDraft(input: CreateDraftInput): Promise<StoredPolicyPack> {
    // Validate the policy pack content
    const validationErrors = this.validatePolicyPackContent(input.content);
    if (validationErrors.length > 0) {
      throw new PolicyLifecycleError(
        'INVALID_CONTENT',
        `Policy pack content is invalid: ${validationErrors.join(', ')}`,
        { errors: validationErrors },
      );
    }

    // Check if this version already exists
    const existing = await this.store.getByVersion(
      input.organization_id,
      input.policy_id,
      input.version,
    );
    if (existing) {
      throw new PolicyLifecycleError(
        'VERSION_ALREADY_EXISTS',
        `Policy pack ${input.policy_id} version ${input.version} already exists`,
        { existing_id: existing.id, state: existing.state },
      );
    }

    // Create the draft
    const created = await this.store.create({
      organization_id: input.organization_id,
      policy_id: input.policy_id,
      version: input.version,
      content: input.content,
      created_by: input.actor,
      change_notes: input.change_notes,
    });

    // Emit lifecycle event
    await this.emitEvent({
      event_type: 'POLICY_CREATED',
      policy_pack_id: created.id,
      policy_id: created.policy_id,
      version: created.version,
      organization_id: created.organization_id,
      actor: input.actor,
      timestamp: new Date().toISOString(),
      new_state: 'DRAFT',
    });

    return created;
  }

  // ===========================================================================
  // Submit for Review
  // ===========================================================================

  /**
   * Submit a draft policy pack for review
   *
   * @param input - Submit input
   * @returns Updated policy pack in REVIEW state
   */
  async submitForReview(input: SubmitForReviewInput): Promise<StoredPolicyPack> {
    const pack = await this.getPackOrThrow(input.policy_pack_id);

    this.validateStateTransition(pack.state, 'REVIEW');

    const updated = await this.store.updateState(pack.id, { state: 'REVIEW' });
    if (!updated) {
      throw new PolicyLifecycleError('POLICY_NOT_FOUND', 'Failed to update policy pack state');
    }

    await this.emitEvent({
      event_type: 'POLICY_SUBMITTED_FOR_REVIEW',
      policy_pack_id: updated.id,
      policy_id: updated.policy_id,
      version: updated.version,
      organization_id: updated.organization_id,
      actor: input.actor,
      timestamp: new Date().toISOString(),
      previous_state: pack.state,
      new_state: 'REVIEW',
    });

    return updated;
  }

  // ===========================================================================
  // Approve (Move to STAGED)
  // ===========================================================================

  /**
   * Approve a policy pack after review (moves to STAGED)
   *
   * @param input - Approval input with validation result
   * @returns Updated policy pack in STAGED state
   */
  async approve(input: ApproveInput): Promise<StoredPolicyPack> {
    const pack = await this.getPackOrThrow(input.policy_pack_id);

    this.validateStateTransition(pack.state, 'STAGED');

    // Run validation gates
    const validationResult = await this.runValidationGates(pack, input.validation_result);
    if (!validationResult.passed) {
      throw new PolicyLifecycleError('VALIDATION_FAILED', 'Policy pack failed validation gates', {
        validation_result: validationResult,
      });
    }

    const updated = await this.store.updateState(pack.id, {
      state: 'STAGED',
      reviewed_by: input.actor,
      validation_result: validationResult,
    });
    if (!updated) {
      throw new PolicyLifecycleError('POLICY_NOT_FOUND', 'Failed to update policy pack state');
    }

    await this.emitEvent({
      event_type: 'POLICY_APPROVED',
      policy_pack_id: updated.id,
      policy_id: updated.policy_id,
      version: updated.version,
      organization_id: updated.organization_id,
      actor: input.actor,
      timestamp: new Date().toISOString(),
      previous_state: pack.state,
      new_state: 'STAGED',
      metadata: { validation_result: validationResult },
    });

    return updated;
  }

  // ===========================================================================
  // Reject
  // ===========================================================================

  /**
   * Reject a policy pack during review
   *
   * @param input - Rejection input with reason
   * @returns Updated policy pack in REJECTED state
   */
  async reject(input: RejectInput): Promise<StoredPolicyPack> {
    const pack = await this.getPackOrThrow(input.policy_pack_id);

    this.validateStateTransition(pack.state, 'REJECTED');

    const updated = await this.store.updateState(pack.id, {
      state: 'REJECTED',
      reviewed_by: input.actor,
      rejection_reason: input.reason,
    });
    if (!updated) {
      throw new PolicyLifecycleError('POLICY_NOT_FOUND', 'Failed to update policy pack state');
    }

    await this.emitEvent({
      event_type: 'POLICY_REJECTED',
      policy_pack_id: updated.id,
      policy_id: updated.policy_id,
      version: updated.version,
      organization_id: updated.organization_id,
      actor: input.actor,
      timestamp: new Date().toISOString(),
      previous_state: pack.state,
      new_state: 'REJECTED',
      metadata: { reason: input.reason },
    });

    return updated;
  }

  // ===========================================================================
  // Activate
  // ===========================================================================

  /**
   * Activate a staged policy pack (makes it ACTIVE)
   *
   * Only one policy pack can be ACTIVE per organization per policy_id at a time.
   * Previous ACTIVE version will be ARCHIVED.
   *
   * @param input - Activation input
   * @returns Activated policy pack
   */
  async activate(input: ActivateInput): Promise<StoredPolicyPack> {
    const pack = await this.getPackOrThrow(input.policy_pack_id);

    this.validateStateTransition(pack.state, 'ACTIVE');

    // Archive current active version (if any)
    const archivedCount = await this.store.archiveOthers(
      pack.organization_id,
      pack.policy_id,
      pack.id,
    );

    // Activate the new version
    const updated = await this.store.updateState(pack.id, { state: 'ACTIVE' });
    if (!updated) {
      throw new PolicyLifecycleError('POLICY_NOT_FOUND', 'Failed to update policy pack state');
    }

    await this.emitEvent({
      event_type: 'POLICY_ACTIVATED',
      policy_pack_id: updated.id,
      policy_id: updated.policy_id,
      version: updated.version,
      organization_id: updated.organization_id,
      actor: input.actor,
      timestamp: new Date().toISOString(),
      previous_state: pack.state,
      new_state: 'ACTIVE',
      metadata: { archived_count: archivedCount },
    });

    // Register in runtime policy registry for supervision
    await this.notifyPolicyActivated(updated);

    // Update cache
    await this.updateCache(updated);

    return updated;
  }

  // ===========================================================================
  // Rollback
  // ===========================================================================

  /**
   * Emergency rollback to a previous ARCHIVED version
   *
   * This is an emergency operation that:
   * 1. Archives the current ACTIVE version
   * 2. Creates a new ACTIVE copy from the ARCHIVED source
   * 3. Does NOT require full validation gates (emergency path)
   *
   * @param input - Rollback input
   * @returns Newly activated policy pack (copy of the source)
   */
  async rollback(input: RollbackInput): Promise<StoredPolicyPack> {
    const source = await this.getPackOrThrow(input.source_policy_pack_id);

    // Source must be ARCHIVED
    if (source.state !== 'ARCHIVED') {
      throw new PolicyLifecycleError(
        'INVALID_STATE_TRANSITION',
        `Rollback source must be in ARCHIVED state, got ${source.state}`,
        { current_state: source.state },
      );
    }

    // Create new version string (append -rollback-TIMESTAMP)
    const rollbackVersion = `${source.version}-rollback-${Date.now()}`;

    // Create new policy pack with ACTIVE state directly (emergency path)
    const created = await this.store.create({
      organization_id: source.organization_id,
      policy_id: source.policy_id,
      version: rollbackVersion,
      content: source.content,
      created_by: input.actor,
      change_notes: `Emergency rollback from ${source.version}. Reason: ${input.reason}`,
    });

    // Archive current active version
    await this.store.archiveOthers(created.organization_id, created.policy_id, created.id);

    // Directly activate the rollback version (emergency path - no gates)
    const activated = await this.store.updateState(created.id, { state: 'ACTIVE' });
    if (!activated) {
      throw new PolicyLifecycleError('POLICY_NOT_FOUND', 'Failed to activate rollback version');
    }

    await this.emitEvent({
      event_type: 'POLICY_ROLLBACK',
      policy_pack_id: activated.id,
      policy_id: activated.policy_id,
      version: activated.version,
      organization_id: activated.organization_id,
      actor: input.actor,
      timestamp: new Date().toISOString(),
      new_state: 'ACTIVE',
      metadata: {
        source_id: source.id,
        source_version: source.version,
        reason: input.reason,
      },
    });

    // Register in runtime policy registry for supervision
    await this.notifyPolicyActivated(activated);

    // Update cache
    await this.updateCache(activated);

    return activated;
  }

  // ===========================================================================
  // Query Methods
  // ===========================================================================

  /**
   * Get a policy pack by ID
   */
  async getById(id: string): Promise<StoredPolicyPack | null> {
    return this.store.getById(id);
  }

  /**
   * Get the currently active policy pack for an organization
   *
   * Uses cache if available, falls back to store.
   */
  async getActive(
    organizationId: string | null,
    policyId: string,
  ): Promise<StoredPolicyPack | null> {
    // Try cache first
    if (this.cache) {
      const cached = await this.cache.getActive(organizationId, policyId);
      if (cached) {
        return cached;
      }
    }

    // Fetch from store
    const pack = await this.store.getActive(organizationId, policyId);

    // Populate cache for next time
    if (pack && this.cache) {
      await this.cache.setActive(pack);
    }

    return pack;
  }

  /**
   * Get policy pack history
   */
  async getHistory(
    organizationId: string | null,
    policyId: string,
    limit?: number,
  ): Promise<StoredPolicyPack[]> {
    return this.store.getHistory(organizationId, policyId, limit);
  }

  /**
   * List policy packs with filters
   */
  async list(options: ListPolicyPacksOptions): Promise<StoredPolicyPack[]> {
    return this.store.list(options);
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Get policy pack or throw if not found
   */
  private async getPackOrThrow(id: string): Promise<StoredPolicyPack> {
    const pack = await this.store.getById(id);
    if (!pack) {
      throw new PolicyLifecycleError('POLICY_NOT_FOUND', `Policy pack ${id} not found`);
    }
    return pack;
  }

  /**
   * Validate state transition is allowed
   */
  private validateStateTransition(
    currentState: PolicyPackState,
    targetState: PolicyPackState,
  ): void {
    const allowedTransitions = VALID_STATE_TRANSITIONS[currentState];
    if (!allowedTransitions.includes(targetState)) {
      throw new PolicyLifecycleError(
        'INVALID_STATE_TRANSITION',
        `Cannot transition from ${currentState} to ${targetState}`,
        { current_state: currentState, target_state: targetState, allowed: allowedTransitions },
      );
    }
  }

  /**
   * Validate policy pack content is valid DSL
   */
  private validatePolicyPackContent(content: PolicyPack): string[] {
    const errors: string[] = [];

    try {
      // Use the existing parser to validate
      parsePolicyPack(content);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }

    return errors;
  }

  /**
   * Run validation gates for approval
   */
  private async runValidationGates(
    pack: StoredPolicyPack,
    externalResult: ValidationResult,
  ): Promise<ValidationResult> {
    const checks: ValidationCheck[] = [...externalResult.checks];

    // Get previous active version for comparison
    const previousActive = await this.store.getActive(pack.organization_id, pack.policy_id);

    // Gate 1: Regression tests (from external result)
    // Already included in externalResult.checks

    // Gate 2: No critical rule deletions
    if (previousActive) {
      const deletionCheck = this.checkCriticalDeletions(pack.content, previousActive.content);
      checks.push(deletionCheck);
    }

    // Gate 3: Threshold changes bounded (±20%)
    if (previousActive) {
      const thresholdCheck = this.checkThresholdBounds(pack.content, previousActive.content);
      checks.push(thresholdCheck);
    }

    // Gate 4: Custom validation (if configured)
    if (this.customValidation) {
      const customChecks = await this.customValidation(pack, previousActive);
      checks.push(...customChecks);
    }

    // Gate 5: Audit trail complete (change notes present)
    checks.push({
      name: 'audit_trail',
      passed: !!pack.change_notes && pack.change_notes.length > 0,
      message: pack.change_notes ? undefined : 'Change notes are required',
    });

    const passed = checks.every((c) => c.passed || c.severity === 'warning');

    return {
      passed,
      checks,
      validated_at: new Date().toISOString(),
      validated_by: externalResult.validated_by,
    };
  }

  /**
   * Check for critical rule deletions (priority >= 900)
   */
  private checkCriticalDeletions(newContent: PolicyPack, oldContent: PolicyPack): ValidationCheck {
    const oldCriticalRules = oldContent.rules
      .filter((r) => r.priority >= 900)
      .map((r) => r.rule_id);

    const newRuleIds = new Set(newContent.rules.map((r) => r.rule_id));
    const deleted = oldCriticalRules.filter((id) => !newRuleIds.has(id));

    return {
      name: 'no_critical_deletions',
      passed: deleted.length === 0,
      message: deleted.length > 0 ? `Critical rules deleted: ${deleted.join(', ')}` : undefined,
      severity: deleted.length > 0 ? 'error' : undefined,
    };
  }

  /**
   * Check threshold changes are bounded (±20%)
   */
  private checkThresholdBounds(newContent: PolicyPack, oldContent: PolicyPack): ValidationCheck {
    const violations: string[] = [];

    // Check staleness thresholds
    if (newContent.staleness && oldContent.staleness) {
      const newWellness = newContent.staleness.thresholds.wellness_hours;
      const oldWellness = oldContent.staleness.thresholds.wellness_hours;
      if (Math.abs(newWellness - oldWellness) / oldWellness > 0.2) {
        violations.push(`wellness_hours changed by more than 20%: ${oldWellness} → ${newWellness}`);
      }

      const newClinical = newContent.staleness.thresholds.clinical_hours;
      const oldClinical = oldContent.staleness.thresholds.clinical_hours;
      if (Math.abs(newClinical - oldClinical) / oldClinical > 0.2) {
        violations.push(`clinical_hours changed by more than 20%: ${oldClinical} → ${newClinical}`);
      }
    }

    return {
      name: 'threshold_bounds',
      passed: violations.length === 0,
      message: violations.length > 0 ? violations.join('; ') : undefined,
      severity: violations.length > 0 ? 'error' : undefined,
    };
  }

  /**
   * Emit a lifecycle event
   */
  private async emitEvent(event: PolicyLifecycleEvent): Promise<void> {
    if (this.onLifecycleEvent) {
      await this.onLifecycleEvent(event);
    }
  }

  /**
   * Notify that a policy was activated (for registry integration)
   */
  private async notifyPolicyActivated(pack: StoredPolicyPack): Promise<void> {
    if (this.onPolicyActivated) {
      await this.onPolicyActivated(pack);
    }
  }

  /**
   * Update cache with activated policy
   */
  private async updateCache(pack: StoredPolicyPack): Promise<void> {
    if (this.cache) {
      await this.cache.setActive(pack);
    }
  }
}
