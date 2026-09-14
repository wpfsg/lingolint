import { describe, expect, it } from 'vitest';
import {
  duplicateTranslationRule,
  glossaryRule,
  identicalToSourceRule,
  lengthRule,
  whitespaceRule,
} from '../../src/index.js';
import { glossaryEntry, runRule } from '../helpers.js';

describe('whitespace rule', () => {
  it('detects leading, trailing, repeated spaces, tabs and stray newlines', () => {
    const issues = runRule(
      whitespaceRule,
      { a: 'Settings', b: 'Save', c: 'Two words', d: 'Tab', e: 'One line' },
      { a: ' Ajustes ', b: 'Guardar', c: 'Dos  palabras', d: 'Tab\tulador', e: 'Dos\nlíneas' },
    );
    expect(issues.map((i) => i.key)).toEqual(['a', 'c', 'd', 'e']);
    expect(issues[0]?.message).toBe('Translation contains leading whitespace, trailing whitespace');
    expect(issues[0]?.suggestion).toBe('Ajustes');
    expect(issues[1]?.suggestion).toBe('Dos palabras');
  });

  it('does not flag whitespace that the source also has', () => {
    expect(runRule(whitespaceRule, { a: 'Line 1\nLine 2 ' }, { a: 'Línea 1\nLínea 2 ' })).toEqual(
      [],
    );
  });

  it('can disable individual checks', () => {
    expect(
      runRule(whitespaceRule, { a: 'x' }, { a: 'x ' }, { options: { trailing: false } }),
    ).toEqual([]);
  });
});

describe('identicalToSource rule', () => {
  it('flags multi-word untranslated text as a confident finding', () => {
    const [issue] = runRule(
      identicalToSourceRule,
      { a: 'Account settings' },
      { a: 'Account settings' },
    );
    expect(issue).toMatchObject({ key: 'a', confidence: 0.7 });
    expect(issue?.maxSeverity).toBeUndefined();
  });

  it('downgrades single words to info', () => {
    const [issue] = runRule(identicalToSourceRule, { a: 'Notely' }, { a: 'Notely' });
    expect(issue).toMatchObject({ maxSeverity: 'info', confidence: 0.5 });
  });

  it('skips acronyms, numbers, placeholders-only strings and the ignore list', () => {
    const issues = runRule(
      identicalToSourceRule,
      { a: 'API', b: '{count}', c: '2024', d: 'Bitcoin', e: 'OAuth 2.0', f: '<br/>' },
      { a: 'API', b: '{count}', c: '2024', d: 'Bitcoin', e: 'OAuth 2.0', f: '<br/>' },
      { options: { ignore: ['bitcoin'] } },
    );
    expect(issues.map((i) => i.key)).toEqual(['e']);
  });

  it('skips glossary do-not-translate terms', () => {
    const issues = runRule(
      identicalToSourceRule,
      { a: 'Telegram' },
      { a: 'Telegram' },
      { glossary: [glossaryEntry({ term: 'Telegram', doNotTranslate: true })] },
    );
    expect(issues).toEqual([]);
  });

  it('does nothing when both locales share a language', () => {
    expect(
      runRule(identicalToSourceRule, { a: 'Colour' }, { a: 'Colour' }, { targetLocale: 'en-GB' }),
    ).toEqual([]);
  });
});

describe('length rule', () => {
  it('flags translations that are much longer than the source', () => {
    const [issue] = runRule(lengthRule, { a: 'Connect' }, { a: 'Conectar con la cuenta' });
    expect(issue?.message).toMatch(/significantly longer .*3\.1×/);
    expect(issue?.details).toMatchObject({ sourceLength: 7, targetLength: 22 });
  });

  it('ignores short strings with a small absolute difference', () => {
    expect(runRule(lengthRule, { a: 'OK' }, { a: 'Aceptar' })).toEqual([]);
  });

  it('reports much shorter translations as at most info', () => {
    const [issue] = runRule(
      lengthRule,
      { a: 'Please review the following information carefully' },
      { a: 'Revisa' },
    );
    expect(issue?.maxSeverity).toBe('info');
  });

  it('enforces per-key character limits', () => {
    const issues = runRule(
      lengthRule,
      { 'nav.home': 'Home', 'nav.settings': 'Settings' },
      { 'nav.home': 'Inicio', 'nav.settings': 'Configuración avanzada' },
      { options: { limits: { 'nav.*': 12 } } },
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain('12-character limit');
  });

  it('respects a custom ratio', () => {
    expect(
      runRule(
        lengthRule,
        { a: 'Connect' },
        { a: 'Conectar con la cuenta' },
        { options: { maxRatio: 4 } },
      ),
    ).toEqual([]);
  });
});

describe('duplicateTranslation rule', () => {
  it('groups different source strings sharing one translation', () => {
    const [issue] = runRule(
      duplicateTranslationRule,
      { close: 'Close', exit: 'Exit', save: 'Save' },
      { close: 'Cerrar', exit: 'Cerrar', save: 'Guardar' },
    );
    expect(issue).toMatchObject({ key: 'close', relatedKeys: ['exit'] });
    expect(issue?.explanation).toContain('exit: "Exit"');
  });

  it('ignores identical source strings and short values', () => {
    expect(
      runRule(
        duplicateTranslationRule,
        { a: 'Close', b: 'close', c: 'Y', d: 'N' },
        { a: 'Cerrar', b: 'Cerrar', c: 'S', d: 'S' },
      ),
    ).toEqual([]);
  });
});

describe('glossary rule', () => {
  const glossary = [
    glossaryEntry({ term: 'Withdrawal', translations: { es: 'Retiro' } }),
    glossaryEntry({ term: 'API', doNotTranslate: true, caseSensitive: true }),
  ];

  it('reports a preferred translation that is not used', () => {
    const issues = runRule(
      glossaryRule,
      { a: 'Withdrawal requested', b: 'Withdrawal complete' },
      { a: 'Retirada solicitada', b: 'Retiro completado' },
      { glossary },
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toBe('Glossary term "Withdrawal" should be translated as "Retiro"');
  });

  it('reports translated do-not-translate terms', () => {
    const issues = runRule(
      glossaryRule,
      { a: 'API keys' },
      { a: 'Claves de la interfaz' },
      { glossary },
    );
    expect(issues[0]?.message).toContain('must not be translated');
  });

  it('matches whole words only', () => {
    expect(runRule(glossaryRule, { a: 'Withdrawals' }, { a: 'Retiradas' }, { glossary })).toEqual(
      [],
    );
  });

  it('does nothing without glossary entries for the target locale', () => {
    expect(
      runRule(
        glossaryRule,
        { a: 'Withdrawal' },
        { a: 'Auszahlung' },
        { glossary, targetLocale: 'de' },
      ),
    ).toEqual([]);
  });
});
