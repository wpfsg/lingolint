import { z } from 'zod';
import { defineRule, type RuleIssue } from '../types/rule.js';
import { hasLetters } from '../utils/text.js';

const optionsSchema = z.object({
  /** Ignore translations shorter than this many characters. */
  minLength: z.number().int().nonnegative().default(2),
});

export const duplicateTranslationRule = defineRule({
  name: 'duplicateTranslation',
  type: 'duplicate_translation',
  description:
    'Different source strings that share the exact same translation may hide a copy-paste mistake.',
  defaultSeverity: 'info',
  optionsSchema,
  run(context) {
    const groups = new Map<string, string[]>();
    for (const key of context.sharedKeys) {
      if (context.isIgnored(key)) {
        continue;
      }
      const target = (context.target[key] ?? '').trim();
      if (target.length < context.options.minLength || !hasLetters(target)) {
        continue;
      }
      const group = groups.get(target);
      if (group) {
        group.push(key);
      } else {
        groups.set(target, [key]);
      }
    }

    const issues: RuleIssue[] = [];
    for (const [translation, keys] of groups) {
      if (keys.length < 2) {
        continue;
      }
      const distinctSources = new Set(
        keys.map((key) => (context.source[key] ?? '').trim().toLowerCase()),
      );
      if (distinctSources.size < 2) {
        continue; // same source text, same translation: consistent, not suspicious
      }
      const [first = '', ...others] = keys;
      issues.push({
        key: first,
        message: `Same translation used for ${keys.length} different source strings`,
        explanation: [
          `"${translation}" translates all of the following, which differ in ${context.sourceLocale}:`,
          ...keys.map((key) => `  ${key}: "${context.source[key] ?? ''}"`),
          'This can be correct (e.g. "Close" and "Exit" → "Cerrar") but is worth a manual review.',
        ].join('\n'),
        sourceText: context.source[first] ?? '',
        translatedText: context.target[first] ?? '',
        relatedKeys: others,
        confidence: 0.4,
        details: { keys },
      });
    }
    return issues;
  },
});
