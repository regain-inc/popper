/**
 * Source Registry Runtime Loader
 * Loads config/sources/registry.yaml, validates entries, cross-references
 * rule provenance citations, and alerts on upcoming review dates.
 *
 * @module policy-engine/source-registry
 */

import { readFile } from 'node:fs/promises';
import * as yaml from 'yaml';
import type { PolicyPack, RuleProvenance } from './types';

// =============================================================================
// Types
// =============================================================================

export type SourceType =
  | 'internal_policy'
  | 'society_guideline'
  | 'expert_consensus'
  | 'medication_label'
  | 'site_protocol'
  | 'regulatory';

export type ReviewStatus = 'active' | 'superseded' | 'under_review' | 'retired';

export interface SourceEntry {
  source_id: string;
  title: string;
  type: SourceType;
  issuing_body: string;
  publication_date?: string;
  doi?: string;
  url?: string;
  grading_system?: string;
  supersedes?: string | null;
  superseded_by?: string | null;
  review_status: ReviewStatus;
  last_reviewed?: string;
  next_review_due?: string;
}

export interface ReviewAlert {
  source_id: string;
  title: string;
  next_review_due: string;
  days_until_due: number;
  status: 'overdue' | 'due_soon' | 'upcoming';
}

export interface ProvenanceValidationResult {
  rule_id: string;
  citation: string;
  matched_source_id: string | null;
  issues: string[];
}

export interface RegistryValidationReport {
  total_sources: number;
  active_sources: number;
  superseded_sources: number;
  review_alerts: ReviewAlert[];
  orphaned_citations: ProvenanceValidationResult[];
  superseded_references: ProvenanceValidationResult[];
}

// =============================================================================
// Loader
// =============================================================================

/**
 * Load and parse the source registry YAML file.
 */
export async function loadSourceRegistry(filePath: string): Promise<SourceEntry[]> {
  const content = await readFile(filePath, 'utf-8');
  const parsed = yaml.parse(content) as { sources?: unknown[] };

  if (!parsed?.sources || !Array.isArray(parsed.sources)) {
    throw new SourceRegistryError(`Invalid registry file: missing 'sources' array`);
  }

  const entries: SourceEntry[] = [];
  for (const raw of parsed.sources) {
    const entry = validateSourceEntry(raw);
    entries.push(entry);
  }

  // Check for duplicate source_ids
  const ids = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.source_id)) {
      throw new SourceRegistryError(`Duplicate source_id: '${entry.source_id}'`);
    }
    ids.add(entry.source_id);
  }

  return entries;
}

function validateSourceEntry(raw: unknown): SourceEntry {
  if (!raw || typeof raw !== 'object') {
    throw new SourceRegistryError('Source entry must be an object');
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.source_id !== 'string' || !obj.source_id) {
    throw new SourceRegistryError('Source entry missing required field: source_id');
  }
  if (typeof obj.title !== 'string' || !obj.title) {
    throw new SourceRegistryError(`Source '${obj.source_id}' missing required field: title`);
  }
  if (typeof obj.type !== 'string') {
    throw new SourceRegistryError(`Source '${obj.source_id}' missing required field: type`);
  }
  if (typeof obj.review_status !== 'string') {
    throw new SourceRegistryError(
      `Source '${obj.source_id}' missing required field: review_status`,
    );
  }

  return {
    source_id: obj.source_id as string,
    title: obj.title as string,
    type: obj.type as SourceType,
    issuing_body: (obj.issuing_body as string) ?? 'unknown',
    publication_date: obj.publication_date as string | undefined,
    doi: obj.doi as string | undefined,
    url: obj.url as string | undefined,
    grading_system: obj.grading_system as string | undefined,
    supersedes: obj.supersedes as string | null | undefined,
    superseded_by: obj.superseded_by as string | null | undefined,
    review_status: obj.review_status as ReviewStatus,
    last_reviewed: obj.last_reviewed as string | undefined,
    next_review_due: obj.next_review_due as string | undefined,
  };
}

// =============================================================================
// Review Alerter
// =============================================================================

/**
 * Check all sources for upcoming or overdue reviews.
 *
 * @param sources - Loaded source entries
 * @param alertWithinDays - Number of days ahead to flag as "due_soon" (default: 30)
 * @param upcomingWithinDays - Number of days ahead to flag as "upcoming" (default: 90)
 * @param asOf - Reference date (default: now)
 */
export function checkReviewAlerts(
  sources: SourceEntry[],
  alertWithinDays = 30,
  upcomingWithinDays = 90,
  asOf: Date = new Date(),
): ReviewAlert[] {
  const alerts: ReviewAlert[] = [];

  for (const source of sources) {
    if (source.review_status !== 'active' || !source.next_review_due) continue;

    const dueDate = new Date(source.next_review_due);
    const diffMs = dueDate.getTime() - asOf.getTime();
    const daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    let status: ReviewAlert['status'] | null = null;
    if (daysUntilDue < 0) {
      status = 'overdue';
    } else if (daysUntilDue <= alertWithinDays) {
      status = 'due_soon';
    } else if (daysUntilDue <= upcomingWithinDays) {
      status = 'upcoming';
    }

    if (status) {
      alerts.push({
        source_id: source.source_id,
        title: source.title,
        next_review_due: source.next_review_due,
        days_until_due: daysUntilDue,
        status,
      });
    }
  }

  // Sort: overdue first, then by days_until_due ascending
  return alerts.sort((a, b) => a.days_until_due - b.days_until_due);
}

// =============================================================================
// Provenance Validator
// =============================================================================

/**
 * Cross-reference rule provenance citations against the source registry.
 * Finds orphaned citations (not in registry) and superseded references.
 */
export function validateProvenance(
  packs: PolicyPack[],
  sources: SourceEntry[],
): ProvenanceValidationResult[] {
  const sourceMap = new Map<string, SourceEntry>();
  for (const s of sources) {
    sourceMap.set(s.source_id, s);
  }

  const results: ProvenanceValidationResult[] = [];

  for (const pack of packs) {
    for (const rule of pack.rules) {
      if (!rule.provenance) continue;

      const result = validateSingleProvenance(rule.rule_id, rule.provenance, sourceMap);
      if (result.issues.length > 0) {
        results.push(result);
      }

      // Check additional_sources too
      if (rule.provenance.additional_sources) {
        for (const addl of rule.provenance.additional_sources) {
          const addlResult = validateSingleProvenance(
            `${rule.rule_id}[additional]`,
            addl as unknown as RuleProvenance,
            sourceMap,
          );
          if (addlResult.issues.length > 0) {
            results.push(addlResult);
          }
        }
      }
    }
  }

  return results;
}

function validateSingleProvenance(
  ruleId: string,
  prov: RuleProvenance,
  sourceMap: Map<string, SourceEntry>,
): ProvenanceValidationResult {
  const citation = prov.citation;
  const issues: string[] = [];
  let matchedSourceId: string | null = null;

  // Try exact match on citation against source_id
  if (sourceMap.has(citation)) {
    matchedSourceId = citation;
  } else {
    // Try fuzzy match: citation might be a DOI, title fragment, or source_id prefix
    for (const [id, entry] of sourceMap) {
      if (
        citation === id ||
        (prov.doi && prov.doi === entry.doi) ||
        (prov.source_url && prov.source_url === entry.url)
      ) {
        matchedSourceId = id;
        break;
      }
    }
  }

  if (!matchedSourceId) {
    // internal_policy citations don't need to be in the registry
    if (prov.source_type !== 'internal_policy') {
      issues.push(`Citation '${citation}' not found in source registry`);
    }
  } else {
    // biome-ignore lint/style/noNonNullAssertion: matchedSourceId is always in sourceMap when non-null
    const source = sourceMap.get(matchedSourceId)!;
    if (source.review_status === 'superseded') {
      issues.push(
        `Citation '${citation}' references superseded source '${matchedSourceId}'` +
          (source.superseded_by ? ` (superseded by '${source.superseded_by}')` : ''),
      );
    }
    if (source.review_status === 'retired') {
      issues.push(`Citation '${citation}' references retired source '${matchedSourceId}'`);
    }
  }

  return { rule_id: ruleId, citation, matched_source_id: matchedSourceId, issues };
}

// =============================================================================
// Full Validation Report
// =============================================================================

/**
 * Generate a full validation report: source stats, review alerts, provenance issues.
 */
export function generateValidationReport(
  sources: SourceEntry[],
  packs: PolicyPack[],
  asOf?: Date,
): RegistryValidationReport {
  const active = sources.filter((s) => s.review_status === 'active').length;
  const superseded = sources.filter((s) => s.review_status === 'superseded').length;
  const reviewAlerts = checkReviewAlerts(sources, 30, 90, asOf);
  const provenanceResults = validateProvenance(packs, sources);

  return {
    total_sources: sources.length,
    active_sources: active,
    superseded_sources: superseded,
    review_alerts: reviewAlerts,
    orphaned_citations: provenanceResults.filter((r) => !r.matched_source_id),
    superseded_references: provenanceResults.filter(
      (r) =>
        r.matched_source_id &&
        r.issues.some((i) => i.includes('superseded') || i.includes('retired')),
    ),
  };
}

// =============================================================================
// Error
// =============================================================================

export class SourceRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceRegistryError';
  }
}
