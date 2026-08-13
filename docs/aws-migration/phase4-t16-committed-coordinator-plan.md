# Phase 4 T16 committed coordinator recovery

Sol plan date: 2026-08-10

Start clean from the committed Sol handoff with Node 24. Read all migration
documents, especially D039, D038-D028, all T16 plans/evidence, security, test
plan, and runbook. Do not perform a live write until PF01 and PF02 are committed
and accepted by their specified gates.

## PF01: real browser form contract

Correct `driveHostedUiSignIn` so the navigation/submit signal is immediately
handled and always settled or detached on missing/disabled controls, fill
failure, click failure, timeout, and success. Add an allowlisted
`click-failed` checkpoint. Clear every timer and prove no unhandled rejection.

Add an AWS-free Node/Playwright Chromium test using the installed Playwright
package, not a locator fake. Use local HTML with two named Cognito-shaped forms
and responsive CSS. At desktop and mobile, require exactly one visible form,
the correct form alone receives values, one real submit event occurs, the
hidden form stays empty, and the result is `form-submitted`. Test ambiguous/
missing/disabled controls, fill/click failure, timeout, timer cleanup, and
canary non-exposure without weakening prior unit tests. Run focused unit and
browser tests plus root `npm run check`; log and commit.

## PF02: committed dependency-injected coordinator

Implement a credential-free exported coordinator in the T16 harness. Inject
bounded adapters for setup, admin/non-admin browser proof, the D029 data
rehearsal, exact restore, and identity cleanup. Define stable allowlisted states
from preflight through setup, each role's form/callback/sentinel, data read,
conditional update, stale conflict, public observation, restore, and cleanup.
Always return the last checkpoint, sanitized role outcomes, operation/write/
restore/cleanup counts, and final status. After any write attempt, `finally`
must prioritize exact restoration before identity cleanup. Never return or
serialize adapter inputs, identities, credentials, body, token, URL query, DOM,
raw error, stack, bucket, or key.

AWS-free tests must cover complete success; failure at each setup/form/callback/
sentinel/data stage; form checkpoint preservation; no data call after auth
failure; stale conflict as one no-retry attempt; post-write failure with one
restore attempt before cleanup; restore failure as terminal; partial identity
cleanup; exact operation counts; and canary non-exposure. Run focused tests and
root check; update log and commit.

## PF03: baseline gate and one thin-adapter execution

Repeat HF02's no-user/no-credential/no-submit live form counts and independent
read-only STS, pool/group zero, and exact reserved-object baseline gates. Build
a temporary mode-0700 runner whose orchestration is only a call to the committed
coordinator with reviewed environment adapters. Preserve D037 protected input,
internal Username, JSON/void typing, recorder, sentinels, and restoration-first
cleanup. Fake-test adapters locally and review imports/argument boundaries.

Execute exactly once and observe only the coordinator's sanitized result. It
must include a typed last checkpoint. If it completes, require the full auth
matrix, one-cell conditional update, one stale conflict, public observation,
exact original-byte conditional restoration, identities/group zero, and final
baseline readback. If it fails before data, cleanup and stop at the typed
checkpoint. After data write, restoration is the only priority. Remove all
temporary material, update the truthful log, commit, and stop for Sol review.

No retry, raw CloudTrail event, process inspection, IAM/policy/deploy/
invalidation/other object/production/DNS/Firebase/T17 operation is permitted.
