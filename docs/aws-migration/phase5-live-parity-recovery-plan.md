# Phase 5 live schedule parity recovery

## Starting point

- branch: `migration/aws-s3-cloudfront`
- start commit: the commit containing this plan
- clean worktree and Node 24
- D058 accepted

## LPR01: private-origin absence contract

Update `HttpScheduleRepository` so only 403 and 404 responses from its fixed,
typed public data path return `null`. Add receiver-safe, dependency-injected
unit tests proving:

- 403 and 404 become an absent month;
- 401 and representative 5xx remain sanitized unavailable failures;
- invalid successful JSON remains an invalid-data failure;
- the existing receiver-sensitive fetch contract is unchanged.

No other status or raw response body may be exposed to the DOM or logs.

## LPR02: exact live unpublished assertion

Keep `preview-live-parity.spec.ts` an unmodified-browser suite. For Oda, retain
the loaded schedule/status assertion. For Yumenoshima, Komazawa, and Todoroki,
assert the exact localized unpublished message, no alert, and no Retry button
across all four projects. Do not add route/fetch interception, fixture
prefetch, retries, masking, or screenshots.

## LPR03: local gate and reviewed deployment

Run the focused repository tests, `npm run check`, the local parity suite,
`git diff --check`, and `git status --short`; update `implementation-log.md`
and commit coherent changes. Stop for Sol review.

After Sol acceptance, one web-only deployment of the reviewed commit through
the existing OIDC workflow is authorized. It must not upload data, invalidate
CloudFront, or change AWS infrastructure/IAM. Then run the complete raw/live
preview suite directly against
`https://d2via50thoheqm.cloudfront.net` and record exact results.

## Stop conditions

Stop on any new dependency, status mapping beyond D058, raw technical error
exposure, local test failure, data upload need, invalidation need, AWS/IAM/
CloudFormation change, or any post-deploy parity failure. Production cutover,
DNS, Cognito administration, and Firebase changes remain stopped until Sol
accepts the deployed result.
