import { describe, expect, it, vi } from 'vitest';
import {
  analyzeProject,
  analyzeTranslations,
  analyzeTranslationsSync,
  selectItemsForAIReview,
  type TranslationAIProvider,
  type TranslationReviewInput,
} from '../../src/index.js';
import { loadExample } from '../helpers.js';

const en = loadExample('en');
const es = loadExample('es');
const de = loadExample('de');

describe('analyzeTranslationsSync with the basic example', () => {
  const report = analyzeTranslationsSync({
    sourceLocale: 'en',
    targetLocale: 'es',
    source: en,
    target: es,
  });
  const byKey = (key: string) => report.issues.filter((issue) => issue.key === key);

  it('detects every deliberate problem in es.json', () => {
    expect(byKey('common.delete')[0]).toMatchObject({ type: 'missing_key', severity: 'error' });
    expect(byKey('common.legacyExport')[0]).toMatchObject({
      type: 'extra_key',
      severity: 'warning',
    });
    expect(byKey('checkout.total')[0]).toMatchObject({
      type: 'placeholder_mismatch',
      severity: 'error',
      message: 'Missing placeholder: {currency}',
    });
    expect(byKey('errors.generic')[0]).toMatchObject({
      type: 'empty_translation',
      severity: 'error',
    });
    expect(byKey('notes.deleteConfirm')[0]).toMatchObject({
      type: 'html_mismatch',
      severity: 'error',
    });
    expect(byKey('profile.accountSettings')[0]).toMatchObject({
      type: 'identical_to_source',
      severity: 'warning',
    });
    expect(byKey('nav.settings')[0]).toMatchObject({ type: 'whitespace', severity: 'warning' });
    expect(byKey('profile.connect')[0]).toMatchObject({ type: 'length', severity: 'warning' });
    expect(byKey('common.close')[0]).toMatchObject({
      type: 'duplicate_translation',
      severity: 'info',
      relatedKeys: ['common.exit'],
    });
  });

  it('does not report false positives on correct strings', () => {
    for (const key of [
      'common.save',
      'auth.terms',
      'notes.shared',
      'checkout.perMonth',
      'profile.apiKeys',
    ]) {
      expect(byKey(key)).toEqual([]);
    }
  });

  it('reports the untranslated product name only as a low-confidence suggestion', () => {
    expect(byKey('app.name')[0]).toMatchObject({
      type: 'identical_to_source',
      severity: 'info',
      confidence: 0.5,
    });
  });

  it('produces a summary, key count, display name and score', () => {
    expect(report.targetLocaleName).toBe('Spanish');
    expect(report.keyCount).toBe(32);
    expect(report.summary.errors).toBe(4);
    expect(report.summary.warnings).toBe(4);
    expect(report.summary.info).toBe(2);
    expect(report.score).toBe(72); // 100 - 4×5 - 4×2 - 2×0.25 → 71.5 → 72
  });

  it('sorts issues by severity then key', () => {
    const severities = report.issues.map((issue) => issue.severity);
    const sorted = [...severities].sort(
      (a, b) => ['error', 'warning', 'info'].indexOf(a) - ['error', 'warning', 'info'].indexOf(b),
    );
    expect(severities).toEqual(sorted);
  });

  it('is deterministic', () => {
    const again = analyzeTranslationsSync({
      sourceLocale: 'en',
      targetLocale: 'es',
      source: en,
      target: es,
    });
    expect(again).toEqual(report);
    expect(new Set(report.issues.map((i) => i.id)).size).toBe(report.issues.length);
  });

  it('flags the renamed placeholder and double space in de.json', () => {
    const deReport = analyzeTranslationsSync({
      sourceLocale: 'en',
      targetLocale: 'de',
      source: en,
      target: de,
    });
    expect(deReport.targetLocaleName).toBe('German');
    expect(deReport.issues.find((i) => i.key === 'auth.welcome')?.message).toBe(
      'Placeholder {name} appears to have been renamed to {Name}',
    );
    expect(deReport.issues.find((i) => i.key === 'notes.empty')?.type).toBe('whitespace');
    expect(deReport.issues.find((i) => i.key === 'errors.notFound')?.type).toBe(
      'identical_to_source',
    );
    expect(deReport.issues.find((i) => i.key === 'auth.signOut')).toMatchObject({
      type: 'duplicate_translation',
      relatedKeys: ['common.exit'],
    });
    expect(deReport.summary).toEqual({ errors: 1, warnings: 2, info: 2, total: 5 });
    expect(deReport.score).toBe(91);
  });
});

describe('configuration effects', () => {
  const source = { a: 'Save', b: 'Total {x}', c: 'Notely' };
  const target = { a: 'Save', b: 'Total', c: 'Notely', d: 'extra' };

  it('applies configured severities and disables rules', () => {
    const report = analyzeTranslationsSync({
      sourceLocale: 'en',
      targetLocale: 'es',
      source,
      target,
      config: { rules: { placeholders: 'warning', extraKey: 'off', identicalToSource: 'error' } },
    });
    expect(report.issues.find((i) => i.key === 'b')?.severity).toBe('warning');
    expect(report.issues.find((i) => i.key === 'd')).toBeUndefined();
    // Configured error, but the rule caps single-word findings at info.
    expect(report.issues.find((i) => i.key === 'c')?.severity).toBe('info');
    expect(report.issues.find((i) => i.key === 'a')?.severity).toBe('info');
  });

  it('honours ignoreKeys patterns', () => {
    const report = analyzeTranslationsSync({
      sourceLocale: 'en',
      targetLocale: 'es',
      source: { 'legal.terms': 'Terms', 'legal.privacy': 'Privacy', save: 'Save' },
      target: { 'legal.terms': 'Terms', save: 'Save' },
      config: { ignoreKeys: ['legal.*'] },
    });
    expect(report.issues.map((i) => i.key)).toEqual(['save']);
  });

  it('accepts flat input', () => {
    const report = analyzeTranslationsSync({
      sourceLocale: 'en',
      targetLocale: 'de',
      source: { save: 'Save' },
      target: { save: 'Speichern' },
    });
    expect(report.issues).toEqual([]);
    expect(report.score).toBe(100);
  });
});

describe('analyzeProject', () => {
  it('analyzes every non-source locale and aggregates', async () => {
    const seen: string[] = [];
    const report = await analyzeProject({
      sourceLocale: 'en',
      locales: { en, es, de },
      onLocaleReport: (locale) => seen.push(locale.targetLocale),
    });
    expect(report.schemaVersion).toBe(1);
    expect(report.locales.map((l) => l.targetLocale)).toEqual(['de', 'es']);
    expect(seen.sort()).toEqual(['de', 'es']);
    expect(report.summary.total).toBe(
      report.locales[0]!.summary.total + report.locales[1]!.summary.total,
    );
    expect(report.overallScore).toBe(
      Math.round((report.locales[0]!.score + report.locales[1]!.score) / 2),
    );
  });

  it('restricts to requested targets', async () => {
    const report = await analyzeProject({
      sourceLocale: 'en',
      locales: { en, es, de },
      targets: ['de'],
    });
    expect(report.locales.map((l) => l.targetLocale)).toEqual(['de']);
  });

  it('fails clearly when the source locale is missing', async () => {
    await expect(analyzeProject({ sourceLocale: 'fr', locales: { en, es } })).rejects.toThrow(
      /Source locale "fr" was not found. Available locales: en, es/,
    );
  });
});

describe('AI review integration', () => {
  const source = {
    greet: 'Open the app to continue.',
    total: 'Total {x}',
    brand: 'Notely',
    empty: 'Hi',
  };
  const target = {
    greet: 'Abra la aplicación para continuar.',
    total: 'Total',
    brand: 'Notely',
    empty: '',
  };

  function provider(
    findings: unknown[],
  ): TranslationAIProvider & { calls: TranslationReviewInput[] } {
    const calls: TranslationReviewInput[] = [];
    return {
      name: 'mock',
      calls,
      review: vi.fn((input: TranslationReviewInput) => {
        calls.push(input);
        return Promise.resolve({ findings: findings as never, stats: { cached: 1 } });
      }),
    };
  }

  it('only sends strings that passed deterministic checks', () => {
    const report = analyzeTranslationsSync({
      sourceLocale: 'en',
      targetLocale: 'es',
      source,
      target,
    });
    const { items, skipped } = selectItemsForAIReview(
      {
        source,
        target,
        sharedKeys: ['brand', 'empty', 'greet', 'total'],
        isIgnored: () => false,
      },
      report.issues,
    );
    expect(items.map((i) => i.key)).toEqual(['greet']);
    expect(skipped).toBe(3);
  });

  it('merges findings, applies confidence policy and keeps deterministic results', async () => {
    const ai = provider([
      {
        key: 'greet',
        type: 'tone',
        message: 'Tone inconsistency',
        explanation: 'Other strings use informal Spanish.',
        suggestion: 'Abre la aplicación para continuar.',
        confidence: 0.9,
      },
      {
        key: 'greet',
        type: 'grammar',
        message: 'Low confidence',
        explanation: 'x',
        confidence: 0.6,
      },
      { key: 'greet', type: 'style', message: 'Dropped', explanation: 'x', confidence: 0.2 },
      {
        key: 'total',
        type: 'semantic',
        message: 'Not sent, ignored',
        explanation: 'x',
        confidence: 1,
      },
    ]);
    const report = await analyzeTranslations({
      sourceLocale: 'en',
      targetLocale: 'es',
      source,
      target,
      config: { ai: { enabled: true }, context: 'A notes app', rules: { tone: 'warning' } },
      ai,
    });
    expect(ai.calls).toHaveLength(1);
    expect(ai.calls[0]?.context).toBe('A notes app');
    expect(ai.calls[0]?.items.map((i) => i.key)).toEqual(['greet']);

    const aiIssues = report.issues.filter((i) => i.origin === 'ai');
    expect(aiIssues.map((i) => [i.type, i.severity])).toEqual([
      ['tone', 'warning'],
      ['grammar', 'info'],
    ]);
    expect(aiIssues.find((i) => i.type === 'tone')?.suggestion).toBe(
      'Abre la aplicación para continuar.',
    );
    expect(report.issues.filter((i) => i.origin === 'deterministic')).toHaveLength(3);
    expect(report.ai).toEqual({ provider: 'mock', reviewed: 1, cached: 1, skipped: 3 });
  });

  it('does not call the provider unless AI is enabled', async () => {
    const ai = provider([]);
    await analyzeTranslations({ sourceLocale: 'en', targetLocale: 'es', source, target, ai });
    expect(ai.calls).toHaveLength(0);
  });

  it('survives provider failures', async () => {
    const ai: TranslationAIProvider = {
      name: 'broken',
      review: () => Promise.reject(new Error('quota exceeded')),
    };
    const report = await analyzeTranslations({
      sourceLocale: 'en',
      targetLocale: 'es',
      source,
      target,
      config: { ai: { enabled: true } },
      ai,
    });
    expect(report.ai?.error).toBe('quota exceeded');
    expect(report.issues.length).toBe(3);
  });
});
