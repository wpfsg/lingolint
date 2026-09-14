import {
  analyzeTranslationsSync,
  applyFlatValues,
  jsonParser,
  removeFlatKeys,
  type LingoLintConfig,
  type LocaleReport,
  type NestedTranslations,
} from '@lingolint/core';
import type { LoadedLocale } from './files.js';

/**
 * Everything the user has done to one target locale in the review UI.
 * Kept as plain data so it is trivial to test and to persist later.
 */
export interface ReviewState {
  /** key → edited translation */
  edits: Record<string, string>;
  /** keys the user chose to delete (typically obsolete keys) */
  removals: string[];
  /** issue ids the user dismissed */
  ignored: string[];
}

export const emptyReviewState: ReviewState = { edits: {}, removals: [], ignored: [] };

/** Nested target data with the user's edits and removals applied. */
export function applyReview(target: NestedTranslations, state: ReviewState): NestedTranslations {
  const edited = applyFlatValues(target, state.edits);
  return state.removals.length > 0 ? removeFlatKeys(edited, state.removals) : edited;
}

/** Re-run the engine on the edited target so the issue list reflects fixes immediately. */
export function analyzeWithReview(
  source: LoadedLocale,
  target: LoadedLocale,
  state: ReviewState,
  config?: LingoLintConfig,
): LocaleReport {
  return analyzeTranslationsSync({
    sourceLocale: source.locale,
    targetLocale: target.locale,
    source: source.data,
    target: applyReview(target.data, state),
    config,
  });
}

/** Serialized JSON ready to download, using the same writer as the CLI. */
export function exportTarget(target: LoadedLocale, state: ReviewState): string {
  return jsonParser.serialize?.(applyReview(target.data, state)) ?? '';
}

export function setEdit(state: ReviewState, key: string, value: string): ReviewState {
  return { ...state, edits: { ...state.edits, [key]: value } };
}

export function clearEdit(state: ReviewState, key: string): ReviewState {
  const edits = { ...state.edits };
  Reflect.deleteProperty(edits, key);
  return { ...state, edits };
}

export function toggleIgnored(state: ReviewState, issueId: string): ReviewState {
  const ignored = state.ignored.includes(issueId)
    ? state.ignored.filter((id) => id !== issueId)
    : [...state.ignored, issueId];
  return { ...state, ignored };
}

export function removeKey(state: ReviewState, key: string): ReviewState {
  return state.removals.includes(key) ? state : { ...state, removals: [...state.removals, key] };
}

export function restoreKey(state: ReviewState, key: string): ReviewState {
  return { ...state, removals: state.removals.filter((k) => k !== key) };
}

export function changeCount(state: ReviewState): number {
  return Object.keys(state.edits).length + state.removals.length;
}
