import type { JsonObject, JsonValue } from '../types/issue.js';
import type { FlatTranslations, NestedTranslations } from '../types/translations.js';

export const KEY_SEPARATOR = '.';

export class FlattenError extends Error {
  override readonly name = 'FlattenError';
  constructor(
    message: string,
    readonly key: string,
  ) {
    super(message);
  }
}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function joinKey(prefix: string, segment: string): string {
  return prefix === '' ? segment : `${prefix}${KEY_SEPARATOR}${segment}`;
}

/**
 * Flatten nested translations to dotted keys.
 *
 * - Objects nest: `{ a: { b: "x" } }` → `{ "a.b": "x" }`
 * - Arrays use numeric segments: `{ items: ["a", "b"] }` → `{ "items.0": "a", "items.1": "b" }`
 * - Numbers and booleans are kept as their string form; `null` becomes `""`
 *   so it is reported as an empty translation.
 *
 * Throws {@link FlattenError} when two paths produce the same flat key,
 * e.g. `{ "a.b": "x", a: { b: "y" } }`.
 */
export function flattenTranslations(
  input: NestedTranslations | FlatTranslations,
): FlatTranslations {
  const flat: FlatTranslations = {};

  const visit = (value: JsonValue, path: string): void => {
    if (isPlainObject(value)) {
      for (const [segment, child] of Object.entries(value)) {
        visit(child, joinKey(path, segment));
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((child, index) => {
        visit(child, joinKey(path, String(index)));
      });
      return;
    }
    if (Object.hasOwn(flat, path)) {
      throw new FlattenError(
        `Key "${path}" is defined more than once (a literal dotted key collides with a nested object)`,
        path,
      );
    }
    flat[path] = value === null ? '' : typeof value === 'string' ? value : String(value);
  };

  visit(input, '');
  return flat;
}

/** True when no value is an object or array, i.e. the input is already flat. */
export function isFlat(input: NestedTranslations | FlatTranslations): input is FlatTranslations {
  return Object.values(input).every((value) => typeof value === 'string');
}

/**
 * Rebuild a nested object from dotted keys. Every segment becomes an object
 * key; arrays are not reconstructed because a flat map cannot distinguish
 * `items.0` (array) from `{ items: { "0": ... } }`. Use {@link applyFlatValues}
 * to write values back into an existing structure without losing that
 * information.
 */
export function unflattenTranslations(flat: FlatTranslations): NestedTranslations {
  const result: JsonObject = {};
  for (const key of Object.keys(flat)) {
    const segments = key.split(KEY_SEPARATOR);
    let cursor: JsonObject = result;
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i] ?? '';
      const next = cursor[segment];
      if (isPlainObject(next)) {
        cursor = next;
      } else {
        const created: JsonObject = {};
        cursor[segment] = created;
        cursor = created;
      }
    }
    cursor[segments[segments.length - 1] ?? ''] = flat[key] ?? '';
  }
  return result;
}

/**
 * Write flat values back into a copy of an existing nested structure.
 *
 * The original is never mutated. Structure, key order, arrays and unrelated
 * values are preserved; literal dotted keys (`"a.b": "x"`) are matched before
 * nesting is created. Keys that do not exist yet are created as nested objects.
 */
export function applyFlatValues(
  original: NestedTranslations,
  values: FlatTranslations,
): NestedTranslations {
  const copy = structuredClone(original);
  for (const [key, value] of Object.entries(values)) {
    setPath(copy, key.split(KEY_SEPARATOR), value);
  }
  return copy;
}

function setPath(container: JsonObject | JsonValue[], segments: string[], value: string): void {
  // Prefer the longest existing literal key so "a.b" stays "a.b".
  for (let take = segments.length; take >= 1; take--) {
    const literal = segments.slice(0, take).join(KEY_SEPARATOR);
    const rest = segments.slice(take);
    const existing = readChild(container, literal);
    if (existing === undefined) {
      continue;
    }
    if (rest.length === 0) {
      writeChild(container, literal, value);
      return;
    }
    if (isPlainObject(existing) || Array.isArray(existing)) {
      setPath(existing, rest, value);
      return;
    }
  }
  const [head, ...rest] = segments;
  if (head === undefined) {
    return;
  }
  if (rest.length === 0) {
    writeChild(container, head, value);
    return;
  }
  const created: JsonObject = {};
  writeChild(container, head, created);
  setPath(created, rest, value);
}

function readChild(container: JsonObject | JsonValue[], key: string): JsonValue | undefined {
  if (Array.isArray(container)) {
    const index = Number(key);
    return Number.isInteger(index) && index >= 0 ? container[index] : undefined;
  }
  return Object.hasOwn(container, key) ? container[key] : undefined;
}

function writeChild(container: JsonObject | JsonValue[], key: string, value: JsonValue): void {
  if (Array.isArray(container)) {
    const index = Number(key);
    if (Number.isInteger(index) && index >= 0) {
      container[index] = value;
    }
    return;
  }
  container[key] = value;
}

/**
 * Remove keys from a copy of a nested structure. Empty parent objects left
 * behind are removed as well, so deleting the last key of a section removes
 * the section. The original is never mutated.
 */
export function removeFlatKeys(
  original: NestedTranslations,
  keys: readonly string[],
): NestedTranslations {
  const copy = structuredClone(original);
  for (const key of keys) {
    deletePath(copy, key.split(KEY_SEPARATOR));
  }
  return copy;
}

function deletePath(container: JsonObject, segments: string[]): boolean {
  for (let take = segments.length; take >= 1; take--) {
    const literal = segments.slice(0, take).join(KEY_SEPARATOR);
    const rest = segments.slice(take);
    if (!Object.hasOwn(container, literal)) {
      continue;
    }
    if (rest.length === 0) {
      Reflect.deleteProperty(container, literal);
      return true;
    }
    const child = container[literal];
    if (isPlainObject(child)) {
      const removed = deletePath(child, rest);
      if (removed && Object.keys(child).length === 0) {
        Reflect.deleteProperty(container, literal);
      }
      return removed;
    }
  }
  return false;
}
