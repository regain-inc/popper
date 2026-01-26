/**
 * Staleness Validator
 * Popper is AUTHORITATIVE for snapshot staleness validation.
 *
 * Brain MAY check staleness for UX optimization, but Popper MUST validate
 * independently as the last line of defense.
 *
 * @see docs/specs/02-popper-specs/01-popper-system-spec.md §5.1.1
 * @module policy-engine/staleness
 */

import type { Mode, SupervisionRequest } from '../hermes';

// =============================================================================
// Types
// =============================================================================

/**
 * Staleness thresholds configuration.
 */
export interface StalenessThresholds {
  /** Wellness mode threshold in hours (default: 24) */
  wellness_hours: number;
  /** Clinical mode threshold in hours (default: 4) */
  clinical_hours: number;
}

/**
 * Per-signal staleness overrides (v2 extension).
 */
export interface SignalStalenessOverrides {
  [signalType: string]: number; // hours
}

/**
 * Complete staleness configuration.
 */
export interface StalenessConfig {
  thresholds: StalenessThresholds;
  /** Per-signal overrides (optional, v2 extension) */
  signals?: SignalStalenessOverrides;
}

/**
 * Result of staleness validation.
 */
export interface StalenessResult {
  /** Whether the snapshot is stale */
  is_stale: boolean;
  /** Whether the snapshot is missing entirely */
  is_missing: boolean;
  /** Age of the snapshot in hours (undefined if missing) */
  age_hours?: number;
  /** Threshold that was applied in hours */
  threshold_hours: number;
  /** Mode used for validation */
  mode: Mode;
  /** Human-readable explanation */
  explanation: string;
  /** Required action if stale */
  required_action?: {
    kind: 'refresh_snapshot';
    details: {
      current_age_hours: number;
      threshold_hours: number;
    };
  };
}

/**
 * Risk level for proposal evaluation.
 */
export type ProposalRiskLevel = 'low' | 'high';

/**
 * High-risk proposal kinds that require stricter staleness handling.
 */
export const HIGH_RISK_PROPOSAL_KINDS = [
  'MEDICATION_ORDER_PROPOSAL',
  'TRIAGE_ROUTE',
  'ESCALATE_TO_CARE_TEAM',
] as const;

/**
 * Default staleness thresholds per spec.
 */
export const DEFAULT_STALENESS_THRESHOLDS: StalenessThresholds = {
  wellness_hours: 24,
  clinical_hours: 4,
};

// =============================================================================
// Staleness Validator
// =============================================================================

/**
 * StalenessValidator implements authoritative snapshot staleness validation.
 *
 * Popper is the authoritative staleness validator because:
 * 1. Popper is open source and Brain-agnostic
 * 2. Cannot assume Brain has validated staleness
 * 3. Must validate independently as last line of defense
 */
export class StalenessValidator {
  private config: StalenessConfig;

  constructor(config?: Partial<StalenessConfig>) {
    this.config = {
      thresholds: {
        ...DEFAULT_STALENESS_THRESHOLDS,
        ...config?.thresholds,
      },
      signals: config?.signals,
    };
  }

  /**
   * Validate snapshot staleness for a supervision request.
   *
   * @param request - The supervision request to validate
   * @param currentTime - Current time for staleness calculation (defaults to now)
   */
  validate(request: SupervisionRequest, currentTime: Date = new Date()): StalenessResult {
    const mode = request.mode;
    const threshold = this.getThreshold(mode);

    // Check for missing snapshot
    const snapshot = this.extractSnapshot(request);
    if (!snapshot) {
      return {
        is_stale: false,
        is_missing: true,
        threshold_hours: threshold,
        mode,
        explanation:
          'No health state snapshot provided. Cannot evaluate safety without patient data.',
      };
    }

    // Calculate age
    const snapshotTime = this.extractSnapshotTime(snapshot);
    if (!snapshotTime) {
      // Missing timestamp is treated as missing snapshot
      return {
        is_stale: false,
        is_missing: true,
        threshold_hours: threshold,
        mode,
        explanation: 'Snapshot timestamp is missing. Cannot determine data freshness.',
      };
    }

    const ageMs = currentTime.getTime() - snapshotTime.getTime();
    const ageHours = ageMs / (1000 * 60 * 60);

    const isStale = ageHours > threshold;

    if (isStale) {
      return {
        is_stale: true,
        is_missing: false,
        age_hours: ageHours,
        threshold_hours: threshold,
        mode,
        explanation: `Health state snapshot is ${ageHours.toFixed(1)} hours old, exceeding the ${threshold} hour threshold for ${mode} mode.`,
        required_action: {
          kind: 'refresh_snapshot',
          details: {
            current_age_hours: ageHours,
            threshold_hours: threshold,
          },
        },
      };
    }

    return {
      is_stale: false,
      is_missing: false,
      age_hours: ageHours,
      threshold_hours: threshold,
      mode,
      explanation: `Snapshot is fresh (${ageHours.toFixed(1)} hours old, threshold: ${threshold} hours).`,
    };
  }

  /**
   * Determine the recommended decision based on staleness and risk level.
   *
   * Decision matrix (from spec):
   * - Low-risk + stale → REQUEST_MORE_INFO
   * - High-risk + stale (wellness) → ROUTE_TO_CLINICIAN
   * - Any + stale (advocate_clinical) → ROUTE_TO_CLINICIAN
   * - Missing → HARD_STOP
   */
  getRecommendedDecision(
    result: StalenessResult,
    riskLevel: ProposalRiskLevel,
  ): 'APPROVED' | 'REQUEST_MORE_INFO' | 'ROUTE_TO_CLINICIAN' | 'HARD_STOP' {
    // Missing snapshot is always HARD_STOP
    if (result.is_missing) {
      return 'HARD_STOP';
    }

    // Fresh snapshot is APPROVED (staleness check passes)
    if (!result.is_stale) {
      return 'APPROVED';
    }

    // Stale in advocate_clinical mode → always ROUTE
    if (result.mode === 'advocate_clinical') {
      return 'ROUTE_TO_CLINICIAN';
    }

    // Stale in wellness mode → depends on risk level
    if (riskLevel === 'high') {
      return 'ROUTE_TO_CLINICIAN';
    }

    return 'REQUEST_MORE_INFO';
  }

  /**
   * Determine the risk level of proposals in a request.
   * Returns 'high' if any proposal is high-risk.
   */
  determineRiskLevel(request: SupervisionRequest): ProposalRiskLevel {
    const proposals = request.proposals ?? [];

    const hasHighRisk = proposals.some((p) =>
      HIGH_RISK_PROPOSAL_KINDS.includes(p.kind as (typeof HIGH_RISK_PROPOSAL_KINDS)[number]),
    );

    return hasHighRisk ? 'high' : 'low';
  }

  /**
   * Get the reason codes for a staleness-based decision.
   */
  getReasonCodes(
    result: StalenessResult,
    riskLevel: ProposalRiskLevel,
  ): Array<'data_quality_warning' | 'schema_invalid' | 'risk_too_high' | 'high_uncertainty'> {
    if (result.is_missing) {
      return ['schema_invalid', 'data_quality_warning'];
    }

    if (result.is_stale) {
      const codes: Array<'data_quality_warning' | 'risk_too_high' | 'high_uncertainty'> = [
        'data_quality_warning',
      ];

      if (riskLevel === 'high' || result.mode === 'advocate_clinical') {
        codes.push('risk_too_high');
      }

      if (result.mode === 'advocate_clinical') {
        codes.push('high_uncertainty');
      }

      return codes;
    }

    return [];
  }

  /**
   * Get the staleness threshold for a given mode.
   */
  getThreshold(mode: Mode): number {
    return mode === 'advocate_clinical'
      ? this.config.thresholds.clinical_hours
      : this.config.thresholds.wellness_hours;
  }

  /**
   * Get current configuration.
   */
  getConfig(): StalenessConfig {
    return { ...this.config };
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private extractSnapshot(request: SupervisionRequest): Record<string, unknown> | undefined {
    // Try snapshot_payload first (embedded)
    const payload = (request as Record<string, unknown>).snapshot_payload;
    if (payload && typeof payload === 'object') {
      return payload as Record<string, unknown>;
    }

    // Try snapshot (might be embedded or referenced)
    const snapshot = (request as Record<string, unknown>).snapshot;
    if (snapshot && typeof snapshot === 'object') {
      return snapshot as Record<string, unknown>;
    }

    // Check for snapshot_ref (reference only, no data to validate age)
    const snapshotRef = (request as Record<string, unknown>).snapshot_ref;
    if (snapshotRef && typeof snapshotRef === 'string') {
      // Reference exists but we can't determine age without fetching
      // This is a limitation - in production, the gateway should resolve refs
      return undefined;
    }

    return undefined;
  }

  private extractSnapshotTime(snapshot: Record<string, unknown>): Date | undefined {
    // Try created_at first (standard field)
    const createdAt = snapshot.created_at;
    if (typeof createdAt === 'string') {
      const date = new Date(createdAt);
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }

    // Try timestamp as fallback
    const timestamp = snapshot.timestamp;
    if (typeof timestamp === 'string') {
      const date = new Date(timestamp);
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }

    // Try snapshot_timestamp
    const snapshotTimestamp = snapshot.snapshot_timestamp;
    if (typeof snapshotTimestamp === 'string') {
      const date = new Date(snapshotTimestamp);
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }

    return undefined;
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a StalenessValidator with optional configuration.
 */
export function createStalenessValidator(config?: Partial<StalenessConfig>): StalenessValidator {
  return new StalenessValidator(config);
}

/**
 * Default staleness validator instance with standard thresholds.
 */
export const defaultStalenessValidator = new StalenessValidator();
