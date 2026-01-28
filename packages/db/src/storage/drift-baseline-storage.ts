/**
 * Drizzle-based drift baseline storage for TimescaleDB
 *
 * Implements the IBaselineStore interface from @popper/core
 * for production use with PostgreSQL/TimescaleDB.
 *
 * Also implements IDailyAggregateReader for reading from
 * the audit_events_daily continuous aggregate.
 *
 * @module storage/drift-baseline-storage
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import type { DrizzleDB } from '../db';
import { driftBaselines, type NewDriftBaseline } from '../schema/drift-baselines';

/**
 * UUID regex pattern for validation
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate and sanitize organization ID
 * @throws Error if not a valid UUID
 */
function validateOrgId(orgId: string): string {
  if (!UUID_REGEX.test(orgId)) {
    throw new Error(`Invalid organization ID format: ${orgId.slice(0, 50)}`);
  }
  return orgId.toLowerCase();
}

/**
 * Baseline signal type (matches @popper/core)
 */
export type BaselineSignal =
  | 'request_count'
  | 'approved_count'
  | 'hard_stop_count'
  | 'route_to_clinician_count'
  | 'request_more_info_count'
  | 'validation_failure_count'
  | 'high_uncertainty_count'
  | 'missing_evidence_count'
  | 'htv_below_threshold_count'
  | 'policy_violation_count';

/**
 * Stored baseline record
 */
export interface StoredBaseline {
  organizationId: string;
  calculatedAt: Date;
  signalName: string;
  baselineValue: number;
  warningThreshold: number;
  criticalThreshold: number;
  sampleCount: number;
  metadata?: Record<string, unknown>;
}

/**
 * New baseline input
 */
export interface NewBaseline {
  organizationId: string;
  signalName: string;
  baselineValue: number;
  warningThreshold: number;
  criticalThreshold: number;
  sampleCount: number;
  calculatedAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Daily audit aggregate row from continuous aggregate
 */
export interface DailyAuditAggregate {
  bucket: Date;
  organizationId: string;
  requestCount: number;
  approvedCount: number;
  hardStopCount: number;
  routeToClinicianCount: number;
  requestMoreInfoCount: number;
  validationFailureCount: number;
  highUncertaintyCount: number;
  missingEvidenceCount: number;
  htvBelowThresholdCount: number;
  policyViolationCount: number;
  avgLatencyMs: number | null;
  p95LatencyMs: number | null;
  p99LatencyMs: number | null;
}

/**
 * DrizzleDriftBaselineStorage - Production baseline storage using Drizzle ORM
 *
 * Features:
 * - Implements IBaselineStore interface
 * - Works with TimescaleDB hypertables
 * - Batch insert support
 */
export class DrizzleDriftBaselineStorage {
  constructor(private readonly db: DrizzleDB) {}

  /**
   * Get the latest baseline for a signal
   */
  async getLatest(
    organizationId: string,
    signalName: BaselineSignal,
  ): Promise<StoredBaseline | null> {
    const validOrgId = validateOrgId(organizationId);

    const results = await this.db
      .select()
      .from(driftBaselines)
      .where(
        and(
          eq(driftBaselines.organizationId, validOrgId),
          eq(driftBaselines.signalName, signalName),
        ),
      )
      .orderBy(desc(driftBaselines.calculatedAt))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    return this.toStoredBaseline(results[0]);
  }

  /**
   * Get all latest baselines for an organization
   */
  async getAllLatest(organizationId: string): Promise<StoredBaseline[]> {
    const validOrgId = validateOrgId(organizationId);

    try {
      // Use DISTINCT ON to get latest for each signal
      const results = await this.db.execute(sql`
        SELECT DISTINCT ON (signal_name)
          organization_id,
          calculated_at,
          signal_name,
          baseline_value,
          warning_threshold,
          critical_threshold,
          sample_count,
          metadata
        FROM drift_baselines
        WHERE organization_id = ${validOrgId}::uuid
        ORDER BY signal_name, calculated_at DESC
      `);

      // Handle different result formats from db.execute
      const rows = results?.rows ?? results ?? [];
      return (rows as Array<Record<string, unknown>>).map((row) => ({
        organizationId: row.organization_id as string,
        calculatedAt: new Date(row.calculated_at as string),
        signalName: row.signal_name as string,
        baselineValue: row.baseline_value as number,
        warningThreshold: row.warning_threshold as number,
        criticalThreshold: row.critical_threshold as number,
        sampleCount: row.sample_count as number,
        metadata: row.metadata as Record<string, unknown>,
      }));
    } catch (error) {
      console.error('Failed to get all latest baselines:', error);
      return [];
    }
  }

  /**
   * Save a baseline record
   */
  async save(baseline: NewBaseline): Promise<StoredBaseline> {
    const record = this.toRecord(baseline);

    const [result] = await this.db.insert(driftBaselines).values(record).returning();

    return this.toStoredBaseline(result);
  }

  /**
   * Save multiple baselines in batch
   */
  async saveBatch(baselines: NewBaseline[]): Promise<StoredBaseline[]> {
    if (baselines.length === 0) return [];

    const records = baselines.map((b) => this.toRecord(b));

    const results = await this.db.insert(driftBaselines).values(records).returning();

    return results.map((r) => this.toStoredBaseline(r));
  }

  /**
   * Get baseline history for a signal
   */
  async getHistory(
    organizationId: string,
    signalName: BaselineSignal,
    limit = 100,
  ): Promise<StoredBaseline[]> {
    const validOrgId = validateOrgId(organizationId);

    const results = await this.db
      .select()
      .from(driftBaselines)
      .where(
        and(
          eq(driftBaselines.organizationId, validOrgId),
          eq(driftBaselines.signalName, signalName),
        ),
      )
      .orderBy(desc(driftBaselines.calculatedAt))
      .limit(limit);

    return results.map((r) => this.toStoredBaseline(r));
  }

  private toRecord(baseline: NewBaseline): NewDriftBaseline {
    // Validate org ID before saving
    const validOrgId = validateOrgId(baseline.organizationId);

    return {
      organizationId: validOrgId,
      signalName: baseline.signalName,
      baselineValue: baseline.baselineValue,
      warningThreshold: baseline.warningThreshold,
      criticalThreshold: baseline.criticalThreshold,
      sampleCount: baseline.sampleCount,
      calculatedAt: baseline.calculatedAt ?? new Date(),
      metadata: baseline.metadata ?? {},
    };
  }

  private toStoredBaseline(row: typeof driftBaselines.$inferSelect): StoredBaseline {
    return {
      organizationId: row.organizationId,
      calculatedAt: row.calculatedAt,
      signalName: row.signalName,
      baselineValue: row.baselineValue,
      warningThreshold: row.warningThreshold,
      criticalThreshold: row.criticalThreshold,
      sampleCount: row.sampleCount,
      metadata: row.metadata ?? undefined,
    };
  }
}

/**
 * DrizzleDailyAggregateReader - Read from audit_events_daily continuous aggregate
 */
export class DrizzleDailyAggregateReader {
  constructor(private readonly db: DrizzleDB) {}

  /**
   * Get daily aggregates for a date range
   */
  async getRange(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DailyAuditAggregate[]> {
    // Validate org ID format (must be UUID)
    const validOrgId = validateOrgId(organizationId);

    // Convert dates to ISO strings for SQL
    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    try {
      const results = await this.db.execute(sql`
        SELECT
          bucket,
          organization_id,
          request_count,
          approved_count,
          hard_stop_count,
          route_to_clinician_count,
          request_more_info_count,
          validation_failure_count,
          high_uncertainty_count,
          missing_evidence_count,
          htv_below_threshold_count,
          policy_violation_count,
          avg_latency_ms,
          p95_latency_ms,
          p99_latency_ms
        FROM audit_events_daily
        WHERE organization_id = ${validOrgId}
          AND bucket >= ${startIso}::timestamptz
          AND bucket <= ${endIso}::timestamptz
        ORDER BY bucket ASC
      `);

      // Handle different result formats from db.execute
      const rows = results?.rows ?? results ?? [];
      return (rows as Array<Record<string, unknown>>).map((row) => this.toAggregate(row));
    } catch (error) {
      // Return empty array if table doesn't exist yet
      console.error('Failed to read audit_events_daily:', error);
      return [];
    }
  }

  /**
   * Get aggregates for the last N days
   */
  async getLastNDays(organizationId: string, days: number): Promise<DailyAuditAggregate[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    return this.getRange(organizationId, startDate, endDate);
  }

  private toAggregate(row: Record<string, unknown>): DailyAuditAggregate {
    return {
      bucket: new Date(row.bucket as string),
      organizationId: row.organization_id as string,
      requestCount: Number(row.request_count) || 0,
      approvedCount: Number(row.approved_count) || 0,
      hardStopCount: Number(row.hard_stop_count) || 0,
      routeToClinicianCount: Number(row.route_to_clinician_count) || 0,
      requestMoreInfoCount: Number(row.request_more_info_count) || 0,
      validationFailureCount: Number(row.validation_failure_count) || 0,
      highUncertaintyCount: Number(row.high_uncertainty_count) || 0,
      missingEvidenceCount: Number(row.missing_evidence_count) || 0,
      htvBelowThresholdCount: Number(row.htv_below_threshold_count) || 0,
      policyViolationCount: Number(row.policy_violation_count) || 0,
      avgLatencyMs: row.avg_latency_ms != null ? Number(row.avg_latency_ms) : null,
      p95LatencyMs: row.p95_latency_ms != null ? Number(row.p95_latency_ms) : null,
      p99LatencyMs: row.p99_latency_ms != null ? Number(row.p99_latency_ms) : null,
    };
  }
}
