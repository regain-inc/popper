import type {
  AuditEvent,
  AuditEventsResponse,
  AuditTimeseriesResponse,
  Incident,
  SafeModeHistoryEntry,
  SafeModeState,
  StatusResponse,
  TimeseriesBucket,
} from '@/types/api';

// Mock data for development

export const mockStatus: StatusResponse = {
  organization: {
    id: null,
    name: null,
  },
  service: {
    name: 'popper',
    version: '1.0.0',
    uptime_seconds: 86400,
    healthy: true,
  },
  safe_mode: {
    enabled: false,
    reason: null,
    effective_at: null,
    effective_until: null,
    enabled_by: null,
    scope: 'global',
  },
  policy: {
    active_pack: 'default',
    version: '1.0.0',
    rules_count: 12,
  },
  counters: {
    requests_total: 1523,
    decisions: {
      approved: 1401,
      hard_stop: 12,
      route_to_clinician: 98,
      request_more_info: 12,
    },
    validation_failures: 3,
  },
  drift: {
    status: 'normal',
    signals: [
      {
        name: 'hard_stop_rate',
        current_value: 0.008,
        baseline_value: 0.01,
        threshold_warning: 0.05,
        threshold_critical: 0.15,
        status: 'normal',
      },
      {
        name: 'route_to_clinician_rate',
        current_value: 0.064,
        baseline_value: 0.06,
        threshold_warning: 0.12,
        threshold_critical: 0.3,
        status: 'normal',
      },
      {
        name: 'validation_failure_rate',
        current_value: 0.002,
        baseline_value: 0.001,
        threshold_warning: 0.01,
        threshold_critical: 0.05,
        status: 'normal',
      },
    ],
  },
};

export const mockSafeModeEnabled: SafeModeState = {
  enabled: true,
  reason: 'Drift detected: hard_stop_rate elevated',
  effective_at: '2026-01-25T10:00:00.000Z',
  effective_until: '2026-01-25T18:00:00.000Z',
  enabled_by: 'ops@regain.ai',
  scope: 'global',
};

export const mockSafeModeHistory: SafeModeHistoryEntry[] = [
  {
    id: 'smh_001',
    enabled: true,
    reason: 'Drift detected: hard_stop_rate elevated',
    effective_at: '2026-01-25T10:00:00.000Z',
    effective_until: '2026-01-25T14:00:00.000Z',
    created_by: 'ops@regain.ai',
    created_at: '2026-01-25T10:00:00.000Z',
    scope: 'global',
    organization_id: null,
  },
  {
    id: 'smh_002',
    enabled: false,
    reason: 'Metrics back to normal',
    effective_at: '2026-01-25T14:00:00.000Z',
    effective_until: null,
    created_by: 'ops@regain.ai',
    created_at: '2026-01-25T14:00:00.000Z',
    scope: 'global',
    organization_id: null,
  },
  {
    id: 'smh_003',
    enabled: true,
    reason: 'Scheduled maintenance',
    effective_at: '2026-01-20T09:00:00.000Z',
    effective_until: '2026-01-20T11:00:00.000Z',
    created_by: 'admin@regain.local',
    created_at: '2026-01-20T09:00:00.000Z',
    scope: 'organization',
    organization_id: 'org_regain',
  },
];

export const mockIncidents: Incident[] = [
  {
    id: 'inc_1',
    organization_id: 'org_demo',
    type: 'drift_threshold_breach',
    status: 'open',
    trigger_signal: 'validation_failure_rate',
    trigger_level: 'critical',
    trigger_value: '0.15',
    threshold_value: '0.10',
    baseline_value: '0.02',
    title: 'Critical: validation_failure_rate exceeded threshold',
    description: 'Validation failure rate spiked to 15%, exceeding critical threshold of 10%',
    metadata: null,
    safe_mode_enabled: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    resolved_at: null,
    resolved_by: null,
    resolution_notes: null,
    cooldown_until: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 'inc_2',
    organization_id: 'org_demo',
    type: 'drift_threshold_breach',
    status: 'acknowledged',
    trigger_signal: 'hard_stop_rate',
    trigger_level: 'warning',
    trigger_value: '0.08',
    threshold_value: '0.06',
    baseline_value: '0.03',
    title: 'Warning: hard_stop_rate approaching threshold',
    description: 'Hard stop rate increased to 8%, approaching critical threshold',
    metadata: null,
    safe_mode_enabled: null,
    resolved_at: null,
    resolved_by: null,
    resolution_notes: null,
    cooldown_until: null,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'inc_3',
    organization_id: 'org_demo',
    type: 'manual',
    status: 'resolved',
    trigger_signal: null,
    trigger_level: null,
    trigger_value: null,
    threshold_value: null,
    baseline_value: null,
    title: 'Manual incident: Scheduled maintenance',
    description: 'Safe-mode enabled for scheduled system maintenance',
    metadata: null,
    safe_mode_enabled: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    resolved_at: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
    resolved_by: 'ops@regain.ai',
    resolution_notes: 'Maintenance completed successfully. All systems operational.',
    cooldown_until: null,
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
  },
];

export const mockAuditEvents: AuditEvent[] = [
  {
    id: 'evt_001',
    event_type: 'SUPERVISION_RESPONSE_DECIDED',
    occurred_at: '2026-01-26T14:32:15.123Z',
    trace: { trace_id: 'tr_xyz789', span_id: 'sp_001' },
    mode: 'wellness',
    subject: { subject_id: 'anon_patient_456', organization_id: 'org_regain' },
    summary: 'APPROVED lifestyle recommendation',
    tags: { decision: 'APPROVED', proposal_kind: 'LIFESTYLE_MODIFICATION_PROPOSAL' },
  },
  {
    id: 'evt_002',
    event_type: 'SUPERVISION_RESPONSE_DECIDED',
    occurred_at: '2026-01-26T14:30:02.456Z',
    trace: { trace_id: 'tr_abc123', span_id: 'sp_002' },
    mode: 'advocate_clinical',
    subject: { subject_id: 'anon_patient_789', organization_id: 'org_regain' },
    summary: 'ROUTE_TO_CLINICIAN: medication proposal requires review',
    tags: {
      decision: 'ROUTE_TO_CLINICIAN',
      proposal_kind: 'MEDICATION_ORDER_PROPOSAL',
      reason_code: 'high_uncertainty',
    },
  },
  {
    id: 'evt_003',
    event_type: 'SUPERVISION_RESPONSE_DECIDED',
    occurred_at: '2026-01-26T14:28:45.789Z',
    trace: { trace_id: 'tr_def456', span_id: 'sp_003' },
    mode: 'advocate_clinical',
    subject: { subject_id: 'anon_patient_123', organization_id: 'org_regain' },
    summary: 'HARD_STOP: schema validation failed',
    tags: { decision: 'HARD_STOP', reason_code: 'schema_invalid' },
  },
  {
    id: 'evt_004',
    event_type: 'SAFE_MODE_ENABLED',
    occurred_at: '2026-01-26T10:00:00.000Z',
    trace: { trace_id: 'tr_system_001', span_id: 'sp_sys_001' },
    mode: 'wellness',
    subject: { subject_id: 'system', organization_id: 'org_regain' },
    summary: 'Safe-mode enabled by ops: Drift detected',
    tags: { enabled_by: 'ops@regain.ai', reason: 'Drift detected' },
  },
  {
    id: 'evt_005',
    event_type: 'VALIDATION_FAILED',
    occurred_at: '2026-01-26T09:45:30.123Z',
    trace: { trace_id: 'tr_val_001', span_id: 'sp_val_001' },
    mode: 'advocate_clinical',
    subject: { subject_id: 'anon_patient_567', organization_id: 'org_regain' },
    summary: 'Schema validation failed: missing required field',
    tags: { failure_type: 'schema_invalid' },
  },
];

export function getMockAuditEventsResponse(offset = 0, limit = 50): AuditEventsResponse {
  const events = mockAuditEvents.slice(offset, offset + limit);
  return {
    events,
    pagination: {
      total: mockAuditEvents.length,
      limit,
      offset,
      has_more: offset + limit < mockAuditEvents.length,
    },
  };
}

export function getMockTimeseries(): AuditTimeseriesResponse {
  const now = new Date();
  const buckets: TimeseriesBucket[] = [];

  for (let i = 23; i >= 0; i--) {
    const timestamp = new Date(now);
    timestamp.setHours(now.getHours() - i, 0, 0, 0);

    const approved = Math.floor(Math.random() * 100) + 50;
    const routeToClinicianCount = Math.floor(Math.random() * 20) + 5;
    const hardStop = Math.floor(Math.random() * 5);
    const requestMoreInfo = Math.floor(Math.random() * 5);

    buckets.push({
      timestamp: timestamp.toISOString(),
      counts: {
        APPROVED: approved,
        ROUTE_TO_CLINICIAN: routeToClinicianCount,
        HARD_STOP: hardStop,
        REQUEST_MORE_INFO: requestMoreInfo,
      },
      total: approved + routeToClinicianCount + hardStop + requestMoreInfo,
    });
  }

  return {
    buckets,
    total_events: buckets.reduce((sum, b) => sum + b.total, 0),
  };
}
