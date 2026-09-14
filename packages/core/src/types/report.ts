import type { TranslationIssue } from './issue.js';

export interface IssueSummary {
  errors: number;
  warnings: number;
  info: number;
  total: number;
}

/** Statistics about an optional AI review pass for one locale. */
export interface AIReviewStats {
  provider: string;
  /** Strings sent for review (after batching, before caching). */
  reviewed: number;
  /** Strings answered from cache without a provider call. */
  cached: number;
  /** Strings deliberately not sent (e.g. already failing a deterministic check). */
  skipped: number;
  /** Set when the AI pass failed. Deterministic results are still complete. */
  error?: string;
}

/** Result of analyzing one target locale against the source locale. */
export interface LocaleReport {
  sourceLocale: string;
  targetLocale: string;
  /** English display name, e.g. `Spanish`. Falls back to the code. */
  targetLocaleName: string;
  /** 0–100 health score. See docs/scoring.md. */
  score: number;
  /** Number of keys in the source locale. */
  keyCount: number;
  summary: IssueSummary;
  issues: TranslationIssue[];
  ai?: AIReviewStats;
}

/** Result of analyzing every target locale in a project. */
export interface ProjectReport {
  /** Bump when the shape of this report changes incompatibly. */
  schemaVersion: 1;
  sourceLocale: string;
  /** Rounded mean of the per-locale scores. 100 when there are no targets. */
  overallScore: number;
  summary: IssueSummary;
  locales: LocaleReport[];
}
