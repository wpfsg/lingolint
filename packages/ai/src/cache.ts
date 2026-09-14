import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  AIFinding,
  TranslationAIProvider,
  TranslationReviewInput,
  TranslationReviewItem,
} from '@lingolint/core';
import { AI_REVIEW_VERSION } from './prompt.js';

/** Storage for per-string review results. Implementations must never throw on miss. */
export interface AICache {
  get(key: string): Promise<AIFinding[] | undefined>;
  set(key: string, findings: AIFinding[]): Promise<void>;
}

export function createMemoryCache(): AICache & { size(): number } {
  const store = new Map<string, AIFinding[]>();
  return {
    get: (key) => Promise.resolve(store.get(key)),
    set: (key, findings) => {
      store.set(key, findings);
      return Promise.resolve();
    },
    size: () => store.size,
  };
}

/** One JSON file per cache key. Corrupt or unreadable entries count as misses. */
export function createFileCache(directory: string): AICache {
  const fileFor = (key: string): string => path.join(directory, `${key}.json`);
  return {
    async get(key) {
      try {
        const text = await readFile(fileFor(key), 'utf8');
        const parsed = JSON.parse(text) as { findings?: AIFinding[] };
        return Array.isArray(parsed.findings) ? parsed.findings : undefined;
      } catch {
        return undefined;
      }
    },
    async set(key, findings) {
      try {
        await mkdir(directory, { recursive: true });
        await writeFile(fileFor(key), JSON.stringify({ findings }), 'utf8');
      } catch {
        // A failed cache write must never fail the scan.
      }
    },
  };
}

export interface CacheKeyOptions {
  providerName: string;
  model?: string | undefined;
  version?: number | undefined;
}

/**
 * Cache key for one string pair. Anything that could change the verdict is
 * included: text, locales, project context, the relevant glossary entries,
 * the provider/model and the prompt version.
 */
export function cacheKeyFor(
  input: Omit<TranslationReviewInput, 'items'>,
  item: TranslationReviewItem,
  options: CacheKeyOptions,
): string {
  const glossary = input.glossary
    .filter((entry) => entry.doNotTranslate || entry.translations[input.targetLocale] !== undefined)
    .map((entry) => [
      entry.term,
      entry.doNotTranslate,
      entry.translations[input.targetLocale] ?? null,
      entry.description ?? null,
    ]);
  const material = JSON.stringify([
    options.version ?? AI_REVIEW_VERSION,
    options.providerName,
    options.model ?? null,
    input.sourceLocale,
    input.targetLocale,
    input.context ?? null,
    glossary,
    item.source,
    item.target,
  ]);
  return createHash('sha256').update(material).digest('hex');
}

/**
 * Answer previously reviewed strings from the cache and only send the rest to
 * the underlying provider. Findings are cached per string, so editing one
 * translation re-reviews only that string.
 */
export function withCache(
  provider: TranslationAIProvider,
  cache: AICache,
  options: Omit<CacheKeyOptions, 'providerName'> = {},
): TranslationAIProvider {
  const keyOptions: CacheKeyOptions = { ...options, providerName: provider.name };
  return {
    name: provider.name,
    async review(input, reviewOptions) {
      const { items, ...rest } = input;
      const keys = items.map((item) => cacheKeyFor(rest, item, keyOptions));
      const cached = await Promise.all(keys.map((key) => cache.get(key)));

      const findings: AIFinding[] = [];
      const pending: TranslationReviewItem[] = [];
      const pendingKeys: string[] = [];
      let cachedCount = 0;
      items.forEach((item, index) => {
        const hit = cached[index];
        if (hit) {
          cachedCount++;
          findings.push(...hit);
        } else {
          pending.push(item);
          pendingKeys.push(keys[index] ?? '');
        }
      });

      if (pending.length === 0) {
        return { findings, stats: { cached: cachedCount, requests: 0 } };
      }

      const fresh = await provider.review({ ...rest, items: pending }, reviewOptions);
      const byKey = new Map<string, AIFinding[]>();
      for (const item of pending) {
        byKey.set(item.key, []);
      }
      for (const finding of fresh.findings) {
        byKey.get(finding.key)?.push(finding);
      }
      await Promise.all(
        pending.map((item, index) =>
          cache.set(pendingKeys[index] ?? '', byKey.get(item.key) ?? []),
        ),
      );

      return {
        findings: [...findings, ...fresh.findings],
        stats: { ...fresh.stats, cached: cachedCount + (fresh.stats?.cached ?? 0) },
      };
    },
  };
}
