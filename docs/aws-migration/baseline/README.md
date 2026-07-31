# Legacy public baseline

The JSON files in this directory are read-only observations of the live legacy
site. They are not application data and must not be used as the new schedule
source of truth.

Capture commands:

```bash
npm run baseline:browser
node scripts/migration/capture-public-baseline.mjs
```

The browser command writes screenshots to the ignored `.artifacts/legacy-baseline`
directory. Screenshots are intentionally not committed; rerun the command to
regenerate them. The JSON records requested URL, final URL, status, title and
description for route compatibility tests.

The Firestore export interface is intentionally blocked until the temporary
`firebase-admin` migration dependency and a read-only service credential are
provided. See `scripts/migration/export-firestore.mjs` and the T14 task.
