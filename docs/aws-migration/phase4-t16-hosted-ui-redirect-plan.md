# Phase 4 T16 asynchronous Hosted UI redirect correction

Sol plan date: 2026-08-11

## HU01: local URL-gate correction

From this clean Sol handoff, read D043 and the CF/AG evidence. Add an exported,
testable bounded boundary that clicks the exact localized login button and waits
for the exact Cognito host plus `/login` before any form lookup. A delayed fake
must fail if form access occurs early and pass only after the URL gate. Preserve
the real `/manage` PKCE entry, recorder/API listener, cleanup, and sanitization.
Run focused auth/Chromium, root check, diff check, log, and commit. No AWS.

## HU02: one corrected auth-only execution

After Sol acceptance, repeat zero/baseline gates and execute the committed
auth-only program once. No retry or S3/data/Firestore/IAM/deploy/invalidation/
CF03/T17 operation. Record sanitized result and final zero state.
