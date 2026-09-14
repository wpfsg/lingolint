import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AIFinding, TranslationAIProvider, TranslationReviewInput } from '@lingolint/core';
import { describe, expect, it, vi } from 'vitest';
import {
  AIProviderError,
  buildSystemPrompt,
  buildUserMessage,
  cacheKeyFor,
  chunk,
  createAnthropicProvider,
  createFileCache,
  createMemoryCache,
  createReviewerFromConfig,
  mergeResults,
  parseReviewJson,
  registerAIProvider,
  withBatching,
  withCache,
} from '../src/index.js';

function input(count: number, extra: Partial<TranslationReviewInput> = {}): TranslationReviewInput {
  return {
    sourceLocale: 'en',
    targetLocale: 'es',
    items: Array.from({ length: count }, (_, i) => ({
      key: `k${i}`,
      source: `Source ${i}`,
      target: `Destino ${i}`,
    })),
    glossary: [],
    ...extra,
  };
}

function finding(key: string, extra: Partial<AIFinding> = {}): AIFinding {
  return { key, type: 'style', message: 'm', explanation: 'e', confidence: 0.9, ...extra };
}

function recordingProvider(findingsFor: (keys: string[]) => AIFinding[] = () => []) {
  const calls: TranslationReviewInput[] = [];
  const provider: TranslationAIProvider = {
    name: 'mock',
    review: vi.fn((req: TranslationReviewInput) => {
      calls.push(req);
      return Promise.resolve({
        findings: findingsFor(req.items.map((i) => i.key)),
        stats: { requests: 1 },
      });
    }),
  };
  return { provider, calls };
}

describe('batching', () => {
  it('chunks and merges', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(
      mergeResults([
        { findings: [finding('a')], stats: { requests: 1, cached: 2 } },
        { findings: [finding('b')] },
      ]),
    ).toEqual({
      findings: [finding('a'), finding('b')],
      stats: { cached: 2, requests: 1, inputTokens: 0, outputTokens: 0 },
    });
  });

  it('splits large reviews into batches and merges findings in order', async () => {
    const { provider, calls } = recordingProvider((keys) =>
      keys.filter((k) => k === 'k0' || k === 'k7').map((k) => finding(k)),
    );
    const batched = withBatching(provider, { batchSize: 3, concurrency: 2 });
    const result = await batched.review(input(8));
    expect(calls.map((c) => c.items.length)).toEqual([3, 3, 2]);
    expect(result.findings.map((f) => f.key)).toEqual(['k0', 'k7']);
    expect(result.stats?.requests).toBe(3);
  });

  it('passes small reviews through untouched', async () => {
    const { provider, calls } = recordingProvider();
    await withBatching(provider, { batchSize: 10 }).review(input(4));
    expect(calls).toHaveLength(1);
  });
});

describe('cache', () => {
  it('serves repeated strings from the cache and re-reviews only new ones', async () => {
    const { provider, calls } = recordingProvider((keys) => keys.map((k) => finding(k)));
    const cache = createMemoryCache();
    const cached = withCache(provider, cache);

    const first = await cached.review(input(3));
    expect(first.findings).toHaveLength(3);
    expect(first.stats?.cached).toBe(0);
    expect(cache.size()).toBe(3);

    const second = await cached.review(input(4));
    expect(calls[1]?.items.map((i) => i.key)).toEqual(['k3']);
    expect(second.findings.map((f) => f.key).sort()).toEqual(['k0', 'k1', 'k2', 'k3']);
    expect(second.stats?.cached).toBe(3);

    const third = await cached.review(input(4));
    expect(calls).toHaveLength(2);
    expect(third.stats).toEqual({ cached: 4, requests: 0 });
  });

  it('caches empty results too', async () => {
    const { provider, calls } = recordingProvider(() => []);
    const cached = withCache(provider, createMemoryCache());
    await cached.review(input(2));
    await cached.review(input(2));
    expect(calls).toHaveLength(1);
  });

  it('changes the key when anything relevant changes', () => {
    const base = input(1);
    const item = base.items[0]!;
    const key = cacheKeyFor(base, item, { providerName: 'p' });
    expect(cacheKeyFor(base, item, { providerName: 'p' })).toBe(key);
    expect(cacheKeyFor(base, item, { providerName: 'other' })).not.toBe(key);
    expect(cacheKeyFor(base, item, { providerName: 'p', model: 'm' })).not.toBe(key);
    expect(cacheKeyFor(base, item, { providerName: 'p', version: 2 })).not.toBe(key);
    expect(cacheKeyFor({ ...base, context: 'Finance app' }, item, { providerName: 'p' })).not.toBe(
      key,
    );
    expect(cacheKeyFor({ ...base, targetLocale: 'de' }, item, { providerName: 'p' })).not.toBe(key);
    expect(cacheKeyFor(base, { ...item, target: 'Otro' }, { providerName: 'p' })).not.toBe(key);
    const glossary = [
      {
        term: 'Save',
        translations: { es: 'Guardar' },
        doNotTranslate: false,
        caseSensitive: false,
      },
    ];
    expect(cacheKeyFor({ ...base, glossary }, item, { providerName: 'p' })).not.toBe(key);
    // Glossary entries for other locales do not affect the key.
    const irrelevant = [
      {
        term: 'Save',
        translations: { de: 'Speichern' },
        doNotTranslate: false,
        caseSensitive: false,
      },
    ];
    expect(cacheKeyFor({ ...base, glossary: irrelevant }, item, { providerName: 'p' })).toBe(key);
  });

  it('persists to disk and tolerates a missing directory', async () => {
    const dir = path.join(await mkdtemp(path.join(tmpdir(), 'lg-cache-')), 'nested');
    const cache = createFileCache(dir);
    expect(await cache.get('abc')).toBeUndefined();
    await cache.set('abc', [finding('k')]);
    expect(await cache.get('abc')).toEqual([finding('k')]);
  });
});

describe('prompt', () => {
  it('includes context and only the relevant glossary entries', () => {
    const prompt = buildSystemPrompt(
      input(1, {
        context: 'A banking dashboard.',
        glossary: [
          {
            term: 'Withdrawal',
            translations: { es: 'Retiro' },
            doNotTranslate: false,
            caseSensitive: false,
            description: 'Money out',
          },
          { term: 'API', translations: {}, doNotTranslate: true, caseSensitive: true },
          {
            term: 'Deposit',
            translations: { de: 'Einzahlung' },
            doNotTranslate: false,
            caseSensitive: false,
          },
        ],
      }),
    );
    expect(prompt).toContain('A banking dashboard.');
    expect(prompt).toContain('"Withdrawal" must be translated as "Retiro" — Money out');
    expect(prompt).toContain('"API" must stay untranslated');
    expect(prompt).not.toContain('Deposit');
    expect(prompt).toContain('Spanish');
  });

  it('lists every item with its key in the user message', () => {
    const message = buildUserMessage(input(2));
    expect(message).toContain('key: k0');
    expect(message).toContain('en: "Source 1"');
    expect(message).toContain('es: "Destino 1"');
  });
});

describe('schema', () => {
  it('parses loose JSON responses and drops invalid ones', () => {
    expect(
      parseReviewJson(
        'Here you go: {"findings":[{"key":"a","type":"tone","message":"m","explanation":"e","suggestion":null,"confidence":0.8}]} thanks',
      ),
    ).toEqual([{ key: 'a', type: 'tone', message: 'm', explanation: 'e', confidence: 0.8 }]);
    expect(parseReviewJson('{"findings":[{"key":"a","type":"nonsense"}]}')).toEqual([]);
    expect(parseReviewJson('no json here')).toEqual([]);
  });
});

describe('anthropic provider', () => {
  it('maps structured output to findings and reports usage', async () => {
    const parse = vi.fn().mockResolvedValue({
      parsed_output: {
        findings: [
          {
            key: 'k0',
            type: 'grammar',
            message: 'Agreement',
            explanation: 'Because',
            suggestion: 'Destino',
            confidence: 0.85,
          },
        ],
      },
      usage: { input_tokens: 120, output_tokens: 40 },
    });
    const provider = createAnthropicProvider({
      apiKey: 'test',
      model: 'claude-opus-5',
      client: { messages: { parse } } as never,
    });
    const result = await provider.review(input(1, { context: 'ctx' }));
    expect(result.findings).toEqual([
      {
        key: 'k0',
        type: 'grammar',
        message: 'Agreement',
        explanation: 'Because',
        suggestion: 'Destino',
        confidence: 0.85,
      },
    ]);
    expect(result.stats).toEqual({ requests: 1, inputTokens: 120, outputTokens: 40 });
    const request = parse.mock.calls[0]?.[0] as {
      model: string;
      system: string;
      output_config: unknown;
    };
    expect(request.model).toBe('claude-opus-5');
    expect(request.system).toContain('ctx');
    expect(request.output_config).toBeDefined();
  });

  it('returns no findings when parsing failed and skips empty batches', async () => {
    const parse = vi
      .fn()
      .mockResolvedValue({ parsed_output: null, usage: { input_tokens: 1, output_tokens: 1 } });
    const provider = createAnthropicProvider({
      apiKey: 'test',
      client: { messages: { parse } } as never,
    });
    expect((await provider.review(input(1))).findings).toEqual([]);
    expect((await provider.review(input(0))).findings).toEqual([]);
    expect(parse).toHaveBeenCalledTimes(1);
  });
});

describe('factory', () => {
  it('requires an API key without leaking it', () => {
    expect(() => createReviewerFromConfig({ ai: aiConfig(), env: {}, cwd: '/tmp' })).toThrow(
      AIProviderError,
    );
    expect(() => createReviewerFromConfig({ ai: aiConfig(), env: {}, cwd: '/tmp' })).toThrow(
      /ANTHROPIC_API_KEY is not set/,
    );
  });

  it('rejects unknown providers and accepts registered ones', () => {
    expect(() =>
      createReviewerFromConfig({ ai: aiConfig({ provider: 'nope' }), env: {}, cwd: '/tmp' }),
    ).toThrow(/Unknown AI provider "nope"/);
    registerAIProvider('custom', () => recordingProvider().provider);
    const reviewer = createReviewerFromConfig({
      ai: aiConfig({ provider: 'custom', cache: false }),
      env: {},
      cwd: '/tmp',
    });
    expect(reviewer.name).toBe('mock');
  });

  it('builds an anthropic reviewer when a key is present', () => {
    const reviewer = createReviewerFromConfig({
      ai: aiConfig({ cache: false }),
      env: { ANTHROPIC_API_KEY: 'sk-test' },
      cwd: '/tmp',
    });
    expect(reviewer.name).toBe('anthropic');
  });
});

function aiConfig(overrides: Partial<Parameters<typeof createReviewerFromConfig>[0]['ai']> = {}) {
  return {
    enabled: true,
    provider: 'anthropic',
    batchSize: 25,
    cache: true,
    minConfidence: 0.5,
    infoBelowConfidence: 0.75,
    ...overrides,
  };
}
