# Phase 4 T11/T12 failed-deployment recovery plan

Sol review target: `3cb3d7b`

Review date: 2026-08-09

## Verified failure and current AWS state

Sol independently confirmed, using only `AWS_PROFILE=codex-prod`, account
`470447451992`, and region `ap-northeast-1`:

- execution policy v4 is default, v1-v3 are retained, and AWS v4 exactly
  matches `infra/bootstrap/cloudformation-execution-policy.json`;
- the single authorized deploy published Lambda asset
  `ed27108982d0ef94b6b9baa33135d04d2135dfaa4a365fc28fd6f4ca6cdda087.zip`
  and template asset
  `dc69f7e343f501818723f8967ce25bdc9567c53f7b0bd1c11ba1c5b733cf91fc.json`;
- `ApiCacheA0112D40` failed with CloudFront request ID
  `636c7aea-8919-461f-9b3d-1d5c3b90194e` because `HeaderBehavior` is invalid
  for a cache policy with caching disabled;
- the stack is `UPDATE_ROLLBACK_COMPLETE` with the original web/data bucket
  and distribution outputs unchanged;
- API Gateway and the schedule Lambda do not exist after rollback;
- one retained User Pool exists at
  `ap-northeast-1_M39i3BFEu`, created at `2026-08-08T23:22:51.247Z`, with
  deletion protection active and exact tags for stack `ItsRunPreviewHosting`
  and logical ID `AdminUserPoolD0AF18CF`;
- that pool has zero users, clients, groups, resource servers, identity
  providers, and domain. It is not present in the rolled-back stack resource
  list.

No schedule data, Cognito user/group, invalidation, DNS, production, or
Firebase mutation occurred. P4D05 remains incomplete.

## RC01: exact CloudFront source correction

Local-only; no AWS call or new dependency.

1. Remove the stack-owned `ApiCache` custom cache-policy resource.
2. Bind `/api/*` to AWS managed cache policy
   `4135ea2d-6df8-44a3-9df3-4b5a84be39ad` (`Managed-CachingDisabled`).
3. Keep a stack-owned `AWS::CloudFront::OriginRequestPolicy`, but construct it
   through the L1 CloudFormation resource so its exact configuration is:
   - headers: whitelist exactly `Authorization`, `Content-Type`, `If-Match`,
     and `If-None-Match`;
   - cookies: `none`;
   - query strings: `none`.
4. Reference that exact resource from the `/api/*` behavior. Do not forward
   viewer `Host`, cookies, query strings, or any other viewer header.
5. Preserve the API method filter, allowed methods, response headers, origin,
   JWT/API contracts, public route behavior, and every unrelated resource.

Use a stable L1 construct/reference rather than source-string mutation or a
generated logical-ID dependency. A source comment must explain the CDK L2
validation gap and cite the current AWS CloudFront authorization-forwarding
documentation.

## RC02: semantic assertions and local checks

Strengthen `infra/test/stack.test.mjs` without generated logical-ID hardcoding:

- exactly one API origin request policy with the four-header whitelist and
  `none` cookies/query strings;
- no custom `ItsRunPreviewApiNoCache` cache-policy resource;
- `/api/*` references exact managed cache policy ID
  `4135ea2d-6df8-44a3-9df3-4b5a84be39ad` and the detected stack-owned origin
  request policy Ref;
- no `ForwardedValues`, all-viewer policy, positive API TTL, viewer `Host`,
  extra header/cookie/query, or changed method filter;
- all existing T11/T12 semantic resource, dependency, runtime IAM, CORS, JWT,
  route, Lambda, and public hosting assertions remain at least as strict.

Required Node 24 checks:

```bash
npm run test:infra --workspace @itsrun/infra
npm run build --workspace @itsrun/infra
npm run check
git diff --check
git status --short
```

Update `implementation-log.md` with RC01/RC02 and coherent commits. Stop for
Sol review before any AWS write.

## RC03: Sol local and policy re-review

Sol must independently verify:

- the synthesized diff from the failed template is limited to removal of
  `ApiCacheA0112D40`, the managed API cache-policy ID, the exact added
  `Authorization` origin header, and deterministic metadata/asset hash changes;
- policy v4 still exactly covers the corrected graph and no policy v5 is
  needed;
- Lambda ZIP is unchanged unless source unexpectedly changed;
- all required tests pass and the worktree is clean.

Only then may Sol request one bundled recovery authorization.

## RC04: exact empty retained-pool cleanup

Protected AWS write; requires explicit recovery authorization.

Immediately before cleanup, verify STS/account/region and re-read the exact
pool. It must still match all of:

- ID `ap-northeast-1_M39i3BFEu`;
- name `itsrun-preview-admins`;
- exact stack/logical-ID tags recorded above;
- deletion protection `ACTIVE`;
- creation time `2026-08-08T23:22:51.247Z`;
- zero users, clients, groups, resource servers, identity providers, and
  domain.

If any field differs, do not mutate it. Record evidence and stop.

If it matches, use only the following lifecycle operations on that exact pool:

1. `cognito-idp:UpdateUserPool` to set deletion protection `INACTIVE`;
2. read back and verify it is still empty and correctly tagged;
3. `cognito-idp:DeleteUserPool` on that exact ID;
4. verify the exact pool no longer exists.

Do not list or modify Auth users outside the verification calls, and do not
change another pool, client, group, domain, provider, or credential.

## RC05: one corrected stack retry

After RC04 succeeds:

1. verify policy v4 remains default, exact, with v1-v3 retained;
2. verify the stack remains `UPDATE_ROLLBACK_COMPLETE` with baseline outputs;
3. verify STS account/region again;
4. use Node 24 and the existing bootstrap; do not bootstrap;
5. run exactly one corrected `cdk deploy ItsRunPreviewHosting` with reviewed
   parameter defaults.

The retry may publish the corrected stack template and reuse/publish the same
Lambda ZIP. It may not create policy v5, broaden IAM, upload web/data objects,
invalidate CloudFront, create users/group membership, or change production,
DNS, or Firebase.

On any denial or if CloudFront rejects the exact four-header origin request
policy, do not fall back to all-viewer forwarding, legacy forwarding, positive
TTL, or new IAM. Record the exact principal/action/resource/event/message,
commit, and stop.

## RC06: full P4D05 verification and handoff

Run every read-only post-deployment check in
`phase4-t12-deploy-plan.md` P4D05, including exact deployed Cognito/API/Lambda
graph, empty admins group/users, runtime IAM, API/CloudFront no-store/no-cache,
unauthenticated denial, public preview E2E, private S3, unchanged outputs, and
no invalidation/data/production/Firebase mutation.

Update the P4D03-P4D06 and RC rows in `implementation-log.md` with actual
commits, template/asset hashes, policy state, cleanup evidence, stack events,
outputs, and tests. Stop for Sol acceptance before T13 or Cognito
administration.

## Stop conditions

Stop without guessing for a non-empty/differently tagged retained pool,
policy v5, broader IAM, another CloudFront forwarding mechanism, positive API
TTL, new dependency, bootstrap rerun, second corrective deploy attempt,
Cognito user/group mutation, schedule/web/data upload, invalidation,
non-preview resource, production/DNS, or Firebase change.
