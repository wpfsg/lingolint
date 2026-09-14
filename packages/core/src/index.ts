/**
 * @lingolint/core
 *
 * The LingoLint QA engine. Pure TypeScript with no filesystem or network
 * access, so it runs identically in the CLI, in CI, in the browser and in
 * tests.
 *
 * ```ts
 * import { analyzeTranslations } from '@lingolint/core';
 *
 * const report = await analyzeTranslations({
 *   sourceLocale: 'en',
 *   targetLocale: 'es',
 *   source: { save: 'Save', total: 'Total: {amount}' },
 *   target: { save: 'Guardar', total: 'Total:' },
 * });
 * report.issues[0].message; // "Missing placeholder: {amount}"
 * ```
 */
export * from './analysis/index.js';
export * from './config/index.js';
export * from './engine/index.js';
export * from './parser/index.js';
export * from './rules/index.js';
export * from './types/index.js';
export { compileKeyMatcher } from './utils/key-pattern.js';
export { languageOf, localeDisplayName, sameLanguage } from './utils/locale.js';
export { charLength, hasLetters, sortKeys, truncate } from './utils/text.js';
