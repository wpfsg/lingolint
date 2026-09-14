const LETTER_RE = /\p{L}/u;

/** True if the text contains at least one letter in any script. */
export function hasLetters(text: string): boolean {
  return LETTER_RE.test(text);
}

/** Truncate for display, keeping the result single-line friendly. */
export function truncate(text: string, max = 80): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

/** Deterministic, locale-independent sort for keys. */
export function sortKeys(keys: Iterable<string>): string[] {
  return Array.from(keys).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Count Unicode code points rather than UTF-16 code units. */
export function charLength(text: string): number {
  let count = 0;
  for (const _char of text) {
    count++;
  }
  return count;
}
