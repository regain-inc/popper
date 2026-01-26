/**
 * Supervision API endpoint plugin
 * POST /v1/popper/supervise - Main supervision endpoint
 *
 * @see docs/specs/02-popper-specs/02-popper-contracts-and-interfaces.md §1.1
 * @module plugins/supervision
 */

import {
  createDecisionBuilder,
  createEvaluator,
  createStalenessValidator,
  type DerivedSignals,
  type EvaluationContext,
  policyRegistry,
  type SupervisionRequest,
  type SupervisionResponse,
  validateHermesMessage,
} from '@popper/core';
import { Elysia } from 'elysia';
import { logger } from '../lib/logger';
import { supervisionRequestSchema, supervisionResponseSchema } from '../lib/schemas/supervision';

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
  schemaValid: boolean,
  stalenessResult: ReturnType<typeof stalenessValidator.validate>,
): DerivedSignals {
  return {
    schema_invalid: !schemaValid,
    snapshot_stale: stalenessResult.is_stale,
    snapshot_missing: stalenessResult.is_missing,
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

// =============================================================================
// Supervision Plugin
// =============================================================================

/**
 * Supervision API plugin for Elysia.
 * Implements POST /v1/popper/supervise endpoint.
 */
export const supervisionPlugin = new Elysia({ name: 'supervision', prefix: '/v1/popper' }).post(
  '/supervise',
  async ({ body, set }) => {
    const startTime = performance.now();
    const request = body as SupervisionRequest;

    // 1. Full Hermes schema validation
    const validationResult = validateHermesMessage(request);
    if (!validationResult.valid) {
      logger.warning`Schema validation failed: ${validationResult.errors}`;

      set.status = 400;
      return buildErrorResponse(
        request,
        `Schema validation failed: ${validationResult.errors?.map((e) => e.message).join(', ')}`,
        ['schema_invalid'],
      );
    }

    // 2. Clock skew validation (required for advocate_clinical)
    if (request.mode === 'advocate_clinical') {
      // Validate required fields for clinical mode
      if (!request.idempotency_key) {
        set.status = 400;
        return buildErrorResponse(
          request,
          'idempotency_key is required for advocate_clinical mode',
          ['schema_invalid'],
        );
      }

      const clockSkewError = validateClockSkew(request.request_timestamp);
      if (clockSkewError) {
        logger.warning`Clock skew validation failed: ${clockSkewError}`;
        set.status = 400;
        return buildErrorResponse(request, clockSkewError, ['clock_skew']);
      }
    }

    // 3. Staleness validation
    const stalenessResult = stalenessValidator.validate(request);

    // 4. Build derived signals
    const derivedSignals = buildDerivedSignals(true, stalenessResult);

    // 5. Get policy pack
    const policyPack = policyRegistry.get(DEFAULT_POLICY_PACK);
    if (!policyPack) {
      logger.error`Policy pack "${DEFAULT_POLICY_PACK}" not found`;
      set.status = 500;
      return buildErrorResponse(request, 'Internal error: policy pack not loaded', [
        'schema_invalid',
      ]);
    }

    // 6. Create evaluation context
    const context: EvaluationContext = {
      request,
      controlPlane: {
        current_time: new Date(),
      },
      derivedSignals,
    };

    // 7. Evaluate policies
    const evaluator = createEvaluator(policyPack);
    const evaluationResult = evaluator.evaluate(context);

    // 8. Build final response
    const response = decisionBuilder.build({
      request,
      evaluationResult,
      stalenessResult,
    });

    // 9. Log metrics
    const latencyMs = performance.now() - startTime;
    logger.info`Supervision completed: decision=${response.decision} latency=${latencyMs.toFixed(2)}ms`;

    // Set appropriate status code based on decision
    if (response.decision === 'HARD_STOP') {
      set.status = 200; // Still 200 - HARD_STOP is a valid response
    }

    return response;
  },
  {
    body: supervisionRequestSchema,
    response: {
      200: supervisionResponseSchema,
      400: supervisionResponseSchema,
      500: supervisionResponseSchema,
    },
    detail: {
      tags: ['Supervision'],
      summary: 'Supervise proposed interventions',
      description:
        'Evaluate proposed patient interventions against safety policies. Returns APPROVED, REQUEST_MORE_INFO, ROUTE_TO_CLINICIAN, or HARD_STOP.',
    },
  },
);
