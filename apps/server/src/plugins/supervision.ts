/**
 * Supervision API endpoint plugin
 * POST /v1/popper/supervise - Main supervision endpoint
 *
 * Protected by API Key authentication with supervision:write scope.
 *
 * @see docs/specs/02-popper-specs/02-popper-contracts-and-interfaces.md §1.1
 * @module plugins/supervision
 */

import type { ApiKeyContext } from '@popper/core';
import {
  buildAuditTags,
  calculateAllInterventionRisks,
  computeAcuity,
  createDecisionBuilder,
  createEvaluator,
  createStalenessValidator,
  createSupervisionDecisionEvent,
  createValidationFailedEvent,
  type DerivedSignals,
  type EvaluationContext,
  extractRequestMetadata,
  getDefaultEmitter,
  policyRegistry,
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
import { createAuthGuard } from './api-key-auth';
import { createRateLimitGuard } from './rate-limit';

// =============================================================================
// Configuration
// =============================================================================

/** Clock skew tolerance in milliseconds (±5 minutes per spec) */
const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

/** Default policy pack ID to use */
const DEFAULT_POLICY_PACK = 'popper-default';

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
 * Build derived signals from validation results.
 */
function buildDerivedSignals(
  request: SupervisionRequest,
  schemaValid: boolean,
  stalenessResult: ReturnType<typeof stalenessValidator.validate>,
): DerivedSignals {
  const acuity = computeAcuity(request);
  return {
    schema_invalid: !schemaValid,
    snapshot_stale: stalenessResult.is_stale,
    snapshot_missing: stalenessResult.is_missing,
    acuity,
    intervention_risks: calculateAllInterventionRisks(request, {
      patientAcuity: acuity.level,
    }),
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
                policyPackVersion: DEFAULT_POLICY_PACK,
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
                  policyPackVersion: DEFAULT_POLICY_PACK,
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
                  policyPackVersion: DEFAULT_POLICY_PACK,
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
                  policyPackVersion: DEFAULT_POLICY_PACK,
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
                  policyPackVersion: DEFAULT_POLICY_PACK,
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
                    policyPackVersion: DEFAULT_POLICY_PACK,
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
                  policyPackVersion: DEFAULT_POLICY_PACK,
                  tags: ['replay_suspected'],
                }),
              );

              set.status = 400;
              return decisionBuilder.buildErrorResponse(request, errorMessage, [
                'policy_violation',
              ]);
            }
          }

          // 3. Staleness validation
          const stalenessResult = stalenessValidator.validate(request);

          // 4. Build derived signals (includes acuity scoring — SAL-1018)
          const derivedSignals = buildDerivedSignals(request, true, stalenessResult);

          // 5. Get policy pack
          const policyPack = policyRegistry.get(DEFAULT_POLICY_PACK);
          if (!policyPack) {
            logger.error`Policy pack "${DEFAULT_POLICY_PACK}" not found`;
            set.status = 500;
            return buildErrorResponse(request, 'Internal error: policy pack not loaded', [
              'schema_invalid',
            ]);
          }

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

          // 9. Build final response
          const response = decisionBuilder.build({
            request,
            evaluationResult,
            stalenessResult,
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
