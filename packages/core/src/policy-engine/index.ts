/**
 * Policy Engine
 * Deterministic policy evaluation for Popper supervision
 *
 * @module policy-engine
 */

// Decision Builder
export type { DecisionBuilderInput, SafeModeStateUsed } from './decision-builder';
export {
  buildPerProposalDecisions,
  createDecisionBuilder,
  DecisionBuilder,
  defaultDecisionBuilder,
  getMoreConservativeDecision,
  isMoreConservative,
} from './decision-builder';
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
// Staleness Validator
export type {
  ProposalRiskLevel,
  SignalStalenessOverrides,
  StalenessConfig,
  StalenessResult,
  StalenessThresholds,
} from './staleness';
export {
  createStalenessValidator,
  DEFAULT_STALENESS_THRESHOLDS,
  defaultStalenessValidator,
  HIGH_RISK_PROPOSAL_KINDS,
  StalenessValidator,
} from './staleness';
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
