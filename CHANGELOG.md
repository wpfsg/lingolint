# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `lingolint scan` command with pretty and JSON output, configurable failure threshold and CI-friendly exit codes.
- Deterministic QA rules: `missingKey`, `extraKey`, `emptyTranslation`, `placeholders`, `htmlTags`, `whitespace`, `identicalToSource`, `length`, `duplicateTranslation`, `glossary`.
- Placeholder detection for `{name}`, `{{name}}`, `${name}`, `%{name}`, `%name%`, `%s`/`%d`/`%1$s` and `{0}` syntaxes, including renamed-placeholder detection.
- Nested JSON support with lossless write-back (`applyFlatValues`).
- Transparent, configurable 0–100 health score per locale (see `docs/scoring.md`).
- Configuration via `lingolint.config.{ts,js,mjs,cjs,json}` with ESLint-style rule settings, `ignoreKeys`, glossary and project context.
- Optional AI linguistic review (`--ai`) through a provider abstraction with an Anthropic adapter, batching and an on-disk response cache. Bring your own API key.
- `@lingolint/core` package exposing the engine for programmatic use in Node and the browser.
- Local web interface (`apps/web`) for uploading locale files, reviewing issues and exporting corrected JSON, built on the same engine.
- Example project under `examples/basic` with deliberate translation problems.
