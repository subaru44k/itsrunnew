# Phase 4 T16 Cognito discovery CSP recovery

Sol plan date: 2026-08-10

Start from the committed Sol handoff on `migration/aws-s3-cloudfront`, clean,
Node `v24.18.1`. Read D030, the prior auth/rollback plan, the C03 stop evidence,
security, infra source/tests, and implementation log.

## CSP01: exact local correction

Add only the D030 issuer origin to the shared CSP and strengthen semantic infra
tests to require the exact `connect-src` origin set/order and reject wildcard,
Google, other-region, HTTP, or path variants. Preserve all existing security
directives, Hosted UI origin, web/API policies, and T11-T16 contracts.

Run infra tests/synth, root check, local E2E, and `git diff --check`; update the
log and commit. No new dependency or AWS operation.

## CSP02: exact response-policy deployment

Read-only preflight must prove policy v7 exact/default, v3-v7 retained,
Hosting/alarm/GitHub/data/invalidation baseline, pool/group zero, and current
CSP missing only the exact issuer origin. Fresh synth, template validation, and
`cdk diff --no-change-set` must show only CSP updates on the existing
`SecurityHeaders` and `ApiSecurityHeaders` response-header policies.

After STS exact account/region, deploy only `ItsRunPreviewHosting` once. Read
both policies and public/API responses back; require the exact D030 CSP and all
other headers unchanged. Run raw preview E2E and no-store/S3/inventory checks.
Update the log and commit.

## CSP03: resume protected rehearsal

After CSP02 succeeds, repeat T16C03 from a clean zero-user/group state with new
ephemeral credentials, then continue T16D01-D02 exactly as
`phase4-t16-auth-rollback-plan.md` specifies. The prior failed identities are
gone and must not be reused. All credential, conditional-write, restoration,
cleanup, logging, and stop boundaries remain unchanged.

No policy/IAM/version, CloudFront invalidation, web/data upload, CloudFormation
resource beyond the two existing header-policy updates, external origin,
production/DNS/Firebase, or T17 operation is authorized. Stop without retry on
any different diff, test/permission failure, or credential/data boundary issue;
after a data write, exact restore remains the only priority.
