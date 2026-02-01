/**
 * Hermes Contract Tests (Spec §9.1)
 *
 * Validates that the JSON fixtures in docs/specs/03-hermes-specs/fixtures/
 * conform to the Hermes schema. This ensures that our fixture files remain
 * valid as the @regain/hermes schema evolves.
 *
 * @see docs/specs/03-hermes-specs/
 */

import { describe, expect, test } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateHermesMessage } from '@regain/hermes';

// =============================================================================
// Configuration
// =============================================================================

const FIXTURES_DIR = resolve(import.meta.dir, '../../../../docs/specs/03-hermes-specs/fixtures');

/**
 * Fixture files that should pass Hermes schema validation.
 * These are top-level Hermes messages (supervision_request, supervision_response,
 * audit_event, clinician_feedback_event, bias_detection_event).
 *
 * Fixtures that are fragments (snapshot, derived_finding, imaging_study_ref,
 * control_command, cross_domain_conflict, etc.) are not top-level messages
 * and are not validated as standalone Hermes messages.
 */
const HERMES_MESSAGE_FIXTURES = [
  'supervision_request.valid.json',
  'supervision_request.valid.inline_snapshot.json',
  'supervision_request.with_conflicts.json',
  'supervision_request.with_prior_overrides.json',
  'supervision_request.with_unresolved_conflicts.json',
  'supervision_request.with_feedback_metrics.json',
  'supervision_request.multi_domain.json',
  'supervision_response.valid.json',
  'supervision_response.partial_approval.json',
  'audit_event.valid.json',
  'clinician_feedback_event.accepted.json',
  'clinician_feedback_event.rejected.json',
  'clinician_feedback_event.rejected.permanent.json',
  'clinician_feedback_event.modified.json',
  'clinician_feedback_event.deferred.json',
  'clinician_feedback_event.conflict.json',
  'bias_detection_event.json',
];

/**
 * Fragment fixtures that are NOT standalone Hermes messages.
 * These should be valid JSON but won't pass the top-level schema.
 */
const FRAGMENT_FIXTURES = [
  'snapshot.with_imaging.json',
  'snapshot_with_override_history.json',
  'snapshot_with_override_history.conflicts.json',
  'snapshot_with_override_history.handoff.json',
  'snapshot_with_override_history.alert_fatigue.json',
  'derived_finding.nodule_classification.json',
  'derived_finding.lvef.json',
  'imaging_study_ref.cardiac_mri.json',
  'control_command.valid.json',
  'cross_domain_conflict.valid.json',
];

// =============================================================================
// Tests
// =============================================================================

describe('Hermes Contract Tests', () => {
  describe('Message fixtures pass schema validation', () => {
    for (const fixture of HERMES_MESSAGE_FIXTURES) {
      test(`${fixture} is valid Hermes message`, async () => {
        const filePath = resolve(FIXTURES_DIR, fixture);
        const content = await readFile(filePath, 'utf-8');
        const message = JSON.parse(content);

        const result = validateHermesMessage(message);

        expect(result.valid).toBe(true);
        if (!result.valid) {
          // Show errors for debugging if assertion fails
          console.error(`Validation errors for ${fixture}:`, result.errors);
        }
      });
    }
  });

  describe('Fragment fixtures are valid JSON', () => {
    for (const fixture of FRAGMENT_FIXTURES) {
      test(`${fixture} is valid JSON`, async () => {
        const filePath = resolve(FIXTURES_DIR, fixture);
        const content = await readFile(filePath, 'utf-8');

        // Should not throw
        const parsed = JSON.parse(content);
        expect(parsed).toBeDefined();
        expect(typeof parsed).toBe('object');
      });
    }
  });

  describe('All fixture files are accounted for', () => {
    test('no unaccounted fixture files exist', async () => {
      const allFiles = await readdir(FIXTURES_DIR);
      const jsonFiles = allFiles.filter((f) => f.endsWith('.json'));
      const knownFiles = new Set([...HERMES_MESSAGE_FIXTURES, ...FRAGMENT_FIXTURES]);

      const unaccounted = jsonFiles.filter((f) => !knownFiles.has(f));

      if (unaccounted.length > 0) {
        console.warn('Unaccounted fixture files:', unaccounted);
      }

      // All fixture files should be in one of the two lists
      expect(unaccounted).toEqual([]);
    });
  });

  describe('Supervision request fixtures have required structure', () => {
    const REQUEST_FIXTURES = HERMES_MESSAGE_FIXTURES.filter((f) =>
      f.startsWith('supervision_request'),
    );

    for (const fixture of REQUEST_FIXTURES) {
      test(`${fixture} has required supervision request fields`, async () => {
        const filePath = resolve(FIXTURES_DIR, fixture);
        const content = await readFile(filePath, 'utf-8');
        const message = JSON.parse(content);

        expect(message.hermes_version).toBe('1.6.0');
        expect(message.message_type).toBe('supervision_request');
        expect(message.trace).toBeDefined();
        expect(message.trace.trace_id).toBeDefined();
        expect(message.subject).toBeDefined();
        expect(message.proposals).toBeInstanceOf(Array);
        expect(message.proposals.length).toBeGreaterThan(0);
      });
    }
  });

  describe('Supervision response fixtures have required structure', () => {
    const RESPONSE_FIXTURES = HERMES_MESSAGE_FIXTURES.filter((f) =>
      f.startsWith('supervision_response'),
    );

    for (const fixture of RESPONSE_FIXTURES) {
      test(`${fixture} has required supervision response fields`, async () => {
        const filePath = resolve(FIXTURES_DIR, fixture);
        const content = await readFile(filePath, 'utf-8');
        const message = JSON.parse(content);

        expect(message.hermes_version).toBe('1.6.0');
        expect(message.message_type).toBe('supervision_response');
        expect(message.decision).toBeDefined();
        expect(['APPROVED', 'REQUEST_MORE_INFO', 'ROUTE_TO_CLINICIAN', 'HARD_STOP']).toContain(
          message.decision,
        );
        expect(message.reason_codes).toBeInstanceOf(Array);
      });
    }
  });
});
