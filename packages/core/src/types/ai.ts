import type { GlossaryEntry } from './glossary.js';
import type { AIIssueType } from './issue.js';

/** One string pair to review. */
export interface TranslationReviewItem {
  key: string;
  source: string;
  target: string;
}

export interface TranslationReviewInput {
  sourceLocale: string;
  targetLocale: string;
  items: TranslationReviewItem[];
  /** Free-text project description from the config (`context`). */
  context?: string;
  glossary: readonly GlossaryEntry[];
}

/** A linguistic finding reported by an AI provider. */
export interface AIFinding {
  key: string;
  type: AIIssueType;
  /** Short description of the problem. */
  message: string;
  /** Why this was flagged. Providers must always explain their reasoning. */
  explanation: string;
  /** Proposed corrected translation, if any. */
  suggestion?: string;
  /** 0–1. The engine downgrades or drops low-confidence findings. */
  confidence: number;
}

export interface TranslationReviewResult {
  findings: AIFinding[];
  /** Diagnostics for cost reporting. All optional. */
  stats?: {
    /** Items answered from a cache rather than a live request. */
    cached?: number;
    requests?: number;
    inputTokens?: number;
    outputTokens?: number;
  };
}

/**
 * The only contract an AI backend has to fulfil.
 *
 * Implementations live outside the core package so that the engine never
 * depends on a specific vendor, SDK or network stack.
 */
export interface TranslationAIProvider {
  /** Stable identifier, e.g. `anthropic`. Used in reports and cache keys. */
  readonly name: string;
  review(
    input: TranslationReviewInput,
    options?: { signal?: AbortSignal },
  ): Promise<TranslationReviewResult>;
}
