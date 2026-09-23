# ItsRun repository instructions

## Start here

Before investigating or changing this repository, read [`docs/SITE_STRUCTURE.md`](docs/SITE_STRUCTURE.md) in full. It is the canonical overview of the application's structure, routes, data flow, infrastructure, and verification workflow.

The Git repository root contains the application in `itsrunnew/`. Run application, test, and CDK commands from that directory unless a command explicitly says otherwise.

## Check the Git base before making changes

Before editing files or creating commits, identify the current branch and worktree, check for uncommitted changes, run `git fetch origin master`, and compare `HEAD` with `origin/master`. For new work intended to build on the current mainline, start from the fetched `origin/master`. If a clean local `master` is only behind, fast-forward it with `git pull --ff-only origin master` before starting.

Do not require every task to run on `master` or require local commits to be pushed first. Existing feature branches, worktrees, and local commits may be intentional. If the checkout is ahead, diverged, or has uncommitted changes, preserve them and decide how to incorporate the latest `origin/master` before editing; do not reset, overwrite, or automatically rebase someone else's work. State the branch and remaining difference when it affects the result. If the fetch fails, disclose that the remote base could not be verified.

## Browser and Computer Use policy

Default to no in-app browser, Computer Use, or GUI automation. Prefer repository code and CLI-based evidence such as tests, lint/type checking, builds, `curl`/HTTP requests, logs, and programmatic inspection.

Prefer Playwright or other automated browser tests when they are sufficient to verify browser behavior, including the repository's smoke and visual tests. Use the in-app browser, Computer Use, or GUI automation only for visual, browser-specific, or interactive behavior that cannot be adequately verified by code, CLI, HTTP, or automated browser tests.

When browser interaction is necessary, minimize context and usage: limit it to the target pages and required actions, do not browse unrelated pages, and avoid repeated views or refresh loops. Separate implementation and automated verification from browser checking; finish the code and automated checks first, then perform only the targeted browser check needed for confidence.

Do not operate Search Console, Analytics, hosting consoles, or other external admin services unless the user explicitly requests it. When required data is available only there, prefer asking the user to retrieve and share it rather than operating the console directly. Choose the lowest-cost verification method that retains the necessary confidence, and document any residual uncertainty.

## Distinguish the checkout from the published service

This repository commonly has old feature branches and additional worktrees. The active checkout is therefore not, by itself, evidence of what is currently published.

- For questions about the checked-out implementation, use the files in the active revision and state the branch or revision when it matters.
- For questions about the current public service, first identify the production deployment revision. If deployment evidence is unavailable, compare the active revision with `origin/master` and clearly label the result instead of treating an arbitrary feature branch as production.
- For facility counts, derive the number and regional breakdown from `itsrunnew/src/data/tracks.json` at that identified revision. Do not infer the current count from historical expansion reports, roadmap wording such as `33→51`, or availability files.
- If the checkout and published revision differ, report both explicitly. Do not describe stale checkout data as the current public dataset.

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

### Daily job regression gate (required for every change)

Before completing any application, data, collector, build, test, or workflow change, run `npm run test:daily:fixtures` and `npm run test:daily` from `itsrunnew/`, in addition to the normal checks. The first verifies four statuses, Toda unavailable, and all-unknown data in isolated temporary builds; the second performs live collection, freshness/completeness validation, build, and desktop/mobile smoke without deploying. Do not claim daily compatibility based only on unit tests or a committed availability snapshot. Both checks also run inside the required `Node 24 validation` CI check. Follow [`docs/DAILY_VERIFICATION.md`](docs/DAILY_VERIFICATION.md) for failure triage and post-deployment verification. Record any check that could not run; never bypass it with continue-on-error.
