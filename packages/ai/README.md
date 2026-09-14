# @lingolint/ai

Optional AI linguistic review for [LingoLint](https://github.com/wpfsg/lingolint): semantic mistranslations, grammar, tone consistency, capitalization and unnatural wording, each with an explanation and a confidence score.

Everything here is additive. `@lingolint/core` and the `lingolint` CLI work fully without it.

> Using AI review sends translation text to the configured provider. Bring your own API key; it is read from the environment and never logged or stored.

```bash
npm install @lingolint/ai @lingolint/core
```

```ts
import { analyzeTranslations } from '@lingolint/core';
import { createAnthropicProvider, withBatching, withCache, createMemoryCache } from '@lingolint/ai';

const ai = withCache(
  withBatching(createAnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY }), {
    batchSize: 25,
  }),
  createMemoryCache(),
);

const report = await analyzeTranslations({
  sourceLocale: 'en',
  targetLocale: 'es',
  source,
  target,
  config: { ai: { enabled: true }, context: 'A note-taking app; informal register.' },
  ai,
});
```

## Exports

| Export                                                                             | Purpose                                                                  |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `createAnthropicProvider`                                                          | Adapter using the official Anthropic SDK with structured outputs.        |
| `withBatching(provider, opts)`                                                     | Split reviews into fixed-size concurrent requests.                       |
| `withCache(provider, cache)`                                                       | Per-string result cache; unchanged strings are never re-sent.            |
| `createMemoryCache`, `createFileCache`                                             | Cache implementations.                                                   |
| `createReviewerFromConfig`                                                         | What the CLI uses: `cache → batching → provider` from `ai` config + env. |
| `registerAIProvider`                                                               | Plug in another vendor under a name usable as `ai.provider`.             |
| `buildSystemPrompt`, `buildUserMessage`, `reviewResponseSchema`, `parseReviewJson` | Reuse the prompt and response contract in your own adapter.              |

Adding a provider is documented in [CONTRIBUTING.md](https://github.com/wpfsg/lingolint/blob/main/CONTRIBUTING.md#adding-an-ai-provider).

MIT licensed.
