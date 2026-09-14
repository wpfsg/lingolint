import {
  FlattenError,
  LocaleParseError,
  getParserForFile,
  type FlatTranslations,
  type NestedTranslations,
} from '@lingolint/core';

export interface LoadedLocale {
  /** Locale code derived from the file name, e.g. `es` for `es.json`. */
  locale: string;
  fileName: string;
  data: NestedTranslations;
  flat: FlatTranslations;
}

export class FileLoadError extends Error {
  override readonly name = 'FileLoadError';
  constructor(
    readonly fileName: string,
    message: string,
  ) {
    super(message);
  }
}

export function localeFromFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

/** Parse file text with the same parser registry the CLI uses. */
export function parseLocaleText(fileName: string, text: string): LoadedLocale {
  const parser = getParserForFile(fileName);
  if (!parser) {
    throw new FileLoadError(
      fileName,
      'Unsupported file type. Only .json files are supported right now.',
    );
  }
  try {
    const parsed = parser.parse(text, { fileName });
    return { locale: localeFromFileName(fileName), fileName, data: parsed.data, flat: parsed.flat };
  } catch (error) {
    if (error instanceof LocaleParseError || error instanceof FlattenError) {
      throw new FileLoadError(fileName, error.message);
    }
    throw error;
  }
}

export async function readLocaleFile(file: File): Promise<LoadedLocale> {
  const text = await file.text();
  return parseLocaleText(file.name, text);
}

/** Pick the most likely source locale from the loaded files. */
export function guessSourceLocale(locales: readonly LoadedLocale[]): string | undefined {
  const codes = locales.map((l) => l.locale);
  return (
    codes.find((code) => code === 'en') ??
    codes.find((code) => code.toLowerCase().startsWith('en')) ??
    codes[0]
  );
}
