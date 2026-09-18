# ItsRun repository instructions

## Start here

Before investigating or changing this repository, read [`docs/SITE_STRUCTURE.md`](docs/SITE_STRUCTURE.md) in full. It is the canonical overview of the application's structure, routes, data flow, infrastructure, and verification workflow.

The Git repository root contains the application in `itsrunnew/`. Run application, test, and CDK commands from that directory unless a command explicitly says otherwise.

## Browser and Computer Use policy

Default to no in-app browser, Computer Use, or GUI automation. Prefer repository code and CLI-based evidence such as tests, lint/type checking, builds, `curl`/HTTP requests, logs, and programmatic inspection.

Prefer Playwright or other automated browser tests when they are sufficient to verify browser behavior, including the repository's smoke and visual tests. Use the in-app browser, Computer Use, or GUI automation only for visual, browser-specific, or interactive behavior that cannot be adequately verified by code, CLI, HTTP, or automated browser tests.

When browser interaction is necessary, minimize context and usage: limit it to the target pages and required actions, do not browse unrelated pages, and avoid repeated views or refresh loops. Separate implementation and automated verification from browser checking; finish the code and automated checks first, then perform only the targeted browser check needed for confidence.

Do not operate Search Console, Analytics, hosting consoles, or other external admin services unless the user explicitly requests it. When required data is available only there, prefer asking the user to retrieve and share it rather than operating the console directly. Choose the lowest-cost verification method that retains the necessary confidence, and document any residual uncertainty.

## Model routing and delegation

Use **GPT-6 Astra with low reasoning** (`gpt-6-astra`, `low`) as the primary/orchestrator. Delegate simple, clearly defined work to **GPT-5.6 Luna with max reasoning** (`gpt-5.6-luna`, `max`). The project defaults are in [`.codex/config.toml`](.codex/config.toml). Changing these files does not switch an already-running session; do not claim a model/effort is active unless the session settings confirm it. Do not silently substitute another model or reasoning level.

Astra owns requirements, acceptance criteria, task decomposition, architectural decisions, ambiguous or difficult debugging, security-sensitive or high-risk changes, final review, and integration. Once these decisions make a remaining task simple and bounded, consider handing it to Luna.

Delegate to Luna only when the work is narrow, largely independent, low risk, straightforward to verify, and likely to succeed without repeated correction. Examples include mechanical edits, straightforward documentation, small implementations with fixed behavior, focused tests, and routine verification. Do not force delegation for tiny tasks or create unnecessary parallel agents; optimize for correctness and total effort rather than a delegation quota.

Reassess delegation after initial inspection, after requirements or design decisions are fixed, and before a separable implementation, documentation, or test phase. For a Luna handoff, explicitly set `model = "gpt-5.6-luna"`, `reasoning_effort = "max"`, and `fork_turns = "none"`. Supply the objective, exact file ownership, fixed decisions, non-goals, acceptance criteria, and verification commands. Keep concurrent edits in separate files.

Review the actual diff and relevant verification evidence before accepting delegated work. Rerun checks when code/environment changed, evidence is incomplete or suspicious, or an identified risk requires it; do not automatically repeat every successful check. Ask for progress or blockers before interrupting a slow but progressing agent. Bring work back to Astra if it becomes ambiguous, stalls, is misunderstood, or requires repeated corrections. Report unavailable model/tool settings honestly rather than claiming delegation occurred.

Follow [`docs/DELEGATION_WORKFLOW.md`](docs/DELEGATION_WORKFLOW.md) for the handoff and review procedure. Final change reports should briefly state the delegated scope, the primary review/verification, and any corrections.

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
