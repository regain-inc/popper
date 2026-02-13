/**
 * Target Config Tests
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { loadTargetsFromEnv, loadTargetsFromYaml } from './target-config';

// =============================================================================
// Tests: loadTargetsFromEnv
// =============================================================================

describe('loadTargetsFromEnv', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant env vars
    delete process.env.DEUTSCH_CONTROL_ENDPOINT;
    delete process.env.DEUTSCH_INSTANCE_ID;
    delete process.env.DEUTSCH_ORGANIZATION_ID;
    delete process.env.POPPER_PUSH_API_KEY;
  });

  afterEach(() => {
    // Restore original env
    process.env.DEUTSCH_CONTROL_ENDPOINT = originalEnv.DEUTSCH_CONTROL_ENDPOINT;
    process.env.DEUTSCH_INSTANCE_ID = originalEnv.DEUTSCH_INSTANCE_ID;
    process.env.DEUTSCH_ORGANIZATION_ID = originalEnv.DEUTSCH_ORGANIZATION_ID;
    process.env.POPPER_PUSH_API_KEY = originalEnv.POPPER_PUSH_API_KEY;
  });

  test('returns 1 target when all vars set', () => {
    process.env.DEUTSCH_CONTROL_ENDPOINT = 'https://deutsch.example.com/v1/deutsch/control';
    process.env.DEUTSCH_INSTANCE_ID = 'deutsch-1';
    process.env.DEUTSCH_ORGANIZATION_ID = 'org-1';
    process.env.POPPER_PUSH_API_KEY = 'secret-key-123';

    const targets = loadTargetsFromEnv();

    expect(targets).toHaveLength(1);
    expect(targets[0].instance_id).toBe('deutsch-1');
    expect(targets[0].organization_id).toBe('org-1');
    expect(targets[0].control_endpoint).toBe('https://deutsch.example.com/v1/deutsch/control');
    expect(targets[0].auth).toEqual({ mode: 'api_key', api_key: 'secret-key-123' });
  });

  test('returns empty array when DEUTSCH_CONTROL_ENDPOINT not set', () => {
    process.env.DEUTSCH_INSTANCE_ID = 'deutsch-1';
    process.env.DEUTSCH_ORGANIZATION_ID = 'org-1';
    process.env.POPPER_PUSH_API_KEY = 'secret-key-123';

    const targets = loadTargetsFromEnv();

    expect(targets).toHaveLength(0);
  });

  test('returns empty array when DEUTSCH_INSTANCE_ID not set', () => {
    process.env.DEUTSCH_CONTROL_ENDPOINT = 'https://deutsch.example.com/v1/deutsch/control';
    process.env.DEUTSCH_ORGANIZATION_ID = 'org-1';
    process.env.POPPER_PUSH_API_KEY = 'secret-key-123';

    const targets = loadTargetsFromEnv();

    expect(targets).toHaveLength(0);
  });

  test('returns empty array when DEUTSCH_ORGANIZATION_ID not set', () => {
    process.env.DEUTSCH_CONTROL_ENDPOINT = 'https://deutsch.example.com/v1/deutsch/control';
    process.env.DEUTSCH_INSTANCE_ID = 'deutsch-1';
    process.env.POPPER_PUSH_API_KEY = 'secret-key-123';

    const targets = loadTargetsFromEnv();

    expect(targets).toHaveLength(0);
  });

  test('returns empty array when POPPER_PUSH_API_KEY not set', () => {
    process.env.DEUTSCH_CONTROL_ENDPOINT = 'https://deutsch.example.com/v1/deutsch/control';
    process.env.DEUTSCH_INSTANCE_ID = 'deutsch-1';
    process.env.DEUTSCH_ORGANIZATION_ID = 'org-1';

    const targets = loadTargetsFromEnv();

    expect(targets).toHaveLength(0);
  });

  test('returns empty array when no env vars set', () => {
    const targets = loadTargetsFromEnv();
    expect(targets).toHaveLength(0);
  });
});

// =============================================================================
// Tests: loadTargetsFromYaml
// =============================================================================

describe('loadTargetsFromYaml', () => {
  test('loads single target with api_key auth', () => {
    const yaml = `
control_targets:
  - instance_id: deutsch-1
    organization_id: org-1
    control_endpoint: https://deutsch.example.com/v1/deutsch/control
    auth:
      mode: api_key
      api_key: secret-key-123
`;

    const targets = loadTargetsFromYaml(yaml);

    expect(targets).toHaveLength(1);
    expect(targets[0].instance_id).toBe('deutsch-1');
    expect(targets[0].organization_id).toBe('org-1');
    expect(targets[0].control_endpoint).toBe('https://deutsch.example.com/v1/deutsch/control');
    expect(targets[0].auth).toEqual({ mode: 'api_key', api_key: 'secret-key-123' });
  });

  test('loads multiple targets', () => {
    const yaml = `
control_targets:
  - instance_id: deutsch-1
    organization_id: org-1
    control_endpoint: https://a.example.com/v1/deutsch/control
    auth:
      mode: api_key
      api_key: key-1
  - instance_id: deutsch-2
    organization_id: org-2
    control_endpoint: https://b.example.com/v1/deutsch/control
    auth:
      mode: api_key
      api_key: key-2
`;

    const targets = loadTargetsFromYaml(yaml);

    expect(targets).toHaveLength(2);
    expect(targets[0].instance_id).toBe('deutsch-1');
    expect(targets[0].organization_id).toBe('org-1');
    expect(targets[1].instance_id).toBe('deutsch-2');
    expect(targets[1].organization_id).toBe('org-2');
  });

  test('loads target with mtls auth', () => {
    const yaml = `
control_targets:
  - instance_id: deutsch-prod
    organization_id: org-prod
    control_endpoint: https://deutsch.prod.internal/v1/deutsch/control
    auth:
      mode: mtls
      cert_path: /etc/certs/client.pem
      key_path: /etc/certs/client-key.pem
      ca_path: /etc/certs/ca.pem
`;

    const targets = loadTargetsFromYaml(yaml);

    expect(targets).toHaveLength(1);
    expect(targets[0].instance_id).toBe('deutsch-prod');
    expect(targets[0].auth).toEqual({
      mode: 'mtls',
      cert_path: '/etc/certs/client.pem',
      key_path: '/etc/certs/client-key.pem',
      ca_path: '/etc/certs/ca.pem',
    });
  });

  test('loads mtls target without ca_path', () => {
    const yaml = `
control_targets:
  - instance_id: deutsch-staging
    organization_id: org-staging
    control_endpoint: https://deutsch.staging.internal/v1/deutsch/control
    auth:
      mode: mtls
      cert_path: /etc/certs/client.pem
      key_path: /etc/certs/client-key.pem
`;

    const targets = loadTargetsFromYaml(yaml);

    expect(targets).toHaveLength(1);
    expect(targets[0].auth).toEqual({
      mode: 'mtls',
      cert_path: '/etc/certs/client.pem',
      key_path: '/etc/certs/client-key.pem',
      ca_path: undefined,
    });
  });

  test('returns empty array for missing control_targets key', () => {
    const yaml = `
other_key: value
`;

    const targets = loadTargetsFromYaml(yaml);
    expect(targets).toHaveLength(0);
  });

  test('returns empty array for empty YAML', () => {
    const targets = loadTargetsFromYaml('');
    expect(targets).toHaveLength(0);
  });

  test('loads mixed auth modes', () => {
    const yaml = `
control_targets:
  - instance_id: deutsch-1
    organization_id: org-1
    control_endpoint: https://a.example.com/v1/deutsch/control
    auth:
      mode: api_key
      api_key: key-1
  - instance_id: deutsch-2
    organization_id: org-2
    control_endpoint: https://b.internal/v1/deutsch/control
    auth:
      mode: mtls
      cert_path: /certs/client.pem
      key_path: /certs/key.pem
`;

    const targets = loadTargetsFromYaml(yaml);

    expect(targets).toHaveLength(2);
    expect(targets[0].auth.mode).toBe('api_key');
    expect(targets[1].auth.mode).toBe('mtls');
  });
});
