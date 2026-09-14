# Contributing to LingoLint

Thanks for helping make translations less broken. This guide covers setup, the development loop, and how to add the three things people most often want to add: a QA rule, a file format parser, and an AI provider.

## Setup

```bash
git clone https://github.com/wpfsg/lingolint
cd lingolint
npm install
```

Node.js 20.19+ is required (`.nvmrc` pins 22). The repository is an npm workspaces monorepo; `npm install` at the root links all packages.

## Development loop

| Command              | What it does                                                                 |
| -------------------- | ---------------------------------------------------------------------------- |
| `npm test`           | Runs all tests once (Vitest). Tests import source directly, no build needed. |
| `npm run test:watch` | Watch mode.                                                                  |
| `npm run typecheck`  | `tsc --noEmit` across packages and tests.                                    |
| `npm run lint`       | ESLint with type-aware rules. `npm run lint:fix` autofixes.                  |
| `npm run format`     | Prettier. CI runs `format:check`.                                            |
| `npm run build`      | Compiles every package to `dist/`.                                           |
| `npm run example`    | Runs the built CLI on `examples/basic`.                                      |
| `npm run dev:web`    | Starts the local web UI.                                                     |

CI runs lint, format check, typecheck, build and tests on Node 20, 22 and 24. Please run them locally before opening a pull request.

## Repository layout

```text
packages/core/src
  types/        Issue model, rule contract, report types, AI provider contract
  parser/       flatten/unflatten, JSON parser, parser registry
  analysis/     placeholder + tag tokenizers shared by rules
  rules/        one file per deterministic rule + registry
  config/       Zod schema, defaults, rule setting resolution, glossary
  engine/       analyzeTranslations / analyzeProject, scoring, issue ids
packages/cli/src
  cli.ts        commander program, `run(argv, io)` (never calls process.exit)
  commands/     scan
  config/       config file discovery and loading (jiti for TypeScript)
  locales/      reading locale files from disk
  reporters/    pretty and json output
packages/ai/src
  providers/    vendor adapters (anthropic)
  batching.ts   splits reviews into batches
  cache.ts      per-string response cache
  factory.ts    provider registry + createReviewerFromConfig
apps/web        Vite + React UI consuming @lingolint/core
```

Design rules that keep the codebase easy to work in:

- **The engine is pure.** Nothing in `packages/core` touches the filesystem, network, `process`, or vendor SDKs. If you need I/O, it belongs in the CLI or in `packages/ai`.
- **Rules are pure functions** of a `RuleContext`. No shared state, no randomness. This is what makes issue ids deterministic and locales safe to analyze in parallel.
- **Filesystem and parsing are separate.** Parsers take text and return data; the CLI reads files.
- **Machine-readable output is a contract.** Add fields to `TranslationIssue` / `ProjectReport` freely; do not rename or remove them without bumping `schemaVersion`.
- **Prefer no new dependencies.** Ask in the pull request if you think one is warranted.

## Adding a QA rule

1. Create `packages/core/src/rules/<rule-name>.ts`:

   ```ts
   import { z } from 'zod';
   import { defineRule, type RuleIssue } from '../types/rule.js';

   const optionsSchema = z.object({
     // every option needs a default so `{}` is valid
     threshold: z.number().default(3),
   });

   export const myRule = defineRule({
     name: 'myRule', // camelCase; this is the key users write under `rules`
     type: 'style', // an IssueType from types/issue.ts (add one if needed)
     description: 'One line shown in docs and help.',
     defaultSeverity: 'warning',
     optionsSchema,
     run(context) {
       const issues: RuleIssue[] = [];
       for (const key of context.sharedKeys) {
         if (context.isIgnored(key)) continue;
         const source = context.source[key] ?? '';
         const target = context.target[key] ?? '';
         if (/* problem */ false) {
           issues.push({
             key,
             message: 'Short description of what is wrong',
             explanation: 'Why it matters and what to do.',
             sourceText: source,
             translatedText: target,
             // optional: suggestion, confidence, relatedKeys, details, maxSeverity
           });
         }
       }
       return issues;
     },
   });
   ```

   Use `context.sourceKeys` / `targetKeys` for rules about key sets, `sharedKeys` for per-string rules. Set `maxSeverity: 'info'` on low-confidence findings so a user who configures the rule as `error` still gets those as suggestions; a rule can lower severity but never raise it.

2. Register it in `packages/core/src/rules/index.ts` (add to `builtinRules` and the named exports).

3. Add tests in `packages/core/tests/rules/`. Use the `runRule` helper; cover the true positive, the obvious false positive you are avoiding, and each option. If the rule should fire on the example project, add a deliberate instance to `examples/basic` and assert it in `tests/engine/analyze.test.ts`.

4. Document it in `docs/rules.md` and add a `CHANGELOG.md` entry.

Guidelines for rules: be conservative. A false positive costs more trust than a missed issue. When in doubt, report as `info` with an explanation of why manual review is needed.

## Adding a parser

Parsers are pure text → data converters registered by file extension.

1. Create `packages/core/src/parser/<format>.ts` implementing `LocaleFileParser`:

   ```ts
   import type { LocaleFileParser } from './types.js';
   import { flattenTranslations } from './flatten.js';

   export const yamlParser: LocaleFileParser = {
     name: 'yaml',
     extensions: ['.yaml', '.yml'],
     parse(text, options) {
       const data = /* parse text to a nested object; throw LocaleParseError with line/column on failure */;
       return { format: 'yaml', data, flat: flattenTranslations(data) };
     },
     serialize(data) {
       return /* text */;
     },
   };
   ```

2. Register it in `packages/core/src/parser/registry.ts` and export it from `parser/index.ts`.
3. Add fixture-based tests, including a malformed file to check the error message includes the location.
4. Update the "Supported formats" table in the README.

Because the CLI discovers parsers by extension, nothing else needs to change for `lingolint scan` to pick up the new format (users add the pattern to `include`).

## Adding an AI provider

1. Create `packages/ai/src/providers/<vendor>.ts` exporting a function that returns a `TranslationAIProvider`:

   ```ts
   import type { TranslationAIProvider } from '@lingolint/core';
   import { buildSystemPrompt, buildUserMessage } from '../prompt.js';
   import { parseReviewJson } from '../schema.js';

   export function createMyProvider(options: {
     apiKey: string;
     model?: string;
   }): TranslationAIProvider {
     return {
       name: 'my-vendor',
       async review(input) {
         const text = await callVendor(buildSystemPrompt(input), buildUserMessage(input));
         return { findings: parseReviewJson(text) };
       },
     };
   }
   ```

   Reuse `buildSystemPrompt` / `buildUserMessage` so all providers get the same instructions, glossary and project context, and `parseReviewJson` (or `reviewResponseSchema` with a structured-output API) so malformed output is dropped instead of crashing.

2. Register it in `packages/ai/src/factory.ts` with `registerAIProvider('my-vendor', ({ ai, env }) => ...)`. Read the API key from `env`, never from a file, and throw `AIProviderError` with a helpful hint when it is missing.
3. Export from `packages/ai/src/index.ts`, test with an injected fake client, and document the environment variable in `.env.example` and `docs/ai-review.md`.

Batching and caching wrap every provider automatically; you do not need to implement them.

## Pull request process

1. Open an issue first for anything larger than a bug fix, so we can agree on the approach.
2. Keep pull requests focused. One rule, one parser, one fix.
3. Add tests. Fixtures beat screenshots.
4. Run `npm run lint && npm run typecheck && npm test && npm run build`.
5. Add a line under **Unreleased** in `CHANGELOG.md`.
6. Fill in the pull request template. A maintainer will review; we aim to respond within a week.

Never include real product strings, credentials or company names in fixtures. Invent generic examples like the ones in `examples/basic`.

## Releasing (maintainers)

Publishing is manual and never automated by CI.

```bash
npm run clean && npm run build && npm test
npm version <patch|minor|major> --workspaces --include-workspace-root
npm publish --workspace packages/core --access public
npm publish --workspace packages/ai --access public
npm publish --workspace packages/cli --access public
```

Then move the **Unreleased** section of `CHANGELOG.md` under the new version and tag the release.
