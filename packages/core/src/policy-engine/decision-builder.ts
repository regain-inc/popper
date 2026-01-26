/**
 * Decision Builder
 * Builds complete SupervisionResponse from evaluation results.
 *
 * @see docs/specs/03-hermes-specs/02-hermes-contracts.md
 * @module policy-engine/decision-builder
 */

import type {
  ApprovedConstraints as HermesApprovedConstraints,
  PerProposalDecision,
  ReasonCode,
  SupervisionDecision,
  SupervisionRequest,
  SupervisionResponse,
  TraceContext,
} from '../hermes';
import { CURRENT_HERMES_VERSION } from '../hermes';
import type { EvaluationResult } from './evaluator';
import type { StalenessResult } from './staleness';
import type { ControlCommand } from './types';

// =============================================================================
// Types
// =============================================================================

/**
 * Safe mode state at evaluation time.
 */
export interface SafeModeStateUsed {
  enabled: boolean;
  reason?: string;
  effective_at?: string;
  effective_until?: string;
}

/**
 * Input for building a supervision response.
 */
export interface DecisionBuilderInput {
  /** Original supervision request */
  request: SupervisionRequest;
  /** Policy evaluation result */
  evaluationResult: EvaluationResult;
  /** Staleness validation result (optional) */
  stalenessResult?: StalenessResult;
  /** Safe mode state used during evaluation */
  safeModeState?: SafeModeStateUsed;
  /** Per-proposal decisions for partial approval (optional) */
  perProposalDecisions?: PerProposalDecision[];
  /** Additional control commands to include */
  additionalControlCommands?: ControlCommand[];
}

/**
 * Decision precedence for conservatism (higher = more conservative).
 */
const DECISION_PRECEDENCE: Record<SupervisionDecision, number> = {
  HARD_STOP: 4,
  ROUTE_TO_CLINICIAN: 3,
  REQUEST_MORE_INFO: 2,
  APPROVED: 1,
};

// =============================================================================
// Decision Builder
// =============================================================================

/**
 * DecisionBuilder constructs complete SupervisionResponse objects.
 *
 * It aggregates results from multiple sources (policy evaluation, staleness
 * validation) and applies the conservatism principle to produce a final
 * decision with proper Hermes message structure.
 */
export class DecisionBuilder {
  private systemId: string;
  private systemVersion: string;

  constructor(systemId = 'popper', systemVersion = '1.0.0') {
    this.systemId = systemId;
    this.systemVersion = systemVersion;
  }

  /**
   * Build a complete SupervisionResponse from evaluation inputs.
   */
  build(input: DecisionBuilderInput): SupervisionResponse {
    const { request, evaluationResult, stalenessResult, safeModeState, perProposalDecisions } =
      input;

    // Determine final decision using conservatism
    const { decision, reasonCodes, explanation } = this.aggregateDecisions(
      evaluationResult,
      stalenessResult,
    );

    // Merge control commands
    const controlCommands = this.mergeControlCommands(
      evaluationResult.control_commands,
      input.additionalControlCommands,
    );

    // Build trace context
    const trace = this.buildTraceContext(request, evaluationResult);

    // Build audit redaction
    const auditRedaction = {
      summary: `Decision: ${decision}. ${explanation}`,
      decision,
      reason_codes: reasonCodes,
    };

    // Construct response
    const response: SupervisionResponse = {
      hermes_version: CURRENT_HERMES_VERSION,
      message_type: 'supervision_response',
      trace,
      mode: request.mode,
      subject: request.subject,
      snapshot: request.snapshot,
      response_timestamp: new Date().toISOString(),
      decision,
      reason_codes: reasonCodes,
      explanation,
      audit_redaction: auditRedaction,
    };

    // Add optional fields
    if (request.idempotency_key) {
      (response as Record<string, unknown>).request_idempotency_key = request.idempotency_key;
    }

    if (evaluationResult.approved_constraints && decision === 'APPROVED') {
      (response as Record<string, unknown>).approved_constraints = this.convertApprovedConstraints(
        evaluationResult.approved_constraints,
      );
    }

    if (controlCommands && controlCommands.length > 0) {
      (response as Record<string, unknown>).control_commands =
        this.convertControlCommands(controlCommands);
    }

    if (safeModeState) {
      (response as Record<string, unknown>).safe_mode_state_used = {
        enabled: safeModeState.enabled,
        reason: safeModeState.reason,
        effective_at: safeModeState.effective_at,
        effective_until: safeModeState.effective_until,
      };
    }

    if (perProposalDecisions && perProposalDecisions.length > 0) {
      (response as Record<string, unknown>).per_proposal_decisions = perProposalDecisions;
    }

    return response;
  }

  /**
   * Build a minimal error response for schema validation failures.
   */
  buildErrorResponse(
    request: Partial<SupervisionRequest>,
    errorMessage: string,
    reasonCodes: ReasonCode[] = ['schema_invalid'],
  ): SupervisionResponse {
    const trace = this.buildErrorTraceContext(request);

    return {
      hermes_version: CURRENT_HERMES_VERSION,
      message_type: 'supervision_response',
      trace,
      mode: request.mode ?? 'wellness',
      subject: request.subject ?? { subject_id: 'unknown', subject_type: 'patient' },
      snapshot: request.snapshot ?? { snapshot_id: 'unknown' },
      response_timestamp: new Date().toISOString(),
      decision: 'HARD_STOP',
      reason_codes: reasonCodes,
      explanation: errorMessage,
      audit_redaction: {
        summary: `HARD_STOP: ${errorMessage}`,
        decision: 'HARD_STOP',
        reason_codes: reasonCodes,
      },
    };
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Aggregate decisions from multiple sources using conservatism.
   */
  private aggregateDecisions(
    evalResult: EvaluationResult,
    stalenessResult?: StalenessResult,
  ): {
    decision: SupervisionDecision;
    reasonCodes: ReasonCode[];
    explanation: string;
  } {
    let decision = evalResult.decision;
    let reasonCodes = [...evalResult.reason_codes];
    let explanation = evalResult.explanation;

    // If staleness indicates a more conservative decision, use it
    if (stalenessResult) {
      if (stalenessResult.is_missing) {
        // Missing snapshot is always HARD_STOP
        if (DECISION_PRECEDENCE.HARD_STOP > DECISION_PRECEDENCE[decision]) {
          decision = 'HARD_STOP';
          explanation = stalenessResult.explanation;
        }
        reasonCodes = this.mergeReasonCodes(reasonCodes, [
          'schema_invalid',
          'data_quality_warning',
        ]);
      } else if (stalenessResult.is_stale) {
        // Stale snapshot - use more conservative of the two
        const stalenessDecision = this.stalenessToDecision(stalenessResult);
        if (DECISION_PRECEDENCE[stalenessDecision] > DECISION_PRECEDENCE[decision]) {
          decision = stalenessDecision;
          explanation = `${evalResult.explanation} Additionally: ${stalenessResult.explanation}`;
        }
        reasonCodes = this.mergeReasonCodes(reasonCodes, ['data_quality_warning']);
      }
    }

    return { decision, reasonCodes, explanation };
  }

  /**
   * Convert staleness result to a supervision decision.
   */
  private stalenessToDecision(result: StalenessResult): SupervisionDecision {
    if (result.is_missing) return 'HARD_STOP';
    if (!result.is_stale) return 'APPROVED';

    // Stale in clinical mode always routes
    if (result.mode === 'advocate_clinical') return 'ROUTE_TO_CLINICIAN';

    // In wellness, default to REQUEST_MORE_INFO (low risk assumed)
    // The actual risk level should be determined by the caller
    return 'REQUEST_MORE_INFO';
  }

  /**
   * Build trace context for the response.
   */
  private buildTraceContext(
    request: SupervisionRequest,
    evalResult: EvaluationResult,
  ): TraceContext {
    const requestTrace = request.trace;

    return {
      trace_id: `${requestTrace.trace_id}-response`,
      created_at: new Date().toISOString() as TraceContext['created_at'],
      producer: {
        system: this.systemId as 'popper',
        service_version: this.systemVersion,
        ruleset_version: evalResult.policy_version,
      },
      parent_span_id: requestTrace.trace_id,
    };
  }

  /**
   * Build trace context for error responses.
   */
  private buildErrorTraceContext(request: Partial<SupervisionRequest>): TraceContext {
    const traceId = request.trace?.trace_id ?? `error-${Date.now()}`;

    return {
      trace_id: `${traceId}-error-response`,
      created_at: new Date().toISOString() as TraceContext['created_at'],
      producer: {
        system: this.systemId as 'popper',
        service_version: this.systemVersion,
      },
      parent_span_id: traceId,
    };
  }

  /**
   * Merge control commands from multiple sources.
   */
  private mergeControlCommands(
    evalCommands?: ControlCommand[],
    additionalCommands?: ControlCommand[],
  ): ControlCommand[] | undefined {
    const commands: ControlCommand[] = [];

    if (evalCommands) {
      commands.push(...evalCommands);
    }
    if (additionalCommands) {
      commands.push(...additionalCommands);
    }

    return commands.length > 0 ? commands : undefined;
  }

  /**
   * Merge and deduplicate reason codes.
   */
  private mergeReasonCodes(existing: ReasonCode[], additional: ReasonCode[]): ReasonCode[] {
    const set = new Set([...existing, ...additional]);
    return Array.from(set);
  }

  /**
   * Convert internal approved constraints to Hermes format.
   */
  private convertApprovedConstraints(
    constraints: EvaluationResult['approved_constraints'],
  ): HermesApprovedConstraints | undefined {
    if (!constraints) return undefined;

    const result: HermesApprovedConstraints = {};

    if (constraints.must_route_after) {
      // Convert ISO duration to timestamp if needed
      (result as Record<string, unknown>).must_route_after = constraints.must_route_after;
    }

    if (constraints.allowed_actions) {
      (result as Record<string, unknown>).allowed_actions = constraints.allowed_actions;
    }

    return Object.keys(result).length > 0 ? result : undefined;
  }

  /**
   * Convert internal control commands to Hermes format.
   */
  private convertControlCommands(
    commands: ControlCommand[],
  ): Array<{ kind: string; [key: string]: unknown }> {
    return commands.map((cmd) => ({
      kind: cmd.kind,
      ...(cmd.safe_mode && { safe_mode: cmd.safe_mode }),
      ...(cmd.setting && { setting: cmd.setting }),
    }));
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a DecisionBuilder with optional system identification.
 */
export function createDecisionBuilder(
  systemId = 'popper',
  systemVersion = '1.0.0',
): DecisionBuilder {
  return new DecisionBuilder(systemId, systemVersion);
}

/**
 * Default decision builder instance.
 */
export const defaultDecisionBuilder = new DecisionBuilder();

// =============================================================================
// Utilities
// =============================================================================

/**
 * Get the more conservative of two decisions.
 */
export function getMoreConservativeDecision(
  a: SupervisionDecision,
  b: SupervisionDecision,
): SupervisionDecision {
  return DECISION_PRECEDENCE[a] >= DECISION_PRECEDENCE[b] ? a : b;
}

/**
 * Check if a decision is more conservative than another.
 */
export function isMoreConservative(
  candidate: SupervisionDecision,
  baseline: SupervisionDecision,
): boolean {
  return DECISION_PRECEDENCE[candidate] > DECISION_PRECEDENCE[baseline];
}

/**
 * Build per-proposal decisions from evaluation results.
 * Used for partial approval scenarios.
 */
export function buildPerProposalDecisions(
  proposals: SupervisionRequest['proposals'],
  defaultDecision: SupervisionDecision,
  defaultReasonCodes: ReasonCode[],
  overrides?: Map<string, { decision: SupervisionDecision; reason_codes: ReasonCode[] }>,
): PerProposalDecision[] {
  return proposals.map((proposal) => {
    const override = overrides?.get(proposal.proposal_id);
    return {
      proposal_id: proposal.proposal_id,
      decision: override?.decision ?? defaultDecision,
      reason_codes: override?.reason_codes ?? defaultReasonCodes,
    };
  });
}
