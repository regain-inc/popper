-- Add TEFCA/USCDI compliance metadata column to export_bundles
-- Per spec: §6 of 02-popper-contracts-and-interfaces.md (POP-023B)
-- Stores USCDI v3 coverage report and TEFCA readiness metadata as JSONB

ALTER TABLE "export_bundles" ADD COLUMN IF NOT EXISTS "compliance" jsonb;
