# Phase 4 T16 callback error taxonomy

Sol plan date: 2026-08-11

## CET01: local sanitized callback-boundary taxonomy

From the clean handoff, read D052, security, RDC03 evidence, OIDC/session code,
and auth tests. At the OIDC adapter catch boundary, map only exact known shapes
to fixed categories: state unavailable (null/undefined), state malformed
(SyntaxError), invalid redirect request type (exact library message), OAuth
response error (library type only, without fields), and callback other. Never
retain, log, stringify, or expose the caught value/message except the one exact
constant comparison.

Dispatch only the fixed category through a dedicated browser CustomEvent. The
auth-only pre-document harness may retain the category in memory and reduce it
to final category+viewport; no event payload beyond the allowlisted string.
Application text remains generic and raw preview unchanged. Add hostile object,
real Chromium, and adapter tests proving no raw error/state/token leaks. Run
focused web/auth tests, admin-local E2E, root check, diff; log/commit. No AWS.

## CET02: reviewed web-only deployment

After Sol review, deploy web-only once through exact-SHA workflow; no data/IAM/
CloudFormation/Cognito admin/invalidation. Verify raw preview and inventories.

## CET03: one auth-only diagnosis

After deployment acceptance, run auth-only once; stop at the typed callback
category. Cleanup zero and unchanged protected data/invalidation are required.
No retry, source fix, data write/rehearsal, production, or T17.
