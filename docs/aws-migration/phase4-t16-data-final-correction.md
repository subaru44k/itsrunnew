# Phase 4 T16 data executable final source correction

Sol review date: 2026-08-11

Commit `f82e377` remains local-only and must not be executed live. Complete the
following small milestones separately and stop after each commit/check set.

## DC01: exact browser/API contract

Correct the Playwright boundary to match `api-spec.md` and the deployed client:

- authenticated GET JSON has exactly `document` and `etag`; it has no
  `versionId`. Require status 200, application/json (parameters allowed),
  no-store, exact schema/document/baseline tuple, and strong baseline ETag for
  each independent page;
- retain each page's validated baseline document/ETag in its closure;
- context A's observed request has exactly one PUT, the exact path/origin,
  application/json (parameters allowed), baseline `If-Match`, no
  `If-None-Match`, no `updatedAt` or unknown fields, and a document whose only
  difference from that page's baseline is the approved target cell 0 to 1;
- parse the successful JSON body, not response headers, for exactly
  `document`, `etag`, `versionId`; require the same one-cell document, a valid
  server timestamp different from the baseline timestamp, strong new ETag,
  non-empty VersionId, and no-store;
- context B observes exactly one PUT 409/no-store, then the application's
  comparison GET 200/application-json/no-store with exactly `document` and
  `etag`, the approved one-cell document, and the successful update ETag;
- require the localized conflict section/button and no second PUT/retry.

Change the stale coordinator proof so it does not invent a VersionId from GET.
Immediately after stale, call exact S3 `readCurrent` and require state `test`,
ETag equal the successful API ETag, VersionId equal the successful API
VersionId, and exact approved bytes/document before polling/restoring.

Add low-level fake launcher/context/page/request/response tests covering setup,
both authenticated GETs, update, conflict/comparison, exact body delta, wrong
origin/path/header/content type/body/ETag cases, and request counts. A complete
browser adapter fake alone is insufficient. Run focused and root checks, log,
commit, and stop. No AWS/live operation.

## DC02: exact S3/recovery lifecycle

Parse `get-public-access-block` as
`PublicAccessBlockConfiguration.{BlockPublicAcls,IgnorePublicAcls,
BlockPublicPolicy,RestrictPublicBuckets}` and require all true. Require
versioning Enabled. `readCurrent` must return baseline/test only after exact
bytes, hash, metadata, parser, whole-document delta, strong ETag, and VersionId
validation; otherwise unknown.

For indeterminate update: baseline means no restore and safe cleanup; exact test
means one restore with observed ETag; unknown means typed `recovery-required`,
no speculative restore, and retained original. After successful update and
stale, enforce exact ETag/VersionId coupling. Restore proof requires a strong
new ETag and new VersionId distinct from baseline and test. Restore/readback
failure also retains material. Verify `.artifacts/migration` parent/run/file
containment, non-symlink and 0700/0700/0600 modes; cleanup never removes retained
material and removes it on safe success/baseline-no-write.

Add failure tests for every branch and cleanup/material behavior. Run checks,
log, commit, and stop. No AWS/live operation.

## DC03: real bounded CloudFront read and clean-room proof

Use a Node-side injected `fetch` boundary for public CloudFront data, not
`page.evaluate`. One overall deadline must cover fetch, body read, retry delay,
and all attempts. Abort the actual pending request with AbortController, clear
all timers, avoid unhandled rejections, bound body bytes, and require status
200, application/json, expected cache-control, exact schema, and tuple.

Test permanently pending fetch, permanently pending body, timeout, maxAttempts,
successful timer cleanup, invalid status/type/cache/body, and tuple retries with
fake clock/counters. Make every data test self-contained in a fresh temporary
root; no pre-existing gitignored fixture/artifact may be required. Run all T16
data/auth suites, `npm run check`, `node --check`, `git diff --check`, update the
log, commit, and stop for Sol review. No AWS/live operation.
