# T16 CF03 bounded Hosted UI redirect retry

## Sol diagnosis

Two clean UI-proof executions stopped before data work at the same transient
Hosted UI redirect boundary, once in the first logical context and once in the
second. The identical login path has also succeeded in earlier executions. A
fresh-context, one-retry boundary is needed inside one invocation; further
unchanged invocations are not authorized.

## HR01: exact bounded retry

- Create each logical browser context/page in dependency order rather than
  precreating both.
- For each logical `first`/`second` context, permit at most two total attempts,
  each with the existing finite response/login timeout.
- Retry only an exact sanitized `hosted-ui-redirect` failure from attempt 1.
  Never retry form, manage, sentinel, response, baseline UI, load, update,
  stale, poll, restore, or unknown failures.
- Before retrying, drain raw/validation waiters and close the failed context
  exactly once. Use a new context and page; do not reuse storage/cookies/state.
- Retain only the two successful contexts/pages for load/update/stale and final
  cleanup. Close every created context exactly once and the browser once on all
  exits.
- Do not expose attempt URL, errors, credentials, identity, tokens, DOM, or
  request/response values. The existing final category/context remains enough.

## HR02: deterministic coverage

AWS/network-free tests must prove first-attempt redirect failure then success for
both logical contexts; two redirect failures stop after exactly two attempts;
all other categories receive one attempt; waiters are drained; failed and
successful contexts/browser close exactly once; only successful pages reach
load/update/stale; zero data operations occur on terminal setup failure; and no
unhandled rejection or sensitive output occurs.

Run focused/combined T16 tests, `node --check`, `npm run check`, and
`git diff --check`; update the chronological log and commit coherently.

## Stop conditions

Only local helper source, tests, and docs are authorized. No AWS/network/live,
Cognito/S3, deploy/invalidation, IAM/CloudFormation, Firebase, T17, dependency,
or retry of any data/write/recovery operation. Stop for Sol review.
