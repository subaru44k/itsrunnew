# T16 CF03 immediate authenticated response validation

## Sol diagnosis

The response-diagnosed execution at `abc72ce` reached a status-200 authenticated
GET in the first context and stopped only at `body-read`. The app completed its
callback and signed-in rendering, while the helper deferred `response.json()`
until after manage navigation and sentinel waits. Playwright/CDP response-body
availability need not survive that delay. This is an observation-order defect,
not evidence of an API, authorization, or stored-data failure.

## IR01: immediate validation promise

- When arming the exact authenticated GET response waiter, immediately chain
  the existing exact response validator to it so body reading begins as soon as
  the response is available.
- Attach an immediate rejection consumer to the chained validation promise.
- Preserve that original promise and await its result only after manage return
  and signed-in sentinel succeed.
- On an earlier failure, drain both raw and validation promises without
  unhandled rejection.
- Preserve every exact transport/body/ETag/schema/tuple rule, diagnostic reason,
  first/second context, timeout, and cleanup boundary.

## IR02: deterministic coverage

With AWS/network-free fakes, prove that body validation starts before a delayed
manage/sentinel completion, succeeds when body availability is short-lived, and
still propagates all closed response reasons. Prove late raw/validation rejection
is handled when an earlier stage fails, with one cleanup and zero data-stage
operations. Retain all existing tests.

Run focused/combined T16 tests, `node --check`, `npm run check`,
`git diff --check`, update `implementation-log.md`, and commit coherently.

## Stop conditions

Only local helper source, tests, and documentation are authorized. Do not weaken
validation, add a dependency, or perform AWS/network/live/Cognito/S3/deploy/
invalidation/IAM/CloudFormation/Firebase/T17 operations. Stop for Sol review.
