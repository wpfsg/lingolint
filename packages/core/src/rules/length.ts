import { z } from 'zod';
import { defineRule, type RuleIssue } from '../types/rule.js';
import { compileKeyMatcher } from '../utils/key-pattern.js';
import { charLength } from '../utils/text.js';

const optionsSchema = z.object({
  /** Flag translations longer than `maxRatio × source length`. */
  maxRatio: z.number().positive().default(3),
  /** Flag translations shorter than `minRatio × source length`. */
  minRatio: z.number().nonnegative().default(0.25),
  /**
   * Absolute character difference required before a ratio is reported, so a
   * two-word translation of a one-word button is not flagged.
   */
  minDelta: z.number().int().nonnegative().default(10),
  /**
   * Hard character limits per key or `*` pattern, e.g. `{ 'nav.*': 20 }`.
   * Exceeding a limit is always reported, regardless of the source length.
   */
  limits: z.record(z.string(), z.number().int().positive()).default({}),
});

function formatRatio(ratio: number): string {
  return `${(Math.round(ratio * 10) / 10).toString()}×`;
}

export const lengthRule = defineRule({
  name: 'length',
  type: 'length',
  description:
    'Translations that are much longer (or shorter) than the source may overflow the UI.',
  defaultSeverity: 'warning',
  optionsSchema,
  run(context) {
    const issues: RuleIssue[] = [];
    const { maxRatio, minRatio, minDelta, limits } = context.options;
    const limitMatchers = Object.entries(limits).map(([pattern, limit]) => ({
      pattern,
      limit,
      matches: compileKeyMatcher([pattern]),
    }));

    for (const key of context.sharedKeys) {
      if (context.isIgnored(key)) {
        continue;
      }
      const source = context.source[key] ?? '';
      const target = context.target[key] ?? '';
      const sourceLength = charLength(source.trim());
      const targetLength = charLength(target.trim());
      if (sourceLength === 0 || targetLength === 0) {
        continue;
      }

      const limit = limitMatchers.find((entry) => entry.matches(key));
      if (limit && targetLength > limit.limit) {
        issues.push({
          key,
          message: `Translation exceeds the ${limit.limit}-character limit for this key (${targetLength} characters)`,
          explanation: `A length limit of ${limit.limit} characters is configured for "${limit.pattern}".`,
          sourceText: source,
          translatedText: target,
          details: { limit: limit.limit, length: targetLength, pattern: limit.pattern },
        });
        continue;
      }

      const ratio = targetLength / sourceLength;
      const delta = Math.abs(targetLength - sourceLength);
      if (ratio > maxRatio && delta >= minDelta) {
        issues.push({
          key,
          message: `Translation may be significantly longer than the source (${formatRatio(ratio)})`,
          explanation:
            'Potential UI overflow. Buttons, tabs, table headers and navigation items sized for the source text may truncate or wrap this translation. This is not necessarily a mistake.',
          sourceText: source,
          translatedText: target,
          details: { ratio: Math.round(ratio * 100) / 100, sourceLength, targetLength },
        });
      } else if (minRatio > 0 && ratio < minRatio && delta >= minDelta) {
        issues.push({
          key,
          message: `Translation is much shorter than the source (${formatRatio(ratio)})`,
          explanation:
            'The translation may be truncated or incomplete. Some languages are naturally more compact, so review manually.',
          sourceText: source,
          translatedText: target,
          maxSeverity: 'info',
          details: { ratio: Math.round(ratio * 100) / 100, sourceLength, targetLength },
        });
      }
    }
    return issues;
  },
});
