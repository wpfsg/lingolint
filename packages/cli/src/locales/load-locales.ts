import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  FlattenError,
  LocaleParseError,
  compileKeyMatcher,
  getParserForFile,
  supportedExtensions,
  type NestedTranslations,
} from '@lingolint/core';
import { CliError } from '../errors.js';

export interface LoadedLocaleFile {
  locale: string;
  filePath: string;
  data: NestedTranslations;
}

export interface LoadedLocales {
  directory: string;
  files: LoadedLocaleFile[];
  /** locale → nested translations, ready for `analyzeProject`. */
  locales: Record<string, NestedTranslations>;
}

/** `es.json` → `es`, `pt-BR.json` → `pt-BR`. */
export function localeFromFileName(fileName: string): string {
  return path.basename(fileName, path.extname(fileName));
}

/** Refuse path segments that escape the locales directory. */
function assertSafeName(name: string): void {
  if (name.includes('/') || name.includes('\\') || name === '..' || name.includes('\0')) {
    throw new CliError(`Refusing to read suspicious file name "${name}"`);
  }
}

/**
 * Read every locale file from a directory: one file per locale, named after
 * the locale code (`en.json`, `es.json`, ...). Only files matching `include`
 * patterns with a registered parser are considered.
 */
export async function loadLocales(
  directory: string,
  include: readonly string[],
): Promise<LoadedLocales> {
  let entries: string[];
  try {
    const info = await stat(directory);
    if (!info.isDirectory()) {
      throw new CliError(
        `${directory} is not a directory`,
        'Point LingoLint at the folder that contains your locale files.',
      );
    }
    entries = await readdir(directory);
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    throw new CliError(
      `Locales directory not found: ${directory}`,
      'Pass the folder as an argument (lingolint scan ./locales) or set localesPath in lingolint.config.ts.',
    );
  }

  const matches = compileKeyMatcher(include);
  const files: LoadedLocaleFile[] = [];
  const locales: Record<string, NestedTranslations> = {};

  for (const name of entries.sort()) {
    if (!matches(name) || getParserForFile(name) === undefined) {
      continue;
    }
    assertSafeName(name);
    const filePath = path.join(directory, name);
    if (!(await stat(filePath)).isFile()) {
      continue;
    }
    const parser = getParserForFile(name);
    if (!parser) {
      continue;
    }
    const text = await readFile(filePath, 'utf8');
    let data: NestedTranslations;
    try {
      data = parser.parse(text, { fileName: filePath }).data;
    } catch (error) {
      if (error instanceof LocaleParseError) {
        throw new CliError(`Unable to parse ${filePath}\n\n${error.message}`);
      }
      if (error instanceof FlattenError) {
        throw new CliError(`Unable to load ${filePath}\n\n${error.message}`);
      }
      throw error;
    }
    const locale = localeFromFileName(name);
    if (Object.hasOwn(locales, locale)) {
      throw new CliError(`Locale "${locale}" is defined by more than one file in ${directory}`);
    }
    files.push({ locale, filePath, data });
    locales[locale] = data;
  }

  if (files.length === 0) {
    throw new CliError(
      `No locale files found in ${directory}`,
      `Looked for files matching ${include.join(', ')} with one of these extensions: ${supportedExtensions().join(', ')}.`,
    );
  }
  return { directory, files, locales };
}
