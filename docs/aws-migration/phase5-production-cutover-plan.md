# Phase 5 production cutover plan

Date: 2026-08-13  
Planner/reviewer: Sol  
Branch: `migration/aws-s3-cloudfront`  
Planning start: `fdeedd5`

## Current accepted state

Phase 5 is technically accepted. The reviewed Nuxt application, private S3
origins, CloudFront distribution, local-user Cognito authorization, scoped API
and conditional schedule updates are deployed and verified in the existing
`ItsRunPreviewHosting` stack. Production dependency audit is zero; the only
unfiltered audit finding is the documented upstream CDK build-tool bundle.
Both GitHub validation runs for `fdeedd5` passed. Historical Firestore data is
discarded under D041 and no export, comparison, import, dual write, or Firebase
database access is part of cutover.

The existing CloudFront distribution can be promoted in place. Creating a
second production stack would duplicate CloudFront, bucket, Cognito, API,
Lambda, and log costs and would require a new data/bootstrap exercise, so it
is not the default.

## PC00: binding operator choices

No protected write starts until the owner supplies one complete choice set.
Secrets and passwords must never be supplied in chat or Git.

### Production origin

Choose exactly one:

1. **Existing CloudFront URL (recommended for lowest cost):** declare
   `https://d2via50thoheqm.cloudfront.net` the production origin. No
   certificate, DNS, CloudFront alias, or Cognito callback change is needed.
2. **Custom hostname:** supply the exact HTTPS FQDN and DNS provider/hosted-zone
   ownership. This path requires a CloudFront-compatible ACM certificate in
   `us-east-1`, an alias on the existing distribution, DNS validation/records,
   and adding exact custom-origin callback/logout URLs. Do not infer any name.

### Initial administrator

Choose one:

1. keep the `admins` group empty at cutover; or
2. supply one approved email address for a named Cognito local user.

For option 2, the operator creates a temporary password outside chat and Git,
requires password change at first sign-in, adds only that user to `admins`, and
records no credential in repository evidence. The previously completed
temporary admin/non-admin tests already prove the authorization boundary; an
empty group does not block a public launch.

### Legacy Firebase Hosting entry points

The legacy public origins are `https://itsrun-aaf42.web.app` and
`https://itsrun-aaf42.firebaseapp.com`. Choose one transition:

1. **Redirect after the new-origin release gate (recommended):** deploy only a
   reversible Firebase Hosting redirect to the selected production origin.
   Do not read or change Firestore and do not delete the Firebase project.
2. **Leave legacy URLs serving the old site during observation:** communicate
   the new origin separately. This preserves the strongest rollback but does
   not move visitors who use the legacy URLs.

The redirect is a protected Firebase write and requires its exact current
configuration and rollback version to be captured before mutation. If the
current Hosting configuration cannot be read or restored exactly, stop.

## PC01: local release-source correction

After PC00 is fixed in an accepted decision, Luna makes only the corresponding
source, assertions, workflow, and runbook changes.

For both origin paths:

- change the explicit GitHub deployment branch contract from
  `migration/aws-s3-cloudfront` to `master` in the workflow, helper boundary,
  tests, and GitHub OIDC trust source;
- keep the role web-only: CloudFormation stack read and web-bucket
  `s3:PutObject`; never grant data-bucket, API, Cognito, invalidation, or broad
  S3 access;
- preserve manual dispatch, SHA-pinned actions, Node/npm pins, read-only
  default permissions, validation before deployment, and raw browser checks;
- rename user-facing documentation from preview to production where factual,
  but do not replace physical resource names merely for appearance;
- keep the existing stack, buckets, data, version history, API, User Pool,
  client, domain, Lambda, alarm, and distribution identifiers;
- keep Firebase database/history out of scope.

For the existing-CloudFront origin, keep the current site URL and Cognito
callback/logout parameters exactly unchanged.

For a custom hostname, parameterize and assert the exact alias/certificate
contract, site origin, and callback/logout lists. Retain the CloudFront URL in
the Cognito callback/logout lists through the observation window for rollback.
No wildcard hostname, callback, certificate, or DNS record is allowed.

Required local gates:

```bash
npm ci
npm audit --omit=dev
npm run check
npm run test:e2e
PREVIEW_BASE_URL=https://d2via50thoheqm.cloudfront.net npm run test:e2e:preview
npm ls --all
git diff --check
git status --short
```

Luna commits coherent changes and stops for Sol IAM/template review. No AWS,
GitHub settings, DNS, Firebase, deployment, administrator, merge, or PR-state
write is permitted in PC01.

## PC02: Sol exact-diff and least-privilege review

Sol compares the synthesized templates and proves the intended path.

The CloudFront-origin path should change only the GitHub deploy stack trust
subject from the migration branch to `master`; the Hosting stack must remain
unchanged. Sol must derive the exact CloudFormation execution-role action and
resource needed to update that one trust policy and compare it with the current
default managed-policy version before authorizing any IAM or CloudFormation
write. Do not create a policy version or widen permissions speculatively.

The custom-hostname path additionally requires exact CloudFront distribution,
ACM, and DNS template diffs and a separately reviewed least-privilege policy.
Certificate management must use `us-east-1`; application resources remain in
`ap-northeast-1`. Stop if cross-region deployment or external DNS ownership is
not fully defined.

## PC03: merge and production-source gate

After PC01-PC02 acceptance:

1. confirm the PR head equals the reviewed commit and both push/PR validations
   pass;
2. make draft PR #39 ready only after the owner authorizes the batch;
3. merge through the protected PR into `master`; never push directly;
4. confirm the merge commit's validation passes;
5. retain the local legacy recovery tag and record the merge commit.

If branch protection, review requirements, or CI prevents the merge, stop and
report the exact GitHub state without weakening protection.

## PC04: protected AWS production promotion

Every AWS command is pinned to `AWS_PROFILE=codex-prod`, account
`470447451992`, and region `ap-northeast-1`; check STS immediately before each
write group.

1. Re-read both stack templates/states, default execution-policy version,
   alarm, distribution, bucket gates/versioning, User Pool/client/domain, and
   deploy-role trust.
2. Prove live state equals the reviewed baseline. Stop on drift.
3. Apply only the Sol-approved minimal execution-policy version if the current
   role cannot perform the exact trust update. Retain recoverable prior policy
   versions and do not add unrelated services/actions/resources.
4. Deploy only `ItsRunPreviewGitHubDeploy` to change the OIDC trust to
   `master`. For a custom hostname, execute its separately approved hosting,
   certificate, and DNS sequence; otherwise do not update HostingStack.
5. Dispatch the exact reviewed `master` web deployment once. Do not issue a
   CloudFront invalidation because mutable HTML/payload objects are no-cache
   and deployment verification reads every object through HTTPS.
6. If an initial administrator was selected, create only the named local user
   and add it to `admins`; otherwise assert both user and group-member counts
   are zero.

Any access denial, drift, unexpected resource replacement, policy widening,
new invalidation need, or secret handling requirement is a stop condition.

## PC05: release verification and observation

Verify the selected production origin using unmodified browsers:

- desktop/mobile and ja-JP/en-US;
- every canonical and compatibility route, redirects, canonical/hreflang,
  unknown route/asset, security headers, and cache metadata;
- all current fixture values and `updatedAt`;
- private direct S3 access;
- API unauthorized/no-store behavior;
- login/logout and one read-only admin load if an admin exists;
- exactly one conditional update/conflict/restore rehearsal only if separately
  included in the protected-write batch;
- actionless alarm remains `OK` and logs contain no forbidden values.

Record the observation-window start and named site/AWS/rollback operators.
Default observation is seven days. Keep all Firebase resources unchanged
through this window except an explicitly selected reversible Hosting redirect.

## PC06: Firebase retirement after observation

This is not part of the initial cutover authorization. After seven successful
days, separately inventory live Firebase Hosting/Firestore usage. Because
historical data is discarded, no export or reconciliation is required.
Disable or delete Firebase components only through a new exact destructive
plan with explicit targets and rollback limits. Permanent project deletion is
never inferred from cutover completion.

## Batch authorization needed after PC00

Once the three PC00 choices are supplied, Sol will turn them into one exact
decision and one bounded authorization request covering PC01 implementation,
PC03 GitHub merge, PC04 AWS/IAM/deployment operations, optional Cognito user
administration, optional DNS/certificate work, optional Firebase Hosting
redirect, and PC05 verification. No repeated approval is needed inside that
accepted batch unless a stop condition occurs.

## Read-only preflight evidence

Sol completed the non-mutating portions of PC02 against account
`470447451992` on 2026-08-13:

- STS matched the required account and region;
- the execution managed policy is default `v7`, with `v3` through `v7`
  retained; AWS `v7` and the committed policy have the same canonical SHA-256
  `ac05040e2aed3baff41c1d34e49200fb54ce0a208546cf0555ad7d9abbfe43d0`;
- after excluding only CDK analytics metadata and the obsolete bootstrap rule,
  the live GitHub stack template and current synth have the same canonical
  SHA-256
  `4dc51d8ffc7e0f1cd1ec8a8f7faff4785569cccf47be289fb1ed34d2db7a4364`;
- the live role trusts only the exact migration-branch subject and audience,
  contains only the `PreviewWebDeployment` inline policy, and that policy has
  only the exact Hosting-stack describe and web-bucket PutObject statements;
- the live OIDC provider has only `sts.amazonaws.com` as client ID and the
  expected purpose tag.

CloudFormation drift detection could not inspect the retained IAM resources
because execution-policy v7 intentionally lacks `iam:GetRole` for the GitHub
role and `iam:GetOpenIDConnectProvider`. The detection ended `DETECTION_FAILED`;
it did not mutate the stack or resources. The direct live reads and normalized
template comparison above establish the relevant baseline without granting
provider permissions.

The exact lowest-cost branch-trust update needs a policy `v8` candidate that
adds one statement only:

```json
{
  "Sid": "GitHubTrust",
  "Effect": "Allow",
  "Action": ["iam:GetRole", "iam:UpdateAssumeRolePolicy"],
  "Resource": "arn:aws:iam::470447451992:role/itsrun-preview-github-web-deploy"
}
```

The compact candidate is 6,124 characters, within IAM's 6,144-character
limit, and its canonical SHA-256 is
`7c1a4c623e986fb6ad4b7841cdf7e3f2e920e6cfd6887fc4d927972b19b644e0`.
Policy simulation permits exactly those two actions on that role and denies
role create/delete/inline-policy changes and all tested OIDC-provider changes.
Before creating v8, recheck AWS v7 against the committed source. Delete only
nondefault v3 after proving its canonical SHA-256
`fd05113d5e7d46ddd6b597e3350c7f72e9ea5181489779ecaaee3f4b4e91ca68`
matches commit `ad44b5f`; then create v8 as default and retain v4-v8. This exact
policy/version operation remains protected and unexecuted.

GitHub `master` protection currently requires one approving review, the
strict `Node 24 validation` check, and applies to administrators; force pushes
and deletion are disabled. Draft PR #39 is green at `b77a79a` but cannot merge
until another authorized GitHub reviewer approves it. Protection must not be
weakened or bypassed.

Both legacy Firebase Hosting origins currently return the same 200 HTML object
with ETag
`d4b42dbedacf1144cb42041410beaa08615221a1d3ad688b5465323568f97737`
and last-modified 2022-08-09. The exact legacy `firebase.json` and project
mapping are recoverable from the retained legacy tag. Before any redirect,
the authenticated Firebase release/version identifier and rollback command
must still be captured; no Firebase CLI or authenticated Firebase operation
was performed in this preflight.
