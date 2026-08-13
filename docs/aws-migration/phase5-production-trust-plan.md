# Phase 5 production deploy-trust execution

## Accepted baseline

- branch/start: commit containing this plan on
  `migration/aws-s3-cloudfront`, clean worktree, Node 24
- D059 production origin: existing CloudFront distribution
- live execution policy: default `v7`, retained `v3`–`v7`
- exact AWS `v7` and committed source must match before any write
- PC01 synthesized Hosting stack has no resource/property change
- PC01 GitHub stack changes only the deploy-role OIDC subject to `master`

## PT01: exact policy source and assertions

Add exactly one execution-policy statement:

```json
{
  "Sid": "GitHubTrust",
  "Effect": "Allow",
  "Action": ["iam:GetRole", "iam:UpdateAssumeRolePolicy"],
  "Resource": "arn:aws:iam::470447451992:role/itsrun-preview-github-web-deploy"
}
```

Add semantic assertions for exact action/resource and rejection of role
create/delete, inline-policy, wildcard, and OIDC-provider operations. Confirm
the policy remains within IAM's 6,144-character managed-policy limit. Do not
change another statement or dependency.

Run focused policy/infra tests, synth, `npm run check`, and diff/status; update
the implementation log and commit. No AWS/GitHub external write in PT01.

## PT02: Sol live policy update

Sol must recheck STS, account/region, default `v7`, and canonical equality of
AWS `v7` to the pre-PT01 source. Because IAM permits five versions, verify
nondefault `v3` against its committed historical source, delete only `v3`, and
create the reviewed source as default `v8`. Read back `v8`, prove its only
difference from `v7` is `GitHubTrust`, and retain `v4`–`v8`.

## PT03: merge and trust deployment

Push the reviewed branch and confirm validation. Mark draft PR #39 ready and
obtain the required independent approving review; do not weaken/bypass branch
protection. Merge through the PR only. After the `master` merge validation
passes, recheck STS and live state, then deploy only
`ItsRunPreviewGitHubDeploy` so its role trusts the exact `master` subject.
Hosting stack must not be deployed or changed.

Dispatch the production-web workflow on the exact reviewed `master` merge
commit once and complete the full CloudFront verification. No invalidation,
data upload, Cognito user, DNS, certificate, or Firebase operation belongs to
PT03.

## Stop conditions

Stop on canonical mismatch, version mismatch, unexpected policy/template
diff, access denial, failed validation, missing independent review, merge
block, Hosting-stack change, new permission, invalidation need, or live parity
failure. Record exact evidence without widening permissions or bypassing
protection.
