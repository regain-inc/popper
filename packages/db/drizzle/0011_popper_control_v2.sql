-- Phase 4: Popper Control Plane v2

CREATE TABLE IF NOT EXISTS popper_desired_state (
  instance_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  desired_settings JSONB NOT NULL DEFAULT '{}',
  desired_mode TEXT NOT NULL DEFAULT 'NORMAL',
  last_actual_state JSONB,
  last_reconciliation_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (instance_id, organization_id)
);

CREATE INDEX IF NOT EXISTS desired_state_org_idx ON popper_desired_state (organization_id);

CREATE TABLE IF NOT EXISTS popper_desired_state_log (
  id TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  change_type TEXT NOT NULL,
  changes JSONB NOT NULL,
  triggered_by TEXT NOT NULL,
  command_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, created_at, id)
);

CREATE INDEX IF NOT EXISTS desired_state_log_instance_idx ON popper_desired_state_log (instance_id);
CREATE INDEX IF NOT EXISTS desired_state_log_command_idx ON popper_desired_state_log (command_id);

CREATE TABLE IF NOT EXISTS popper_control_dead_letters (
  id SERIAL PRIMARY KEY,
  command_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  target_instance_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  priority TEXT NOT NULL,
  command_payload JSONB NOT NULL,
  failure_reason TEXT NOT NULL,
  retry_count INTEGER NOT NULL,
  last_attempt_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dead_letters_command_id_idx ON popper_control_dead_letters (command_id);
CREATE INDEX IF NOT EXISTS dead_letters_target_idx ON popper_control_dead_letters (target_instance_id);
CREATE INDEX IF NOT EXISTS dead_letters_priority_idx ON popper_control_dead_letters (priority);
