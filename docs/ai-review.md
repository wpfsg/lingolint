# AI review

Deterministic rules catch structural bugs with certainty. They cannot tell you that _"Abra la aplicación"_ is formal while the rest of your Spanish is informal, or that a word was mistranslated. AI review is an optional layer for exactly those linguistic problems.

> **Using AI review sends translation text to the configured AI provider.**
> Nothing leaves your machine unless you enable it. The CLI prints this notice on every AI-enabled run.

## Enabling

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npx lingolint scan ./locales --source en --ai
```

Or in the config:

```ts
ai: { enabled: true, provider: 'anthropic' }
```

`--no-ai` disables it for one run regardless of the config. Keys are read from the environment only. They are never written to logs, reports or the cache.

## What it finds

| Type             | Example                                           | Default severity |
| ---------------- | ------------------------------------------------- | ---------------- |
| `semantic`       | "Withdraw" translated as "deposit"                | warning          |
| `grammar`        | Gender/number agreement, wrong conjugation        | warning          |
| `terminology`    | Inconsistent or wrong term for this product       | warning          |
| `tone`           | Mixing formal and informal address across strings | info             |
| `capitalization` | Title Case in a language that uses sentence case  | info             |
| `style`          | Awkward or unnatural phrasing                     | info             |

Each finding includes:

```text
⚠ WARNING AI  onboarding.open  confidence 85%
  Tone inconsistency
  Source:       "Open the app to continue."
  Translation:  "Abra la aplicación para continuar."
  Suggestion:   "Abre la aplicación para continuar."
  Other strings in this project consistently use informal Spanish (tú).
```

Configure severities like any rule: `rules: { tone: 'warning', style: 'off' }`.

## Conservative by design

False positives destroy trust, so:

- Providers are instructed to report only what a native reviewer would change, never stylistic preference.
- Every finding carries a `confidence` between 0 and 1.
- Findings below `ai.minConfidence` (default `0.5`) are dropped.
- Findings below `ai.infoBelowConfidence` (default `0.75`) are reported as `info` regardless of the configured severity.
- Glossary rules are passed to the provider and override its own judgement; deterministic glossary findings suppress duplicate AI `terminology` findings on the same key.

## What is sent, and what is not

Only strings that **passed the deterministic checks** are sent. Strings with a missing placeholder, broken tag, empty value or identical-to-source finding are skipped, since a technical fix is needed first. Keys in `ignoreKeys` and strings without letters are skipped too.

The request contains, per string: the key, the source text and the translation. Plus, once per batch: the locale pair, your `context` text and the glossary entries relevant to the target locale. Nothing else from your repository is sent.

## Cost control

| Setting        | Default          | Effect                                                                                   |
| -------------- | ---------------- | ---------------------------------------------------------------------------------------- |
| `ai.batchSize` | `25`             | Strings per request. Batching also lets the model judge tone consistency across strings. |
| `ai.maxItems`  | unset            | Hard cap on strings reviewed per locale per run.                                         |
| `ai.cache`     | `true`           | Cache findings per string on disk; unchanged strings are never re-sent.                  |
| `ai.model`     | provider default | Override the model (`LINGOLINT_AI_MODEL` env var also works).                            |

The cache lives in `node_modules/.cache/lingolint` when a `node_modules` folder exists, otherwise `.lingolint/cache`. Delete it any time. Disable with `ai.cache: false` or `LINGOLINT_AI_CACHE=0`. The cache key includes the source, translation, locales, project context, relevant glossary entries, provider, model and prompt version, so any change that could alter the verdict triggers a fresh review.

AI review never blocks deterministic results. If the provider fails (bad key, rate limit, outage) the run completes with the deterministic report plus an `ai.error` line for that locale.

## Providers

The engine depends only on this interface:

```ts
interface TranslationAIProvider {
  readonly name: string;
  review(input: TranslationReviewInput): Promise<TranslationReviewResult>;
}
```

Built in:

| `ai.provider` | Environment variable | Default model   |
| ------------- | -------------------- | --------------- |
| `anthropic`   | `ANTHROPIC_API_KEY`  | `claude-opus-5` |

To add another vendor, implement the interface and register it; see [CONTRIBUTING.md](../CONTRIBUTING.md#adding-an-ai-provider). Batching and caching wrap every provider automatically.

## Using the web UI or your own tooling

`@lingolint/core` accepts any `TranslationAIProvider` in `analyzeTranslations({ ai })`. `@lingolint/ai` exports `createAnthropicProvider`, `withBatching`, `withCache`, `createMemoryCache` and `createFileCache` so you can compose exactly the pipeline you need.
