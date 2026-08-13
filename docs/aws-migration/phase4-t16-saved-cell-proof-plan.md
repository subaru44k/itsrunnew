# T16 CF03 saved-cell proof correction

## Sol diagnosis

The corrected execution produced one Lambda-audited PUT 200, then stopped at
the update boundary and restored successfully. The deployed manage page renders
the schedule table for `saved`, but `canEdit` is true only for `ready` and
`missing`; therefore every select is intentionally disabled after save. The
helper reused its pre-save `awaitReady` assertion after the localized saved and
metadata proof, incorrectly requiring the saved cell to remain enabled. This is
a deterministic mismatch between the proof and the application state.

## SC01: exact saved-state cell proof

- Update the committed baseline VersionId only to the current restored value
  `R4ErT.g1nIVo6tcP4KrDX5gen94BwMON`; keep every other baseline property exact.
- Preserve pre-edit and changed-draft actionability checks exactly: before save
  the target select must be visible, enabled, actionable, and have the expected
  value.
- After the PUT 200, localized saved status, and metadata visibility, require
  the target select to be visible with exact value 1 and disabled, matching the
  real `saved` state. Do not click or require actionability after save.
- Keep exact request/response transport, immediate protected S3 readback,
  stale-conflict, public observation, conditional restore, bounded retry, and
  cleanup contracts unchanged.

## SC02: deterministic coverage

AWS-free tests must prove a visible disabled value-1 cell is accepted only in
the post-save state; enabled, hidden, missing, or wrong-value saved cells fail;
the same cell remains required to be enabled/actionable before the PUT; and all
existing no-body-read, exact S3 coupling, recovery, retry, and cleanup tests
remain passing.

Run focused and combined T16 tests, `node --check`, root `npm run check`, and
`git diff --check`; update the chronological log and commit coherently.

## Stop conditions

Only local helper source, tests, and documentation are authorized. No AWS or
network call, live invocation, Cognito/S3 mutation, deployment/invalidation,
recovery-material operation, IAM/CloudFormation, dependency, T17,
production/DNS, Firebase, or historical-data work. Stop for Sol review.
