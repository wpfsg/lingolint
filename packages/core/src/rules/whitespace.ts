import { z } from 'zod';
import { defineRule, type RuleIssue } from '../types/rule.js';

const optionsSchema = z.object({
  /** Flag leading whitespace the source does not have. */
  leading: z.boolean().default(true),
  /** Flag trailing whitespace the source does not have. */
  trailing: z.boolean().default(true),
  /** Flag runs of two or more spaces the source does not have. */
  doubleSpaces: z.boolean().default(true),
  /** Flag tab characters the source does not have. */
  tabs: z.boolean().default(true),
  /** Flag line breaks when the source has none. */
  newlines: z.boolean().default(true),
});

const LEADING = /^\s/;
const TRAILING = /\s$/;
const DOUBLE_SPACE = / {2,}/;
const NEWLINE = /\r?\n/;

export const whitespaceRule = defineRule({
  name: 'whitespace',
  type: 'whitespace',
  description: 'Accidental leading/trailing spaces, double spaces, tabs and stray line breaks.',
  defaultSeverity: 'warning',
  optionsSchema,
  run(context) {
    const issues: RuleIssue[] = [];
    const { options } = context;

    for (const key of context.sharedKeys) {
      if (context.isIgnored(key)) {
        continue;
      }
      const source = context.source[key] ?? '';
      const target = context.target[key] ?? '';
      if (target.trim() === '') {
        continue;
      }

      const problems: string[] = [];
      let suggestion = target;
      if (options.leading && LEADING.test(target) && !LEADING.test(source)) {
        problems.push('leading whitespace');
        suggestion = suggestion.replace(/^\s+/, '');
      }
      if (options.trailing && TRAILING.test(target) && !TRAILING.test(source)) {
        problems.push('trailing whitespace');
        suggestion = suggestion.replace(/\s+$/, '');
      }
      if (options.doubleSpaces && DOUBLE_SPACE.test(target) && !DOUBLE_SPACE.test(source)) {
        problems.push('repeated spaces');
        suggestion = suggestion.replace(/ {2,}/g, ' ');
      }
      if (options.tabs && target.includes('\t') && !source.includes('\t')) {
        problems.push('tab characters');
        suggestion = suggestion.replace(/\t+/g, ' ');
      }
      if (options.newlines && NEWLINE.test(target) && !NEWLINE.test(source)) {
        problems.push('line breaks not present in the source');
        suggestion = suggestion.replace(/\s*\r?\n\s*/g, ' ');
      }
      if (problems.length === 0) {
        continue;
      }

      const description = problems.length === 1 ? problems[0] : problems.join(', ');
      issues.push({
        key,
        message: `Translation contains ${description}`,
        explanation:
          'Whitespace that differs from the source is usually accidental and can produce visible spacing bugs in the UI.',
        sourceText: source,
        translatedText: target,
        suggestion,
        details: { problems },
      });
    }
    return issues;
  },
});
