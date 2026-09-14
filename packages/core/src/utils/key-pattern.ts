const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;

/**
 * Compile a list of key patterns into a single matcher.
 *
 * Patterns are literal keys with `*` as a wildcard matching any characters,
 * including dots: `legal.*` matches `legal.terms.title`; `*.title` matches every
 * title key; `*` matches everything.
 */
export function compileKeyMatcher(patterns: readonly string[]): (key: string) => boolean {
  if (patterns.length === 0) {
    return () => false;
  }
  const literals = new Set<string>();
  const regexes: RegExp[] = [];
  for (const pattern of patterns) {
    if (pattern.includes('*')) {
      const escaped = pattern.replace(REGEX_SPECIALS, (char) =>
        char === '*' ? '.*' : `\\${char}`,
      );
      regexes.push(new RegExp(`^${escaped}$`));
    } else {
      literals.add(pattern);
    }
  }
  return (key) => literals.has(key) || regexes.some((regex) => regex.test(key));
}
