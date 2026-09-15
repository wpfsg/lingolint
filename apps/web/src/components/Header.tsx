import type { Theme } from '../lib/theme.js';
import { Logo } from './Logo.js';

interface HeaderProps {
  theme: Theme;
  onToggleTheme: () => void;
  onReset: (() => void) | undefined;
}

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === 'dark') {
    return (
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
        <path
          d="M12.5 2.5a7.5 7.5 0 1 0 5 13.1A8 8 0 0 1 12.5 2.5z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (theme === 'light') {
    return (
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
        <circle cx="10" cy="10" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 2.75a7.25 7.25 0 0 1 0 14.5z" fill="currentColor" />
    </svg>
  );
}

export function Header({ theme, onToggleTheme, onReset }: HeaderProps) {
  return (
    <header className="topbar">
      <a className="brand" href="./" aria-label="LingoLint home">
        <Logo size="compact" />
      </a>
      <div className="topbar-actions">
        <span className="privacy-note" title="Files are parsed in this tab and never uploaded.">
          <span className="privacy-dot" aria-hidden="true" />
          Runs in your browser
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
          <ThemeIcon theme={theme} />
        </button>
      </div>
    </header>
  );
}
