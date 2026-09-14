# Security Policy

## Supported versions

Only the latest published minor version of `lingolint` receives security fixes.

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Use GitHub's private vulnerability reporting on this repository ("Security" tab → "Report a vulnerability"). You should receive an acknowledgement within a few days. Once a fix is available we will publish a patch release and a security advisory crediting you, unless you prefer to stay anonymous.

## What LingoLint does with your data

LingoLint is designed so that translation files, which often contain unreleased product text, stay on your machine:

- **Deterministic checks run entirely locally.** No network access is made for missing keys, placeholders, HTML tags, whitespace, length, identical-to-source, duplicates or glossary checks.
- **AI review is opt-in.** Only when you pass `--ai` (or set `ai.enabled: true`) is translation text sent to the AI provider you configured, using **your own API key**. The CLI prints a notice each time this happens. Deterministic findings are never sent; only strings selected for linguistic review are.
- **API keys are read from environment variables** and passed directly to the provider SDK. They are never logged, written to reports, or stored in the cache.
- **The AI cache** stores provider responses (findings) keyed by a hash. It lives under `node_modules/.cache/lingolint` or `.lingolint/cache`; both are safe to delete at any time. Disable it with `ai.cache: false` or `LINGOLINT_AI_CACHE=0`.
- **Locale files are parsed, never executed.** JSON is parsed with `JSON.parse`; HTML-like tags are tokenized with a regular expression and never rendered or evaluated. Configuration files (`lingolint.config.ts`) _are_ executed, as with any JavaScript tooling, so only run LingoLint in repositories you trust.
- **Reports may contain translation text.** `--format json` output includes source and translated strings for each issue so that integrations can display them. Treat report artifacts with the same care as the locale files themselves.

## Scope

The following are considered in scope for security reports:

- Path traversal or reading files outside the locales directory
- Code execution triggered by locale file _contents_ (not by config files)
- Leaking API keys or translation text anywhere other than the configured AI provider
- Denial of service through pathological locale files (e.g. catastrophic regular-expression backtracking)
