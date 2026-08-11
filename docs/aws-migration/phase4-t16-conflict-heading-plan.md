# T16 CF03 localized conflict-heading correction

## Sol diagnosis

The saved-state-correct invocation accepted the update and stopped at the stale
checkpoint, then restored and cleaned successfully. The Japanese rendered
conflict heading is the localized `admin.conflict` text beginning
`別の更新があるため保存できませんでした。`; it does not contain the literal
word `競合`. The helper searches the heading by `/conflict|競合/i`, so it cannot
locate the real Japanese heading even when the application reaches the correct
conflict state.

## CH01: exact localized conflict proof

- Update only the baseline VersionId to the current restored value
  `kpbPZRFYYVZbVgHdWlBIEYp2DJAmC4vU`.
- Locate the stable conflict heading using its existing `#conflict-title` ID,
  boundedly wait for visibility, and require exact rendered text equal to one
  of the committed Japanese or English `admin.conflict` locale strings.
- Continue to require a bounded visible, enabled, trial-actionable localized
  rebase/replace action. Do not click the action.
- Preserve the exact stale PUT 409 and comparison GET transport contracts,
  absence of response-body rereads, post-stale protected S3 coupling, public
  observation, one restore, retry, and cleanup boundaries.

## CH02: deterministic coverage

AWS-free tests must accept each exact locale, reject the prior literal-only
assumption, wrong/empty/missing heading text and missing/hidden heading, and
retain delayed/timeout and conflict-action tests. Run focused and combined T16
tests, `node --check`, root `npm run check`, and `git diff --check`; update the
log and commit coherently.

## Stop conditions

Local helper source, tests, and documentation only. No AWS/network/live,
Cognito/S3/recovery-material, deploy/invalidation, IAM/CloudFormation,
dependency, T17, production/DNS, Firebase, or historical-data work. Stop for
Sol review.
