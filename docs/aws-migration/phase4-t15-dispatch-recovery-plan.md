# Phase 4 T15 first-dispatch recovery plan

This plan resumes after GitHub rejected the single authorized API dispatch
because `deploy-preview-web.yml` is not present on default branch `master`.
Validation run `31348125949` for exact pushed SHA `9ae26b0` succeeded. No deploy
run or AWS session was created. Repository Actions settings are already
tightened and must remain unchanged.

Start from the commit containing this plan on clean
`migration/aws-s3-cloudfront`. Read all migration documents, especially D020
through D023, both prior T15 plans, implementation-log.md, both workflows and
their contract tests, and the web-only helper/tests. Use Node 24.18.1. Execute
G01 through G04 in order with coherent unsquashed commits.

## G01: temporary exact push trigger

Add a temporary `push` trigger to `.github/workflows/deploy-preview-web.yml`
with exact filters:

```text
branch: migration/aws-s3-cloudfront
path: .github/workflows/deploy-preview-web.yml
```

Retain `workflow_dispatch`. Add no other event, branch, path, input, schedule,
tag, environment, permission, secret, action, job, or command. Keep the deploy
job gated by its own validation job and keep all action SHAs and T15C contracts
unchanged. Extend deterministic workflow contract tests to prove the temporary
event is exact and every forbidden trigger/surface is absent.

Run the focused workflow/helper tests and `npm run check`, update the log, and
commit with the exact subject `ci: request one T15 preview deployment`. This
commit is the explicit one-time request.

## G02: push and execute exactly one deployment run

Before pushing, record read-only baselines for GitHub settings, remote branch,
v6/role/trust, HostingStack template/outputs, data-bucket object-version
inventory hash, and CloudFront invalidation inventory. Push the current
migration branch once. Require:

- the normal Migration validation run for the exact pushed SHA succeeds;
- exactly one Preview web deployment run is created by `push` for that SHA;
- its validation job succeeds before its deploy job;
- its deploy job assumes only the exact GitHub OIDC role;
- the helper uploads/verifies only generated preview web objects and prints a
  sanitized report;
- raw preview E2E succeeds.

Do not retry a failed run or invoke workflow_dispatch again. On failure, record
the run/job/log evidence and stop.

## G03: external acceptance and trigger cleanup

After G02 succeeds, read-only verify CloudFront web hashes/content types/cache
metadata, helper counts, exact OIDC role use, unchanged HostingStack, unchanged
data object-version inventory hash, unchanged invalidation inventory, private
S3, unknown route/asset, and no production/DNS/Firebase/Cognito mutation.

Then remove only the temporary `push` block, restoring
`deploy-preview-web.yml` to `workflow_dispatch` only. Update its contract tests
accordingly, run focused tests/check, commit, and push. Require the normal
validation workflow for the cleanup SHA to succeed and prove no Preview web
deployment run was created for that SHA. Do not remove or change any deployment
job/permission/action/helper contract.

## G04: repository protection and final T15 evidence

Derive the actual successful validation check context from the normal
validation run. Protect `master` with:

- strict required status checks containing only the observed context;
- pull requests required with one approving review and stale-review dismissal;
- administrators enforced;
- conversation resolution required;
- no actor restrictions;
- force pushes and deletions disabled.

Do not change the default branch or merge/create a PR in this milestone. Read
protection back and require exact equality. Record all run URLs/IDs/SHAs,
settings, deployment evidence, verification, cleanup/no-second-run proof, and
protection without tokens or credentials.

Run the T15F checks:

```bash
npm ci
npm run check
npm run test:e2e
npx vitest run scripts/migration/*.test.mjs
git diff --check
git status --short
```

When invoking Vitest, exclude the standalone `node:test` static file exactly as
the package script does; run that file separately with `node --test`. A single
browser-process closure may be rerun once only after confirming it made no
external write. Push the final documentation commit, require its normal
validation success, and prove it creates no deploy run. Mark T15 complete and
stop for Sol review before T16.

## Stop conditions

Stop on any repo/branch/SHA/settings/AWS baseline mismatch, broader trigger,
workflow contract change beyond G01/G03, failed deploy, second deploy run,
unexpected OIDC principal, data version/hash change, invalidation, HostingStack
change, need to merge/change master before G04 protection, production/DNS/
Firebase/Cognito mutation, new dependency, or broader GitHub/AWS permission.
