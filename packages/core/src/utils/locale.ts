/**
 * English display name for a locale code, e.g. `es` → `Spanish`,
 * `pt-BR` → `Brazilian Portuguese`. Falls back to the code itself.
 */
export function localeDisplayName(locale: string): string {
  const normalized = locale.replace(/_/g, '-');
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' }).of(
      normalized,
    );
    return name ?? locale;
  } catch {
    return locale;
  }
}

/** Primary language subtag, e.g. `en-GB` → `en`, `zh_Hant` → `zh`. */
export function languageOf(locale: string): string {
  const [language] = locale.toLowerCase().split(/[-_]/);
  return language ?? locale.toLowerCase();
}

/** True when both locales share the same primary language (e.g. `en` vs `en-GB`). */
export function sameLanguage(a: string, b: string): boolean {
  return languageOf(a) === languageOf(b);
}
