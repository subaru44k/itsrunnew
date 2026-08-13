# Phase 4 T16 final auth and data rehearsal

Sol plan date: 2026-08-10

Start from the committed Sol handoff on `migration/aws-s3-cloudfront`, clean,
Node 24. Read all migration documents, especially D028-D032, the corrected
harness/tests, auth/rollback plan, security, API/data schema, test plan, runbook,
and chronological stop evidence.

## FR01: immutable local and read-only gate

Run the focused harness, root check, local E2E, and `git diff --check`. Then
using `codex-prod` only, prove account/region, policy v7 exact/default, healthy
Hosting/alarm/CSP/GitHub stack, exact pool/client/routes, zero users/group,
no-store API, private S3, and unchanged data/invalidation baselines.

Capture the exact current Oda August object into protected operator storage and
require the D029 key/cell, schema, 501-byte baseline, ETag, VersionId,
Content-Type, Cache-Control, SHA-256
`ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`,
and original bytes. Prove AWS CLI supports target `PutObject --if-match` and
simulate/inspect exact-key restore permission. No write in FR01. Log and commit.

## FR02: real authentication and authorization matrix

Create exactly the D028 two users and one admin membership with credentials
outside all output. With email aliases only, run real Hosted UI code/PKCE:

- desktop admin: callback, signed-in state, admin GET 200;
- mobile admin: callback, signed-in state, admin GET 200;
- desktop non-admin: callback, signed-in state, sanitized GET 403;
- mobile non-admin: callback, signed-in state, sanitized GET 403.

Also prove unauthenticated 401. Inspect only storage key names/counts, path-only
navigation, console categories, and URL/method/status request metadata. Require
no token/user material in localStorage, no OIDC transaction keys after callback,
no credential/code/query/header/body in evidence, and no schedule PUT. Keep the
users only for FR03. Log sanitized results and commit.

## FR03: update, conflict, exact restore, and identity cleanup

Immediately re-read the object and require exact FR01 identity/hash. Authenticate
two separate desktop admin contexts and load the same ETag. In context A change
only `2026-08-09[0]` from 0 to 1 and click Save once. Require one API PUT 200,
new ETag/VersionId, server-controlled updatedAt, no-store, and exactly one new
S3 version.

In stale context B make the same one-cell change and click Save once. Require
one PUT 409, visible localized conflict state, no retry, and unchanged current
ETag/VersionId/version count. Query logs with a sanitized field projection and
require exactly one allowlisted audit event per request, actor hash and success
VersionId only where allowed, with no forbidden fields. Poll CloudFront without
invalidation for value 1 using a bounded limit consistent with the 60-second
TTL.

Before any other work, require the current test ETag and perform exactly one
operator `s3api put-object` of the protected original file to the exact D029 key
with `--if-match <test ETag>`, original Content-Type/Cache-Control, and SHA-256
checksum. Require one new restored VersionId/ETag and exact original bytes,
length, SHA, parser value, tuple 0, and original updatedAt. Poll CloudFront to
the restored tuple without invalidation. Keep every S3 version.

Then remove admin membership, delete both users, destroy temporary credentials
and bytes, and prove pool/group zero. Run raw preview E2E, root check, API
no-store, direct-S3 denial, alarm/stack, data/invalidation inventories, version
count, `git diff --check`, and clean worktree. Record only identifiers/hashes,
sanitized outcomes, action counts, and durations; update the log and commit.

## Recovery and stop boundary

Before the first schedule PUT, any failure triggers identity cleanup and no
data write. After the first successful PUT, exact restore is the sole priority.
The restore receives one conditional attempt; if it fails, do not retry, remove
no identity needed for recovery, preserve original bytes/version reference, and
return to Sol.

No new code/dependency beyond truthful harness corrections, IAM/policy/deploy,
CloudFormation, invalidation, other object/bucket, DeleteObject/version delete,
production/DNS/Firebase, or T17 operation is authorized.
