import { describe, expect, test } from 'bun:test';
import { auditEvents, driftBaselines, organizations, safeModeHistory } from './schema';

describe('db schemas', () => {
  describe('audit_events', () => {
    test('has composite primary key with partition column', () => {
      expect(auditEvents.organizationId).toBeDefined();
      expect(auditEvents.createdAt).toBeDefined();
      expect(auditEvents.id).toBeDefined();
    });

    test('has required fields for supervision decisions', () => {
      expect(auditEvents.traceId).toBeDefined();
      expect(auditEvents.eventType).toBeDefined();
      expect(auditEvents.subjectId).toBeDefined();
      expect(auditEvents.decision).toBeDefined();
      expect(auditEvents.reasonCodes).toBeDefined();
      expect(auditEvents.policyPackVersion).toBeDefined();
      expect(auditEvents.safeModeActive).toBeDefined();
    });

    test('has metrics for drift monitoring', () => {
      expect(auditEvents.latencyMs).toBeDefined();
      expect(auditEvents.proposalCount).toBeDefined();
    });
  });

  describe('drift_baselines', () => {
    test('has composite primary key with partition column', () => {
      expect(driftBaselines.organizationId).toBeDefined();
      expect(driftBaselines.calculatedAt).toBeDefined();
      expect(driftBaselines.signalName).toBeDefined();
    });

    test('has threshold fields', () => {
      expect(driftBaselines.baselineValue).toBeDefined();
      expect(driftBaselines.warningThreshold).toBeDefined();
      expect(driftBaselines.criticalThreshold).toBeDefined();
      expect(driftBaselines.sampleCount).toBeDefined();
    });
  });

  describe('safe_mode_history', () => {
    test('has composite primary key with partition column', () => {
      expect(safeModeHistory.organizationId).toBeDefined();
      expect(safeModeHistory.createdAt).toBeDefined();
      expect(safeModeHistory.id).toBeDefined();
    });

    test('has safe mode state fields', () => {
      expect(safeModeHistory.enabled).toBeDefined();
      expect(safeModeHistory.reason).toBeDefined();
      expect(safeModeHistory.triggeredBy).toBeDefined();
      expect(safeModeHistory.effectiveAt).toBeDefined();
    });
  });

  describe('organizations', () => {
    test('has primary key', () => {
      expect(organizations.id).toBeDefined();
    });

    test('has required configuration fields', () => {
      expect(organizations.name).toBeDefined();
      expect(organizations.allowedModes).toBeDefined();
      expect(organizations.rateLimitPerMinute).toBeDefined();
      expect(organizations.rateLimitPerHour).toBeDefined();
      expect(organizations.defaultPolicyPack).toBeDefined();
      expect(organizations.isActive).toBeDefined();
    });

    test('has staleness override fields', () => {
      expect(organizations.stalenessWellnessHours).toBeDefined();
      expect(organizations.stalenessClinicalHours).toBeDefined();
    });

    test('has timestamp fields', () => {
      expect(organizations.createdAt).toBeDefined();
      expect(organizations.updatedAt).toBeDefined();
    });

    test('has metadata field', () => {
      expect(organizations.metadata).toBeDefined();
    });
  });
});
