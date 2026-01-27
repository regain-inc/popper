/**
 * API Key generation utilities
 *
 * Key format: pk_{env}_{64-hex-chars}
 * - pk_live_<64-hex-chars> for production
 * - pk_test_<64-hex-chars> for development/testing
 *
 * @module api-keys/generator
 */

import { createHash, randomBytes } from 'node:crypto';
import type { ApiKeyEnvironment, GeneratedApiKey } from './types';

/** Key prefix pattern */
const KEY_PREFIX_REGEX = /^pk_(live|test)_[a-f0-9]{64}$/;

/** Prefix length for identification (e.g., "pk_live_ab12") */
const DISPLAY_PREFIX_LENGTH = 12;

/**
 * Generate a new API key
 *
 * @param environment - Key environment ('live' or 'test')
 * @returns Generated key with plaintext, prefix, and hash
 *
 * @example
 * ```typescript
 * const key = generateApiKey('live');
 * // key.plaintextKey = "pk_live_a1b2c3d4..." (64 hex chars)
 * // key.keyPrefix = "pk_live_a1b2"
 * // key.keyHash = "sha256hash..."
 * ```
 */
export function generateApiKey(environment: ApiKeyEnvironment = 'test'): GeneratedApiKey {
  // Generate 32 random bytes = 64 hex characters
  const randomPart = randomBytes(32).toString('hex');
  const plaintextKey = `pk_${environment}_${randomPart}`;

  return {
    plaintextKey,
    keyPrefix: plaintextKey.substring(0, DISPLAY_PREFIX_LENGTH),
    keyHash: hashApiKey(plaintextKey),
  };
}

/**
 * Hash an API key using SHA-256
 *
 * @param key - Full plaintext API key
 * @returns SHA-256 hash as hex string
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Validate API key format
 *
 * @param key - API key to validate
 * @returns true if key matches expected format
 */
export function isValidKeyFormat(key: string): boolean {
  return KEY_PREFIX_REGEX.test(key);
}

/**
 * Extract environment from API key
 *
 * @param key - API key
 * @returns Environment or null if invalid format
 */
export function getKeyEnvironment(key: string): ApiKeyEnvironment | null {
  if (!isValidKeyFormat(key)) {
    return null;
  }

  const match = key.match(/^pk_(live|test)_/);
  return match ? (match[1] as ApiKeyEnvironment) : null;
}

/**
 * Get display prefix from full key
 *
 * @param key - Full API key
 * @returns First 12 characters for identification
 */
export function getKeyPrefix(key: string): string {
  return key.substring(0, DISPLAY_PREFIX_LENGTH);
}
