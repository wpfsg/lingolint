import { z } from 'zod';
import { AI_ISSUE_TYPES } from '../types/issue.js';

export const severitySchema = z.enum(['error', 'warning', 'info']);
export const ruleSeveritySchema = z.enum(['error', 'warning', 'info', 'off']);
export const failOnSchema = z.enum(['error', 'warning', 'info', 'never']);

/**
 * A rule setting, ESLint style: either a severity or `[severity, options]`.
 *
 * ```ts
 * rules: {
 *   missingKey: 'error',
 *   length: ['warning', { maxRatio: 2.5 }],
 * }
 * ```
 */
export const ruleSettingSchema = z.union([
  ruleSeveritySchema,
  z.tuple([ruleSeveritySchema, z.record(z.string(), z.unknown())]),
]);
export type RuleSetting = z.infer<typeof ruleSettingSchema>;

const glossaryFullEntrySchema = z.strictObject({
  translations: z.record(z.string(), z.string()).optional(),
  doNotTranslate: z.boolean().optional(),
  caseSensitive: z.boolean().optional(),
  description: z.string().optional(),
});

/**
 * Glossary entry. Either the full form or a shorthand map of locale → translation:
 *
 * ```ts
 * glossary: {
 *   Withdrawal: { es: 'Retiro', de: 'Auszahlung' },
 *   API: { doNotTranslate: true },
 *   Wallet: { translations: { es: 'Cartera' }, description: 'The in-app crypto wallet' },
 * }
 * ```
 */
export const glossaryEntrySchema = z.union([
  glossaryFullEntrySchema,
  z.record(z.string(), z.string()),
]);
export type GlossaryEntryInput = z.input<typeof glossaryEntrySchema>;

export const scoringSchema = z.object({
  /** Points deducted per issue, calibrated for `baselineKeys` keys. */
  weights: z
    .object({
      error: z.number().nonnegative().default(5),
      warning: z.number().nonnegative().default(2),
      info: z.number().nonnegative().default(0.25),
    })
    .prefault({}),
  /**
   * Locales with more keys than this have their penalties scaled down
   * proportionally, so one mistake among 5,000 keys costs less than one
   * mistake among 50. Locales at or below the baseline use the raw weights.
   */
  baselineKeys: z.number().int().positive().default(100),
});

export const aiConfigSchema = z.object({
  enabled: z.boolean().default(false),
  /** Provider adapter name, e.g. `anthropic`. */
  provider: z.string().default('anthropic'),
  /** Provider-specific model identifier. Each adapter has a sensible default. */
  model: z.string().optional(),
  /** Strings per provider request. */
  batchSize: z.number().int().positive().max(200).default(25),
  /** Cache provider responses on disk to avoid repeating identical requests. */
  cache: z.boolean().default(true),
  /** Hard cap on strings reviewed per locale per run, for cost control. */
  maxItems: z.number().int().positive().optional(),
  /** Findings below this confidence are dropped entirely. */
  minConfidence: z.number().min(0).max(1).default(0.5),
  /** Findings below this confidence are reported as `info` regardless of rule severity. */
  infoBelowConfidence: z.number().min(0).max(1).default(0.75),
});

export const configSchema = z.object({
  sourceLocale: z.string().min(1).default('en'),
  /** Directory containing locale files, relative to the config file or cwd. */
  localesPath: z.string().min(1).default('./locales'),
  /** File name patterns to include (`*` wildcard). */
  include: z.array(z.string().min(1)).min(1).default(['*.json']),
  /** Restrict analysis to these target locales. Defaults to every non-source file. */
  targets: z.array(z.string().min(1)).optional(),
  /** Exit non-zero when an issue of this severity or higher is found. */
  failOn: failOnSchema.default('error'),
  /** Keys (or `*` patterns) to exclude from all per-key checks. */
  ignoreKeys: z.array(z.string().min(1)).default([]),
  rules: z.record(z.string(), ruleSettingSchema).default({}),
  glossary: z.record(z.string().min(1), glossaryEntrySchema).default({}),
  /** Free-text description of the product, passed to AI providers. */
  context: z.string().optional(),
  scoring: scoringSchema.prefault({}),
  ai: aiConfigSchema.prefault({}),
});

/** What users write in `lingolint.config.ts`. Every field is optional. */
export type LingoLintConfig = z.input<typeof configSchema>;
/** Configuration with all defaults applied. */
export type ResolvedConfig = z.output<typeof configSchema>;
export type ScoringConfig = z.output<typeof scoringSchema>;
export type AIConfig = z.output<typeof aiConfigSchema>;
export type FailOn = z.infer<typeof failOnSchema>;

/** Rule names that only carry a severity because the findings come from AI review. */
export const AI_RULE_NAMES: readonly string[] = AI_ISSUE_TYPES;

/** Identity helper that gives config files type checking and completion. */
export function defineConfig(config: LingoLintConfig): LingoLintConfig {
  return config;
}
