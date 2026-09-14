import type { GlossaryEntry } from '../types/glossary.js';
import type { ResolvedConfig } from './schema.js';

const FULL_FORM_KEYS = new Set(['translations', 'doNotTranslate', 'caseSensitive', 'description']);

/** Normalize the two accepted glossary shapes into {@link GlossaryEntry} objects. */
export function resolveGlossary(glossary: ResolvedConfig['glossary']): GlossaryEntry[] {
  const entries: GlossaryEntry[] = [];
  for (const [term, raw] of Object.entries(glossary)) {
    const isFullForm = Object.keys(raw).every((key) => FULL_FORM_KEYS.has(key));
    if (isFullForm) {
      const full = raw as {
        translations?: Record<string, string>;
        doNotTranslate?: boolean;
        caseSensitive?: boolean;
        description?: string;
      };
      entries.push({
        term,
        translations: full.translations ?? {},
        doNotTranslate: full.doNotTranslate ?? false,
        caseSensitive: full.caseSensitive ?? false,
        ...(full.description !== undefined ? { description: full.description } : {}),
      });
    } else {
      entries.push({
        term,
        translations: raw as Record<string, string>,
        doNotTranslate: false,
        caseSensitive: false,
      });
    }
  }
  return entries.sort((a, b) => (a.term < b.term ? -1 : a.term > b.term ? 1 : 0));
}
