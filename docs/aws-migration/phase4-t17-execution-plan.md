# Phase 4 T17 legacy removal execution plan

Date: 2026-08-13  
Planner/reviewer: Sol  
Implementer: Luna  
Branch: `migration/aws-s3-cloudfront`  
Start commit: `afcd373`
Immutable legacy target: `5dab6ddea06fb858c642738f6b029e3d5d09365d`  
Approved local tag: `legacy-firebase-vue-final-20260813`

## Entry acceptance

Sol accepts T16 at `5dab6dd` and its implementation commits. Local checks
passed, public preview checks passed `100/100`, the real admin/non-admin proof
and conditional update/restore rehearsal passed, and the final read-only gate
proved private S3, API `no-store`, exact restored data, healthy stacks/alarm,
and zero temporary identities. Historical Firebase data is out of scope under
D041. T17 may proceed without another AWS or Firebase operation.

The exact immutable target above contains all 77 tracked paths under
`itsrunnew/`. The target was chosen before any legacy removal and does not
depend on a mutable branch name. No tag with the approved name exists at plan
time.

## T17A: local immutable recovery reference

1. Confirm exact branch/start, clean worktree, Node 24, absent approved tag,
   exact target commit, and exactly 77 tracked `itsrunnew/` paths in that target.
2. Confirm ignored local `itsrunnew/.DS_Store`, `.firebase/`, `dist/`, and
   `node_modules/` are not tracked. Never delete, clean, move, stage, inspect
   credentials from, or modify these user-owned ignored paths.
3. The host has no managed Node 14 runtime. Do not download/install a runtime,
   mutate the legacy lock, or run the legacy build under unsupported Node 24.
   Record the build as not rerun for that reason; the historical baseline and
   exact source/lock remain at the immutable target.
4. Create the annotated tag locally only:

   ```bash
   git tag -a legacy-firebase-vue-final-20260813 \
     5dab6ddea06fb858c642738f6b029e3d5d09365d \
     -m "Final intact legacy Vue 2/Firebase source before T17 removal"
   ```

5. Verify the tag peels to the exact target and exposes all 77 legacy paths.
   Do not push the tag.

Record T17A evidence in `implementation-log.md` and commit documentation without
squashing.

## T17B: remove tracked legacy and migration-only code

On this branch only, remove all 77 tracked paths under `itsrunnew/`. A tracked
file named `itsrunnew/.env` contains only locale defaults and is included in
the historical tag; remove it with the other tracked legacy files. Do not touch
ignored files that remain physically under that directory.

Remove the obsolete legacy-browser surface:

- `tests/e2e/legacy-public-routes.spec.ts`;
- `playwright.config.mjs`;
- `scripts/migration/capture-browser-baseline.mjs` and
  `capture-public-baseline.mjs`;
- the root `baseline:browser` script;
- change root `test:e2e` to run the maintained local admin production-build
  suite only. The CloudFront public suite remains `test:e2e:preview`.

Remove migration-only Firestore runtime/tooling:

- exact-pinned root `firebase-admin` and its lockfile graph;
- `packages/core/src/firestoreSnapshot.ts` and its public export;
- `scripts/migration/export-firestore*`, `firestore-snapshot.test.mjs`,
  `firestore-transform*`, `firestore-compare*`, `firestore-upload*`, and the
  synthetic Firestore fixture.

Remove the completed T16 temporary live executables/coordinators and tests:

- all tracked `scripts/migration/t16-*` files.

Preserve provider-neutral/current-stack tooling, the sanitized baseline JSON,
all migration decisions/plans/log evidence, AWS deployment helpers, preview
seed/verification, generated SEO verification, admin build/server helpers, and
workflow contract tests.

Update `docs/aws-migration/README.md`, `implementation-log.md`, and directly
affected documentation so the Nuxt workspaces are the supported application,
the Firebase project remains externally unchanged for rollback, historical
source is recovered from the exact local tag/commit, and D041 supersedes old
Firestore execution instructions. Do not rewrite historical decisions or log
entries.

Commit coherent dependency/tooling removal and documentation changes without
squashing.

## T17C: clean graph and recovery proof

Run Node 24:

```bash
npm ci
npm run check
npm run test:e2e
PREVIEW_BASE_URL=https://d2via50thoheqm.cloudfront.net npm run test:e2e:preview
npm ls --all
git diff --check
git status --short
```

Add a deterministic tracked-source/dependency check (within the existing
structure checker or a dependency-free script) which fails if:

- a tracked path remains under `itsrunnew/`;
- root/workspace manifests directly declare the T17 removal-list packages;
- active source/config outside historical `docs/aws-migration/` mentions the
  removed Firebase runtime, Firestore adapter/tooling, or legacy Vue 2 app;
- the root lock contains the removed `firebase-admin` package graph.

Nuxt's current transitive Vue Router/core-js/Stylus compatibility packages do
not constitute a forbidden direct legacy dependency; report the exact
dependency paths from `npm ls` rather than deleting required Nuxt transitive
dependencies.

Create a temporary worktree using `mktemp -d` and the local tag. Verify its
peeled target and exact 77 tracked `itsrunnew/` paths, including `.firebaserc`,
`firebase.json`, manifests, public assets, and source. Remove only that exact
temporary worktree through `git worktree remove`; do not touch the active tree
or ignored legacy directory. If safe cleanup fails, stop and report the path.

Update the T17 table/log with exact commits, tests, dependency findings,
recovery proof, and ignored paths left in place. Leave a clean worktree and
stop for Phase 5 Sol review.

## Prohibited operations and stop conditions

No AWS operation, Firebase access/change/deletion, production DNS/hostname,
GitHub write, tag push, branch push, merge, history rewrite, ignored-file
deletion, new dependency, deployment, invalidation, Cognito administration,
S3/data mutation, IAM, or CloudFormation operation is authorized.

Stop without guessing if the tag name exists at another target, the exact
target lacks any of the 77 paths, removal reaches ignored/user files, a current
runtime requires a removed direct dependency, tests reveal behavior loss, the
temporary worktree cannot prove recovery, or completion requires any prohibited
operation.
