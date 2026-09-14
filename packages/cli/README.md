# lingolint

**Catch translation bugs before your users do.** ESLint for app translations.

```bash
npx lingolint scan ./locales --source en
```

Compares your locale JSON files and reports missing keys, obsolete keys, empty strings, placeholder mismatches (`{amount}`, `{{amount}}`, `%s`, …), unbalanced HTML tags, suspicious whitespace, untranslated strings, length outliers and duplicate translations. Exits `1` when errors are found, so the same command gates your CI.

```text
Spanish (es) — 72/100

✖ ERROR  checkout.total
  Missing placeholder: {currency}
  Source:       "Total: {amount} {currency}"
  Translation:  "Total: {amount}"
```

- Works offline. No account, server or API key.
- Nested JSON, ICU, i18next, printf and template placeholder styles.
- `--format json` for integrations, `--fail-on` for CI thresholds.
- Optional AI review with your own key (`--ai`).

Full documentation, configuration reference and contribution guide: **https://github.com/wpfsg/lingolint**

## Install

```bash
npm install -D lingolint
```

Node.js 20.19+.

## Configure

`lingolint.config.ts`:

```ts
import { defineConfig } from 'lingolint';

export default defineConfig({
  sourceLocale: 'en',
  localesPath: './locales',
  failOn: 'error',
  rules: {
    length: ['warning', { maxRatio: 3 }],
    identicalToSource: ['warning', { ignore: ['Notely'] }],
  },
});
```

## CI

```yaml
- run: npx lingolint scan ./locales --source en --fail-on error
```

MIT licensed.
