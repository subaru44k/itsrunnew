# Phase 4 T16 transaction-state diagnosis

Sol plan date: 2026-08-11

## TS01: local matching-transaction boolean probe

Starting from the clean Sol handoff, read D050, security, TRQ02 evidence, auth
source, and tests. In the auth-only Playwright session (never the raw preview
suite), install a pre-document probe that runs only on the exact callback origin
and pathname. It may parse the callback `state` in memory solely to test whether
the exact prefixed state-store key exists in sessionStorage, then must discard
the value and retain only `matchingTransactionPresent: true|false`. It must not
read the stored value, enumerate or return key names, or retain query material.

Map token-request-not-started to matching transaction missing/present typed
categories. Final result remains category plus viewport; no boolean/event trail
is returned separately. Add real-Chromium and hostile-canary tests proving the
probe runs before app code, never reads the stored value, and leaks no state,
PKCE, key, query, token, header, body, or raw error. Run focused tests, root
check, diff check; log/commit. No AWS/live auth.

## TS02: one transaction-state auth-only execution

After Sol source acceptance, run auth-only once with existing gates and cleanup.
Stop at the typed matching-transaction category without retry or source fix.
Require zero users/admins and unchanged protected object/invalidation inventory.
No API/S3/Firestore write, deployment, IAM, CloudFormation, production, or T17.
