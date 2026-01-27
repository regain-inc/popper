CREATE TABLE "audit_events" (
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" text NOT NULL,
	"trace_id" text NOT NULL,
	"event_type" text NOT NULL,
	"subject_id" text NOT NULL,
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
CREATE INDEX "audit_events_trace_id_idx" ON "audit_events" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX "audit_events_subject_id_idx" ON "audit_events" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "audit_events_event_type_idx" ON "audit_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "audit_events_decision_idx" ON "audit_events" USING btree ("decision");--> statement-breakpoint
CREATE INDEX "drift_baselines_signal_name_idx" ON "drift_baselines" USING btree ("signal_name");--> statement-breakpoint
CREATE INDEX "safe_mode_history_triggered_by_idx" ON "safe_mode_history" USING btree ("triggered_by");--> statement-breakpoint
CREATE INDEX "safe_mode_history_effective_at_idx" ON "safe_mode_history" USING btree ("effective_at");--> statement-breakpoint

-- =============================================================================
-- TimescaleDB Hypertables
-- =============================================================================

-- Convert audit_events to hypertable
SELECT create_hypertable('audit_events', 'created_at', chunk_time_interval => INTERVAL '1 day');--> statement-breakpoint

-- Convert drift_baselines to hypertable
SELECT create_hypertable('drift_baselines', 'calculated_at', chunk_time_interval => INTERVAL '1 week');--> statement-breakpoint

-- Convert safe_mode_history to hypertable
SELECT create_hypertable('safe_mode_history', 'created_at', chunk_time_interval => INTERVAL '1 week');--> statement-breakpoint

-- =============================================================================
-- Compression Policies (compress data older than 7 days)
-- =============================================================================

-- Include id in orderby since it's part of the composite PK
ALTER TABLE audit_events SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'organization_id',
  timescaledb.compress_orderby = 'created_at DESC, id'
);--> statement-breakpoint

-- Include signal_name in orderby since it's part of the composite PK
ALTER TABLE drift_baselines SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'organization_id',
  timescaledb.compress_orderby = 'calculated_at DESC, signal_name'
);--> statement-breakpoint

-- Include id in orderby since it's part of the composite PK
ALTER TABLE safe_mode_history SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'organization_id',
  timescaledb.compress_orderby = 'created_at DESC, id'
);--> statement-breakpoint

SELECT add_compression_policy('audit_events', INTERVAL '7 days');--> statement-breakpoint
SELECT add_compression_policy('drift_baselines', INTERVAL '30 days');--> statement-breakpoint
SELECT add_compression_policy('safe_mode_history', INTERVAL '30 days');--> statement-breakpoint

-- =============================================================================
-- Retention Policies
-- =============================================================================

SELECT add_retention_policy('audit_events', INTERVAL '7 years');--> statement-breakpoint
SELECT add_retention_policy('drift_baselines', INTERVAL '2 years');--> statement-breakpoint
SELECT add_retention_policy('safe_mode_history', INTERVAL '7 years');