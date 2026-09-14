# @lingolint/core

The translation QA engine behind [LingoLint](https://github.com/wpfsg/lingolint). Pure TypeScript with no filesystem or network access: runs in Node, CI, browsers and tests.

```bash
npm install @lingolint/core
```

```ts
import { analyzeTranslations } from '@lingolint/core';

const report = await analyzeTranslations({
  sourceLocale: 'en',
  targetLocale: 'es',
  source: { checkout: { total: 'Total: {amount} {currency}' } },
  target: { checkout: { total: 'Total: {amount}' } },
  config: { rules: { length: ['warning', { maxRatio: 2.5 }] } },
});

report.score; // 95
report.issues[0];
// {
//   key: 'checkout.total',
//   type: 'placeholder_mismatch',
//   severity: 'error',
//   message: 'Missing placeholder: {currency}',
//   details: { missing: ['{currency}'], ... },
//   ...
// }
```

## API

| Export                                                                              | Purpose                                                                               |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `analyzeTranslations(options)`                                                      | One target locale vs. the source. Async; accepts an optional `TranslationAIProvider`. |
| `analyzeTranslationsSync(options)`                                                  | Deterministic rules only. Synchronous.                                                |
| `analyzeProject(options)`                                                           | Every target locale; returns a `ProjectReport` with an overall score.                 |
| `resolveConfig`, `defineConfig`, `configSchema`                                     | Zod-validated configuration with defaults.                                            |
| `builtinRules`, `defineRule`                                                        | Rule registry and helper for writing rules.                                           |
| `flattenTranslations`, `unflattenTranslations`, `applyFlatValues`, `removeFlatKeys` | Nested ↔ flat conversion that preserves structure on write-back.                      |
| `parseJsonTranslations`, `jsonParser`, `registerParser`, `getParserForFile`         | Parsers with actionable error positions.                                              |
| `extractPlaceholders`, `comparePlaceholders`, `extractTags`, `compareTags`          | Reusable analysis primitives.                                                         |
| `computeScore`, `exceedsThreshold`                                                  | Transparent scoring and CI thresholds.                                                |

Types: `TranslationIssue`, `LocaleReport`, `ProjectReport`, `QARule`, `RuleContext`, `LingoLintConfig`, `TranslationAIProvider`, and more.

See the [documentation](https://github.com/wpfsg/lingolint/tree/main/docs) for rules, configuration, scoring and the JSON report format.

MIT licensed.
