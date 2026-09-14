import type { FlatTranslations, NestedTranslations } from '../types/translations.js';

export interface ParsedLocale {
  /** Parser name, e.g. `json`. */
  format: string;
  /** The file's translations exactly as authored (nested structure preserved). */
  data: NestedTranslations;
  /** The same translations flattened to dotted keys. */
  flat: FlatTranslations;
}

export interface ParseOptions {
  /** Used only to enrich error messages. */
  fileName?: string;
}

/**
 * A locale file format.
 *
 * Parsers are pure: they receive file contents as text and return data. All
 * filesystem access lives in the CLI. To add a format (YAML, PO, XLIFF, ARB,
 * Android XML, iOS .strings, CSV, ...), implement this interface and register
 * it with {@link registerParser}.
 */
export interface LocaleFileParser {
  name: string;
  /** Lower-case extensions including the dot, e.g. `['.json']`. */
  extensions: readonly string[];
  parse(text: string, options?: ParseOptions): ParsedLocale;
  /**
   * Serialize translations back to text. Optional; formats without a writer can
   * still be scanned but not exported.
   */
  serialize?(data: NestedTranslations): string;
}

export interface LocaleParseErrorInfo {
  fileName?: string;
  line?: number;
  column?: number;
  /** Raw reason from the underlying parser, e.g. `Expected ',' after property value`. */
  reason?: string;
}

/** Thrown when a locale file cannot be parsed. `message` is safe to show users. */
export class LocaleParseError extends Error {
  override readonly name = 'LocaleParseError';
  readonly fileName: string | undefined;
  readonly line: number | undefined;
  readonly column: number | undefined;
  readonly reason: string | undefined;

  constructor(message: string, info: LocaleParseErrorInfo = {}) {
    super(message);
    this.fileName = info.fileName;
    this.line = info.line;
    this.column = info.column;
    this.reason = info.reason;
  }
}
