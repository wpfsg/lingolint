# Using LingoLint in CI

LingoLint is a plain CLI with meaningful exit codes, so it works in any CI system without a dedicated integration.

| Exit code | Meaning                                                             |
| --------- | ------------------------------------------------------------------- |
| `0`       | Scan completed; no issue at or above the `--fail-on` threshold      |
| `1`       | Scan completed; threshold exceeded                                  |
| `2`       | Scan could not run: bad arguments, invalid config, unreadable files |

Colors are disabled automatically when stdout is not a terminal or `CI` is set, and `NO_COLOR` is honoured.

## GitHub Actions

```yaml
name: Translation QA

on:
  pull_request:
    paths:
      - 'locales/**'
      - 'lingolint.config.*'

jobs:
  translations:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - run: npx lingolint scan ./locales --source en --fail-on error
```

If `lingolint` is a dev dependency, use `npm ci` followed by `npx lingolint scan` so the pinned version runs.

### Keep the report as an artifact

```yaml
- name: Scan translations
  run: npx lingolint scan ./locales --source en --format json --fail-on never > translation-report.json

- uses: actions/upload-artifact@v4
  with:
    name: translation-report
    path: translation-report.json

- name: Gate on errors
  run: npx lingolint scan ./locales --source en --fail-on error
```

### Stricter on the main branch

```yaml
- run: npx lingolint scan ./locales --source en --fail-on ${{ github.ref == 'refs/heads/main' && 'warning' || 'error' }}
```

## GitLab CI

```yaml
translations:
  image: node:22
  script:
    - npx lingolint scan ./locales --source en --fail-on error
  rules:
    - changes:
        - locales/**
```

## Pre-commit hook

With [husky](https://typicode.github.io/husky/) or any hook runner:

```bash
npx lingolint scan --fail-on error
```

Because scans take milliseconds for thousands of keys, running on every commit is practical.

## AI review in CI

Add the API key as a secret and pass `--ai`:

```yaml
- run: npx lingolint scan ./locales --source en --ai
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

Keep in mind that this sends translation text to the provider. Cache the response cache directory between runs to avoid re-reviewing unchanged strings:

```yaml
- uses: actions/cache@v4
  with:
    path: node_modules/.cache/lingolint
    key: lingolint-ai-${{ hashFiles('locales/**') }}
    restore-keys: lingolint-ai-
```

A dedicated GitHub Action with inline pull request annotations is on the roadmap; the CLI is the supported path today.
