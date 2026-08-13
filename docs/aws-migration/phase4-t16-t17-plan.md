# Phase 4 T16 operational verification and T17 legacy-removal plan

Sol planning baseline: `6bab082`

Plan date: 2026-08-09

## Entry gate and authority boundary

T16 starts only after T11-T15 are complete and accepted. It combines local
checks with protected Cognito administration, schedule mutation/rollback, and
possibly a reviewed CloudWatch alarm deployment. Each protected operation
must have an explicit target and authorization; passing local tests does not
authorize it.

T17 starts only after T16 evidence is complete. It removes tracked legacy
source from the migration branch, not the Firebase project or live rollback
service. Production DNS, Firebase Hosting, Firestore, and permanent project
deletion remain outside Phase 4.

## Inputs to collect once, before T16 protected operations

Bundle the following operator decisions into one approval request after all
local/preview prerequisites pass:

- one approved admin Cognito username/email and one authenticated non-admin
  username/email; passwords and recovery codes stay outside chat and Git;
- operator confirmation that both are named individual accounts and that only
  the approved admin may join `admins`;
- one exact schedule object/date reserved for the update-and-restore rehearsal,
  with its current ETag, VersionId, SHA-256, and validated original bytes
  captured before mutation;
- an approved maintenance window for the conditional update and restore;
- approval for the reviewed CloudWatch 5xx alarm deployment if it is not
  already present;
- named primary and rollback operators and the evidence storage location
  outside secrets.

Do not request or accept passwords, tokens, raw exports, or credentials in
chat. Prefer operator entry in Cognito Hosted UI/AWS Console where practical,
while recording only sanitized identifiers and outcomes.

## T16A: local release-candidate verification

At one immutable commit, run Node 24 clean-install, lint, typecheck, unit,
infra, build, local E2E, preview raw E2E, migration comparison verification,
and workflow contract tests. Verify:

- public routes, locale/SEO, schedules, cache headers, private S3, and unknown
  route/asset behavior;
- admin UI auth/config/storage/conditional-write/conflict tests;
- API request/authorization/validation/audit and S3 concurrency tests;
- synthesized runtime IAM, OIDC deployment IAM, CloudFront/API no-cache,
  Cognito local-only code/PKCE flow, LogGroup retention, and no delete access;
- deterministic production migration manifest/report has zero unexplained
  source/output differences;
- dependency tree contains only the architecture allowlist plus any explicitly
  temporary migration dependency scheduled for removal in T17.

Record exact commands, counts, commit, and artifact hashes. A failed or flaky
test is a stop; do not compensate with retries that hide failures.

## T16B: required CloudWatch 5xx alarm

If absent, add a stack-owned alarm for sustained administrator-path 5xx
failures before production cutover. Initial exact contract:

- metric is the reviewed HTTP API/Lambda 5xx/error metric scoped to the exact
  preview API/function;
- period 5 minutes, threshold at least one error, evaluation periods 3,
  datapoints to alarm 2, and missing data treated as not breaching;
- finite, explicit name/description and no broad dimensions;
- no SNS/email destination is inferred without an approved operator endpoint;
  during preview the named operator checks alarm state directly;
- semantic CDK assertions cover metric, dimensions, threshold, periods,
  missing-data behavior, and absence of unrelated resources.

Sol must review the exact CloudWatch execution-policy delta before any policy
version or stack deployment. Do not add dashboards, anomaly detection, SNS,
Chatbot, PagerDuty, or another dependency without a decision.

After an authorized deployment, deliberately exercise only a sanitized
non-destructive failure path if needed, observe metrics/alarm transitions with
bounded waiting, and return the alarm to OK. Do not expose or log tokens.

## T16C: real Cognito authorization verification

Using the deployed local-user Hosted UI only:

1. Confirm self sign-up remains unavailable and the `admins` group starts
   empty before approved membership is applied.
2. Create the two named users through the approved operator workflow. Force
   individual password setup/recovery outside automation logs.
3. Add only the approved admin user to `admins`; keep the non-admin out.
4. Verify Authorization Code + PKCE, exact issuer/client/scope, and memory-only
   tokens for both desktop and mobile browser contexts.
5. Prove unauthenticated requests fail, the authenticated non-admin receives a
   sanitized 403 from Lambda, and the admin can GET the designated object.
6. Inspect browser storage, URLs, console/network logs, CloudFront/API/Lambda
   logs, and generated artifacts for token/claim/body leakage.

Do not automate or commit credentials. Cognito user/group mutations and test
results are recorded with sanitized usernames or operator-controlled evidence,
not passwords, tokens, raw claims, or email contents.

## T16D: conditional update and exact rollback rehearsal

This is a protected schedule-data mutation. Before the first write:

- re-read the designated object and verify its expected ETag, VersionId,
  parser result, and SHA-256;
- preserve the exact original bytes in approved encrypted operator storage;
- verify no concurrent maintenance is in progress;
- verify the admin UI draft changes exactly one agreed cell/date and sends the
  observed strong ETag.

Execute one admin conditional update and prove:

- a new ETag/VersionId is returned only after API success;
- public CloudFront data reflects the update within the 60-second contract;
- API responses remain no-store and direct S3 remains denied;
- a stale original ETag returns 409 without a new version or content change;
- audit logs contain one allowlisted event with actor hash/version ID and no
  forbidden data.

Restore the exact original bytes as a new current S3 version using a separately
reviewed conditional operator procedure. Never delete a version or perform an
unconditional overwrite. Verify the new current object's SHA-256 equals the
pre-rehearsal original, record old/test/restored version IDs, and confirm the
public view after the cache window.

If exact restoration would require broader permission or cannot preserve the
validated original bytes, stop before the first write.

## T16E: operational and rollback evidence

Complete every manual check in `test-plan.md`:

- visual 375px/1280px and keyboard/screen-reader checks;
- admin and non-admin local Cognito flows;
- S3 privacy, CloudFront freshness, API no-cache, and production CloudFront
  domain behavior before DNS;
- Lambda/API 4xx/5xx, sanitized logs, finite retention, and required alarm;
- actual S3 version restoration evidence;
- CI workflow, OIDC trust, web-only role boundary, and failed-check gate;
- migration counts/hashes/version IDs with zero unexplained differences.

Finalize `migration-runbook.md` with actual non-secret resource identifiers,
named roles (not credentials), maintenance/rollback responsibilities, the
agreed observation window proposal, and exact verification commands. Keep the
production DNS target and Firebase state unchanged.

Commit sanitized evidence references and stop for Sol review before T17.

## T17A: immutable legacy rollback reference

Immediately before removing tracked legacy files:

1. record the exact commit containing the last intact legacy Vue/Firebase
   application;
2. perform its documented Node 14 build once, if the environment remains
   safely reproducible, and record warnings/result without changing its lock;
3. create a descriptive annotated Git tag locally only after Sol approves the
   exact name/target; pushing the tag is a separate GitHub write;
4. verify the tag/commit contains all 77 currently tracked legacy paths,
   including `itsrunnew/.firebaserc`, `firebase.json`, source, package manifests,
   and public assets.

Never include ignored local `itsrunnew/.env`, node_modules, dist, `.firebase`,
or other operator files in the tag/commit. Do not delete ignored local files
as part of tracked-source cleanup; report them for the owner to handle.

## T17B: migration-branch source and dependency removal

On `migration/aws-s3-cloudfront` only, remove all tracked files under the
legacy `itsrunnew/` application after the rollback reference is verified.
Also remove any temporary `firebase-admin` migration dependency and credential
adapter that is no longer required, while preserving sanitized migration
manifests/reports and provider-neutral comparison tooling needed for audit.

Update repository documentation and commands so the Nuxt workspaces are the
only supported application. Do not remove historical decision/current-system
documentation that explains the migration and rollback reference.

The removal commit must not:

- delete or disable the Firebase project, Hosting, Firestore, Authentication,
  custom domain, or DNS;
- remove AWS rollback versions or evidence;
- rewrite/squash history;
- merge or push directly to `master`;
- delete untracked/ignored user files automatically.

## T17C: final dependency and recovery proof

Run a clean Node 24 install and prove:

- root workspace graph contains no legacy Vue 2, Vue CLI, Vuex, direct Vue
  Router 3, class decorators, Vuetify, Bootstrap, Stylus, Moment, Firebase
  client SDK, service worker, AdSense wrapper, script loader, core-js 2, or
  Material Icons dependency;
- no tracked legacy runtime/config/source remains outside historical docs and
  sanitized migration evidence;
- public/admin functionality, infra synth, unit, E2E, preview checks, and
  migration report remain green;
- the legacy tag/commit can be checked out in a temporary worktree and contains
  the intact application without altering the active branch.

Required final commands include:

```bash
npm ci
npm run check
npm run test:e2e
PREVIEW_BASE_URL=https://d2via50thoheqm.cloudfront.net npm run test:e2e:preview
npm ls --all
git diff --check
git status --short
```

Update `implementation-log.md`, commit coherent T17 changes without squashing,
and stop for Phase 5 Sol review. Do not merge, change production DNS, disable
Firebase, or begin the observation-window retirement procedure.

## Stop conditions

Stop without guessing for missing named operators/accounts, token persistence,
real credentials in logs/chat/Git, broader Cognito or schedule permissions,
unconditional write, failed exact rollback, unexplained data mismatch, alarm
destination/new service, policy change without review, ignored user-file
deletion, production hostname/DNS, Firebase mutation/deletion, direct master
push/merge, or any incomplete T10-T16 prerequisite.
