/**
 * ControlCommandV2 Types
 *
 * Local v2 control command types. These mirror what will be in
 * @regain/hermes v2.0.0 but are defined locally since the installed
 * hermes version (v1.x) does not include them yet.
 *
 * @module control-v2/types
 */

/** Command priority levels */
export type CommandPriority = 'ROUTINE' | 'URGENT' | 'EMERGENCY';

/** Operational modes for mode transitions */
export type OperationalMode = 'NORMAL' | 'RESTRICTED' | 'SAFE_MODE' | 'MAINTENANCE';

/** Control command v2 kinds */
export type ControlCommandV2Kind =
  | 'SET_SAFE_MODE'
  | 'SET_OPERATIONAL_SETTINGS'
  | 'GET_OPERATIONAL_STATE'
  | 'SET_OPERATIONAL_MODE';

/** Typed setting value */
export type SettingValue = boolean | string | number | string[];

/** A single setting change within a batch */
export interface OperationalSettingChange {
  readonly key: string;
  readonly value: SettingValue;
  readonly previous_value?: SettingValue;
  readonly effective_until?: string;
  readonly reason?: string;
}

/** Safe mode configuration */
export interface SafeModeConfigV2 {
  readonly enabled: boolean;
  readonly reason: string;
  readonly effective_at?: string;
  readonly effective_until?: string;
}

/** Mode transition payload */
export interface ModeTransition {
  readonly target_mode: OperationalMode;
  readonly reason: string;
  readonly effective_at?: string;
}

/** Source of a control command */
export interface ControlCommandSource {
  readonly system: string;
  readonly service_version: string;
  readonly operator_id?: string;
}

/** Target of a control command */
export interface ControlCommandTarget {
  readonly system: string;
  readonly organization_id?: string;
  readonly instance_id?: string;
}

/** Audit redaction base */
export interface AuditRedactionBase {
  readonly summary?: string;
  readonly redact?: boolean;
}

/** ControlCommand v2 — typed, batched, priority-aware control message */
export interface ControlCommandV2 {
  readonly hermes_version: string;
  readonly message_type: 'control_command_v2';
  readonly command_id: string;
  readonly command_batch_id?: string;
  readonly created_at: string;
  readonly source: ControlCommandSource;
  readonly target: ControlCommandTarget;
  readonly kind: ControlCommandV2Kind;
  readonly priority: CommandPriority;
  readonly safe_mode?: SafeModeConfigV2;
  readonly settings?: readonly OperationalSettingChange[];
  readonly mode_transition?: ModeTransition;
  readonly idempotency_key: string;
  readonly audit_redaction: AuditRedactionBase;
}
