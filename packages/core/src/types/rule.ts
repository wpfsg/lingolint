import type { ZodType } from 'zod';
import type { GlossaryEntry } from './glossary.js';
import type { IssueType, JsonValue, RuleSeverity, Severity, TranslationIssue } from './issue.js';
import type { FlatTranslations } from './translations.js';

/**
 * Everything a rule needs to analyze one target locale against the source.
 *
 * Contexts are built once per locale by the engine, so rules can freely iterate
 * the pre-sorted key lists without recomputing them.
 */
export interface RuleContext<Options = unknown> {
  sourceLocale: string;
  targetLocale: string;
  source: FlatTranslations;
  target: FlatTranslations;
  /** Keys present in the source, sorted. */
  sourceKeys: readonly string[];
  /** Keys present in the target, sorted. */
  targetKeys: readonly string[];
  /** Keys present in both source and target, sorted. */
  sharedKeys: readonly string[];
  /** Validated options for this rule (defaults already applied). */
  options: Options;
  glossary: readonly GlossaryEntry[];
  /** Whether the key matches a configured `ignoreKeys` pattern. */
  isIgnored(key: string): boolean;
}

/**
 * An issue as reported by a rule. The engine fills in `id`, `locale`, `rule`,
 * `origin` and the configured `severity`.
 */
export interface RuleIssue {
  key: string;
  /** Defaults to the rule's issue type. */
  type?: IssueType;
  message: string;
  explanation?: string;
  suggestion?: string;
  sourceText?: string;
  translatedText?: string;
  confidence?: number;
  relatedKeys?: string[];
  details?: Record<string, JsonValue>;
  /**
   * Upper bound for the severity of this particular finding. The engine uses
   * the lower of the configured severity and this value, which lets a rule
   * downgrade low-confidence findings (e.g. to `info`) without ever escalating.
   */
  maxSeverity?: Severity;
}

/**
 * A deterministic QA rule.
 *
 * Rules are pure functions of their context: no I/O, no randomness, no shared
 * state. That keeps them trivially testable and lets the engine run locales in
 * parallel.
 */
export interface QARule<Options = unknown> {
  /** Config key, camelCase (e.g. `missingKey`, `placeholders`). */
  name: string;
  /** Issue type produced by default. */
  type: IssueType;
  /** One-line, user-facing description. */
  description: string;
  defaultSeverity: RuleSeverity;
  /**
   * Zod schema for the rule's options. Must accept `{}` and produce fully
   * defaulted options so users can enable a rule with just a severity.
   */
  optionsSchema: ZodType<Options>;
  run(context: RuleContext<Options>): RuleIssue[];
}

/** Type helper for defining rules with inferred option types. */
export function defineRule<Options>(rule: QARule<Options>): QARule<Options> {
  return rule;
}

export type IssueWithoutId = Omit<TranslationIssue, 'id'>;
