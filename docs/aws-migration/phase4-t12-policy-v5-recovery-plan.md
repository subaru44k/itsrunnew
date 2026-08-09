# Phase 4 T11/T12 policy-v5 recovery plan

Sol review target: `ca625da`

Review date: 2026-08-09

## Verified denial and AWS state

Sol independently confirmed with `AWS_PROFILE=codex-prod`, account
`470447451992`, and region `ap-northeast-1`:

- TR04 deleted only the authorized empty User Pool and empty LogGroup;
- TR05 made exactly one deployment attempt with change set
  `18bb8a48-e20b-464d-a8e1-bbea26dbe924`;
- `AdminApiDefaultStage` failed at `2026-08-09T02:31:43.657Z` because execution
  role session `AWSCloudFormation` was denied `apigateway:TagResource` on
  `arn:aws:apigateway:ap-northeast-1::/apis/n8ubvb3mm6/stages`, request ID
  `b2cb6489-7135-4019-b6c5-982f68a16b70`;
- policy v4 is still default; its `PreviewHttpApi` has only GET/POST/PUT/PATCH/
  DELETE on `/apis` and `/apis/*` and no `TagResource` action;
- the stack is `UPDATE_ROLLBACK_COMPLETE`, baseline outputs are unchanged, and
  fixed Lambda `itsrun-preview-schedule-api` is absent;
- retained pool `ap-northeast-1_FW2mvosLh`, created
  `2026-08-09T02:30:58.193Z`, is ACTIVE, exactly stack-tagged, and has zero
  users, clients, groups, resource servers, identity providers, and domain;
- retained LogGroup `/aws/lambda/itsrun-preview-schedule-api`, creation
  `1786242658768`, is exactly stack-tagged, has 30-day retention, zero streams,
  and zero stored bytes.

No IAM/policy change, retry, bootstrap, invalidation, upload, Cognito
administration, production, DNS, or Firebase mutation occurred.

## V501: exact local policy-v5 candidate

Local-only; no AWS call or dependency change.

Add exactly one statement to
`infra/bootstrap/cloudformation-execution-policy.json`:

```json
{
  "Sid": "PreviewHttpApiStageTags",
  "Effect": "Allow",
  "Action": "apigateway:TagResource",
  "Resource": "arn:aws:apigateway:ap-northeast-1::/apis/*/stages"
}
```

Do not modify any v4 statement or add another action/resource.

## V502: deterministic policy tests

Update the focused policy tests so the committed v4 contract remains explicit
and candidate v5 must differ only by `PreviewHttpApiStageTags`. Prove:

- exact Sid/effect/action/resource;
- no `UntagResource`, stage descendant wildcard, additional API action, wildcard
  action/resource, service, account, or region;
- all v4 statements remain byte-semantically identical;
- existing forbidden privilege checks remain at least as strict.

Update `implementation-log.md`, run Node 24 focused infra tests, full infra
synth, root check, JSON parse, `git diff --check`, and commit coherent changes.
Stop for Sol review without AWS calls.

## V503: Sol minimum-IAM review

Sol independently compares the candidate with AWS/default v4, confirms the only
delta is the exact statement, runs policy simulation for the observed action
and resource plus negative near-matches, reruns tests, and verifies a clean
worktree. No AWS write.

## V504: create and verify policy v5

Protected IAM write; requires fresh bundled authorization. Reverify STS,
account, region, policy default v4, all v1-v4 retained, and exact AWS-v4/local
baseline. Create exactly one managed-policy version from the committed
candidate using `--set-as-default`. Do not delete v1-v4. Read v5 back and require
exact equality; require its v4 delta to be only the reviewed statement. Stop on
any mismatch.

## V505: exact failed-deploy leftover cleanup

After V504 succeeds, repeat complete stack/output/Lambda and exact resource
gates. On complete matches only, disable protection and delete exact pool
`ap-northeast-1_FW2mvosLh`, then delete exact empty LogGroup
`/aws/lambda/itsrun-preview-schedule-api`; verify both absent.

## V506: exactly one corrected deployment

After V505 succeeds, reverify v5/default/exact, stack baseline, STS, Node 24,
assets, and existing bootstrap. Run exactly one reviewed
`cdk deploy ItsRunPreviewHosting --require-approval never`. No retry or other
AWS write.

## V507: full acceptance verification

After successful V506, run every P4D05/RC06/SR05/TR06 read-only resource,
runtime IAM, API/Cognito, public preview, cache/security, private-S3, output,
and no-unapproved-mutation check. Update the log, commit, and stop for Sol
acceptance before T13.

## Stop conditions

Stop for any policy delta beyond the exact statement, v1-v4 loss, another IAM
denial, resource-gate mismatch, nonterminal stack, new dependency, bootstrap,
second deploy attempt, Cognito user/group mutation, data/web upload,
invalidation, non-preview resource, production/DNS, or Firebase change.
