import { describe, expect, it } from 'vitest';
import { checkTagBalance, compareTags, extractTags, stripTags } from '../../src/index.js';

describe('extractTags', () => {
  it('tokenizes open, close, self-closing and void tags', () => {
    const tags = extractTags('Click <strong>Continue</strong><br/> or <a href="/x">here</a><br>');
    expect(tags.map((t) => `${t.kind}:${t.name}`)).toEqual([
      'open:strong',
      'close:strong',
      'self:br',
      'open:a',
      'close:a',
      'self:br',
    ]);
  });

  it('supports numeric component tags used by react-i18next', () => {
    expect(extractTags('<0>Hello</0> <1/>').map((t) => `${t.kind}:${t.name}`)).toEqual([
      'open:0',
      'close:0',
      'self:1',
    ]);
  });

  it('ignores stray angle brackets that are not tags', () => {
    expect(extractTags('a < b and b > c')).toEqual([]);
    expect(extractTags('x <- y')).toEqual([]);
  });
});

describe('checkTagBalance', () => {
  it('reports unclosed and unopened tags', () => {
    expect(checkTagBalance(extractTags('<b>bold <i>italic</b>'))).toEqual({
      unclosed: ['i'],
      unopened: [],
    });
    expect(checkTagBalance(extractTags('text</strong>'))).toEqual({
      unclosed: [],
      unopened: ['strong'],
    });
  });
});

describe('compareTags', () => {
  it('passes when markup matches', () => {
    expect(
      compareTags('Click <strong>Continue</strong>', 'Haz clic en <strong>Continuar</strong>').ok,
    ).toBe(true);
  });

  it('detects an unclosed tag in the translation', () => {
    const result = compareTags('Click <strong>Continue</strong>', 'Haz clic en <strong>Continuar');
    expect(result.ok).toBe(false);
    expect(result.balance.unclosed).toEqual(['strong']);
    expect(result.missing).toEqual(['</strong>']);
  });

  it('detects missing and unexpected tags', () => {
    const result = compareTags('<a>Terms</a>', 'Términos <b>x</b>');
    expect(result.missing).toEqual(['<a>', '</a>']);
    expect(result.unexpected).toEqual(['<b>', '</b>']);
  });

  it('does not blame the translation for imbalance shared with the source', () => {
    const result = compareTags('<b>oops', '<b>ups');
    expect(result.balance.unclosed).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

describe('stripTags', () => {
  it('removes markup', () => {
    expect(stripTags('<b>Bold</b>').trim()).toBe('Bold');
  });
});
