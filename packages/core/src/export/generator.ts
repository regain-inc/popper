/**
 * Export Bundle Generator
 *
 * Generates de-identified export bundles for regulatory compliance.
 * Per spec: 02-popper-specs/04-popper-regulatory-export-and-triage.md
 *
 * @module export/generator
 */

import { createHash, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { gzip as gzipCallback } from 'node:zlib';

const gzip = promisify(gzipCallback);

import {
  createRedactionSummary,
  hashForPseudonymization,
  redactObject,
  sanitizeText,
} from './redaction';
import {
  type BundleManifest,
  DEFAULT_EXPORT_CONFIG,
  type ExportAuditEvent,
  type ExportBundle,
  type ExportBundleConfig,
  type ExportIncidentSummary,
  type ExportSupervisionReceipt,
  type GenerateExportRequest,
  type IExportBundleStorage,
  type IExportBundleStore,
  type StoredExportBundle,
} from './types';

/**
 * Interface for reading audit events
 */
export interface IAuditEventExportReader {
  /**
   * Get audit events for export
   */
  getEventsForExport(
    organizationId: string,
    from: Date,
    to: Date,
    traceIds?: string[],
  ): Promise<
    Array<{
      event_id: string;
      event_type: string;
      timestamp: Date;
      trace_id: string;
      organization_id: string;
      subject_id?: string;
      decision?: string;
      reason_codes?: string[];
      mode?: string;
      validation_result?: { is_valid: boolean; issues?: string[] };
      safe_mode?: { enabled: boolean; reason?: string };
      metadata?: Record<string, unknown>;
    }>
  >;
}

/**
 * Interface for reading incidents
 */
export interface IIncidentExportReader {
  /**
   * Get incidents for export
   */
  getIncidentsForExport(
    organizationId: string,
    from: Date,
    to: Date,
  ): Promise<
    Array<{
      id: string;
      created_at: Date;
      type: string;
      status: string;
      trigger_signal?: string;
      title: string;
      description?: string;
      safe_mode_enabled?: Date;
      resolved_at?: Date;
      resolved_by?: string;
      resolution_notes?: string;
      metadata?: Record<string, unknown>;
    }>
  >;
}

/**
 * Export Bundle Generator
 *
 * Generates de-identified export bundles containing:
 * - Audit events (PHI-minimized)
 * - Supervision receipts
 * - Incident summaries
 */
export class ExportBundleGenerator {
  private readonly config: ExportBundleConfig;
  private readonly storage: IExportBundleStorage;
  private readonly store: IExportBundleStore;
  private readonly auditReader: IAuditEventExportReader;
  private readonly incidentReader: IIncidentExportReader;
  private readonly _hashSalt: string | undefined;

  /** Get hash salt - returns undefined to use env variable if not explicitly set */
  private get hashSalt(): string | undefined {
    return this._hashSalt || undefined;
  }

  constructor(params: {
    config?: Partial<ExportBundleConfig>;
    storage: IExportBundleStorage;
    store: IExportBundleStore;
    auditReader: IAuditEventExportReader;
    incidentReader: IIncidentExportReader;
    hashSalt?: string;
  }) {
    this.config = { ...DEFAULT_EXPORT_CONFIG, ...params.config };
    this.storage = params.storage;
    this.store = params.store;
    this.auditReader = params.auditReader;
    this.incidentReader = params.incidentReader;
    // hashSalt is optional - if not provided, hashForPseudonymization will use env variable
    this._hashSalt = params.hashSalt;
  }

  /**
   * Generate an export bundle
   */
  async generate(request: GenerateExportRequest): Promise<StoredExportBundle> {
    const bundleId = randomUUID();
    const now = new Date();

    // Fetch raw data
    const [rawEvents, rawIncidents] = await Promise.all([
      this.auditReader.getEventsForExport(
        request.organization_id,
        request.from,
        request.to,
        request.trace_ids,
      ),
      this.incidentReader.getIncidentsForExport(request.organization_id, request.from, request.to),
    ]);

    // Check limits
    if (rawEvents.length > this.config.maxEventsPerBundle) {
      throw new Error(
        `Too many events (${rawEvents.length} > ${this.config.maxEventsPerBundle}). Use a smaller time window.`,
      );
    }

    // Transform to de-identified format
    const auditEvents = this.transformAuditEvents(rawEvents);
    const supervisionReceipts = this.extractSupervisionReceipts(
      rawEvents,
      request.include_snapshot_uris,
    );
    const incidentSummaries = this.transformIncidents(rawIncidents, rawEvents);

    // Collect trace IDs
    const traceIds = [...new Set(auditEvents.map((e) => e.trace_id))];

    // Build manifest
    const manifest: BundleManifest = {
      bundle_version: '1.0.0',
      generated_at: now.toISOString(),
      generator: {
        system: 'popper',
        service_version: this.config.serviceVersion,
        ruleset_version: this.config.defaultRulesetVersion,
      },
      scope: {
        mode: request.mode ?? 'advocate_clinical',
        organization_id: hashForPseudonymization(request.organization_id, this.hashSalt),
        time_window: {
          from: request.from.toISOString(),
          to: request.to.toISOString(),
        },
      },
      trace_ids: traceIds,
      files: {
        audit_events: 'audit_events.jsonl',
        supervision_receipts: 'supervision_receipts.jsonl',
        ...(incidentSummaries.length > 0 ? { incident_summaries: 'incidents.jsonl' } : {}),
      },
    };

    // Build bundle
    const bundle: ExportBundle = {
      bundle_id: bundleId,
      manifest,
      audit_events: auditEvents,
      supervision_receipts: supervisionReceipts,
      incident_summaries: incidentSummaries,
    };

    // Serialize and compress (async to avoid blocking event loop)
    const bundleData = await this.serializeBundle(bundle);
    const contentHash = createHash('sha256').update(bundleData).digest('hex');

    // Upload to storage
    const contentType = this.config.enableCompression ? 'application/gzip' : 'application/json';
    const storageUri = await this.storage.upload(bundleId, bundleData, contentType);

    // Calculate expiration
    const expiresAt = new Date(
      now.getTime() + this.config.bundleExpirationDays * 24 * 60 * 60 * 1000,
    );

    // Save metadata
    const storedBundle: StoredExportBundle = {
      id: bundleId,
      organization_id: request.organization_id,
      time_window: {
        from: request.from,
        to: request.to,
      },
      generated_at: now,
      triggered_by: request.triggered_by,
      storage_uri: storageUri,
      size_bytes: bundleData.length,
      content_hash: contentHash,
      event_count: auditEvents.length,
      incident_count: incidentSummaries.length,
      status: 'ready',
      expires_at: expiresAt,
      created_at: now,
      updated_at: now,
    };

    return this.store.save(storedBundle);
  }

  /**
   * Transform raw audit events to de-identified format
   */
  private transformAuditEvents(
    rawEvents: Array<{
      event_id: string;
      event_type: string;
      timestamp: Date;
      trace_id: string;
      organization_id: string;
      subject_id?: string;
      decision?: string;
      reason_codes?: string[];
      mode?: string;
      validation_result?: { is_valid: boolean; issues?: string[] };
      safe_mode?: { enabled: boolean; reason?: string };
      metadata?: Record<string, unknown>;
    }>,
  ): ExportAuditEvent[] {
    return rawEvents.map((event) => {
      const exportEvent: ExportAuditEvent = {
        event_id: event.event_id,
        event_type: event.event_type,
        timestamp: event.timestamp.toISOString(),
        trace_id: event.trace_id,
        organization_id: hashForPseudonymization(event.organization_id, this.hashSalt),
      };

      // Hash subject_id if present
      if (event.subject_id) {
        exportEvent.subject_id_hash = hashForPseudonymization(event.subject_id, this.hashSalt);
      }

      // Include decision info
      if (event.decision) {
        exportEvent.decision = event.decision;
      }
      if (event.reason_codes?.length) {
        exportEvent.reason_codes = event.reason_codes;
      }
      if (event.mode) {
        exportEvent.mode = event.mode;
      }

      // Include validation result
      if (event.validation_result) {
        exportEvent.validation_result = {
          is_valid: event.validation_result.is_valid,
          issues: event.validation_result.issues?.map((issue) => sanitizeText(issue)),
        };
      }

      // Include safe-mode info
      if (event.safe_mode) {
        exportEvent.safe_mode = {
          enabled: event.safe_mode.enabled,
          reason: event.safe_mode.reason ? sanitizeText(event.safe_mode.reason) : undefined,
        };
      }

      // Redact metadata
      if (event.metadata && Object.keys(event.metadata).length > 0) {
        const { redacted } = redactObject(event.metadata as Record<string, unknown>, this.hashSalt);
        exportEvent.metadata = redacted;
      }

      return exportEvent;
    });
  }

  /**
   * Extract supervision receipts from audit events
   */
  private extractSupervisionReceipts(
    rawEvents: Array<{
      event_id: string;
      event_type: string;
      timestamp: Date;
      trace_id: string;
      decision?: string;
      reason_codes?: string[];
      metadata?: Record<string, unknown>;
    }>,
    includeSnapshotUris = false,
  ): ExportSupervisionReceipt[] {
    // Group by trace_id and find supervision events
    const supervisionEvents = rawEvents.filter(
      (e) => e.event_type === 'supervision.completed' || e.event_type === 'supervision_completed',
    );

    return supervisionEvents.map((event) => {
      const metadata = event.metadata ?? {};

      // Build redaction summaries
      const requestRedaction = metadata.request_audit_redaction as
        | Record<string, unknown>
        | undefined;
      const responseRedaction = metadata.response_audit_redaction as
        | Record<string, unknown>
        | undefined;

      const receipt: ExportSupervisionReceipt = {
        trace_id: event.trace_id,
        timestamp: event.timestamp.toISOString(),
        producer: {
          service: 'popper',
          service_version: this.config.serviceVersion,
          ruleset_version: this.config.defaultRulesetVersion,
        },
        decision: event.decision ?? 'UNKNOWN',
        reason_codes: event.reason_codes ?? [],
      };

      // Add redaction info if available
      if (requestRedaction) {
        const { redactedFields } = redactObject(requestRedaction, this.hashSalt);
        receipt.request_redaction = createRedactionSummary(redactedFields);
        receipt.request_redaction.summary = sanitizeText(receipt.request_redaction.summary);
      }

      if (responseRedaction) {
        const { redactedFields } = redactObject(responseRedaction, this.hashSalt);
        receipt.response_redaction = createRedactionSummary(redactedFields);
        receipt.response_redaction.summary = sanitizeText(receipt.response_redaction.summary);
      }

      // Add snapshot ref if available
      const snapshotRef = metadata.snapshot_ref as Record<string, unknown> | undefined;
      if (snapshotRef?.snapshot_id) {
        receipt.snapshot_ref = {
          snapshot_id: String(snapshotRef.snapshot_id),
          snapshot_hash: snapshotRef.snapshot_hash ? String(snapshotRef.snapshot_hash) : undefined,
        };
        // Only include URI if explicitly requested (recipient has access)
        if (includeSnapshotUris && snapshotRef.snapshot_uri) {
          receipt.snapshot_ref.snapshot_uri = String(snapshotRef.snapshot_uri);
        }
      }

      return receipt;
    });
  }

  /**
   * Transform incidents to de-identified format
   */
  private transformIncidents(
    rawIncidents: Array<{
      id: string;
      created_at: Date;
      type: string;
      status: string;
      trigger_signal?: string;
      title: string;
      description?: string;
      safe_mode_enabled?: Date;
      resolved_at?: Date;
      resolved_by?: string;
      resolution_notes?: string;
    }>,
    rawEvents: Array<{ trace_id: string; timestamp: Date }>,
  ): ExportIncidentSummary[] {
    return rawIncidents.map((incident) => {
      // Map status to resolution
      let resolution: ExportIncidentSummary['resolution'];
      if (incident.status === 'resolved') {
        resolution = {
          status: 'resolved',
          resolved_at: incident.resolved_at?.toISOString(),
          resolved_by: incident.resolved_by
            ? hashForPseudonymization(incident.resolved_by, this.hashSalt)
            : undefined,
          notes: incident.resolution_notes ? sanitizeText(incident.resolution_notes) : undefined,
        };
      } else if (incident.status === 'open') {
        resolution = { status: 'pending' };
      }

      // Find related trace IDs (events around incident time)
      const incidentTime = incident.created_at.getTime();
      const relatedTraceIds = [
        ...new Set(
          rawEvents
            .filter((e) => Math.abs(e.timestamp.getTime() - incidentTime) < 60000) // Within 1 minute
            .map((e) => e.trace_id),
        ),
      ];

      // Map type to severity
      let severity: ExportIncidentSummary['severity'] = 'warning';
      if (incident.type.includes('critical') || incident.trigger_signal?.includes('hard_stop')) {
        severity = 'critical';
      } else if (incident.type.includes('info')) {
        severity = 'info';
      }

      const summary: ExportIncidentSummary = {
        incident_id: incident.id,
        created_at: incident.created_at.toISOString(),
        severity,
        trigger: incident.trigger_signal ?? incident.type,
        summary: sanitizeText(
          incident.title + (incident.description ? `: ${incident.description}` : ''),
        ),
        related_trace_ids: relatedTraceIds,
        resolution,
      };

      // Add safe-mode changes if applicable
      if (incident.safe_mode_enabled) {
        summary.safe_mode_changes = [
          {
            timestamp: incident.safe_mode_enabled.toISOString(),
            enabled: true,
            reason: sanitizeText(incident.title),
          },
        ];
      }

      return summary;
    });
  }

  /**
   * Serialize bundle to bytes (optionally compressed)
   * Uses async gzip to avoid blocking the event loop for large bundles
   */
  private async serializeBundle(bundle: ExportBundle): Promise<Buffer> {
    // Combine into a single JSON structure
    // In production, this could be a tar.gz with separate JSONL files
    // Note: No pretty-print (null, 2) - saves ~30% space for machine-readable data
    const combined = JSON.stringify({
      'bundle_manifest.json': bundle.manifest,
      'audit_events.jsonl': bundle.audit_events,
      'supervision_receipts.jsonl': bundle.supervision_receipts,
      'incidents.jsonl': bundle.incident_summaries,
    });

    const data = Buffer.from(combined, 'utf-8');

    if (this.config.enableCompression) {
      return await gzip(data);
    }

    return data;
  }

  /**
   * Get a bundle by ID
   */
  async getBundle(bundleId: string): Promise<StoredExportBundle | null> {
    return this.store.getById(bundleId);
  }

  /**
   * List bundles for an organization with cursor-based pagination
   */
  async listBundles(
    organizationId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<{ bundles: StoredExportBundle[]; next_cursor: string | null; has_more: boolean }> {
    return this.store.list(organizationId, options);
  }

  /**
   * Download a bundle
   */
  async downloadBundle(
    bundleId: string,
  ): Promise<{ data: Buffer; bundle: StoredExportBundle } | null> {
    const bundle = await this.store.getById(bundleId);
    if (!bundle) return null;

    const data = await this.storage.download(bundle.storage_uri);
    await this.store.markDownloaded(bundleId);

    return { data, bundle };
  }

  /**
   * Get download URL for a bundle (if storage supports presigned URLs)
   */
  async getDownloadUrl(bundleId: string, expiresIn = 3600): Promise<string | null> {
    const bundle = await this.store.getById(bundleId);
    if (!bundle) return null;

    if (!this.storage.getDownloadUrl) {
      throw new Error('Storage does not support presigned URLs');
    }

    return this.storage.getDownloadUrl(bundle.storage_uri, expiresIn);
  }
}
