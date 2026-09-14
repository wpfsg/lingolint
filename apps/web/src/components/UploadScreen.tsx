import { useRef, useState, type DragEvent } from 'react';
import { localeDisplayName } from '@lingolint/core';
import type { LoadedLocale } from '../lib/files.js';

interface UploadScreenProps {
  locales: LoadedLocale[];
  sourceLocale: string | undefined;
  errors: string[];
  onAddFiles: (files: FileList | File[]) => void;
  onSelectSource: (locale: string) => void;
  onRemoveLocale: (locale: string) => void;
  onLoadExample: () => void;
}

export function UploadScreen({
  locales,
  sourceLocale,
  errors,
  onAddFiles,
  onSelectSource,
  onRemoveLocale,
  onLoadExample,
}: UploadScreenProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length > 0) {
      onAddFiles(event.dataTransfer.files);
    }
  };

  const needsMore = locales.length < 2;

  return (
    <main className="upload">
      <section className="upload-intro">
        <h1>Review translations before they ship</h1>
        <p>
          Drop your locale JSON files (for example <code>en.json</code>, <code>es.json</code>,{' '}
          <code>de.json</code>). LingoLint compares every file against the source locale and lists
          missing keys, broken placeholders, HTML mismatches, untranslated strings and more. Edit,
          dismiss, and export the corrected file. Everything runs in this tab.
        </p>
      </section>

      <div
        className={`dropzone${dragging ? ' is-dragging' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => {
          setDragging(false);
        }}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <input
          ref={inputRef}
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
        <div className="dropzone-title">Drop locale files here</div>
        <div className="dropzone-hint">or click to choose · .json · one file per locale</div>
      </div>

      {errors.length > 0 ? (
        <div className="alert alert-error" role="alert">
          {errors.map((error) => (
            <pre key={error}>{error}</pre>
          ))}
        </div>
      ) : null}

      {locales.length > 0 ? (
        <section className="loaded">
          <div className="loaded-header">
            <h2>Loaded files</h2>
            <label className="field-inline">
              Source locale
              <select
                value={sourceLocale ?? ''}
                onChange={(event) => {
                  onSelectSource(event.target.value);
                }}
              >
                {locales.map((l) => (
                  <option key={l.locale} value={l.locale}>
                    {l.locale} — {localeDisplayName(l.locale)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>File</th>
                <th>Locale</th>
                <th className="num">Keys</th>
                <th>Role</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {locales.map((l) => (
                <tr key={l.locale}>
                  <td className="mono">{l.fileName}</td>
                  <td>{localeDisplayName(l.locale)}</td>
                  <td className="num">{Object.keys(l.flat).length}</td>
                  <td>
                    {l.locale === sourceLocale ? (
                      <span className="pill pill-source">source</span>
                    ) : (
                      <span className="pill">target</span>
                    )}
                  </td>
                  <td className="actions-cell">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        onRemoveLocale(l.locale);
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {needsMore ? (
            <p className="muted">Add at least one target locale file to start the review.</p>
          ) : null}
        </section>
      ) : null}

      <div className="upload-footer">
        <button type="button" className="btn" onClick={onLoadExample}>
          Try the example project
        </button>
        <span className="muted">
          Prefer the terminal? <code>npx lingolint scan ./locales --source en</code>
        </span>
      </div>
    </main>
  );
}
