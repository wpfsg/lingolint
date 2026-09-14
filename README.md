# LingoLint

**Catch translation bugs before your users do.**

ESLint for app translations. LingoLint compares your locale files, finds missing keys, broken placeholders, mismatched HTML, untranslated strings and more, and fails your CI when it matters. No account, no server, no API key required.

```bash
npx lingolint scan ./locales --source en
```

```text
LingoLint v0.1.0

Source:  en
Targets: de, es

German (de) — 91/100
…

Spanish (es) — 72/100

✖ 4 errors
⚠ 4 warnings
ℹ 2 suggestions

✖ ERROR  checkout.total
  Missing placeholder: {currency}
  Source:       "Total: {amount} {currency}"
  Translation:  "Total: {amount}"

✖ ERROR  notes.deleteConfirm
  Tag <strong> is never closed
  Source:       "Delete <strong>{title}</strong>? This cannot be undone."
  Translation:  "¿Eliminar <strong>{title}? Esta acción no se puede deshacer."

⚠ WARNING  profile.connect
  Translation may be significantly longer than the source (3.1×)
  Source:       "Connect"
  Translation:  "Conectar con la cuenta"

ℹ INFO  common.close  confidence 40%
  Same translation used for 2 different source strings
  Source:       "Close"
  Translation:  "Cerrar"
  Also:         common.exit

Overall health: 82/100
✖ 5 errors  ·  ⚠ 6 warnings  ·  ℹ 4 suggestions across 2 locales
Threshold: fail on error — exceeded
```

Exit code `1` when the threshold is exceeded, so the same command works as a CI gate.

---

## What it detects

All of these run locally, deterministically, with no network access:

| Check                  | Example                                                                  | Default severity |
| ---------------------- | ------------------------------------------------------------------------ | ---------------- |
| Missing keys           | `delete` exists in `en.json` but not `es.json`                           | error            |
| Extra / obsolete keys  | `legacyExport` only exists in `es.json`                                  | warning          |
| Empty translations     | `"generic": ""`                                                          | error            |
| Placeholder mismatches | `{currency}` missing, `{name}` renamed to `{nombre}`, `%s` count differs | error            |
| HTML / tag mismatches  | `<strong>` never closed, `<a>` dropped, `<0>` component tags             | error            |
| Suspicious whitespace  | trailing space, double spaces, tabs, stray line breaks                   | warning          |
| Identical to source    | `"Account settings"` left in English (with brand/acronym ignore)         | warning / info   |
| Length outliers        | `Connect` → `Conectar con la cuenta` (potential UI overflow)             | warning          |
| Duplicate translations | `Close` and `Exit` both → `Cerrar`                                       | info             |
| Glossary violations    | `Withdrawal` not translated as the configured `Retiro`                   | warning          |

Optional **AI review** (bring your own key) adds semantic mistranslations, grammar, tone/formality consistency, capitalization and unnatural wording, each with an explanation and a confidence level.

Placeholder syntaxes recognised: `{name}` `{0}` `{count, number}` · `{{name}}` · `${name}` · `%{name}` · `%name%` · `%s` `%d` `%1$s` `%.2f`.

## Installation

```bash
npm install -D lingolint
```

Or run it without installing:

```bash
npx lingolint scan ./locales --source en
```

Requires Node.js 20.19 or newer.

## Quick start

Point LingoLint at a folder with one file per locale:

```text
locales/
  en.json
  es.json
  de.json
```

```bash
npx lingolint scan ./locales --source en
```

Every file other than the source is treated as a target. Nested JSON is supported and flattened to dotted keys (`account.settings.title`) internally.

Try it on the bundled example, which contains one of every problem on purpose:

```bash
git clone https://github.com/wpfsg/lingolint
cd lingolint && npm install && npm run build
node packages/cli/dist/bin.js scan ./examples/basic --source en
```

## Supported formats

| Format                                                 | Status                                                                                          |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| JSON                                                   | ✅ Nested or flat, i18next / ICU / react-intl style                                             |
| YAML, PO, XLIFF, ARB, Android XML, iOS `.strings`, CSV | Planned. The parser interface is ready; see [CONTRIBUTING.md](CONTRIBUTING.md#adding-a-parser). |

## CLI usage

```text
lingolint scan [path] [options]

  -s, --source <locale>     Source locale, e.g. en
  -t, --targets <locales>   Comma-separated target locales (default: every other file)
      --include <patterns>  Comma-separated file patterns (default: *.json)
  -f, --format <format>     pretty (default) or json
      --fail-on <severity>  error (default), warning, info or never
  -c, --config <path>       Config file (default: lingolint.config.{ts,js,mjs,cjs,json})
      --ai / --no-ai        Enable or disable AI review
      --verbose             Show explanations and suggestions
      --max-issues <n>      Issues printed per locale (default 50, 0 = all)
      --color / --no-color  Force or disable colors (NO_COLOR is respected)
```

Exit codes: `0` passed, `1` threshold exceeded, `2` could not run (bad arguments, invalid config, unreadable file).

Errors tell you what to do:

```text
Unable to parse locales/es.json

Invalid JSON near line 3, column 3.

Expected ',' or '}' after property value
  "total": "x"
  ^
```

## Configuration

Create `lingolint.config.ts` (or `.js`, `.mjs`, `.cjs`, `.json`) next to your `package.json`:

```ts
import { defineConfig } from 'lingolint';

export default defineConfig({
  sourceLocale: 'en',
  localesPath: './locales',
  include: ['*.json'],
  failOn: 'error',

  // ESLint-style: severity, or [severity, options]
  rules: {
    missingKey: 'error',
    extraKey: 'warning',
    emptyTranslation: 'error',
    placeholders: 'error',
    htmlTags: 'error',
    whitespace: 'warning',
    identicalToSource: ['warning', { ignore: ['Notely', 'Bitcoin', 'OAuth'] }],
    length: ['warning', { maxRatio: 3, limits: { 'nav.*': 20 } }],
    duplicateTranslation: 'info',
  },

  // Keys (or * patterns) excluded from every per-key check
  ignoreKeys: ['legal.*'],

  glossary: {
    Withdrawal: { es: 'Retiro', de: 'Auszahlung' },
    API: { doNotTranslate: true },
  },

  // Optional, used by AI review to disambiguate terminology
  context: 'A note-taking app. Use concise, friendly UI copy.',
});
```

Then simply run `lingolint scan`. CLI flags always override the config file. See [docs/configuration.md](docs/configuration.md) for every option and [docs/rules.md](docs/rules.md) for each rule's options.

## Use in CI

Copy this into `.github/workflows/translations.yml`:

```yaml
name: Translation QA

on:
  pull_request:

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

Use `--fail-on warning` for a stricter gate, or `--format json` to feed another tool. More in [docs/ci.md](docs/ci.md).

## Machine-readable output

```bash
lingolint scan ./locales --format json
```

```json
{
  "tool": { "name": "LingoLint", "version": "0.1.0" },
  "schemaVersion": 1,
  "sourceLocale": "en",
  "overallScore": 82,
  "summary": { "errors": 5, "warnings": 6, "info": 4, "total": 15 },
  "locales": [
    {
      "targetLocale": "es",
      "targetLocaleName": "Spanish",
      "score": 72,
      "keyCount": 32,
      "summary": { "errors": 4, "warnings": 4, "info": 2, "total": 10 },
      "issues": [
        {
          "id": "1f0c6d8e93a2b4c7",
          "locale": "es",
          "key": "checkout.total",
          "type": "placeholder_mismatch",
          "rule": "placeholders",
          "severity": "error",
          "origin": "deterministic",
          "message": "Missing placeholder: {currency}",
          "sourceText": "Total: {amount} {currency}",
          "translatedText": "Total: {amount}",
          "details": { "missing": ["{currency}"], "unexpected": [] }
        }
      ]
    }
  ],
  "failOn": "error",
  "passed": false
}
```

The schema is documented in [docs/json-output.md](docs/json-output.md) and only ever gains fields.

## Health score

Each locale gets a deterministic 0–100 score. With default weights an error costs 5 points, a warning 2 and a suggestion 0.25, calibrated per 100 keys so one typo in a 5,000-key app is not a catastrophe. Weights are configurable and documented in [docs/scoring.md](docs/scoring.md).

## Optional AI review

Deterministic checks catch structural bugs. For linguistic problems (wrong meaning, grammar, tone, unnatural phrasing) you can opt into AI review with your own API key:

```bash
export ANTHROPIC_API_KEY=...
npx lingolint scan ./locales --source en --ai
```

> **Privacy:** using `--ai` sends translation text to the configured AI provider. Nothing is sent otherwise, and deterministic checks never depend on AI. The CLI prints a notice whenever AI mode is active.

Only strings that pass the technical checks are sent, in batches, and responses are cached so identical strings are never reviewed twice. Findings come with an explanation, a suggested fix and a confidence; low-confidence findings are reported as suggestions rather than errors. Details, cost controls and how to add another provider: [docs/ai-review.md](docs/ai-review.md).

## Programmatic use

The engine is a standalone package with no filesystem or network access, so it runs in Node, CI and the browser:

```ts
import { analyzeTranslations } from '@lingolint/core';

const report = await analyzeTranslations({
  sourceLocale: 'en',
  targetLocale: 'es',
  source: { checkout: { total: 'Total: {amount} {currency}' } },
  target: { checkout: { total: 'Total: {amount}' } },
});

report.score; // 95
report.issues[0].message; // "Missing placeholder: {currency}"
```

## Web interface

Try LingoLint without installing anything: **https://wpfsg.github.io/lingolint/**

Drop your locale files in, review issues, edit translations inline and export corrected JSON. It uses the exact same engine as the CLI and runs entirely in your browser; files are parsed in the tab and never uploaded anywhere.

The UI lives in [`apps/web`](apps/web) and is deployed to GitHub Pages on every push to `main`. To run it locally:

```bash
npm run dev --workspace apps/web
```

## Development

```bash
git clone https://github.com/wpfsg/lingolint
cd lingolint
npm install
npm test          # vitest
npm run lint      # eslint
npm run typecheck # tsc
npm run build     # compiles packages/* to dist/
npm run example   # scan examples/basic with the built CLI
```

Repository layout:

```text
packages/core   @lingolint/core  – engine: parsers, rules, scoring, config schema (pure, browser-safe)
packages/cli    lingolint        – the CLI: file loading, config discovery, reporters
packages/ai     @lingolint/ai    – optional AI review: provider adapters, batching, cache
apps/web                           – local review UI built on @lingolint/core
examples/basic                     – demo locale files with deliberate problems
docs/                              – reference documentation
```

See [docs/architecture.md](docs/architecture.md) for how the pieces fit together.

## Roadmap

- [ ] `lingolint init` to scaffold a config
- [ ] `lingolint fix` for safe automatic fixes (whitespace, obsolete keys)
- [ ] YAML, PO, XLIFF, ARB, Android XML, iOS `.strings`, CSV parsers
- [ ] Per-key character limits sourced from design tools
- [ ] Dedicated GitHub Action with pull request annotations
- [ ] Additional AI provider adapters

The open-source CLI and engine will stay fully functional on their own. Anything hosted (dashboards, team features) will build on top of this same engine, never replace it.

## Contributing

Bug reports, false-positive reports and pull requests are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md); adding a QA rule is a single file plus tests. Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE)
