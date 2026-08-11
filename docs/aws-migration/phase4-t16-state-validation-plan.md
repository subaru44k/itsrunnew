# Phase 4 T16 state validation taxonomy

Sol plan date: 2026-08-11

## SV01: exact pre-token validation categories

From the clean handoff, read D053, security, CET03 evidence, OIDC adapter/tests,
and installed oidc-client ResponseValidator. Extend callback classification only
for the exact fixed pre-token messages: state mismatch, missing client ID,
missing authority, authority mismatch, client ID mismatch, and expected code.
Return fixed category constants; never retain/log/emit the message or caught
object. Add hostile near-match tests and preserve all CET boundaries. Run
focused web/auth/admin E2E, root check, diff; log/commit. No AWS.

## SV02: deploy and diagnose

After Sol source acceptance, web-only deploy once with exact gates, accept
unchanged inventories, then auth-only once. Stop at the typed category with
cleanup zero. No retry, data write/rehearsal, IAM/CloudFormation/invalidation,
production, or T17.
