/**
 * Hermes Protocol re-exports for @popper/core
 * Provides typed access to Hermes types, validation, and utilities
 * @module hermes
 */

// =============================================================================
// Core Types
// =============================================================================

export type {
  HermesVersion,
  IsoDateTime,
  Mode,
  ProposedInterventionKind,
  ReasonCode,
  SubjectRef,
  SupervisionDecision,
  TraceContext,
  TraceProducer,
  TraceSignature,
} from '@regain/hermes';

export {
  CURRENT_HERMES_VERSION,
  MODES,
  PROPOSED_INTERVENTION_KINDS,
  REASON_CODES,
  SUPERVISION_DECISIONS,
} from '@regain/hermes';

// =============================================================================
// Epistemology Types
// =============================================================================

export type {
  ClaimRiskLevel,
  ClaimType,
  EvidenceGrade,
  FalsificationCriteria,
  HTVQualityLevel,
  HTVScore,
  RefutationAction,
  UncertaintyCalibration,
  UncertaintyDriver,
  UncertaintyLevel,
} from '@regain/hermes';

export {
  CLAIM_TYPE_RISK,
  CLAIM_TYPES,
  compareEvidenceGrades,
  EVIDENCE_GRADE_STRENGTH,
  EVIDENCE_GRADES,
  getEffectiveEvidenceGrade,
  getHTVQualityLevel,
  HTV_DEFAULT_WEIGHTS,
  REFUTATION_ACTIONS,
} from '@regain/hermes';

// =============================================================================
// Supervision Types
// =============================================================================

export type {
  ApprovedConstraints,
  PerProposalDecision,
  SupervisionRequest,
  SupervisionResponse,
} from '@regain/hermes';

// =============================================================================
// Proposal Types
// =============================================================================

export type {
  BehavioralInterventionProposal,
  CareNavigationProposal,
  LifestyleModificationProposal,
  MedicationOrderProposal,
  NutritionPlanProposal,
  OtherProposal,
  PatientMessageProposal,
  ProposedIntervention,
  ProposedInterventionBase,
  TriageRouteProposal,
} from '@regain/hermes';

// =============================================================================
// Audit Types
// =============================================================================

export type {
  AuditEvent,
  AuditEventType,
  BiasDetectionEvent,
  ClinicianFeedbackEvent,
} from '@regain/hermes';

// =============================================================================
// Error Types
// =============================================================================

export type { HermesError, HermesErrorCode } from '@regain/hermes';

// =============================================================================
// Message Types
// =============================================================================

export type { HermesMessage, HermesMessageType } from '@regain/hermes';

// =============================================================================
// Validation (AJV-based)
// =============================================================================

export type { ValidationErrorDetail, ValidationResult } from '@regain/hermes';
export {
  HermesValidationError,
  isValidHermesMessage,
  parseHermesMessage,
  validateHermesMessage,
} from '@regain/hermes';

// =============================================================================
// Builders
// =============================================================================

export type { FalsificationCriteriaOptions } from '@regain/hermes';
export {
  createFalsificationCriteria,
  createUniformHTVScore,
  HTVScoreBuilder,
  htvScore,
} from '@regain/hermes';

// =============================================================================
// Utilities
// =============================================================================

export type { HTVDimensions, HTVWeights, UncertaintyInputs } from '@regain/hermes';
export {
  computeHTVScore,
  computeUncertainty,
  createLowUncertainty,
  createPoorHTVScore,
  isUncertaintyAcceptable,
  meetsHTVThreshold,
  UNCERTAINTY_THRESHOLDS,
} from '@regain/hermes';
