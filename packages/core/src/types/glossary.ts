/**
 * A fully resolved glossary entry.
 *
 * Glossary entries drive deterministic terminology checks and are passed to
 * AI providers so that project-specific terminology overrides generic advice.
 */
export interface GlossaryEntry {
  /** The source-language term, e.g. `Withdrawal`. */
  term: string;
  /** Preferred translations per target locale, e.g. `{ es: 'Retiro' }`. */
  translations: Record<string, string>;
  /** The term must appear verbatim in every translation (brands, protocols, ...). */
  doNotTranslate: boolean;
  /** Match the term case-sensitively in the source text. Defaults to false. */
  caseSensitive: boolean;
  /** Free-text guidance, shown to reviewers and AI providers. */
  description?: string;
}
