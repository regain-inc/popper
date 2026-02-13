/**
 * Conformance Test Fixtures
 *
 * Canonical test data from CC-v2 spec section 6.
 * Used by Phase 6 integration and conformance tests.
 *
 * @module control-v2/fixtures
 */

export {
  atomicRejectionCommand,
  atomicRejectionExpectedAuditEvents,
  atomicRejectionExpectedResponse,
} from './atomic-rejection.fixture';
export {
  coreSettingsCommand,
  coreSettingsExpectedAuditEvents,
  coreSettingsExpectedResponse,
} from './core-settings.fixture';
export {
  emergencyModeCommand,
  emergencyModeExpectedAuditEvents,
  emergencyModeExpectedResponse,
  emergencyModeMaxRoundTripMs,
} from './emergency-mode.fixture';
