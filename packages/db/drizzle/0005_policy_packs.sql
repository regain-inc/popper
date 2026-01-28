-- Policy Packs table for lifecycle management
-- Implements ARPA-H TA2 §2.F requirements

CREATE TABLE IF NOT EXISTS "policy_packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"policy_id" text NOT NULL,
	"version" text NOT NULL,
	"state" text DEFAULT 'DRAFT' NOT NULL,
	"content" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"reviewed_by" text,
	"validation_result" jsonb,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"activated_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"rejection_reason" text,
	"change_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Unique constraint: only one version per policy per organization
CREATE UNIQUE INDEX IF NOT EXISTS "policy_packs_org_policy_version_idx" ON "policy_packs" USING btree ("organization_id","policy_id","version");

-- Find active policy for organization
CREATE INDEX IF NOT EXISTS "policy_packs_org_state_idx" ON "policy_packs" USING btree ("organization_id","state");

-- Find by policy ID
CREATE INDEX IF NOT EXISTS "policy_packs_policy_id_idx" ON "policy_packs" USING btree ("policy_id");

-- Sort by activation date (for history)
CREATE INDEX IF NOT EXISTS "policy_packs_activated_at_idx" ON "policy_packs" USING btree ("activated_at");

-- Sort by creation date
CREATE INDEX IF NOT EXISTS "policy_packs_created_at_idx" ON "policy_packs" USING btree ("created_at");

-- Add constraint: only one ACTIVE policy pack per organization per policy_id
-- This is enforced at application level but we add a partial unique index for safety
CREATE UNIQUE INDEX IF NOT EXISTS "policy_packs_active_unique_idx"
ON "policy_packs" ("organization_id", "policy_id")
WHERE "state" = 'ACTIVE';
