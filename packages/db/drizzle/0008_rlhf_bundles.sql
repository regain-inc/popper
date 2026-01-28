-- RLHF Feedback Bundles table
-- Stores de-identified feedback bundles for RLHF loop closure
-- Per spec §5.9.6: Bundles MUST NOT contain PHI

CREATE TABLE IF NOT EXISTS "rlhf_bundles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"generated_at" timestamp with time zone NOT NULL,
	"triggered_by" text NOT NULL,
	"bundle_data" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS "rlhf_bundles_org_id_idx" ON "rlhf_bundles" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "rlhf_bundles_status_idx" ON "rlhf_bundles" USING btree ("status");
CREATE INDEX IF NOT EXISTS "rlhf_bundles_generated_at_idx" ON "rlhf_bundles" USING btree ("generated_at");
CREATE INDEX IF NOT EXISTS "rlhf_bundles_triggered_by_idx" ON "rlhf_bundles" USING btree ("triggered_by");
