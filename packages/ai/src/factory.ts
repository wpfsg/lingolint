import { existsSync } from 'node:fs';
import path from 'node:path';
import type { AIConfig, TranslationAIProvider } from '@lingolint/core';
import { withBatching } from './batching.js';
import { createFileCache, withCache } from './cache.js';
import { AIProviderError } from './errors.js';
import { ANTHROPIC_DEFAULT_MODEL, createAnthropicProvider } from './providers/anthropic.js';

export interface ProviderFactoryContext {
  ai: AIConfig;
  env: Readonly<Record<string, string | undefined>>;
}

export type ProviderFactory = (context: ProviderFactoryContext) => TranslationAIProvider;

const factories = new Map<string, ProviderFactory>();

/** Register a provider adapter under a name usable as `ai.provider` in the config. */
export function registerAIProvider(name: string, factory: ProviderFactory): void {
  factories.set(name, factory);
}

export function availableAIProviders(): string[] {
  return Array.from(factories.keys()).sort();
}

registerAIProvider('anthropic', ({ ai, env }) => {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AIProviderError(
      'AI review is enabled but ANTHROPIC_API_KEY is not set.',
      'Export your own key (export ANTHROPIC_API_KEY=...) or run without --ai. Deterministic checks never need a key.',
    );
  }
  return createAnthropicProvider({
    apiKey,
    model: ai.model ?? env.LINGOLINT_AI_MODEL ?? ANTHROPIC_DEFAULT_MODEL,
  });
});

/** `node_modules/.cache/lingolint` when a `node_modules` folder exists, else `.lingolint/cache`. */
export function defaultCacheDir(cwd: string): string {
  const nodeModules = path.join(cwd, 'node_modules');
  return existsSync(nodeModules)
    ? path.join(nodeModules, '.cache', 'lingolint')
    : path.join(cwd, '.lingolint', 'cache');
}

export interface CreateReviewerOptions {
  ai: AIConfig;
  env: Readonly<Record<string, string | undefined>>;
  cwd: string;
  /** Override the cache location; ignored when `ai.cache` is false. */
  cacheDir?: string | undefined;
}

/**
 * Build the fully wrapped reviewer used by the CLI:
 * cache → batching → vendor adapter.
 */
export function createReviewerFromConfig(options: CreateReviewerOptions): TranslationAIProvider {
  const factory = factories.get(options.ai.provider);
  if (!factory) {
    throw new AIProviderError(
      `Unknown AI provider "${options.ai.provider}".`,
      `Available providers: ${availableAIProviders().join(', ')}.`,
    );
  }
  let provider = factory({ ai: options.ai, env: options.env });
  provider = withBatching(provider, { batchSize: options.ai.batchSize });
  const cacheEnabled = options.ai.cache && options.env.LINGOLINT_AI_CACHE !== '0';
  if (cacheEnabled) {
    const directory = options.cacheDir ?? defaultCacheDir(options.cwd);
    provider = withCache(provider, createFileCache(directory), { model: options.ai.model });
  }
  return provider;
}
