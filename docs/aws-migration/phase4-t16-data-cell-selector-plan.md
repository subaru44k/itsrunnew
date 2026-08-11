# T16 CF03 admin cell selector correction

## Sol diagnosis

The load-corrected CF03 execution at `85a615d` reached the update checkpoint,
but the target object remained at the exact baseline and cleanup completed.
Read-only CloudWatch inspection after an exact STS account/region check found
the two authenticated setup GETs for that execution and no PUT request. The
failure therefore occurred in the browser adapter before the API write.

The admin page renders the target control with the valid HTML id
`2026-08-09-0`. The browser adapter currently selects it with the unescaped CSS
selector `#2026-08-09-0`. A CSS id selector cannot begin with a digit unless it
is escaped, so Playwright rejects or cannot resolve this selector before the
change event and PUT waiter boundary.

## CS01: selector and readiness contract

- Replace the digit-leading CSS id selector with an exact, injection-safe
  locator that does not require CSS identifier escaping, such as an exact
  attribute selector.
- Keep the existing `slotCellId`/rendered id contract unchanged.
- Before changing the value, require the exact cell to be visible, enabled,
  and at the expected baseline value `0` within the existing bounded browser
  timeout.
- After selecting `1`, require the exact value to be selected and require the
  exact localized Save button to become enabled before clicking it.
- Use an exact accessible-name match for Save (`Save` or `保存`) so retry or
  unrelated actions cannot be selected.
- Do not change the API, schedule schema, target object, update/stale/restore
  transaction, authentication, application UI, or AWS resources.

## CS02: deterministic regression coverage

Without AWS or network access, extend the focused data browser tests to prove:

- the digit-leading target id is located without an invalid CSS id selector;
- a delayed-but-bounded cell readiness transition succeeds;
- missing, hidden, disabled, or wrong-baseline cells fail before any PUT;
- selecting the target changes only the expected value;
- a delayed Save enabled transition succeeds and the exact Save control is
  clicked once;
- a missing or disabled Save control fails before any PUT;
- existing exact request/response, stale-conflict, cleanup, and timeout
  contracts remain covered.

Run the focused T16 data tests, the combined T16 auth/data tests,
`node --check`, `npm run check`, and `git diff --check`. Update
`implementation-log.md` and make a coherent commit without squashing history.

## Stop conditions

This authorization is local source, tests, and documentation only. Stop and
return to Sol after CS01-CS02. Do not perform AWS/network operations, create a
Cognito identity, invoke the live rehearsal, write or restore S3 data, deploy,
invalidate CloudFront, change IAM/CloudFormation, access Firebase, begin T17,
add a dependency, or weaken any exact contract. A further live execution
requires a separate Sol review and committed authorization.
