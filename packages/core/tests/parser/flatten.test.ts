import { describe, expect, it } from 'vitest';
import {
  FlattenError,
  applyFlatValues,
  flattenTranslations,
  isFlat,
  removeFlatKeys,
  unflattenTranslations,
} from '../../src/index.js';

describe('flattenTranslations', () => {
  it('flattens nested objects to dotted keys', () => {
    expect(
      flattenTranslations({
        account: { settings: { title: 'Account settings' } },
        save: 'Save',
      }),
    ).toEqual({
      'account.settings.title': 'Account settings',
      save: 'Save',
    });
  });

  it('flattens arrays with numeric segments', () => {
    expect(flattenTranslations({ steps: ['One', 'Two'] })).toEqual({
      'steps.0': 'One',
      'steps.1': 'Two',
    });
  });

  it('stringifies numbers and booleans and maps null to an empty string', () => {
    expect(flattenTranslations({ max: 10, enabled: true, missing: null })).toEqual({
      max: '10',
      enabled: 'true',
      missing: '',
    });
  });

  it('keeps literal dotted keys', () => {
    expect(flattenTranslations({ 'a.b': 'x' })).toEqual({ 'a.b': 'x' });
  });

  it('throws when a literal dotted key collides with a nested path', () => {
    expect(() => flattenTranslations({ 'a.b': 'x', a: { b: 'y' } })).toThrow(FlattenError);
  });

  it('returns already-flat input unchanged', () => {
    const flat = { save: 'Save', cancel: 'Cancel' };
    expect(isFlat(flat)).toBe(true);
    expect(flattenTranslations(flat)).toEqual(flat);
  });
});

describe('unflattenTranslations', () => {
  it('rebuilds nested objects', () => {
    expect(unflattenTranslations({ 'a.b.c': 'x', 'a.d': 'y', e: 'z' })).toEqual({
      a: { b: { c: 'x' }, d: 'y' },
      e: 'z',
    });
  });

  it('round-trips a nested structure without arrays', () => {
    const nested = { account: { settings: { title: 'T', subtitle: 'S' } }, save: 'Save' };
    expect(unflattenTranslations(flattenTranslations(nested))).toEqual(nested);
  });
});

describe('applyFlatValues', () => {
  it('writes values back preserving structure, order and unrelated content', () => {
    const original = {
      account: { settings: { title: 'Account settings', hint: 'Hint' } },
      steps: ['One', 'Two'],
      count: 3,
    };
    const result = applyFlatValues(original, {
      'account.settings.title': 'Ajustes de cuenta',
      'steps.1': 'Dos',
    });
    expect(result).toEqual({
      account: { settings: { title: 'Ajustes de cuenta', hint: 'Hint' } },
      steps: ['One', 'Dos'],
      count: 3,
    });
    expect(Object.keys(result)).toEqual(['account', 'steps', 'count']);
    expect(Array.isArray((result as { steps: unknown }).steps)).toBe(true);
  });

  it('does not mutate the original', () => {
    const original = { a: { b: 'x' } };
    applyFlatValues(original, { 'a.b': 'y' });
    expect(original).toEqual({ a: { b: 'x' } });
  });

  it('prefers existing literal dotted keys over nesting', () => {
    expect(applyFlatValues({ 'a.b': 'x' }, { 'a.b': 'y' })).toEqual({ 'a.b': 'y' });
  });

  it('creates nested objects for new keys', () => {
    expect(applyFlatValues({ a: { b: 'x' } }, { 'a.c.d': 'new', e: 'top' })).toEqual({
      a: { b: 'x', c: { d: 'new' } },
      e: 'top',
    });
  });
});

describe('removeFlatKeys', () => {
  it('removes keys and prunes empty parents', () => {
    expect(
      removeFlatKeys({ a: { b: 'x', c: 'y' }, d: { only: 'z' }, keep: 'k' }, ['a.b', 'd.only']),
    ).toEqual({ a: { c: 'y' }, keep: 'k' });
  });
});
