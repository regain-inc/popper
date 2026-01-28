-- =============================================================================
-- Continuous Aggregate: audit_events_daily
-- =============================================================================
-- Aggregates audit events by day and organization for efficient drift baseline
-- calculation. Required for POP-015A: Drift Baseline Calculation.
--
-- Signals tracked:
-- - request_count: Total supervision requests
-- - approved_count, hard_stop_count, route_to_clinician_count, request_more_info_count
-- - high_uncertainty_count, missing_evidence_count
-- - htv_below_threshold_count, policy_violation_count
-- - validation_failure_count (from reason_codes)

-- Create the continuous aggregate
CREATE MATERIALIZED VIEW audit_events_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', created_at) AS bucket,
  organization_id,

  -- Total requests
  COUNT(*) AS request_count,

  -- Decision counts
  COUNT(*) FILTER (WHERE decision = 'APPROVED') AS approved_count,
  COUNT(*) FILTER (WHERE decision = 'HARD_STOP') AS hard_stop_count,
  COUNT(*) FILTER (WHERE decision = 'ROUTE_TO_CLINICIAN') AS route_to_clinician_count,
  COUNT(*) FILTER (WHERE decision = 'REQUEST_MORE_INFO') AS request_more_info_count,

  -- Reason code counts (check if reason_codes array contains specific code)
  COUNT(*) FILTER (WHERE reason_codes @> '["high_uncertainty"]'::jsonb) AS high_uncertainty_count,
  COUNT(*) FILTER (WHERE reason_codes @> '["missing_evidence"]'::jsonb) AS missing_evidence_count,
  COUNT(*) FILTER (WHERE reason_codes @> '["htv_below_threshold"]'::jsonb) AS htv_below_threshold_count,
  COUNT(*) FILTER (WHERE reason_codes @> '["policy_violation"]'::jsonb) AS policy_violation_count,

  -- Validation failures (from event_type, not decision)
  COUNT(*) FILTER (WHERE event_type = 'VALIDATION_FAILED') AS validation_failure_count,

  -- Latency metrics
  AVG(latency_ms) AS avg_latency_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) AS p99_latency_ms

FROM audit_events
WHERE event_type IN ('SUPERVISION_DECISION', 'VALIDATION_FAILED')
GROUP BY bucket, organization_id;

-- Add refresh policy: refresh every hour, covering last 2 days
-- This ensures baselines are updated hourly with recent data
SELECT add_continuous_aggregate_policy('audit_events_daily',
  start_offset => INTERVAL '2 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour');

-- Create index for efficient baseline queries
CREATE INDEX audit_events_daily_org_bucket_idx
ON audit_events_daily (organization_id, bucket DESC);

-- =============================================================================
-- Comments for documentation
-- =============================================================================

COMMENT ON MATERIALIZED VIEW audit_events_daily IS
'Daily aggregation of audit events for drift baseline calculation.
Used by BaselineCalculator to compute 7-day rolling baselines per signal.';

COMMENT ON COLUMN audit_events_daily.bucket IS 'Day bucket (start of day in UTC)';
COMMENT ON COLUMN audit_events_daily.organization_id IS 'Organization ID or SYSTEM_ORG_ID for global';
COMMENT ON COLUMN audit_events_daily.request_count IS 'Total supervision requests for the day';
COMMENT ON COLUMN audit_events_daily.approved_count IS 'Count of APPROVED decisions';
COMMENT ON COLUMN audit_events_daily.hard_stop_count IS 'Count of HARD_STOP decisions';
COMMENT ON COLUMN audit_events_daily.high_uncertainty_count IS 'Count of high_uncertainty reason codes';
