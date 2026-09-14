# Basic example

Three locale files for a fictional note-taking app, with deliberate problems in
`es.json` and `de.json` so you can see every deterministic check fire:

| Problem                    | Where                                                                          |
| -------------------------- | ------------------------------------------------------------------------------ |
| Missing key                | `common.delete` missing from `es`                                              |
| Extra key                  | `common.legacyExport` only in `es`                                             |
| Missing placeholder        | `checkout.total` in `es`                                                       |
| Renamed placeholder        | `auth.welcome` in `de` (`{name}` → `{Name}`)                                   |
| Empty translation          | `errors.generic` in `es`                                                       |
| Unclosed HTML tag          | `notes.deleteConfirm` in `es`                                                  |
| Identical to source        | `profile.accountSettings` in `es`, `errors.notFound` in `de`                   |
| Trailing whitespace        | `nav.settings` in `es`                                                         |
| Repeated spaces            | `notes.empty` in `de`                                                          |
| Unusually long translation | `profile.connect` in `es`                                                      |
| Duplicate translation      | `common.close` / `common.exit` in `es`, `auth.signOut` / `common.exit` in `de` |

Run it from the repository root:

```bash
npx lingolint scan ./examples/basic --source en
```

Or open it in the local web UI at `http://localhost:5173/?example` after `npm run dev:web`.

These files are also used as fixtures by the test suite.
