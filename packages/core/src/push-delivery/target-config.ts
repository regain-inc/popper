/**
 * Target Configuration
 *
 * Loads ControlTarget definitions from environment variables or YAML files.
 *
 * @module push-delivery/target-config
 */

import { parse as parseYaml } from 'yaml';
import type { ControlTarget } from './http-client';

/**
 * Load a single ControlTarget from environment variables.
 *
 * Expected env vars:
 * - DEUTSCH_CONTROL_ENDPOINT (required)
 * - DEUTSCH_INSTANCE_ID (required)
 * - DEUTSCH_ORGANIZATION_ID (required)
 * - POPPER_PUSH_API_KEY (required)
 *
 * Returns an empty array if DEUTSCH_CONTROL_ENDPOINT is not set.
 */
export function loadTargetsFromEnv(): ControlTarget[] {
  const endpoint = process.env.DEUTSCH_CONTROL_ENDPOINT;
  if (!endpoint) {
    return [];
  }

  const instanceId = process.env.DEUTSCH_INSTANCE_ID;
  const organizationId = process.env.DEUTSCH_ORGANIZATION_ID;
  const apiKey = process.env.POPPER_PUSH_API_KEY;

  if (!instanceId || !organizationId || !apiKey) {
    return [];
  }

  return [
    {
      instance_id: instanceId,
      organization_id: organizationId,
      control_endpoint: endpoint,
      auth: { mode: 'api_key', api_key: apiKey },
    },
  ];
}

/** YAML structure for control targets */
interface YamlTargetAuth {
  mode: 'api_key' | 'mtls';
  api_key?: string;
  cert_path?: string;
  key_path?: string;
  ca_path?: string;
}

interface YamlTarget {
  instance_id: string;
  organization_id: string;
  control_endpoint: string;
  auth: YamlTargetAuth;
}

interface YamlConfig {
  control_targets: YamlTarget[];
}

/**
 * Load ControlTarget definitions from a YAML string.
 *
 * Expected YAML structure:
 * ```yaml
 * control_targets:
 *   - instance_id: deutsch-1
 *     organization_id: org-1
 *     control_endpoint: https://...
 *     auth:
 *       mode: api_key
 *       api_key: xxx
 * ```
 */
export function loadTargetsFromYaml(yamlContent: string): ControlTarget[] {
  const config = parseYaml(yamlContent) as YamlConfig;

  if (!config?.control_targets || !Array.isArray(config.control_targets)) {
    return [];
  }

  return config.control_targets.map((entry): ControlTarget => {
    const base = {
      instance_id: entry.instance_id,
      organization_id: entry.organization_id,
      control_endpoint: entry.control_endpoint,
    };

    if (entry.auth.mode === 'mtls') {
      return {
        ...base,
        auth: {
          mode: 'mtls',
          cert_path: entry.auth.cert_path ?? '',
          key_path: entry.auth.key_path ?? '',
          ca_path: entry.auth.ca_path,
        },
      };
    }

    return {
      ...base,
      auth: {
        mode: 'api_key',
        api_key: entry.auth.api_key ?? '',
      },
    };
  });
}
