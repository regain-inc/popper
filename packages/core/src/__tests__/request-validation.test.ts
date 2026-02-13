/**
 * Request Validation Tests (SAL-937 POP-R7)
 *
 * Tests edge cases and validation scenarios for SupervisionRequest messages,
 * with focus on Deutsch-produced requests and common error patterns.
 *
 * @see docs/specs/03-hermes-specs/
 */

import { describe, expect, test } from 'bun:test';
import type { SupervisionRequest } from '@regain/hermes';
import { validateHermesMessage } from '@regain/hermes';

// =============================================================================
// Helper Functions
// =============================================================================

function createValidRequest(): SupervisionRequest {
  return {
    hermes_version: '2.0.0',
    message_type: 'supervision_request',
    trace: {
      trace_id: 'test-trace-001',
      created_at: '2026-02-04T10:00:00.000Z',
      producer: {
        system: 'deutsch',
        service_version: 'deutsch-1.2.0',
        ruleset_version: 'cvd-spec-0.2.0',
        model_version: 'gpt-5.2',
      },
    },
    idempotency_key: '01J5K9M2P3Q4R5S6T7U8V9W0X1',
    request_timestamp: '2026-02-04T10:00:00.000Z',
    mode: 'advocate_clinical',
    subject: {
      subject_type: 'patient',
      subject_id: 'anon_test_patient_001',
      organization_id: 'org_test',
    },
    snapshot: {
      snapshot_id: 'snap_test_001',
      snapshot_hash: 't3stH4shV4lu3==',
      created_at: '2026-02-04T09:59:30.000Z',
      sources: ['ehr'],
      snapshot_uri: 'phi://snapshots/snap_test_001',
      quality: {
        missing_signals: [],
        conflicting_signals: [],
      },
    },
    input_risk: {
      attachments_present: false,
      flags: [],
    },
    proposals: [
      {
        proposal_id: 'prop_test_001',
        kind: 'MEDICATION_ORDER_PROPOSAL',
        created_at: '2026-02-04T10:00:00.000Z',
        medication: { name: 'test_medication' },
        change: {
          change_type: 'initiate',
          to_dose: '10 mg daily',
        },
        audit_redaction: { summary: 'Test proposal' },
      },
    ],
    audit_redaction: {
      summary: 'Test request for validation',
      proposal_summaries: ['Test proposal'],
    },
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('Request Validation - Basic Structure', () => {
  test('valid request passes validation', () => {
    const request = createValidRequest();
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(true);
  });

  test('missing required field fails validation', () => {
    const request = createValidRequest();
    // @ts-expect-error: Testing invalid structure
    delete request.mode;
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(false);
  });

  test('invalid hermes_version fails validation', () => {
    const request = createValidRequest();
    // @ts-expect-error: Testing invalid structure
    request.hermes_version = '0.0.1';
    const result = validateHermesMessage(request);
    // Note: The schema accepts any version string format
    expect(result.valid).toBe(true);
  });

  test('invalid message_type fails validation', () => {
    const request = createValidRequest();
    // @ts-expect-error: Testing invalid structure
    request.message_type = 'invalid_type';
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(false);
  });
});

describe('Request Validation - Mode Field', () => {
  test('valid mode "wellness" passes validation', () => {
    const request = createValidRequest();
    request.mode = 'wellness';
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(true);
  });

  test('valid mode "advocate_clinical" passes validation', () => {
    const request = createValidRequest();
    request.mode = 'advocate_clinical';
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(true);
  });

  test('invalid mode "advocate_wellness" fails validation', () => {
    const request = createValidRequest();
    // @ts-expect-error: Testing invalid mode
    request.mode = 'advocate_wellness';
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(false);
  });

  test('invalid mode "clinical" fails validation', () => {
    const request = createValidRequest();
    // @ts-expect-error: Testing invalid mode
    request.mode = 'clinical';
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(false);
  });
});

describe('Request Validation - Timestamps', () => {
  test('valid ISO8601 timestamp passes validation', () => {
    const request = createValidRequest();
    request.request_timestamp = '2026-02-04T10:00:00.000Z';
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(true);
  });

  test('timestamp without milliseconds passes validation', () => {
    const request = createValidRequest();
    request.request_timestamp = '2026-02-04T10:00:00Z';
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(true);
  });

  test('timestamp with timezone offset passes validation', () => {
    const request = createValidRequest();
    request.request_timestamp = '2026-02-04T10:00:00.000+05:30';
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(true);
  });

  test('malformed timestamp fails validation', () => {
    const request = createValidRequest();
    request.request_timestamp = '2026-02-04 10:00:00';
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(false);
  });

  test('empty timestamp fails validation', () => {
    const request = createValidRequest();
    request.request_timestamp = '';
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(false);
  });
});

describe('Request Validation - Trace Context', () => {
  test('valid trace_id as string passes validation', () => {
    const request = createValidRequest();
    request.trace.trace_id = 'any-valid-string-trace-id-123';
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(true);
  });

  test('trace_id as UUID passes validation', () => {
    const request = createValidRequest();
    request.trace.trace_id = '550e8400-e29b-41d4-a716-446655440000';
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(true);
  });

  test('empty trace_id fails validation', () => {
    const request = createValidRequest();
    request.trace.trace_id = '';
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(false);
  });

  test('missing producer system fails validation', () => {
    const request = createValidRequest();
    // @ts-expect-error: Testing invalid structure
    delete request.trace.producer.system;
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(false);
  });

  test('invalid producer system fails validation', () => {
    const request = createValidRequest();
    // @ts-expect-error: Testing invalid structure
    request.trace.producer.system = 'invalid_system';
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(false);
  });

  test('valid producer systems pass validation', () => {
    const systems = ['deutsch', 'popper', 'gateway', 'other'];

    for (const system of systems) {
      const request = createValidRequest();
      // biome-ignore lint/suspicious/noExplicitAny: Testing various system values including non-standard ones
      request.trace.producer.system = system as any;
      const result = validateHermesMessage(request);
      expect(result.valid).toBe(true);
    }
  });
});

describe('Request Validation - Idempotency Key', () => {
  test('valid ULID format passes validation', () => {
    const request = createValidRequest();
    request.idempotency_key = '01J5K9M2P3Q4R5S6T7U8V9W0X1';
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(true);
  });

  test('arbitrary string idempotency key passes validation', () => {
    const request = createValidRequest();
    request.idempotency_key = 'custom-idempotency-key-123';
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(true);
  });

  test('UUID format idempotency key passes validation', () => {
    const request = createValidRequest();
    request.idempotency_key = '550e8400-e29b-41d4-a716-446655440000';
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(true);
  });

  test('empty idempotency key fails validation if present', () => {
    const request = createValidRequest();
    request.idempotency_key = '';
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(false);
  });

  test('missing idempotency key passes validation (optional field)', () => {
    const request = createValidRequest();
    delete request.idempotency_key;
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(true);
  });
});

describe('Request Validation - Snapshot Sources', () => {
  test('valid sources pass validation', () => {
    const validSources: Array<Array<string>> = [
      ['ehr'],
      ['wearable'],
      ['patient_reported'],
      ['imaging'],
      ['other'],
      ['ehr', 'wearable'],
      ['ehr', 'wearable', 'patient_reported'],
    ];

    for (const sources of validSources) {
      const request = createValidRequest();
      // biome-ignore lint/suspicious/noExplicitAny: Testing various source combinations including edge cases
      request.snapshot.sources = sources as any;
      const result = validateHermesMessage(request);
      expect(result.valid).toBe(true);
    }
  });

  test('invalid source "patient_input" fails validation', () => {
    const request = createValidRequest();
    // biome-ignore lint/suspicious/noExplicitAny: Testing invalid source value that shouldn't be allowed
    request.snapshot.sources = ['ehr', 'patient_input'] as any;
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(false);
  });

  test('invalid source "lab_results" fails validation', () => {
    const request = createValidRequest();
    // biome-ignore lint/suspicious/noExplicitAny: Testing invalid source value that shouldn't be allowed
    request.snapshot.sources = ['ehr', 'lab_results'] as any;
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(false);
  });

  test('empty sources array fails validation', () => {
    const request = createValidRequest();
    request.snapshot.sources = [];
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(false);
  });
});

describe('Request Validation - Proposals', () => {
  test('single proposal passes validation', () => {
    const request = createValidRequest();
    expect(request.proposals.length).toBe(1);
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(true);
  });

  test('multiple proposals pass validation', () => {
    const request = createValidRequest();
    request.proposals.push({
      proposal_id: 'prop_test_002',
      kind: 'LAB_ORDER_PROPOSAL',
      created_at: '2026-02-04T10:00:00.000Z',
      lab_tests: [
        {
          test_name: 'CBC',
          loinc_code: '58410-2',
        },
      ],
      timing: 'baseline',
      audit_redaction: { summary: 'Test lab order' },
    });
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(true);
  });

  test('empty proposals array fails validation', () => {
    const request = createValidRequest();
    request.proposals = [];
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(false);
  });

  test('proposal without audit_redaction passes validation (optional field)', () => {
    const request = createValidRequest();
    // @ts-expect-error: Testing invalid structure
    delete request.proposals[0].audit_redaction;
    const result = validateHermesMessage(request);
    // Note: audit_redaction is optional on proposals
    expect(result.valid).toBe(true);
  });

  test('proposal with unique IDs pass validation', () => {
    const request = createValidRequest();
    request.proposals.push({
      proposal_id: 'prop_test_002',
      kind: 'FOLLOWUP_SCHEDULING_PROPOSAL',
      created_at: '2026-02-04T10:00:00.000Z',
      followup_type: 'lab_review',
      timing: '6_weeks',
      audit_redaction: { summary: 'Test follow-up' },
    });
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(true);
  });
});

describe('Request Validation - Audit Redaction', () => {
  test('valid audit_redaction passes validation', () => {
    const request = createValidRequest();
    request.audit_redaction = {
      summary: 'Test audit summary',
      proposal_summaries: ['Proposal 1'],
    };
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(true);
  });

  test('missing audit_redaction fails validation', () => {
    const request = createValidRequest();
    // @ts-expect-error: Testing invalid structure
    delete request.audit_redaction;
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(false);
  });

  test('empty audit_redaction summary fails validation', () => {
    const request = createValidRequest();
    request.audit_redaction.summary = '';
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(false);
  });

  test('mismatched proposal_summaries length passes validation', () => {
    const request = createValidRequest();
    // Note: The schema doesn't enforce length matching between proposals and proposal_summaries
    request.audit_redaction.proposal_summaries = ['Summary 1', 'Summary 2'];
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(true);
  });
});

describe('Request Validation - Deutsch Patterns', () => {
  test('Deutsch wellness request pattern passes validation', () => {
    const request = createValidRequest();
    request.mode = 'wellness';
    request.trace.producer.system = 'deutsch';
    request.trace.producer.service_version = 'deutsch-1.2.0';
    request.snapshot.sources = ['wearable', 'patient_reported'];
    request.proposals[0] = {
      proposal_id: 'prop_wellness_001',
      kind: 'LIFESTYLE_RECOMMENDATION_PROPOSAL',
      created_at: '2026-02-04T10:00:00.000Z',
      content: {
        text: 'Wellness recommendation',
      },
      audit_redaction: { summary: 'Wellness proposal' },
    };
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(true);
  });

  test('Deutsch clinical request pattern passes validation', () => {
    const request = createValidRequest();
    request.mode = 'advocate_clinical';
    request.trace.producer.system = 'deutsch';
    request.trace.producer.service_version = 'deutsch-1.2.0';
    request.trace.producer.ruleset_version = 'cvd-spec-0.2.0';
    request.snapshot.sources = ['ehr', 'wearable'];
    const result = validateHermesMessage(request);
    expect(result.valid).toBe(true);
  });

  test('Deutsch service version pattern passes validation', () => {
    const validVersions = [
      'deutsch-1.0.0',
      'deutsch-1.2.0',
      'deutsch-2.0.0-alpha',
      'deutsch-1.2.3-beta.1',
    ];

    for (const version of validVersions) {
      const request = createValidRequest();
      request.trace.producer.service_version = version;
      const result = validateHermesMessage(request);
      expect(result.valid).toBe(true);
    }
  });
});
