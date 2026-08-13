# Luna implementation tasks

Execute in dependency order. Each task ends with focused tests and a commit.
Do not begin tasks marked as Phase 4 until the Phase 3 Sol review is recorded
in `implementation-log.md`.

## Phase 2: foundation and read-only vertical slice

### T00: Toolchain and workspace

Depends on: Phase 1

Create:

- Root npm workspaces for `web`, `packages/core`, `services/schedule-api`,
  and `infra`.
- `.nvmrc` using Node 24.
- Root scripts required by `test-plan.md`.
- A single root lockfile for new workspaces.
- `.env.example` with names and comments only.
- GitHub-compatible formatting and lint configuration.

Constraints:

- Do not run `npm audit fix --force`.
- Do not modify or reinstall the legacy `itsrunnew/node_modules`.
- Do not add dependencies outside the architecture allowlist.

Acceptance:

- Clean `npm ci` works for the new root workspace.
- An empty baseline `npm run check` is wired and documented.
- Legacy source remains unchanged.

### T01: Capture compatibility baseline

Depends on: T00

- Add Playwright smoke characterization for current production public routes.
- Capture metadata and screenshots without asserting obsolete advertisement
  timing.
- Add a read-only Firestore export script interface.
- If credentials are unavailable, finish the script and document the exact
  blocked command; do not invent data.
- Record hashes/manifests outside secrets.

Acceptance:

- Current public routes are represented in tests/fixtures.
- No production write occurs.
- Baseline limitations are logged.

### T02: Provider-neutral core

Depends on: T00

Implement `packages/core`:

- Types and constants from `data-schema.md`.
- Exact runtime validators.
- Stadium configuration.
- Japan calendar date-only helpers.
- Week/month path calculation.
- Marathon pace calculation.

Acceptance:

- No runtime dependencies.
- Boundary tests from `test-plan.md` pass.
- All exported functions have explicit types.

### T03: Nuxt shell without UI frameworks

Depends on: T00, T02

Create Nuxt:

- Layout, header, footer and responsive navigation.
- Japanese/English i18n and canonical route strategy.
- SEO metadata for known routes.
- Plain CSS tokens, layout, table and form styles.
- Accessible status visuals using text and local SVG/CSS, not icon fonts.

Migrate assets only when referenced. Optimize or remove duplicate logo assets.

Acceptance:

- No Vuetify, Bootstrap, Stylus, Material Icons, Vuex or Pinia.
- Static generation succeeds.
- All compatibility URLs generate or redirect.
- Mobile and desktop navigation are keyboard accessible.

### T04: Static content and pace pages

Depends on: T03

- Implement data-driven `StadiumPage`.
- Migrate all stadium editorial content and maps.
- Implement marathon pace page from core functions with generated rows.
- Migrate Nozomi records as structured data or content, not repeated hardcoded
  table rows in component logic.
- Implement direct client-only AdSense integration only if production
  advertising remains required and can satisfy CSP.
- Add GA4 only when a new measurement ID is provided.

Acceptance:

- One reusable stadium page component serves four route files.
- No duplicated 19-row/12-column pace markup.
- Existing route content is represented.
- External links and iframe titles are safe and accessible.

### T05: Read-only HTTP schedule repository

Depends on: T02, T03

- Implement monthly JSON fetch and validation.
- Merge weeks spanning two months.
- Model loading, missing, invalid and network-error states.
- Add request cancellation or stale-response protection when rapidly changing
  weeks.
- Display `updatedAt`.

Acceptance:

- No AWS/Firebase SDK in web.
- Repository and composable unit tests pass.
- Rapid next/previous interactions cannot display an older response last.

### T06: Schedule UI

Depends on: T05

- Implement one responsive, semantic schedule table.
- Preserve three slots and seven dates.
- Add visible and screen-reader status labels.
- Implement previous/next week.
- Keep Japan-date behavior independent of viewer time zone.

Acceptance:

- Desktop/mobile Playwright states pass.
- Status is never communicated by color alone.
- Error state has retry.

### T07: CDK hosting and data origins

Depends on: T00

Implement:

- Private web and versioned data buckets.
- OAC and restricted bucket policies.
- CloudFront distribution and cache policies.
- Default-behavior CloudFront Function route rewrite.
- Security headers.
- CDK outputs for distribution and bucket identifiers.
- Deployment helper that assigns correct cache metadata.

Do not configure production DNS yet.

Acceptance:

- Infrastructure assertions pass.
- `cdk synth` passes.
- Direct public bucket access is impossible in the template.
- Deployment role and runtime roles are distinct.

### T08: Seed preview JSON

Depends on: T01, T02, T07

- Transform a validated Firestore export if credentials exist.
- Otherwise create clearly labeled non-production fixture data under a preview
  prefix; never present it as production.
- Upload with deterministic paths and cache metadata.
- Verify hashes after upload.

Acceptance:

- Every uploaded object passes the core parser.
- Manifest records source and SHA-256.
- No unconditional overwrite of existing production-designated data.

### T09: Read-only vertical slice and Phase 3 handoff

Depends on: T03-T08

- Deploy the generated Nuxt application to the preview CloudFront domain.
- Point it at the preview data paths.
- Run `npm run check` and public Playwright smoke tests.
- Update `implementation-log.md`.
- Commit all Phase 2 work.

Acceptance:

- Oda schedule renders through CloudFront and private S3.
- All public static routes render through CloudFront.
- `/data/*` has the intended cache headers.
- No Cognito, administrator write, production DNS, or Firebase mutation is
  active.

Stop and return to Sol for Phase 3.

## Phase 3: Sol review checklist

Sol reviews the exact T09 commit:

- Dependency list and whether any can be removed.
- Core schema/parser and date correctness.
- Nuxt route/SEO compatibility.
- S3 bucket separation, OAC and public-access prevention.
- CloudFront rewrite scope and cache policies.
- IAM actions/resources.
- Preview data provenance.
- Test gaps and plan drift.

Sol records one consolidated change list in `implementation-log.md`. Luna does
not resume Phase 4 until the result is explicit.

## Phase 4: authenticated administration and completion

### T10: Apply Phase 3 findings

Depends on: Phase 3 approval

- Apply the consolidated findings.
- Add or update decision records where architecture changed.
- Rerun all Phase 2 checks.

### T11: Cognito and JWT infrastructure

Depends on: T10

- Add Cognito User Pool, public app client, domain and local-user wiring.
- Authorization Code + PKCE only.
- Add `admins` group and write scope.
- Add API Gateway HTTP API and JWT authorizer.
- Route `/api/*` through CloudFront with cache disabled.
- Parameterize callback/logout URLs; no external IdP secret is required.

Acceptance:

- CDK assertions cover auth flow and every protected route.
- Non-admin tokens cannot meet Lambda authorization.
- No Identity Pool or browser AWS credentials.

### T12: Schedule API

Depends on: T02, T11

- Implement authenticated GET and conditional PUT from `api-spec.md`.
- Use bundled pinned S3 SDK client.
- Validate headers, paths, body and authorization.
- Enforce ETag concurrency.
- Write the server-controlled `updatedAt` field.
- Write only a one-way actor-subject hash and resulting S3 version ID to
  structured audit logs; never put administrator identity in public JSON.
- Return sanitized errors and structured logs.

Acceptance:

- Unit tests cover all API status codes and security cases.
- Lambda role cannot delete or write web content.
- Conflict test proves stored data remains unchanged.

### T13: Administrator UI

Depends on: T06, T11, T12

- Implement OIDC client with in-memory token handling.
- Implement login/logout/callback flow.
- Load editable monthly schedule and ETag.
- Edit 7-by-3 cells using accessible native controls.
- Save with conditional header.
- Handle conflict by preserving unsaved changes and prompting reload/compare.
- Show success only after API success.

Acceptance:

- No Amplify or UI/form framework.
- Admin/non-admin/manual tests pass.
- Tokens never appear in logs or persistent browser storage.

### T14: Full data migration tooling

Depends on: T01, T02, T12

- Complete Firestore read-only export.
- Deterministically transform all source data.
- Compare every cell.
- Upload conditionally.
- Read back and verify hashes/version IDs.
- Produce a machine-readable and human-readable report.

Acceptance:

- Zero unexplained source/output differences.
- Re-running transformation is deterministic.
- Re-running upload cannot silently overwrite.

### T15: CI/CD

Depends on: T10-T14

- GitHub Actions for install, lint, typecheck, unit, infra, build and E2E.
- GitHub OIDC to a branch/repository-restricted AWS role.
- Pull requests validate but do not update production.
- Deployment is explicit and initially targets the CloudFront preview domain.
- Cache metadata is applied by content type.

Acceptance:

- No long-lived AWS credentials in GitHub.
- CI role cannot write schedule data.
- Failed checks block deployment.

### T16: Operational verification

Depends on: T11-T15

- Execute all manual checks from `test-plan.md`.
- Test approved admin and authenticated non-admin Cognito local accounts.
- Rehearse an S3 version restore.
- Verify CloudWatch logs and required alarm.
- Complete the cutover and rollback runbook with actual resource identifiers
  stored outside secrets.

Acceptance:

- Rollback rehearsal evidence exists.
- Direct S3 access is denied.
- CloudFront freshness and API no-cache behavior are observed.

### T17: Legacy removal plan, not production deletion

Depends on: T16

- Identify every legacy dependency/file to remove after cutover.
- Remove legacy application from the migration branch only when new build,
  test and data comparison are complete.
- Preserve a Git tag/commit reference for rollback.
- Do not delete the Firebase project.

Acceptance:

- Final dependency tree contains no explicit removal-list package.
- Root clean install has no legacy Vue/Firebase dependency.
- Historical source remains recoverable from Git.

Commit and return to Sol for Phase 5.

## Phase 5: final Sol review

Sol verifies:

- Diff from the Phase 1 planning commit.
- All decision deviations.
- Dependency tree.
- Security and IAM checklist.
- Auth flows and API validation.
- Migration comparison report.
- Test and CI evidence.
- CloudFront headers, caching and routing.
- Actual rollback rehearsal.
- No production DNS change or Firebase deletion occurred prematurely.

Sol returns `go`, `go with listed conditions`, or `no-go`.

## Stop conditions

Luna pauses and asks for Sol review only when:

- A requirement conflicts with actual production data or AWS capability.
- A new runtime dependency appears necessary.
- The data schema or API contract must change.
- A broader IAM permission seems necessary.
- Token persistence seems necessary.
- Production data must be overwritten, deleted, or dual-written.
- Production DNS or Firebase state must change before Phase 5.
- A route or SEO contract cannot be preserved.
- The implementation cannot meet a release-blocking security requirement.

For a stop, document evidence and safe work that can continue in
`implementation-log.md`. Do not silently choose a broader architecture.
