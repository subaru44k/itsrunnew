# T16 CF03 data setup diagnostic correction

## Sol diagnosis

The selector-corrected one-shot execution at `861395b` stopped at `setup`,
cleaned its temporary identity, and left the exact data baseline unchanged.
Read-only Lambda audit inspection found no API GET for that execution. The
current data coordinator collapses every browser login/setup failure into the
single category `typed-failure`, so another identical live invocation would
not distinguish Hosted UI redirect, form submission, callback/manage return,
signed-in hydration, or the authenticated GET waiter.

## SD01: allowlisted browser setup failure proof

- Define a closed allowlist of non-sensitive setup substages using existing T16
  auth terminology: Hosted UI redirect, form submission, manage return,
  signed-in sentinel, and authenticated API response/validation.
- Preserve only the allowlisted category and context ordinal (`first` or
  `second`) across the browser adapter and data coordinator boundary.
- Do not expose URL/query values, username, password, Cognito username, token,
  claims, DOM, request/response body, raw error, stack, bucket, or key.
- Keep the existing sanitized successful proof and all cleanup/recovery
  behavior unchanged.
- Do not add a live diagnostic flag or any new runtime dependency.

## SD02: deterministic coverage

Using AWS/network-free fakes, prove every allowed substage maps to the exact
sanitized category and context ordinal, while hostile/raw thrown values collapse
to a generic allowlisted category without leakage. Prove failure in either
context performs exactly-once cleanup, creates no PUT waiter, and leaves all
update/stale/restore operations uncalled. Retain the existing delayed waiter
rejection and zero-unhandled-rejection coverage.

Run focused and combined T16 tests, `node --check`, `npm run check`,
`git diff --check`, update `implementation-log.md`, and commit coherently
without squashing.

## Stop conditions

This plan authorizes only local source, test, and documentation changes. Do not
perform AWS/network access, a live diagnostic or rehearsal, Cognito mutation,
S3 write/restore, deploy/invalidation, IAM/CloudFormation, Firebase, T17, or add
a dependency. Stop after SD01-SD02 for Sol review.
