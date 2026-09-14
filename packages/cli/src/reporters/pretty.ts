import type {
  FailOn,
  LocaleReport,
  ProjectReport,
  Severity,
  TranslationIssue,
} from '@lingolint/core';
import { createColors } from 'picocolors';
import { TOOL_NAME, toolVersion } from '../version.js';

export interface PrettyOptions {
  color: boolean;
  /** Show explanations and suggestions for every issue. */
  verbose: boolean;
  failOn: FailOn;
  passed: boolean;
  /** Maximum issues printed per locale; the rest are summarized. 0 = unlimited. */
  maxIssues: number;
}

const SYMBOL: Record<Severity, string> = { error: '✖', warning: '⚠', info: 'ℹ' };
const LABEL: Record<Severity, string> = { error: 'ERROR', warning: 'WARNING', info: 'INFO' };

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Quote a value so empty strings and edge whitespace are visible. */
function quote(value: string | undefined): string {
  if (value === undefined) {
    return '—';
  }
  return JSON.stringify(value);
}

export function formatPretty(report: ProjectReport, options: PrettyOptions): string {
  const c = createColors(options.color);
  const paint: Record<Severity, (text: string) => string> = {
    error: c.red,
    warning: c.yellow,
    info: c.blue,
  };
  const lines: string[] = [];
  const push = (line = ''): void => {
    lines.push(line);
  };

  push(`${c.bold(TOOL_NAME)} ${c.dim(`v${toolVersion()}`)}`);
  push();
  push(`${c.dim('Source:')}  ${report.sourceLocale}`);
  push(
    `${c.dim('Targets:')} ${report.locales.map((l) => l.targetLocale).join(', ') || c.dim('none')}`,
  );
  push();

  for (const locale of report.locales) {
    formatLocale(locale);
  }

  const { summary } = report;
  const scoreColor =
    report.overallScore >= 90 ? c.green : report.overallScore >= 70 ? c.yellow : c.red;
  push(`${c.bold('Overall health:')} ${scoreColor(c.bold(`${report.overallScore}/100`))}`);
  if (summary.total === 0) {
    push(c.green('✓ No issues found'));
  } else {
    push(
      [
        paint.error(`${SYMBOL.error} ${plural(summary.errors, 'error')}`),
        paint.warning(`${SYMBOL.warning} ${plural(summary.warnings, 'warning')}`),
        paint.info(`${SYMBOL.info} ${plural(summary.info, 'suggestion')}`),
      ].join(c.dim('  ·  ')) + c.dim(` across ${plural(report.locales.length, 'locale')}`),
    );
  }
  if (options.failOn !== 'never') {
    push(
      options.passed
        ? c.dim(`Threshold: fail on ${options.failOn} — passed`)
        : c.red(`Threshold: fail on ${options.failOn} — exceeded`),
    );
  }
  push();
  return lines.join('\n');

  function formatLocale(locale: LocaleReport): void {
    const scoreColor = locale.score >= 90 ? c.green : locale.score >= 70 ? c.yellow : c.red;
    push(
      `${c.bold(locale.targetLocaleName)} ${c.dim(`(${locale.targetLocale})`)} — ${scoreColor(c.bold(`${locale.score}/100`))}`,
    );
    push();
    if (locale.issues.length === 0) {
      push(c.green(`✓ ${plural(locale.keyCount, 'key')} checked, no issues`));
    } else {
      push(paint.error(`${SYMBOL.error} ${plural(locale.summary.errors, 'error')}`));
      push(paint.warning(`${SYMBOL.warning} ${plural(locale.summary.warnings, 'warning')}`));
      push(paint.info(`${SYMBOL.info} ${plural(locale.summary.info, 'suggestion')}`));
    }
    if (locale.ai) {
      push();
      if (locale.ai.error) {
        push(c.yellow(`⚠ AI review (${locale.ai.provider}) failed: ${locale.ai.error}`));
      } else {
        const cached = locale.ai.cached > 0 ? `, ${locale.ai.cached} from cache` : '';
        push(
          c.dim(
            `AI review (${locale.ai.provider}): ${plural(locale.ai.reviewed, 'string')} reviewed${cached}, ${locale.ai.skipped} skipped`,
          ),
        );
      }
    }
    push();

    const shown = options.maxIssues > 0 ? locale.issues.slice(0, options.maxIssues) : locale.issues;
    for (const issue of shown) {
      formatIssue(issue);
    }
    const hidden = locale.issues.length - shown.length;
    if (hidden > 0) {
      push(
        c.dim(
          `… ${plural(hidden, 'more issue')} not shown. Use --max-issues 0 to show all or --format json.`,
        ),
      );
      push();
    }
  }

  function formatIssue(issue: TranslationIssue): void {
    const tag = paint[issue.severity](`${SYMBOL[issue.severity]} ${LABEL[issue.severity]}`);
    const origin = issue.origin === 'ai' ? c.magenta(' AI') : '';
    const confidence =
      issue.confidence !== undefined && issue.confidence < 1
        ? c.dim(`  confidence ${Math.round(issue.confidence * 100)}%`)
        : '';
    push(`${tag}${origin}  ${c.bold(issue.key)}${confidence}`);
    push(`  ${issue.message}`);
    if (issue.sourceText !== undefined) {
      push(`  ${c.dim('Source:')}       ${quote(issue.sourceText)}`);
    }
    if (issue.type !== 'missing_key' && issue.translatedText !== undefined) {
      push(`  ${c.dim('Translation:')}  ${quote(issue.translatedText)}`);
    }
    if (issue.suggestion !== undefined && (options.verbose || issue.origin === 'ai')) {
      push(`  ${c.dim('Suggestion:')}   ${quote(issue.suggestion)}`);
    }
    if (issue.relatedKeys && issue.relatedKeys.length > 0) {
      push(`  ${c.dim('Also:')}         ${issue.relatedKeys.join(', ')}`);
    }
    if (options.verbose && issue.explanation) {
      for (const line of issue.explanation.split('\n')) {
        push(`  ${c.dim(line)}`);
      }
    }
    push();
  }
}
