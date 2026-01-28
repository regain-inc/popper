CREATE TABLE "operational_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"created_by" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_settings_org_key_effective" ON "operational_settings" USING btree ("organization_id","key","effective_at");--> statement-breakpoint
CREATE INDEX "idx_settings_organization_id" ON "operational_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_settings_key" ON "operational_settings" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_settings_effective_at" ON "operational_settings" USING btree ("effective_at");
