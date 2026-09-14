import { z } from 'zod';
import { defineRule, type RuleIssue } from '../types/rule.js';

export const extraKeyRule = defineRule({
  name: 'extraKey',
  type: 'extra_key',
  description: 'Keys that no longer exist in the source locale are probably obsolete.',
  defaultSeverity: 'warning',
  optionsSchema: z.object({}),
  run(context) {
    const issues: RuleIssue[] = [];
    for (const key of context.targetKeys) {
      if (Object.hasOwn(context.source, key) || context.isIgnored(key)) {
        continue;
      }
      issues.push({
        key,
        message: 'Key does not exist in the source locale',
        explanation: `"${key}" is defined in ${context.targetLocale} but not in ${context.sourceLocale}. It is most likely obsolete and can be removed.`,
        translatedText: context.target[key] ?? '',
      });
    }
    return issues;
  },
});
