# Phase 4 T15 PutObject CLI recovery plan

This plan resumes after run `31349359200` failed in `Deploy web-only preview`.
Validation, build, and OIDC succeeded. CloudTrail proves the exact OIDC session
made only `GetCallerIdentity` and `DescribeStacks`; no object changed during the
run. AWS CLI non-writing skeleton validation proves `fileb://` is invalid for
the `put-object --body` streaming parameter and a plain absolute path is valid.

Start from the commit containing this plan on a clean
`migration/aws-s3-cloudfront` worktree. Read all migration documents, D020-D025,
all T15 plans/logs, current remote workflow, helper/CLI/tests, and security.md.
Use Node 24.18.1. Execute B01-B04 in order with coherent unsquashed commits.

## B01: exact local helper correction

Change only the `--body` value produced by `putObjectArgs` from the `fileb://`
URI to `object.path`. Strengthen pure and CLI-runner tests to prove the exact
absolute argument, no URI prefix, no shell, unchanged metadata/order/credential
contracts, and sanitized errors/reports. Build a representative web output and
run one AWS CLI `--generate-cli-skeleton output` validation against its first
object; this must make no AWS request or write.

Run focused helper/workflow tests, `npm run check`, and `git diff --check`.
Update the log and commit source/tests before an external push.

## B02: one final deployment request

Keep the exact temporary D023 push trigger. Replace the D024 comment with a
concise D025 one-time recovery comment and change nothing else in the workflow.
Run contract tests/check and commit with subject
`ci: deploy preview with corrected S3 body path`.

Re-read exact Actions settings and AWS/Hosting/data/invalidation/web baselines.
Push once. Require normal validation and exactly one new Preview web deployment
run for the exact SHA. Require ordered validation/deploy, exact OIDC identity,
58-object helper upload/readback (or the exact deterministic count produced by
that revision), sanitized match report, and raw preview E2E success. Do not
rerun or dispatch. Any failure is terminal.

## B03: external acceptance and trigger cleanup

Perform every D023/D024 acceptance check. Data-version and invalidation hashes
must remain unchanged; HostingStack must remain exact; web hashes/metadata must
match the build. Then remove the entire temporary push block/comment, restore
workflow_dispatch-only tests, run checks, commit/push, require normal validation
success, and prove no deploy run for cleanup SHA.

## B04: protection and final T15 handoff

Complete D023 G04/D024 A04: protect master using only observed validation
context, run all clarified T15F checks, update the truthful log, push final docs,
require normal validation success and zero later deploy runs, mark T15 complete,
and stop for Sol review before T16.

## Stop conditions

Stop on any helper/workflow change beyond B01/B02/B03, settings/identity/baseline
mismatch, failed final deployment, second run, unexpected object count/hash/
metadata, data or invalidation change, Hosting/IAM/Cognito/master/default-branch/
production/DNS/Firebase mutation, broader permission, or new dependency.
