/**
 * Audit event types and interfaces
 *
 * @see docs/specs/02-popper-specs/01-popper-system-spec.md §7
 * @module audit/types
 */

import type { ReasonCode, SupervisionDecision } from '@regain/hermes';

/**
 * Audit event types emitted by Popper
 */
export type AuditEventType =
  | 'SUPERVISION_DECISION'
  | 'VALIDATION_FAILED'
  | 'SAFE_MODE_CHANGED'
  | 'CONTROL_COMMAND'
  | 'POLICY_LIFECYCLE'
  | 'EXPORT_GENERATED'
  | 'EXPORT_DOWNLOADED'
  | 'EXPORT_ACCESSED'
  | 'OTHER';

/**
 * Tags for categorizing audit events
 */
export type AuditEventTag =
  | 'clock_skew_rejected'
  | 'replay_suspected'
  | 'snapshot_integrity_failed'
  | 'unauthorized_org'
  | 'stale_snapshot'
  | 'schema_invalid'
  | 'policy_violation'
  | 'org_inactive'
  | 'org_not_found'
  | 'mode_not_allowed'
  | 'high_risk'
  | 'low_risk'
  | 'policy_created'
  | 'policy_submitted'
  | 'policy_approved'
  | 'policy_rejected'
  | 'policy_activated'
  | 'policy_archived'
  | 'policy_rollback'
  | 'export_generated'
  | 'export_downloaded'
  | 'export_accessed';

/**
 * Audit event payload structure (PHI-redacted)
 */
export interface AuditEventPayload {
  /** Request mode (wellness | advocate_clinical) */
  mode?: string;

  /** Proposal kinds in the request */
  proposal_kinds?: string[];

  /** Proposal count */
  proposal_count?: number;

  /** Staleness information */
  staleness?: {
    is_stale: boolean;
    is_missing: boolean;
    age_hours?: number;
    threshold_hours?: number;
  };

  /** Evaluation metadata */
  evaluation?: {
    matched_rules?: string[];
    policy_version: string;
    evaluation_time_ms: number;
  };

  /** Error details for VALIDATION_FAILED events */
  error?: {
    message: string;
    code?: string;
  };

  /** Safe mode state at time of decision */
  safe_mode?: {
    active: boolean;
    effective_at?: string;
  };

  /** Additional context (must be PHI-free) */
  [key: string]: unknown;
}

/**
 * Audit event to be emitted
 */
export interface AuditEventInput {
  /** Trace ID for event correlation */
  traceId: string;

  /** Event type */
  eventType: AuditEventType;

  /** Subject ID (patient identifier) */
  subjectId: string;

  /** Organization ID */
  organizationId: string;

  /** Supervision decision (for SUPERVISION_DECISION events) */
  decision?: SupervisionDecision;

  /** Reason codes from the decision */
  reasonCodes?: ReasonCode[];

  /** Policy pack version used */
  policyPackVersion: string;

  /** Whether safe mode was active */
  safeModeActive?: boolean;

  /** Processing latency in milliseconds */
  latencyMs?: number;

  /** Number of proposals in request */
  proposalCount?: number;

  /** Additional payload data (must be PHI-redacted) */
  payload?: AuditEventPayload;

  /** Tags for categorization */
  tags?: AuditEventTag[];
}

/**
 * Stored audit event (with generated fields)
 */
export interface StoredAuditEvent extends AuditEventInput {
  /** Unique event ID */
  id: string;

  /** Timestamp when event was created */
  createdAt: Date;
}

/**
 * Audit emitter configuration
 */
export interface AuditEmitterConfig {
  /** Enable batching for writes */
  batchEnabled?: boolean;

  /** Maximum batch size before flush */
  batchSize?: number;

  /** Maximum time to wait before flushing batch (ms) */
  batchFlushInterval?: number;

  /** Enable async writes (non-blocking) */
  asyncWrites?: boolean;
}

/**
 * Default emitter configuration
 */
export const DEFAULT_AUDIT_EMITTER_CONFIG: Required<AuditEmitterConfig> = {
  batchEnabled: true,
  batchSize: 100,
  batchFlushInterval: 1000,
  asyncWrites: true,
};
