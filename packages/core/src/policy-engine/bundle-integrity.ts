/**
 * Activation Bundle Integrity
 *
 * Computes and verifies SHA-256 content hashes for policy pack manifests.
 * Used to detect tampering or corruption of pack files between load cycles.
 *
 * Design:
 * - Hash is computed over the canonical JSON serialization of the pack content
 * - Manifest stores hash + metadata for each loaded pack
 * - Verification compares stored hash against freshly computed hash
 * - No cryptographic signing (would require key management infrastructure)
 *   — hash-based integrity is sufficient for tamper detection at this stage
 *
 * @module policy-engine/bundle-integrity
 */

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { PolicyPack } from './types';

// =============================================================================
// Types
// =============================================================================

export interface PackDigest {
  pack_id: string;
  policy_version: string;
  rules_count: number;
  content_hash: string; // SHA-256 hex
  source_path?: string;
  computed_at: string; // ISO 8601
}

export interface BundleManifest {
  manifest_version: '1.0';
  created_at: string;
  packs: PackDigest[];
  composite_hash: string; // SHA-256 of sorted pack hashes
}

export interface IntegrityCheckResult {
  valid: boolean;
  pack_id: string;
  expected_hash: string;
  actual_hash: string;
  message: string;
}

// =============================================================================
// Hash Computation
// =============================================================================

/**
 * Compute a SHA-256 content hash for a policy pack.
 * Uses canonical JSON serialization (deep sorted keys) for deterministic output.
 */
export function computePackHash(pack: PolicyPack): string {
  const canonical = canonicalStringify(pack);
  return createHash('sha256').update(canonical, 'utf-8').digest('hex');
}

/** Deep-sort-keys JSON serialization for deterministic hashing. */
function canonicalStringify(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(',')}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const pairs = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalStringify((value as Record<string, unknown>)[k])}`,
  );
  return `{${pairs.join(',')}}`;
}

/**
 * Compute a SHA-256 hash from raw file content.
 */
export function computeFileHash(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Compute a composite hash from multiple pack hashes.
 * Sorts hashes alphabetically before hashing for determinism.
 */
export function computeCompositeHash(packHashes: string[]): string {
  const sorted = [...packHashes].sort();
  return createHash('sha256').update(sorted.join(':')).digest('hex');
}

// =============================================================================
// Digest + Manifest
// =============================================================================

/**
 * Create a digest for a single policy pack.
 */
export function createPackDigest(pack: PolicyPack, sourcePath?: string): PackDigest {
  return {
    pack_id: pack.policy_id,
    policy_version: pack.policy_version,
    rules_count: pack.rules.length,
    content_hash: computePackHash(pack),
    source_path: sourcePath,
    computed_at: new Date().toISOString(),
  };
}

/**
 * Create a bundle manifest from multiple packs.
 */
export function createBundleManifest(
  packs: Array<{ pack: PolicyPack; sourcePath?: string }>,
): BundleManifest {
  const digests = packs.map(({ pack, sourcePath }) => createPackDigest(pack, sourcePath));
  const compositeHash = computeCompositeHash(digests.map((d) => d.content_hash));

  return {
    manifest_version: '1.0',
    created_at: new Date().toISOString(),
    packs: digests,
    composite_hash: compositeHash,
  };
}

// =============================================================================
// Verification
// =============================================================================

/**
 * Verify a single pack against its stored digest.
 */
export function verifyPackIntegrity(pack: PolicyPack, digest: PackDigest): IntegrityCheckResult {
  const actualHash = computePackHash(pack);
  const valid = actualHash === digest.content_hash;

  return {
    valid,
    pack_id: pack.policy_id,
    expected_hash: digest.content_hash,
    actual_hash: actualHash,
    message: valid
      ? `Pack '${pack.policy_id}' integrity verified`
      : `Pack '${pack.policy_id}' content hash mismatch — possible tampering or corruption`,
  };
}

/**
 * Verify all packs in a bundle against a stored manifest.
 * Returns results for each pack plus an overall composite check.
 */
export function verifyBundleIntegrity(
  packs: PolicyPack[],
  manifest: BundleManifest,
): { results: IntegrityCheckResult[]; compositeValid: boolean } {
  const digestMap = new Map<string, PackDigest>();
  for (const d of manifest.packs) {
    digestMap.set(d.pack_id, d);
  }

  const results: IntegrityCheckResult[] = [];

  for (const pack of packs) {
    const digest = digestMap.get(pack.policy_id);
    if (!digest) {
      results.push({
        valid: false,
        pack_id: pack.policy_id,
        expected_hash: '(not in manifest)',
        actual_hash: computePackHash(pack),
        message: `Pack '${pack.policy_id}' not found in manifest — unexpected pack loaded`,
      });
      continue;
    }
    results.push(verifyPackIntegrity(pack, digest));
  }

  // Check for packs in manifest that aren't loaded
  for (const digest of manifest.packs) {
    if (!packs.some((p) => p.policy_id === digest.pack_id)) {
      results.push({
        valid: false,
        pack_id: digest.pack_id,
        expected_hash: digest.content_hash,
        actual_hash: '(pack not loaded)',
        message: `Pack '${digest.pack_id}' in manifest but not loaded — pack may have been removed`,
      });
    }
  }

  // Verify composite hash
  const actualHashes = packs.map((p) => computePackHash(p));
  const actualComposite = computeCompositeHash(actualHashes);
  const compositeValid = actualComposite === manifest.composite_hash;

  return { results, compositeValid };
}

/**
 * Verify a file on disk hasn't changed since a hash was computed.
 */
export async function verifyFileIntegrity(
  filePath: string,
  expectedHash: string,
): Promise<IntegrityCheckResult> {
  const content = await readFile(filePath);
  const actualHash = computeFileHash(content);
  const valid = actualHash === expectedHash;

  return {
    valid,
    pack_id: filePath,
    expected_hash: expectedHash,
    actual_hash: actualHash,
    message: valid
      ? `File '${filePath}' integrity verified`
      : `File '${filePath}' content changed since hash was computed`,
  };
}
