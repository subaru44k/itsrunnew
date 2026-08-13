# Phase 4 T11/T12 third deployment recovery plan

Sol review target: `dc3cdf2`

Review date: 2026-08-09

## Verified failure and AWS state

Sol independently confirmed with `AWS_PROFILE=codex-prod`, account
`470447451992`, and region `ap-northeast-1`:

- SR03 deleted only the authorized empty User Pool and empty schedule LogGroup;
- SR04 made exactly one deploy attempt with change set
  `36215b20-003a-4c35-a794-b7aa93c03d07`;
- both Lambda permission resources failed CloudFormation property validation at
  `2026-08-09T00:33:50Z` because `SourceArn` did not satisfy its pattern;
- the synthesized GET and PUT joins omit `AWS::AccountId` and the delimiter
  before the API Ref;
- the stack is `UPDATE_ROLLBACK_COMPLETE`, the four baseline hosting outputs
  are unchanged, and `itsrun-preview-schedule-api` is absent;
- retained User Pool `ap-northeast-1_U6JenEvrT`, created
  `2026-08-09T00:33:10.231Z`, is ACTIVE, exactly stack-tagged, and has zero
  users, clients, groups, resource servers, identity providers, and domain;
- retained LogGroup `/aws/lambda/itsrun-preview-schedule-api`, creation
  `1786235590805`, is exactly stack-tagged with 30-day retention, zero streams,
  and zero stored bytes.

No IAM/policy/bootstrap change, second deploy, invalidation, data upload,
Cognito administration, production, DNS, or Firebase mutation occurred.

## TR01: exact SourceArn correction

Local-only; no AWS call or dependency change.

1. Add `Aws.ACCOUNT_ID` and the required following colon to the GET and PUT
   execute-api `SourceArn` joins in `infra/bin/app.mjs`.
2. Keep separate exact permissions for `$default`, GET/PUT, and
   `/api/v1/stadiums/*/availability/*`.
3. Do not change integration URI, routes, authorizer, Lambda, runtime IAM,
   CloudFront, Cognito, or any unrelated resource.

## TR02: semantic and resolved-ARN assertions

Update `infra/test/stack.test.mjs` without generated logical-ID hardcoding:

- assert both complete joins contain partition, region, `AWS::AccountId`, exact
  API Ref, `$default`, exact method, and exact path in order;
- deterministically substitute example partition/region/account/API values and
  assert the two fully resolved strings exactly equal valid documented
  execute-api ARNs;
- assert there are exactly two permissions and retain exact principal, action,
  FunctionName Ref, API route, integration, JWT, runtime IAM, and every prior
  T11/T12 contract.

Update `implementation-log.md`, run Node 24 checks, and commit coherent changes:

```bash
npm run test:infra --workspace @itsrun/infra
npm run build --workspace @itsrun/infra
npm run check
git diff --check
git status --short
```

Stop for Sol review before AWS calls.

## TR03: Sol template, policy, and service validation

Sol independently verifies the functional template diff is limited to the two
account-qualified SourceArns, Lambda ZIP is unchanged, policy v4 is still exact
and sufficient, tests pass, and the worktree is clean. Validate the corrected
template with CloudFormation and record hashes. No AWS write.

## TR04: exact leftover cleanup

Protected AWS writes; require a fresh bundled authorization. Immediately before
mutation, repeat STS/stack/output/Lambda checks and both complete exact-resource
gates recorded above. On a complete match only:

1. set deletion protection INACTIVE on only pool
   `ap-northeast-1_U6JenEvrT`;
2. repeat the pool gate, delete that exact pool, and verify not found;
3. delete only exact empty LogGroup
   `/aws/lambda/itsrun-preview-schedule-api` and verify absence.

Any mismatch stops without further mutation.

## TR05: exactly one corrected deploy

After TR04 succeeds, reverify policy v4 default/exact with v1-v3 retained,
stack terminal/baseline state, STS/account/region, and Node 24. Use the existing
bootstrap and reviewed parameter defaults for exactly one
`cdk deploy ItsRunPreviewHosting --require-approval never`. No retry, policy v5,
IAM change, upload, invalidation, user/group operation, or unrelated change.

## TR06: full SR05/RC06 acceptance verification

After a successful TR05, run all P4D05/RC06 read-only resource, runtime IAM,
API/Cognito, public-preview, cache/security, private-S3, output, and
no-unapproved-mutation checks. Update the implementation log, commit, and stop
for Sol acceptance before T13.

## Stop conditions

Stop for a resource-gate mismatch, nonterminal stack, new dependency, policy v5
or broader IAM, template change beyond the two permission ARNs, bootstrap,
second deploy attempt, Cognito user/group mutation, web/data upload,
invalidation, non-preview resource, production/DNS, or Firebase change.
