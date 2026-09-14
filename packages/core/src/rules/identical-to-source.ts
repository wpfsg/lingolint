import { z } from 'zod';
import { stripPlaceholders } from '../analysis/placeholders.js';
import { stripTags } from '../analysis/tags.js';
import { defineRule, type RuleIssue } from '../types/rule.js';
import { sameLanguage } from '../utils/locale.js';
import { hasLetters } from '../utils/text.js';

const optionsSchema = z.object({
  /** Exact strings that are legitimately identical across languages (brands, product names). */
  ignore: z.array(z.string()).default([]),
  /** Ignore texts with fewer letters than this after removing placeholders and tags. */
  minLength: z.number().int().nonnegative().default(2),
});

const ACRONYM = /^[\p{Lu}\p{N}][\p{Lu}\p{N}.&+/-]*$/u;

export const identicalToSourceRule = defineRule({
  name: 'identicalToSource',
  type: 'identical_to_source',
  description: 'A translation identical to the source text is probably untranslated.',
  defaultSeverity: 'warning',
  optionsSchema,
  run(context) {
    if (sameLanguage(context.sourceLocale, context.targetLocale)) {
      return [];
    }
    const ignore = new Set(context.options.ignore.map((value) => value.trim().toLowerCase()));
    const doNotTranslate = context.glossary.filter((entry) => entry.doNotTranslate);
    const issues: RuleIssue[] = [];

    for (const key of context.sharedKeys) {
      if (context.isIgnored(key)) {
        continue;
      }
      const source = context.source[key] ?? '';
      const target = context.target[key] ?? '';
      if (source !== target) {
        continue;
      }
      const text = source.trim();
      if (text === '' || ignore.has(text.toLowerCase())) {
        continue;
      }
      if (
        doNotTranslate.some((entry) =>
          entry.caseSensitive
            ? entry.term === text
            : entry.term.toLowerCase() === text.toLowerCase(),
        )
      ) {
        continue;
      }
      const content = stripTags(stripPlaceholders(text)).trim();
      const letters = Array.from(content).filter((ch) => /\p{L}/u.test(ch)).length;
      if (!hasLetters(content) || letters < context.options.minLength) {
        continue;
      }
      const words = content.split(/\s+/).filter(Boolean);
      const singleToken = words.length === 1;
      if (singleToken && (ACRONYM.test(content) || /\p{N}/u.test(content))) {
        continue; // acronyms, model numbers, tickers
      }

      const confidence = singleToken ? 0.5 : words.length === 2 ? 0.7 : 0.9;
      issues.push({
        key,
        message: 'Translation is identical to the source text',
        explanation: `"${text}" was left untranslated in ${context.targetLocale}. If this is intentional (brand or product name, technical term), add it to the identicalToSource.ignore option or mark it doNotTranslate in the glossary.`,
        sourceText: source,
        translatedText: target,
        confidence,
        ...(singleToken ? { maxSeverity: 'info' as const } : {}),
      });
    }
    return issues;
  },
});
