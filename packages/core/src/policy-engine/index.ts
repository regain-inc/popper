/**
 * Policy Engine
 * Deterministic policy evaluation for Popper supervision
 *
 * @module policy-engine
 */

// Evaluator
export type {
  ControlPlaneState,
  DerivedSignals,
  EvaluationContext,
  EvaluationResult,
  MatchedRule,
} from './evaluator';
export { createEvaluator, PolicyEvaluator } from './evaluator';
// Loader
export {
  loadPolicyPack,
  loadPolicyPacksFromDir,
  PolicyPackRegistry,
  policyRegistry,
} from './loader';
// Parser
export {
  PolicyParseError,
  parsePolicyPack,
  parsePolicyPackJson,
  parsePolicyPackYaml,
} from './parser';
// Types
export type {
  AllOfCondition,
  AlwaysCondition,
  AnyOfCondition,
  ApprovedConstraints,
  ConditionKind,
  ConflictCountExceedsCondition,
  ConflictEscalatedCondition,
  ConflictMissingEvidenceCondition,
  ConflictResolutionConfidenceCondition,
  ConflictTypeInCondition,
  ControlCommand,
  DomainStatusInCondition,
  EvidenceGradeBelowCondition,
  HallucinationDetectedCondition,
  HTVScoreBelowCondition,
  IDKTriggeredCondition,
  InputRiskFlagInCondition,
  MissingFieldCondition,
  NotCondition,
  OtherCondition,
  PolicyPack,
  PolicyPackMetadata,
  PolicyRule,
  PolicySource,
  ProposalKindInCondition,
  ProposalMissingFieldCondition,
  RuleAction,
  RuleCondition,
  RuleEngineFailedCondition,
  SafeModeEnabledCondition,
  SchemaInvalidCondition,
  SnapshotMissingCondition,
  SnapshotSourceMissingCondition,
  SnapshotStaleByCondition,
  SnapshotStaleCondition,
  StalenessBehavior,
  StalenessConfig,
  StalenessThresholds,
  UncertaintyAtLeastCondition,
} from './types';
export { CONDITION_KINDS } from './types';
