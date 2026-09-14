import { describe, expect, it } from 'vitest';
import { emptyTranslationRule, extraKeyRule, missingKeyRule } from '../../src/index.js';
import { runRule } from '../helpers.js';

describe('missingKey', () => {
  it('reports source keys absent from the target', () => {
    const issues = runRule(
      missingKeyRule,
      { save: 'Save', cancel: 'Cancel', delete: 'Delete' },
      { save: 'Guardar', cancel: 'Cancelar' },
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ key: 'delete', sourceText: 'Delete' });
  });

  it('respects ignored keys', () => {
    expect(runRule(missingKeyRule, { a: 'A' }, {}, { ignoreKeys: ['a'] })).toEqual([]);
  });
});

describe('extraKey', () => {
  it('reports target keys absent from the source', () => {
    const issues = runRule(extraKeyRule, { save: 'Save' }, { save: 'Guardar', old: 'Viejo' });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ key: 'old', translatedText: 'Viejo' });
  });
});

describe('emptyTranslation', () => {
  it('reports empty and whitespace-only translations', () => {
    const issues = runRule(
      emptyTranslationRule,
      { a: 'Text', b: 'Text', c: 'Text' },
      { a: '', b: '   ', c: 'ok' },
    );
    expect(issues.map((i) => i.key)).toEqual(['a', 'b']);
  });

  it('allows an empty translation when the source is empty too', () => {
    expect(runRule(emptyTranslationRule, { a: '' }, { a: '' })).toEqual([]);
  });
});
