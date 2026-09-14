import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { TranslationAIProvider, TranslationReviewResult } from '@lingolint/core';
import { AIProviderError } from '../errors.js';
import { buildSystemPrompt, buildUserMessage } from '../prompt.js';
import { reviewResponseSchema, toFindings } from '../schema.js';

export const ANTHROPIC_DEFAULT_MODEL = 'claude-opus-5';

export interface AnthropicProviderOptions {
  /** Defaults to the ANTHROPIC_API_KEY environment variable via the SDK. */
  apiKey?: string | undefined;
  model?: string | undefined;
  /** Injected for tests. */
  client?: Anthropic | undefined;
  maxTokens?: number | undefined;
}

/**
 * Anthropic adapter. Uses structured outputs so the response is guaranteed to
 * match {@link reviewResponseSchema}; malformed output yields no findings
 * rather than a crash.
 */
export function createAnthropicProvider(
  options: AnthropicProviderOptions = {},
): TranslationAIProvider {
  const model = options.model ?? ANTHROPIC_DEFAULT_MODEL;
  const client =
    options.client ?? new Anthropic(options.apiKey !== undefined ? { apiKey: options.apiKey } : {});

  return {
    name: 'anthropic',
    async review(input, reviewOptions): Promise<TranslationReviewResult> {
      if (input.items.length === 0) {
        return { findings: [] };
      }
      try {
        const response = await client.messages.parse(
          {
            model,
            max_tokens: options.maxTokens ?? 16000,
            system: buildSystemPrompt(input),
            messages: [{ role: 'user', content: buildUserMessage(input) }],
            output_config: { format: zodOutputFormat(reviewResponseSchema) },
          },
          reviewOptions?.signal ? { signal: reviewOptions.signal } : undefined,
        );
        const findings = response.parsed_output ? toFindings(response.parsed_output) : [];
        return {
          findings,
          stats: {
            requests: 1,
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          },
        };
      } catch (error) {
        throw translateError(error);
      }
    },
  };
}

function translateError(error: unknown): Error {
  if (error instanceof Anthropic.AuthenticationError) {
    return new AIProviderError(
      'Anthropic rejected the API key.',
      'Check ANTHROPIC_API_KEY. Keys are never logged or stored by LingoLint.',
    );
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AIProviderError(
      'Anthropic rate limit reached.',
      'Retry later or lower ai.batchSize / set ai.maxItems in the config.',
    );
  }
  if (error instanceof Anthropic.APIError) {
    return new AIProviderError(
      `Anthropic API error (${error.status ?? 'unknown'}): ${error.message}`,
    );
  }
  return error instanceof Error ? error : new Error(String(error));
}
