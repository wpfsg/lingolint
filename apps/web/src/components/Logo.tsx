interface LogoProps {
  /** `hero` is the large lock-up on the landing screen; `compact` sits in the top bar. */
  size?: 'hero' | 'compact';
}

/** The LingoLint app icon: a speech bubble with a red spell-check squiggle on a blue tile. */
export function AppIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      role="img"
      aria-label="LingoLint"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="ll-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7d95ff" />
          <stop offset="1" stopColor="#3f5fe6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#ll-tile)" />
      <path
        d="M20 15h24a7 7 0 0 1 7 7v14a7 7 0 0 1-7 7H26l-7.5 6.2c-1.1.9-2.5.1-2.5-1.2V22a7 7 0 0 1 4-7z"
        fill="#ffffff"
      />
      <rect x="21" y="22" width="22" height="4" rx="2" fill="#a9bdff" />
      <rect x="21" y="30" width="14" height="4" rx="2" fill="#3f5fe6" />
      <path
        d="M21 38.5c1.6-1.8 3.2-1.8 4.8 0s3.2 1.8 4.8 0 3.2-1.8 4.8 0"
        fill="none"
        stroke="#f0625f"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A short red wave, drawn under the word "Lint". */
function Squiggle() {
  return (
    <svg className="squiggle" viewBox="0 0 80 8" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M1 5c5-5 10-5 15 0s10 5 15 0 10-5 15 0 10 5 15 0 10-5 15 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ size = 'compact' }: LogoProps) {
  return (
    <span className={`logo logo-${size}`}>
      <AppIcon className="logo-icon" />
      <span className="wordmark" aria-label="LingoLint">
        <span className="wordmark-lingo" aria-hidden="true">
          Lingo
        </span>
        <span className="wordmark-lint" aria-hidden="true">
          Lint
          <Squiggle />
        </span>
      </span>
    </span>
  );
}
