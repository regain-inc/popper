/**
 * Deterministic Hallucination Detector
 *
 * Structural checks that require no LLM — pure computation from request data.
 * Only these deterministic signals may trigger the `hallucination_detected`
 * Safety DSL condition. Measurement-based detection is async and MUST NOT block.
 *
 * @see docs/specs/02-popper-specs/05-popper-measurement-protocols.md §3
 * @see SAL-1017
 * @module hallucination/detector
 */

import type { SupervisionRequest } from '../hermes';
import type {
  HallucinationDetectionResult,
  HallucinationSeverity,
  HallucinationSignal,
} from './types';
import { SEVERITY_PRECEDENCE } from './types';

// =============================================================================
// Public API
// =============================================================================

/**
 * Run all deterministic hallucination checks on a supervision request.
 *
 * Checks performed:
 * 1. Evidence ref structural validation (empty IDs, missing/empty citations)
 * 2. Duplicate evidence IDs within a proposal
 * 3. Temporal consistency (future created_at timestamps)
 * 4. Snapshot hash verification (if payload + hash both present)
 * 5. Upstream hallucination flag extraction (from Deutsch via request)
 */
export function detectHallucinations(request: SupervisionRequest): HallucinationDetectionResult {
  const signals: HallucinationSignal[] = [];

  // Run all deterministic checks
  checkEvidenceRefs(request, signals);
  checkTemporalConsistency(request, signals);
  checkSnapshotHash(request, signals);
  checkUpstreamFlag(request, signals);

  if (signals.length === 0) {
    return { detected: false, signals: [] };
  }

  // Find highest severity
  const severity = signals.reduce<HallucinationSeverity>((max, s) => {
    return SEVERITY_PRECEDENCE[s.severity] > SEVERITY_PRECEDENCE[max] ? s.severity : max;
  }, 'minor');

  return { detected: true, severity, signals };
}

// =============================================================================
// Deterministic Checks
// =============================================================================

/**
 * Check evidence refs for structural issues.
 * - Empty evidence_id → significant (fabricated reference)
 * - Missing/empty citation → minor (incomplete but not fabricated)
 * - Duplicate evidence_id within a proposal → significant (copy-paste hallucination)
 */
function checkEvidenceRefs(request: SupervisionRequest, signals: HallucinationSignal[]): void {
  const proposals = request.proposals ?? [];

  for (const proposal of proposals) {
    const evidenceRefs = proposal.evidence_refs ?? [];
    const seenIds = new Set<string>();

    for (const ref of evidenceRefs) {
      // Empty or missing evidence_id
      if (!ref.evidence_id || ref.evidence_id.trim() === '') {
        signals.push({
          type: 'empty_evidence_id',
          severity: 'significant',
          description: `Proposal ${proposal.proposal_id} has evidence ref with empty ID`,
          proposal_id: proposal.proposal_id,
        });
        continue;
      }

      // Duplicate evidence_id within same proposal
      if (seenIds.has(ref.evidence_id)) {
        signals.push({
          type: 'duplicate_evidence_id',
          severity: 'significant',
          description: `Proposal ${proposal.proposal_id} has duplicate evidence ref: ${ref.evidence_id}`,
          proposal_id: proposal.proposal_id,
        });
      }
      seenIds.add(ref.evidence_id);

      // Missing citation
      if (!ref.citation) {
        signals.push({
          type: 'missing_citation',
          severity: 'minor',
          description: `Evidence ref ${ref.evidence_id} in proposal ${proposal.proposal_id} has no citation`,
          proposal_id: proposal.proposal_id,
        });
      } else if (ref.citation.trim() === '') {
        signals.push({
          type: 'empty_citation',
          severity: 'minor',
          description: `Evidence ref ${ref.evidence_id} in proposal ${proposal.proposal_id} has empty citation`,
          proposal_id: proposal.proposal_id,
        });
      }
    }
  }
}

/**
 * Check temporal consistency.
 * - Proposal created_at in the future → significant (fabricated timestamp)
 * - Evidence publication_date in the future → minor (likely metadata error)
 */
function checkTemporalConsistency(
  request: SupervisionRequest,
  signals: HallucinationSignal[],
): void {
  const now = Date.now();
  // Allow 5 minutes of clock drift
  const futureThreshold = now + 5 * 60 * 1000;

  const proposals = request.proposals ?? [];

  for (const proposal of proposals) {
    // Check proposal created_at
    if (proposal.created_at) {
      const createdAt = new Date(proposal.created_at).getTime();
      if (!Number.isNaN(createdAt) && createdAt > futureThreshold) {
        signals.push({
          type: 'future_timestamp',
          severity: 'significant',
          description: `Proposal ${proposal.proposal_id} has future created_at timestamp`,
          proposal_id: proposal.proposal_id,
        });
      }
    }

    // Check evidence publication dates
    const evidenceRefs = proposal.evidence_refs ?? [];
    for (const ref of evidenceRefs) {
      if (ref.publication_date) {
        const pubDate = new Date(ref.publication_date).getTime();
        if (!Number.isNaN(pubDate) && pubDate > futureThreshold) {
          signals.push({
            type: 'future_timestamp',
            severity: 'minor',
            description: `Evidence ref ${ref.evidence_id ?? 'unknown'} has future publication_date`,
            proposal_id: proposal.proposal_id,
          });
        }
      }
    }
  }
}

/**
 * Check snapshot hash consistency.
 * If snapshot_payload is provided AND snapshot.snapshot_hash is set,
 * verify they match. A mismatch indicates the data was tampered with
 * or the snapshot is stale relative to the hash.
 */
function checkSnapshotHash(request: SupervisionRequest, signals: HallucinationSignal[]): void {
  const snapshot = request.snapshot as { snapshot_hash?: string } | undefined;
  const snapshotPayload = (request as Record<string, unknown>).snapshot_payload as
    | Record<string, unknown>
    | undefined;

  // Only check if both hash and payload are present
  if (!snapshot?.snapshot_hash || !snapshotPayload) {
    return;
  }

  // Compute hash of the payload and compare
  // Use a simple JSON-stable hash for now
  try {
    const payloadJson = JSON.stringify(snapshotPayload);
    const hasher = new Bun.CryptoHasher('sha256');
    hasher.update(payloadJson);
    const computedHash = hasher.digest('hex');

    if (computedHash !== snapshot.snapshot_hash) {
      signals.push({
        type: 'snapshot_hash_mismatch',
        severity: 'critical',
        description: 'Snapshot payload hash does not match declared snapshot_hash',
      });
    }
  } catch {
    // If hashing fails, don't block — this is a data integrity check
  }
}

/**
 * Extract upstream output validation signals from Deutsch.
 *
 * Hermes v2.1: Deutsch sends output_validation (replaces duck-typed hallucination_detection).
 * Falls back to legacy hallucination_detection for backward compatibility during migration.
 *
 * @see hermes/docs/00-hermes-specs/06-hermes-clinical-supervision-contract.md §5.5
 */
function checkUpstreamFlag(request: SupervisionRequest, signals: HallucinationSignal[]): void {
  // v2.1: Read from formal output_validation field
  const outputValidation = (request as Record<string, unknown>).output_validation as
    | {
        valid?: boolean;
        severity?: HallucinationSeverity;
        signals?: Array<{
          type: string;
          severity: HallucinationSeverity;
          description: string;
          proposal_id?: string;
        }>;
      }
    | undefined;

  if (outputValidation && !outputValidation.valid && outputValidation.signals) {
    for (const signal of outputValidation.signals) {
      signals.push({
        type: `upstream_${signal.type}`,
        severity: signal.severity ?? 'significant',
        description: signal.description,
        ...(signal.proposal_id && { proposal_id: signal.proposal_id }),
      });
    }
    return;
  }

  // Legacy fallback: read duck-typed hallucination_detection (pre-v2.1 Deutsch instances)
  const legacyFlag = (request as Record<string, unknown>).hallucination_detection as
    | { detected?: boolean; severity?: HallucinationSeverity; description?: string }
    | undefined;

  if (!legacyFlag?.detected) {
    return;
  }

  const severity = legacyFlag.severity ?? 'significant';
  signals.push({
    type: 'upstream_flag',
    severity,
    description: legacyFlag.description ?? 'Deutsch flagged potential hallucination',
  });
}
