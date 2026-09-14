import { z } from 'zod';
import { defineRule, type RuleIssue } from '../types/rule.js';

export const missingKeyRule = defineRule({
  name: 'missingKey',
  type: 'missing_key',
  description: 'Every key in the source locale must exist in the target locale.',
  defaultSeverity: 'error',
  optionsSchema: z.object({}),
  run(context) {
    const issues: RuleIssue[] = [];
    for (const key of context.sourceKeys) {
      if (Object.hasOwn(context.target, key) || context.isIgnored(key)) {
        continue;
      }
      issues.push({
        key,
        message: 'Translation key is missing',
        explanation: `"${key}" exists in ${context.sourceLocale} but not in ${context.targetLocale}. Users will see the raw key or a fallback language.`,
        sourceText: context.source[key] ?? '',
      });
    }
    return issues;
  },
});
