import { describe, expect, it } from 'vitest';
import {
  ConfigError,
  aiSeverity,
  builtinRules,
  defineConfig,
  resolveConfig,
  resolveGlossary,
  resolveRuleSettings,
} from '../../src/index.js';

describe('resolveConfig', () => {
  it('applies defaults, including nested objects', () => {
    const config = resolveConfig({});
    expect(config.sourceLocale).toBe('en');
    expect(config.localesPath).toBe('./locales');
    expect(config.include).toEqual(['*.json']);
    expect(config.failOn).toBe('error');
    expect(config.scoring.weights).toEqual({ error: 5, warning: 2, info: 0.25 });
    expect(config.scoring.baselineKeys).toBe(100);
    expect(config.ai.enabled).toBe(false);
    expect(config.ai.batchSize).toBe(25);
  });

  it('accepts a partial nested override', () => {
    const config = resolveConfig({ scoring: { weights: { error: 8 } } });
    expect(config.scoring.weights).toEqual({ error: 8, warning: 2, info: 0.25 });
  });

  it('rejects invalid values with a readable message', () => {
    expect(() => resolveConfig({ failOn: 'sometimes' })).toThrow(ConfigError);
    expect(() => resolveConfig({ failOn: 'sometimes' })).toThrow(/failOn/);
  });

  it('defineConfig is an identity helper', () => {
    const input = { sourceLocale: 'de' };
    expect(defineConfig(input)).toBe(input);
  });
});

describe('resolveRuleSettings', () => {
  it('uses rule defaults when nothing is configured', () => {
    const settings = resolveRuleSettings(resolveConfig({}), builtinRules);
    expect(settings.get('missingKey')).toEqual({ severity: 'error', options: {} });
    expect(settings.get('length')?.severity).toBe('warning');
    expect(settings.get('length')?.options).toMatchObject({ maxRatio: 3 });
  });

  it('accepts severities and [severity, options] tuples', () => {
    const settings = resolveRuleSettings(
      resolveConfig({ rules: { extraKey: 'off', length: ['error', { maxRatio: 2 }] } }),
      builtinRules,
    );
    expect(settings.get('extraKey')?.severity).toBe('off');
    expect(settings.get('length')).toMatchObject({ severity: 'error', options: { maxRatio: 2 } });
  });

  it('rejects unknown rule names', () => {
    expect(() =>
      resolveRuleSettings(resolveConfig({ rules: { missingKeys: 'error' } }), builtinRules),
    ).toThrow(/Unknown rule "missingKeys"/);
  });

  it('rejects invalid rule options', () => {
    expect(() =>
      resolveRuleSettings(
        resolveConfig({ rules: { length: ['warning', { maxRatio: -1 }] } }),
        builtinRules,
      ),
    ).toThrow(/Invalid options for rule "length"/);
  });

  it('allows configuring AI issue severities', () => {
    const config = resolveConfig({ rules: { tone: 'warning', grammar: 'off' } });
    expect(aiSeverity(config, 'tone')).toBe('warning');
    expect(aiSeverity(config, 'grammar')).toBe('off');
    expect(aiSeverity(config, 'semantic')).toBe('warning');
    expect(aiSeverity(config, 'style')).toBe('info');
  });
});

describe('resolveGlossary', () => {
  it('normalizes shorthand and full entries', () => {
    const entries = resolveGlossary(
      resolveConfig({
        glossary: {
          Withdrawal: { es: 'Retiro', de: 'Auszahlung' },
          API: { doNotTranslate: true, caseSensitive: true },
          Wallet: { translations: { es: 'Cartera' }, description: 'The in-app wallet' },
        },
      }).glossary,
    );
    expect(entries).toEqual([
      { term: 'API', translations: {}, doNotTranslate: true, caseSensitive: true },
      {
        term: 'Wallet',
        translations: { es: 'Cartera' },
        doNotTranslate: false,
        caseSensitive: false,
        description: 'The in-app wallet',
      },
      {
        term: 'Withdrawal',
        translations: { es: 'Retiro', de: 'Auszahlung' },
        doNotTranslate: false,
        caseSensitive: false,
      },
    ]);
  });
});
