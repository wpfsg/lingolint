import { useState } from 'react';
import type { TranslationIssue } from '@lingolint/core';
import { TYPE_LABELS } from '../lib/filters.js';

interface IssueRowProps {
  issue: TranslationIssue;
  targetLocaleName: string;
  /** The translation as it currently stands (edit applied if any). */
  currentValue: string | undefined;
  edited: boolean;
  ignored: boolean;
  onEdit: (issue: TranslationIssue, value: string) => void;
  onRevert: (issue: TranslationIssue) => void;
  onIgnore: (issue: TranslationIssue) => void;
  onAcceptSuggestion: (issue: TranslationIssue) => void;
  onCopySource: (issue: TranslationIssue) => void;
  onRemoveKey: (issue: TranslationIssue) => void;
}

/** Make whitespace problems visible: leading/trailing spaces, tabs, line breaks. */
function visualize(text: string): string {
  return text
    .replace(/^\s+|\s+$/g, (ws) => ws.replace(/ /g, '␣').replace(/\t/g, '⇥').replace(/\n/g, '⏎'))
    .replace(/ {2,}/g, (spaces) => '␣'.repeat(spaces.length))
    .replace(/\t/g, '⇥')
    .replace(/\n/g, '⏎\n');
}

export function IssueRow({
  issue,
  targetLocaleName,
  currentValue,
  edited,
  ignored,
  onEdit,
  onRevert,
  onIgnore,
  onAcceptSuggestion,
  onCopySource,
  onRemoveKey,
}: IssueRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentValue ?? '');
  const [showExplanation, setShowExplanation] = useState(false);

  const startEdit = () => {
    setDraft(currentValue ?? '');
    setEditing(true);
  };
  const commit = () => {
    onEdit(issue, draft);
    setEditing(false);
  };

  const canEdit = issue.type !== 'extra_key';
  const showTranslation = issue.type !== 'missing_key';

  return (
    <article className={`issue issue-${issue.severity}${ignored ? ' is-ignored' : ''}`}>
      <header className="issue-head">
        <span className={`sev sev-${issue.severity}`}>{issue.severity}</span>
        <span className="type">{TYPE_LABELS[issue.type]}</span>
        {issue.origin === 'ai' ? <span className="type type-ai">AI</span> : null}
        <code className="key">{issue.key}</code>
        {issue.confidence !== undefined && issue.confidence < 1 ? (
          <span className="confidence" title="Confidence">
            {Math.round(issue.confidence * 100)}%
          </span>
        ) : null}
        {edited ? <span className="pill pill-edited">edited</span> : null}
        {ignored ? <span className="pill">dismissed</span> : null}
      </header>

      <p className="message">{issue.message}</p>

      <div className="texts">
        {issue.sourceText !== undefined ? (
          <div className="text-row">
            <span className="text-label">Source</span>
            <span className="text-value">{visualize(issue.sourceText)}</span>
          </div>
        ) : null}
        {showTranslation ? (
          <div className="text-row">
            <span className="text-label">{targetLocaleName}</span>
            {editing ? (
              <textarea
                className="editor"
                value={draft}
                autoFocus
                rows={Math.min(6, Math.max(1, draft.split('\n').length))}
                onChange={(event) => {
                  setDraft(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    commit();
                  } else if (event.key === 'Escape') {
                    setEditing(false);
                  }
                }}
              />
            ) : (
              <span className={`text-value${currentValue === '' ? ' is-empty' : ''}`}>
                {currentValue === undefined || currentValue === ''
                  ? '(empty)'
                  : visualize(currentValue)}
              </span>
            )}
          </div>
        ) : null}
        {issue.suggestion !== undefined && !editing ? (
          <div className="text-row">
            <span className="text-label">Suggestion</span>
            <span className="text-value text-suggestion">{visualize(issue.suggestion)}</span>
          </div>
        ) : null}
        {issue.relatedKeys && issue.relatedKeys.length > 0 ? (
          <div className="text-row">
            <span className="text-label">Also</span>
            <span className="text-value mono">{issue.relatedKeys.join(', ')}</span>
          </div>
        ) : null}
      </div>

      {showExplanation && issue.explanation ? (
        <pre className="explanation">{issue.explanation}</pre>
      ) : null}

      <footer className="issue-actions">
        {editing ? (
          <>
            <button type="button" className="btn btn-primary btn-sm" onClick={commit}>
              Save
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setEditing(false);
              }}
            >
              Cancel
            </button>
            <span className="muted">⌘/Ctrl+Enter to save · Esc to cancel</span>
          </>
        ) : (
          <>
            {canEdit ? (
              <button type="button" className="btn btn-sm" onClick={startEdit}>
                {issue.type === 'missing_key' ? 'Add translation' : 'Edit'}
              </button>
            ) : null}
            {issue.suggestion !== undefined && !edited ? (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  onAcceptSuggestion(issue);
                }}
              >
                Accept suggestion
              </button>
            ) : null}
            {issue.type === 'missing_key' && !edited ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  onCopySource(issue);
                }}
                title="Insert the source text as a placeholder translation"
              >
                Copy source
              </button>
            ) : null}
            {issue.type === 'extra_key' ? (
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={() => {
                  onRemoveKey(issue);
                }}
              >
                Remove key
              </button>
            ) : null}
            {edited ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  onRevert(issue);
                }}
              >
                Revert
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                onIgnore(issue);
              }}
            >
              {ignored ? 'Restore' : 'Ignore'}
            </button>
            {issue.explanation ? (
              <button
                type="button"
                className="link"
                onClick={() => {
                  setShowExplanation((value) => !value);
                }}
              >
                {showExplanation ? 'Hide details' : 'Why?'}
              </button>
            ) : null}
          </>
        )}
      </footer>
    </article>
  );
}
