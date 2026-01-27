/**
 * PHI redaction utilities for audit events
 *
 * Ensures no Protected Health Information (PHI) is stored in audit logs.
 * Only non-PHI metadata is preserved for audit trail purposes.
 *
 * @see docs/specs/02-popper-specs/01-popper-system-spec.md §7
 * @module audit/redaction
 */

import type { SupervisionRequest, SupervisionResponse } from '@regain/hermes';
import type { AuditEventPayload, AuditEventTag } from './types';

/**
 * Fields that should never be included in audit payloads
 */
const PHI_FIELDS = new Set([
  // Patient identifiers
  'patient_name',
  'name',
  'email',
  'phone',
  'address',
  'ssn',
  'mrn',
  'date_of_birth',
  'dob',

  // Clinical data
  'diagnosis',
  'medications',
  'lab_results',
  'vitals',
  'notes',
  'clinical_notes',

  // Snapshot data (contains PHI)
  'snapshot_payload',
  'snapshot_uri',
  'health_state',

  // Proposal content
  'content',
  'message_content',
  'recommendation_text',

  // Audit redaction summary (may contain PHI references)
  'summary',
  'proposal_summaries',
]);

/**
 * Check if a field name suggests PHI content
 */
function isPHIField(fieldName: string): boolean {
  const lowerName = fieldName.toLowerCase();
  return (
    PHI_FIELDS.has(lowerName) ||
    lowerName.includes('patient') ||
    lowerName.includes('name') ||
    lowerName.includes('address') ||
    lowerName.includes('phone') ||
    lowerName.includes('email') ||
    lowerName.includes('ssn') ||
    lowerName.includes('clinical') ||
    lowerName.includes('diagnosis') ||
    lowerName.includes('medication') ||
    lowerName.includes('health')
  );
}

/**
 * Recursively redact PHI from an object
 */
function redactObject(obj: Record<string, unknown>, depth = 0): Record<string, unknown> {
  if (depth > 5) {
    return { _redacted: 'max_depth_exceeded' };
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (isPHIField(key)) {
      result[key] = '[REDACTED]';
    } else if (value === null || value === undefined) {
      result[key] = value;
    } else if (Array.isArray(value)) {
      // For arrays, only keep non-PHI primitive values or redact objects
      result[key] = value.map((item) => {
        if (typeof item === 'object' && item !== null) {
          return redactObject(item as Record<string, unknown>, depth + 1);
        }
        return item;
      });
    } else if (typeof value === 'object') {
      result[key] = redactObject(value as Record<string, unknown>, depth + 1);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Extract non-PHI metadata from a supervision request for audit logging
 */
export function extractRequestMetadata(request: SupervisionRequest): AuditEventPayload {
  const payload: AuditEventPayload = {
    mode: request.mode,
    proposal_count: request.proposals?.length ?? 0,
    proposal_kinds: request.proposals?.map((p) => p.kind) ?? [],
  };

  // Include snapshot metadata (but not content)
  if (request.snapshot) {
    payload.staleness = {
      is_stale: false, // Will be set by staleness validator
      is_missing: false,
    };
  }

  // Include input risk flags if present (these are metadata, not PHI)
  if (request.input_risk?.flags) {
    payload.input_risk_flags = request.input_risk.flags;
  }

  return payload;
}

/**
 * Extract non-PHI metadata from a supervision response for audit logging
 */
export function extractResponseMetadata(response: SupervisionResponse): Partial<AuditEventPayload> {
  const payload: Partial<AuditEventPayload> = {};

  // Include control commands if present
  if (response.control_commands && response.control_commands.length > 0) {
    payload.control_commands = response.control_commands.map((cmd) => cmd.kind);
  }

  // Include safe mode state if present
  if (response.safe_mode_state) {
    payload.safe_mode = {
      active: response.safe_mode_state.enabled,
      effective_at: response.safe_mode_state.effective_at,
    };
  }

  return payload;
}

/**
 * Build tags based on the supervision context
 */
export function buildAuditTags(
  request: SupervisionRequest,
  _decision: string,
  isStale: boolean,
  _isMissing: boolean,
): AuditEventTag[] {
  const tags: AuditEventTag[] = [];

  // Risk level based on proposal types
  const highRiskKinds = ['MEDICATION_ORDER_PROPOSAL', 'TRIAGE_ROUTE', 'LAB_ORDER_PROPOSAL'];
  const hasHighRisk = request.proposals?.some((p) => highRiskKinds.includes(p.kind));

  if (hasHighRisk) {
    tags.push('high_risk');
  } else {
    tags.push('low_risk');
  }

  // Staleness tags
  if (isStale) {
    tags.push('stale_snapshot');
  }

  return tags;
}

/**
 * Redact any remaining PHI from a payload object
 */
export function redactPHI<T extends Record<string, unknown>>(payload: T): T {
  return redactObject(payload) as T;
}
