/**
 * Reconfigure Policy Loader
 *
 * Loads reconfigure policies from YAML files.
 *
 * @module reconfigure-policy/loader
 */

import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import type { ReconfigurePolicy } from './types';

/**
 * Load reconfigure policies from a YAML file.
 *
 * @param filePath - Path to the YAML policy file
 * @returns Parsed array of ReconfigurePolicy
 */
export async function loadReconfigurePolicies(filePath: string): Promise<ReconfigurePolicy[]> {
  const content = await readFile(filePath, 'utf-8');
  const parsed = parse(content);

  if (!parsed || !Array.isArray(parsed.policies)) {
    throw new Error(`Invalid reconfigure policy file: expected { policies: [...] } in ${filePath}`);
  }

  return parsed.policies as ReconfigurePolicy[];
}
