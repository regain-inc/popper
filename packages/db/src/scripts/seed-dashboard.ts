/**
 * Seed script for populating dashboard with test data
 *
 * Creates:
 * - 200+ audit events (spread over 7 days, various types and decisions)
 * - 5 incidents (different statuses and types)
 * - 6 safe mode history entries
 *
 * Usage:
 *   bun run src/scripts/seed-dashboard.ts
 */

import { createDB } from '../db';
import { auditEvents } from '../schema/audit-events';
import { incidents } from '../schema/incidents';
import { safeModeHistory } from '../schema/safe-mode-history';

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/popper';

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const SYSTEM_ORG_ID = '00000000-0000-0000-0000-000000000000';

function randomId(): string {
  return crypto.randomUUID();
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function randomFloat(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 1000) / 1000;
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate audit events spread over 7 days
 * Weighted: 70% APPROVED, 10% ROUTE_TO_CLINICIAN, 5% HARD_STOP, 5% REQUEST_MORE_INFO, 10% VALIDATION_FAILED
 */
function generateAuditEvents() {
  const events = [];
  const totalHours = 7 * 24; // 7 days

  for (let h = 0; h < totalHours; h++) {
    // 2-5 events per hour
    const count = Math.floor(Math.random() * 4) + 2;

    for (let i = 0; i < count; i++) {
      const minuteOffset = Math.floor(Math.random() * 60);
      const createdAt = new Date(
        Date.now() - (totalHours - h) * 60 * 60 * 1000 + minuteOffset * 60 * 1000,
      );
      const roll = Math.random();

      let eventType: string;
      let decision: string | null;
      let reasonCodes: string[];

      if (roll < 0.1) {
        // 10% validation failures
        eventType = 'VALIDATION_FAILED';
        decision = null;
        reasonCodes = [
          pickRandom(['schema_invalid', 'missing_field', 'type_mismatch', 'stale_data']),
        ];
      } else if (roll < 0.15) {
        // 5% HARD_STOP
        eventType = 'SUPERVISION_DECISION';
        decision = 'HARD_STOP';
        reasonCodes = [
          pickRandom(['unsafe_dosage', 'contraindication', 'blackbox_warning', 'schema_invalid']),
        ];
      } else if (roll < 0.25) {
        // 10% ROUTE_TO_CLINICIAN
        eventType = 'SUPERVISION_DECISION';
        decision = 'ROUTE_TO_CLINICIAN';
        reasonCodes = [
          pickRandom([
            'high_uncertainty',
            'complex_case',
            'medication_interaction',
            'pediatric_patient',
          ]),
        ];
      } else if (roll < 0.3) {
        // 5% REQUEST_MORE_INFO
        eventType = 'SUPERVISION_DECISION';
        decision = 'REQUEST_MORE_INFO';
        reasonCodes = [
          pickRandom(['missing_allergy_info', 'incomplete_history', 'ambiguous_dosage']),
        ];
      } else {
        // 70% APPROVED
        eventType = 'SUPERVISION_DECISION';
        decision = 'APPROVED';
        reasonCodes = [];
      }

      events.push({
        organizationId: ORG_ID,
        createdAt,
        id: `evt_${randomId().replace(/-/g, '').slice(0, 12)}_${h}_${i}`,
        traceId: `tr_${randomId().replace(/-/g, '').slice(0, 16)}`,
        eventType,
        subjectId: `patient_${String(Math.floor(Math.random() * 500)).padStart(3, '0')}`,
        decision,
        reasonCodes,
        policyPackVersion: '1.0.0',
        safeModeActive: false,
        latencyMs: randomFloat(5, 150),
        proposalCount: Math.floor(Math.random() * 3) + 1,
        payload: {
          mode: pickRandom(['wellness', 'advocate_clinical']),
        },
        tags: decision ? [decision, eventType] : [eventType],
      });
    }
  }

  return events;
}

function generateIncidents() {
  return [
    {
      organizationId: ORG_ID,
      type: 'drift_threshold_breach',
      status: 'open',
      triggerSignal: 'validation_failure_rate',
      triggerLevel: 'critical',
      triggerValue: '0.18',
      thresholdValue: '0.10',
      baselineValue: '0.03',
      title: 'Critical: validation_failure_rate exceeded threshold',
      description:
        'Validation failure rate spiked to 18%, exceeding critical threshold of 10%. Automatic safe-mode enabled.',
      safeModeEnabled: hoursAgo(2),
      cooldownUntil: new Date(Date.now() + 30 * 60 * 1000),
      createdAt: hoursAgo(2),
      updatedAt: hoursAgo(2),
    },
    {
      organizationId: ORG_ID,
      type: 'drift_threshold_breach',
      status: 'acknowledged',
      triggerSignal: 'hard_stop_rate',
      triggerLevel: 'warning',
      triggerValue: '0.09',
      thresholdValue: '0.08',
      baselineValue: '0.03',
      title: 'Warning: hard_stop_rate approaching critical threshold',
      description: 'Hard stop rate increased to 9%, exceeding warning threshold of 8%.',
      createdAt: hoursAgo(12),
      updatedAt: hoursAgo(6),
    },
    {
      organizationId: ORG_ID,
      type: 'manual',
      status: 'resolved',
      title: 'Scheduled maintenance window',
      description: 'Safe-mode enabled for scheduled system maintenance and policy update.',
      safeModeEnabled: hoursAgo(48),
      resolvedAt: hoursAgo(46),
      resolutionNotes: 'Maintenance completed. Policy v1.1.0 deployed. All systems operational.',
      createdAt: hoursAgo(48),
      updatedAt: hoursAgo(46),
    },
    {
      organizationId: ORG_ID,
      type: 'drift_threshold_breach',
      status: 'resolved',
      triggerSignal: 'policy_violation_rate',
      triggerLevel: 'critical',
      triggerValue: '0.12',
      thresholdValue: '0.10',
      baselineValue: '0.02',
      title: 'Critical: policy_violation_rate exceeded threshold',
      description:
        'Policy violation rate spiked after new model deployment. Reverted model and resolved.',
      safeModeEnabled: hoursAgo(96),
      resolvedAt: hoursAgo(94),
      resolutionNotes: 'Root cause: new model v2.3 had unexpected behavior. Reverted to v2.2.',
      createdAt: hoursAgo(96),
      updatedAt: hoursAgo(94),
    },
    {
      organizationId: ORG_ID,
      type: 'model_update',
      status: 'resolved',
      title: 'Model update: LLM v2.2 → v2.3',
      description: 'Proactive safe-mode enabled during model transition. Monitoring for drift.',
      safeModeEnabled: hoursAgo(120),
      resolvedAt: hoursAgo(118),
      resolutionNotes: 'Model update verified. No drift detected in 2-hour observation window.',
      createdAt: hoursAgo(120),
      updatedAt: hoursAgo(118),
    },
  ];
}

function generateSafeModeHistory() {
  return [
    {
      organizationId: SYSTEM_ORG_ID,
      enabled: true,
      reason: 'Critical: validation_failure_rate exceeded threshold (0.18 > 0.10)',
      triggeredBy: 'drift_breach',
      effectiveAt: hoursAgo(2),
      createdAt: hoursAgo(2),
    },
    {
      organizationId: SYSTEM_ORG_ID,
      enabled: false,
      reason: 'Metrics stabilized after investigation',
      triggeredBy: 'manual',
      effectiveAt: hoursAgo(46),
      createdAt: hoursAgo(46),
    },
    {
      organizationId: SYSTEM_ORG_ID,
      enabled: true,
      reason: 'Scheduled maintenance window',
      triggeredBy: 'manual',
      effectiveAt: hoursAgo(48),
      createdAt: hoursAgo(48),
    },
    {
      organizationId: SYSTEM_ORG_ID,
      enabled: false,
      reason: 'Model revert completed, metrics normal',
      triggeredBy: 'manual',
      effectiveAt: hoursAgo(94),
      createdAt: hoursAgo(94),
    },
    {
      organizationId: SYSTEM_ORG_ID,
      enabled: true,
      reason: 'Critical: policy_violation_rate exceeded threshold',
      triggeredBy: 'drift_breach',
      effectiveAt: hoursAgo(96),
      createdAt: hoursAgo(96),
    },
    {
      organizationId: SYSTEM_ORG_ID,
      enabled: true,
      reason: 'Model update v2.2 → v2.3, proactive safe-mode',
      triggeredBy: 'manual',
      effectiveAt: hoursAgo(120),
      createdAt: hoursAgo(120),
    },
  ];
}

async function main() {
  console.log('Connecting to database...');
  const db = createDB(DATABASE_URL);

  // --- Audit events ---
  const events = generateAuditEvents();
  console.log(`Inserting ${events.length} audit events (7 days of data)...`);

  // Insert in batches of 100
  for (let i = 0; i < events.length; i += 100) {
    const batch = events.slice(i, i + 100);
    await db.insert(auditEvents).values(batch);
  }
  console.log(`  ✓ ${events.length} audit events inserted`);

  // Count by decision
  const decisionCounts: Record<string, number> = {};
  for (const e of events) {
    const key = e.decision || e.eventType;
    decisionCounts[key] = (decisionCounts[key] || 0) + 1;
  }
  for (const [k, v] of Object.entries(decisionCounts)) {
    console.log(`    ${k}: ${v}`);
  }

  // --- Incidents ---
  const incidentData = generateIncidents();
  console.log(`\nInserting ${incidentData.length} incidents...`);
  await db.insert(incidents).values(incidentData);
  console.log('  ✓ Incidents inserted');

  // --- Safe mode history ---
  const historyData = generateSafeModeHistory();
  console.log(`\nInserting ${historyData.length} safe mode history entries...`);
  await db.insert(safeModeHistory).values(historyData);
  console.log('  ✓ Safe mode history inserted');

  console.log('\nDone! Dashboard should now show real data.');
  console.log(`Organization ID: ${ORG_ID}`);
  process.exit(0);
}

main().catch((error) => {
  console.error('Error seeding dashboard:', error);
  process.exit(1);
});
