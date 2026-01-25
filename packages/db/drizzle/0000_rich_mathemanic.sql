-- =============================================================================
-- Popper Database Schema
-- TimescaleDB hypertables for audit events, drift monitoring, and safe mode
-- =============================================================================

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- =============================================================================
-- AUDIT EVENTS TABLE
-- High write volume: chunk_interval = 1 day
-- segment_by: organization_id (common filter, >100 rows per chunk expected)
-- order_by: created_at DESC (natural time-series progression)
-- =============================================================================

CREATE TABLE "audit_events" (
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"trace_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"decision" text,
	"reason_codes" jsonb DEFAULT '[]'::jsonb,
	"policy_pack_version" text NOT NULL,
	"safe_mode_active" boolean DEFAULT false NOT NULL,
	"latency_ms" double precision,
	"proposal_count" double precision,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	CONSTRAINT "audit_events_organization_id_created_at_id_pk" PRIMARY KEY("organization_id","created_at","id")
);

--> statement-breakpoint

SELECT create_hypertable('audit_events', 'created_at', chunk_time_interval => INTERVAL '1 day');

--> statement-breakpoint

ALTER TABLE audit_events SET (
	timescaledb.compress,
	timescaledb.compress_segmentby = 'organization_id',
	timescaledb.compress_orderby = 'created_at DESC'
);

--> statement-breakpoint

-- =============================================================================
-- DRIFT BASELINES TABLE
-- Lower volume: chunk_interval = 1 week
-- segment_by: organization_id
-- order_by: signal_name, calculated_at DESC (group similar signals)
-- =============================================================================

CREATE TABLE "drift_baselines" (
	"organization_id" uuid NOT NULL,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"signal_name" text NOT NULL,
	"baseline_value" double precision NOT NULL,
	"warning_threshold" double precision NOT NULL,
	"critical_threshold" double precision NOT NULL,
	"sample_count" double precision NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "drift_baselines_organization_id_calculated_at_signal_name_pk" PRIMARY KEY("organization_id","calculated_at","signal_name")
);

--> statement-breakpoint

SELECT create_hypertable('drift_baselines', 'calculated_at', chunk_time_interval => INTERVAL '1 week');

--> statement-breakpoint

ALTER TABLE drift_baselines SET (
	timescaledb.compress,
	timescaledb.compress_segmentby = 'organization_id',
	timescaledb.compress_orderby = 'signal_name, calculated_at DESC'
);

--> statement-breakpoint

-- =============================================================================
-- SAFE MODE HISTORY TABLE
-- Lower volume: chunk_interval = 1 week
-- segment_by: organization_id
-- order_by: created_at DESC
-- =============================================================================

CREATE TABLE "safe_mode_history" (
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"enabled" boolean NOT NULL,
	"reason" text NOT NULL,
	"triggered_by" text NOT NULL,
	"actor_id" uuid,
	"incident_id" uuid,
	"effective_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "safe_mode_history_organization_id_created_at_id_pk" PRIMARY KEY("organization_id","created_at","id")
);

--> statement-breakpoint

SELECT create_hypertable('safe_mode_history', 'created_at', chunk_time_interval => INTERVAL '1 week');

--> statement-breakpoint

ALTER TABLE safe_mode_history SET (
	timescaledb.compress,
	timescaledb.compress_segmentby = 'organization_id',
	timescaledb.compress_orderby = 'created_at DESC'
);

--> statement-breakpoint

-- =============================================================================
-- INDEXES FOR COMMON QUERY PATTERNS
-- =============================================================================

CREATE INDEX "audit_events_trace_id_idx" ON "audit_events" USING btree ("trace_id");
--> statement-breakpoint
CREATE INDEX "audit_events_subject_id_idx" ON "audit_events" USING btree ("subject_id");
--> statement-breakpoint
CREATE INDEX "audit_events_event_type_idx" ON "audit_events" USING btree ("event_type");
--> statement-breakpoint
CREATE INDEX "audit_events_decision_idx" ON "audit_events" USING btree ("decision");
--> statement-breakpoint
CREATE INDEX "drift_baselines_signal_name_idx" ON "drift_baselines" USING btree ("signal_name");
--> statement-breakpoint
CREATE INDEX "safe_mode_history_triggered_by_idx" ON "safe_mode_history" USING btree ("triggered_by");
--> statement-breakpoint
CREATE INDEX "safe_mode_history_effective_at_idx" ON "safe_mode_history" USING btree ("effective_at");

--> statement-breakpoint

-- =============================================================================
-- COMPRESSION POLICIES
-- Compress after 7 days when data becomes mostly immutable
-- =============================================================================

SELECT add_compression_policy('audit_events', INTERVAL '7 days');
--> statement-breakpoint
SELECT add_compression_policy('drift_baselines', INTERVAL '7 days');
--> statement-breakpoint
SELECT add_compression_policy('safe_mode_history', INTERVAL '7 days');

--> statement-breakpoint

-- =============================================================================
-- RETENTION POLICIES
-- 7 years for regulatory compliance
-- =============================================================================

SELECT add_retention_policy('audit_events', INTERVAL '7 years');
--> statement-breakpoint
SELECT add_retention_policy('drift_baselines', INTERVAL '7 years');
--> statement-breakpoint
SELECT add_retention_policy('safe_mode_history', INTERVAL '7 years');

--> statement-breakpoint

-- =============================================================================
-- CONTINUOUS AGGREGATES: HOURLY
-- For real-time dashboards and drift monitoring
-- Refresh: every 15 minutes, 15 minute lag
-- =============================================================================

CREATE MATERIALIZED VIEW audit_events_hourly
WITH (timescaledb.continuous) AS
SELECT
	time_bucket(INTERVAL '1 hour', created_at) AS bucket,
	organization_id,
	event_type,
	decision,
	COUNT(*) AS event_count,
	COUNT(*) FILTER (WHERE decision = 'HARD_STOP') AS hard_stop_count,
	COUNT(*) FILTER (WHERE decision = 'ROUTE_TO_CLINICIAN') AS route_count,
	COUNT(*) FILTER (WHERE event_type = 'VALIDATION_FAILED') AS validation_failed_count,
	AVG(latency_ms) AS avg_latency_ms,
	MAX(latency_ms) AS max_latency_ms
FROM audit_events
GROUP BY bucket, organization_id, event_type, decision
WITH NO DATA;

--> statement-breakpoint

SELECT add_continuous_aggregate_policy('audit_events_hourly',
	start_offset => INTERVAL '7 years',
	end_offset => INTERVAL '15 minutes',
	schedule_interval => INTERVAL '15 minutes'
);

--> statement-breakpoint

-- =============================================================================
-- CONTINUOUS AGGREGATES: DAILY
-- For baseline calculation and long-term reporting
-- Refresh: every hour, 1 hour lag
-- =============================================================================

CREATE MATERIALIZED VIEW audit_events_daily
WITH (timescaledb.continuous) AS
SELECT
	time_bucket(INTERVAL '1 day', created_at) AS bucket,
	organization_id,
	COUNT(*) AS total_events,
	COUNT(*) FILTER (WHERE decision = 'APPROVED') AS approved_count,
	COUNT(*) FILTER (WHERE decision = 'HARD_STOP') AS hard_stop_count,
	COUNT(*) FILTER (WHERE decision = 'ROUTE_TO_CLINICIAN') AS route_count,
	COUNT(*) FILTER (WHERE decision = 'REQUEST_MORE_INFO') AS request_info_count,
	COUNT(*) FILTER (WHERE event_type = 'VALIDATION_FAILED') AS validation_failed_count,
	COUNT(*) FILTER (WHERE safe_mode_active = true) AS safe_mode_events,
	AVG(latency_ms) AS avg_latency_ms,
	PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms
FROM audit_events
GROUP BY bucket, organization_id
WITH NO DATA;

--> statement-breakpoint

SELECT add_continuous_aggregate_policy('audit_events_daily',
	start_offset => INTERVAL '7 years',
	end_offset => INTERVAL '1 hour',
	schedule_interval => INTERVAL '1 hour'
);

--> statement-breakpoint

-- =============================================================================
-- COMPRESS CONTINUOUS AGGREGATES
-- segment_by = ALL GROUP BY columns except time_bucket
-- order_by = bucket DESC
-- =============================================================================

ALTER MATERIALIZED VIEW audit_events_hourly SET (
	timescaledb.compress,
	timescaledb.compress_segmentby = 'organization_id, event_type, decision',
	timescaledb.compress_orderby = 'bucket DESC'
);
--> statement-breakpoint
SELECT add_compression_policy('audit_events_hourly', INTERVAL '3 days');

--> statement-breakpoint

ALTER MATERIALIZED VIEW audit_events_daily SET (
	timescaledb.compress,
	timescaledb.compress_segmentby = 'organization_id',
	timescaledb.compress_orderby = 'bucket DESC'
);
--> statement-breakpoint
SELECT add_compression_policy('audit_events_daily', INTERVAL '7 days');

--> statement-breakpoint

-- =============================================================================
-- RETENTION FOR AGGREGATES
-- Keep aggregates longer than raw data
-- =============================================================================

SELECT add_retention_policy('audit_events_hourly', INTERVAL '2 years');
--> statement-breakpoint
SELECT add_retention_policy('audit_events_daily', INTERVAL '10 years');

--> statement-breakpoint

-- =============================================================================
-- PERFORMANCE INDEXES ON CONTINUOUS AGGREGATES
-- Pattern: (filter_column, bucket DESC)
-- =============================================================================

CREATE INDEX idx_hourly_org_bucket ON audit_events_hourly (organization_id, bucket DESC);
--> statement-breakpoint
CREATE INDEX idx_daily_org_bucket ON audit_events_daily (organization_id, bucket DESC);
