# T16 CF03 UI-derived authenticated baseline proof

## Sol diagnosis

Even with immediate validation, the authenticated GET is audited as status 200
and the app reaches signed-in rendering, while Playwright's secondary
`response.json()` fails at `body-read`. The application already consumed the
same response. Re-reading it through CDP is not a reliable proof boundary in
this environment.

The response body can be proved without weakening the end-to-end contract:
the exact protected S3 capture is the authoritative baseline; the admin UI must
render its reserved tuple 0; and the subsequent UI-generated PUT must carry the
exact captured ETag plus a complete request document differing from that
baseline in exactly one cell. A malformed GET body cannot satisfy those UI and
PUT proofs.

## UB01: authoritative baseline input and transport proof

- Pass the exact retained capture `{document, etag, tuple}` from the concrete
  adapter into browser setup. Validate its exact shape with the existing exact
  parser and strong ETag/baseline tuple rules; do not accept caller fallback or
  constants as a substitute.
- For each authenticated GET, validate exact status, origin/path, JSON content
  type, and no-store cache metadata without reading its body through Playwright.
- After manage return and signed-in sentinel, require the exact target UI cell
  to be visible/enabled at value 0 and require no alert.
- Store only a clone of the validated authoritative baseline for each page.
- Preserve later exact PUT If-Match and full one-cell document-delta checks;
  together these prove the UI consumed the expected GET body/ETag.
- Remove unused secondary-body diagnostic code/reasons if they are no longer
  reachable; retain a closed transport/missing failure proof.

## UB02: deterministic end-to-end coverage

Without AWS/network access, prove wrong/missing baseline document, ETag, tuple,
transport metadata, UI cell state, or alert stops before load/update. Prove both
contexts receive independent cloned baselines. Prove the later PUT rejects any
header/body divergence from the authoritative capture. Retain cleanup,
unhandled-rejection, exact schema, transaction, and all existing T16 tests.

Run focused/combined T16 tests, schedule/web/root checks as affected,
`node --check`, `npm run check`, `git diff --check`, update the log, and commit.

## Stop conditions

Only local helper source, tests, and documentation are authorized. Do not
weaken transport, UI, ETag, full-document, schema, or delta validation; add a
dependency; or perform AWS/network/live/Cognito/S3/deploy/invalidation/IAM/
CloudFormation/Firebase/T17 operations. Stop for Sol review.
