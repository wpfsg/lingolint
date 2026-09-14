import type { Theme } from '../lib/theme.js';

interface HeaderProps {
  theme: Theme;
  onToggleTheme: () => void;
  onReset: (() => void) | undefined;
}

export function Header({ theme, onToggleTheme, onReset }: HeaderProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          ◆
        </span>
        <span className="brand-name">LingoLint</span>
        <span className="brand-tag">local review</span>
      </div>
      <div className="topbar-actions">
        <span className="privacy-note" title="Files are parsed in this tab and never uploaded.">
          Runs in your browser · nothing is uploaded
        </span>
        {onReset ? (
          <button type="button" className="btn btn-ghost" onClick={onReset}>
            Start over
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={onToggleTheme}
          aria-label="Toggle color theme"
          title={`Theme: ${theme}`}
        >
          {theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◐'}
        </button>
      </div>
    </header>
  );
}
