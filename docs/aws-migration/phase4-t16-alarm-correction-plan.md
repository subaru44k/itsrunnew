# Phase 4 T16 alarm final correction

Sol review date: 2026-08-10

Start from the committed Sol review plan on `migration/aws-s3-cloudfront`,
clean, using Node `v24.18.1`. The T16B deployment is functionally correct, but
the synthesized and deployed alarm omitted D026's required explicit preview
description. This plan authorizes only that correction.

## AC01: local description contract

Set `AlarmDescription` to exactly:

```text
Preview administrator HTTP API sustained 5xx alarm; operator-observed with no notification actions.
```

Extend the semantic infra assertion to require this exact value. Retain every
other D026 property and absence assertion. No other source, policy, dependency,
resource, output, tag, action, or test contract may change.

Run infra tests/synth, root check, and `git diff --check`; update the
implementation log and commit coherently.

## AC02: exact preflight and correction deployment

Before any write, use only `AWS_PROFILE=codex-prod`, account `470447451992`,
region `ap-northeast-1`, and repeat STS. Prove:

- policy v7 remains default, v3-v7 remain retained, and AWS v7 exactly equals
  the committed candidate SHA-256;
- Hosting is `UPDATE_COMPLETE` and the current alarm equals D026 except that
  `AlarmDescription` is absent;
- GitHub stack/OIDC/runtime role and data/invalidation inventories are unchanged;
- fresh synth and template validation pass;
- `cdk diff --no-change-set` contains only `AdminApi5xxAlarm.AlarmDescription`.

Then deploy only `ItsRunPreviewHosting` exactly once with
`--require-approval never`. Read the alarm back and prove the exact description,
all prior metric fields, empty action arrays, and OK/healthy state. Re-run raw
preview E2E, API no-store, direct-S3 denial, inventory hashes, `git diff
--check`, and clean-worktree checks. Update the log and commit.

No policy version, IAM, object upload, schedule/data write, invalidation,
Cognito administration, GitHub write, production/DNS, Firebase, or T16C/T17
operation is authorized. Stop without retry for any different diff, policy or
baseline mismatch, permission denial, stack failure, or test failure.
