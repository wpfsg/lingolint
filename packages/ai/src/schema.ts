import { AI_ISSUE_TYPES, type AIFinding } from '@lingolint/core';
import { z } from 'zod';

/**
 * Shape every provider must produce. Kept deliberately small so it can be
 * expressed as a strict JSON schema for structured-output APIs.
 */
export const findingSchema = z.object({
  key: z.string(),
  type: z.enum(AI_ISSUE_TYPES),
  message: z.string(),
  explanation: z.string(),
  suggestion: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export const reviewResponseSchema = z.object({
  findings: z.array(findingSchema),
});

export type ReviewResponse = z.infer<typeof reviewResponseSchema>;

/** Convert a parsed response into engine findings, dropping anything malformed. */
export function toFindings(response: ReviewResponse): AIFinding[] {
  return response.findings.map((finding) => ({
    key: finding.key,
    type: finding.type,
    message: finding.message.trim(),
    explanation: finding.explanation.trim(),
    ...(finding.suggestion !== null && finding.suggestion.trim() !== ''
      ? { suggestion: finding.suggestion }
      : {}),
    confidence: Math.max(0, Math.min(1, finding.confidence)),
  }));
}

/** Parse untrusted JSON text (e.g. from a provider without structured outputs). */
export function parseReviewJson(text: string): AIFinding[] {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) {
    return [];
  }
  const parsed = reviewResponseSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
  return parsed.success ? toFindings(parsed.data) : [];
}
