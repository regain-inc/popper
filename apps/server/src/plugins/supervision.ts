/**
 * Supervision API endpoint plugin
 * POST /v1/popper/supervise - Main supervision endpoint
 *
 * Protected by API Key authentication with supervision:write scope.
 *
 * @see docs/specs/02-popper-specs/02-popper-contracts-and-interfaces.md §1.1
 * @module plugins/supervision
 */

import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import type { ApiKeyContext } from '@popper/core';
import {
  buildAuditTags,
  buildPerProposalDecisions,
  calculateAllInterventionRisks,
  computeAcuity,
  createDecisionBuilder,
  createEvaluator,
  createStalenessValidator,
  createSupervisionDecisionEvent,
  createValidationFailedEvent,
  type DerivedSignals,
  detectHallucinations,
  type EvaluationContext,
  extractRequestMetadata,
  getDefaultEmitter,
  type InterventionRiskLevel,
  type InterventionRiskScore,
  loadAndComposePacks,
  type PolicyPack,
  type ReasonCode,
  type SupervisionDecision,
  type SupervisionRequest,
  type SupervisionResponse,
  validateHermesMessage,
} from '@popper/core';
import { Elysia, t } from 'elysia';
import { getDriftCounters, isDriftCountersInitialized } from '../lib/drift';
import { getIdempotencyCache } from '../lib/idempotency';
import { logger } from '../lib/logger';
import { getOrganizationService, isOrganizationServiceInitialized } from '../lib/organizations';
import { getSafeModeManager } from '../lib/safe-mode';
import { errorResponseSchema } from '../lib/schemas';
import { supervisionRequestSchema, supervisionResponseSchema } from '../lib/schemas/supervision';
import { getSignalAggregator, isSignalAggregatorInitialized } from '../lib/signal-aggregator';
import { createAuthGuard } from './api-key-auth';
import { createRateLimitGuard } from './rate-limit';

// =============================================================================
// Configuration
// =============================================================================

/** Clock skew tolerance in milliseconds (±5 minutes per spec) */
const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

/** Path to the policies directory (config/policies/ at repo root) */
const POLICIES_DIR = resolve(import.meta.dir, '../../../../config/policies');

/**
 * Cached composed policy pack, loaded once at startup.
 * Contains merged core + domain + site rules with priority validation.
 */
let composedPolicyPack: PolicyPack | null = null;
let composedPolicyPackError: string | null = null;

/**
 * Initialize the composed policy pack from the standard directory layout.
 * Called once at module load time. Loads core pack (or legacy default.yaml)
 * plus all domain packs from config/policies/domains/.
 */
async function initComposedPolicyPack(): Promise<void> {
  try {
    composedPolicyPack = await loadAndComposePacks(POLICIES_DIR);
    console.log(
      `[supervision] Composed policy pack loaded: ${composedPolicyPack.policy_id} ` +
        `(${composedPolicyPack.rules.length} rules, version: ${composedPolicyPack.policy_version})`,
    );
  } catch (error) {
    composedPolicyPackError = error instanceof Error ? error.message : String(error);
    console.error(`[supervision] Failed to load composed policy pack: ${composedPolicyPackError}`);
  }
}

// Kick off pack loading at module init (top-level await)
await initComposedPolicyPack();

/**
 * Get the current composed policy pack info for the dashboard.
 * Returns null if pack failed to load.
 */
export function getComposedPolicyPackInfo(): {
  policy_id: string;
  policy_version: string;
  rules_count: number;
  pack_count: number;
  component_packs: string[];
  loaded_at: string;
} | null {
  if (!composedPolicyPack) return null;

  // Parse component pack names from the composed policy_id
  // Format: "composed:pack1+pack2+pack3" or just "pack-name" if single pack
  const id = composedPolicyPack.policy_id;
  const componentPacks = id.startsWith('composed:')
    ? id.slice('composed:'.length).split('+')
    : [id];

  return {
    policy_id: composedPolicyPack.policy_id,
    policy_version: composedPolicyPack.policy_version,
    rules_count: composedPolicyPack.rules.length,
    pack_count: componentPacks.length,
    component_packs: componentPacks,
    loaded_at: new Date().toISOString(), // approximate — could track actual load time
  };
}

/** Get the composed pack load error, if any */
export function getComposedPolicyPackError(): string | null {
  return composedPolicyPackError;
}

// =============================================================================
// Validators and Builders
// =============================================================================

const stalenessValidator = createStalenessValidator();
const decisionBuilder = createDecisionBuilder('popper', '1.0.0');

/** System org ID for requests without organization_id */
const SYSTEM_ORG_ID = '00000000-0000-0000-0000-000000000000';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Canonical JSON serialization (deterministic key order).
 *
 * Mirrors Deutsch's canonicalJsonStringify so both sides produce
 * identical hashes for the same snapshot payload. Recursively sorts
 * object keys before stringifying (inspired by RFC 8785 / JCS).
 */
function canonicalJsonStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(canonicalJsonStringify).join(',')}]`;
  const sorted = Object.keys(obj as Record<string, unknown>).sort();
  return `{${sorted.map((k) => `${JSON.stringify(k)}:${canonicalJsonStringify((obj as Record<string, unknown>)[k])}`).join(',')}}`;
}

/**
 * Verify snapshot_hash matches the canonical hash of snapshot_payload.
 * Returns error message if verification fails, undefined if OK.
 *
 * Rules (per Hermes spec §2.5.1):
 * - payload present + hash present → verify match
 * - payload present + hash absent  → reject in advocate_clinical, warn in wellness
 * - payload absent                 → skip (nothing to verify)
 */
function verifySnapshotHash(request: SupervisionRequest): { error?: string; warning?: string } {
  const payload = (request as Record<string, unknown>).snapshot_payload;
  if (payload === undefined) return {};

  const declaredHash = request.snapshot?.snapshot_hash;

  if (!declaredHash) {
    if (request.mode === 'advocate_clinical') {
      return {
        error:
          'snapshot_hash is required when snapshot_payload is present in advocate_clinical mode',
      };
    }
    return {
      warning:
        'snapshot_hash missing for snapshot_payload in wellness mode — proceeding without verification',
    };
  }

  const canonical = canonicalJsonStringify(payload);
  const computed = createHash('sha256').update(canonical).digest('hex');

  if (computed !== declaredHash) {
    return {
      error: `snapshot_hash mismatch: declared=${declaredHash.slice(0, 16)}… computed=${computed.slice(0, 16)}…`,
    };
  }

  return {};
}

/**
 * Validate clock skew for request timestamp.
 * Returns error message if invalid, undefined if valid.
 */
function validateClockSkew(requestTimestamp: string | undefined): string | undefined {
  if (!requestTimestamp) {
    // Only required in advocate_clinical mode, handled separately
    return undefined;
  }

  const requestTime = new Date(requestTimestamp);
  if (Number.isNaN(requestTime.getTime())) {
    return 'Invalid request_timestamp format';
  }

  const now = Date.now();
  const drift = Math.abs(now - requestTime.getTime());

  if (drift > CLOCK_SKEW_TOLERANCE_MS) {
    return `Clock skew exceeds tolerance: ${Math.round(drift / 1000)}s drift (max: ${CLOCK_SKEW_TOLERANCE_MS / 1000}s)`;
  }

  return undefined;
}

/**
 * Map intervention risk scores to per-proposal decision overrides.
 * Higher-risk proposals get escalated to more conservative decisions.
 */
function derivePerProposalOverrides(
  risks: InterventionRiskScore[],
): Map<string, { decision: SupervisionDecision; reason_codes: ReasonCode[] }> {
  const RISK_ESCALATION: Record<
    InterventionRiskLevel,
    { decision: SupervisionDecision; reason: ReasonCode } | null
  > = {
    low: null,
    moderate: { decision: 'REQUEST_MORE_INFO', reason: 'high_uncertainty' },
    high: { decision: 'ROUTE_TO_CLINICIAN', reason: 'risk_too_high' },
    critical: { decision: 'HARD_STOP', reason: 'risk_too_high' },
  };
  const overrides = new Map<
    string,
    { decision: SupervisionDecision; reason_codes: ReasonCode[] }
  >();
  for (const risk of risks) {
    const escalation = RISK_ESCALATION[risk.level];
    if (escalation) {
      overrides.set(risk.proposal_id, {
        decision: escalation.decision,
        reason_codes: [escalation.reason],
      });
    }
  }
  return overrides;
}

/**
 * Build derived signals from validation results.
 */
function buildDerivedSignals(
  request: SupervisionRequest,
  schemaValid: boolean,
  stalenessResult: ReturnType<typeof stalenessValidator.validate>,
): DerivedSignals {
  const acuity = computeAcuity(request);
  const hallucinationResult = detectHallucinations(request);
  return {
    schema_invalid: !schemaValid,
    snapshot_stale: stalenessResult.is_stale,
    snapshot_missing: stalenessResult.is_missing,
    acuity,
    intervention_risks: calculateAllInterventionRisks(request, {
      patientAcuity: acuity.level,
    }),
    hallucination: hallucinationResult.detected
      ? { detected: true, severity: hallucinationResult.severity }
      : undefined,
  };
}

/**
 * Build error response for validation failures.
 */
function buildErrorResponse(
  partialRequest: Partial<SupervisionRequest>,
  errorMessage: string,
  reasonCodes: Array<'schema_invalid' | 'clock_skew' | 'data_quality_warning'> = ['schema_invalid'],
): SupervisionResponse {
  return decisionBuilder.buildErrorResponse(partialRequest, errorMessage, reasonCodes);
}

/**
 * Check if an API key is authorized for a target organization.
 * For now, this is a simple equality check. Organization hierarchy
 * support can be added later.
 */
function isOrganizationAuthorized(apiKeyOrgId: string, targetOrgId: string): boolean {
  return apiKeyOrgId === targetOrgId;
}

// =============================================================================
// Supervision Plugin
// =============================================================================

/**
 * Supervision API plugin for Elysia.
 * Implements POST /v1/popper/supervise endpoint.
 * Requires supervision:write scope.
 */
export const supervisionPlugin = new Elysia({ name: 'supervision', prefix: '/v1/popper' }).guard(
  createAuthGuard('supervision:write'),
  (app) =>
    app.guard(createRateLimitGuard(), (app) =>
      app.post(
        '/supervise',
        async ({ body, set, apiKey }) => {
          const startTime = performance.now();
          const request = body as SupervisionRequest;
          const auditEmitter = getDefaultEmitter();

          // Initialize idempotency tracking (used for advocate_clinical mode)
          const idempotencyCache = getIdempotencyCache();
          let idempotencyKey: string | undefined;
          let requestHash: string | undefined;
          let organizationId = SYSTEM_ORG_ID;

          // 1. Full Hermes schema validation
          const validationResult = validateHermesMessage(request);
          if (!validationResult.valid) {
            logger.warning`Schema validation failed: ${validationResult.errors}`;

            // Emit VALIDATION_FAILED audit event
            const errorMessage = `Schema validation failed: ${validationResult.errors?.map((e) => e.message).join(', ')}`;
            auditEmitter.emit(
              createValidationFailedEvent({
                traceId: request.trace?.trace_id ?? 'unknown',
                subjectId: request.subject?.subject_id ?? 'unknown',
                organizationId: request.subject?.organization_id ?? SYSTEM_ORG_ID,
                errorMessage,
                errorCode: 'SCHEMA_INVALID',
                policyPackVersion: composedPolicyPack?.policy_version ?? 'unknown',
                tags: ['schema_invalid'],
              }),
            );

            set.status = 400;
            return buildErrorResponse(request, errorMessage, ['schema_invalid']);
          }

          // 2. Clock skew validation (required for advocate_clinical)
          if (request.mode === 'advocate_clinical') {
            // Validate required fields for clinical mode
            if (!request.idempotency_key) {
              const errorMessage = 'idempotency_key is required for advocate_clinical mode';
              auditEmitter.emit(
                createValidationFailedEvent({
                  traceId: request.trace.trace_id,
                  subjectId: request.subject.subject_id,
                  organizationId: request.subject.organization_id ?? SYSTEM_ORG_ID,
                  errorMessage,
                  errorCode: 'MISSING_IDEMPOTENCY_KEY',
                  policyPackVersion: composedPolicyPack?.policy_version ?? 'unknown',
                  tags: ['schema_invalid'],
                }),
              );

              set.status = 400;
              return buildErrorResponse(request, errorMessage, ['schema_invalid']);
            }

            const clockSkewError = validateClockSkew(request.request_timestamp);
            if (clockSkewError) {
              logger.warning`Clock skew validation failed: ${clockSkewError}`;

              auditEmitter.emit(
                createValidationFailedEvent({
                  traceId: request.trace.trace_id,
                  subjectId: request.subject.subject_id,
                  organizationId: request.subject.organization_id ?? SYSTEM_ORG_ID,
                  errorMessage: clockSkewError,
                  errorCode: 'CLOCK_SKEW',
                  policyPackVersion: composedPolicyPack?.policy_version ?? 'unknown',
                  tags: ['clock_skew_rejected'],
                }),
              );

              set.status = 400;
              return buildErrorResponse(request, clockSkewError, ['clock_skew']);
            }

            // 2c. Organization validation (required for advocate_clinical)
            // Require organization_id in the request
            if (!request.subject.organization_id) {
              const errorMessage = 'organization_id is required for advocate_clinical mode';
              auditEmitter.emit(
                createValidationFailedEvent({
                  traceId: request.trace.trace_id,
                  subjectId: request.subject.subject_id,
                  organizationId: SYSTEM_ORG_ID,
                  errorMessage,
                  errorCode: 'MISSING_ORGANIZATION_ID',
                  policyPackVersion: composedPolicyPack?.policy_version ?? 'unknown',
                  tags: ['schema_invalid'],
                }),
              );

              set.status = 400;
              return buildErrorResponse(request, errorMessage, ['schema_invalid']);
            }

            organizationId = request.subject.organization_id;

            // Validate API key is authorized for the requested organization
            const authenticatedApiKey = apiKey as ApiKeyContext | null;
            if (
              authenticatedApiKey &&
              !isOrganizationAuthorized(authenticatedApiKey.organizationId, organizationId)
            ) {
              const errorMessage = `API key not authorized for organization: ${organizationId}`;
              logger.warning`${errorMessage}`;

              auditEmitter.emit(
                createValidationFailedEvent({
                  traceId: request.trace.trace_id,
                  subjectId: request.subject.subject_id,
                  organizationId,
                  errorMessage,
                  errorCode: 'UNAUTHORIZED_ORG',
                  policyPackVersion: composedPolicyPack?.policy_version ?? 'unknown',
                  tags: ['unauthorized_org'],
                }),
              );

              set.status = 403;
              return decisionBuilder.buildErrorResponse(request, errorMessage, [
                'policy_violation',
              ]);
            }

            // Validate organization exists and is active, and mode is allowed
            if (isOrganizationServiceInitialized()) {
              const orgService = getOrganizationService();
              const orgValidation = await orgService.validateForSupervision(
                organizationId,
                'advocate_clinical',
              );

              if (orgValidation.valid === false) {
                const validationError = orgValidation.error;
                let errorMessage: string;
                let statusCode: number;
                let auditTag: 'org_not_found' | 'org_inactive' | 'mode_not_allowed';

                switch (validationError) {
                  case 'not_found':
                    errorMessage = `Organization not found: ${organizationId}`;
                    statusCode = 400;
                    auditTag = 'org_not_found';
                    break;
                  case 'inactive':
                    errorMessage = `Organization is inactive: ${organizationId}`;
                    statusCode = 400;
                    auditTag = 'org_inactive';
                    break;
                  case 'mode_not_allowed':
                    errorMessage = `advocate_clinical mode not allowed for organization: ${organizationId}`;
                    statusCode = 403;
                    auditTag = 'mode_not_allowed';
                    break;
                  default:
                    errorMessage = `Organization validation failed: ${organizationId}`;
                    statusCode = 400;
                    auditTag = 'org_not_found';
                }

                logger.warning`${errorMessage}`;

                auditEmitter.emit(
                  createValidationFailedEvent({
                    traceId: request.trace.trace_id,
                    subjectId: request.subject.subject_id,
                    organizationId,
                    errorMessage,
                    errorCode: 'ORG_VALIDATION_FAILED',
                    policyPackVersion: composedPolicyPack?.policy_version ?? 'unknown',
                    tags: [auditTag],
                  }),
                );

                set.status = statusCode;
                return decisionBuilder.buildErrorResponse(
                  request,
                  errorMessage,
                  validationError === 'mode_not_allowed'
                    ? ['policy_violation']
                    : ['schema_invalid'],
                );
              }
            }

            // 2d. Idempotency check (required for advocate_clinical)
            idempotencyKey = request.idempotency_key;
            requestHash = idempotencyCache.computeRequestHash(request);
            const idempotencyResult = await idempotencyCache.check(
              organizationId,
              idempotencyKey,
              requestHash,
            );

            if (idempotencyResult.status === 'cached') {
              logger.info`Returning cached response for idempotency_key=${request.idempotency_key}`;
              return idempotencyResult.response;
            }

            if (idempotencyResult.status === 'replay_suspected') {
              const errorMessage = `Replay attack suspected: same idempotency_key with different payload`;
              logger.warning`${errorMessage} key=${request.idempotency_key}`;

              auditEmitter.emit(
                createValidationFailedEvent({
                  traceId: request.trace.trace_id,
                  subjectId: request.subject.subject_id,
                  organizationId,
                  errorMessage,
                  errorCode: 'REPLAY_SUSPECTED',
                  policyPackVersion: composedPolicyPack?.policy_version ?? 'unknown',
                  tags: ['replay_suspected'],
                }),
              );

              set.status = 400;
              return decisionBuilder.buildErrorResponse(request, errorMessage, [
                'policy_violation',
              ]);
            }
          }

          // 2e. Snapshot hash verification (Hermes spec §2.5.1)
          // When snapshot_payload is present, verify that snapshot_hash matches
          // the canonical JSON hash of the payload. Prevents tampered or stale payloads.
          const hashVerification = verifySnapshotHash(request);
          if (hashVerification.error) {
            logger.warning`Snapshot hash verification failed: ${hashVerification.error}`;

            auditEmitter.emit(
              createValidationFailedEvent({
                traceId: request.trace?.trace_id ?? 'unknown',
                subjectId: request.subject?.subject_id ?? 'unknown',
                organizationId: request.subject?.organization_id ?? SYSTEM_ORG_ID,
                errorMessage: hashVerification.error,
                errorCode: 'SNAPSHOT_HASH_MISMATCH',
                policyPackVersion: composedPolicyPack?.policy_version ?? 'unknown',
                tags: ['snapshot_integrity_failed'],
              }),
            );

            set.status = 400;
            return buildErrorResponse(request, hashVerification.error, ['data_quality_warning']);
          }
          if (hashVerification.warning) {
            logger.warning`${hashVerification.warning}`;
          }

          // 3. Staleness validation
          const stalenessResult = stalenessValidator.validate(request);

          // 4. Build derived signals (includes acuity scoring — SAL-1018)
          const derivedSignals = buildDerivedSignals(request, true, stalenessResult);

          // 5. Get composed policy pack (loaded at startup)
          if (!composedPolicyPack) {
            logger.error`Composed policy pack not available: ${composedPolicyPackError ?? 'unknown error'}`;
            set.status = 500;
            return buildErrorResponse(request, 'Internal error: policy pack not loaded', [
              'schema_invalid',
            ]);
          }
          const policyPack = composedPolicyPack;

          // 6. Snapshot safe-mode state from Redis (<5ms)
          const safeModeState = await getSafeModeManager().snapshot(organizationId);

          // 7. Create evaluation context
          const context: EvaluationContext = {
            request,
            controlPlane: {
              current_time: new Date(),
              safe_mode: {
                enabled: safeModeState.enabled,
                reason: safeModeState.reason,
                effective_at: safeModeState.effective_at,
              },
            },
            derivedSignals,
          };

          // 8. Evaluate policies
          const evaluator = createEvaluator(policyPack);
          const evaluationResult = evaluator.evaluate(context);

          // 9. Build per-proposal decisions from intervention risks
          const interventionRisks = derivedSignals.intervention_risks ?? [];
          const proposalOverrides = derivePerProposalOverrides(interventionRisks);
          const perProposalDecisions = buildPerProposalDecisions(
            request.proposals,
            evaluationResult.decision,
            evaluationResult.reason_codes,
            proposalOverrides,
          );

          // 10. Build final response
          const response = decisionBuilder.build({
            request,
            evaluationResult,
            stalenessResult,
            perProposalDecisions,
            safeModeState: {
              enabled: safeModeState.enabled,
              reason: safeModeState.reason,
              effective_at: safeModeState.effective_at,
            },
          });

          // 10. Log metrics and emit audit event
          const latencyMs = performance.now() - startTime;
          logger.info`Supervision completed: decision=${response.decision} latency=${latencyMs.toFixed(2)}ms`;

          // Emit SUPERVISION_DECISION audit event (async, non-blocking)
          const requestMetadata = extractRequestMetadata(request);
          const auditTags = buildAuditTags(
            request,
            response.decision,
            stalenessResult.is_stale,
            stalenessResult.is_missing,
          );

          // Extract provenance from the first matched rule (highest priority)
          const primaryMatchedRule = evaluationResult.matched_rules[0];
          const ruleProvenance = primaryMatchedRule?.provenance
            ? {
                rule_id: primaryMatchedRule.rule_id,
                source_type: primaryMatchedRule.provenance.source_type,
                citation: primaryMatchedRule.provenance.citation,
                source_layer: primaryMatchedRule.provenance.source_layer,
              }
            : undefined;

          auditEmitter.emit(
            createSupervisionDecisionEvent({
              traceId: request.trace.trace_id,
              subjectId: request.subject.subject_id,
              organizationId: request.subject.organization_id ?? SYSTEM_ORG_ID,
              decision: response.decision,
              reasonCodes: response.reason_codes,
              policyPackVersion: evaluationResult.policy_version,
              safeModeActive: safeModeState.enabled,
              latencyMs,
              proposalCount: request.proposals?.length ?? 0,
              ruleProvenance,
              payload: {
                ...requestMetadata,
                staleness: {
                  is_stale: stalenessResult.is_stale,
                  is_missing: stalenessResult.is_missing,
                  age_hours: stalenessResult.age_hours,
                  threshold_hours: stalenessResult.threshold_hours,
                },
                acuity: derivedSignals.acuity
                  ? {
                      level: derivedSignals.acuity.level,
                      composite: derivedSignals.acuity.composite,
                    }
                  : undefined,
                intervention_risks: derivedSignals.intervention_risks?.map((r) => ({
                  proposal_id: r.proposal_id,
                  level: r.level,
                  composite: r.composite,
                })),
                hallucination: derivedSignals.hallucination,
                evaluation: {
                  matched_rules: evaluationResult.matched_rules.map((r) => r.rule_id),
                  policy_version: evaluationResult.policy_version,
                  evaluation_time_ms: evaluationResult.evaluation_time_ms,
                },
              },
              tags: auditTags,
            }),
          );

          // Set appropriate status code based on decision
          if (response.decision === 'HARD_STOP') {
            set.status = 200; // Still 200 - HARD_STOP is a valid response
          }

          // Record drift counters (async, non-blocking)
          if (isDriftCountersInitialized()) {
            getDriftCounters()
              .recordDecision({
                organizationId: request.subject.organization_id ?? SYSTEM_ORG_ID,
                decision: response.decision,
                reasonCodes: response.reason_codes,
                htvBelowThreshold: response.reason_codes.includes('htv_below_threshold'),
                validationFailed: false,
              })
              .catch((err) => {
                logger.warning`Failed to record drift counters: ${err}`;
              });
          }

          // Record signal for reconfigure policy engine (async, non-blocking)
          if (isSignalAggregatorInitialized()) {
            getSignalAggregator()
              .record({
                organization_id: request.subject.organization_id ?? SYSTEM_ORG_ID,
                instance_id: request.trace?.producer?.instance_id ?? 'unknown',
                timestamp: Date.now(),
                decision: response.decision,
                htv_score: undefined,
                hallucination_detected: derivedSignals.hallucination?.detected ?? false,
                idk_triggered: response.reason_codes.includes('idk_response'),
                risk_score: derivedSignals.intervention_risks?.[0]?.composite,
                high_risk_proposal:
                  derivedSignals.intervention_risks?.some(
                    (r) => r.level === 'HIGH' || r.level === 'CRITICAL',
                  ) ?? false,
                prescription_proposed:
                  request.proposals?.some(
                    (p) => p.type === 'prescription' || p.type === 'medication',
                  ) ?? false,
                prescription_rejected:
                  response.decision === 'HARD_STOP' &&
                  (request.proposals?.some(
                    (p) => p.type === 'prescription' || p.type === 'medication',
                  ) ??
                    false),
                triage_escalated: response.decision === 'ROUTE_TO_CLINICIAN',
                stale_snapshot: stalenessResult.is_stale,
                missing_sources: [],
              })
              .catch((err) => {
                logger.warning`Failed to record signal: ${err}`;
              });
          }

          // 10. Store response in idempotency cache (advocate_clinical only)
          if (idempotencyKey && requestHash) {
            // Fire-and-forget: don't block response on cache write
            idempotencyCache
              .store(organizationId, idempotencyKey, requestHash, response)
              .catch((err) => {
                logger.warning`Failed to store idempotency cache: ${err}`;
              });
          }

          return response;
        },
        {
          body: supervisionRequestSchema,
          response: {
            200: supervisionResponseSchema,
            400: supervisionResponseSchema,
            401: errorResponseSchema,
            // 403 can be either auth error (errorResponseSchema) or policy violation (supervisionResponseSchema)
            403: t.Union([errorResponseSchema, supervisionResponseSchema]),
            429: errorResponseSchema,
            500: supervisionResponseSchema,
          },
          detail: {
            tags: ['Supervision'],
            summary: 'Supervise proposed interventions',
            description:
              'Evaluate proposed patient interventions against safety policies. Returns APPROVED, REQUEST_MORE_INFO, ROUTE_TO_CLINICIAN, or HARD_STOP.',
          },
        },
      ),
    ),
);
