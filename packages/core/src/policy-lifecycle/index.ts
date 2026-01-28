/**
 * Policy Lifecycle Management
 *
 * Provides policy pack lifecycle management with versioning and state machine.
 *
 * @module policy-lifecycle
 */

export { PolicyLifecycleManager, type PolicyLifecycleManagerConfig } from './manager';
export {
  type ActivateInput,
  type ApproveInput,
  type CreateDraftInput,
  type CreatePolicyPackInput,
  type IPolicyPackStore,
  type ListPolicyPacksOptions,
  PolicyLifecycleError,
  type PolicyLifecycleErrorCode,
  type PolicyLifecycleEvent,
  type PolicyLifecycleEventType,
  type PolicyPackState,
  type RejectInput,
  type RollbackInput,
  type StateTransitionInput,
  type StoredPolicyPack,
  type SubmitForReviewInput,
  VALID_STATE_TRANSITIONS,
  type ValidationCheck,
  type ValidationGateType,
  type ValidationResult,
} from './types';
