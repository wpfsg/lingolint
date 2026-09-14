# Rules

Every rule runs locally and deterministically. Configure a rule with a severity (`error`, `warning`, `info`, `off`) or `[severity, options]` under `rules` in your config. Rules can lower the severity of individual low-confidence findings (to `info`) but never raise it above what you configured.

| Rule                   | Issue type              | Default | Options                                                   |
| ---------------------- | ----------------------- | ------- | --------------------------------------------------------- |
| `missingKey`           | `missing_key`           | error   | —                                                         |
| `extraKey`             | `extra_key`             | warning | —                                                         |
| `emptyTranslation`     | `empty_translation`     | error   | —                                                         |
| `placeholders`         | `placeholder_mismatch`  | error   | `syntaxes`                                                |
| `htmlTags`             | `html_mismatch`         | error   | —                                                         |
| `whitespace`           | `whitespace`            | warning | `leading`, `trailing`, `doubleSpaces`, `tabs`, `newlines` |
| `identicalToSource`    | `identical_to_source`   | warning | `ignore`, `minLength`                                     |
| `length`               | `length`                | warning | `maxRatio`, `minRatio`, `minDelta`, `limits`              |
| `duplicateTranslation` | `duplicate_translation` | info    | `minLength`                                               |
| `glossary`             | `terminology`           | warning | —                                                         |

AI finding types (`semantic`, `grammar`, `terminology`, `tone`, `capitalization`, `style`) accept a severity under `rules` as well; see [ai-review.md](ai-review.md).

---

## `missingKey`

A key present in the source locale but absent from the target.

```json
// en.json                    // es.json
{ "save": "Save",             { "save": "Guardar",
  "delete": "Delete" }          }
```

```text
✖ ERROR  delete
  Translation key is missing
```

Users of the target locale see the raw key or a fallback language.

## `extraKey`

A key present in the target but not in the source. Usually a leftover after the source string was removed or renamed.

```text
⚠ WARNING  common.legacyExport
  Key does not exist in the source locale
```

## `emptyTranslation`

The translation is empty or whitespace-only while the source is not. An empty source with an empty translation is allowed.

## `placeholders`

Interpolation placeholders must match as a multiset between source and translation. Recognised syntaxes:

| `syntaxes` value | Example                            |
| ---------------- | ---------------------------------- |
| `icu`            | `{name}`, `{0}`, `{count, number}` |
| `double_curly`   | `{{name}}`                         |
| `template`       | `${name}`                          |
| `ruby`           | `%{name}`                          |
| `percent_named`  | `%name%`                           |
| `printf`         | `%s`, `%d`, `%1$s`, `%.2f`         |

Reports:

- **Missing** placeholders (`Missing placeholder: {currency}`)
- **Unexpected** placeholders not in the source
- **Renamed** placeholders when exactly one is missing and one is unexpected with the same syntax (`{name}` → `{nombre}`, including non-Latin names like `{имя}`)
- **Count mismatches** when a placeholder repeats a different number of times

Order may differ freely. `{n}` and `{n, number}` count as the same placeholder. ICU plural/select blocks with nested braces are not expanded. `%%` is treated as a literal percent sign and `50% off` is not a placeholder.

```ts
placeholders: ['error', { syntaxes: ['icu', 'double_curly'] }];
```

Restricting syntaxes avoids false positives if, for example, your strings legitimately contain `%d` as text.

## `htmlTags`

Inline markup must be preserved and balanced. Tags are tokenized, never rendered. Supports HTML element names, numeric component tags (`<0>…</0>`, react-i18next style) and void tags (`<br>`, `<br/>`, `<img>`, …).

Reports unclosed tags, closing tags without an opener, missing tags and unexpected tags. Imbalance that already exists in the source is not blamed on the translation.

## `whitespace`

Whitespace differences that are almost always accidental:

| Option         | Default | Flags                                           |
| -------------- | ------- | ----------------------------------------------- |
| `leading`      | `true`  | Leading whitespace the source lacks             |
| `trailing`     | `true`  | Trailing whitespace the source lacks            |
| `doubleSpaces` | `true`  | Two or more consecutive spaces the source lacks |
| `tabs`         | `true`  | Tab characters the source lacks                 |
| `newlines`     | `true`  | Line breaks when the source has none            |

Each finding includes a `suggestion` with the cleaned string. Whitespace mirrored from the source is never reported.

## `identicalToSource`

The translation equals the source text, which usually means it was never translated.

Skipped automatically when: source and target share a language (`en` vs `en-GB`); the text is in the `ignore` list; the text matches a `doNotTranslate` glossary term; the text has no letters after removing placeholders and tags; the text is a single acronym-like token (`API`, `OAuth 2.0`, `USDT`) or contains digits.

Confidence depends on length: single words are reported as `info` (likely brand names), two words at 70%, longer at 90%.

```ts
identicalToSource: ['warning', { ignore: ['Notely', 'Bitcoin', 'Telegram'], minLength: 2 }];
```

## `length`

Flags translations whose length differs enough from the source to threaten layout.

| Option     | Default | Meaning                                                               |
| ---------- | ------- | --------------------------------------------------------------------- |
| `maxRatio` | `3`     | Report when `target / source` exceeds this                            |
| `minRatio` | `0.25`  | Report (as `info`) when `target / source` is below this; `0` disables |
| `minDelta` | `10`    | Absolute character difference required before a ratio is reported     |
| `limits`   | `{}`    | Hard character limits per key or `*` pattern                          |

`minDelta` prevents `OK` → `Aceptar` (3.5×, but only 5 characters longer) from being reported, while `Connect` → `Conectar con la cuenta` (3.1×, 15 characters longer) is. Lengths are counted in Unicode code points and trimmed.

```ts
length: ['warning', { maxRatio: 2.5, limits: { 'nav.*': 20, 'buttons.*': 24 } }];
```

A `limits` violation is reported even when the ratio is fine. This is the place to encode constraints from your design system.

## `duplicateTranslation`

Several different source strings share the exact same translation. Often legitimate (`Close` and `Exit` → `Cerrar`), sometimes a copy-paste mistake, so the default is `info`. Identical source strings with identical translations are consistent and not reported. The finding lists all keys involved in `relatedKeys`.

## `glossary`

Enforces the `glossary` section of your config on translated strings:

- A source string containing a term with a preferred translation for the target locale must contain that translation (case-insensitive, whole word).
- A source string containing a `doNotTranslate` term must contain the term verbatim.

Runs only for terms with an entry for the current target locale. Strings identical to the source are skipped here and handled by `identicalToSource`.
