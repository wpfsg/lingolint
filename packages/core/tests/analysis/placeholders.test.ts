import { describe, expect, it } from 'vitest';
import { comparePlaceholders, extractPlaceholders, stripPlaceholders } from '../../src/index.js';

const canonical = (text: string) => extractPlaceholders(text).map((p) => p.canonical);

describe('extractPlaceholders', () => {
  it('recognises every supported syntax', () => {
    expect(canonical('{amount}')).toEqual(['{amount}']);
    expect(canonical('{{amount}}')).toEqual(['{{amount}}']);
    expect(canonical('${amount}')).toEqual(['${amount}']);
    expect(canonical('%{amount}')).toEqual(['%{amount}']);
    expect(canonical('%amount%')).toEqual(['%amount%']);
    expect(canonical('%s %d %1$s %.2f')).toEqual(['%s', '%d', '%1$s', '%.2f']);
    expect(canonical('{0} and {1}')).toEqual(['{0}', '{1}']);
  });

  it('records syntax, name and position', () => {
    const [placeholder] = extractPlaceholders('Send {amount, number} now');
    expect(placeholder).toMatchObject({
      raw: '{amount, number}',
      name: 'amount',
      syntax: 'icu',
      canonical: '{amount}',
      index: 5,
    });
  });

  it('does not treat {{x}} as a nested {x}', () => {
    expect(extractPlaceholders('{{amount}}')).toHaveLength(1);
  });

  it('ignores escaped percent signs and plain percentages', () => {
    expect(canonical('100%% done')).toEqual([]);
    expect(canonical('50% off')).toEqual([]);
    expect(canonical('Save 20% today')).toEqual([]);
  });

  it('ignores prose in braces and ICU plural blocks with nested braces', () => {
    expect(canonical('{this is not a placeholder}')).toEqual([]);
    expect(canonical('{count, plural, one {# item} other {# items}}')).toEqual([]);
  });

  it('can be restricted to specific syntaxes', () => {
    expect(
      extractPlaceholders('{a} {{b}} %s', { syntaxes: ['double_curly'] }).map((p) => p.canonical),
    ).toEqual(['{{b}}']);
  });
});

describe('comparePlaceholders', () => {
  it('passes when placeholders match regardless of order', () => {
    expect(comparePlaceholders('{a} then {b}', '{b} luego {a}').ok).toBe(true);
  });

  it('reports missing placeholders', () => {
    const result = comparePlaceholders('Total: {amount} {currency}', 'Total: {amount}');
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(['{currency}']);
    expect(result.unexpected).toEqual([]);
  });

  it('reports unexpected placeholders', () => {
    const result = comparePlaceholders('Hello', 'Hola {name}');
    expect(result.unexpected).toEqual(['{name}']);
  });

  it('detects a renamed placeholder', () => {
    const result = comparePlaceholders('Welcome, {name}', 'Bienvenido, {nombre}');
    expect(result.renamed).toEqual([{ from: '{name}', to: '{nombre}' }]);
  });

  it('detects placeholders renamed into non-Latin scripts or a different case', () => {
    expect(comparePlaceholders('Hi {name}', 'Привет, {имя}').renamed).toEqual([
      { from: '{name}', to: '{имя}' },
    ]);
    expect(comparePlaceholders('Hi {name}', 'Hallo {Name}').renamed).toEqual([
      { from: '{name}', to: '{Name}' },
    ]);
  });

  it('does not report a rename across different syntaxes', () => {
    const result = comparePlaceholders('Hi {name}', 'Hola {{name}}');
    expect(result.renamed).toEqual([]);
    expect(result.missing).toEqual(['{name}']);
    expect(result.unexpected).toEqual(['{{name}}']);
  });

  it('reports repetition count mismatches', () => {
    const result = comparePlaceholders('{x} and {x}', 'solo {x}');
    expect(result.countMismatches).toEqual([
      { placeholder: '{x}', sourceCount: 2, targetCount: 1 },
    ]);
    expect(result.ok).toBe(false);
  });

  it('treats {n} and {n, number} as the same placeholder', () => {
    expect(comparePlaceholders('{n, number} items', '{n} elementos').ok).toBe(true);
  });
});

describe('stripPlaceholders', () => {
  it('removes placeholders leaving other text', () => {
    expect(stripPlaceholders('Total: {amount}').trim()).toBe('Total:');
  });
});
