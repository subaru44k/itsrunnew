# Migration and rollback runbook

This is a draft until Phase 5 Sol approval.

## Preconditions

- Phase 5 review says go.
- AWS production resources are synthesized and reviewed.
- CloudFront distribution domain passes all public tests.
- Cognito admin and non-admin tests pass.
- Firestore export and S3 import reports have no unexplained mismatch.
- Current Firebase deployment/version is recorded.
- DNS TTL is known and lowered in advance when a custom domain is available.
- A named operator and rollback operator are available.

## Administrator account operations

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

## Data migration

1. Export Firestore read-only.
2. Record export timestamp, source project, source counts, date range and
   SHA-256 manifest.
3. Transform to monthly JSON using the shared parser.
4. Compare every source cell with output.
5. Upload with `If-None-Match: *` to the data bucket.
6. Read every object back from S3 and compare hashes.
7. Read representative objects through CloudFront.
8. Record S3 version IDs.

If legacy updates occur after export, run a delta export immediately before
cutover. Do not implement dual writes unless Sol approves a concrete need.

## Application cutover

1. Deploy the reviewed web build to the private web bucket.
2. Verify hashed assets and HTML cache metadata.
3. Verify CloudFront extensionless routes.
4. Run public Playwright smoke tests against the distribution domain.
5. Run administrator read/update/restore smoke test on a designated future
   date, then restore its original value.
6. Capture screenshots and response headers.
7. Attach or update production DNS only after all checks pass.
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

## Application rollback

If the new application fails:

1. Stop administrator updates in the new UI.
2. Point DNS back to the recorded Firebase target, or restore the previous
   CloudFront deployment if DNS did not change.
3. Confirm public routes and schedules on Firebase.
4. Export any S3 updates made after cutover.
5. Reconcile those updates into Firestore manually or with a reviewed reverse
   migration script before reopening legacy administration.
6. Preserve logs and version IDs for diagnosis.

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

1. Take a final Firestore export.
2. Store encrypted backups and manifests in the agreed location.
3. Disable the legacy administrator route.
4. Remove Firebase Hosting DNS/custom-domain association.
5. Confirm no clients use Firebase for at least another agreed interval.
6. Disable Firebase resources in reversible order.
7. Delete legacy source and dependencies in T17 or a follow-up pull request.

Permanent Firebase project deletion is a separate destructive action and
requires explicit user authorization.
