import { describe, expect, it } from 'vitest';
import {
  parseLocaleText,
  guessSourceLocale,
  localeFromFileName,
  FileLoadError,
} from '../src/lib/files.js';
import { countByGroup, defaultFilters, filterIssues } from '../src/lib/filters.js';
import {
  analyzeWithReview,
  applyReview,
  changeCount,
  clearEdit,
  emptyReviewState,
  exportTarget,
  removeKey,
  restoreKey,
  setEdit,
  toggleIgnored,
} from '../src/lib/review.js';

const en = parseLocaleText(
  'en.json',
  JSON.stringify({
    checkout: { total: 'Total: {amount} {currency}', pay: 'Pay' },
    nav: { home: 'Home' },
  }),
);
const es = parseLocaleText(
  'es.json',
  JSON.stringify({
    checkout: { total: 'Total: {amount}', pay: 'Pagar', old: 'Viejo' },
    nav: { home: 'Inicio ' },
  }),
);

describe('files', () => {
  it('derives locales from file names and parses with the core parser', () => {
    expect(localeFromFileName('locales/pt-BR.json')).toBe('pt-BR');
    expect(en.locale).toBe('en');
    expect(es.flat['checkout.old']).toBe('Viejo');
  });

  it('reports parse errors with the file name', () => {
    expect(() => parseLocaleText('bad.json', '{ nope')).toThrow(FileLoadError);
    expect(() => parseLocaleText('bad.json', '{ nope')).toThrow(/Invalid JSON/);
    expect(() => parseLocaleText('file.yaml', 'a: b')).toThrow(/Unsupported file type/);
  });

  it('guesses the source locale', () => {
    expect(guessSourceLocale([es, en])).toBe('en');
    expect(guessSourceLocale([es])).toBe('es');
  });
});

describe('review state', () => {
  it('applies edits and removals while preserving structure', () => {
    let state = setEdit(emptyReviewState, 'checkout.total', 'Total: {amount} {currency}');
    state = removeKey(state, 'checkout.old');
    expect(applyReview(es.data, state)).toEqual({
      checkout: { total: 'Total: {amount} {currency}', pay: 'Pagar' },
      nav: { home: 'Inicio ' },
    });
    expect(changeCount(state)).toBe(2);
    expect(es.data).toEqual(parseLocaleText('es.json', JSON.stringify(es.data)).data);
  });

  it('re-analyzes with edits so fixed issues disappear', () => {
    const before = analyzeWithReview(en, es, emptyReviewState);
    expect(before.issues.map((i) => i.key).sort()).toEqual([
      'checkout.old',
      'checkout.total',
      'nav.home',
    ]);

    const state = setEdit(
      setEdit(emptyReviewState, 'checkout.total', 'Importe: {amount} {currency}'),
      'nav.home',
      'Inicio',
    );
    const after = analyzeWithReview(en, es, removeKey(state, 'checkout.old'));
    expect(after.issues).toEqual([]);
    expect(after.score).toBe(100);
  });

  it('exports formatted JSON with the same writer as the CLI', () => {
    const state = setEdit(emptyReviewState, 'nav.home', 'Inicio');
    const text = exportTarget(es, state);
    expect(text.endsWith('\n')).toBe(true);
    expect(JSON.parse(text)).toEqual({
      checkout: { total: 'Total: {amount}', pay: 'Pagar', old: 'Viejo' },
      nav: { home: 'Inicio' },
    });
  });

  it('toggles ignores, reverts edits and restores removals', () => {
    let state = toggleIgnored(emptyReviewState, 'abc');
    expect(state.ignored).toEqual(['abc']);
    state = toggleIgnored(state, 'abc');
    expect(state.ignored).toEqual([]);

    state = clearEdit(setEdit(state, 'k', 'v'), 'k');
    expect(state.edits).toEqual({});

    state = restoreKey(removeKey(state, 'k'), 'k');
    expect(state.removals).toEqual([]);
  });
});

describe('filters', () => {
  const issues = analyzeWithReview(en, es, emptyReviewState).issues;

  it('filters by severity, group, query and ignored state', () => {
    expect(
      filterIssues(issues, { ...defaultFilters, severity: 'error' }, []).map((i) => i.key),
    ).toEqual(['checkout.total']);
    expect(
      filterIssues(issues, { ...defaultFilters, groups: ['whitespace'] }, []).map((i) => i.key),
    ).toEqual(['nav.home']);
    expect(
      filterIssues(issues, { ...defaultFilters, query: 'VIEJO' }, []).map((i) => i.key),
    ).toEqual(['checkout.old']);
    const ignoredId = issues[0]!.id;
    expect(filterIssues(issues, defaultFilters, [ignoredId])).toHaveLength(issues.length - 1);
    expect(
      filterIssues(issues, { ...defaultFilters, showIgnored: true }, [ignoredId]),
    ).toHaveLength(issues.length);
  });

  it('counts issues per group', () => {
    expect(countByGroup(issues)).toEqual({ variables: 1, keys: 1, whitespace: 1 });
  });
});
