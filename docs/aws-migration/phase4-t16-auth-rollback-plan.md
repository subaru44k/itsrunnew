# Phase 4 T16 real-auth and rollback rehearsal

Sol plan date: 2026-08-10

Start from the committed Sol handoff on `migration/aws-s3-cloudfront`, clean,
with Node `v24.18.1`. Read all migration documents, especially D028-D029,
`phase4-t16-t17-plan.md`, security, API/data schema, test plan, runbook, and the
implementation log.

Every AWS call uses only `AWS_PROFILE=codex-prod`, account `470447451992`, and
region `ap-northeast-1`; repeat STS before each write group. Never print raw
CloudTrail events, environment dumps, credentials, tokens, authorization codes,
claims, source bytes, request bodies, or AWS exception internals.

## T16C01: local operational harness and AWS-free tests

Implement the smallest operator test harness needed to drive real Hosted UI
login and the D029 browser rehearsal. It may read admin/non-admin username and
password from environment variables but must reject missing values and must not
log them. It must not install a dependency, persist tokens, replace fetch, use
the existing test-only OIDC adapter, or weaken the raw preview suite.

Add deterministic tests for redaction, exact target URL/roles/cell, storage
inspection, two-context stale-editor sequence, and cleanup behavior without AWS
or credentials. Keep operational output to sanitized role/outcome, HTTP status,
hash/ETag/VersionId identifiers, counts, and durations. Run focused tests, root
check, local E2E, and `git diff --check`; log and commit.

If a committed harness is unnecessary and an existing Playwright/API surface
can satisfy every contract without handling secrets in source/output, document
that review instead of adding code.

## T16C02: read-only preflight

Prove the accepted T16B state: Hosting/alarm healthy, policy v7 exact/default,
GitHub stack/OIDC role unchanged, pool/client/domain/routes exact, self-signup
disabled, COGNITO/code/PKCE client only, `admins` empty, pool zero users, no
Identity Pool/IdP, and exact API/CloudFront no-store behavior.

Use IAM simulation/read-only policy inspection to prove the current operator
can perform only the planned Cognito calls on the exact pool and the exact
conditional S3 restore call/key. Do not change IAM. Capture the exact Oda object
ETag, VersionId, headers, validated bytes, and SHA-256 outside the repository;
require `2026-08-09[0] = 0` and no baseline/hash drift. Record only sanitized
identifiers/hashes and commit.

## T16C03: ephemeral identities and real authorization

In one bounded credential-handling session:

1. create only the D028 admin/non-admin with messages suppressed;
2. set generated permanent passwords and add only admin to `admins`;
3. prove pool count 2, group count 1, and non-admin exclusion;
4. run real desktop and mobile Hosted UI Authorization Code + PKCE for both;
5. prove unauthenticated 401, non-admin sanitized 403, and admin GET 200;
6. prove issuer/audience/scope/group enforcement and inspect localStorage,
   sessionStorage after transaction cleanup, URL, console, network artifacts,
   Lambda/API logs, and reports for forbidden credential/claim/body leakage.

Do not delete identities yet because T16D uses the admin. On any auth failure,
make no schedule write; clean up the identities and stop. Update the log and
commit sanitized evidence only.

## T16D01: one UI update, stale conflict, and public observation

Re-read the exact object immediately before the write and require every T16C02
identifier/hash plus no concurrent change. Open two independent real admin
browser contexts and load the same original ETag. In the first, change only
Oda `2026-08-09` slot 0 from 0 to 1 and save once. Require a new ETag and
VersionId and no-store API response.

In the stale context, attempt the same one-cell edit with the original ETag.
Require the UI conflict state, sanitized 409, exactly one PUT attempt, no retry,
and unchanged current ETag/VersionId/version count. Inspect one allowlisted
audit record per request without printing forbidden fields. With bounded
polling and no invalidation, require CloudFront/public UI to show value 1 within
the 60-second cache contract.

If any expectation fails after the first write, proceed only to D029 restore;
do not retry the update or perform other work.

## T16D02: exact conditional restore and cleanup

Immediately require current ETag/VersionId/SHA equal the successful test result.
Perform exactly one direct `PutObject` of the captured original bytes to the
exact key with target `If-Match=<test ETag>`, original `Content-Type` and
`Cache-Control`, and checksum validation. Require a new restored VersionId and
ETag, then prove current body SHA-256/length/parser/value/updatedAt exactly match
the pre-rehearsal bytes and public CloudFront reflects value 0 within 60 seconds.
No version is deleted and no invalidation occurs.

After restoration proof, remove admin from `admins`, delete exactly both D028
users, clear credential material/transaction state, and prove the pool/group
return to zero. Re-run raw preview E2E, API no-store, private S3, alarm/stack,
data-version and invalidation inventories, root check, `git diff --check`, and
clean worktree. Record all three version identifiers and hashes but no bytes or
credentials. Commit and stop for Sol review before T16E/T17.

## Stop conditions

Stop before the first data write for any nonempty starting pool/group,
principal/policy mismatch, real-email need, notification delivery, secret/token
output, auth adapter/mock, storage persistence, missing admin/non-admin proof,
object/hash/schema drift, unavailable exact original bytes, concurrent
maintenance, or missing conditional restore permission.

After the first data write, restoration takes priority. Stop after one failed
conditional restore without retry or permission expansion, retain the protected
original bytes/version reference, and return to Sol. At all times forbid IAM or
policy changes, deployment/invalidation, CloudFormation, other keys/buckets,
DeleteObject/version deletion, production/DNS/Firebase/non-preview resources,
and T17.
