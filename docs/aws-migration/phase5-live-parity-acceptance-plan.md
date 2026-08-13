# Phase 5 live public parity acceptance

## Purpose

Accept the already deployed CloudFront preview as the complete public-site
replacement before any production cutover. This correction is test and
documentation only: the web object set deployed by GitHub Actions run
`31702380832` must not be uploaded again merely to correct stale assertions.

## Starting point

- branch: `migration/aws-s3-cloudfront`
- start commit: the commit containing this plan
- clean worktree
- Node 24
- deployed origin: `https://d2via50thoheqm.cloudfront.net`

## LPA01: truthful raw-route correction

Update only the stale English content markers in
`tests/e2e/preview-public-routes.spec.ts`:

- `/en/pace/marathon` must identify the deployed heading
  `Marathon pace calculator` rather than the case-sensitive generic marker
  `Pace`;
- `/en/nozomiantena/index` must identify `Nozomi Tanaka race records` rather
  than the obsolete pre-parity copy.

Do not add route interception, fixture prefetch, retry masking, Playwright
retries, or relaxed assertions. Record that run `31702380832` deployed the
reviewed web build successfully and subsequently reported exactly 92 passed / 8
failed because these two stale expectations were repeated over four projects.

## LPA02: unmodified-browser live parity contract

Add a separate preview parity suite selected by
`playwright.preview.config.mjs`. It must use the first normal browser navigation
to the live CloudFront pages and must not use `page.route`, fetch replacement,
fixture prefetch, retries, or error masking.

Across desktop/mobile and ja-JP/en-US projects, assert the deployed public
contract at minimum:

- grouped desktop navigation or complete mobile drawer, all public
  destinations, locale-preserving links, and exact footer destination/copy;
- all four stadium pages with the retained headings, editorial landmarks,
  separate schedule/information cards, exact Google map embed source, and Oda
  announcement destination;
- schedule content loads without an alert or Retry and exposes localized
  status content;
- marathon pace exposes three selectable ranges, 19 goal rows, 12 desktop
  columns, the mobile transpose, and successful range switching;
- records expose the two year sections and exactly 60 rows; the Japanese page
  deep-compares every one of the 240 cells with the independent test fixture;
- canonical and ja/en/x-default alternate links stay paired.

Keep screenshot comparison in the existing local parity gate. The live suite
is deterministic semantic evidence and must not create platform baselines.

## LPA03: local and live verification

Run:

```bash
npm run test:e2e -- --grep "public shell|pace feature|records feature|stadium|locale SEO"
npm run check
PREVIEW_BASE_URL=https://d2via50thoheqm.cloudfront.net npm run test:e2e:preview
git diff --check
git status --short
```

Update `implementation-log.md` with exact results and coherent commits. Stop
for Sol inspection. Do not dispatch the deployment workflow again.

## Stop conditions

Stop without changing external state if the live CloudFront content fails an
actual parity assertion, if a web source change is required, or if verification
would require route/network masking. No AWS write, GitHub workflow dispatch,
preview upload, invalidation, IAM/CloudFormation/Cognito operation, production
merge/switch, DNS change, or Firebase change is authorized by this plan.
