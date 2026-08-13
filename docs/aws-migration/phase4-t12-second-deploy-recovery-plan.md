# Phase 4 T11/T12 second deployment recovery plan

Sol review target: `9dd84d8`

Review date: 2026-08-09

## Verified failure and rollback state

Sol independently verified with `AWS_PROFILE=codex-prod`, account
`470447451992`, and region `ap-northeast-1`:

- RC04 deleted only the previously authorized empty User Pool
  `ap-northeast-1_M39i3BFEu`;
- RC05 made exactly one deploy attempt and stopped when
  `ScheduleApiFunctionA177D4FE` was denied `lambda:CreateFunction` for generated
  name `ItsRunPreviewHosting-ScheduleApiFunctionA177D4FE-SMCxODhObRRy`;
- policy v4 permits lifecycle operations only on the intended fixed name
  `itsrun-preview-schedule-api`;
- the generated Lambda does not exist;
- CloudFormation completed rollback without intervention and the stack is
  `UPDATE_ROLLBACK_COMPLETE`, with the four baseline outputs unchanged;
- the restored stack resource list contains only the original Phase 2 hosting
  resources;
- a new retained User Pool `ap-northeast-1_CWmMgPepN` is deletion-protected,
  stack-tagged, and has zero users, clients, groups, resource servers, identity
  providers, and domain;
- retained LogGroup `/aws/lambda/itsrun-preview-schedule-api` has the exact
  stack/logical tags, 30-day retention, zero log streams, and zero stored bytes.

No rollback continuation, IAM change, policy v5, second deploy, user/group,
schedule-data, invalidation, production, DNS, or Firebase mutation occurred.

## SR01: local stable-name correction

Local-only; no AWS call or new dependency.

1. Set `functionName: 'itsrun-preview-schedule-api'` on the existing schedule
   `NodejsFunction`.
2. Strengthen the existing semantic Lambda assertion to require exact
   `FunctionName` while preserving every T11/T12 contract.
3. Update `implementation-log.md` with the actual RC04/RC05 commit and the
   independently verified terminal rollback state.
4. Run Node 24 checks:

```bash
npm run test:infra --workspace @itsrun/infra
npm run build --workspace @itsrun/infra
npm run check
git diff --check
git status --short
```

Commit coherent source/test/log changes and stop for Sol review. Do not call
AWS.

## SR02: Sol template and policy review

Sol must independently verify:

- the synth diff is limited to the exact Lambda `FunctionName` and expected
  deterministic template/CDK metadata changes;
- the Lambda ZIP is unchanged;
- policy v4 exactly covers the named Lambda, LogGroup, and corrected resource
  graph, and policy v5 is unnecessary;
- all required tests pass and the worktree is clean.

## SR03: exact failed-deploy leftover cleanup

Protected AWS writes; require a new explicit bundled authorization.

Immediately before cleanup, verify STS/account/region, stack terminal state,
and both exact resources.

The User Pool must exactly match:

- ID `ap-northeast-1_CWmMgPepN`;
- name `itsrun-preview-admins`;
- creation time `2026-08-09T00:04:46.452Z`;
- deletion protection `ACTIVE`;
- exact stack ID/name and logical ID `AdminUserPoolD0AF18CF` tags;
- zero users, clients, groups, resource servers, identity providers, and
  domain.

If it matches, set deletion protection `INACTIVE`, re-read the complete gate,
delete only that pool, and verify `ResourceNotFoundException`.

The LogGroup must exactly match:

- name `/aws/lambda/itsrun-preview-schedule-api`;
- creation time `1786233887054` milliseconds since epoch;
- retention 30 days;
- exact stack ID/name and logical ID `ScheduleApiLogGroup39875F52` tags;
- zero streams and zero stored bytes.

If it matches, delete only that LogGroup and verify it no longer exists. If
either resource differs, mutate neither further and stop.

## SR04: exactly one corrected deploy retry

After SR03 succeeds:

1. verify policy v4 remains default/exact with v1-v3 retained;
2. verify stack `UPDATE_ROLLBACK_COMPLETE` and baseline outputs;
3. verify STS/account/region and Node 24;
4. use the existing bootstrap and run exactly one corrected
   `cdk deploy ItsRunPreviewHosting --require-approval never` with reviewed
   parameter defaults.

Do not create policy v5, broaden IAM, upload web/data objects, invalidate
CloudFront, create users/group membership, or change production, DNS, or
Firebase. On any denial or unexpected resource contract, record exact evidence
and stop without retry.

## SR05: full RC06 verification

Run every read-only post-deployment check from P4D05/RC06: deployed
Cognito/API/Lambda/resource graph, empty admins group/users, runtime IAM,
CloudFront/API cache and response contracts, unauthenticated denial, public
preview E2E, private S3, outputs, and absence of invalidation/data/production/
Firebase mutation. Update `implementation-log.md`, commit, and stop for Sol
acceptance before T13 or Cognito administration.

## Stop conditions

Stop without guessing for a non-empty/differently tagged leftover, nonterminal
stack, policy v5, broader IAM, new dependency, bootstrap rerun, second deploy
attempt, Cognito user/group mutation, schedule/web/data upload, invalidation,
non-preview resource, production/DNS, or Firebase change.
