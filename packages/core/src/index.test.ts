import { describe, expect, test } from 'bun:test';
import { VERSION } from './index';

describe('core package', () => {
  test('exports VERSION', () => {
    expect(VERSION).toBe('0.1.0');
  });
});
