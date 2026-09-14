import { z } from 'zod';
import type { GlossaryEntry } from '../types/glossary.js';
import { defineRule, type RuleIssue } from '../types/rule.js';

const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;

function termRegex(term: string, caseSensitive: boolean): RegExp {
  const escaped = term.replace(REGEX_SPECIALS, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, caseSensitive ? 'u' : 'iu');
}

interface CompiledEntry {
  entry: GlossaryEntry;
  inSource: RegExp;
  preferred: string | undefined;
  inTarget: RegExp | undefined;
}

export const glossaryRule = defineRule({
  name: 'glossary',
  type: 'terminology',
  description: 'Glossary terms must use their preferred translation or stay untranslated.',
  defaultSeverity: 'warning',
  optionsSchema: z.object({}),
  run(context) {
    const compiled: CompiledEntry[] = [];
    for (const entry of context.glossary) {
      const preferred = entry.doNotTranslate
        ? entry.term
        : entry.translations[context.targetLocale];
      if (preferred === undefined) {
        continue;
      }
      compiled.push({
        entry,
        inSource: termRegex(entry.term, entry.caseSensitive),
        preferred,
        inTarget: termRegex(preferred, entry.doNotTranslate ? entry.caseSensitive : false),
      });
    }
    if (compiled.length === 0) {
      return [];
    }

    const issues: RuleIssue[] = [];
    for (const key of context.sharedKeys) {
      if (context.isIgnored(key)) {
        continue;
      }
      const source = context.source[key] ?? '';
      const target = context.target[key] ?? '';
      if (target.trim() === '' || source === target) {
        continue;
      }
      for (const { entry, inSource, preferred, inTarget } of compiled) {
        if (!inSource.test(source) || inTarget?.test(target)) {
          continue;
        }
        const guidance = entry.description ? ` ${entry.description}` : '';
        if (entry.doNotTranslate) {
          issues.push({
            key,
            message: `"${entry.term}" must not be translated but does not appear in the translation`,
            explanation: `The glossary marks "${entry.term}" as do-not-translate.${guidance}`,
            sourceText: source,
            translatedText: target,
            details: { term: entry.term, doNotTranslate: true },
          });
        } else {
          issues.push({
            key,
            message: `Glossary term "${entry.term}" should be translated as "${preferred ?? ''}"`,
            explanation: `The glossary defines the preferred ${context.targetLocale} translation of "${entry.term}" as "${preferred ?? ''}", which does not appear in this translation.${guidance}`,
            sourceText: source,
            translatedText: target,
            details: { term: entry.term, preferred: preferred ?? '' },
          });
        }
      }
    }
    return issues;
  },
});
