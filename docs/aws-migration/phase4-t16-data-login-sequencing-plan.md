# Phase 4 T16 data-login sequencing recovery

Sol plan date: 2026-08-11

The one authorized CF03 invocation at `e9679d7` stopped before the data-write
boundary. The protected object and final identity counts are unchanged. The
source pre-armed both independent pages' default 30-second API response
waiters, then authenticated the pages sequentially. The second waiter's clock
therefore ran during the first login and its not-yet-awaited rejection could
escape before normal cleanup. Correct this sequencing locally before any new
live authorization.

## LS01: per-page response ownership

- Start the exact origin/path/GET waiter only immediately before navigating
  and authenticating that same page.
- Attach/await it in that page's control flow; never retain an unobserved
  rejecting promise while another page is processed.
- Use an explicit, injectable finite response timeout (default 90 seconds).
- Validate and store that page's exact authenticated response before starting
  the next page. Preserve two independent contexts and baseline documents.
- On any page failure, leave the browser adapter cleanup-capable; do not create
  another context, retry login, or mask the typed failure.

## LS02: deterministic regression and cleanup tests

Add AWS-free tests proving the second page's waiter is not created until the
first page has completed validation, each waiter receives the exact finite
timeout, a first/second-page timeout produces no unhandled rejection, and all
created pages/contexts/browser instances close exactly once. Through the
coordinator/concrete boundary, prove setup failure performs identity cleanup,
does not call update/stale/restore, and retains no credential material. Keep
the DC01-DC03 contract and all existing tests.

Run the combined T16 data/auth suite, root check, syntax and diff checks; update
the implementation log, commit, and stop for Sol review. No AWS/network/live
operation, Cognito mutation, API/S3 write, retry, invalidation, deploy, IAM,
CloudFormation, production, DNS, Firebase, or T17 operation is authorized.

