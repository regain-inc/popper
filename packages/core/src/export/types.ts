/**
 * Export Bundle Types
 *
 * Types for de-identified regulatory export bundles.
 * Per spec: 02-popper-specs/04-popper-regulatory-export-and-triage.md
 *
 * @module export/types
 */

import type { InteropPayloadRef } from './interop-types';
import type { TEFCAComplianceInfo } from './tefca';
import type { USCDICoverageReport } from './uscdi';

/**
 * Bundle manifest - describes the export bundle contents
 */
export interface BundleManifest {
  /** Bundle format version */
  bundle_version: string;
  /** When the bundle was generated */
  generated_at: string;
  /** Generator information */
  generator: {
    /** System name */
    system: string;
    /** Service version */
    service_version: string;
    /** Ruleset/policy version */
    ruleset_version: string;
  };
  /** Scope of the export */
  scope: {
    /** Supervision mode */
    mode: 'wellness' | 'advocate_clinical';
    /** Organization ID (pseudonymous) */
    organization_id: string;
    /** Time window covered */
    time_window: {
      from: string;
      to: string;
    };
  };
  /** Trace IDs included in this bundle */
  trace_ids: string[];
  /** Files included in the bundle */
  files: {
    audit_events: string;
    supervision_receipts: string;
    incident_summaries?: string;
  };
  /** TEFCA/USCDI compliance metadata */
  compliance?: {
    uscdi_v3?: USCDICoverageReport;
    tefca?: TEFCAComplianceInfo;
    interop_refs?: InteropPayloadRef[];
  };
}

/**
 * De-identified audit event for export
 */
export interface ExportAuditEvent {
  /** Event ID */
  event_id: string;
  /** Event type */
  event_type: string;
  /** Timestamp */
  timestamp: string;
  /** Trace ID for correlation */
  trace_id: string;
  /** Pseudonymous organization ID */
  organization_id: string;
  /** Pseudonymous subject ID (hashed) */
  subject_id_hash?: string;
  /** Supervision decision if applicable */
  decision?: string;
  /** Reason codes */
  reason_codes?: string[];
  /** Mode */
  mode?: string;
  /** Validation result if applicable */
  validation_result?: {
    is_valid: boolean;
    issues?: string[];
  };
  /** Safe-mode state if applicable */
  safe_mode?: {
    enabled: boolean;
    reason?: string;
  };
  /** Additional metadata (PHI-free) */
  metadata?: Record<string, unknown>;
}

/**
 * Supervision receipt for export (PHI-minimized)
 */
export interface ExportSupervisionReceipt {
  /** Trace ID */
  trace_id: string;
  /** Timestamp */
  timestamp: string;
  /** Request audit redaction summary */
  request_redaction?: {
    redacted_fields: string[];
    summary?: string;
  };
  /** Response audit redaction summary */
  response_redaction?: {
    redacted_fields: string[];
    summary?: string;
  };
  /** Producer info */
  producer: {
    service: string;
    service_version: string;
    ruleset_version: string;
  };
  /** Snapshot reference (no PHI) */
  snapshot_ref?: {
    snapshot_id: string;
    snapshot_hash?: string;
    /** Only included if recipient has access */
    snapshot_uri?: string;
  };
  /** Decision made */
  decision: string;
  /** Reason codes */
  reason_codes: string[];
}

/**
 * Incident summary for export (de-identified)
 */
export interface ExportIncidentSummary {
  /** Incident ID */
  incident_id: string;
  /** When the incident was created */
  created_at: string;
  /** Severity level */
  severity: 'info' | 'warning' | 'critical';
  /** What triggered the incident */
  trigger: string;
  /** Safe-mode state changes */
  safe_mode_changes?: Array<{
    timestamp: string;
    enabled: boolean;
    reason?: string;
  }>;
  /** PHI-minimized summary */
  summary: string;
  /** Related trace IDs */
  related_trace_ids: string[];
  /** Resolution status */
  resolution?: {
    status: 'resolved' | 'false_positive' | 'requires_follow_up' | 'pending';
    resolved_at?: string;
    resolved_by?: string;
    notes?: string;
  };
}

/**
 * Complete export bundle (in-memory representation)
 */
export interface ExportBundle {
  /** Unique bundle ID */
  bundle_id: string;
  /** Bundle manifest */
  manifest: BundleManifest;
  /** De-identified audit events */
  audit_events: ExportAuditEvent[];
  /** Supervision receipts */
  supervision_receipts: ExportSupervisionReceipt[];
  /** Incident summaries (if any) */
  incident_summaries: ExportIncidentSummary[];
}

/**
 * Request to generate an export bundle
 */
export interface GenerateExportRequest {
  /** Organization ID */
  organization_id: string;
  /** Time window start */
  from: Date;
  /** Time window end */
  to: Date;
  /** Supervision mode filter */
  mode?: 'wellness' | 'advocate_clinical';
  /** Specific trace IDs to include (optional) */
  trace_ids?: string[];
  /** Include snapshot URIs (only if recipient has access) */
  include_snapshot_uris?: boolean;
  /** Triggered by */
  triggered_by: 'manual' | 'incident' | 'scheduled';
  /** Notes */
  notes?: string;
}

/**
 * Stored export bundle record
 */
export interface StoredExportBundle {
  /** Bundle ID */
  id: string;
  /** Organization ID */
  organization_id: string;
  /** Time window */
  time_window: {
    from: Date;
    to: Date;
  };
  /** When generated */
  generated_at: Date;
  /** Triggered by */
  triggered_by: string;
  /** Storage location */
  storage_uri: string;
  /** File size in bytes */
  size_bytes: number;
  /** SHA-256 hash of the bundle */
  content_hash: string;
  /** Number of events included */
  event_count: number;
  /** Number of incidents included */
  incident_count: number;
  /** Status */
  status: 'pending' | 'ready' | 'downloaded' | 'expired';
  /** Expiration time */
  expires_at?: Date;
  /** TEFCA/USCDI compliance summary (interop_refs omitted — stored in serialized bundle) */
  compliance?: Omit<NonNullable<BundleManifest['compliance']>, 'interop_refs'>;
  /** Created at */
  created_at: Date;
  /** Updated at */
  updated_at: Date;
}

/**
 * Interface for export bundle storage
 */
export interface IExportBundleStorage {
  /** Upload bundle and return storage URI */
  upload(bundleId: string, data: Buffer, contentType: string): Promise<string>;
  /** Download bundle by URI */
  download(storageUri: string): Promise<Buffer>;
  /** Delete bundle by URI */
  delete(storageUri: string): Promise<void>;
  /** Get presigned download URL (optional) */
  getDownloadUrl?(storageUri: string, expiresIn: number): Promise<string>;
}

/**
 * Pagination options for listing bundles
 */
export interface BundleListOptions {
  /** Maximum number of bundles to return (default: 10, max: 100) */
  limit?: number;
  /** Cursor for pagination (bundle ID to start after) */
  cursor?: string;
}

/**
 * Paginated list result
 */
export interface BundleListResult {
  /** Bundles in this page */
  bundles: StoredExportBundle[];
  /** Cursor for next page (null if no more pages) */
  next_cursor: string | null;
  /** Whether there are more pages */
  has_more: boolean;
}

/**
 * Interface for export bundle metadata store
 */
export interface IExportBundleStore {
  /** Save bundle metadata */
  save(bundle: StoredExportBundle): Promise<StoredExportBundle>;
  /** Get bundle by ID */
  getById(id: string): Promise<StoredExportBundle | null>;
  /** List bundles for organization with cursor-based pagination */
  list(organizationId: string, options?: BundleListOptions): Promise<BundleListResult>;
  /** Update bundle status */
  updateStatus(
    id: string,
    status: StoredExportBundle['status'],
  ): Promise<StoredExportBundle | null>;
  /** Mark bundle as downloaded */
  markDownloaded(id: string): Promise<StoredExportBundle | null>;
}

/**
 * Configuration for export bundle generator
 */
export interface ExportBundleConfig {
  /** Service version */
  serviceVersion: string;
  /** Default ruleset version */
  defaultRulesetVersion: string;
  /** Bundle expiration in days */
  bundleExpirationDays: number;
  /** Maximum events per bundle */
  maxEventsPerBundle: number;
  /** Enable gzip compression */
  enableCompression: boolean;
  /** Enable USCDI v3 coverage validation (default: true) */
  enableUSCDIValidation: boolean;
  /** Enable TEFCA metadata enrichment (default: true) */
  enableTEFCAMetadata: boolean;
}

/**
 * Default export bundle configuration
 */
export const DEFAULT_EXPORT_CONFIG: ExportBundleConfig = {
  serviceVersion: '1.0.0',
  defaultRulesetVersion: 'popper-safety-1.0.0',
  bundleExpirationDays: 30,
  maxEventsPerBundle: 100000,
  enableCompression: true,
  enableUSCDIValidation: true,
  enableTEFCAMetadata: true,
};
