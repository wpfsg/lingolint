import { jsonParser } from './json.js';
import type { LocaleFileParser } from './types.js';

const parsers = new Map<string, LocaleFileParser>();

/** Register a parser for its extensions, replacing any previous registration. */
export function registerParser(parser: LocaleFileParser): void {
  for (const extension of parser.extensions) {
    parsers.set(extension.toLowerCase(), parser);
  }
}

/** Find the parser for a file name by extension, or `undefined`. */
export function getParserForFile(fileName: string): LocaleFileParser | undefined {
  const index = fileName.lastIndexOf('.');
  if (index === -1) {
    return undefined;
  }
  return parsers.get(fileName.slice(index).toLowerCase());
}

/** All extensions with a registered parser, sorted. */
export function supportedExtensions(): string[] {
  return Array.from(parsers.keys()).sort();
}

registerParser(jsonParser);
