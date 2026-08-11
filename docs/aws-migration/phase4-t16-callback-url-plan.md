# Phase 4 T16 callback URL capture

Sol plan date: 2026-08-11

## CU01

From the clean handoff, read D055, security, STR02 evidence, callback/session
source and tests. Capture the browser callback URL once during client setup,
before mounted/router normalization, and pass that immutable string to the OIDC
callback on mount. Never persist/log/expose it. Add deterministic lifecycle E2E
proving code/state URL is passed intact while no value reaches output. Preserve
all auth/storage contracts. Run web/admin/root/diff; log/commit. No AWS.

## CU02

After Sol review, web-only deploy once, verify inventories, then auth-only once.
Require all four proofs or stop typed; cleanup zero, no data write/T17.
