import type { ScoringConfig } from '../config/schema.js';
import type { Severity, TranslationIssue } from '../types/issue.js';
import type { IssueSummary } from '../types/report.js';

export function summarizeIssues(
  issues: readonly Pick<TranslationIssue, 'severity'>[],
): IssueSummary {
  const summary: IssueSummary = { errors: 0, warnings: 0, info: 0, total: issues.length };
  for (const issue of issues) {
    if (issue.severity === 'error') {
      summary.errors++;
    } else if (issue.severity === 'warning') {
      summary.warnings++;
    } else {
      summary.info++;
    }
  }
  return summary;
}

export function mergeSummaries(summaries: readonly IssueSummary[]): IssueSummary {
  return summaries.reduce<IssueSummary>(
    (acc, s) => ({
      errors: acc.errors + s.errors,
      warnings: acc.warnings + s.warnings,
      info: acc.info + s.info,
      total: acc.total + s.total,
    }),
    { errors: 0, warnings: 0, info: 0, total: 0 },
  );
}

/** Total penalty points before scaling. */
export function totalPenalty(summary: IssueSummary, weights: ScoringConfig['weights']): number {
  return (
    summary.errors * weights.error +
    summary.warnings * weights.warning +
    summary.info * weights.info
  );
}

/**
 * Health score for one locale, 0–100.
 *
 * ```
 * scale   = baselineKeys / max(keyCount, baselineKeys)
 * penalty = errors × w.error + warnings × w.warning + info × w.info
 * score   = clamp(round(100 − penalty × scale), 0, 100)
 * ```
 *
 * With the default weights (5 / 2 / 0.25) and baseline of 100 keys, one error
 * costs 5 points in a 100-key locale and 0.5 points in a 1,000-key locale.
 * The function is pure and deterministic. See docs/scoring.md.
 */
export function computeScore(
  summary: IssueSummary,
  keyCount: number,
  scoring: ScoringConfig,
): number {
  const scale = scoring.baselineKeys / Math.max(keyCount, scoring.baselineKeys);
  const penalty = totalPenalty(summary, scoring.weights) * scale;
  const score = Math.round(100 - penalty);
  return Math.min(100, Math.max(0, score));
}

/** Rounded mean of locale scores; 100 when there are none. */
export function overallScore(scores: readonly number[]): number {
  if (scores.length === 0) {
    return 100;
  }
  const sum = scores.reduce((acc, score) => acc + score, 0);
  return Math.round(sum / scores.length);
}

const SEVERITY_RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

export function severityRank(severity: Severity): number {
  return SEVERITY_RANK[severity];
}

/** The lower (less severe) of two severities. */
export function minSeverity(a: Severity, b: Severity): Severity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

/**
 * Whether a summary crosses the configured failure threshold.
 * `failOn: 'warning'` fails on warnings *and* errors; `never` never fails.
 */
export function exceedsThreshold(
  summary: IssueSummary,
  failOn: 'error' | 'warning' | 'info' | 'never',
): boolean {
  switch (failOn) {
    case 'never':
      return false;
    case 'error':
      return summary.errors > 0;
    case 'warning':
      return summary.errors > 0 || summary.warnings > 0;
    case 'info':
      return summary.total > 0;
  }
}
