import type { JsonObject } from './issue.js';

/**
 * Translations flattened to dotted keys:
 *
 * ```json
 * { "account.settings.title": "Account settings" }
 * ```
 */
export type FlatTranslations = Record<string, string>;

/**
 * Translations as they appear in a locale file, possibly nested:
 *
 * ```json
 * { "account": { "settings": { "title": "Account settings" } } }
 * ```
 */
export type NestedTranslations = JsonObject;

/** Either shape is accepted as engine input; nested input is flattened internally. */
export type TranslationsInput = FlatTranslations | NestedTranslations;
