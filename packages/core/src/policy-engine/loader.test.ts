/**
 * Policy Pack Loader Tests
 */

import { afterEach, describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { loadPolicyPack, PolicyPackRegistry, policyRegistry } from './loader';
import { PolicyParseError } from './parser';

// Bun API: import.meta.dir gives current file's directory
const PROJECT_ROOT = join(import.meta.dir, '..', '..', '..', '..');
const DEFAULT_POLICY_PATH = join(PROJECT_ROOT, 'config', 'policies', 'default.yaml');

describe('Policy Pack Loader', () => {
  describe('loadPolicyPack', () => {
    test('loads default policy pack from YAML', async () => {
      const pack = await loadPolicyPack(DEFAULT_POLICY_PATH);

      expect(pack.policy_id).toBe('popper-default');
      expect(pack.policy_version).toBe('1.0.0');
      expect(pack.rules.length).toBeGreaterThan(0);
      expect(pack.staleness).toBeDefined();
      expect(pack.staleness?.thresholds.wellness_hours).toBe(24);
      expect(pack.staleness?.thresholds.clinical_hours).toBe(4);
    });

    test('throws on non-existent file', async () => {
      await expect(loadPolicyPack('/nonexistent/path.yaml')).rejects.toThrow(PolicyParseError);
    });

    test('throws on unsupported file extension', async () => {
      await expect(loadPolicyPack('/some/file.txt')).rejects.toThrow(PolicyParseError);
    });
  });

  describe('PolicyPackRegistry', () => {
    let registry: PolicyPackRegistry;

    afterEach(() => {
      registry = new PolicyPackRegistry();
    });

    test('registers and retrieves policy packs', () => {
      registry = new PolicyPackRegistry();
      const pack = {
        policy_id: 'test-pack',
        policy_version: '1.0.0',
        rules: [],
      };

      registry.register(pack);

      expect(registry.has('test-pack')).toBe(true);
      expect(registry.get('test-pack')).toBe(pack);
    });

    test('sets first registered pack as default', () => {
      registry = new PolicyPackRegistry();
      const pack1 = { policy_id: 'pack-1', policy_version: '1.0.0', rules: [] };
      const pack2 = { policy_id: 'pack-2', policy_version: '1.0.0', rules: [] };

      registry.register(pack1);
      registry.register(pack2);

      expect(registry.getDefault()).toBe(pack1);
    });

    test('can set default explicitly', () => {
      registry = new PolicyPackRegistry();
      const pack1 = { policy_id: 'pack-1', policy_version: '1.0.0', rules: [] };
      const pack2 = { policy_id: 'pack-2', policy_version: '1.0.0', rules: [] };

      registry.register(pack1);
      registry.register(pack2);
      registry.setDefault('pack-2');

      expect(registry.getDefault()).toBe(pack2);
    });

    test('can register with setAsDefault flag', () => {
      registry = new PolicyPackRegistry();
      const pack1 = { policy_id: 'pack-1', policy_version: '1.0.0', rules: [] };
      const pack2 = { policy_id: 'pack-2', policy_version: '1.0.0', rules: [] };

      registry.register(pack1);
      registry.register(pack2, true);

      expect(registry.getDefault()).toBe(pack2);
    });

    test('throws when getting default with no packs', () => {
      registry = new PolicyPackRegistry();
      expect(() => registry.getDefault()).toThrow('No policy packs registered');
    });

    test('throws when setting non-existent default', () => {
      registry = new PolicyPackRegistry();
      expect(() => registry.setDefault('non-existent')).toThrow();
    });

    test('lists all registered pack IDs', () => {
      registry = new PolicyPackRegistry();
      registry.register({ policy_id: 'pack-1', policy_version: '1.0.0', rules: [] });
      registry.register({ policy_id: 'pack-2', policy_version: '1.0.0', rules: [] });
      registry.register({ policy_id: 'pack-3', policy_version: '1.0.0', rules: [] });

      const ids = registry.list();
      expect(ids).toContain('pack-1');
      expect(ids).toContain('pack-2');
      expect(ids).toContain('pack-3');
      expect(ids).toHaveLength(3);
    });

    test('returns all registered packs', () => {
      registry = new PolicyPackRegistry();
      const pack1 = { policy_id: 'pack-1', policy_version: '1.0.0', rules: [] };
      const pack2 = { policy_id: 'pack-2', policy_version: '1.0.0', rules: [] };

      registry.register(pack1);
      registry.register(pack2);

      const packs = registry.all();
      expect(packs).toContain(pack1);
      expect(packs).toContain(pack2);
      expect(packs).toHaveLength(2);
    });

    test('clears all registered packs', () => {
      registry = new PolicyPackRegistry();
      registry.register({ policy_id: 'pack-1', policy_version: '1.0.0', rules: [] });
      registry.register({ policy_id: 'pack-2', policy_version: '1.0.0', rules: [] });

      registry.clear();

      expect(registry.list()).toHaveLength(0);
      expect(registry.has('pack-1')).toBe(false);
    });

    test('loads and registers from file', async () => {
      registry = new PolicyPackRegistry();

      const pack = await registry.loadAndRegister(DEFAULT_POLICY_PATH);

      expect(pack.policy_id).toBe('popper-default');
      expect(registry.has('popper-default')).toBe(true);
      expect(registry.getDefault()).toBe(pack);
    });
  });

  describe('Global Registry', () => {
    afterEach(() => {
      policyRegistry.clear();
    });

    test('global registry is available', () => {
      expect(policyRegistry).toBeInstanceOf(PolicyPackRegistry);
    });

    test('can register to global registry', () => {
      const pack = { policy_id: 'global-test', policy_version: '1.0.0', rules: [] };
      policyRegistry.register(pack);

      expect(policyRegistry.has('global-test')).toBe(true);
    });
  });
});
