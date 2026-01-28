-- Incidents table for drift-triggered safety incidents
-- Regular PostgreSQL table (not hypertable - low volume, need random access by ID)

CREATE TABLE IF NOT EXISTS "incidents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "type" text NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "trigger_signal" text,
  "trigger_level" text,
  "trigger_value" text,
  "threshold_value" text,
  "baseline_value" text,
  "title" text NOT NULL,
  "description" text,
  "metadata" jsonb,
  "safe_mode_enabled" timestamp with time zone,
  "resolved_at" timestamp with time zone,
  "resolved_by" uuid,
  "resolution_notes" text,
  "cooldown_until" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS "incidents_org_id_idx" ON "incidents" ("organization_id");
CREATE INDEX IF NOT EXISTS "incidents_status_idx" ON "incidents" ("status");
CREATE INDEX IF NOT EXISTS "incidents_type_idx" ON "incidents" ("type");
CREATE INDEX IF NOT EXISTS "incidents_created_at_idx" ON "incidents" ("created_at");
