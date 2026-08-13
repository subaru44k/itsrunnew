# Phase 4 T11/T12 first deployment plan

Sol review target: `742b4d1`

Review date: 2026-08-09

## Outcome and authority boundary

The local T11/T12 implementation is approved. The first preview deployment
must use one reviewed managed-policy v4 and the existing standard CDK bootstrap.
This plan covers only account `470447451992`, region `ap-northeast-1`, profile
`codex-prod`, and stack `ItsRunPreviewHosting`.

The user may approve policy-v4 creation, Lambda file-asset publishing, and the
single CDK stack update as one bundled preview operation. That approval does
not include Cognito user creation, admins-group membership, schedule writes,
production resources, DNS, Firebase, invalidation, T13, or policy v5.

## Reviewed policy-v4 delta

The candidate in `infra/bootstrap/cloudformation-execution-policy.json` keeps
all v3 statements and adds only the services and resources in the synthesized
T11/T12 graph:

- the explicit CloudFront OriginRequestPolicy create/read/update/delete/list
  actions required by the stack-owned API policy;
- Cognito User Pool, public app client, resource server, group, and Cognito
  domain lifecycle actions; no Identity Pool, external IdP, administrator-user,
  or credential actions;
- API Gateway Management V2 GET/POST/PUT/PATCH/DELETE on this region's `/apis`
  collection and descendants;
- Lambda lifecycle and resource-policy actions on only
  `itsrun-preview-schedule-api`, plus the provider's account-level list call;
- IAM lifecycle actions on only the CloudFormation-generated
  `ItsRunPreviewHosting-ScheduleApiRole*`, and PassRole only to Lambda;
- LogGroup lifecycle/retention/tag actions on only
  `/aws/lambda/itsrun-preview-schedule-api`, plus the provider's account-level
  DescribeLogGroups call;
- GetObject/GetObjectVersion on only the standard bootstrap file-asset bucket
  so CloudFormation can consume the bundled Lambda artifact.

The candidate has no `Action: "*"`, AdministratorAccess, PowerUserAccess,
KMS, VPC, EFS, Secrets Manager, Identity Pool, web-bucket object write,
schedule-data write, DeleteObject, production resource, or cross-account
permission. AWS IAM Access Analyzer validation returned zero findings.

## P4D01: local policy contract and immutable baseline

Before any AWS write:

1. Add an AWS-free test for the policy JSON that asserts the exact new
   statements, fixed account/region/name resources, PassRole condition, absence
   of forbidden services/actions/resources, and no wildcard action.
2. Run infrastructure tests, synth, root check, JSON parse, and
   `git diff --check` under Node 24.
3. Confirm the policy candidate differs from commit `ad44b5f` only by the
   reviewed v4 statements and OriginRequestPolicy actions.
4. Update `implementation-log.md` and commit the source/test/documentation.

P4D01 is local-only and does not require AWS authority.

## P4D02: pre-write identity and baseline verification

Using only `AWS_PROFILE=codex-prod` and `AWS_REGION=ap-northeast-1`:

1. Confirm STS account `470447451992` and region `ap-northeast-1`.
2. Confirm `ItsRunPreviewCloudFormationExecutionPolicy` still has default
   version `v3`, with v1 and v2 retained.
3. Read v3 and prove it exactly matches the policy at commit `ad44b5f`.
4. Confirm `ItsRunPreviewHosting` is `CREATE_COMPLETE` and the existing output
   bucket/distribution identifiers are unchanged.

If any value differs, do not write AWS state. Record the evidence and stop for
Sol.

## P4D03: create and verify managed-policy v4

After explicit bundled approval, create one new managed-policy version from
the reviewed JSON and set it as default. Do not modify v1-v3 and do not create
v5.

Read v4 back immediately and verify it exactly matches the committed file.
Verify the v3-to-v4 diff contains only the reviewed additions. If it differs,
do not deploy; record evidence and stop.

## P4D04: first T11/T12 preview deployment

Use Node 24 and the existing CDK bootstrap. Do not bootstrap again. Run one
`cdk deploy` for `ItsRunPreviewHosting` with only the reviewed parameter
defaults and profile/account/region.

The deployment may publish the bundled Lambda zip to the existing
`cdk-hnb659fds-assets-470447451992-ap-northeast-1` bucket through the standard
file-publishing role. It may not publish a container image or upload web/data
objects through the CloudFormation execution role.

On any access denial, do not broaden IAM. Record the exact principal, action,
resource, CloudFormation logical resource/event, and failure message in
`implementation-log.md`, commit the stop record, and return to Sol.

## P4D05: read-only post-deployment verification

Without creating users or writing schedule data, verify:

- stack update completes and existing web/data bucket and distribution outputs
  remain unchanged;
- User Pool exists with self-sign-up disabled, deletion protection active,
  one COGNITO-only public code-flow client, one `itsrun/schedule.write`
  resource server, one empty `admins` group, and no Identity Pool or external
  IdP;
- HTTP API contains only the reviewed GET and PUT routes, JWT authorizer,
  `$default` stage, exact PUT throttle, and Lambda integration;
- Lambda is Node.js 24 with the reviewed memory/timeout/environment, dedicated
  role, exact data-prefix S3 actions, exact LogGroup stream actions, and exact
  GET/PUT invoke permissions;
- API Gateway and CloudFront API responses are no-store/no-cache, unauthenticated
  requests do not reach a successful data response, S3 remains private, and
  existing public preview checks still pass;
- no CloudFront invalidation, Cognito user mutation, schedule write, production
  change, DNS change, or Firebase change occurred.

## P4D06: handoff

Record actual policy version, asset publication, stack events, outputs, and
post-deployment checks in `implementation-log.md`. Commit the result and stop
for Sol review before T13 or Cognito-user administration.

## Stop conditions

Stop without guessing if any new dependency, API/data-schema change, policy
v5, IAM action/resource outside the committed v4, KMS/VPC/EFS/Secrets Manager,
Identity Pool/external IdP, administrator credential, schedule-data mutation,
invalidation, non-preview resource, production hostname/DNS, or Firebase
change is required.
