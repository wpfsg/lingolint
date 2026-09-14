export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'lingolint-theme';

export function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(theme: Theme): void {
  if (theme === 'system') {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
  try {
    if (theme === 'system') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, theme);
    }
  } catch {
    // Storage may be unavailable; the theme still applies for this session.
  }
}

export function nextTheme(theme: Theme): Theme {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const effective = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
  return effective === 'dark' ? 'light' : 'dark';
}
