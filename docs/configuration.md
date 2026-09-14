# Configuration

LingoLint works without any configuration. When you want to tune rules, add a config file next to your `package.json`.

## Config file

Searched in the current working directory, first match wins:

```text
lingolint.config.ts
lingolint.config.mts
lingolint.config.cts
lingolint.config.js
lingolint.config.mjs
lingolint.config.cjs
lingolint.config.json
```

TypeScript configs are loaded with [jiti](https://github.com/unjs/jiti); no build step is needed. Use `--config <path>` to point at a specific file.

```ts
import { defineConfig } from 'lingolint';

export default defineConfig({
  // ...
});
```

`defineConfig` is an identity function that provides type checking and editor completion. A plain `export default { ... }` works too, as does a JSON file.

Relative paths in the config (`localesPath`) resolve against the config file's directory. A path passed on the command line resolves against the current working directory.

## Precedence

CLI flags override the config file, which overrides built-in defaults.

| CLI flag           | Config key     |
| ------------------ | -------------- |
| `[path]` argument  | `localesPath`  |
| `--source`         | `sourceLocale` |
| `--targets`        | `targets`      |
| `--include`        | `include`      |
| `--fail-on`        | `failOn`       |
| `--ai` / `--no-ai` | `ai.enabled`   |

## Options

### `sourceLocale`

`string`, default `'en'`. The locale every other file is compared against. Must match a file name (`en.json` → `en`).

### `localesPath`

`string`, default `'./locales'`. Directory containing one file per locale.

### `include`

`string[]`, default `['*.json']`. File name patterns; `*` matches any characters. Files without a registered parser are skipped.

### `targets`

`string[]`, optional. Restrict analysis to these locales. Defaults to every file except the source.

### `failOn`

`'error' | 'warning' | 'info' | 'never'`, default `'error'`. The CLI exits with code `1` when any issue at this severity or higher exists. `warning` fails on warnings and errors; `never` always exits `0` (useful for reporting-only runs).

### `ignoreKeys`

`string[]`, default `[]`. Keys excluded from every per-key rule. Supports `*`:

```ts
ignoreKeys: ['legal.*', '*.debugLabel', 'app.name'];
```

### `rules`

Record of rule name → setting. A setting is a severity (`'error' | 'warning' | 'info' | 'off'`) or a tuple `[severity, options]`:

```ts
rules: {
  extraKey: 'off',
  length: ['warning', { maxRatio: 2.5, limits: { 'nav.*': 20 } }],
  tone: 'warning', // AI finding types can be configured too
}
```

Unknown rule names are rejected so typos never silently disable a check. Every rule and its options is documented in [rules.md](rules.md).

### `glossary`

Record of source term → entry. Two shapes are accepted:

```ts
glossary: {
  // shorthand: locale → preferred translation
  Withdrawal: { es: 'Retiro', de: 'Auszahlung' },

  // full form
  Wallet: {
    translations: { es: 'Cartera' },
    description: 'The in-app crypto wallet, not a physical wallet',
  },
  API: { doNotTranslate: true, caseSensitive: true },
}
```

| Field            | Meaning                                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| `translations`   | Preferred translation per target locale; the `glossary` rule warns when a source string containing the term lacks it. |
| `doNotTranslate` | The term must appear verbatim in the translation. Also exempts identical strings from `identicalToSource`.            |
| `caseSensitive`  | Match the term case-sensitively in source text (default `false`).                                                     |
| `description`    | Free text shown in explanations and passed to AI providers.                                                           |

Terms match whole words only (`Withdrawal` does not match `Withdrawals`).

### `context`

`string`, optional. A short description of the product, passed to AI providers to disambiguate terminology and set the expected register. Not used by deterministic rules.

### `scoring`

See [scoring.md](scoring.md).

```ts
scoring: {
  weights: { error: 5, warning: 2, info: 0.25 },
  baselineKeys: 100,
}
```

### `ai`

See [ai-review.md](ai-review.md).

```ts
ai: {
  enabled: false,          // or pass --ai
  provider: 'anthropic',
  model: undefined,        // provider default
  batchSize: 25,           // strings per request
  cache: true,             // cache responses on disk
  maxItems: undefined,     // cap strings reviewed per locale per run
  minConfidence: 0.5,      // drop findings below this
  infoBelowConfidence: 0.75, // report findings below this as info
}
```

## Full example

```ts
import { defineConfig } from 'lingolint';

export default defineConfig({
  sourceLocale: 'en',
  localesPath: './src/locales',
  include: ['*.json'],
  targets: ['es', 'de', 'fr'],
  failOn: 'error',
  ignoreKeys: ['legal.*'],
  rules: {
    missingKey: 'error',
    extraKey: 'warning',
    emptyTranslation: 'error',
    placeholders: ['error', { syntaxes: ['icu', 'double_curly'] }],
    htmlTags: 'error',
    whitespace: ['warning', { newlines: false }],
    identicalToSource: ['warning', { ignore: ['Notely', 'Pro'] }],
    length: ['warning', { maxRatio: 3, minDelta: 10, limits: { 'nav.*': 18 } }],
    duplicateTranslation: 'info',
    glossary: 'warning',
  },
  glossary: {
    Note: { es: 'Nota', de: 'Notiz', fr: 'Note' },
    Notely: { doNotTranslate: true },
  },
  context: 'Notely is a note-taking app for teams. Friendly, concise UI copy; informal register.',
  scoring: { weights: { error: 5, warning: 2, info: 0.25 }, baselineKeys: 100 },
  ai: { enabled: false, provider: 'anthropic', batchSize: 25, cache: true },
});
```
