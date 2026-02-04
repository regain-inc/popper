/**
 * Drizzle-based audit event reader for RLHF feedback aggregation
 *
 * Implements IAuditEventReader from @popper/core for production use.
 * Uses audit_events_daily continuous aggregate where possible for performance,
 * falls back to raw audit_events hypertable for JSONB payload queries.
 *
 * Performance strategy (per pg aiguide best practices):
 * - getEventCount: continuous aggregate SUM(request_count)
 * - getAlertFatigueMetrics: hybrid (aggregate + raw for JSONB)
 * - getAccuracyMetrics: raw hypertable with event_type filter
 * - getOverrideCounts: raw hypertable with event_type + JSONB GROUP BY
 * - getBiasSignals: raw hypertable with JSONB payload filter
 *
 * All raw queries filter by:
 * 1. created_at (partition column) — chunk exclusion
 * 2. organization_id (segment_by column) — segment exclusion
 * 3. event_type (indexed) — further filtering
 *
 * @module storage/audit-event-reader
 */

import { sql } from 'drizzle-orm';
import type { DrizzleDB } from '../db';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateOrgId(orgId: string): string {
  if (!UUID_REGEX.test(orgId)) {
    throw new Error(`Invalid organization ID format: ${orgId.slice(0, 50)}`);
  }
  return orgId.toLowerCase();
}

export interface OverrideSignal {
  proposalKind: string;
  overrideAction: 'accepted' | 'rejected';
  rationaleCategory: string;
  count: number;
}

export interface AccuracyMetrics {
  totalValidated: number;
  accurateCount: number;
  hallucinationCount: number;
  missingEvidenceCount: number;
  accuracyRate: number;
}

export interface AlertFatigueMetrics {
  overrideRate30d: number;
  avgResponseTimeSeconds: number;
  autoDismissedCount: number;
}

export interface BiasSignal {
  biasType: 'age' | 'gender' | 'ethnicity' | 'insurance' | 'other';
  affectedGroup: string;
  rateDeviation: number;
  affectedCount: number;
}

/**
 * DrizzleAuditEventReader — Production audit event reader using Drizzle ORM
 *
 * Provides aggregated signals from audit_events for RLHF feedback loop.
 * Leverages TimescaleDB continuous aggregates for performance.
 */
export class DrizzleAuditEventReader {
  constructor(private readonly db: DrizzleDB) {}

  /**
   * Get total event count for the period.
   * Uses audit_events_daily continuous aggregate for performance.
   */
  async getEventCount(
    organizationId: string | null,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<number> {
    const startIso = periodStart.toISOString();
    const endIso = periodEnd.toISOString();

    try {
      const orgFilter = organizationId
        ? sql`AND organization_id = ${validateOrgId(organizationId)}`
        : sql``;

      const results = await this.db.execute(sql`
        SELECT COALESCE(SUM(request_count), 0)::bigint AS total
        FROM audit_events_daily
        WHERE bucket >= ${startIso}::timestamptz
          AND bucket < ${endIso}::timestamptz
          ${orgFilter}
      `);

      const rows = (results?.rows ?? results ?? []) as Array<Record<string, unknown>>;
      return Number(rows[0]?.total ?? 0);
    } catch (error) {
      console.error('Failed to read event count from continuous aggregate:', error);
      return 0;
    }
  }

  /**
   * Get override counts by proposal kind and action.
   * Queries raw audit_events hypertable (needs JSONB payload grouping).
   */
  async getOverrideCounts(
    organizationId: string | null,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<OverrideSignal[]> {
    const startIso = periodStart.toISOString();
    const endIso = periodEnd.toISOString();

    try {
      const orgFilter = organizationId
        ? sql`AND organization_id = ${validateOrgId(organizationId)}`
        : sql``;

      const results = await this.db.execute(sql`
        SELECT
          COALESCE(payload->>'proposal_kind', 'unknown') AS proposal_kind,
          COALESCE(payload->>'override_action', 'unknown') AS override_action,
          COALESCE(payload->>'rationale_category', 'uncategorized') AS rationale_category,
          COUNT(*)::bigint AS count
        FROM audit_events
        WHERE created_at >= ${startIso}::timestamptz
          AND created_at < ${endIso}::timestamptz
          AND event_type = 'SUPERVISION_OVERRIDE'
          ${orgFilter}
        GROUP BY 1, 2, 3
      `);

      const rows = (results?.rows ?? results ?? []) as Array<Record<string, unknown>>;
      return rows.map((row) => ({
        proposalKind: row.proposal_kind as string,
        overrideAction: (row.override_action as string) === 'accepted' ? 'accepted' : 'rejected',
        rationaleCategory: row.rationale_category as string,
        count: Number(row.count),
      }));
    } catch (error) {
      console.error('Failed to read override counts:', error);
      return [];
    }
  }

  /**
   * Get accuracy metrics from validation results.
   * Queries raw audit_events (needs payload JSONB for detailed metrics).
   */
  async getAccuracyMetrics(
    organizationId: string | null,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<AccuracyMetrics> {
    const startIso = periodStart.toISOString();
    const endIso = periodEnd.toISOString();
    const defaultMetrics: AccuracyMetrics = {
      totalValidated: 0,
      accurateCount: 0,
      hallucinationCount: 0,
      missingEvidenceCount: 0,
      accuracyRate: 0,
    };

    try {
      const orgFilter = organizationId
        ? sql`AND organization_id = ${validateOrgId(organizationId)}`
        : sql``;

      const results = await this.db.execute(sql`
        SELECT
          COUNT(*)::bigint AS total_validated,
          COUNT(*) FILTER (WHERE payload->>'is_valid' = 'true')::bigint AS accurate_count,
          COUNT(*) FILTER (WHERE payload->>'has_hallucination' = 'true')::bigint AS hallucination_count,
          COUNT(*) FILTER (WHERE reason_codes @> '["missing_evidence"]'::jsonb)::bigint AS missing_evidence_count
        FROM audit_events
        WHERE created_at >= ${startIso}::timestamptz
          AND created_at < ${endIso}::timestamptz
          AND event_type IN ('VALIDATION_FAILED', 'SUPERVISION_DECISION')
          ${orgFilter}
      `);

      const rows = (results?.rows ?? results ?? []) as Array<Record<string, unknown>>;
      if (rows.length === 0) return defaultMetrics;

      const row = rows[0];
      const totalValidated = Number(row.total_validated ?? 0);
      const accurateCount = Number(row.accurate_count ?? 0);

      return {
        totalValidated,
        accurateCount,
        hallucinationCount: Number(row.hallucination_count ?? 0),
        missingEvidenceCount: Number(row.missing_evidence_count ?? 0),
        accuracyRate: totalValidated > 0 ? accurateCount / totalValidated : 0,
      };
    } catch (error) {
      console.error('Failed to read accuracy metrics:', error);
      return defaultMetrics;
    }
  }

  /**
   * Get alert fatigue metrics.
   * Hybrid: uses continuous aggregate for decision counts + latency,
   * raw hypertable for auto_dismissed count (JSONB payload).
   */
  async getAlertFatigueMetrics(
    organizationId: string | null,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<AlertFatigueMetrics | null> {
    const startIso = periodStart.toISOString();
    const endIso = periodEnd.toISOString();

    try {
      const orgFilter = organizationId
        ? sql`AND organization_id = ${validateOrgId(organizationId)}`
        : sql``;

      // Step 1: Get aggregate metrics from continuous aggregate
      const aggResults = await this.db.execute(sql`
        SELECT
          COALESCE(SUM(request_count), 0)::bigint AS total_decisions,
          COALESCE(SUM(hard_stop_count + route_to_clinician_count), 0)::bigint AS flagged_count,
          AVG(avg_latency_ms) AS avg_latency_ms
        FROM audit_events_daily
        WHERE bucket >= ${startIso}::timestamptz
          AND bucket < ${endIso}::timestamptz
          ${orgFilter}
      `);

      const aggRows = (aggResults?.rows ?? aggResults ?? []) as Array<Record<string, unknown>>;
      if (aggRows.length === 0) return null;

      const totalDecisions = Number(aggRows[0].total_decisions ?? 0);
      if (totalDecisions === 0) return null;

      const flaggedCount = Number(aggRows[0].flagged_count ?? 0);
      const avgLatencyMs = Number(aggRows[0].avg_latency_ms ?? 0);

      // Step 2: Get auto-dismissed count from raw hypertable
      const rawResults = await this.db.execute(sql`
        SELECT COUNT(*)::bigint AS auto_dismissed
        FROM audit_events
        WHERE created_at >= ${startIso}::timestamptz
          AND created_at < ${endIso}::timestamptz
          AND event_type = 'SUPERVISION_DECISION'
          AND payload->>'auto_dismissed' = 'true'
          ${orgFilter}
      `);

      const rawRows = (rawResults?.rows ?? rawResults ?? []) as Array<Record<string, unknown>>;
      const autoDismissedCount = Number(rawRows[0]?.auto_dismissed ?? 0);

      return {
        overrideRate30d: flaggedCount / totalDecisions,
        avgResponseTimeSeconds: avgLatencyMs / 1000,
        autoDismissedCount,
      };
    } catch (error) {
      console.error('Failed to read alert fatigue metrics:', error);
      return null;
    }
  }

  /**
   * Get bias detection signals.
   * Queries raw audit_events (needs JSONB payload grouping).
   */
  async getBiasSignals(
    organizationId: string | null,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<BiasSignal[]> {
    const startIso = periodStart.toISOString();
    const endIso = periodEnd.toISOString();

    try {
      const orgFilter = organizationId
        ? sql`AND organization_id = ${validateOrgId(organizationId)}`
        : sql``;

      const results = await this.db.execute(sql`
        SELECT
          payload->>'bias_type' AS bias_type,
          payload->>'affected_group' AS affected_group,
          COUNT(*)::bigint AS affected_count,
          AVG((payload->>'rate_deviation')::double precision) AS rate_deviation
        FROM audit_events
        WHERE created_at >= ${startIso}::timestamptz
          AND created_at < ${endIso}::timestamptz
          AND payload->>'bias_detected' = 'true'
          ${orgFilter}
        GROUP BY 1, 2
      `);

      const rows = (results?.rows ?? results ?? []) as Array<Record<string, unknown>>;
      const validBiasTypes = new Set(['age', 'gender', 'ethnicity', 'insurance', 'other']);

      return rows.map((row) => {
        const rawType = (row.bias_type as string) ?? 'other';
        return {
          biasType: (validBiasTypes.has(rawType) ? rawType : 'other') as BiasSignal['biasType'],
          affectedGroup: (row.affected_group as string) ?? 'unknown',
          rateDeviation: Number(row.rate_deviation ?? 0),
          affectedCount: Number(row.affected_count ?? 0),
        };
      });
    } catch (error) {
      console.error('Failed to read bias signals:', error);
      return [];
    }
  }
}
