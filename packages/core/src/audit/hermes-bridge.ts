/**
 * Bridge between Popper's audit event types and Hermes AuditEvent.
 *
 * Popper uses a richer, domain-specific audit type system internally.
 * This module provides a one-way mapping to the Hermes canonical
 * AuditEvent envelope for cross-system observability.
 *
 * @see docs/specs/00-popper-specs/12-audit-event-hermes-mapping.md
 * @module audit/hermes-bridge
 */

import {
  type AuditEvent,
  CURRENT_HERMES_VERSION,
  type AuditEventType as HermesAuditEventType,
  type IsoDateTime,
  type Mode,
} from '@regain/hermes';
import type { AuditEventInput, AuditEventType as PopperAuditEventType } from './types';

/**
 * Popper event types that map directly to a Hermes AuditEventType.
 */
const DIRECT_TYPE_MAP: Partial<Record<PopperAuditEventType, HermesAuditEventType>> = {
  SUPERVISION_DECISION: 'SUPERVISION_RESPONSE_DECIDED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  CONTROL_COMMAND: 'CONTROL_COMMAND_ISSUED',
  CONTROL_COMMAND_ISSUED: 'CONTROL_COMMAND_ISSUED',
  OTHER: 'OTHER',
};

/**
 * Popper event types that have no Hermes equivalent and map to OTHER.
 */
const POPPER_ONLY_TYPES: ReadonlySet<PopperAuditEventType> = new Set([
  'CONTROL_COMMAND_TIMEOUT',
  'CONTROL_STATE_DIVERGENCE',
  'CONTROL_RECONCILIATION_FAILED',
  'POLICY_LIFECYCLE',
  'EXPORT_GENERATED',
  'EXPORT_DOWNLOADED',
  'EXPORT_ACCESSED',
]);

/**
 * Resolve the Hermes event type for a SAFE_MODE_CHANGED event.
 * Uses the payload's safe_mode.active flag to disambiguate.
 * When neither payload nor safeModeActive provides the state,
 * maps to OTHER with a diagnostic indicator rather than guessing.
 */
function resolveSafeModeType(event: AuditEventInput): {
  type: HermesAuditEventType;
  degraded: boolean;
} {
  const fromPayload = event.payload?.safe_mode?.active;
  const fromField = event.safeModeActive;

  if (fromPayload !== undefined && fromPayload !== null) {
    return { type: fromPayload ? 'SAFE_MODE_ENABLED' : 'SAFE_MODE_DISABLED', degraded: false };
  }
  if (fromField !== undefined && fromField !== null) {
    return { type: fromField ? 'SAFE_MODE_ENABLED' : 'SAFE_MODE_DISABLED', degraded: false };
  }

  // Critical data missing — cannot determine safe mode state.
  // Map to OTHER rather than guessing enabled/disabled.
  return { type: 'OTHER', degraded: true };
}

/**
 * Map a Popper AuditEventType to the corresponding Hermes AuditEventType.
 * Returns a tuple of [hermesType, otherEventType?].
 */
function mapEventType(event: AuditEventInput): [HermesAuditEventType, string | undefined, boolean] {
  if (event.eventType === 'SAFE_MODE_CHANGED') {
    const resolved = resolveSafeModeType(event);
    const otherType = resolved.degraded ? 'SAFE_MODE_CHANGED' : undefined;
    return [resolved.type, otherType, resolved.degraded];
  }

  const direct = DIRECT_TYPE_MAP[event.eventType];
  if (direct) {
    // For Popper's OTHER, preserve any custom other_event_type from payload
    const otherType =
      direct === 'OTHER'
        ? ((event.payload?.other_event_type as string | undefined) ?? undefined)
        : undefined;
    return [direct, otherType, false];
  }

  if (POPPER_ONLY_TYPES.has(event.eventType)) {
    return ['OTHER', event.eventType, false];
  }

  // Unknown type -- fall through to OTHER
  return ['OTHER', event.eventType, false];
}

/**
 * Build a PHI-free summary string from the Popper event.
 */
function buildSummary(event: AuditEventInput, hermesType: HermesAuditEventType): string {
  const parts: string[] = [`[${hermesType}]`];

  if (event.decision) {
    parts.push(`decision=${event.decision}`);
  }

  if (event.reasonCodes && event.reasonCodes.length > 0) {
    parts.push(`reasons=${event.reasonCodes.join(',')}`);
  }

  if (event.proposalCount !== undefined) {
    parts.push(`proposals=${event.proposalCount}`);
  }

  if (event.payload?.error) {
    parts.push(`error=${event.payload.error.code ?? 'unknown'}`);
  }

  return parts.join(' ');
}

/**
 * Convert Popper's tag array to Hermes' Record<string, string> format.
 * Also preserves Popper-specific fields that have no Hermes envelope field.
 */
function buildTags(
  event: AuditEventInput,
  mappingDegraded = false,
  modeDefaulted = false,
): Readonly<Record<string, string>> | undefined {
  const tags: Record<string, string> = {};

  // Convert Popper tag array
  if (event.tags) {
    for (const tag of event.tags) {
      tags[tag] = 'true';
    }
  }

  // Preserve Popper-specific fields in tags
  if (event.decision) {
    tags.decision = event.decision;
  }
  if (event.reasonCodes && event.reasonCodes.length > 0) {
    tags.reason_codes = event.reasonCodes.join(',');
  }
  if (event.latencyMs !== undefined) {
    tags.latency_ms = String(event.latencyMs);
  }
  if (event.proposalCount !== undefined) {
    tags.proposal_count = String(event.proposalCount);
  }
  if (event.safeModeActive !== undefined) {
    tags.safe_mode_active = String(event.safeModeActive);
  }
  if (event.ruleProvenance) {
    tags.rule_id = event.ruleProvenance.rule_id;
    tags.source_type = event.ruleProvenance.source_type;
    tags.citation = event.ruleProvenance.citation;
  }

  // Diagnostic tags when the bridge had to default critical values
  if (mappingDegraded) {
    tags['mapping_confidence'] = 'degraded';
    tags['mapping_degraded'] = 'missing_safe_mode_state';
  }
  if (modeDefaulted) {
    tags['mapping_confidence'] = 'degraded';
    tags['mode_defaulted'] = 'true';
  }

  return Object.keys(tags).length > 0 ? tags : undefined;
}

/**
 * Convert a Popper AuditEventInput to a Hermes AuditEvent.
 *
 * This is the canonical bridge function. It maps Popper's richer domain-specific
 * audit types to the Hermes cross-system observability envelope.
 *
 * @param event - Popper audit event input
 * @param serviceVersion - Popper service version string (e.g. '2.1.0')
 * @returns Hermes AuditEvent
 *
 * @example
 * ```ts
 * const popperEvent = createSupervisionDecisionEvent({ ... });
 * const hermesEvent = toHermesAuditEvent(popperEvent, '2.1.0');
 * ```
 */
export function toHermesAuditEvent(event: AuditEventInput, serviceVersion = '0.1.0'): AuditEvent {
  const [eventType, otherEventType, mappingDegraded] = mapEventType(event);
  const now = new Date().toISOString() as IsoDateTime;
  const hasExplicitMode = event.payload?.mode !== undefined && event.payload?.mode !== null;
  const mode: Mode = (event.payload?.mode as Mode) ?? 'wellness';
  const tags = buildTags(event, mappingDegraded, !hasExplicitMode);

  const base = {
    hermes_version: CURRENT_HERMES_VERSION,
    message_type: 'audit_event' as const,
    event_type: eventType,
    occurred_at: now,
    trace: {
      trace_id: event.traceId,
      created_at: now,
      producer: {
        system: 'popper' as const,
        service_version: serviceVersion,
        ruleset_version: event.policyPackVersion,
      },
    },
    mode,
    subject: {
      subject_type: 'patient' as const,
      subject_id: event.subjectId,
      organization_id: event.organizationId,
    },
    summary: buildSummary(event, eventType),
  };

  // Build the event, conditionally adding optional fields to satisfy exactOptionalPropertyTypes
  if (otherEventType && tags) {
    return { ...base, other_event_type: otherEventType, tags } as AuditEvent;
  }
  if (otherEventType) {
    return { ...base, other_event_type: otherEventType } as AuditEvent;
  }
  if (tags) {
    return { ...base, tags } as AuditEvent;
  }
  return base as AuditEvent;
}

/**
 * Map event type only (useful for filtering/routing without full conversion).
 */
export function mapPopperEventTypeToHermes(
  eventType: PopperAuditEventType,
  safeModeActive?: boolean,
): HermesAuditEventType {
  if (eventType === 'SAFE_MODE_CHANGED') {
    return safeModeActive ? 'SAFE_MODE_ENABLED' : 'SAFE_MODE_DISABLED';
  }
  return DIRECT_TYPE_MAP[eventType] ?? 'OTHER';
}
