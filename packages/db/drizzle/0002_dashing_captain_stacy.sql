CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"allowed_modes" jsonb DEFAULT '["wellness"]'::jsonb NOT NULL,
	"rate_limit_per_minute" integer DEFAULT 1000 NOT NULL,
	"rate_limit_per_hour" integer DEFAULT 50000 NOT NULL,
	"default_policy_pack" text DEFAULT 'popper-default' NOT NULL,
	"staleness_wellness_hours" integer,
	"staleness_clinical_hours" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE INDEX "organizations_is_active_idx" ON "organizations" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "organizations_created_at_idx" ON "organizations" USING btree ("created_at");