# LingoLint web UI

A small local interface for reviewing translation issues visually. It uses the exact same engine as the CLI (`@lingolint/core`, compiled from source) and runs entirely in the browser: files are parsed in the tab and never uploaded anywhere.

```bash
npm install          # from the repository root
npm run dev:web      # http://localhost:5173
```

## Workflow

1. Drop your locale JSON files (or click **Try the example project**; opening `http://localhost:5173/?example` does the same).
2. Pick the source locale; every other file becomes a target tab.
3. Review issues with severity and type filters and full-text search.
4. **Edit** a translation inline, **Accept suggestion** where the engine proposes one (whitespace fixes), **Remove key** for obsolete keys, or **Ignore** a finding. The report re-runs instantly on every change.
5. **Export** the target file. Nesting, key order, arrays and untouched values are preserved exactly; only your edits and removals are applied.

No accounts, no database, no AI key needed. AI review is currently CLI-only; the engine accepts any `TranslationAIProvider`, so adding it to the UI is a matter of wiring a provider.

## Build

```bash
npm run build --workspace apps/web   # static files in apps/web/dist
npm run preview --workspace apps/web
```

The output is a static site you can serve from anywhere, including behind a corporate firewall.
