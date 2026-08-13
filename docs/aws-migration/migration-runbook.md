# Migration and rollback runbook

This is a draft until Phase 5 Sol approval.

## Preconditions

- Phase 5 review says go.
- AWS preview resources are synthesized and reviewed.
- The preview CloudFront distribution domain passes all public tests; it is not
  a selected production hostname.
- Cognito admin and non-admin tests pass.
- Historical Firebase/Firestore export, comparison, and reconciliation are out
  of scope under D041 and are not a cutover prerequisite.
- Firebase Hosting, production DNS, and the production hostname remain
  unchanged.
- The site owner, preview AWS operator, rollback operator, and approved
  Cognito `admins` operator roles are assigned outside Git; credentials remain
  outside chat and source.

## Accepted preview identifiers

- Account `470447451992`, region `ap-northeast-1`.
- Hosting stack `ItsRunPreviewHosting`; GitHub deployment stack
  `ItsRunPreviewGitHubDeploy`.
- Distribution `E22K5S8F2NUP6K`, domain
  `d2via50thoheqm.cloudfront.net` (preview only).
- Web bucket `itsrun-preview-web-470447451992-ap-northeast-1`; data bucket
  `itsrun-preview-data-470447451992-ap-northeast-1`.
- API `40xqzug59a`, User Pool `ap-northeast-1_nmj9cP9st`, public client
  `1olddro3tldfinupl52u9dl1j4`.
- Lambda `itsrun-preview-schedule-api`; alarm
  `itsrun-preview-admin-api-5xx`.
- GitHub OIDC provider
  `arn:aws:iam::470447451992:oidc-provider/token.actions.githubusercontent.com`;
  web-only deploy role
  `arn:aws:iam::470447451992:role/itsrun-preview-github-web-deploy`.

## Administrator account operations

Operational responsibilities are role-based: the site owner approves users
and any cutover; the preview AWS operator executes preview deployment and
rollback; the rollback operator preserves recovery evidence; and an approved
Cognito `admins` member performs schedule maintenance. Do not record personal
credentials, passwords, tokens, or recovery codes in this repository.

- Self-service sign-up remains disabled.
- Create one named local Cognito user for each approved operator; never share
  an account.
- Keep the `admins` group empty until the named owner approves membership.
- Add only approved operators to `admins`; create a separate authenticated
  local user without that membership for the required denial test.
- Record user creation, disablement, recovery, and group changes outside Git
  without recording passwords or tokens.
- Disable a departed or compromised operator immediately and remove their
  `admins` membership. Do not delete the user until audit and rollback needs
  are resolved.

## Data and baseline disposition

Historical Firebase/Firestore data export, comparison, and reconciliation are
explicitly superseded by D041. No unexplained migration differences remain
because historical comparison is out of scope, not because a comparison was
run. The accepted preview seed/current AWS object is the new-stack baseline;
record its validated bytes, ETag, VersionId, metadata, and hash in sanitized
evidence only. Do not implement dual writes or access Firebase data.

## Application cutover

1. Deploy the reviewed web build to the private preview web bucket.
2. Verify hashed assets and HTML cache metadata.
3. Verify CloudFront extensionless routes.
4. Run public Playwright smoke tests against the distribution domain.
5. Run administrator read/update/restore smoke test on a designated future
   date, then restore its original value.
6. Capture screenshots and response headers.
7. Do not attach or update production DNS in the preview workflow.
8. Monitor CloudFront, API Gateway and Lambda errors.
9. Keep Firebase Hosting and Firestore available and unchanged.

## Observation window

Default proposal: seven days. Sol may change it in Phase 5.

During the window:

- Compare visible current-week schedules daily.
- Monitor 4xx/5xx and authentication failures.
- Confirm administrator updates appear publicly within 60 seconds.
- Do not delete Firebase resources.
- Record every issue in `implementation-log.md` or the migration pull request.

## Read-only preview verification

Use only `AWS_PROFILE=codex-prod`, account `470447451992`, and region
`ap-northeast-1`. Verify both stack states, the alarm state and action arrays,
zero pool users and `admins` memberships, S3 public-access blocks and data
bucket versioning, direct S3 denial, API `401` with `no-store`, CloudFront
object hash/cache metadata, and the distribution invalidation count. Public
checks use `https://d2via50thoheqm.cloudfront.net`; this is a preview domain,
not production DNS.

Exact read-only verification commands:

```bash
set -eu
export AWS_PROFILE=codex-prod AWS_REGION=ap-northeast-1 AWS_DEFAULT_REGION=ap-northeast-1
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
aws sts get-caller-identity --query '{Account:Account}' --output json
aws cloudformation describe-stacks --stack-name ItsRunPreviewHosting --query 'Stacks[0].{Status:StackStatus,Outputs:Outputs}' --output json
aws cloudformation describe-stacks --stack-name ItsRunPreviewGitHubDeploy --query 'Stacks[0].{Status:StackStatus,Outputs:Outputs}' --output json
aws cloudwatch describe-alarms --alarm-names itsrun-preview-admin-api-5xx --query 'MetricAlarms[0].{State:StateValue,ActionsEnabled:ActionsEnabled,AlarmActions:AlarmActions,InsufficientDataActions:InsufficientDataActions,OKActions:OKActions}' --output json
aws cognito-idp list-users --user-pool-id ap-northeast-1_nmj9cP9st --query 'length(Users)' --output text
aws cognito-idp list-users-in-group --user-pool-id ap-northeast-1_nmj9cP9st --group-name admins --query 'length(Users)' --output text
aws s3api get-public-access-block --bucket itsrun-preview-data-470447451992-ap-northeast-1 --query PublicAccessBlockConfiguration --output json
aws s3api get-bucket-versioning --bucket itsrun-preview-data-470447451992-ap-northeast-1 --query Status --output text
aws s3api head-object --bucket itsrun-preview-data-470447451992-ap-northeast-1 --key data/v1/stadiums/oda/availability/2026-08.json --checksum-mode ENABLED --query '{Bytes:ContentLength,ETag:ETag,VersionId:VersionId,ContentType:ContentType,CacheControl:CacheControl,ServerSideEncryption:ServerSideEncryption,ChecksumSHA256:ChecksumSHA256}' --output json
test "$(curl -sS -o /dev/null -w '%{http_code}' https://itsrun-preview-data-470447451992-ap-northeast-1.s3.ap-northeast-1.amazonaws.com/data/v1/stadiums/oda/availability/2026-08.json)" = 403
curl -sS -D "$tmp_dir/api.headers" -o /dev/null -w 'api_status=%{http_code}\n' https://d2via50thoheqm.cloudfront.net/api/v1/stadiums/oda/availability/2026-08
grep -i '^cache-control: no-store' "$tmp_dir/api.headers"
curl -fsS -D "$tmp_dir/cloudfront.headers" -o "$tmp_dir/cloudfront.body" https://d2via50thoheqm.cloudfront.net/data/v1/stadiums/oda/availability/2026-08.json
sha256sum "$tmp_dir/cloudfront.body"
grep -i -E '^(HTTP/|content-type:|content-length:|cache-control:)' "$tmp_dir/cloudfront.headers"
aws cloudfront list-invalidations --distribution-id E22K5S8F2NUP6K --query 'length(InvalidationList.Items)' --output text
```

## Application rollback

If the new application fails:

1. Stop administrator updates in the new UI.
2. If production cutover is ever separately authorized, point DNS back to the
   recorded Firebase target, or restore the previous CloudFront deployment if
   DNS did not change. This preview runbook does not change DNS.
3. Confirm public routes and schedules on Firebase.
4. Preserve any S3 updates made after cutover for separately authorized
   reconciliation. Historical Firebase/Firestore reconciliation is out of
   scope under D041.
5. Preserve logs and version IDs for diagnosis.

Do not delete S3 versions or overwrite Firestore during emergency rollback.

## Data rollback

For an incorrect schedule update:

1. Identify the correct prior S3 version.
2. Download and validate it with the shared parser.
3. Copy that content back as a new current version.
4. Verify its new ETag/version ID.
5. Confirm it through CloudFront after the cache window.
6. Record actor, reason, old version and restored version.

S3 Versioning keeps prior overwritten/deleted versions, but every version
incurs storage cost. Retention policy is decided only after observing actual
volume.

## Firebase retirement

After the observation window and explicit approval:

1. Take a final Firestore export only if separately authorized after the
   observation window; it is not part of T16 or this preview runbook.
2. Store any approved encrypted backups and manifests in the agreed location.
3. Disable the legacy administrator route only after explicit approval.
4. Remove Firebase Hosting DNS/custom-domain association only after explicit
   approval.
5. Confirm no clients use Firebase for at least another agreed interval.
6. Disable Firebase resources in reversible order.
7. Delete legacy source and dependencies only in the separately approved T17
   workflow.

Permanent Firebase project deletion is a separate destructive action and
requires explicit user authorization.

## Final local and browser verification

Run with Node 24 from the clean migration worktree:

```bash
npm ci
npm run check
npm run test:e2e
PREVIEW_BASE_URL=https://d2via50thoheqm.cloudfront.net npm run test:e2e:preview
git diff --check
git status --short
```

The preview browser suite must use the real CloudFront domain without request
routes or response replacement. AWS verification remains read-only and pins
`AWS_PROFILE=codex-prod`, `AWS_REGION=ap-northeast-1`, and
`AWS_DEFAULT_REGION=ap-northeast-1`; inspect only the documented stacks,
alarm, Cognito counts, bucket gates, object metadata, API response headers,
CloudFront object, and invalidation count.
