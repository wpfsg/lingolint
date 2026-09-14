import type { JsonValue } from '../types/issue.js';
import type { NestedTranslations } from '../types/translations.js';
import { LocaleParseError, type LocaleFileParser, type ParsedLocale } from './types.js';
import { flattenTranslations } from './flatten.js';

const BOM = '﻿';

interface Position {
  line: number;
  column: number;
}

function positionFromOffset(text: string, offset: number): Position {
  let line = 1;
  let lastLineStart = 0;
  const end = Math.min(offset, text.length);
  for (let i = 0; i < end; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      lastLineStart = i + 1;
    }
  }
  return { line, column: end - lastLineStart + 1 };
}

/**
 * Extract a position from a V8/SpiderMonkey/JavaScriptCore JSON.parse error.
 * V8 reports `... in JSON at position 42 (line 3 column 5)` on recent versions
 * and `... at position 42` on older ones.
 */
function positionFromError(message: string, text: string): Position | undefined {
  const lineColumn = /line (\d+) column (\d+)/i.exec(message);
  if (lineColumn) {
    return { line: Number(lineColumn[1]), column: Number(lineColumn[2]) };
  }
  const position = /position (\d+)/i.exec(message);
  if (position) {
    return positionFromOffset(text, Number(position[1]));
  }
  return undefined;
}

/** Turn a raw engine message into a short, human-friendly reason. */
function cleanReason(message: string): string {
  return message
    .replace(/^JSON\.parse:\s*/i, '')
    .replace(/\s*in JSON at position \d+(?: \(line \d+ column \d+\))?/i, '')
    .replace(/\s*at position \d+/i, '')
    .replace(/\s*at line \d+ column \d+ of the JSON data/i, '')
    .trim();
}

function snippetAt(text: string, position: Position): string {
  const lines = text.split('\n');
  const lineText = lines[position.line - 1];
  if (lineText === undefined) {
    return '';
  }
  const shown = lineText.length > 120 ? `${lineText.slice(0, 117)}...` : lineText;
  const caret = `${' '.repeat(Math.max(0, Math.min(position.column - 1, shown.length)))}^`;
  return `${shown}\n${caret}`;
}

export interface ParseJsonOptions {
  fileName?: string;
}

/** Parse JSON text into a translations object with actionable errors. */
export function parseJsonTranslations(
  text: string,
  options: ParseJsonOptions = {},
): NestedTranslations {
  const content = text.startsWith(BOM) ? text.slice(1) : text;
  let value: JsonValue;
  try {
    value = JSON.parse(content) as JsonValue;
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    const position = positionFromError(raw, content);
    const reason = cleanReason(raw);
    const location = position
      ? `Invalid JSON near line ${position.line}, column ${position.column}.`
      : 'Invalid JSON.';
    const detail = reason ? `\n\n${reason.charAt(0).toUpperCase()}${reason.slice(1)}` : '';
    const snippet = position ? `\n\n${snippetAt(content, position)}` : '';
    throw new LocaleParseError(`${location}${detail}${snippet}`, {
      ...(options.fileName !== undefined ? { fileName: options.fileName } : {}),
      ...(position ?? {}),
      reason,
    });
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    const kind = value === null ? 'null' : Array.isArray(value) ? 'an array' : typeof value;
    throw new LocaleParseError(
      `Expected the top level of the file to be a JSON object of translations, but found ${kind}.`,
      {
        ...(options.fileName !== undefined ? { fileName: options.fileName } : {}),
        reason: 'not an object',
      },
    );
  }
  return value;
}

/** Built-in JSON parser: nested or flat JSON objects, i18next/ICU compatible. */
export const jsonParser: LocaleFileParser = {
  name: 'json',
  extensions: ['.json'],
  parse(text, options): ParsedLocale {
    const data = parseJsonTranslations(text, options);
    return { format: 'json', data, flat: flattenTranslations(data) };
  },
  serialize(data): string {
    return `${JSON.stringify(data, null, 2)}\n`;
  },
};
