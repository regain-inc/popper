-- Export Bundles table
-- Stores metadata for de-identified regulatory export bundles
-- Per spec: 02-popper-specs/04-popper-regulatory-export-and-triage.md

CREATE TABLE IF NOT EXISTS "export_bundles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"time_window_from" timestamp with time zone NOT NULL,
	"time_window_to" timestamp with time zone NOT NULL,
	"generated_at" timestamp with time zone NOT NULL,
	"triggered_by" text NOT NULL,
	"storage_uri" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"content_hash" text NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL,
	"incident_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS "export_bundles_org_id_idx" ON "export_bundles" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "export_bundles_status_idx" ON "export_bundles" USING btree ("status");
CREATE INDEX IF NOT EXISTS "export_bundles_generated_at_idx" ON "export_bundles" USING btree ("generated_at");
CREATE INDEX IF NOT EXISTS "export_bundles_expires_at_idx" ON "export_bundles" USING btree ("expires_at");
