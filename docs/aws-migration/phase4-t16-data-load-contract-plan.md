# Phase 4 T16 captured-baseline load contract

Sol plan date: 2026-08-11

The corrected CF03 execution reached both authenticated contexts and stopped
at `load` before any data write. The coordinator invoked `adapters.load`
without the captured baseline ETag, while the real browser adapter correctly
requires `load({ etag })`. Existing coordinator fakes ignored their input and
therefore did not expose this contract gap.

## LC01: pass the captured identity

- After exact capture and setup, invoke `load` with exactly
  `{ etag: original.etag }`.
- Do not use a constant or a later read; the value must come from the retained
  captured original in the same run.
- The browser continues to require both independently loaded response ETags to
  equal that exact value and both target tuples to be baseline zero.
- Missing, extra, weak, or mismatched values fail before the update boundary.

## LC02: behavioral contract tests

Replace permissive load fakes with input-validating fakes. Prove the exact
captured ETag is passed once, missing/mismatched load proofs stop with zero
update/stale/restore, and cleanup remains exactly once. Add a concrete boundary
test using a nonconstant captured ETag so a hard-coded baseline cannot pass.
Preserve every DC01-DC03 and LS test.

Run the combined T16 data/auth suite, root check, syntax and diff checks; update
the log, commit, and stop for Sol review. No AWS/network/live operation,
Cognito mutation, API/S3 write, retry, invalidation, deploy, IAM,
CloudFormation, production, DNS, Firebase, or T17 operation is authorized.

