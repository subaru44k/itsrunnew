# T16 CF03 authenticated response diagnostic correction

## Sol diagnosis

The diagnosed execution at `60cb08e` reached the first context's authenticated
API response boundary. Read-only Lambda audit evidence contains exactly one
matching GET with status 200, so Hosted UI, callback, signed-in state, request
forwarding, JWT authorization, Lambda invocation, and S3 read all completed.
The remaining failure is within the local response validator, which currently
collapses URL/header, body read/shape, ETag, schedule schema, and reserved tuple
checks into one category.

## RD01: closed response reason

- Add a closed non-sensitive reason allowlist under the existing
  `authenticated-api-response` category: `transport-contract`, `response-missing`,
  `body-read`, `body-shape`, `etag`, `schedule-schema`, and `reserved-tuple`.
- The validator must emit only one of these reasons; preserve no observed value,
  URL, header, payload, error, identity, or credential.
- Preserve the successful return contract and all exact validation rules.
- Carry the reason through the browser adapter/coordinator/direct output only
  when category is `authenticated-api-response`; all other failures must omit
  it.

## RD02: deterministic coverage

Using AWS/network-free response fakes, prove every reason independently for both
context ordinals and prove hostile exceptions collapse without leakage. Assert
the exact result key set, no data-stage operation, one cleanup, drained waiter,
and no unhandled rejection. Retain all existing success/negative validator and
T16 tests.

Run focused/combined T16 tests, `node --check`, `npm run check`,
`git diff --check`, update `implementation-log.md`, and commit coherently.

## Stop conditions

Only local helper source, tests, and documentation are authorized. No AWS or
network operation, live execution, Cognito/S3 mutation, deploy/invalidation,
IAM/CloudFormation, Firebase, T17, dependency, or validation weakening is
authorized. Stop after RD01-RD02 for Sol review.
