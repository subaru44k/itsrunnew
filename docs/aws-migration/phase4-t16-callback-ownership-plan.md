# Phase 4 T16 callback ownership correction

Sol plan date: 2026-08-11

## CO01: local callback/session ownership correction

Starting from the clean Sol handoff, read D047, security, the admin session
source/tests, callback and manage pages, and the CR03 evidence. Make session
initialization explicit: the callback page must obtain the shared session
without starting normal `getUser()` restoration, then run only the OIDC
callback; the normal `/manage` page must start bounded session restoration.
Do not infer the route from raw URL strings. Preserve the in-memory user store,
PKCE, safe return path, sanitized errors, logout, and the D046 monotonic guards.

Add lifecycle tests proving that callback mounting never starts `getUser()`,
callback success reaches signed-in state and the safe destination, and normal
manage mounting still restores signed-in/signed-out/error states. Run focused
web tests, admin-local Playwright, root check, and diff check; log and commit.
No AWS or live browser execution is authorized.

## CO02: reviewed web-only deployment

After independent Sol source review, deploy the accepted generated web through
the existing exact-SHA workflow. Do not upload data, change CloudFormation/IAM,
or invalidate CloudFront. Require workflow checks and unchanged protected data
and invalidation inventories; log and commit.

## CO03: one auth-only confirmation

After CO02 acceptance, repeat the exact gates and run the committed auth-only
executable once. Require all four role proofs, cleanup zero, and unchanged
protected data. Stop without retry. No API PUT, S3/Firestore write, IAM,
CloudFormation, invalidation, production, T17, or data rehearsal is authorized.
