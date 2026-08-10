# Phase 4 T16 redirect callback correction

Sol plan date: 2026-08-11

## RDC01: local redirect-only callback correction

Starting from the clean Sol handoff, read D051, D012, security, TS02 evidence,
OIDC source/tests, and the installed oidc-client API. This application supports
only Authorization Code + PKCE redirect flow, so adapt the OIDC port to call
`UserManager.signinRedirectCallback(url)` directly rather than the generic
popup/silent/redirect dispatcher. Keep the public port's existing semantic
method if useful, but exact tests must prove only redirect callback is invoked.

Preserve sessionStorage transaction state, in-memory user store, D046/D047,
safe return paths, sanitized failures, callback cleanup, scopes, and logout.
Add deferred/unit and admin-local lifecycle tests; no token persistence or new
dependency. Run focused web tests, admin-local E2E, root check, diff; log/commit.
No AWS/live auth.

## RDC02: reviewed web-only deployment

After Sol source review, push exact SHA and dispatch the existing web-only
workflow once. Require all checks/raw preview and unchanged data/invalidation.
No data, IAM, CloudFormation, Cognito administration, or invalidation.

## RDC03: one auth-only confirmation

After RDC02 acceptance, run auth-only once with existing gates. Require all four
role proofs and cleanup zero; stop without retry. No API PUT/S3/Firestore write,
IAM, CloudFormation, invalidation, production, data rehearsal, or T17.
