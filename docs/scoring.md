# Health score

Every target locale receives a score from 0 to 100. The score is deterministic: the same files and configuration always produce the same number.

## Formula

```text
scale   = baselineKeys / max(keyCount, baselineKeys)
penalty = errors × weights.error + warnings × weights.warning + info × weights.info
score   = clamp(round(100 − penalty × scale), 0, 100)
```

- `keyCount` is the number of keys in the **source** locale.
- `baselineKeys` defaults to `100`.
- Default weights: `error: 5`, `warning: 2`, `info: 0.25`.

## Why the baseline?

Raw weights would make the score meaningless for large apps: 20 errors among 5,000 keys would score 0, the same as 20 errors among 20 keys. Scaling penalties by `baselineKeys / keyCount` for locales larger than the baseline means:

| Locale size | One error costs | One warning costs |
| ----------- | --------------- | ----------------- |
| ≤ 100 keys  | 5.0 points      | 2.0 points        |
| 500 keys    | 1.0 point       | 0.4 points        |
| 1,000 keys  | 0.5 points      | 0.2 points        |
| 5,000 keys  | 0.1 points      | 0.04 points       |

Locales at or below the baseline use the raw weights, so a small project with two missing keys still gets a visibly lower score (90) rather than a rounding error.

## Worked example

`examples/basic/es.json` against `en.json` (32 keys, so `scale = 1`):

```text
4 errors   × 5    = 20
4 warnings × 2    =  8
2 info     × 0.25 =  0.5
penalty           = 28.5
score = round(100 − 28.5) = 72
```

## Overall health

The project score is the rounded mean of the locale scores. It is `100` when there are no target locales.

## Configuring

```ts
export default defineConfig({
  scoring: {
    weights: { error: 10, warning: 1, info: 0 },
    baselineKeys: 250,
  },
});
```

The score never affects the exit code; only `failOn` does. Use the score for dashboards, trend tracking and code review context.

## Implementation

The functions live in `packages/core/src/engine/scoring.ts` (`computeScore`, `overallScore`, `exceedsThreshold`) and are covered by `packages/core/tests/engine/scoring.test.ts`.
