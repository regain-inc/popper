/**
 * TEFCA Compliance Metadata
 *
 * Assesses TEFCA readiness and builds interop payload references
 * for export bundles.
 *
 * Per spec: §6 of 02-popper-contracts-and-interfaces.md
 *
 * Note: Full TEFCA integration requires QHIN onboarding (Phase 2+).
 * This module provides metadata enrichment and readiness indicators.
 *
 * @module export/tefca
 */

import { createHash } from 'node:crypto';
import type { InteropPayloadRef } from './interop-types';
import type { ExportAuditEvent } from './types';

/** TEFCA exchange purpose categories */
export type TEFCAExchangePurpose = 'treatment' | 'payment' | 'operations' | 'public_health';

/** TEFCA compliance information for an export bundle */
export interface TEFCAComplianceInfo {
  framework_version: 'v1';
  exchange_purposes: TEFCAExchangePurpose[];
  document_format: 'popper_bundle_v1';
  ccda_convertible: boolean;
  qhin_ready: boolean;
  push_capable: boolean;
  pull_queryable: boolean;
}

/**
 * Assess TEFCA compliance readiness for an export bundle.
 *
 * In v1, bundles are always C-CDA convertible but not yet QHIN-ready
 * (requires Phase 2+ onboarding).
 *
 * Accepts counts directly to avoid allocating a full ExportBundle object.
 */
export function assessTEFCACompliance(counts: {
  eventCount: number;
  incidentCount: number;
}): TEFCAComplianceInfo {
  // Determine exchange purposes from bundle content
  const purposes: TEFCAExchangePurpose[] = ['treatment'];

  // If bundle contains incident summaries or audit events, it may serve operations
  if (counts.incidentCount > 0 || counts.eventCount > 0) {
    purposes.push('operations');
  }

  return {
    framework_version: 'v1',
    exchange_purposes: purposes,
    document_format: 'popper_bundle_v1',
    ccda_convertible: true, // v1 bundles are structured for C-CDA conversion
    qhin_ready: false, // Requires QHIN onboarding (Phase 2+)
    push_capable: true, // Bundle can be pushed to external systems
    pull_queryable: false, // Pull queries not yet supported
  };
}

/**
 * Build interop payload references from audit events.
 *
 * Each supervision-completed event generates a reference that can be
 * used for TEFCA exchange tracking.
 *
 * - interop_id is deterministic (SHA-256 of event_id + trace_id) for idempotency
 * - content_hash is computed in a single pass to reduce per-event crypto overhead
 */
export function buildInteropRefs(events: ExportAuditEvent[]): InteropPayloadRef[] {
  const supervisionEvents = events.filter(
    (e) => e.event_type === 'supervision.completed' || e.event_type === 'supervision_completed',
  );

  return supervisionEvents.map((event) => {
    // Deterministic interop_id: same event always produces same ID
    const interopId = createHash('sha256')
      .update(`interop:${event.event_id}:${event.trace_id}`)
      .digest('hex');

    // Content hash for integrity verification
    const contentHash = createHash('sha256')
      .update(`${event.event_id}|${event.trace_id}|${event.timestamp}|${event.decision ?? ''}`)
      .digest('hex');

    return {
      interop_id: interopId,
      standard: 'FHIR_R4' as const,
      content_type: 'application/fhir+json',
      message_type: 'Bundle',
      uri: `urn:popper:supervision:${event.trace_id}`,
      content_hash: contentHash,
      audit_redaction: {
        summary: `Supervision event ${event.event_id}: decision=${event.decision ?? 'N/A'}, reason_codes=${(event.reason_codes ?? []).join(',')}`,
      },
    };
  });
}
