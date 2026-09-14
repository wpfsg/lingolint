import { useMemo, useState } from 'react';
import { localeDisplayName, type TranslationIssue } from '@lingolint/core';
import type { LoadedLocale } from '../lib/files.js';
import { downloadText } from '../lib/download.js';
import { countByGroup, defaultFilters, filterIssues, type IssueFilters } from '../lib/filters.js';
import {
  analyzeWithReview,
  changeCount,
  clearEdit,
  exportTarget,
  removeKey,
  restoreKey,
  setEdit,
  toggleIgnored,
  type ReviewState,
} from '../lib/review.js';
import { Filters } from './Filters.js';
import { IssueRow } from './IssueRow.js';
import { Summary } from './Summary.js';

interface ResultsScreenProps {
  source: LoadedLocale;
  target: LoadedLocale;
  targets: string[];
  locales: LoadedLocale[];
  review: ReviewState;
  onReviewChange: (state: ReviewState) => void;
  onSelectTarget: (locale: string) => void;
  onSelectSource: (locale: string) => void;
  onAddFiles: (files: FileList | File[]) => void;
}

export function ResultsScreen({
  source,
  target,
  targets,
  locales,
  review,
  onReviewChange,
  onSelectTarget,
  onSelectSource,
  onAddFiles,
}: ResultsScreenProps) {
  const [filters, setFilters] = useState<IssueFilters>(defaultFilters);

  // The engine is fast enough to re-run on every edit, which keeps the list honest:
  // a fixed placeholder disappears the moment the edit is applied.
  const report = useMemo(() => analyzeWithReview(source, target, review), [source, target, review]);
  const visible = useMemo(
    () => filterIssues(report.issues, filters, review.ignored),
    [report.issues, filters, review.ignored],
  );
  const groupCounts = useMemo(() => countByGroup(report.issues), [report.issues]);
  const ignoredCount = report.issues.filter((i) => review.ignored.includes(i.id)).length;

  const currentValue = (key: string): string | undefined => review.edits[key] ?? target.flat[key];

  const actions = {
    onEdit: (issue: TranslationIssue, value: string) => {
      onReviewChange(setEdit(review, issue.key, value));
    },
    onRevert: (issue: TranslationIssue) => {
      onReviewChange(clearEdit(review, issue.key));
    },
    onIgnore: (issue: TranslationIssue) => {
      onReviewChange(toggleIgnored(review, issue.id));
    },
    onAcceptSuggestion: (issue: TranslationIssue) => {
      if (issue.suggestion !== undefined) {
        onReviewChange(setEdit(review, issue.key, issue.suggestion));
      }
    },
    onCopySource: (issue: TranslationIssue) => {
      onReviewChange(setEdit(review, issue.key, issue.sourceText ?? source.flat[issue.key] ?? ''));
    },
    onRemoveKey: (issue: TranslationIssue) => {
      onReviewChange(removeKey(review, issue.key));
    },
  };

  const pendingChanges = changeCount(review);

  return (
    <main className="results">
      <div className="results-toolbar">
        <div className="locale-tabs" role="tablist" aria-label="Target locales">
          {targets.map((locale) => (
            <button
              key={locale}
              type="button"
              role="tab"
              aria-selected={locale === target.locale}
              className={`tab${locale === target.locale ? ' is-active' : ''}`}
              onClick={() => {
                onSelectTarget(locale);
              }}
            >
              {localeDisplayName(locale)} <span className="tab-code">{locale}</span>
            </button>
          ))}
        </div>
        <div className="toolbar-right">
          <label className="field-inline">
            Source
            <select
              value={source.locale}
              onChange={(event) => {
                onSelectSource(event.target.value);
              }}
            >
              {locales.map((l) => (
                <option key={l.locale} value={l.locale}>
                  {l.locale}
                </option>
              ))}
            </select>
          </label>
          <label className="btn btn-ghost">
            Add files
            <input
              type="file"
              accept=".json,application/json"
              multiple
              hidden
              onChange={(event) => {
                if (event.target.files) {
                  onAddFiles(event.target.files);
                  event.target.value = '';
                }
              }}
            />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              downloadText(target.fileName, exportTarget(target, review));
            }}
            title="Download the target file with your edits applied. Structure and key order are preserved."
          >
            Export {target.fileName}
            {pendingChanges > 0 ? <span className="badge">{pendingChanges}</span> : null}
          </button>
        </div>
      </div>

      <Summary report={report} ignoredCount={ignoredCount} />

      <Filters
        filters={filters}
        onChange={setFilters}
        groupCounts={groupCounts}
        summary={report.summary}
        ignoredCount={ignoredCount}
      />

      {review.removals.length > 0 ? (
        <div className="alert">
          Removed on export:{' '}
          {review.removals.map((key) => (
            <span key={key} className="removed-key">
              <code>{key}</code>
              <button
                type="button"
                className="link"
                onClick={() => {
                  onReviewChange(restoreKey(review, key));
                }}
              >
                undo
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <section className="issues" aria-live="polite">
        {visible.length === 0 ? (
          <div className="empty">
            {report.issues.length === 0
              ? `No issues in ${localeDisplayName(target.locale)}. ${report.keyCount} keys checked.`
              : 'No issues match the current filters.'}
          </div>
        ) : (
          visible.map((issue) => (
            <IssueRow
              key={issue.id}
              issue={issue}
              targetLocaleName={localeDisplayName(target.locale)}
              currentValue={currentValue(issue.key)}
              edited={Object.hasOwn(review.edits, issue.key)}
              ignored={review.ignored.includes(issue.id)}
              {...actions}
            />
          ))
        )}
      </section>
    </main>
  );
}
