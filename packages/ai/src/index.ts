/**
 * @lingolint/ai
 *
 * Optional AI linguistic review for LingoLint. Everything here is additive:
 * the core engine and CLI work fully without this package being configured.
 *
 * Using AI review sends translation text to the configured provider.
 */
export { chunk, mergeResults, withBatching, type BatchingOptions } from './batching.js';
export {
  cacheKeyFor,
  createFileCache,
  createMemoryCache,
  withCache,
  type AICache,
  type CacheKeyOptions,
} from './cache.js';
export { AIProviderError } from './errors.js';
export {
  availableAIProviders,
  createReviewerFromConfig,
  defaultCacheDir,
  registerAIProvider,
  type CreateReviewerOptions,
  type ProviderFactory,
  type ProviderFactoryContext,
} from './factory.js';
export { AI_REVIEW_VERSION, buildSystemPrompt, buildUserMessage } from './prompt.js';
export {
  ANTHROPIC_DEFAULT_MODEL,
  createAnthropicProvider,
  type AnthropicProviderOptions,
} from './providers/anthropic.js';
export {
  findingSchema,
  parseReviewJson,
  reviewResponseSchema,
  toFindings,
  type ReviewResponse,
} from './schema.js';
