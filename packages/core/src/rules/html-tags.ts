import { z } from 'zod';
import { compareTags } from '../analysis/tags.js';
import { defineRule, type RuleIssue } from '../types/rule.js';

export const htmlTagsRule = defineRule({
  name: 'htmlTags',
  type: 'html_mismatch',
  description: 'Inline markup tags (<strong>, <a>, <br>, <0>...) must be preserved and balanced.',
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
      if (target.trim() === '' || (!source.includes('<') && !target.includes('<'))) {
        continue;
      }
      const comparison = compareTags(source, target);
      if (comparison.ok) {
        continue;
      }

      const lines: string[] = [];
      for (const name of comparison.balance.unclosed) {
        lines.push(`Tag <${name}> is never closed`);
      }
      for (const name of comparison.balance.unopened) {
        lines.push(`Closing tag </${name}> has no matching opening tag`);
      }
      const reportedByBalance = new Set([
        ...comparison.balance.unclosed.map((name) => `</${name}>`),
        ...comparison.balance.unopened.map((name) => `<${name}>`),
      ]);
      const missing = comparison.missing.filter((label) => !reportedByBalance.has(label));
      const unexpected = comparison.unexpected.filter((label) => !reportedByBalance.has(label));
      if (missing.length > 0) {
        lines.push(`Missing tag${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`);
      }
      if (unexpected.length > 0) {
        lines.push(
          `Unexpected tag${unexpected.length > 1 ? 's' : ''} not in source: ${unexpected.join(', ')}`,
        );
      }

      const [message = 'Markup tags do not match the source', ...rest] = lines;
      issues.push({
        key,
        message,
        explanation: [
          ...rest,
          'Unbalanced or missing tags break formatting and can leak raw markup into the interface.',
        ].join('\n'),
        sourceText: source,
        translatedText: target,
        details: {
          missing: comparison.missing,
          unexpected: comparison.unexpected,
          unclosed: comparison.balance.unclosed,
          unopened: comparison.balance.unopened,
        },
      });
    }
    return issues;
  },
});
