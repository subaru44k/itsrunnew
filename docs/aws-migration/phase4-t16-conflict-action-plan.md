# T16 CF03 unique conflict-action correction

## Sol diagnosis

The localized-heading execution reached an audited stale PUT 409 and its
immediate comparison GET 200. The remaining conflict UI has two actionable
buttons. The helper's broad `/rebase|replace|latest|再適用|置き換え|最新/i`
locator matches both buttons in each locale, so Playwright strict mode cannot
resolve a unique element. API, comparison, and data state are already proven.

## CA01: unique localized action proof

- Update only the baseline VersionId to current restored
  `okeeReQ9zSPKeWWtfb3qyvRC8TYAFM9s`.
- Select exactly one stable nonmutating proof target: the rebase action with
  exact committed label `Keep edits on latest` or
  `最新値へ再適用して編集を維持` according to the rendered locale.
- Require exactly one match, bounded visibility, enabled state, and trial
  actionability. Never perform a real click.
- Continue to require exact localized heading, stale PUT 409, comparison GET
  200, post-stale protected S3 identity, and every existing public/restore/
  retry/cleanup invariant.

## CA02: deterministic coverage

AWS-free tests must model both real conflict buttons and prove the unique
rebase action is selected in Japanese and English; zero/duplicate matches,
wrong labels, hidden/disabled/nonactionable control, and timeout fail; no real
click occurs. Preserve all existing coverage and run focused/combined T16,
`node --check`, root `npm run check`, and `git diff --check`. Update the log and
commit coherently.

## Stop conditions

Local helper source, tests, and docs only. No AWS/network/live, Cognito/S3/
recovery-material, deploy/invalidation, IAM/CloudFormation, dependency, T17,
production/DNS, Firebase, or historical-data operation. Stop for Sol review.
