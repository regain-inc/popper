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

import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import type { DrizzleDB } from '../db';
import { auditEvents } from '../schema/audit-events';

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

export interface ListEventsOptions {
  organizationId?: string;
  eventType?: string;
  decision?: string;
  traceId?: string;
  since?: Date;
  until?: Date;
  limit?: number;
  offset?: number;
}

export interface ListEventsResult {
  events: Array<{
    id: string;
    event_type: string;
    occurred_at: Date;
    trace_id: string;
    subject_id: string;
    organization_id: string;
    decision: string | null;
    reason_codes: string[] | null;
    safe_mode_active: boolean;
    latency_ms: number | null;
    policy_pack_version: string;
    payload: Record<string, unknown> | null;
    tags: string[] | null;
  }>;
  total: number;
}

export interface TimeseriesOptions {
  organizationId?: string;
  since: Date;
  until: Date;
  bucket: '1 hour' | '1 day' | '1 week';
  groupBy: 'decision' | 'event_type';
}

export interface TimeseriesBucket {
  timestamp: Date;
  counts: Record<string, number>;
  total: number;
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

  /**
   * List individual audit events with pagination and filters.
   * Queries raw audit_events hypertable with chunk/segment exclusion.
   */
  async listEvents(options: ListEventsOptions): Promise<ListEventsResult> {
    const limit = Math.min(options.limit ?? 50, 1000);
    const offset = options.offset ?? 0;

    try {
      const conditions = [];

      if (options.organizationId) {
        conditions.push(eq(auditEvents.organizationId, validateOrgId(options.organizationId)));
      }
      if (options.eventType) {
        conditions.push(eq(auditEvents.eventType, options.eventType));
      }
      if (options.decision) {
        conditions.push(eq(auditEvents.decision, options.decision));
      }
      if (options.traceId) {
        conditions.push(eq(auditEvents.traceId, options.traceId));
      }
      if (options.since) {
        conditions.push(gte(auditEvents.createdAt, options.since));
      }
      if (options.until) {
        conditions.push(lte(auditEvents.createdAt, options.until));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      // Count total matching rows
      const countResult = await this.db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(auditEvents)
        .where(where);
      const total = countResult[0]?.count ?? 0;

      // Fetch page
      const rows = await this.db
        .select()
        .from(auditEvents)
        .where(where)
        .orderBy(desc(auditEvents.createdAt))
        .limit(limit)
        .offset(offset);

      return {
        events: rows.map((row) => ({
          id: row.id,
          event_type: row.eventType,
          occurred_at: row.createdAt,
          trace_id: row.traceId,
          subject_id: row.subjectId,
          organization_id: row.organizationId,
          decision: row.decision,
          reason_codes: row.reasonCodes as string[] | null,
          safe_mode_active: row.safeModeActive,
          latency_ms: row.latencyMs,
          policy_pack_version: row.policyPackVersion,
          payload: row.payload as Record<string, unknown> | null,
          tags: row.tags as string[] | null,
        })),
        total,
      };
    } catch (error) {
      console.error('Failed to list audit events:', error);
      return { events: [], total: 0 };
    }
  }

  /**
   * Get timeseries aggregation of audit events.
   * Uses continuous aggregate for daily buckets, raw hypertable for hour/week.
   */
  async getTimeseries(
    options: TimeseriesOptions,
  ): Promise<{ buckets: TimeseriesBucket[]; totalEvents: number }> {
    const sinceIso = options.since.toISOString();
    const untilIso = options.until.toISOString();

    try {
      const orgFilter = options.organizationId
        ? sql`AND organization_id = ${validateOrgId(options.organizationId)}`
        : sql``;

      // For daily buckets, use the pre-computed continuous aggregate
      if (options.bucket === '1 day' && options.groupBy === 'decision') {
        return this.getTimeseriesFromAggregate(sinceIso, untilIso, orgFilter);
      }

      // For hour/week buckets or event_type grouping, query raw hypertable
      const groupColumn = options.groupBy === 'decision' ? sql`decision` : sql`event_type`;

      const results = await this.db.execute(sql`
        SELECT
          time_bucket(${options.bucket}, created_at) AS bucket_time,
          ${groupColumn} AS group_key,
          COUNT(*)::int AS count
        FROM audit_events
        WHERE created_at >= ${sinceIso}::timestamptz
          AND created_at < ${untilIso}::timestamptz
          ${orgFilter}
        GROUP BY bucket_time, group_key
        ORDER BY bucket_time ASC
      `);

      const rows = (results?.rows ?? results ?? []) as Array<Record<string, unknown>>;
      return this.aggregateTimeseriesRows(rows);
    } catch (error) {
      console.error('Failed to read timeseries:', error);
      return { buckets: [], totalEvents: 0 };
    }
  }

  private async getTimeseriesFromAggregate(
    sinceIso: string,
    untilIso: string,
    orgFilter: ReturnType<typeof sql>,
  ): Promise<{ buckets: TimeseriesBucket[]; totalEvents: number }> {
    const results = await this.db.execute(sql`
      SELECT
        bucket AS bucket_time,
        request_count,
        approved_count,
        hard_stop_count,
        route_to_clinician_count,
        request_more_info_count
      FROM audit_events_daily
      WHERE bucket >= ${sinceIso}::timestamptz
        AND bucket < ${untilIso}::timestamptz
        ${orgFilter}
      ORDER BY bucket ASC
    `);

    const rows = (results?.rows ?? results ?? []) as Array<Record<string, unknown>>;
    let totalEvents = 0;

    const buckets: TimeseriesBucket[] = rows.map((row) => {
      const total = Number(row.request_count ?? 0);
      totalEvents += total;
      return {
        timestamp: new Date(row.bucket_time as string),
        counts: {
          APPROVED: Number(row.approved_count ?? 0),
          HARD_STOP: Number(row.hard_stop_count ?? 0),
          ROUTE_TO_CLINICIAN: Number(row.route_to_clinician_count ?? 0),
          REQUEST_MORE_INFO: Number(row.request_more_info_count ?? 0),
        },
        total,
      };
    });

    return { buckets, totalEvents };
  }

  private aggregateTimeseriesRows(rows: Array<Record<string, unknown>>): {
    buckets: TimeseriesBucket[];
    totalEvents: number;
  } {
    const bucketMap = new Map<string, TimeseriesBucket>();
    let totalEvents = 0;

    for (const row of rows) {
      const ts = new Date(row.bucket_time as string).toISOString();
      const groupKey = (row.group_key as string) ?? 'unknown';
      const count = Number(row.count ?? 0);
      totalEvents += count;

      let bucket = bucketMap.get(ts);
      if (!bucket) {
        bucket = { timestamp: new Date(row.bucket_time as string), counts: {}, total: 0 };
        bucketMap.set(ts, bucket);
      }
      bucket.counts[groupKey] = (bucket.counts[groupKey] ?? 0) + count;
      bucket.total += count;
    }

    return {
      buckets: Array.from(bucketMap.values()),
      totalEvents,
    };
  }
}
