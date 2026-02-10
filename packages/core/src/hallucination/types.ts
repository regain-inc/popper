/**
 * Hallucination Detection Types
 *
 * Deterministic hallucination checks per spec §3.
 * Only deterministic signals may trigger the `hallucination_detected` DSL condition.
 * Measurement-based detection feeds metrics only and MUST NOT block.
 *
 * @see docs/specs/02-popper-specs/05-popper-measurement-protocols.md §3
 * @module hallucination/types
 */

// =============================================================================
// Detection Result
// =============================================================================

/**
 * Severity levels for hallucination detection.
 * Maps directly to DerivedSignals.hallucination.severity.
 */
export type HallucinationSeverity = 'minor' | 'significant' | 'critical';

/**
 * Result of deterministic hallucination detection.
 */
export interface HallucinationDetectionResult {
  /** Whether any hallucination signal was detected */
  detected: boolean;
  /** Highest severity across all signals */
  severity?: HallucinationSeverity;
  /** Individual signals that fired */
  signals: HallucinationSignal[];
}

/**
 * A single hallucination signal detected during checks.
 */
export interface HallucinationSignal {
  /** Type of check that fired */
  type: HallucinationSignalType;
  /** Severity of this signal */
  severity: HallucinationSeverity;
  /** Human-readable description for audit */
  description: string;
  /** Proposal ID if signal is proposal-specific */
  proposal_id?: string;
}

/**
 * Types of deterministic hallucination signals.
 * Each corresponds to a structural check that requires no LLM.
 */
export type HallucinationSignalType =
  | 'empty_evidence_id'
  | 'missing_citation'
  | 'empty_citation'
  | 'future_timestamp'
  | 'snapshot_hash_mismatch'
  | 'duplicate_evidence_id'
  | 'upstream_flag';

// =============================================================================
// Severity Precedence
// =============================================================================

/**
 * Severity precedence for comparison.
 */
export const SEVERITY_PRECEDENCE: Record<HallucinationSeverity, number> = {
  minor: 1,
  significant: 2,
  critical: 3,
};
