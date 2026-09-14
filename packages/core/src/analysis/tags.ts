/**
 * Lightweight, non-executing markup tag tokenizer.
 *
 * Translations frequently embed simple inline markup (`<strong>`, `<a href>`,
 * `<br/>`, or numeric component tags such as `<0>…</0>` used by react-i18next).
 * This module only tokenizes tags for structural comparison; it never builds a
 * DOM or interprets content.
 */

export type TagKind = 'open' | 'close' | 'self';

export interface Tag {
  /** Lower-cased tag name, e.g. `strong`, `a`, `0`. */
  name: string;
  kind: TagKind;
  raw: string;
  index: number;
}

/** Elements that never have a closing tag. */
export const VOID_TAGS: ReadonlySet<string> = new Set([
  'br',
  'hr',
  'img',
  'input',
  'wbr',
  'meta',
  'link',
  'area',
  'base',
  'col',
  'embed',
  'source',
  'track',
]);

const TAG_RE = /<(\/?)([A-Za-z][\w:-]*|\d+)(\s[^<>]*?)?\s*(\/?)>/g;

/** Extract tags in document order. */
export function extractTags(text: string): Tag[] {
  const tags: Tag[] = [];
  for (const match of text.matchAll(TAG_RE)) {
    const closingSlash = match[1] === '/';
    const name = (match[2] ?? '').toLowerCase();
    const selfClosing = match[4] === '/';
    const kind: TagKind = closingSlash
      ? 'close'
      : selfClosing || VOID_TAGS.has(name)
        ? 'self'
        : 'open';
    tags.push({ name, kind, raw: match[0], index: match.index });
  }
  return tags;
}

export interface TagBalance {
  /** Opening tags that are never closed, in document order. */
  unclosed: string[];
  /** Closing tags with no matching opening tag, in document order. */
  unopened: string[];
}

/** Check that opening and closing tags nest correctly. */
export function checkTagBalance(tags: readonly Tag[]): TagBalance {
  const stack: string[] = [];
  const unopened: string[] = [];
  for (const tag of tags) {
    if (tag.kind === 'open') {
      stack.push(tag.name);
    } else if (tag.kind === 'close') {
      const openIndex = stack.lastIndexOf(tag.name);
      if (openIndex === -1) {
        unopened.push(tag.name);
      } else {
        stack.splice(openIndex, 1);
      }
    }
  }
  return { unclosed: stack, unopened };
}

export interface TagComparison {
  source: Tag[];
  target: Tag[];
  /** Tag tokens (e.g. `<strong>`, `</strong>`, `<br>`) in the source but not the target. */
  missing: string[];
  /** Tag tokens in the target but not the source. */
  unexpected: string[];
  balance: TagBalance;
  ok: boolean;
}

function tokenLabel(tag: Tag): string {
  return tag.kind === 'close' ? `</${tag.name}>` : `<${tag.name}>`;
}

function countBy(tags: readonly Tag[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const tag of tags) {
    const label = tokenLabel(tag);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return counts;
}

/** Compare the markup structure of a source string with its translation. */
export function compareTags(sourceText: string, targetText: string): TagComparison {
  const source = extractTags(sourceText);
  const target = extractTags(targetText);
  const sourceCounts = countBy(source);
  const targetCounts = countBy(target);

  const missing: string[] = [];
  const unexpected: string[] = [];
  for (const [label, count] of sourceCounts) {
    const targetCount = targetCounts.get(label) ?? 0;
    for (let i = targetCount; i < count; i++) {
      missing.push(label);
    }
  }
  for (const [label, count] of targetCounts) {
    const sourceCount = sourceCounts.get(label) ?? 0;
    for (let i = sourceCount; i < count; i++) {
      unexpected.push(label);
    }
  }

  const balance = checkTagBalance(target);
  const sourceBalance = checkTagBalance(source);
  // Only report balance problems that the source does not share, so an
  // intentionally unbalanced source string is not reported on every locale.
  const filteredBalance: TagBalance = {
    unclosed: balance.unclosed.filter((name) => !sourceBalance.unclosed.includes(name)),
    unopened: balance.unopened.filter((name) => !sourceBalance.unopened.includes(name)),
  };

  return {
    source,
    target,
    missing,
    unexpected,
    balance: filteredBalance,
    ok:
      missing.length === 0 &&
      unexpected.length === 0 &&
      filteredBalance.unclosed.length === 0 &&
      filteredBalance.unopened.length === 0,
  };
}

/** Remove all tags from a string. */
export function stripTags(text: string): string {
  return text.replace(TAG_RE, ' ');
}
