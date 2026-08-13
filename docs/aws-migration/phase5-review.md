# Phase 5 Sol review

Date: 2026-08-13  
Reviewer/planner: Sol  
Reviewed commit: `5e6b476`

## Review scope and accepted evidence

Sol reviewed the full diff from planning baseline `d6de55e`, decisions D001-
D041, dependency graph, CDK source/assertions/synthesized contracts, Lambda and
browser authorization boundaries, cache/routing/security headers, T15 CI/OIDC
evidence, T16 real authorization and rollback evidence, T17 removals, local
tag recovery, and worktree state.

Sol independently reran:

- `npm run check`: passed (web 92, core 7, schedule API 25, infra 19, builds);
- `npm run test:e2e`: passed 48/48 maintained admin production-build tests;
- raw CloudFront preview E2E: passed 100/100;
- `git diff --check`: passed;
- removal/dependency/recovery inspections: passed.

The reviewed runtime has private OAC S3 origins, versioned data, bounded
conditional writes, no Lambda delete/list/broad S3 access, API/CloudFront
`no-store`, local Cognito users with code + PKCE, memory-only user/token store,
independent API Gateway and Lambda admin/scope/access-token checks, sanitized
bounded logs/errors, finite log retention, actionless 5xx alarm, web-only OIDC
deployment role, and no public-web AWS SDK. Historical Firebase data is
intentionally out of scope under D041. Production DNS and Firebase resources
remain unchanged.

T17 removes the tracked Vue 2/Firebase application and direct removal-list
dependencies. The exact intact 77-path source remains recoverable at local tag
`legacy-firebase-vue-final-20260813`, peeling to
`5dab6ddea06fb858c642738f6b029e3d5d09365d`. Ignored local legacy build/cache
paths remain user-owned and untouched.

## P5R01: enforce provider isolation layout

`architecture.md` requires AWS-specific schedule service code under
`services/schedule-api/src/aws/`, but `s3-store.ts` is currently in `src/`.
Move it to `src/aws/s3-store.ts` without changing runtime behavior. Update
production/test imports and keep all adapter tests, exact SDK input tests,
bounded-stream tests, `maxAttempts: 1`, and runtime IAM assertions green. Do
not alter API/data contracts, dependencies, or infrastructure.

## P5R02: validate the actual final PR target

`.github/workflows/validate-migration.yml` currently runs on PRs targeting the
migration branch. The final PR targets `master`; change only the
`pull_request.branches` entry to `master`. Keep the push trigger restricted to
`migration/aws-s3-cloudfront`, permissions read-only, SHA-pinned actions,
Node/npm pins, checks, Chromium install, and maintained E2E.

Update `scripts/migration/workflow-contract.test.mjs` to require the exact
final trigger split and retain all security assertions. Update README status,
T17's table commit list (including `5e6b476`), and implementation log. Preserve
historical records.

## Required checks

```bash
npm ci
npm run check
npm run test:e2e
PREVIEW_BASE_URL=https://d2via50thoheqm.cloudfront.net npm run test:e2e:preview
npm ls --all
git diff --check
git status --short
```

Commit coherent corrections without squashing and stop for final Sol
acceptance. No AWS/Firebase/GitHub operation, deployment, invalidation, IAM,
CloudFormation, production/DNS, dependency, legacy-tag change, or ignored-file
operation is authorized.

## Provisional result

`go with listed conditions`:

1. P5R01-P5R02 and final checks must pass.
2. Publishing the branch and obtaining a successful GitHub validation run are
   required before merge.
3. Production cutover is not authorized by this technical approval. A
   production hostname/certificate/DNS target, callback/logout URLs, named
   operator accounts, observation-window start, and rollback operator must be
   confirmed before production DNS changes. Firebase retirement/deletion is a
   later separately authorized destructive operation.

## Final local correction result

P5R01/P5R02 passed locally. The S3 adapter now resides at
`services/schedule-api/src/aws/s3-store.ts` with unchanged runtime behavior and
updated production/test imports (`b87f421`). Validation pull requests target
`master`, while push validation remains restricted to
`migration/aws-s3-cloudfront`; the workflow contract test enforces the split.
The required local checks and public preview checks passed, with no external
operation.

## Final result

Sol accepts P5R01/P5R02 and the complete local migration. Result: `go` for
publishing `migration/aws-s3-cloudfront`, running GitHub validation, and opening
a review PR; `go with listed conditions` for production cutover. The remaining
cutover conditions are the production origin/certificate/DNS decision,
origin-specific Cognito and site configuration, named operators, a final
production-candidate release gate, and explicit observation-window start.
Firebase stays unchanged for rollback and is not approved for retirement or
deletion.

## Dependency security refresh stop

The approved S01 versions were applied in `6d04e04`, but the required
`npm audit --omit=dev` gate still reports two high vulnerabilities: `js-yaml`
4.0.0–4.3.0 and CDK-bundled `brace-expansion` 4.0.0–5.0.8. The generic audit
fix is outside the bounded plan, so S02 regression was not started and no
dependency widening was attempted. Final Phase 5 acceptance is blocked pending
an explicitly approved remediation.

## S03 dependency correction stop

S03 refreshed `js-yaml` to 4.3.1 and deduped `brace-expansion` to 5.0.9 in
`ac63aad`, but `npm audit --omit=dev` still reports one high vulnerability at
the bundled `node_modules/aws-cdk-lib/node_modules/brace-expansion` 5.0.8.
Targeted lock-only npm updates cannot rewrite that bundled package within the
approved scope. The full regression gate is stopped pending an approved
remediation; no widening or external operation occurred.
