/**
 * Redaction and De-identification Utilities
 *
 * Utilities for removing/hashing PHI from export bundles.
 * Per spec: Export bundles MUST NOT contain direct identifiers.
 *
 * @module export/redaction
 */

import { createHash } from 'node:crypto';

/**
 * Fields that MUST be removed or hashed (HIPAA Safe Harbor + additional identifiers)
 *
 * Based on HIPAA Safe Harbor De-identification Standard (45 CFR 164.514(b)(2)):
 * - Names
 * - Geographic data (smaller than state)
 * - Dates (except year) related to individual
 * - Phone/Fax numbers
 * - Email addresses
 * - Social Security numbers
 * - Medical record numbers
 * - Health plan beneficiary numbers
 * - Account numbers
 * - Certificate/license numbers
 * - Vehicle identifiers
 * - Device identifiers
 * - Web URLs
 * - IP addresses
 * - Biometric identifiers
 * - Full-face photos
 * - Any unique identifier
 */
export const PHI_FIELDS = [
  // Names
  'name',
  'first_name',
  'last_name',
  'full_name',
  'patient_name',
  'provider_name',
  'physician_name',
  'doctor_name',
  // Contact info
  'phone',
  'telephone',
  'fax',
  'email',
  'email_address',
  // Address components
  'address',
  'street',
  'city',
  'zip',
  'zipcode',
  'postal_code',
  // Identifiers
  'ssn',
  'social_security',
  'mrn',
  'medical_record_number',
  'insurance_id',
  'insurance_number',
  'policy_number',
  'account_number',
  'license_number',
  'certificate_number',
  // Dates
  'date_of_birth',
  'dob',
  'birth_date',
  'birthdate',
  'admission_date',
  'discharge_date',
  'death_date',
  // Digital identifiers
  'ip_address',
  'mac_address',
  'device_id',
  'imei',
  // Facility info (can be identifying in small areas)
  'facility_name',
  'facility_id',
  // Biometrics
  'fingerprint',
  'retina',
  'voiceprint',
  'facial_image',
  'photo',
  'biometric',
] as const;

/**
 * Fields that should be hashed (pseudonymized) instead of removed
 */
export const PSEUDONYMIZE_FIELDS = ['subject_id', 'patient_id', 'user_id'] as const;

/**
 * Get hash salt from environment or use secure default
 * IMPORTANT: In production, EXPORT_HASH_SALT must be set to a unique, secret value
 */
function getHashSalt(): string {
  const envSalt = process.env.EXPORT_HASH_SALT;
  if (!envSalt) {
    // In development, warn but allow default
    if (process.env.NODE_ENV === 'production') {
      throw new Error('EXPORT_HASH_SALT environment variable must be set in production');
    }
    return 'popper-export-salt-dev-only';
  }
  return envSalt;
}

/**
 * Hash a value for pseudonymization
 *
 * Uses SHA-256 with a salt to create a consistent but irreversible identifier.
 * Returns full 64-character hex hash for collision resistance.
 */
export function hashForPseudonymization(value: string, salt?: string): string {
  const effectiveSalt = salt ?? getHashSalt();
  const hash = createHash('sha256');
  hash.update(effectiveSalt);
  hash.update(value);
  return hash.digest('hex'); // Full 64-char hash for security
}

/**
 * Check if a field name is a PHI field
 */
export function isPhiField(fieldName: string): boolean {
  const normalized = fieldName.toLowerCase().replace(/[-_]/g, '');
  return PHI_FIELDS.some((phi) => normalized.includes(phi.replace(/[-_]/g, '')));
}

/**
 * Check if a field should be pseudonymized
 */
export function shouldPseudonymize(fieldName: string): boolean {
  const normalized = fieldName.toLowerCase().replace(/[-_]/g, '');
  return PSEUDONYMIZE_FIELDS.some((field) => normalized.includes(field.replace(/[-_]/g, '')));
}

/**
 * Redact PHI from an object recursively
 *
 * @param obj - Object to redact
 * @param salt - Salt for pseudonymization
 * @returns Redacted object with list of redacted fields
 */
export function redactObject<T extends Record<string, unknown>>(
  obj: T,
  salt?: string,
): { redacted: T; redactedFields: string[] } {
  const effectiveSalt = salt ?? getHashSalt();
  const redactedFields: string[] = [];

  function redactRecursive(value: unknown, path: string): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item, index) => redactRecursive(item, `${path}[${index}]`));
    }

    if (typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        const fieldPath = path ? `${path}.${key}` : key;

        if (isPhiField(key)) {
          // Remove PHI fields entirely
          redactedFields.push(fieldPath);
          result[key] = '[REDACTED]';
        } else if (shouldPseudonymize(key) && typeof val === 'string') {
          // Hash pseudonymizable fields
          redactedFields.push(fieldPath);
          result[`${key}_hash`] = hashForPseudonymization(val, effectiveSalt);
        } else {
          result[key] = redactRecursive(val, fieldPath);
        }
      }
      return result;
    }

    // Check if string value looks like PHI (email, phone)
    if (typeof value === 'string') {
      // Email pattern
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        redactedFields.push(path);
        return '[REDACTED_EMAIL]';
      }
      // Phone pattern (various formats)
      if (/^\+?[\d\s()-]{10,}$/.test(value.replace(/\s/g, ''))) {
        redactedFields.push(path);
        return '[REDACTED_PHONE]';
      }
      // SSN pattern
      if (/^\d{3}-?\d{2}-?\d{4}$/.test(value)) {
        redactedFields.push(path);
        return '[REDACTED_SSN]';
      }
    }

    return value;
  }

  const redacted = redactRecursive(obj, '') as T;
  return { redacted, redactedFields };
}

/**
 * Create a redaction summary for audit purposes
 */
export function createRedactionSummary(redactedFields: string[]): {
  redacted_fields: string[];
  summary: string;
} {
  const uniqueFields = [...new Set(redactedFields)];
  const count = uniqueFields.length;

  let summary: string;
  if (count === 0) {
    summary = 'No fields were redacted';
  } else if (count <= 3) {
    summary = `Redacted: ${uniqueFields.join(', ')}`;
  } else {
    summary = `Redacted ${count} fields including: ${uniqueFields.slice(0, 3).join(', ')}, ...`;
  }

  return {
    redacted_fields: uniqueFields,
    summary,
  };
}

/**
 * Sanitize text content by removing potential PHI patterns
 */
export function sanitizeText(text: string): string {
  let sanitized = text;

  // Remove email addresses
  sanitized = sanitized.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[EMAIL]');

  // Remove phone numbers
  sanitized = sanitized.replace(/\+?[\d\s()-]{10,}/g, '[PHONE]');

  // Remove SSN patterns
  sanitized = sanitized.replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, '[SSN]');

  // Remove potential names after common prefixes
  sanitized = sanitized.replace(
    /\b(Mr\.|Mrs\.|Ms\.|Dr\.|Patient:?)\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?/g,
    '$1 [NAME]',
  );

  return sanitized;
}

/**
 * Hash a trace ID for correlation (keeps first 8 chars visible for debugging)
 */
export function hashTraceId(traceId: string, salt?: string): string {
  const prefix = traceId.substring(0, 8);
  const hash = hashForPseudonymization(traceId, salt).substring(0, 8);
  return `${prefix}...${hash}`;
}
