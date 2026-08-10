# Phase 4 T16 token request diagnosis

Sol plan date: 2026-08-11

## TRQ01: local request-start/failure classification

Starting from the clean Sol handoff, read D049, security, OS02 evidence, and the
auth recorder/classifier/tests. For the exact allowlisted OAuth token endpoint,
record only whether an exact POST request started, whether Playwright emitted
`requestfailed`, and whether an HTTP response status followed. Never inspect or
retain request failure text. For the exact callback pathname, derive only the
boolean contract `code present` and `state present`; never retain their values
or any other query entry.

Classify callback parameters missing, token request not started, token request
failed before response, token response rejected, and token success/session
missing. Final output remains one category plus viewport and never includes an
event trail. Add deterministic and hostile-canary tests proving no URL query,
headers, bodies, credentials, tokens, raw failure, or console material survives.
Run focused tests, root check, diff check; log/commit. No AWS/live auth.

## TRQ02: one request-status auth-only execution

After Sol source acceptance, run the auth-only executable once with all existing
gates and cleanup. Stop at the one typed category without retry or source fix.
Require zero users/admins and unchanged protected object/invalidation inventory.
No API/S3/Firestore write, deployment, IAM, CloudFormation, production, or T17.
