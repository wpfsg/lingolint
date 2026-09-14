# JSON output

```bash
lingolint scan ./locales --source en --format json > report.json
```

The JSON reporter prints a single object to stdout and nothing else, so it can be piped directly. Diagnostics go to stderr. The exit code is unchanged (`0` passed, `1` threshold exceeded, `2` could not run).

## Stability

`schemaVersion` is `1`. Within a schema version fields are only ever **added**. Consumers should ignore unknown fields. Renaming or removing a field, or changing a field's type, requires a new `schemaVersion`.

Issue `id`s are deterministic for the same locale, rule, type, key and message, so they are safe to use for suppression lists and for diffing two runs.

## Shape

```ts
interface JsonOutput {
  tool: { name: 'LingoLint'; version: string };
  schemaVersion: 1;
  sourceLocale: string;
  /** Rounded mean of locale scores; 100 with no targets. */
  overallScore: number;
  summary: IssueSummary;
  locales: LocaleReport[];
  /** The threshold in effect for this run. */
  failOn: 'error' | 'warning' | 'info' | 'never';
  /** False when an issue at or above failOn exists (exit code 1). */
  passed: boolean;
}

interface IssueSummary {
  errors: number;
  warnings: number;
  info: number;
  total: number;
}

interface LocaleReport {
  sourceLocale: string;
  targetLocale: string;
  /** English display name, e.g. "Spanish"; falls back to the code. */
  targetLocaleName: string;
  /** 0–100, see scoring.md */
  score: number;
  /** Number of keys in the source locale. */
  keyCount: number;
  summary: IssueSummary;
  /** Sorted: errors first, then by key, type, message. */
  issues: TranslationIssue[];
  /** Present only when AI review ran. */
  ai?: {
    provider: string;
    reviewed: number;
    cached: number;
    skipped: number;
    error?: string;
  };
}

interface TranslationIssue {
  id: string;
  locale: string;
  key: string;
  type: IssueType;
  /** Rule that produced it, e.g. "placeholders" or "ai". */
  rule: string;
  severity: 'error' | 'warning' | 'info';
  origin: 'deterministic' | 'ai';
  message: string;
  explanation?: string;
  suggestion?: string;
  sourceText?: string;
  translatedText?: string;
  /** 0–1. Omitted for findings that are certain. */
  confidence?: number;
  /** Other keys involved, e.g. keys sharing a duplicate translation. */
  relatedKeys?: string[];
  /** Rule-specific structured data. */
  details?: Record<string, unknown>;
}

type IssueType =
  | 'missing_key'
  | 'extra_key'
  | 'empty_translation'
  | 'placeholder_mismatch'
  | 'html_mismatch'
  | 'whitespace'
  | 'identical_to_source'
  | 'length'
  | 'duplicate_translation'
  | 'terminology'
  | 'semantic'
  | 'grammar'
  | 'tone'
  | 'capitalization'
  | 'style';
```

## `details` by rule

| Rule                   | `details`                                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `placeholders`         | `missing: string[]`, `unexpected: string[]`, `renamed: {from, to}[]`, `countMismatches: {placeholder, sourceCount, targetCount}[]` |
| `htmlTags`             | `missing: string[]`, `unexpected: string[]`, `unclosed: string[]`, `unopened: string[]`                                            |
| `whitespace`           | `problems: string[]`                                                                                                               |
| `length`               | `ratio`, `sourceLength`, `targetLength` or `limit`, `length`, `pattern`                                                            |
| `duplicateTranslation` | `keys: string[]`                                                                                                                   |
| `glossary`             | `term`, and `preferred` or `doNotTranslate: true`                                                                                  |

## Example: fail only on new issues

Because ids are stable you can baseline a report and fail CI only on issues that were not present before:

```bash
lingolint scan --format json --fail-on never > current.json
jq -r '.locales[].issues[].id' baseline.json | sort > old.txt
jq -r '.locales[].issues[].id' current.json | sort > new.txt
comm -13 old.txt new.txt   # ids only in the current run
```

## Privacy

`sourceText`, `translatedText` and `suggestion` contain your actual strings. Treat report files as you would the locale files themselves.
