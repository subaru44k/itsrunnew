# ItsRun repository instructions

## Start here

Before investigating or changing this repository, read [`docs/SITE_STRUCTURE.md`](docs/SITE_STRUCTURE.md) in full. It is the canonical overview of the application's structure, routes, data flow, infrastructure, and verification workflow.

The Git repository root contains the application in `itsrunnew/`. Run application, test, and CDK commands from that directory unless a command explicitly says otherwise.

## Model routing and delegation

Use GPT-5.6 Sol with high reasoning as the primary/orchestrator. Keep delegation selective: the goal is to route work to the model most likely to complete it correctly, not to maximize the number of subagents.

Delegation is an ongoing routing decision, not a one-time choice made from the initial request. Follow [`docs/DELEGATION_WORKFLOW.md`](docs/DELEGATION_WORKFLOW.md) for the required checkpoints, handoff contract, and review record.

Delegate to GPT-5.6 Luna with max reasoning only when the task is all of the following:

- clearly defined;
- narrow in scope;
- largely independent;
- straightforward to verify;
- unlikely to require architectural judgment; and
- likely to succeed in one pass.

Good Luna tasks include:

- locating files or references;
- mechanical refactoring;
- straightforward unit tests;
- repetitive data or mapping updates;
- documentation changes;
- bounded implementation tasks; and
- running tests and summarizing failures.

Keep work in Sol when it involves any of the following:

- architecture or design decisions;
- ambiguous requirements;
- difficult root-cause analysis or debugging;
- security-sensitive or high-risk changes;
- cross-cutting refactoring;
- hard-to-detect correctness failures; or
- work likely to require repeated review/fix cycles.

Do not classify an entire feature as non-delegable merely because its design or final integration belongs in Sol. Split off bounded implementation, test, documentation, or mechanical work after Sol has resolved the architectural and UX decisions.

### Required delegation checkpoints

Sol must reassess delegation at each of these points:

1. after the initial repository and requirements inspection;
2. after architectural, UX, SEO, or data-contract decisions make the implementation contract concrete;
3. before starting a separable implementation, test, documentation, or repetitive verification phase; and
4. whenever a previously ambiguous subtask becomes narrow and objectively verifiable.

A read-only Luna investigation does not satisfy the implementation-delegation expectation when a suitable implementation or test task becomes available later. Reuse that agent with a follow-up task when practical, or spawn a clean Luna task with the finalized contract.

For a change task with multiple deliverables, if at any checkpoint at least one remaining work item meets all Luna criteria above, delegate at least one substantive implementation, test, or documentation work item to Luna Max. A lookup-only assignment or a command-only test run does not count as substantive when a bounded code or test change is suitable. If no such delegation is made, record the concrete reason in the final report; “Sol had already started implementing” or “the overall feature was complex” is not sufficient by itself.

Do not delegate merely to reduce model cost. Optimize for total expected cost, including review and rework. If a task is likely to follow this pattern, Sol should perform the task directly:

```text
Luna implementation
→ Sol review
→ substantial correction
→ another review
```

### Subagent context

Prefer clean, minimal subagent context instead of blindly inheriting the whole conversation. For Sol-to-Luna delegation, prefer `fork_turns = "none"` and pass all task-specific context explicitly, including the objective, exact scope, relevant files, constraints, expected deliverable, and verification command or acceptance criteria.

For delegated edits, also state the decisions that are already fixed, files or responsibilities the agent must not change, and what evidence should be returned. Prefer non-overlapping file ownership when Sol and Luna work concurrently.

### Delegated-work verification

- Never accept delegated code merely because the subagent claims success.
- Prefer objective verification such as tests, type checking, linting, builds, static analysis, or deterministic output comparison.
- Review the actual diff and verification evidence before integrating delegated work.
- If a Luna task becomes unexpectedly ambiguous or complex, stop delegating it and bring the work back to Sol.
- In the final report for a change task, summarize what each model changed, what Sol verified, and any defects or corrections Sol found in delegated work. If delegated work required no correction, say so explicitly.

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
