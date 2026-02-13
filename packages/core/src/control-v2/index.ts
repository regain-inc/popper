/**
 * Control v2 module
 *
 * ControlCommandV2 builder and related utilities.
 *
 * @module control-v2
 */

export {
  type BuildCommandOptions,
  buildControlCommandV2,
  buildGetStateCommand,
  buildSafeModeCommand,
} from './builder';
// Conformance test fixtures
export * from './fixtures';
export type {
  CommandPriority,
  ControlCommandV2,
  ControlCommandV2Kind,
  ModeTransition,
  OperationalMode,
  OperationalSettingChange,
  SafeModeConfigV2,
  SettingValue,
} from './types';
