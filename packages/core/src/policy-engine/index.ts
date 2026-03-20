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
export { createEvaluator, mergeReconfigureEffects, PolicyEvaluator } from './evaluator';
// Loader + Multi-Pack Composition (v2.1)
export {
  composePacks,
  loadAndComposePacks,
  loadPolicyPack,
  loadPolicyPacksFromDir,
  PackCompositionError,
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
  AcuityAtLeastCondition,
  AllergyMatchCondition,
  AllOfCondition,
  AlwaysCondition,
  AnyOfCondition,
  ApprovedConstraints,
  CombinationPresentCondition,
  ConditionKind,
  ConflictCountExceedsCondition,
  ConflictEscalatedCondition,
  ConflictMissingEvidenceCondition,
  ConflictResolutionConfidenceCondition,
  ConflictTypeInCondition,
  ControlCommand,
  DomainStatusInCondition,
  DoseExceedsMaxCondition,
  EvidenceGradeBelowCondition,
  HallucinationDetectedCondition,
  HTVScoreBelowCondition,
  IDKTriggeredCondition,
  InputRiskFlagInCondition,
  InterventionRiskAtLeastCondition,
  MedicationClassInCondition,
  MedicationNameInCondition,
  MissingFieldCondition,
  ModeIsCondition,
  NotCondition,
  OtherCondition,
  PolicyPack,
  PolicyPackMetadata,
  PolicyRule,
  PolicySource,
  ProposalKindInCondition,
  ProposalMissingFieldCondition,
  ReconfigureEffect,
  ReconfigureSettingChange,
  RuleAction,
  RuleCondition,
  RuleEngineFailedCondition,
  // v2.1 clinical grounding types
  RuleProvenance,
  SafeModeEnabledCondition,
  SchemaInvalidCondition,
  SnapshotConditionPresentCondition,
  SnapshotFieldMissingCondition,
  SnapshotLabAboveCondition,
  SnapshotLabBelowCondition,
  SnapshotLabMissingCondition,
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
