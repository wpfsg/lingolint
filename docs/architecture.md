# Architecture

```text
                         ┌────────────────────────┐
   locale files ───────▶ │  lingolint (CLI)     │ ──▶ pretty / json report, exit code
   config file  ───────▶ │  fs, config discovery, │
                         │  reporters             │
                         └───────────┬────────────┘
                                     │ analyzeProject()
                                     ▼
 ┌─────────────────┐     ┌────────────────────────┐     ┌──────────────────────┐
 │  apps/web       │ ──▶ │  @lingolint/core     │ ◀── │  @lingolint/ai     │
 │  browser UI     │     │  parser · rules ·      │     │  provider adapters · │
 └─────────────────┘     │  scoring · config      │     │  batching · cache    │
                         └────────────────────────┘     └──────────────────────┘
                              pure, no I/O                node only, optional
```

## Packages

### `@lingolint/core`

The engine. Pure TypeScript: no filesystem, network, `process` or vendor SDK access. It runs identically in Node, CI, the browser and tests.

```ts
const report = await analyzeTranslations({ sourceLocale, targetLocale, source, target, config, ai? });
const project = await analyzeProject({ sourceLocale, locales, config, ai? });
const sync = analyzeTranslationsSync({ ... }); // deterministic rules only
```

Pipeline for one locale:

1. **Flatten** nested input to dotted keys (`parser/flatten.ts`).
2. **Build a `RuleContext`**: sorted source/target/shared key lists, resolved glossary, `isIgnored`.
3. **Run rules.** Each `QARule` is a pure function `RuleContext → RuleIssue[]`. The engine attaches the configured severity (capped by the rule's `maxSeverity`), rule name, origin and a deterministic id.
4. **AI review** (optional). Select strings that passed the technical checks, call the provider once per locale, map findings to issues with the confidence policy applied. Failures are recorded in `report.ai.error`, never thrown.
5. **Sort, summarize, score.**

`analyzeProject` runs locales with `Promise.all`; rules are pure so this is safe.

### `lingolint` (CLI)

Everything that touches the outside world: reading locale files, discovering and loading config (TypeScript via jiti), building the AI provider from environment variables, formatting output, exit codes. `run(argv, io)` takes an injectable `CliIO` and returns the exit code, so the whole CLI is testable in-process without spawning.

### `@lingolint/ai`

Adapters implementing `TranslationAIProvider` plus two generic wrappers: `withBatching` (split into fixed-size requests) and `withCache` (per-string result cache keyed by everything that could change the verdict). `createReviewerFromConfig` composes `cache → batching → vendor` and is the only thing the CLI calls.

### `apps/web`

Vite + React. Imports `@lingolint/core` and runs the same `analyzeTranslationsSync` in the browser. Files never leave the tab. Edits are written back with `applyFlatValues`, which preserves nesting, arrays, key order and unrelated values.

## Extension points

| Want to add…     | Implement                               | Register in                            |
| ---------------- | --------------------------------------- | -------------------------------------- |
| a QA rule        | `QARule` (`types/rule.ts`)              | `packages/core/src/rules/index.ts`     |
| a file format    | `LocaleFileParser` (`parser/types.ts`)  | `packages/core/src/parser/registry.ts` |
| an AI vendor     | `TranslationAIProvider` (`types/ai.ts`) | `packages/ai/src/factory.ts`           |
| an output format | a function `ProjectReport → string`     | `packages/cli/src/reporters/index.ts`  |

## Determinism

Given the same files and config, a run produces byte-identical JSON (ignoring `tool.version`). Rules never consult time, randomness or environment; keys are sorted with a locale-independent comparison; issue ids are hashes of `(locale, rule, type, key, message)`. This is what makes baselining and diffing reports possible.

## Performance

Rules iterate pre-sorted key arrays; there is no repeated tree traversal. Placeholder and tag extraction are single-pass regular expressions with no nested quantifiers. Thousands of keys across several locales analyze in well under a second on a laptop. AI requests run concurrently per locale and are batched.

## Future hosted service

The report format and the engine API are the boundary. A dashboard, GitHub App or team glossary would consume `ProjectReport` JSON produced by this same engine. Nothing in the open-source packages is held back to make that possible; the CLI is the product.
