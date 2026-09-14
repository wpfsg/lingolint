import { resolveGlossary } from '../config/glossary.js';
import { aiSeverity, resolveConfig, resolveRuleSettings } from '../config/resolve.js';
import type { LingoLintConfig, ResolvedConfig } from '../config/schema.js';
import { flattenTranslations } from '../parser/flatten.js';
import type { AIFinding, TranslationAIProvider, TranslationReviewItem } from '../types/ai.js';
import type { GlossaryEntry } from '../types/glossary.js';
import { AI_ISSUE_TYPES, type Severity, type TranslationIssue } from '../types/issue.js';
import type { AIReviewStats, LocaleReport, ProjectReport } from '../types/report.js';
import type { IssueWithoutId, QARule, RuleContext } from '../types/rule.js';
import type { FlatTranslations, TranslationsInput } from '../types/translations.js';
import { compileKeyMatcher } from '../utils/key-pattern.js';
import { localeDisplayName } from '../utils/locale.js';
import { hasLetters, sortKeys } from '../utils/text.js';
import { builtinRules } from '../rules/index.js';
import { finalizeIssue, sortIssues } from './issues.js';
import {
  computeScore,
  mergeSummaries,
  minSeverity,
  overallScore,
  summarizeIssues,
} from './scoring.js';

export interface AnalyzeTranslationsOptions {
  sourceLocale: string;
  targetLocale: string;
  source: TranslationsInput;
  target: TranslationsInput;
  /** Raw or resolved configuration. Defaults apply when omitted. */
  config?: LingoLintConfig | ResolvedConfig | undefined;
  /** Rules to run. Defaults to {@link builtinRules}. */
  rules?: readonly QARule[] | undefined;
  /**
   * Optional AI provider. Only used when `config.ai.enabled` is true. AI review
   * runs after deterministic rules and never blocks or replaces them.
   */
  ai?: TranslationAIProvider | undefined;
  signal?: AbortSignal | undefined;
}

export interface AnalyzeProjectOptions {
  sourceLocale: string;
  /** Locale code → translations (nested or flat). Must include the source locale. */
  locales: Record<string, TranslationsInput>;
  /** Target locales to analyze. Defaults to `config.targets`, then every non-source locale. */
  targets?: readonly string[] | undefined;
  config?: LingoLintConfig | ResolvedConfig | undefined;
  rules?: readonly QARule[] | undefined;
  ai?: TranslationAIProvider | undefined;
  signal?: AbortSignal | undefined;
  /** Called as each locale finishes, in completion order. */
  onLocaleReport?: ((report: LocaleReport) => void) | undefined;
}

function toResolved(config: LingoLintConfig | ResolvedConfig | undefined): ResolvedConfig {
  return resolveConfig(config ?? {});
}

function toFlat(input: TranslationsInput): FlatTranslations {
  return flattenTranslations(input);
}

interface PreparedLocale {
  config: ResolvedConfig;
  context: RuleContext;
  glossary: GlossaryEntry[];
}

function prepare(options: AnalyzeTranslationsOptions): PreparedLocale {
  const config = toResolved(options.config);
  const source = toFlat(options.source);
  const target = toFlat(options.target);
  const sourceKeys = sortKeys(Object.keys(source));
  const targetKeys = sortKeys(Object.keys(target));
  const sharedKeys = sourceKeys.filter((key) => Object.hasOwn(target, key));
  const glossary = resolveGlossary(config.glossary);
  const isIgnored = compileKeyMatcher(config.ignoreKeys);
  return {
    config,
    glossary,
    context: {
      sourceLocale: options.sourceLocale,
      targetLocale: options.targetLocale,
      source,
      target,
      sourceKeys,
      targetKeys,
      sharedKeys,
      options: undefined,
      glossary,
      isIgnored,
    },
  };
}

function runRules(prepared: PreparedLocale, rules: readonly QARule[]): TranslationIssue[] {
  const settings = resolveRuleSettings(prepared.config, rules);
  const issues: TranslationIssue[] = [];
  for (const rule of rules) {
    const setting = settings.get(rule.name);
    if (!setting || setting.severity === 'off') {
      continue;
    }
    const configured: Severity = setting.severity;
    const context: RuleContext = { ...prepared.context, options: setting.options };
    for (const found of rule.run(context)) {
      const { maxSeverity, type, ...rest } = found;
      const issue: IssueWithoutId = {
        locale: prepared.context.targetLocale,
        rule: rule.name,
        origin: 'deterministic',
        type: type ?? rule.type,
        severity: maxSeverity ? minSeverity(configured, maxSeverity) : configured,
        ...rest,
      };
      issues.push(finalizeIssue(issue));
    }
  }
  return issues;
}

function buildReport(
  prepared: PreparedLocale,
  issues: TranslationIssue[],
  ai?: AIReviewStats,
): LocaleReport {
  const sorted = sortIssues(issues);
  const summary = summarizeIssues(sorted);
  const keyCount = prepared.context.sourceKeys.length;
  return {
    sourceLocale: prepared.context.sourceLocale,
    targetLocale: prepared.context.targetLocale,
    targetLocaleName: localeDisplayName(prepared.context.targetLocale),
    score: computeScore(summary, keyCount, prepared.config.scoring),
    keyCount,
    summary,
    issues: sorted,
    ...(ai ? { ai } : {}),
  };
}

/**
 * Run deterministic rules only. Synchronous, pure and fast: suitable for the
 * browser, editors and tests.
 */
export function analyzeTranslationsSync(
  options: Omit<AnalyzeTranslationsOptions, 'ai' | 'signal'>,
): LocaleReport {
  const prepared = prepare(options);
  const issues = runRules(prepared, options.rules ?? builtinRules);
  return buildReport(prepared, issues);
}

/**
 * Analyze one target locale against the source locale.
 *
 * Deterministic rules always run. When an AI provider is supplied and
 * `config.ai.enabled` is true, strings that passed the technical checks are
 * additionally sent for linguistic review; any AI failure is reported in
 * `report.ai.error` and never discards the deterministic results.
 */
export async function analyzeTranslations(
  options: AnalyzeTranslationsOptions,
): Promise<LocaleReport> {
  const prepared = prepare(options);
  const issues = runRules(prepared, options.rules ?? builtinRules);
  if (!options.ai || !prepared.config.ai.enabled) {
    return buildReport(prepared, issues);
  }
  const { aiIssues, stats } = await runAIReview(prepared, issues, options.ai, options.signal);
  return buildReport(prepared, [...issues, ...aiIssues], stats);
}

/** Analyze every target locale of a project. Locales run concurrently. */
export async function analyzeProject(options: AnalyzeProjectOptions): Promise<ProjectReport> {
  const config = toResolved(options.config);
  const source = options.locales[options.sourceLocale];
  if (source === undefined) {
    throw new Error(
      `Source locale "${options.sourceLocale}" was not found. Available locales: ${sortKeys(Object.keys(options.locales)).join(', ') || 'none'}.`,
    );
  }
  const targets = sortKeys(
    options.targets ??
      config.targets ??
      Object.keys(options.locales).filter((locale) => locale !== options.sourceLocale),
  );
  const reports = await Promise.all(
    targets.map(async (targetLocale) => {
      const target = options.locales[targetLocale];
      if (target === undefined) {
        throw new Error(`Target locale "${targetLocale}" was not found.`);
      }
      const report = await analyzeTranslations({
        sourceLocale: options.sourceLocale,
        targetLocale,
        source,
        target,
        config,
        rules: options.rules,
        ai: options.ai,
        signal: options.signal,
      });
      options.onLocaleReport?.(report);
      return report;
    }),
  );
  return {
    schemaVersion: 1,
    sourceLocale: options.sourceLocale,
    overallScore: overallScore(reports.map((report) => report.score)),
    summary: mergeSummaries(reports.map((report) => report.summary)),
    locales: reports,
  };
}

/* ------------------------------------------------------------------------- */
/* AI review                                                                 */
/* ------------------------------------------------------------------------- */

/** Rules whose findings make linguistic review pointless for that key. */
const BLOCKING_TYPES = new Set<TranslationIssue['type']>([
  'empty_translation',
  'placeholder_mismatch',
  'html_mismatch',
  'identical_to_source',
]);

/**
 * Pick the strings worth sending to an AI provider: shared keys with real text
 * that pass the technical checks. Everything else is either already reported or
 * carries no language to review.
 */
export function selectItemsForAIReview(
  context: Pick<RuleContext, 'source' | 'target' | 'sharedKeys' | 'isIgnored'>,
  issues: readonly TranslationIssue[],
  maxItems?: number,
): { items: TranslationReviewItem[]; skipped: number } {
  const blocked = new Set(
    issues.filter((issue) => BLOCKING_TYPES.has(issue.type)).map((issue) => issue.key),
  );
  const items: TranslationReviewItem[] = [];
  let skipped = 0;
  for (const key of context.sharedKeys) {
    const source = context.source[key] ?? '';
    const target = context.target[key] ?? '';
    if (context.isIgnored(key) || blocked.has(key) || !hasLetters(source) || !hasLetters(target)) {
      skipped++;
      continue;
    }
    if (maxItems !== undefined && items.length >= maxItems) {
      skipped++;
      continue;
    }
    items.push({ key, source, target });
  }
  return { items, skipped };
}

function isAIIssueType(type: string): type is AIFinding['type'] {
  return (AI_ISSUE_TYPES as readonly string[]).includes(type);
}

async function runAIReview(
  prepared: PreparedLocale,
  deterministicIssues: readonly TranslationIssue[],
  provider: TranslationAIProvider,
  signal: AbortSignal | undefined,
): Promise<{ aiIssues: TranslationIssue[]; stats: AIReviewStats }> {
  const { config, context, glossary } = prepared;
  const { items, skipped } = selectItemsForAIReview(
    context,
    deterministicIssues,
    config.ai.maxItems,
  );
  const stats: AIReviewStats = {
    provider: provider.name,
    reviewed: items.length,
    cached: 0,
    skipped,
  };
  if (items.length === 0) {
    return { aiIssues: [], stats };
  }

  const glossaryReported = new Set(
    deterministicIssues.filter((issue) => issue.rule === 'glossary').map((issue) => issue.key),
  );
  const validKeys = new Set(items.map((item) => item.key));

  try {
    const result = await provider.review(
      {
        sourceLocale: context.sourceLocale,
        targetLocale: context.targetLocale,
        items,
        ...(config.context !== undefined ? { context: config.context } : {}),
        glossary,
      },
      signal ? { signal } : undefined,
    );
    stats.cached = result.stats?.cached ?? 0;

    const aiIssues: TranslationIssue[] = [];
    for (const finding of result.findings) {
      if (!validKeys.has(finding.key) || !isAIIssueType(finding.type)) {
        continue;
      }
      if (finding.confidence < config.ai.minConfidence) {
        continue;
      }
      if (finding.type === 'terminology' && glossaryReported.has(finding.key)) {
        continue; // the deterministic glossary rule already covers this key
      }
      const configured = aiSeverity(config, finding.type);
      if (configured === 'off') {
        continue;
      }
      const severity: Severity =
        finding.confidence < config.ai.infoBelowConfidence ? 'info' : configured;
      aiIssues.push(
        finalizeIssue({
          locale: context.targetLocale,
          key: finding.key,
          type: finding.type,
          rule: 'ai',
          origin: 'ai',
          severity,
          message: finding.message,
          explanation: finding.explanation,
          ...(finding.suggestion !== undefined ? { suggestion: finding.suggestion } : {}),
          sourceText: context.source[finding.key] ?? '',
          translatedText: context.target[finding.key] ?? '',
          confidence: finding.confidence,
        }),
      );
    }
    return { aiIssues, stats };
  } catch (error) {
    stats.error = error instanceof Error ? error.message : String(error);
    return { aiIssues: [], stats };
  }
}
