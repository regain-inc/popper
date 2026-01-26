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
