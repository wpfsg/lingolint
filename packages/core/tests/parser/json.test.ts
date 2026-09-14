import { describe, expect, it } from 'vitest';
import {
  LocaleParseError,
  getParserForFile,
  jsonParser,
  parseJsonTranslations,
  supportedExtensions,
} from '../../src/index.js';

describe('parseJsonTranslations', () => {
  it('parses nested JSON and strips a BOM', () => {
    expect(parseJsonTranslations('﻿{"a":{"b":"c"}}')).toEqual({ a: { b: 'c' } });
  });

  it('reports line and column for syntax errors', () => {
    const text = '{\n  "save": "Save"\n  "cancel": "Cancel"\n}';
    let caught: unknown;
    try {
      parseJsonTranslations(text, { fileName: 'locales/es.json' });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(LocaleParseError);
    const error = caught as LocaleParseError;
    expect(error.fileName).toBe('locales/es.json');
    expect(error.line).toBe(3);
    expect(error.column).toBeGreaterThan(0);
    expect(error.message).toMatch(/Invalid JSON near line 3, column \d+/);
    expect(error.message).not.toMatch(/at position/);
    expect(error.message).toContain('^');
  });

  it('rejects non-object roots with a clear message', () => {
    expect(() => parseJsonTranslations('["a"]')).toThrow(/found an array/);
    expect(() => parseJsonTranslations('"text"')).toThrow(/found string/);
    expect(() => parseJsonTranslations('null')).toThrow(/found null/);
  });
});

describe('jsonParser', () => {
  it('returns nested data and flat keys', () => {
    const parsed = jsonParser.parse('{"a":{"b":"c"}}');
    expect(parsed.format).toBe('json');
    expect(parsed.data).toEqual({ a: { b: 'c' } });
    expect(parsed.flat).toEqual({ 'a.b': 'c' });
  });

  it('serializes with two-space indentation and a trailing newline', () => {
    expect(jsonParser.serialize?.({ a: 'b' })).toBe('{\n  "a": "b"\n}\n');
  });
});

describe('parser registry', () => {
  it('resolves parsers by extension, case-insensitively', () => {
    expect(getParserForFile('en.json')?.name).toBe('json');
    expect(getParserForFile('EN.JSON')?.name).toBe('json');
    expect(getParserForFile('en.yaml')).toBeUndefined();
    expect(getParserForFile('noext')).toBeUndefined();
    expect(supportedExtensions()).toEqual(['.json']);
  });
});
