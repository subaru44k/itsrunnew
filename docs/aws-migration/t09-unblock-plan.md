# Sol pre-T09 review and Luna remediation plan

Reviewed commit: `85f49c0`

Review date: 2026-07-31

Result: changes required before AWS bootstrap or preview deployment

This is a pre-Phase 3 unblock review. T09 is not complete, so this does not
replace the Phase 3 review required after the CloudFront vertical slice is
working.

## Approved scope

The owner approved continuing with CDK bootstrap and preview deployment after
the local findings below are corrected. Luna may:

- Change only account `470447451992`, region `ap-northeast-1`, using
  `AWS_PROFILE=codex-prod`.
- Create a project-specific managed policy for the CloudFormation execution
  role.
- Run the standard modern CDK bootstrap without `--trust` or cross-account
  principals.
- Deploy the `ItsRunPreviewHosting` stack, upload the generated web build, and
  upload clearly labeled non-production fixture data.

This approval does not include production DNS, Firebase changes, Cognito,
administrator APIs, production Firestore export, or Phase 4 work.

## Consolidated findings

### Release blockers

1. Schedule status meanings drifted. The legacy contract is `0 = unknown`,
   `1 = available`, and `2 = unavailable`; current core labels `0` as
   available and invents a `busy` state.
2. The schedule parser accepts sparse three-cell arrays because `Array.some`
   skips holes. Timestamp validation also accepts non-ISO strings supported by
   `Date.parse`.
3. `parseTime` interprets a legacy value such as `4'15"` as four hours and
   fifteen seconds instead of four minutes and fifteen seconds.
4. Root `/` is a generic landing page instead of the required Oda Field
   schedule and information page.
5. `updatedAt`, the three configured time ranges, and the non-blocking
   unpublished-month message are not rendered.
6. T04 is incomplete: stadium editorial content/maps and the complete Nozomi
   record table were not migrated from the legacy source.
7. Compatibility routing has not been verified for `/index.html`,
   `/komazawa_olympic`, `/nozomiantena/index`, and their English equivalents.
8. The CloudFront rewrite sends every extensionless route to root
   `/index.html`. It must map each static route to its own generated
   `index.html`, while leaving assets, `/data/*`, and `/api/*` untouched.
9. The default CloudFront behavior uses the managed optimized cache instead of
   allowing HTML TTL zero. Security response headers and TLS-enforcing S3
   bucket policies are absent.
10. The generated data-bucket policy allows CloudFront to read every object.
    It must be limited to `data/*` and the distribution ARN.
11. Infrastructure tests only prove that synthesis exits successfully. They
    do not assert bucket separation, public-access blocks, versioning, OAC,
    prefix restriction, route rewrite, HTTPS, cache policies, or headers.
12. The preview seed covers old dates in one month, so the current seven-day
    Oda view cannot demonstrate the two-month vertical slice. Its parser test
    duplicates an inline object instead of validating generated files.
13. There is no deterministic deployment helper, no post-upload hash check,
    and no preview-specific Playwright suite.
14. Root lint and typecheck commands currently succeed without running a
    linter or TypeScript checker in the workspaces.

### Non-blocking limitations to record

- A Firestore export is still unavailable. T09 must use data whose manifest
  says `non-production fixture`; it must never be described as production.
- Current local Node is 22.16.0 and some installed packages require a newer
  22.x release. Luna must use the repository's Node 24 policy for clean
  install and final checks.
- `/api/*` has no origin until the Phase 4 API task. Do not add a dummy API
  origin in T09; the rewrite function must merely exclude the prefix.
- The static Nuxt output contains an inline bootstrap script. The preview CSP
  may allow inline script only for that documented Nuxt requirement; do not
  allow `unsafe-eval` or broad third-party script origins.

## Luna execution order

Each remediation task ends with its focused checks, an
`implementation-log.md` update, and a commit. Do not rewrite or squash the
existing task history.

### R01: Restore real local quality gates

1. Activate Node 24 from `.nvmrc` and record exact Node/npm/CDK versions.
2. Run a clean root `npm ci`.
3. Add only architecture-allowed development tooling needed for actual
   TypeScript and Nuxt-supported ESLint checks.
4. Add `lint` and `typecheck` scripts to applicable workspaces. Root commands
   must execute real checks rather than only `--if-present`.
5. Fix discovered diagnostics without weakening strictness or excluding source
   files.

Checks:

```bash
npm ci
npm run lint
npm run typecheck
```

Commit: `T00 restore lint and typecheck gates`

### R02: Correct and exhaustively test core behavior

1. Correct the status display mapping to the contract in `data-schema.md`.
2. Reject sparse tuples, fractional values, numeric strings, `null`, `-1`,
   extra cells, cross-month dates, impossible Gregorian dates, unknown fields,
   and payloads above 32 KiB.
3. Require a canonical ISO timestamp with a valid instant.
4. Make stadium/month path functions accept typed validated values only.
5. Fix legacy time parsing and add representative first/middle/last pace
   targets from all three legacy selector ranges.
6. Add Japan-midnight, year, month, leap-day, and missing-date immutability
   tests from `test-plan.md`.
7. Complete typed stadium metadata required by `data-schema.md`; do not copy
   translated editorial text into mutable schedule JSON.

Checks:

```bash
npm run test:unit --workspace @itsrun/core
npm run typecheck
```

Commit: `T02 correct core contract boundaries`

### R03: Complete the public Nuxt vertical slice

1. Render Oda through the shared `StadiumPage` at `/`.
2. Migrate all existing stadium editorial text, contact/external links, and
   one lazy Google Maps iframe per stadium. Give every iframe a localized
   title.
3. Migrate the full Nozomi table as structured data, not only two sample rows.
4. Make marathon goal selection interactive and generate all rows from core;
   preserve representative legacy results.
5. Render localized date/status/time-range labels, `updatedAt`, loading,
   unpublished, invalid, network error, retained-last-success, and retry
   states. Status must never rely on color alone.
6. Abort the previous request or retain the existing request-generation guard;
   add a test proving a late older response cannot replace a newer week.
7. Add canonical/alternate SEO metadata and exact compatibility
   redirects/objects for all routes in `current-system.md`. Unknown locales
   must return 404.
8. Keep Vuetify, Bootstrap, Stylus, Moment, Vuex, Pinia, Firebase, icon fonts,
   AdSense wrappers, GA, and PWA dependencies absent.

Checks:

```bash
npm run test:unit --workspace @itsrun/web
npm run build --workspace @itsrun/web
npm run lint
npm run typecheck
```

Commit: `T03-T06 complete public compatibility slice`

### R04: Harden CDK and add structural assertions

Refactor the stack into an importable construct and cover it with CDK
assertions. Implement:

1. Two explicitly named, encrypted, bucket-owner-enforced buckets with Block
   Public Access and `enforceSSL`; data versioning enabled; both retained.
2. OAC-only origins. The data bucket allow statement must use
   `data/*` and the exact distribution ARN. No public principal or website
   endpoint is allowed.
3. A default cache policy with min/default TTL zero so origin `Cache-Control`
   controls HTML/assets.
4. `/data/*` GET/HEAD-only behavior with min TTL zero and maximum/default
   shared-cache age of 60 seconds.
5. HTTPS redirect and a response-header policy containing HSTS, nosniff,
   referrer policy, permissions policy, frame protection, and reviewed CSP.
6. A CloudFront Function with these exact cases:
   - `/` -> `/index.html`
   - `/en/` -> `/en/index.html`
   - `/yumenoshima` -> `/yumenoshima/index.html`
   - `/nozomiantena/index` -> `/nozomiantena/index.html`
   - paths containing a file extension stay unchanged
   - `/data/*` and `/api/*` stay unchanged
   - unknown extensionless routes map to their own missing object, never the
     root shell
7. Outputs for distribution ID/domain and both bucket names.

The infrastructure suite must inspect the synthesized template and test the
rewrite function behavior. Do not accept a test that merely shells out to
`cdk synth`.

Checks:

```bash
npm run test:infra --workspace @itsrun/infra
npm run build --workspace @itsrun/infra
```

Commit: `T07 harden preview hosting`

### R05: Deterministic seed and deployment tooling

1. Generate two current adjacent month documents so a seven-day Oda view
   crosses the boundary. Derive dates deterministically from an explicit
   fixture start argument; do not silently use the machine clock.
2. Validate the actual generated files with the shared core parser.
3. Commit a small source fixture definition, but keep generated deployment
   artifacts ignored.
4. Manifest fields: source=`non-production fixture`, schema version, exact
   object key, source count, date range, byte count, SHA-256, and intended
   cache metadata.
5. Add a deployment helper that requires explicit account, region, profile,
   stack-output file, and fixture-source flags. It must fail closed if STS
   account/region differ.
6. Upload web HTML with `no-cache`, hashed `/_nuxt/*` assets with one-year
   immutable caching, stable images with one-day caching, and schedule JSON
   with `max-age=0, s-maxage=60`.
7. Seed writes are allowed only to the new preview data bucket and fixture
   keys. Never use `--delete` on the data bucket.
8. Read each uploaded data object back through S3 and CloudFront and compare
   SHA-256.

Checks:

```bash
node scripts/migration/create-preview-seed.mjs --start 2026-07-31
node scripts/migration/verify-preview-seed.mjs
npm run test:unit
```

Commit: `T08 make preview seed and deployment deterministic`

### R06: Scoped CDK bootstrap

Do this only after R01-R05 are committed and all local checks pass.

1. Commit the reviewed CloudFormation execution policy JSON under
   `infra/bootstrap/`. It may contain only the S3 actions required for the two
   explicit preview bucket names, the CloudFront actions required by this
   stack, bootstrap-version SSM read, and conditional CloudFront
   service-linked-role creation.
2. CloudFront create/list operations that cannot be resource-scoped may use
   `Resource: "*"`, with the AWS limitation documented beside the policy.
   Do not use `Action: "*"`, `AdministratorAccess`, `PowerUserAccess`, or
   cross-account trust.
3. Create the managed policy
   `ItsRunPreviewCloudFormationExecutionPolicy`, recording its ARN and default
   version.
4. Bootstrap with that policy:

```bash
AWS_PROFILE=codex-prod npx cdk bootstrap \
  aws://470447451992/ap-northeast-1 \
  --cloudformation-execution-policies \
  arn:aws:iam::470447451992:policy/ItsRunPreviewCloudFormationExecutionPolicy
```

5. Verify the `CDKToolkit` stack, bootstrap SSM version, role trust policies,
   attached execution policy, and absence of external trusted accounts.
6. Record that standard bootstrap also creates an empty staging S3 bucket and
   ECR repository. Do not upload application data to them manually.

If the scoped bootstrap or subsequent deployment reports a missing action,
stop and record the exact denied API/resource. Do not broaden the policy
speculatively.

Commit after verification: `T09 record scoped CDK bootstrap`

#### R06 resumed after Sol review

The first deployment attempt stopped at changeset creation because the
CloudFormation execution role lacked `ssm:GetParameters` for the already
approved exact bootstrap-version parameter. Sol reviewed this concrete denial.
Adding only `ssm:GetParameters` beside `ssm:GetParameter` on
`arn:aws:ssm:ap-northeast-1:470447451992:parameter/cdk-bootstrap/hnb659fds/version`
is approved. It is an additional read operation on the same service and exact
resource, not approval for any wildcard action or broader resource scope.

Luna must:

1. Confirm the managed policy still has default version `v1` and that its
   document matches the committed pre-change definition.
2. Create a new managed-policy version from
   `infra/bootstrap/cloudformation-execution-policy.json` with
   `--set-as-default`; do not edit the policy inline and do not delete `v1`.
3. Read back the new default version and prove the only permission difference
   is the approved `ssm:GetParameters` action.
4. Reconfirm account `470447451992`, region `ap-northeast-1`, and profile
   `codex-prod`, then resume the R06 deploy. Do not rerun bootstrap.
5. If another denial occurs, record the exact action/resource and return to
   Sol again without modifying the policy.

### R07: Deploy, verify, and stop for Phase 3

1. Reconfirm STS account/region and a clean worktree.
2. Deploy `ItsRunPreviewHosting` with `--require-approval never` and save CDK
   outputs under ignored artifacts.
3. Build Nuxt, generate/validate the fixture, and run the reviewed deployment
   helper.
4. Verify direct unauthenticated S3 object access is denied.
5. Verify all fourteen public compatibility routes through CloudFront at
   desktop and mobile widths.
6. Verify the Oda table visibly contains fixture values and accessible text.
7. Verify `/data/*` content/hash/cache headers, HTML no-cache behavior, hashed
   asset immutable caching, HTTPS redirect, CSP, HSTS, nosniff, referrer and
   permissions policies.
8. Verify a missing asset and unknown route do not return the root application
   with HTTP 200.
9. Run the full root checks and preview Playwright suite.
10. Update `implementation-log.md` with stack name, distribution domain/ID,
    bucket identifiers, fixture manifest hash, test commands, and exact
    commits. Do not record credentials.

Required final commands:

```bash
npm ci
npm run check
PREVIEW_BASE_URL=https://<distribution-domain> npm run test:e2e:preview
git diff --check
git status --short
```

Commit: `T09 deploy read-only CloudFront vertical slice`

After this commit Luna must stop. Do not begin T10, Cognito, API, administrator
features, production data migration, DNS, or Firebase changes. Switch back to
Sol for the formal Phase 3 review.

## Stop conditions retained

Stop and return to Sol if any of these occurs:

- A new dependency outside the existing architecture allowlist is required.
- The scoped bootstrap/deployment policy needs a new service, wildcard action,
  or materially broader resource scope.
- CDK replacement would affect an existing non-preview resource.
- Fixture data cannot be kept clearly separate from production data.
- Route compatibility requires a product-visible URL or SEO change.
- Any command would write to Firebase, production DNS, or a pre-existing data
  bucket.
