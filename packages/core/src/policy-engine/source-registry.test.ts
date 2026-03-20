// biome-ignore-all lint/suspicious/noThenProperty: Safety DSL uses 'then' as rule action clause per spec
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import type { SourceEntry } from './source-registry';
import {
  checkReviewAlerts,
  generateValidationReport,
  loadSourceRegistry,
  SourceRegistryError,
  validateProvenance,
} from './source-registry';
import type { PolicyPack } from './types';

// =============================================================================
// loadSourceRegistry
// =============================================================================

describe('loadSourceRegistry', () => {
  test('loads real registry.yaml', async () => {
    const registryPath = join(import.meta.dir, '../../../../config/sources/registry.yaml');
    const sources = await loadSourceRegistry(registryPath);
    expect(sources.length).toBeGreaterThan(0);
    expect(sources[0].source_id).toBeDefined();
    expect(sources[0].title).toBeDefined();
    expect(sources[0].review_status).toBeDefined();
  });

  test('rejects file without sources array', async () => {
    // Write a temp file with bad content
    const tmpPath = '/tmp/bad-registry.yaml';
    await Bun.write(tmpPath, 'not_sources: []');
    await expect(loadSourceRegistry(tmpPath)).rejects.toThrow(SourceRegistryError);
  });
});

// =============================================================================
// checkReviewAlerts
// =============================================================================

describe('checkReviewAlerts', () => {
  const baseSource: SourceEntry = {
    source_id: 'test-source',
    title: 'Test Source',
    type: 'society_guideline',
    issuing_body: 'Test Body',
    review_status: 'active',
    last_reviewed: '2026-01-01',
  };

  test('flags overdue reviews', () => {
    const sources: SourceEntry[] = [{ ...baseSource, next_review_due: '2026-01-01' }];
    const alerts = checkReviewAlerts(sources, 30, 90, new Date('2026-03-20'));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].status).toBe('overdue');
    expect(alerts[0].days_until_due).toBeLessThan(0);
  });

  test('flags due_soon reviews', () => {
    const sources: SourceEntry[] = [{ ...baseSource, next_review_due: '2026-04-10' }];
    const alerts = checkReviewAlerts(sources, 30, 90, new Date('2026-03-20'));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].status).toBe('due_soon');
  });

  test('flags upcoming reviews within 90 days', () => {
    const sources: SourceEntry[] = [{ ...baseSource, next_review_due: '2026-05-20' }];
    const alerts = checkReviewAlerts(sources, 30, 90, new Date('2026-03-20'));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].status).toBe('upcoming');
  });

  test('ignores reviews beyond threshold', () => {
    const sources: SourceEntry[] = [{ ...baseSource, next_review_due: '2027-03-19' }];
    const alerts = checkReviewAlerts(sources, 30, 90, new Date('2026-03-20'));
    expect(alerts).toHaveLength(0);
  });

  test('ignores superseded sources', () => {
    const sources: SourceEntry[] = [
      { ...baseSource, review_status: 'superseded', next_review_due: '2025-01-01' },
    ];
    const alerts = checkReviewAlerts(sources, 30, 90, new Date('2026-03-20'));
    expect(alerts).toHaveLength(0);
  });

  test('sorts by days_until_due ascending', () => {
    const sources: SourceEntry[] = [
      { ...baseSource, source_id: 'b', next_review_due: '2026-04-10' },
      { ...baseSource, source_id: 'a', next_review_due: '2026-01-01' },
      { ...baseSource, source_id: 'c', next_review_due: '2026-05-15' },
    ];
    const alerts = checkReviewAlerts(sources, 30, 90, new Date('2026-03-20'));
    expect(alerts[0].source_id).toBe('a'); // overdue, most negative
    expect(alerts[1].source_id).toBe('b'); // due_soon
    expect(alerts[2].source_id).toBe('c'); // upcoming
  });
});

// =============================================================================
// validateProvenance
// =============================================================================

describe('validateProvenance', () => {
  const sources: SourceEntry[] = [
    {
      source_id: 'aha-acc-hfsa-hf-2022',
      title: 'HF Guideline',
      type: 'society_guideline',
      issuing_body: 'AHA/ACC/HFSA',
      review_status: 'active',
    },
    {
      source_id: 'acc-aha-htn-2017',
      title: 'Old HTN Guideline',
      type: 'society_guideline',
      issuing_body: 'ACC/AHA',
      review_status: 'superseded',
      superseded_by: 'aha-acc-htn-2025',
    },
  ];

  test('no issues for citation matching active source', () => {
    const pack: PolicyPack = {
      policy_id: 'test',
      policy_version: '1.0',
      rules: [
        {
          rule_id: 'r1',
          description: 'test',
          priority: 100,
          provenance: {
            source_type: 'society_guideline',
            source_layer: 2,
            citation: 'aha-acc-hfsa-hf-2022',
            evidence_grade: 'systematic_review',
            jurisdiction: 'US',
            clinical_domain: 'cardiology',
            approved_by: 'test',
            effective_date: '2026-01-01',
            review_interval_days: 365,
            review_due: '2027-01-01',
          },
          when: { kind: 'always' },
          then: { decision: 'APPROVED', reason_codes: [], explanation: 'test' },
        },
      ],
    };
    const results = validateProvenance([pack], sources);
    expect(results).toHaveLength(0);
  });

  test('flags citation referencing superseded source', () => {
    const pack: PolicyPack = {
      policy_id: 'test',
      policy_version: '1.0',
      rules: [
        {
          rule_id: 'r1',
          description: 'test',
          priority: 100,
          provenance: {
            source_type: 'society_guideline',
            source_layer: 2,
            citation: 'acc-aha-htn-2017',
            evidence_grade: 'systematic_review',
            jurisdiction: 'US',
            clinical_domain: 'cardiology',
            approved_by: 'test',
            effective_date: '2026-01-01',
            review_interval_days: 365,
            review_due: '2027-01-01',
          },
          when: { kind: 'always' },
          then: { decision: 'APPROVED', reason_codes: [], explanation: 'test' },
        },
      ],
    };
    const results = validateProvenance([pack], sources);
    expect(results).toHaveLength(1);
    expect(results[0].issues[0]).toContain('superseded');
  });

  test('flags orphaned citation not in registry', () => {
    const pack: PolicyPack = {
      policy_id: 'test',
      policy_version: '1.0',
      rules: [
        {
          rule_id: 'r1',
          description: 'test',
          priority: 100,
          provenance: {
            source_type: 'society_guideline',
            source_layer: 2,
            citation: 'nonexistent-guideline-2099',
            evidence_grade: 'systematic_review',
            jurisdiction: 'US',
            clinical_domain: 'cardiology',
            approved_by: 'test',
            effective_date: '2026-01-01',
            review_interval_days: 365,
            review_due: '2027-01-01',
          },
          when: { kind: 'always' },
          then: { decision: 'APPROVED', reason_codes: [], explanation: 'test' },
        },
      ],
    };
    const results = validateProvenance([pack], sources);
    expect(results).toHaveLength(1);
    expect(results[0].matched_source_id).toBeNull();
    expect(results[0].issues[0]).toContain('not found');
  });

  test('skips internal_policy citations', () => {
    const pack: PolicyPack = {
      policy_id: 'test',
      policy_version: '1.0',
      rules: [
        {
          rule_id: 'r1',
          description: 'test',
          priority: 100,
          provenance: {
            source_type: 'internal_policy',
            source_layer: 5,
            citation: 'some-internal-rule',
            evidence_grade: 'expert_opinion',
            jurisdiction: 'internal',
            clinical_domain: 'safety',
            approved_by: 'test',
            effective_date: '2026-01-01',
            review_interval_days: 365,
            review_due: '2027-01-01',
          },
          when: { kind: 'always' },
          then: { decision: 'APPROVED', reason_codes: [], explanation: 'test' },
        },
      ],
    };
    const results = validateProvenance([pack], sources);
    expect(results).toHaveLength(0);
  });
});

// =============================================================================
// generateValidationReport
// =============================================================================

describe('generateValidationReport', () => {
  test('produces complete report', () => {
    const sources: SourceEntry[] = [
      {
        source_id: 'active-1',
        title: 'Active',
        type: 'society_guideline',
        issuing_body: 'Test',
        review_status: 'active',
        next_review_due: '2026-04-01',
      },
      {
        source_id: 'superseded-1',
        title: 'Superseded',
        type: 'society_guideline',
        issuing_body: 'Test',
        review_status: 'superseded',
      },
    ];
    const report = generateValidationReport(sources, [], new Date('2026-03-20'));
    expect(report.total_sources).toBe(2);
    expect(report.active_sources).toBe(1);
    expect(report.superseded_sources).toBe(1);
    expect(report.review_alerts).toHaveLength(1);
    expect(report.review_alerts[0].status).toBe('due_soon');
  });
});
