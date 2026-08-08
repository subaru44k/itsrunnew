# Phase 4 T15 CI/CD plan

Sol planning baseline: `f025be9`

Plan date: 2026-08-09

## Verified repository and AWS baseline

Read-only checks established:

- GitHub repository: `subaru44k/itsrunnew` (public);
- default branch: `master`;
- migration/deployment branch: `migration/aws-s3-cloudfront`;
- GitHub Actions: enabled, currently allows all actions, SHA pinning is not
  enforced at repository level;
- `master`: no branch protection currently configured;
- GitHub environments and repository Actions variables: none;
- AWS account `470447451992`: no IAM OIDC provider currently exists and no
  itsrun GitHub deployment role exists.

These checks were read-only. They do not authorize GitHub settings changes,
workflow publication, AWS OIDC/IAM creation, deployment, or branch protection.

## Entry gate and authority boundary

T15 implementation begins only after T10-T14 are complete and accepted. Local
workflow source, deterministic helper tests, and documentation may be prepared
without external writes. Creating the GitHub OIDC provider/role requires a
reviewed IAM/CloudFormation plan and explicit AWS authorization. Pushing a
workflow, changing Actions settings, creating repository variables, or adding
branch protection is a GitHub write and requires an explicit bundled approval.

CI/CD initially targets only the existing preview web bucket through the
CloudFront distribution domain. It does not deploy infrastructure or Lambda,
write schedule data, create users, invalidate CloudFront, touch production
DNS, or change Firebase.

## T15A: pull-request validation workflow

Add one validation workflow for pull requests and pushes to the migration
branch. It must:

- use Node 24 and exact npm `11.4.2`;
- run `npm ci`, `npm run check`, and `npm run test:e2e` against a production
  build;
- install only the required Playwright Chromium/browser dependencies;
- use `permissions: contents: read` at workflow level and no `id-token` or
  write permission;
- avoid `pull_request_target`, untrusted script interpolation, cache paths
  derived from PR input, and execution of secrets on pull requests;
- pin every third-party action to a reviewed full commit SHA, including
  official GitHub actions; record the corresponding release tag in a comment;
- use concurrency to cancel superseded validation for the same ref;
- use bounded timeouts and short artifact retention;
- never upload `.env`, `.artifacts/migration`, raw schedule exports, tokens,
  `cdk.out`, or credentials as artifacts.

Keep lint, typecheck, unit, infra, build, and browser evidence visible as
separate jobs or clearly named steps while preserving the root command
contract. Failed validation must prevent the deploy job from becoming
eligible.

Local tests inspect triggers, permissions, action SHA pins, commands,
timeouts, artifact exclusions, and absence of dangerous events/expressions.
Do not add an action-linting dependency; GitHub's workflow parser is the final
external validation after an authorized push.

## T15B: web-only deployment helper

Refactor or add a migration helper that deploys only a reviewed generated web
directory. Do not reuse a mode that uploads preview fixture or schedule data.

The helper must:

1. require exact profile/region/account/stack/build inputs;
2. verify STS account and region before mutation;
3. read the existing stack output to resolve only the exact web bucket and
   CloudFront domain;
4. classify cache metadata through the already tested deterministic contract;
5. upload immutable and short-cache objects first and HTML/mutable Nuxt
   payloads last;
6. use per-object `PutObject` semantics without wildcard destination, sync,
   delete, ACL, schedule-data access, or CloudFront invalidation;
7. read every uploaded object back through CloudFront HTTPS with bounded
   retries and verify status, metadata, and SHA-256;
8. produce a sanitized manifest/report containing no token, credential, local
   path, bucket body, or raw AWS error.

CI does not delete stale hashed assets. They are content-addressed and remain
unreferenced; cleanup requires a later retention decision. Unknown mutable
payload keys and HTML remain governed by the no-cache upload-last contract.

AWS-free tests must cover deterministic commands/order, wrong identity,
unexpected stack/bucket/domain, path traversal, cache/hash/status failures,
timeout, fail-before-write behavior, and absence of any data-bucket key,
DeleteObject, sync, ACL, or invalidation operation.

## T15C: explicit preview deployment workflow

Add a separate `workflow_dispatch` workflow only after T15A and T15B pass.

- It runs only when the checked-out ref is exactly
  `refs/heads/migration/aws-s3-cloudfront` and the repository is exactly
  `subaru44k/itsrunnew`.
- Set workflow permissions to `contents: read`; grant `id-token: write` only
  to the deployment job.
- The deployment job depends on fresh install/check/build/E2E jobs from the
  same immutable commit. Do not download or deploy an artifact from another
  workflow run or mutable branch.
- Use OIDC only; do not create/store AWS access keys or long-lived GitHub
  secrets.
- Use one fixed region (`ap-northeast-1`), account
  (`470447451992`), stack (`ItsRunPreviewHosting`), web bucket output, and
  preview CloudFront domain.
- Concurrency allows only one preview deployment at a time.
- Run the web-only helper once and execute raw preview E2E afterward.
- Do not run CDK deploy, fixture/data upload, CloudFront invalidation, Cognito
  administration, or production/DNS/Firebase commands.

Do not attach a GitHub Environment in this first workflow unless its OIDC
subject and branch policy are separately reviewed. GitHub changes the OIDC
`sub` claim to an environment subject when a job references an environment;
mixing that with a branch-ref trust condition would either break deployment or
encourage broader trust.

## T15D: minimum GitHub OIDC role design

After the local workflow/helper review, synthesize a dedicated IAM provider
and role contract. The initial trust must match all of:

```text
provider: token.actions.githubusercontent.com
aud: sts.amazonaws.com
sub: repo:subaru44k/itsrunnew:ref:refs/heads/migration/aws-s3-cloudfront
```

Do not trust tags, pull requests, forks, wildcards, GitHub environments,
`master`, other repositories, or other audiences in the initial role. A later
Phase 5 decision may replace the migration-branch subject with the reviewed
production branch; do not include both preemptively.

The role's runtime policy candidate is limited to:

- `cloudformation:DescribeStacks` for the exact
  `ItsRunPreviewHosting` stack;
- the minimum bucket metadata call strictly required by the selected CLI
  operation on the exact preview web bucket;
- `s3:PutObject` and, only if readback requires it, `s3:GetObject` on the exact
  preview web bucket object ARN;
- read-only CloudFront operations only if the helper proves they are required.

It must not allow `s3:DeleteObject`, data-bucket access, schedule prefix
access, invalidation, CloudFormation mutation, CDK bootstrap-role assumption,
IAM, Cognito, API Gateway, Lambda, Logs mutation, Secrets Manager, production
resources, or `Action: "*"`.

Prefer a small dedicated infrastructure definition with semantic assertions.
If adding it to the current stack would require the CloudFormation execution
role to create the GitHub OIDC provider/role, Sol must review the exact policy
delta before policy v5 or deployment. Do not create console-only IAM drift.

## T15E: GitHub repository controls

After an explicit GitHub-write approval:

1. push the reviewed workflow commit to the migration branch;
2. set Actions policy to allow only selected reviewed actions or require full
   SHA pinning if the repository setting supports the intended workflow;
3. add only non-secret repository variables needed for the exact role ARN and
   preview identifiers; do not add AWS keys or tokens;
4. run the validation workflow and one explicitly authorized preview web
   deployment;
5. configure `master` protection before final merge so required checks must
   pass and direct unreviewed pushes cannot bypass the migration gate.

The exact protection rules and required check names must be derived from the
actual successful workflow run. Do not guess names before GitHub registers
them. Repository administration and workflow dispatch are external writes and
must be recorded in `implementation-log.md`.

## T15F: verification and handoff

Required local checks under Node 24:

```bash
npm ci
npm run check
npm run test:e2e
npx vitest run scripts/migration/*.test.mjs
git diff --check
git status --short
```

External acceptance evidence, after authorization, includes the GitHub run
URLs/commit SHA, exact OIDC provider/role ARN and trust policy, role permission
policy, successful preview CloudFront hashes/headers, and proof that schedule
data and production were untouched. Never record a token or credential.

Stop for Sol review before T16. Report commits, tests, pinned action SHAs,
workflow permissions/triggers, trust subject, runtime IAM, GitHub settings
changes, deployment result, and clean worktree.

## Stop conditions

Stop without guessing for a new dependency, unpinned action, broader OIDC
subject, AWS access key, GitHub secret containing AWS credentials, environment
subject, policy v5/IAM or GitHub write without explicit authorization,
schedule-data access, DeleteObject, invalidation, CDK/CloudFormation mutation,
production branch/hostname/DNS, Firebase change, or any repository/branch
identity that differs from the verified baseline.
