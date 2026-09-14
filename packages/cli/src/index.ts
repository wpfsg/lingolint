/**
 * Programmatic access to the LingoLint CLI. Most integrations should use
 * `@lingolint/core` directly; this entry point is for embedding the CLI
 * itself (custom runners, editor extensions, tests).
 */
// Re-exported so config files can `import { defineConfig } from 'lingolint'`.
export { defineConfig, type LingoLintConfig } from '@lingolint/core';
export { buildProgram, run } from './cli.js';
export { mergeOptions, scan, type ScanOptions, type ScanResult } from './commands/scan.js';
export {
  CONFIG_FILE_NAMES,
  findConfigFile,
  loadConfig,
  type LoadedConfig,
} from './config/load-config.js';
export { CliError } from './errors.js';
export { EXIT_ERROR, EXIT_ISSUES, EXIT_OK } from './exit-codes.js';
export { processIO, shouldUseColor, type CliIO } from './io.js';
export {
  loadLocales,
  localeFromFileName,
  type LoadedLocaleFile,
  type LoadedLocales,
} from './locales/load-locales.js';
export * from './reporters/index.js';
export { TOOL_NAME, toolVersion } from './version.js';
