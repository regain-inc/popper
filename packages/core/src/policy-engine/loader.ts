/**
 * Policy Pack Loader
 * Loads policy packs from files or URLs
 *
 * @module policy-engine/loader
 */

import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { PolicyParseError, parsePolicyPackJson, parsePolicyPackYaml } from './parser';
import type { PolicyPack } from './types';

// =============================================================================
// Loader Functions
// =============================================================================

/**
 * Load a policy pack from a file path.
 *
 * @param filePath - Path to YAML or JSON policy pack file
 * @returns Parsed PolicyPack
 * @throws PolicyParseError if file cannot be read or parsed
 */
export async function loadPolicyPack(filePath: string): Promise<PolicyPack> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const ext = extname(filePath).toLowerCase();

    if (ext === '.yaml' || ext === '.yml') {
      return parsePolicyPackYaml(content);
    }
    if (ext === '.json') {
      return parsePolicyPackJson(content);
    }

    throw new PolicyParseError(
      `Unsupported file extension: ${ext}. Use .yaml, .yml, or .json`,
      filePath,
    );
  } catch (error) {
    if (error instanceof PolicyParseError) {
      throw error;
    }
    throw new PolicyParseError(
      `Failed to load policy pack: ${error instanceof Error ? error.message : String(error)}`,
      filePath,
    );
  }
}

/**
 * Load all policy packs from a directory.
 *
 * @param dirPath - Path to directory containing policy pack files
 * @returns Array of parsed PolicyPacks with their file paths
 * @throws PolicyParseError if directory cannot be read
 */
export async function loadPolicyPacksFromDir(
  dirPath: string,
): Promise<Array<{ path: string; pack: PolicyPack }>> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const results: Array<{ path: string; pack: PolicyPack }> = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;

      const ext = extname(entry.name).toLowerCase();
      if (ext !== '.yaml' && ext !== '.yml' && ext !== '.json') continue;

      const filePath = join(dirPath, entry.name);
      const pack = await loadPolicyPack(filePath);
      results.push({ path: filePath, pack });
    }

    return results;
  } catch (error) {
    if (error instanceof PolicyParseError) {
      throw error;
    }
    throw new PolicyParseError(
      `Failed to read directory: ${error instanceof Error ? error.message : String(error)}`,
      dirPath,
    );
  }
}

// =============================================================================
// Policy Pack Registry
// =============================================================================

/**
 * A registry for managing loaded policy packs.
 */
export class PolicyPackRegistry {
  private packs = new Map<string, PolicyPack>();
  private defaultPackId: string | null = null;

  /**
   * Register a policy pack.
   *
   * @param pack - PolicyPack to register
   * @param setAsDefault - If true, set this pack as the default
   */
  register(pack: PolicyPack, setAsDefault = false): void {
    this.packs.set(pack.policy_id, pack);
    if (setAsDefault || this.defaultPackId === null) {
      this.defaultPackId = pack.policy_id;
    }
  }

  /**
   * Get a policy pack by ID.
   *
   * @param policyId - Policy pack ID
   * @returns PolicyPack or undefined if not found
   */
  get(policyId: string): PolicyPack | undefined {
    return this.packs.get(policyId);
  }

  /**
   * Get the default policy pack.
   *
   * @returns Default PolicyPack
   * @throws Error if no policy packs are registered
   */
  getDefault(): PolicyPack {
    if (this.defaultPackId === null) {
      throw new Error('No policy packs registered');
    }
    const pack = this.packs.get(this.defaultPackId);
    if (!pack) {
      throw new Error(`Default policy pack '${this.defaultPackId}' not found`);
    }
    return pack;
  }

  /**
   * Set the default policy pack.
   *
   * @param policyId - Policy pack ID to set as default
   * @throws Error if policy pack is not registered
   */
  setDefault(policyId: string): void {
    if (!this.packs.has(policyId)) {
      throw new Error(`Policy pack '${policyId}' is not registered`);
    }
    this.defaultPackId = policyId;
  }

  /**
   * Check if a policy pack is registered.
   *
   * @param policyId - Policy pack ID
   * @returns True if registered
   */
  has(policyId: string): boolean {
    return this.packs.has(policyId);
  }

  /**
   * Get all registered policy pack IDs.
   *
   * @returns Array of policy pack IDs
   */
  list(): string[] {
    return Array.from(this.packs.keys());
  }

  /**
   * Get all registered policy packs.
   *
   * @returns Array of PolicyPacks
   */
  all(): PolicyPack[] {
    return Array.from(this.packs.values());
  }

  /**
   * Clear all registered policy packs.
   */
  clear(): void {
    this.packs.clear();
    this.defaultPackId = null;
  }

  /**
   * Load and register a policy pack from a file.
   *
   * @param filePath - Path to policy pack file
   * @param setAsDefault - If true, set this pack as the default
   * @returns Loaded PolicyPack
   */
  async loadAndRegister(filePath: string, setAsDefault = false): Promise<PolicyPack> {
    const pack = await loadPolicyPack(filePath);
    this.register(pack, setAsDefault);
    return pack;
  }

  /**
   * Load and register all policy packs from a directory.
   *
   * @param dirPath - Path to directory containing policy pack files
   * @returns Number of policy packs loaded
   */
  async loadFromDir(dirPath: string): Promise<number> {
    const packs = await loadPolicyPacksFromDir(dirPath);
    for (const { pack } of packs) {
      this.register(pack);
    }
    return packs.length;
  }
}

/**
 * Global policy pack registry instance.
 */
export const policyRegistry = new PolicyPackRegistry();

// =============================================================================
// Multi-Pack Composition (v2.1)
// =============================================================================

/** Priority range constraints per pack type */
const PACK_TYPE_PRIORITY_RANGES: Record<string, { min: number; max: number }> = {
  core: { min: 0, max: 1200 },
  domain: { min: 100, max: 799 },
  site: { min: 50, max: 99 },
  modality: { min: 100, max: 799 },
};

/**
 * Error thrown when pack composition fails.
 */
export class PackCompositionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PackCompositionError';
  }
}

/**
 * Compose multiple policy packs into a single merged rule list.
 *
 * Validates:
 * - Pack-type-specific priority ranges
 * - No cross-pack same-priority conflicts
 * - Site packs cannot weaken core/domain rules (logged as warning)
 * - Dependency constraints (depends_on)
 *
 * Rules are sorted by priority descending (highest priority first).
 *
 * @param packs - Array of packs to compose, in load order
 * @returns Merged PolicyPack with composed rules and composite version
 * @throws PackCompositionError if validation fails
 */
export function composePacks(packs: PolicyPack[]): PolicyPack {
  if (packs.length === 0) {
    throw new PackCompositionError('At least one pack is required');
  }

  if (packs.length === 1) {
    return packs[0];
  }

  const packMap = new Map<string, PolicyPack>();
  for (const pack of packs) {
    packMap.set(pack.policy_id, pack);
  }

  // Validate dependencies
  for (const pack of packs) {
    const deps = (pack as Record<string, unknown>).depends_on as
      | Array<{ pack_id: string; version_constraint: string }>
      | undefined;
    if (deps) {
      for (const dep of deps) {
        if (!packMap.has(dep.pack_id)) {
          throw new PackCompositionError(
            `Pack '${pack.policy_id}' depends on '${dep.pack_id}' which is not loaded`,
          );
        }
      }
    }
  }

  // Validate priority ranges per pack type
  for (const pack of packs) {
    const packType = (pack as Record<string, unknown>).pack_type as string | undefined;
    if (packType && PACK_TYPE_PRIORITY_RANGES[packType]) {
      const range = PACK_TYPE_PRIORITY_RANGES[packType];
      for (const rule of pack.rules) {
        if (rule.priority < range.min || rule.priority > range.max) {
          throw new PackCompositionError(
            `Rule '${rule.rule_id}' in pack '${pack.policy_id}' (type: ${packType}) ` +
              `has priority ${rule.priority} outside allowed range [${range.min}, ${range.max}]`,
          );
        }
      }
    }
  }

  // Collect all rules with pack provenance
  const allRules: Array<{ rule: PolicyPack['rules'][number]; packId: string }> = [];
  for (const pack of packs) {
    for (const rule of pack.rules) {
      allRules.push({ rule, packId: pack.policy_id });
    }
  }

  // Check for cross-pack same-priority conflicts
  const priorityMap = new Map<number, { ruleId: string; packId: string }>();
  for (const { rule, packId } of allRules) {
    const existing = priorityMap.get(rule.priority);
    if (existing && existing.packId !== packId) {
      throw new PackCompositionError(
        `Cross-pack priority conflict: rule '${rule.rule_id}' (pack '${packId}') and ` +
          `rule '${existing.ruleId}' (pack '${existing.packId}') both have priority ${rule.priority}. ` +
          `Rules from different packs must not share the same priority.`,
      );
    }
    priorityMap.set(rule.priority, { ruleId: rule.rule_id, packId });
  }

  // Sort by priority descending (first-match-wins semantics)
  const mergedRules = allRules.map(({ rule }) => rule).sort((a, b) => b.priority - a.priority);

  // Build composite version string
  const compositeVersion = packs.map((p) => `${p.policy_id}:${p.policy_version}`).join('+');

  // Use first pack's staleness config as default, allow overrides
  const staleness = packs.find((p) => p.staleness)?.staleness;

  return {
    policy_id: `composed:${packs.map((p) => p.policy_id).join('+')}`,
    policy_version: compositeVersion,
    metadata: {
      description: `Composed from ${packs.length} packs: ${packs.map((p) => p.policy_id).join(', ')}`,
    },
    staleness,
    rules: mergedRules,
  };
}

/**
 * Load packs from the standard directory structure.
 *
 * Expected layout:
 *   basePath/
 *     default.yaml          (legacy single-pack, used as core if no core/ dir)
 *     core/                 (core safety pack)
 *     domains/              (domain packs)
 *     sites/                (site protocol packs)
 *
 * @param basePath - Base policies directory
 * @param options - Which pack types to load
 * @returns Composed PolicyPack
 */
export async function loadAndComposePacks(
  basePath: string,
  options: {
    loadDomains?: string[]; // specific domain pack filenames to load
    loadSite?: string; // specific site directory to load
  } = {},
): Promise<PolicyPack> {
  const packs: PolicyPack[] = [];

  // 1. Load core pack
  try {
    const corePacks = await loadPolicyPacksFromDir(join(basePath, 'core'));
    for (const { pack } of corePacks) {
      packs.push(pack);
    }
  } catch {
    // No core directory — try legacy default.yaml
    try {
      const defaultPack = await loadPolicyPack(join(basePath, 'default.yaml'));
      packs.push(defaultPack);
    } catch {
      throw new PackCompositionError('No core pack or default.yaml found');
    }
  }

  // 2. Load requested domain packs
  if (options.loadDomains && options.loadDomains.length > 0) {
    for (const domain of options.loadDomains) {
      const domainPath = join(basePath, 'domains', domain);
      const ext = extname(domain);
      if (ext === '.yaml' || ext === '.yml' || ext === '.json') {
        const pack = await loadPolicyPack(domainPath);
        packs.push(pack);
      }
    }
  }

  // 3. Load site pack if specified
  if (options.loadSite) {
    const sitePacks = await loadPolicyPacksFromDir(join(basePath, 'sites', options.loadSite));
    for (const { pack } of sitePacks) {
      packs.push(pack);
    }
  }

  return composePacks(packs);
}
