/**
 * ControlCommandV2 Builder
 *
 * Converts ReconfigureEffect (from policy evaluation or reconfigure policies)
 * into ControlCommandV2 messages for transmission to Deutsch instances.
 *
 * @module control-v2/builder
 */

import { getDefaultEmitter } from '../audit/emitter';
import type { AuditEventTag } from '../audit/types';
import type { ReconfigureEffect } from '../policy-engine/types';
import type {
  CommandPriority,
  ControlCommandV2,
  ControlCommandV2Kind,
  OperationalMode,
  OperationalSettingChange,
} from './types';

const HERMES_VERSION = '2.0.0';
const POPPER_SYSTEM = 'popper';
const DEUTSCH_SYSTEM = 'deutsch';

export interface BuildCommandOptions {
  /** Organization ID for the target instance */
  organizationId: string;
  /** Instance ID of the target Deutsch instance */
  instanceId: string;
  /** Service version of this Popper instance */
  serviceVersion: string;
  /** Operator ID (policy_id, user, etc.) */
  operatorId?: string;
  /** Optional batch ID to group related commands */
  batchId?: string;
  /** Trace ID for audit correlation */
  traceId?: string;
  /** Policy ID that triggered this command */
  policyId?: string;
}

/**
 * Build a ControlCommandV2 from a ReconfigureEffect.
 *
 * Determines the command kind from the effect contents:
 * - If mode_transition present → SET_OPERATIONAL_MODE
 * - If settings present → SET_OPERATIONAL_SETTINGS
 * - Both → SET_OPERATIONAL_MODE (settings included as side-effect)
 */
export function buildControlCommandV2(
  effect: ReconfigureEffect,
  options: BuildCommandOptions,
): ControlCommandV2 {
  const commandId = crypto.randomUUID();
  const now = new Date().toISOString();
  const priority: CommandPriority = (effect.priority as CommandPriority) ?? 'ROUTINE';

  const kind: ControlCommandV2Kind = effect.mode_transition
    ? 'SET_OPERATIONAL_MODE'
    : 'SET_OPERATIONAL_SETTINGS';

  const settings: OperationalSettingChange[] | undefined = effect.settings?.map((s) => ({
    key: s.key,
    value: s.value as string | number | boolean | string[],
    reason: s.reason,
    effective_until:
      effect.auto_revert && effect.revert_after_minutes
        ? new Date(Date.now() + effect.revert_after_minutes * 60 * 1000).toISOString()
        : undefined,
  }));

  const command: ControlCommandV2 = {
    hermes_version: HERMES_VERSION,
    message_type: 'control_command_v2',
    command_id: commandId,
    command_batch_id: options.batchId,
    created_at: now,
    source: {
      system: POPPER_SYSTEM,
      service_version: options.serviceVersion,
      operator_id: options.operatorId,
    },
    target: {
      system: DEUTSCH_SYSTEM,
      organization_id: options.organizationId,
      instance_id: options.instanceId,
    },
    kind,
    priority,
    settings: settings && settings.length > 0 ? settings : undefined,
    mode_transition: effect.mode_transition
      ? {
          target_mode: effect.mode_transition.target_mode as OperationalMode,
          reason: effect.mode_transition.reason,
        }
      : undefined,
    idempotency_key: commandId,
    audit_redaction: {
      redact: false,
    },
  };

  // Emit audit event
  const tags: AuditEventTag[] = ['control_v2'];
  if (effect.auto_revert) tags.push('auto_revert');
  if (!options.operatorId) tags.push('ta1_self_transition');
  emitCommandAudit(command, options, tags);

  return command;
}

/**
 * Build a GET_OPERATIONAL_STATE command for reconciliation polling.
 */
export function buildGetStateCommand(options: BuildCommandOptions): ControlCommandV2 {
  const commandId = crypto.randomUUID();

  const command: ControlCommandV2 = {
    hermes_version: HERMES_VERSION,
    message_type: 'control_command_v2',
    command_id: commandId,
    created_at: new Date().toISOString(),
    source: {
      system: POPPER_SYSTEM,
      service_version: options.serviceVersion,
      operator_id: options.operatorId,
    },
    target: {
      system: DEUTSCH_SYSTEM,
      organization_id: options.organizationId,
      instance_id: options.instanceId,
    },
    kind: 'GET_OPERATIONAL_STATE',
    priority: 'ROUTINE',
    idempotency_key: commandId,
    audit_redaction: {
      redact: false,
    },
  };

  emitCommandAudit(command, options, ['control_v2', 'reconciliation']);

  return command;
}

/**
 * Build a SET_SAFE_MODE command.
 */
export function buildSafeModeCommand(
  enabled: boolean,
  reason: string,
  options: BuildCommandOptions & { effectiveUntil?: string },
): ControlCommandV2 {
  const commandId = crypto.randomUUID();

  const command: ControlCommandV2 = {
    hermes_version: HERMES_VERSION,
    message_type: 'control_command_v2',
    command_id: commandId,
    created_at: new Date().toISOString(),
    source: {
      system: POPPER_SYSTEM,
      service_version: options.serviceVersion,
      operator_id: options.operatorId,
    },
    target: {
      system: DEUTSCH_SYSTEM,
      organization_id: options.organizationId,
      instance_id: options.instanceId,
    },
    kind: 'SET_SAFE_MODE',
    priority: 'EMERGENCY',
    safe_mode: {
      enabled,
      reason,
      effective_until: options.effectiveUntil,
    },
    idempotency_key: commandId,
    audit_redaction: {
      redact: false,
    },
  };

  emitCommandAudit(command, options, ['control_v2']);

  return command;
}

/**
 * Emit CONTROL_COMMAND_ISSUED audit event.
 */
function emitCommandAudit(
  command: ControlCommandV2,
  options: BuildCommandOptions,
  tags: AuditEventTag[],
): void {
  const emitter = getDefaultEmitter();
  emitter
    .emit({
      eventType: 'CONTROL_COMMAND_ISSUED',
      traceId: options.traceId ?? command.command_id,
      subjectId: 'system',
      organizationId: options.organizationId,
      policyPackVersion: 'N/A',
      payload: {
        command_id: command.command_id,
        command_kind: command.kind,
        command_priority: command.priority,
        target_instance_id: options.instanceId,
        policy_id: options.policyId,
      },
      tags,
    })
    .catch((err) => {
      console.error('[control-v2] Failed to emit audit event:', err);
    });
}
