/**
 * Placeholder extraction and comparison.
 *
 * Supported syntaxes (in matching precedence order):
 *
 * | syntax          | example              | used by                         |
 * | --------------- | -------------------- | ------------------------------- |
 * | `double_curly`  | `{{amount}}`         | i18next, Angular, Vue I18n      |
 * | `ruby`          | `%{amount}`          | Rails i18n, i18n-js             |
 * | `template`      | `${amount}`          | JS template-style libraries     |
 * | `icu`           | `{amount}`, `{0}`    | ICU MessageFormat, .NET, Java   |
 * | `percent_named` | `%amount%`           | Symfony, custom                 |
 * | `printf`        | `%s`, `%d`, `%1$s`   | gettext, C-style formatting     |
 *
 * ICU plural/select blocks with nested braces are not expanded; only simple
 * arguments such as `{count}` or `{count, number}` are recognised.
 */

export const PLACEHOLDER_SYNTAXES = [
  'double_curly',
  'ruby',
  'template',
  'icu',
  'percent_named',
  'printf',
] as const;
export type PlaceholderSyntax = (typeof PLACEHOLDER_SYNTAXES)[number];

export interface Placeholder {
  /** Text exactly as it appears, e.g. `{amount, number}`. */
  raw: string;
  /** Identifier or, for positional printf placeholders, the raw token. */
  name: string;
  syntax: PlaceholderSyntax;
  /** Offset in the analysed text. */
  index: number;
  /** Stable rendering used for comparison and messages, e.g. `{amount}`. */
  canonical: string;
}

// Unicode-aware so that a translator who "translates" a variable name
// (`{name}` → `{имя}`) is reported as a rename rather than a vanished placeholder.
const IDENT = String.raw`[\p{L}_][\p{L}\p{N}_.]*`;

const PLACEHOLDER_RE = new RegExp(
  [
    String.raw`(?<double_curly>\{\{\s*(?<double_curly_name>[^{}\s][^{}]*?)\s*\}\})`,
    String.raw`(?<ruby>%\{\s*(?<ruby_name>${IDENT})\s*\})`,
    String.raw`(?<template>\$\{\s*(?<template_name>${IDENT})\s*\})`,
    String.raw`(?<icu>\{\s*(?<icu_name>${IDENT}|\d+)\s*(?:,\s*[A-Za-z]+\s*(?:,\s*[^{}]*?)?)?\})`,
    String.raw`(?<percent_named>%(?<percent_named_name>[A-Za-z_]\w*)%)`,
    String.raw`(?<escaped>%%)`,
    String.raw`(?<printf>%(?:\d+\$)?[-+0#]*\d*(?:\.\d+)?[sdifuxXoeEgGc])`,
  ].join('|'),
  'gu',
);

function canonicalize(syntax: PlaceholderSyntax, name: string, raw: string): string {
  switch (syntax) {
    case 'double_curly':
      return `{{${name}}}`;
    case 'ruby':
      return `%{${name}}`;
    case 'template':
      return `\${${name}}`;
    case 'icu':
      return `{${name}}`;
    case 'percent_named':
      return `%${name}%`;
    case 'printf':
      return raw;
  }
}

export interface ExtractPlaceholderOptions {
  /** Restrict to these syntaxes. Defaults to all. */
  syntaxes?: readonly PlaceholderSyntax[];
}

/** Extract placeholders from a translation string in document order. */
export function extractPlaceholders(
  text: string,
  options: ExtractPlaceholderOptions = {},
): Placeholder[] {
  const allowed = new Set<PlaceholderSyntax>(options.syntaxes ?? PLACEHOLDER_SYNTAXES);
  const result: Placeholder[] = [];
  for (const match of text.matchAll(PLACEHOLDER_RE)) {
    const groups = match.groups ?? {};
    if (groups.escaped !== undefined) {
      continue;
    }
    const syntax = PLACEHOLDER_SYNTAXES.find((candidate) => groups[candidate] !== undefined);
    if (!syntax || !allowed.has(syntax)) {
      continue;
    }
    const raw = match[0];
    const name = syntax === 'printf' ? raw : (groups[`${syntax}_name`] ?? raw);
    result.push({
      raw,
      name,
      syntax,
      index: match.index,
      canonical: canonicalize(syntax, name, raw),
    });
  }
  return result;
}

export interface PlaceholderCountMismatch {
  placeholder: string;
  sourceCount: number;
  targetCount: number;
}

export interface PlaceholderComparison {
  source: Placeholder[];
  target: Placeholder[];
  /** Canonical placeholders present in the source but absent from the target. */
  missing: string[];
  /** Canonical placeholders present in the target but absent from the source. */
  unexpected: string[];
  /** Placeholders present in both but with different repetition counts. */
  countMismatches: PlaceholderCountMismatch[];
  /** Best-effort detection of a placeholder that was renamed in translation. */
  renamed: { from: string; to: string }[];
  ok: boolean;
}

function countBy(placeholders: readonly Placeholder[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const placeholder of placeholders) {
    counts.set(placeholder.canonical, (counts.get(placeholder.canonical) ?? 0) + 1);
  }
  return counts;
}

/** Compare the placeholders of a source string and its translation. */
export function comparePlaceholders(
  sourceText: string,
  targetText: string,
  options: ExtractPlaceholderOptions = {},
): PlaceholderComparison {
  const source = extractPlaceholders(sourceText, options);
  const target = extractPlaceholders(targetText, options);
  const sourceCounts = countBy(source);
  const targetCounts = countBy(target);

  const missing: string[] = [];
  const unexpected: string[] = [];
  const countMismatches: PlaceholderCountMismatch[] = [];

  for (const [placeholder, sourceCount] of sourceCounts) {
    const targetCount = targetCounts.get(placeholder) ?? 0;
    if (targetCount === 0) {
      missing.push(placeholder);
    } else if (targetCount !== sourceCount) {
      countMismatches.push({ placeholder, sourceCount, targetCount });
    }
  }
  for (const [placeholder] of targetCounts) {
    if (!sourceCounts.has(placeholder)) {
      unexpected.push(placeholder);
    }
  }

  const renamed: { from: string; to: string }[] = [];
  if (missing.length === 1 && unexpected.length === 1) {
    const from = source.find((p) => p.canonical === missing[0]);
    const to = target.find((p) => p.canonical === unexpected[0]);
    if (from && to) {
      const sameSyntax = from.syntax === to.syntax && from.syntax !== 'printf';
      if (sameSyntax) {
        renamed.push({ from: from.canonical, to: to.canonical });
      }
    }
  }

  return {
    source,
    target,
    missing,
    unexpected,
    countMismatches,
    renamed,
    ok: missing.length === 0 && unexpected.length === 0 && countMismatches.length === 0,
  };
}

/** Remove every placeholder from a string (used to judge "real" text content). */
export function stripPlaceholders(text: string): string {
  return text.replace(PLACEHOLDER_RE, ' ');
}
