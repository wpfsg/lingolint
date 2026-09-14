import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type {
  FlatTranslations,
  GlossaryEntry,
  NestedTranslations,
  QARule,
  RuleContext,
  RuleIssue,
} from '../src/index.js';
import { compileKeyMatcher, sortKeys } from '../src/index.js';

export interface RunRuleOptions {
  options?: unknown;
  glossary?: GlossaryEntry[];
  ignoreKeys?: string[];
  sourceLocale?: string;
  targetLocale?: string;
}

/** Run a single rule against flat translations with fully defaulted options. */
export function runRule<Options>(
  rule: QARule<Options>,
  source: FlatTranslations,
  target: FlatTranslations,
  overrides: RunRuleOptions = {},
): RuleIssue[] {
  const sourceKeys = sortKeys(Object.keys(source));
  const targetKeys = sortKeys(Object.keys(target));
  const context: RuleContext<Options> = {
    sourceLocale: overrides.sourceLocale ?? 'en',
    targetLocale: overrides.targetLocale ?? 'es',
    source,
    target,
    sourceKeys,
    targetKeys,
    sharedKeys: sourceKeys.filter((key) => Object.hasOwn(target, key)),
    options: rule.optionsSchema.parse(overrides.options ?? {}),
    glossary: overrides.glossary ?? [],
    isIgnored: compileKeyMatcher(overrides.ignoreKeys ?? []),
  };
  return rule.run(context);
}

export function glossaryEntry(partial: Partial<GlossaryEntry> & { term: string }): GlossaryEntry {
  return {
    translations: {},
    doNotTranslate: false,
    caseSensitive: false,
    ...partial,
  };
}

const examplesDir = fileURLToPath(new URL('../../../examples/basic/', import.meta.url));

export function loadExample(locale: string): NestedTranslations {
  return JSON.parse(readFileSync(`${examplesDir}${locale}.json`, 'utf8')) as NestedTranslations;
}
