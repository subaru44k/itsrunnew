# Phase 4 T15 policy-size recovery plan

This plan resumes after the single T15E03 `CreatePolicyVersion` attempt failed
with `LimitExceeded: Cannot exceed quota for PolicySize: 6144`. Nondefault v1
was already deleted after exact archival verification. AWS currently has
`v2` through `v5`, with `v5` default; there is no v6, OIDC provider, GitHub
deploy role, or `ItsRunPreviewGitHubDeploy` stack.

Start from the commit containing this plan on a clean
`migration/aws-s3-cloudfront` worktree with Node 24.18.1. Read all migration
documents, especially D020-D022, both T15 plans, the implementation log, the
current policy/tests, and the GitHub deploy stack source/tests. Execute R01-R04
in order, commit each coherent milestone without squashing, and obey the stop
conditions.

## R01: compact local candidate

Replace the rejected D021 representation with the exact D022 representation:

1. remove `PreviewGitHubDeployRoleLifecycle`;
2. preserve every action in `PreviewScheduleLambdaRole` and change only its
   Resource to the ordered exact pair of the existing schedule-role ARN and
   `arn:aws:iam::470447451992:role/itsrun-preview-github-web-deploy`;
3. retain `PreviewGitHubOidcProviderLifecycle` but limit it to the exact four
   D022 initial-create actions and exact provider ARN;
4. make no other semantic policy change.

Update focused tests to prove the semantic v5 delta, exact action/resource
pairs, no lost existing permission, absence of all rejected surfaces, and a
non-whitespace policy size no greater than 6,144 and exactly 6,077 for this
candidate. Update bootstrap documentation and the log truthfully.

Required local checks:

```bash
npm run test:infra --workspace @itsrun/infra
npm run build --workspace @itsrun/infra
npm run check
git diff --check
```

## R02: renewed read-only preflight

Use only `AWS_PROFILE=codex-prod`, account `470447451992`, and region
`ap-northeast-1`. Confirm exact STS/region, v5/default with exactly v2-v5,
AWS v5 hash
`ca4a20e3e3a7c06c1f1196559886a9679dee98b9a25c7334dd8faf69b19e061e`,
the R01 candidate delta/size, and continued absence of the exact provider,
role, and stack. Re-synth, require unchanged HostingStack hash, validate the
GitHub stack with only `CAPABILITY_NAMED_IAM`, validate/simulate the compact
candidate, update the log, and commit this read-only evidence before a write.

## R03: create and verify exactly one v6

Immediately before the write, repeat every identity/version/hash/absence gate.
Do not delete another version. Run exactly one
`CreatePolicyVersion --set-as-default` from the committed compact candidate.
Require version `v6`, retained versions exactly `v2` through `v6`, v6 default,
exact AWS/local canonical equality, and only the D022 semantic delta from v5.

On any failure, do not retry or change policy. Record the exact denial and stop.

## R04: deploy and verify only the GitHub OIDC stack

After R03 success, repeat STS and policy/template gates, then publish only the
required GitHub-stack template asset and deploy
`ItsRunPreviewGitHubDeploy` exactly once with `--require-approval never`. Never
deploy `ItsRunPreviewHosting`.

Require `CREATE_COMPLETE` and read back the exact provider URL/audience/tags,
exact role name/tags/session/trust/inline policy, retained deletion policies,
and exact outputs. Prove there is no managed policy, PassRole, GetObject,
delete/list, invalidation, data bucket, production, or other runtime service
permission. Confirm HostingStack state/template/outputs remain unchanged.

On an access denial, record the exact action, resource, and CloudFormation
event and stop without adding a permission. Do not push GitHub, dispatch a
workflow, deploy web/data, invalidate, administer Cognito, or start T15E05/T16.

## Stop conditions

Stop on any branch/account/region/hash/version/size/template mismatch, need to
delete another version, additional policy statement/action/resource, wildcard,
provider mutation permission, provider/role/stack preexistence, failed AWS
write, nonterminal stack, HostingStack mutation, GitHub write, schedule-data
access, invalidation, production/DNS/Firebase change, or new dependency.
