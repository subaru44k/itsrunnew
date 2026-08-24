# ItsRun repository instructions

## Start here

Before investigating or changing this repository, read [`docs/SITE_STRUCTURE.md`](docs/SITE_STRUCTURE.md) in full. It is the canonical overview of the application's structure, routes, data flow, infrastructure, and verification workflow.

The Git repository root contains the application in `itsrunnew/`. Run application, test, and CDK commands from that directory unless a command explicitly says otherwise.

## Keep the structure documentation synchronized

Whenever a change affects any of the following, update `docs/SITE_STRUCTURE.md` in the same change:

- directories, entry points, or ownership of files;
- public routes, redirects, navigation, anchors, page metadata, or locales;
- components, shared layout, styling compatibility rules, or public assets;
- state, schedule behavior, data flow, external scripts, or network dependencies;
- build tools, runtime dependencies, npm commands, tests, or their prerequisites;
- S3, CloudFront, CDK, deployment behavior, outputs, or production-domain boundaries.

Also update `itsrunnew/README.md` when user-facing setup, technology-stack, verification, or deployment instructions change. Before finishing a task, check that both documents still describe the implemented code rather than the intended code.

## Project invariants

- This is a static Vue application. Do not reintroduce Firebase or another schedule backend unless the user explicitly changes that requirement.
- Stadium schedules intentionally render locally generated dates with three `00:00` slots and an “information unavailable” status. There is no schedule fetch.
- `/manage` is removed and falls through to the home-page redirect.
- Preserve the existing site's appearance and public behavior as closely as practical. Vuetify 4 compatibility overrides in `itsrunnew/src/styles.css` are intentional.
- AWS deployment is for the isolated S3 + CloudFront preview stack. Do not attach or modify the production domain, Route 53, or production certificates unless explicitly requested.
- Preserve unrelated user changes. In particular, do not assume untracked files outside `itsrunnew/` belong to this application.

## Expected verification

For application changes, normally run from `itsrunnew/`:

```sh
npm run build
npm test
npm run lint
npm run test:smoke
```

Use `npm run test:visual` when changing layout or styling and an ad-disabled legacy baseline is available, as described in `docs/SITE_STRUCTURE.md`. After an authorized preview deployment, run the smoke test against the CloudFront URL as well.
