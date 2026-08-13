# Phase 4 T16 execution plan

Sol plan date: 2026-08-10

Authority: the user authorized continued work through the migration goal and
AWS writes within the documented preview migration boundary. D026 is the
primary IAM and deployment authorization for the single alarm in this plan.
Production DNS, Firebase state, non-preview resources, unconditional data
writes, deletion of S3 versions, and credentials in logs remain prohibited.

## Entry contract

- branch: `migration/aws-s3-cloudfront`
- start from the committed Sol plan with a clean worktree
- Node `v24.18.1`; do not use the shell's older default Node
- AWS writes use only `AWS_PROFILE=codex-prod`, account `470447451992`, region
  `ap-northeast-1`; run STS immediately before every write group
- read all `docs/aws-migration/` files and preserve chronological history
- commit each milestone coherently without squashing

## T16A: immutable local and preview release-candidate verification

At one exact commit, run the complete existing release-candidate contract:

```text
npm ci
npm run check
npm run test:e2e
PREVIEW_BASE_URL=https://d2via50thoheqm.cloudfront.net npm run test:e2e:preview
npm ls --all
git diff --check
```

Also run focused migration comparison, workflow/helper, bootstrap-policy,
infra synth, core/API/web unit, and admin authentication/storage tests not
already exposed by `npm run check`. Verify the production migration report is
unchanged with zero unexplained differences, the data and invalidation
inventories have their T15 hashes, and the preview is still private at S3 and
healthy through CloudFront. A test assertion failure is a stop; do not add a
retry or weaken a contract to pass it. Record commands, counts, commit, hashes,
and dependency exceptions in `implementation-log.md` and commit T16A evidence.

## T16B01: local alarm source and semantic assertions

Add one `aws-cdk-lib/aws-cloudwatch` metric/alarm to `HostingStack` following
D026. Prefer L2 constructs but assert the final `AWS::CloudWatch::Alarm`
template exactly:

- `AlarmName`: `itsrun-preview-admin-api-5xx`
- `Namespace`: `AWS/ApiGateway`; `MetricName`: `5xx`; `Statistic`: `Sum`
- dimensions are exactly `ApiId=<AdminApi Ref>` and `Stage=$default`
- `Period`: 300; `Threshold`: 1; `EvaluationPeriods`: 3;
  `DatapointsToAlarm`: 2; `ComparisonOperator` is greater/equal
- `TreatMissingData`: `notBreaching`
- no Alarm/OK/InsufficientData actions, tags, SNS, dashboard, anomaly detector,
  or detailed route metrics

Retain every existing T11-T15 semantic assertion. Run infra tests/synth, root
check, and `git diff --check`; update the log and commit.

## T16B02: candidate v7 least-privilege policy

Implement D026 in `infra/bootstrap/cloudformation-execution-policy.json` and
its deterministic test. Tests must reconstruct committed v6, prove the three
and only three v6-to-v7 changes, reject tag/action/resource/service wildcards,
prove the exact alarm ARN, and assert the non-whitespace size is at most 6,144.
Do not change the deployment principal or attach another managed policy.

Run the focused policy test, infra tests/synth, root check, JSON parse, and
`git diff --check`; update the log and commit. No AWS write occurs before T16A,
T16B01, and T16B02 are all green.

## T16B03: primary-policy and stack preflight

Using read-only calls only:

1. prove STS account/region exact;
2. prove v6 is default and AWS v6 equals its committed source;
3. prove v2 is nondefault and equals commit `22d7fd5`, including D026's
   canonical SHA-256;
4. prove versions are exactly v2-v6 and the exact alarm is absent;
5. prove Hosting and GitHub stacks, OIDC provider, role, web/data inventories,
   and invalidation history match the T15 accepted baseline;
6. fresh synth, `cloudformation validate-template`, `cdk diff --no-change-set`,
   and inspect the template delta: only the exact alarm is added;
7. simulate the candidate actions/resources for the execution role and stop on
   any implicit or explicit deny.

Record sanitized evidence and commit. Do not print raw CloudTrail events,
credentials, tokens, or environment dumps.

## T16B04: policy v7 rotation

After repeating STS and all mutable gates, perform only:

1. delete verified nondefault v2;
2. create one managed-policy version from the committed candidate with
   `--set-as-default`;
3. read back v7 and prove byte-semantic equality;
4. prove exactly v3-v7 are retained and v7 is default;
5. re-run simulation.

If any comparison changes, no write is allowed. If creation fails after v2
deletion, do not improvise; preserve v6 as default and record the exact error.

## T16B05: one Hosting deployment and alarm verification

After STS and exact v7 gates, deploy only `ItsRunPreviewHosting` once with Node
24 and `--require-approval never`. Expected change: creation of the exact alarm
only. Stop on any other proposed resource mutation or any permission denial.

Read back the CloudFormation stack and alarm. Verify every D026 property,
empty action arrays, and initial/settled state without `SetAlarmState` or
deliberately generating failures. Re-run preview E2E, API no-store/direct-S3
checks, data/invalidation inventory hashes, and confirm both stacks and GitHub
OIDC/runtime role are otherwise unchanged. Update the log and commit.

## T16C-D continuation boundary

After T16B acceptance, Sol will select a non-secret preview-only account and
rollback procedure consistent with `phase4-t16-t17-plan.md`. Never place
passwords, access/ID tokens, authorization codes, raw claims, original schedule
bytes, or emails in Git/chat/logs. The schedule rehearsal must use conditional
writes and exact byte restoration; if that cannot be proven before mutation,
stop without writing.

## Stop conditions

Stop and return to Sol for any test failure requiring contract weakening,
unexplained migration/data/hash drift, v6/v2 mismatch, policy size overflow,
permission not in D026, template delta beyond the exact alarm, AWS account or
region mismatch, need for alarm actions/destinations/tags, stack failure,
credential exposure, unconditional write, delete permission, production/DNS or
Firebase mutation, or non-preview impact.
