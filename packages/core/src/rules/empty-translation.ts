import { z } from 'zod';
import { defineRule, type RuleIssue } from '../types/rule.js';

export const emptyTranslationRule = defineRule({
  name: 'emptyTranslation',
  type: 'empty_translation',
  description: 'A translation must not be empty when the source text is not.',
  defaultSeverity: 'error',
  optionsSchema: z.object({}),
  run(context) {
    const issues: RuleIssue[] = [];
    for (const key of context.sharedKeys) {
      if (context.isIgnored(key)) {
        continue;
      }
      const source = context.source[key] ?? '';
      const target = context.target[key] ?? '';
      if (target.trim() !== '' || source.trim() === '') {
        continue;
      }
      issues.push({
        key,
        message: 'Translation is empty',
        explanation: `The ${context.targetLocale} value for "${key}" is empty while the ${context.sourceLocale} text is not. Users will see nothing here.`,
        sourceText: source,
        translatedText: target,
      });
    }
    return issues;
  },
});
