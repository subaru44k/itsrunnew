# Test plan

## Commands to expose at repository root

Luna must make these commands work:

```bash
npm ci
npm run lint
npm run typecheck
npm run test:unit
npm run test:infra
npm run test:e2e
npm run build
npm run check
```

`npm run check` runs lint, typecheck, unit tests, infrastructure tests, and
build. E2E may remain a separate CI job because it installs browsers.

## Unit tests

### Core

- Parse and format all status values.
- Reject every invalid status representation.
- Calculate current Japan date from representative instants around midnight.
- Generate seven dates across month, year, and leap-day boundaries.
- Generate one or two monthly object paths for a week.
- Preserve existing marathon pace results for representative targets.
- Format time values consistently in Japanese and English.
- Validate schedule documents and reject unknown fields.
- Convert missing dates to unknown without mutating source documents.

### Web

- Schedule repository builds only valid, encoded paths.
- Two-month week merges in date order.
- Fetch failure produces error state and retry.
- Locale switching preserves the equivalent route.
- Stadium configuration resolves every supported slug.

### API

- Authorization group parsing.
- Route and header parsing.
- Update DTO validation.
- Server controls `updatedAt`; actor identity appears only as a one-way hash in
  structured audit logs and never in public JSON.
- Conditional write headers map correctly to S3.
- S3 412/409 maps to API 409.
- Missing S3 object maps to 404.
- Unexpected errors are sanitized.
- Logs do not contain token or body.

Use an injected S3 port/fake for unit tests; unit tests must not call AWS.

## Infrastructure tests

CDK assertions verify:

- Two private encrypted S3 buckets.
- Public access blocks on both.
- Data bucket versioning.
- OAC association and restricted bucket policies.
- CloudFront behaviors for default, `/data/*`, and `/api/*`.
- API behavior has caching disabled and forwards required headers.
- Default behavior uses the URL rewrite function.
- HTTPS redirect and response-header policy.
- Cognito authorization-code flow and Google IdP wiring.
- JWT authorizer on all API routes.
- Lambda least-privilege S3 actions and key prefix.
- No Lambda delete permission.
- Finite log retention.

Run `cdk synth` as part of the build and inspect the first synthesized template
manually at the Phase 3 review.

## Browser tests

Run Playwright against a production build, not only a development server.

Desktop and mobile coverage:

- Every route in `current-system.md` returns expected content.
- Redirect routes land at the expected canonical URL.
- Japanese and English navigation work.
- Unknown locale is 404, not an arbitrary-language page.
- Week previous/next controls fetch the correct month paths.
- Week spanning a month requests and merges two documents.
- Status icons include accessible text.
- Loading, empty, error, and retry states render.
- Marathon selector changes calculations.
- Maps are lazy and do not block initial page rendering.
- Admin route redirects to Cognito when unauthenticated.
- Mock authenticated admin can edit a cell.
- Conflict response prompts reload and does not claim success.

Do not run destructive admin E2E tests against production. Use mocked network
responses locally; add an isolated AWS preview integration test only if the
required test administrator and object prefix are explicitly configured.

## Migration tests

- Export the same Firestore snapshot twice and compare hashes.
- Source-document count equals transformed-day count plus documented
  exceptions.
- Every known stadium ID maps to one slug.
- Every output object passes the shared parser.
- Compare legacy and new status for every exported stadium/date/cell.
- Upload to a preview prefix and read it through CloudFront.
- Restore an earlier S3 version and verify its hash.

## Manual checks

- Visual comparison at 375 px and 1280 px.
- Keyboard-only navigation.
- Screen-reader labels for schedule status.
- Google sign-in with an admin and a non-admin account.
- CloudFront maximum 60-second schedule staleness.
- Direct S3 URL denied.
- API response never cached.
- Production CloudFront URL works before DNS cutover.
- AdSense and GA4 behavior only if configured.

## Phase gates

### Phase 3 entry

- T00-T09 complete.
- Root `npm run check` passes.
- Public Oda vertical slice works through the CloudFront preview domain.
- No authentication or production data writes have been enabled.

### Phase 5 entry

- T10-T17 complete.
- All automated checks pass in CI.
- Migration comparison report has zero unexplained differences.
- Admin and non-admin authorization checks pass.
- Rollback rehearsal completed.
- No production DNS change has occurred.
