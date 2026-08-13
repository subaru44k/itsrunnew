# T16 CF03 UI response and restore-proof correction

## Sol diagnosis

The single bounded-retry execution reached one audited Lambda `PUT` 200 and
then entered recovery from the update checkpoint. The recovery `PutObject`
also completed: S3 now has a new current VersionId while the exact original
501-byte body, content-derived ETag, metadata, SHA-256, and tuple 0 are restored.
The helper nevertheless classified restoration as failed because it rejects a
restore ETag equal to the baseline ETag. For identical unencrypted payload
bytes that equality is expected; the new VersionId, exact bytes, metadata, and
conditional test-object ETag are the independent restore proofs.

The update boundary still performs a secondary Playwright read of the response
body after the application has consumed it. The same CDP body-read mechanism
was already removed from authenticated GET setup. The live audit proves one
PUT 200, but the opaque post-response failure prevented the coordinator from
accepting the updated object and forced recovery.

## UR01: exact current baseline and restore proof

- Change only the committed baseline VersionId to the current restored value
  `BH9YGdC.aioqdL4AR8Po5ggdJ6BmSE.Z`; retain exact bytes, ETag, metadata,
  SHA-256, document, and tuple.
- A restore response/readback ETag must equal the original baseline ETag and
  must differ from the test-object ETag. The restore VersionId must be nonempty,
  equal the immediate readback VersionId, and differ from both the test and
  prior baseline VersionIds.
- Keep the conditional restore `If-Match` bound to the observed test-object
  ETag. Keep exact protected-original bytes/checksum/metadata and one-attempt
  rules unchanged.
- Add deterministic negative tests for wrong restore ETag, reused baseline/test
  VersionId, mismatched readback, changed bytes/metadata/document/tuple, and
  stale prior baseline VersionId.

## UR02: composed UI update and conflict proof

- Do not read the successful PUT or conflict/comparison response body through
  Playwright after the application has consumed it.
- The browser boundary must still prove exactly one PUT request, exact origin,
  path, method, headers, strong `If-Match`, absence of `If-None-Match`, and the
  exact one-cell request-document delta; exact response status, origin/path,
  JSON content type, and `Cache-Control: no-store`; and no duplicate/retry.
- For success, wait boundedly for the real page's localized saved status,
  rendered tuple 1, metadata region, and absence of an alert.
- Return only a closed transport/UI proof. The coordinator must immediately
  perform the existing protected S3 readback, require state `test`, and derive
  the exact document, ETag, and VersionId from that readback before counting the
  write as passed or proceeding.
- For stale conflict, wait boundedly for the real conflict UI and the exact
  comparison GET transport, without a secondary body read. The coordinator's
  existing post-stale protected readback must prove the same test object,
  document, ETag, and VersionId remains current.
- Any ambiguous UI or protected readback remains a terminal failure and gets
  the existing single conditional restore. Do not mask errors or retry data
  operations.

## UR03: deterministic coverage and log

AWS-free tests must prove success and stale body accessors are never called;
the saved and conflict UI are awaited; request/transport deviations fail;
coordinator acceptance comes only after exact protected readback; indeterminate
write recovery remains one attempt; restoration with the identical baseline
ETag and a new VersionId succeeds; all mismatch cases retain recovery material;
and cleanup remains exactly once with no sensitive output or unhandled
rejection.

Run the focused and combined T16 suites, `node --check`, root `npm run check`,
and `git diff --check`. Update `implementation-log.md` truthfully and commit
coherently.

## Stop conditions

Only local helper source, tests, and documentation are authorized. Do not read
or write AWS, invoke the live rehearsal, remove retained recovery material,
create an identity, deploy, invalidate, change IAM/CloudFormation, touch
production/DNS/Firebase or historical data, add a dependency, or begin T17.
Stop for Sol review.
