/**
 * Severity of a translation issue.
 *
 * - `error`   – the translation is broken and will misbehave in production
 *               (missing key, missing placeholder, broken HTML, ...).
 * - `warning` – the translation is suspicious and should be reviewed.
 * - `info`    – a suggestion; manual review may or may not be needed.
 */
export const SEVERITIES = ['error', 'warning', 'info'] as const;
export type Severity = (typeof SEVERITIES)[number];

/** A severity as configured for a rule. `off` disables the rule. */
export type RuleSeverity = Severity | 'off';

/**
 * Categories of translation issues.
 *
 * The first group is produced by deterministic rules that run locally.
 * The second group is produced by optional AI review.
 */
export const DETERMINISTIC_ISSUE_TYPES = [
  'missing_key',
  'extra_key',
  'empty_translation',
  'placeholder_mismatch',
  'html_mismatch',
  'whitespace',
  'identical_to_source',
  'length',
  'duplicate_translation',
  'terminology',
] as const;

export const AI_ISSUE_TYPES = [
  'semantic',
  'grammar',
  'terminology',
  'tone',
  'capitalization',
  'style',
] as const;

/** Every issue type, deterministic and AI, without duplicates. */
export const ISSUE_TYPES = [
  'missing_key',
  'extra_key',
  'empty_translation',
  'placeholder_mismatch',
  'html_mismatch',
  'whitespace',
  'identical_to_source',
  'length',
  'duplicate_translation',
  'terminology',
  'semantic',
  'grammar',
  'tone',
  'capitalization',
  'style',
] as const satisfies readonly (
  (typeof DETERMINISTIC_ISSUE_TYPES)[number] | (typeof AI_ISSUE_TYPES)[number]
)[];

export type IssueType = (typeof ISSUE_TYPES)[number];
export type AIIssueType = (typeof AI_ISSUE_TYPES)[number];

/** Where an issue came from. Deterministic issues never involve a network call. */
export type IssueOrigin = 'deterministic' | 'ai';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
export interface JsonObject {
  [key: string]: JsonValue;
}

/**
 * A single translation problem.
 *
 * This is the stable, machine-readable unit that the CLI (`--format json`),
 * the web UI and any future integrations consume. Add fields freely, but avoid
 * renaming or removing existing ones.
 */
export interface TranslationIssue {
  /** Deterministic identifier, stable across runs for the same input. */
  id: string;
  /** Target locale the issue belongs to (e.g. `es`). */
  locale: string;
  /** Flattened translation key (e.g. `checkout.total`). */
  key: string;
  /** Issue category. */
  type: IssueType;
  /** Name of the rule that reported the issue (e.g. `placeholders`, `ai`). */
  rule: string;
  severity: Severity;
  origin: IssueOrigin;
  /** Short, human-readable description of what is wrong. */
  message: string;
  /** Longer explanation of why this was flagged and what to do about it. */
  explanation?: string;
  /** A suggested replacement for the translated text, when one is known. */
  suggestion?: string;
  sourceText?: string;
  translatedText?: string;
  /** 0–1 confidence. Deterministic rules omit it or use 1. */
  confidence?: number;
  /** Other keys involved in the issue (e.g. keys sharing a duplicate translation). */
  relatedKeys?: string[];
  /** Structured, rule-specific data (e.g. the list of missing placeholders). */
  details?: Record<string, JsonValue>;
}
