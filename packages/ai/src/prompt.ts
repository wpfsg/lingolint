import { localeDisplayName, type TranslationReviewInput } from '@lingolint/core';

/**
 * Bump whenever the prompt or the expected output changes in a way that should
 * invalidate cached responses.
 */
export const AI_REVIEW_VERSION = 1;

export function buildSystemPrompt(input: TranslationReviewInput): string {
  const sourceName = localeDisplayName(input.sourceLocale);
  const targetName = localeDisplayName(input.targetLocale);
  const sections: string[] = [
    `You are a senior ${targetName} localization reviewer for software user interfaces. You review ${sourceName} → ${targetName} UI strings and report only genuine problems.`,
    '',
    'Report a finding only when you are confident a competent native-speaking reviewer would change the translation. Do not report:',
    '- stylistic preferences where the translation is already correct and natural',
    '- placeholder, HTML tag, whitespace or missing-key problems (those are checked separately)',
    '- brand names, product names or technical terms left untranslated on purpose',
    '- differences in length or word order that are natural in the target language',
    '',
    'Finding types:',
    '- semantic: the meaning differs from the source (wrong word, negation, wrong object)',
    '- grammar: grammatical error, agreement, wrong conjugation or declension',
    '- terminology: inconsistent or incorrect term for this product domain',
    '- tone: formality or register inconsistent with the other strings (e.g. mixing tú/usted, du/Sie)',
    '- capitalization: capitalization wrong for the target language or inconsistent with the UI',
    '- style: unnatural or awkward phrasing that a native speaker would not use',
    '',
    'For every finding give a short message, an explanation of WHY it is a problem, a corrected full translation as the suggestion when you can, and a confidence between 0 and 1. Use confidence below 0.7 for anything that could reasonably be a preference. Judge tone consistency across the whole batch.',
  ];

  if (input.context && input.context.trim() !== '') {
    sections.push('', 'Project context:', input.context.trim());
  }

  const relevant = input.glossary.filter(
    (entry) => entry.doNotTranslate || entry.translations[input.targetLocale] !== undefined,
  );
  if (relevant.length > 0) {
    sections.push('', 'Glossary (these rules override your own judgement):');
    for (const entry of relevant) {
      const rule = entry.doNotTranslate
        ? 'must stay untranslated'
        : `must be translated as "${entry.translations[input.targetLocale] ?? ''}"`;
      const description = entry.description ? ` — ${entry.description}` : '';
      sections.push(`- "${entry.term}" ${rule}${description}`);
    }
  }

  return sections.join('\n');
}

export function buildUserMessage(input: TranslationReviewInput): string {
  const lines = [
    `Review the following ${input.items.length} translations. Refer to each by its key. Return an empty findings list if everything is acceptable.`,
    '',
  ];
  for (const item of input.items) {
    lines.push(`key: ${item.key}`);
    lines.push(`${input.sourceLocale}: ${JSON.stringify(item.source)}`);
    lines.push(`${input.targetLocale}: ${JSON.stringify(item.target)}`);
    lines.push('');
  }
  return lines.join('\n');
}
