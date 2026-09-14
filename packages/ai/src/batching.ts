import type {
  AIFinding,
  TranslationAIProvider,
  TranslationReviewInput,
  TranslationReviewResult,
} from '@lingolint/core';

export interface BatchingOptions {
  /** Items per provider request. */
  batchSize: number;
  /** Requests in flight at once. */
  concurrency?: number | undefined;
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += Math.max(1, size)) {
    chunks.push(items.slice(i, i + Math.max(1, size)));
  }
  return chunks;
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, items.length)) },
    async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await fn(items[index] as T);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

export function mergeResults(results: readonly TranslationReviewResult[]): TranslationReviewResult {
  const findings: AIFinding[] = [];
  const stats = { cached: 0, requests: 0, inputTokens: 0, outputTokens: 0 };
  let hasStats = false;
  for (const result of results) {
    findings.push(...result.findings);
    if (result.stats) {
      hasStats = true;
      stats.cached += result.stats.cached ?? 0;
      stats.requests += result.stats.requests ?? 0;
      stats.inputTokens += result.stats.inputTokens ?? 0;
      stats.outputTokens += result.stats.outputTokens ?? 0;
    }
  }
  return hasStats ? { findings, stats } : { findings };
}

/**
 * Split large reviews into fixed-size batches so a single request stays small
 * enough for the provider to judge carefully, and run batches concurrently.
 */
export function withBatching(
  provider: TranslationAIProvider,
  options: BatchingOptions,
): TranslationAIProvider {
  return {
    name: provider.name,
    async review(input: TranslationReviewInput, reviewOptions) {
      if (input.items.length <= options.batchSize) {
        return provider.review(input, reviewOptions);
      }
      const batches = chunk(input.items, options.batchSize);
      const results = await mapWithConcurrency(batches, options.concurrency ?? 2, (items) =>
        provider.review({ ...input, items }, reviewOptions),
      );
      return mergeResults(results);
    },
  };
}
