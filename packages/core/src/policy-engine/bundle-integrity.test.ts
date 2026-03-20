// biome-ignore-all lint/suspicious/noThenProperty: Safety DSL uses 'then' as rule action clause per spec
import { describe, expect, test } from 'bun:test';
import {
  computeCompositeHash,
  computePackHash,
  createBundleManifest,
  createPackDigest,
  verifyBundleIntegrity,
  verifyPackIntegrity,
} from './bundle-integrity';
import type { PolicyPack } from './types';

function makePack(id: string, version: string, ruleCount: number): PolicyPack {
  const rules = Array.from({ length: ruleCount }, (_, i) => ({
    rule_id: `${id}-r${i}`,
    description: `Rule ${i}`,
    priority: 100 + i,
    when: { kind: 'always' as const },
    then: {
      decision: 'APPROVED' as const,
      reason_codes: ['schema_invalid' as const],
      explanation: 'test',
    },
  }));

  return { policy_id: id, policy_version: version, rules };
}

describe('computePackHash', () => {
  test('returns consistent hash for same pack', () => {
    const pack = makePack('test', '1.0.0', 3);
    const h1 = computePackHash(pack);
    const h2 = computePackHash(pack);
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64); // SHA-256 hex
  });

  test('returns different hash for different content', () => {
    const a = makePack('test', '1.0.0', 3);
    const b = makePack('test', '1.0.1', 3);
    expect(computePackHash(a)).not.toBe(computePackHash(b));
  });

  test('returns different hash for different rule count', () => {
    const a = makePack('test', '1.0.0', 3);
    const b = makePack('test', '1.0.0', 4);
    expect(computePackHash(a)).not.toBe(computePackHash(b));
  });
});

describe('computeCompositeHash', () => {
  test('order-independent', () => {
    const h1 = computeCompositeHash(['aaa', 'bbb', 'ccc']);
    const h2 = computeCompositeHash(['ccc', 'aaa', 'bbb']);
    expect(h1).toBe(h2);
  });

  test('different inputs produce different hashes', () => {
    const h1 = computeCompositeHash(['aaa', 'bbb']);
    const h2 = computeCompositeHash(['aaa', 'ccc']);
    expect(h1).not.toBe(h2);
  });
});

describe('createPackDigest', () => {
  test('captures pack metadata', () => {
    const pack = makePack('core', '2.0.0', 5);
    const digest = createPackDigest(pack, '/path/to/core.yaml');
    expect(digest.pack_id).toBe('core');
    expect(digest.policy_version).toBe('2.0.0');
    expect(digest.rules_count).toBe(5);
    expect(digest.content_hash).toHaveLength(64);
    expect(digest.source_path).toBe('/path/to/core.yaml');
    expect(digest.computed_at).toBeDefined();
  });
});

describe('createBundleManifest', () => {
  test('creates manifest with composite hash', () => {
    const packs = [
      { pack: makePack('core', '1.0.0', 10), sourcePath: '/core.yaml' },
      { pack: makePack('hf-domain', '1.0.0', 5), sourcePath: '/domains/hf.yaml' },
    ];
    const manifest = createBundleManifest(packs);
    expect(manifest.manifest_version).toBe('1.0');
    expect(manifest.packs).toHaveLength(2);
    expect(manifest.composite_hash).toHaveLength(64);
  });
});

describe('verifyPackIntegrity', () => {
  test('passes for unmodified pack', () => {
    const pack = makePack('core', '1.0.0', 10);
    const digest = createPackDigest(pack);
    const result = verifyPackIntegrity(pack, digest);
    expect(result.valid).toBe(true);
  });

  test('fails for modified pack', () => {
    const pack = makePack('core', '1.0.0', 10);
    const digest = createPackDigest(pack);

    // Tamper with the pack
    pack.rules[0].description = 'TAMPERED';

    const result = verifyPackIntegrity(pack, digest);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('mismatch');
  });
});

describe('verifyBundleIntegrity', () => {
  test('passes for unmodified bundle', () => {
    const core = makePack('core', '1.0.0', 10);
    const hf = makePack('hf', '1.0.0', 5);
    const manifest = createBundleManifest([{ pack: core }, { pack: hf }]);
    const { results, compositeValid } = verifyBundleIntegrity([core, hf], manifest);
    expect(compositeValid).toBe(true);
    expect(results.every((r) => r.valid)).toBe(true);
  });

  test('detects tampered pack', () => {
    const core = makePack('core', '1.0.0', 10);
    const hf = makePack('hf', '1.0.0', 5);
    const manifest = createBundleManifest([{ pack: core }, { pack: hf }]);

    // Tamper
    hf.rules[0].priority = 999;

    const { results, compositeValid } = verifyBundleIntegrity([core, hf], manifest);
    expect(compositeValid).toBe(false);
    expect(results.find((r) => r.pack_id === 'hf')?.valid).toBe(false);
    expect(results.find((r) => r.pack_id === 'core')?.valid).toBe(true);
  });

  test('detects unexpected pack', () => {
    const core = makePack('core', '1.0.0', 10);
    const manifest = createBundleManifest([{ pack: core }]);
    const rogue = makePack('rogue', '0.0.1', 1);

    const { results } = verifyBundleIntegrity([core, rogue], manifest);
    const rogueResult = results.find((r) => r.pack_id === 'rogue');
    expect(rogueResult?.valid).toBe(false);
    expect(rogueResult?.message).toContain('not found in manifest');
  });

  test('detects missing pack', () => {
    const core = makePack('core', '1.0.0', 10);
    const hf = makePack('hf', '1.0.0', 5);
    const manifest = createBundleManifest([{ pack: core }, { pack: hf }]);

    // Only load core, hf is missing
    const { results } = verifyBundleIntegrity([core], manifest);
    const missingResult = results.find((r) => r.pack_id === 'hf');
    expect(missingResult?.valid).toBe(false);
    expect(missingResult?.message).toContain('not loaded');
  });
});
