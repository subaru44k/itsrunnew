# Phase 4 T15 selected-action recovery plan

This plan resumes from the D023 `startup_failure` at run `31348799391`. That
run has exact SHA `8068f85`, event `push`, conclusion `startup_failure`, zero
jobs, zero logs, and no AWS session/write. Normal validation run `31348798987`
for the same SHA succeeded. The temporary exact push trigger remains on the
remote migration branch; master is unchanged and unprotected.

Start from the commit containing this plan on clean
`migration/aws-s3-cloudfront`. Read all migration documents, D020-D024, both
T15 recovery plans/logs, workflows/tests, and helper/tests. Use Node 24.18.1.
Execute A01-A04 in order with coherent unsquashed commits.

## A01: exact repository policy correction

Read back and require the current selected-action setting to be exactly the
known nonmatching value `aws-actions/configure-aws-credentials`, with all other
settings matching D023. Change only `patterns_allowed` to:

```text
aws-actions/configure-aws-credentials@00943011d9042930efac3dcd3a170e4273319bc8
```

Read back exact equality. Do not change the workflow, push, or call AWS in this
milestone. Record the before/after and commit evidence.

## A02: explicit recovery request and one run

Preserve the exact D023 temporary push trigger and every T15C workflow contract.
Add only a concise YAML comment identifying D024's one-time recovery request,
and extend/retain tests proving no semantic trigger/job/permission change.
Run focused tests and `npm run check`, update the log, and commit with subject
`ci: retry T15 preview after action policy fix`.

Refresh GitHub/AWS/Hosting/data-version/invalidation read-only baselines, then
push once. Require the normal validation run and exactly one new Preview web
deployment run for the exact SHA. The deployment run must create jobs, pass
validation before deploy, assume only the exact OIDC role, complete helper web
upload/readback, print only a sanitized report, and pass raw preview E2E. Do
not use rerun or workflow_dispatch. On any failure, record and stop permanently.

## A03: acceptance and trigger cleanup

After success, perform all D023 G03 external read-only acceptance checks. Then
remove the entire temporary push block and recovery comment, restore
workflow_dispatch-only contract tests, run focused checks, commit, and push.
Require normal validation success and prove no deployment run for cleanup SHA.

## A04: protection and T15 finalization

Complete D023 G04 exactly: protect master using the observed normal validation
context, run every clarified T15F local check, record exact run/settings/AWS/
object/protection evidence, commit and push final documentation, require normal
validation success, and prove no further deployment run. Mark T15 complete and
stop for Sol review before T16.

## Stop conditions

Stop on any settings mismatch beyond the single pattern, wildcard/tag/extra
action, failed second deployment run, unexpected job/action/principal, data or
invalidation change, HostingStack mutation, master/default-branch change before
protection, broader trigger/permission, production/DNS/Firebase/Cognito change,
or new dependency. Never rerun or dispatch the failed workflow.
