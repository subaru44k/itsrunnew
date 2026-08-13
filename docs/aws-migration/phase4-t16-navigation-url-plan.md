# Phase 4 T16 initial navigation callback URL

Sol plan date: 2026-08-11

## NU01: validated callback URL selection

Start clean from this Sol handoff on `migration/aws-s3-cloudfront` with Node
`v24.18.1`. Read all migration documents, especially D056, D055, security, the
CU02 stop evidence, callback/session source, and auth harness tests.

Implement a dependency-free pure selector for the OIDC redirect response URL.
It receives the expected origin/path, current URL, and document navigation
entry names. Prefer the current URL only if it matches exactly. Otherwise accept
exactly one valid initial navigation URL. A valid candidate must have the exact
origin and `/manage/callback` pathname, no fragment, exactly one non-empty
`state`, and exactly one non-empty `code` or `error`. Reject malformed,
cross-origin, wrong-path, userinfo, repeated, empty, ambiguous, and multiple
valid navigation candidates. Do not decode, copy, persist, log, render, emit, or
return individual parameter values; the selected full URL may exist only in the
page setup closure until the existing callback consumes it once.

Use `performance.getEntriesByType('navigation')` only through a small browser
boundary. Keep the existing `window.location.href` setup capture as the first
candidate. If no valid candidate exists, pass no raw fallback and let the
existing sanitized authentication failure path run. Preserve callback
deduplication, transaction cleanup, memory-only tokens, PKCE, navigation, CSP,
and all public/admin behavior.

Add unit tests for every acceptance/rejection rule and a real local Chromium
test proving an initial code/state URL survives `history.replaceState` through
Navigation Timing and is passed unchanged exactly once, while no query/value is
placed in DOM, storage, console, artifacts, or result output. Keep the raw
preview suite unmodified. Run focused web tests, admin-local E2E,
`npm run check`, and `git diff --check`; update `implementation-log.md`, commit
coherent source/tests/docs, and stop for Sol review. No AWS operation.

## NU02: one reviewed preview confirmation

Only after Sol accepts NU01 may the exact reviewed SHA be pushed and the
existing web-only workflow run once. Require successful validation, deployment,
raw preview checks, and unchanged protected object/invalidation inventories.
Then run the committed auth-only executable exactly once from users/group zero.
Require desktop/mobile admin 200 and non-admin 403, cleanup zero, and no data
write. On any typed failure, clean identities and stop without retry or source
change. No API PUT, data rehearsal, Firestore, IAM, CloudFormation, invalidation,
production, DNS, Firebase, or T17 operation is authorized by this plan.
