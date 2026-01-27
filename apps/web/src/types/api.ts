// API Response Types for Popper Dashboard

export type SupervisionDecision =
  | 'APPROVED'
  | 'HARD_STOP'
  | 'ROUTE_TO_CLINICIAN'
  | 'REQUEST_MORE_INFO';

export type AuditEventType =
  | 'SUPERVISION_REQUEST_RECEIVED'
  | 'SUPERVISION_RESPONSE_DECIDED'
  | 'CONTROL_COMMAND_ISSUED'
  | 'SAFE_MODE_ENABLED'
  | 'SAFE_MODE_DISABLED'
  | 'VALIDATION_FAILED'
  | 'OTHER';

export type DriftStatus = 'normal' | 'warning' | 'critical';

export type OperatingMode = 'wellness' | 'advocate_clinical';

// Status View Types
export interface StatusResponse {
  organization: {
    id: string | null;
    name: string | null;
  };
  service: {
    name: 'popper';
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

export interface DriftSignal {
  name: string;
  current_value: number;
  baseline_value: number;
  threshold_warning: number;
  threshold_critical: number;
  status: DriftStatus;
}

// Safe Mode Types
export interface SafeModeState {
  enabled: boolean;
  reason: string | null;
  effective_at: string | null;
  effective_until: string | null;
  enabled_by: string | null;
  scope: 'global' | 'organization';
  organization_id?: string | null;
}

export interface SafeModeRequest {
  enabled: boolean;
  reason: string;
  organization_id?: string;
  effective_at?: string;
  effective_until?: string | null;
}

export interface SafeModeResponse {
  success: boolean;
  safe_mode: SafeModeState;
  control_command: {
    command_id: string;
    command_type: 'SET_SAFE_MODE';
    issued_at: string;
  };
}

export interface SafeModeHistoryEntry {
  id: string;
  enabled: boolean;
  reason: string;
  effective_at: string;
  effective_until: string | null;
  created_by: string;
  created_at: string;
  scope: 'global' | 'organization';
  organization_id: string | null;
}

export interface SafeModeHistoryResponse {
  history: SafeModeHistoryEntry[];
}

// Audit Events Types
export interface AuditEvent {
  id: string;
  event_type: AuditEventType;
  occurred_at: string;
  trace: {
    trace_id: string;
    span_id?: string;
    parent_span_id?: string;
  };
  mode: OperatingMode;
  subject: {
    subject_id: string;
    organization_id?: string;
  };
  summary: string;
  tags?: Record<string, string>;
}

export interface AuditEventsResponse {
  events: AuditEvent[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export interface AuditEventsParams {
  limit?: number;
  offset?: number;
  organization_id?: string;
  trace_id?: string;
  event_type?: string;
  decision?: SupervisionDecision;
  reason_codes?: string;
  since?: string;
  until?: string;
}

export interface TimeseriesBucket {
  timestamp: string;
  counts: Record<string, number>;
  total: number;
}

export interface AuditTimeseriesResponse {
  buckets: TimeseriesBucket[];
  total_events: number;
}

export interface AuditTimeseriesParams {
  organization_id?: string;
  since: string;
  until?: string;
  bucket?: 'hour' | 'day' | 'week';
  group_by?: 'decision' | 'event_type';
}

// Organization Types
export interface Organization {
  id: string;
  name: string;
}
