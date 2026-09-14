import { z } from 'zod';
import { PLACEHOLDER_SYNTAXES, comparePlaceholders } from '../analysis/placeholders.js';
import { defineRule, type RuleIssue } from '../types/rule.js';

const optionsSchema = z.object({
  /** Placeholder syntaxes to recognise. Defaults to all supported syntaxes. */
  syntaxes: z
    .array(z.enum(PLACEHOLDER_SYNTAXES))
    .min(1)
    .default([...PLACEHOLDER_SYNTAXES]),
});

function list(items: readonly string[]): string {
  return items.join(', ');
}

export const placeholdersRule = defineRule({
  name: 'placeholders',
  type: 'placeholder_mismatch',
  description:
    'Interpolation placeholders ({amount}, {{amount}}, %s, ...) must match between source and translation.',
  defaultSeverity: 'error',
  optionsSchema,
  run(context) {
    const issues: RuleIssue[] = [];
    const extractOptions = { syntaxes: context.options.syntaxes };

    for (const key of context.sharedKeys) {
      if (context.isIgnored(key)) {
        continue;
      }
      const source = context.source[key] ?? '';
      const target = context.target[key] ?? '';
      if (target.trim() === '') {
        continue; // reported by emptyTranslation
      }
      const comparison = comparePlaceholders(source, target, extractOptions);
      if (comparison.ok) {
        continue;
      }

      const lines: string[] = [];
      if (comparison.renamed.length > 0) {
        for (const { from, to } of comparison.renamed) {
          lines.push(`Placeholder ${from} appears to have been renamed to ${to}`);
        }
      } else {
        if (comparison.missing.length > 0) {
          lines.push(
            `Missing placeholder${comparison.missing.length > 1 ? 's' : ''}: ${list(comparison.missing)}`,
          );
        }
        if (comparison.unexpected.length > 0) {
          lines.push(
            `Unexpected placeholder${comparison.unexpected.length > 1 ? 's' : ''} not in source: ${list(comparison.unexpected)}`,
          );
        }
      }
      for (const { placeholder, sourceCount, targetCount } of comparison.countMismatches) {
        lines.push(
          `Placeholder ${placeholder} appears ${sourceCount}× in the source but ${targetCount}× in the translation`,
        );
      }

      const [message = 'Placeholders do not match the source', ...rest] = lines;
      issues.push({
        key,
        message,
        explanation: [
          ...rest,
          'Placeholders are replaced with values at runtime. A missing or renamed placeholder shows raw text or an empty value to users; an extra one may throw at runtime.',
        ].join('\n'),
        sourceText: source,
        translatedText: target,
        details: {
          missing: comparison.missing,
          unexpected: comparison.unexpected,
          renamed: comparison.renamed.map(({ from, to }) => ({ from, to })),
          countMismatches: comparison.countMismatches.map((m) => ({ ...m })),
        },
      });
    }
    return issues;
  },
});
