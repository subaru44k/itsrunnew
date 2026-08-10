# Phase 4 T15 OIDC deployment and GitHub activation plan

This plan continues T15 after local acceptance of T15A through T15D. It is
limited to account `470447451992`, region `ap-northeast-1`, repository
`subaru44k/itsrunnew`, branch `migration/aws-s3-cloudfront`, preview stack
`ItsRunPreviewGitHubDeploy`, and the existing preview web deployment. It does
not authorize schedule-data writes, invalidation, production, DNS, Firebase,
or deployment of `ItsRunPreviewHosting`.

The start commit for implementation is the commit containing this plan. Use a
clean `migration/aws-s3-cloudfront` worktree and Node `24.18.1`. Execute the
milestones in order, update `implementation-log.md`, run the specified checks,
and create coherent commits without squashing history.

## T15E01: exact local policy-v6 candidate

Add exactly two statements to
`infra/bootstrap/cloudformation-execution-policy.json`; every existing v5
statement must remain byte-semantically unchanged.

The provider statement resource is exactly:

```text
arn:aws:iam::470447451992:oidc-provider/token.actions.githubusercontent.com
```

Its action set is exactly:

```text
iam:CreateOpenIDConnectProvider
iam:GetOpenIDConnectProvider
iam:DeleteOpenIDConnectProvider
iam:AddClientIDToOpenIDConnectProvider
iam:RemoveClientIDFromOpenIDConnectProvider
iam:UpdateOpenIDConnectProviderThumbprint
iam:ListOpenIDConnectProviderTags
iam:TagOpenIDConnectProvider
iam:UntagOpenIDConnectProvider
```

The role statement resource is exactly:

```text
arn:aws:iam::470447451992:role/itsrun-preview-github-web-deploy
```

Its action set is exactly:

```text
iam:CreateRole
iam:GetRole
iam:DeleteRole
iam:UpdateAssumeRolePolicy
iam:UpdateRole
iam:UpdateRoleDescription
iam:PutRolePolicy
iam:GetRolePolicy
iam:DeleteRolePolicy
iam:ListRolePolicies
iam:ListAttachedRolePolicies
iam:TagRole
iam:UntagRole
```

Add focused deterministic tests proving the v5-to-v6 delta, exact resources
and actions, and absence of `iam:PassRole`, `iam:ListOpenIDConnectProviders`,
managed-policy attachment, wildcard action/resource, other accounts, providers,
roles, and services. Update `infra/bootstrap/README.md` with the D021 version
gate. Do not call AWS in this milestone.

Required checks:

```bash
npm run test:infra --workspace @itsrun/infra
npm run build --workspace @itsrun/infra
npm run check
git diff --check
```

## T15E02: immutable AWS and template preflight

Use only `AWS_PROFILE=codex-prod`, account `470447451992`, and region
`ap-northeast-1`. Perform read-only checks first:

1. STS account and configured region match exactly.
2. The policy ARN is exact, `v5` is default, and only `v1` through `v5` exist.
3. AWS `v5` exactly matches the T15E01 parent commit's policy, before its two
   new statements, at canonical SHA-256
   `ca4a20e3e3a7c06c1f1196559886a9679dee98b9a25c7334dd8faf69b19e061e`.
4. AWS `v1` exactly matches commit `dc22db1`, with canonical SHA-256
   `598747d3e2158c4c52cfd9b50cb4c4883f8ac9f6c07013b54ed12ed24be1591a`.
5. No OIDC provider, exact role, or `ItsRunPreviewGitHubDeploy` stack exists.
6. Fresh synth has only the reviewed retained provider and retained role graph,
   exact trust/inline-policy contracts, and no HostingStack template change.
7. `cloudformation validate-template` accepts the exact template with only
   `CAPABILITY_NAMED_IAM` required.
8. IAM policy validation/simulation accepts only the exact candidate actions
   and resources. Simulation is evidence, not authority to add another action.

Commit the read-only evidence before the first AWS write. Stop on any mismatch.

## T15E03: rotate the execution policy from v5 to v6

Immediately before each write, repeat STS. Re-read and revalidate the T15E02
policy gates. Because IAM stores at most five managed-policy versions, delete
only nondefault `v1`; its exact committed document and hash must already be in
the log. Do not delete `v2`, `v3`, `v4`, or default `v5`.

Create one new policy version from the committed candidate using
`--set-as-default`. Require the new ID to be `v6`, require retained versions
to be exactly `v2` through `v6`, and read `v6` back. It must exactly match the
committed candidate and differ from v5 only by T15E01's two statements.

If deletion succeeds but version creation fails, record the exact denial and
stop. Do not delete another version, change the default, or broaden the policy.

## T15E04: deploy only the GitHub OIDC stack

After T15E03 succeeds, repeat STS and all current policy/template gates. Publish
only the synthesized template asset required by `ItsRunPreviewGitHubDeploy`
and deploy that exact stack once with `--require-approval never`. Do not deploy
or update `ItsRunPreviewHosting`.

Require CloudFormation to reach `CREATE_COMPLETE`. Read back and compare:

- provider URL, sole audience, tags, and retained deletion policy;
- role name, maximum session duration, tags, retained deletion policy;
- exact federated principal, `sts:AssumeRoleWithWebIdentity`, audience, and
  branch-only subject;
- exact inline runtime policy: one HostingStack `DescribeStacks` resource and
  one preview-web `PutObject` resource only;
- absence of managed policies, PassRole, GetObject, delete/list, invalidation,
  data bucket, production, or other services;
- exact stack outputs for provider and role ARNs.

On an access denial, record the exact action, resource, and CloudFormation
event and stop. Do not add permissions speculatively.

## T15E05: push, validate, and explicitly deploy preview web

Only after T15E04 acceptance:

1. Push the reviewed migration branch. Do not push `master`.
2. Inspect repository Actions settings. Keep workflow actions full-SHA pinned;
   do not relax an existing stricter policy or create AWS secrets.
3. Wait for the migration-branch validation workflow for the exact pushed SHA
   and require success.
4. Dispatch `deploy-preview-web.yml` exactly once for that same branch and
   commit. Require validation to finish before its deploy job.
5. Require the GitHub job to assume the exact T15D role and run the web-only
   helper. Do not retry a failed dispatch without recording and reviewing the
   exact cause.
6. Verify the run URL/SHA, helper report, raw preview E2E, CloudFront object
   hashes/cache metadata, unchanged data-bucket versions, unchanged Hosting
   stack, and absence of invalidation.
7. Derive the actual successful validation check names, then protect `master`
   with those required checks and pull-request review. Do not guess check names
   or change the default branch.

Do not create repository secrets, long-lived AWS keys, GitHub environment
trust, schedule-data access, or production deployment.

## T15F: final acceptance

Run under Node 24:

```bash
npm ci
npm run check
npm run test:e2e
npx vitest run scripts/migration/*.test.mjs
git diff --check
git status --short
```

Record every commit, AWS policy version operation, CloudFormation event,
GitHub run URL/SHA, repository-setting change, deployment report, and external
verification without credentials or tokens. Mark T15 complete only after all
local and external acceptance checks pass, then stop for Sol review before
T16.

## Stop conditions

Stop without guessing on a branch/account/region/hash/version/template mismatch,
nonterminal stack, action/resource denial, policy delta beyond T15E01, need to
delete any version other than v1, broader OIDC subject/audience, additional
provider/role, unpinned action, workflow/repository identity mismatch, second
dispatch, schedule-data access, DeleteObject, invalidation, HostingStack/CDK
resource mutation, production/DNS/Firebase change, or new dependency.
