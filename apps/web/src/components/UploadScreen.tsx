import { useRef, useState, type DragEvent } from 'react';
import { localeDisplayName } from '@lingolint/core';
import type { LoadedLocale } from '../lib/files.js';
import { Logo } from './Logo.js';

interface UploadScreenProps {
  locales: LoadedLocale[];
  sourceLocale: string | undefined;
  errors: string[];
  onAddFiles: (files: FileList | File[]) => void;
  onSelectSource: (locale: string) => void;
  onRemoveLocale: (locale: string) => void;
  onLoadExample: () => void;
}

const HIGHLIGHTS: { label: string; tone: string }[] = [
  { label: 'Missing keys', tone: 'error' },
  { label: 'Placeholders', tone: 'warning' },
  { label: 'HTML', tone: 'info' },
  { label: 'Untranslated', tone: 'neutral' },
];

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
      <section className="hero">
        <Logo size="hero" />
        <h1 className="hero-title">Review translations before they ship.</h1>
        <p className="hero-subtitle">Locale JSON diffing, in your browser. Nothing is uploaded.</p>
        <ul className="hero-pills" aria-label="What LingoLint checks">
          {HIGHLIGHTS.map((item) => (
            <li key={item.label} className="hero-pill">
              <span className={`dot dot-${item.tone}`} aria-hidden="true" />
              {item.label}
            </li>
          ))}
        </ul>
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
        <span className="dropzone-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22">
            <path
              d="M12 16V5m0 0l-4 4m4-4l4 4M5 15v2.5A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5V15"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div className="dropzone-title">Drop locale files here</div>
        <div className="dropzone-hint">
          or click to choose · <code>en.json</code>, <code>de.json</code>, one file per locale
        </div>
      </div>

      {errors.length > 0 ? (
        <div className="alert alert-error" role="alert">
          {errors.map((error) => (
            <pre key={error}>{error}</pre>
          ))}
        </div>
      ) : null}

      {locales.length > 0 ? (
        <section className="loaded card">
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
            <p className="muted loaded-note">
              Add at least one target locale file to start the review.
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="upload-footer">
        <button type="button" className="btn btn-secondary" onClick={onLoadExample}>
          Try the example project
        </button>
        <span className="muted">
          Prefer the terminal? <code>npx lingolint scan ./locales --source en</code>
        </span>
      </div>
    </main>
  );
}
