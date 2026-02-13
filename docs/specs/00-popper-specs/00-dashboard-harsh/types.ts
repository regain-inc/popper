/**
 * Popper Dashboard Types
 *
 * Copy these types to your frontend codebase.
 * These match the API responses from Popper service.
 */

// ============================================================================
// Organization Types
// ============================================================================

export interface Organization {
  id: string;
  name: string;
}

// ============================================================================
// Status View Types (POP-020)
// ============================================================================

export interface StatusResponse {
  // Organization context (null = global view)
  organization: {
    id: string | null;
    name: string | null;
  };

  service: {
    name: "popper";
    version: string;
    uptime_seconds: number;
    healthy: boolean;
  };

  safe_mode: SafeModeState;

  policy: {
    active_pack: string;
    version: string;
    rules_count: number;
  };

  counters: {
    requests_total: number;
    decisions: {
      approved: number;
      hard_stop: number;
      route_to_clinician: number;
      request_more_info: number;
    };
    validation_failures: number;
  };

  drift: {
    status: DriftStatus;
    signals: DriftSignal[];
  };
}

export type DriftStatus = "normal" | "warning" | "critical";

export interface DriftSignal {
  name: string;
  current_value: number;
  baseline_value: number;
  threshold_warning: number;
  threshold_critical: number;
  status: DriftStatus;
}

// ============================================================================
// Audit Log Types (POP-021)
// ============================================================================

export interface AuditEventsResponse {
  events: AuditEvent[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export interface AuditEvent {
  id: string;
  event_type: AuditEventType;
  occurred_at: string;

  trace: {
    trace_id: string;
    span_id?: string;
    parent_span_id?: string;
  };

  mode: Mode;
  subject: {
    subject_id: string;
    organization_id?: string;
  };

  summary: string;
  tags?: Record<string, string>;
}

export type AuditEventType =
  | "SUPERVISION_REQUEST_RECEIVED"
  | "SUPERVISION_RESPONSE_DECIDED"
  | "CONTROL_COMMAND_ISSUED"
  | "SAFE_MODE_ENABLED"
  | "SAFE_MODE_DISABLED"
  | "VALIDATION_FAILED"
  | "OTHER";

export type Mode = "wellness" | "advocate_clinical";

export type Decision =
  | "APPROVED"
  | "HARD_STOP"
  | "ROUTE_TO_CLINICIAN"
  | "REQUEST_MORE_INFO";

// ============================================================================
// Safe-Mode Types (POP-022)
// ============================================================================

export interface SafeModeState {
  enabled: boolean;
  reason: string | null;
  effective_at: string | null;
  effective_until: string | null;
  enabled_by: string | null;
  scope: "global" | "organization";
  organization_id: string | null;
}

export interface SafeModeRequest {
  enabled: boolean;
  reason: string;
  organization_id?: string;          // Omit for global, include for org-specific
  effective_at?: string;
  effective_until?: string | null;
}

export interface SafeModeResponse {
  success: boolean;
  safe_mode: SafeModeState;
  control_command: {
    command_id: string;
    command_type: "SET_SAFE_MODE";
    issued_at: string;
  };
}

export interface SafeModeHistoryResponse {
  history: SafeModeHistoryEntry[];
}

export interface SafeModeHistoryEntry {
  id: string;
  enabled: boolean;
  reason: string;
  effective_at: string;
  effective_until: string | null;
  created_by: string;
  created_at: string;
  scope: "global" | "organization";
  organization_id: string | null;
  organization_name: string | null;
}

// ============================================================================
// Timeseries Types (for charts)
// ============================================================================

export interface AuditTimeseriesResponse {
  buckets: TimeseriesBucket[];
  total_events: number;
}

export interface TimeseriesBucket {
  timestamp: string;
  counts: Record<Decision | string, number>;
  total: number;
}

// ============================================================================
// Query Parameters
// ============================================================================

export interface StatusQuery {
  organization_id?: string;
}

export interface AuditEventsQuery {
  limit?: number;
  offset?: number;
  organization_id?: string;
  trace_id?: string;
  event_type?: AuditEventType | AuditEventType[];
  decision?: Decision | Decision[];
  reason_codes?: string[];
  since?: string;
  until?: string;
}

export interface AuditTimeseriesQuery {
  organization_id?: string;
  since: string;              // Required
  until?: string;
  bucket?: "hour" | "day" | "week";
  group_by?: "decision" | "event_type";
}

export interface SafeModeQuery {
  organization_id?: string;
}

export interface SafeModeHistoryQuery {
  organization_id?: string;
  limit?: number;
  since?: string;
  scope?: "global" | "organization" | "all";
}

// ============================================================================
// UI Helper Types
// ============================================================================

export type BadgeVariant = "default" | "success" | "warning" | "destructive" | "outline";

export const EVENT_TYPE_BADGES: Record<AuditEventType, { label: string; variant: BadgeVariant }> = {
  SUPERVISION_REQUEST_RECEIVED: { label: "Request", variant: "outline" },
  SUPERVISION_RESPONSE_DECIDED: { label: "Decision", variant: "default" },
  CONTROL_COMMAND_ISSUED: { label: "Command", variant: "default" },
  SAFE_MODE_ENABLED: { label: "Safe-Mode ON", variant: "warning" },
  SAFE_MODE_DISABLED: { label: "Safe-Mode OFF", variant: "success" },
  VALIDATION_FAILED: { label: "Validation Failed", variant: "destructive" },
  OTHER: { label: "Other", variant: "outline" },
};

export const DECISION_BADGES: Record<Decision, { label: string; variant: BadgeVariant }> = {
  APPROVED: { label: "Approved", variant: "success" },
  HARD_STOP: { label: "Hard Stop", variant: "destructive" },
  ROUTE_TO_CLINICIAN: { label: "Route", variant: "warning" },
  REQUEST_MORE_INFO: { label: "More Info", variant: "default" },
};

export const DRIFT_STATUS_COLORS: Record<DriftStatus, string> = {
  normal: "#22c55e",   // green-500
  warning: "#eab308",  // yellow-500
  critical: "#ef4444", // red-500
};
