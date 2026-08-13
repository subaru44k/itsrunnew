# Phase 3 Sol review

Reviewed commit: `22d7fd5`

Review date: 2026-07-31

Result: changes required before T10

T09 created the intended read-only AWS preview without production DNS,
Firebase, Cognito, API, or administrator writes. The stack, private origins,
data-prefix policy, cache bounds, deterministic fixture, and scoped bootstrap
are directionally correct. T10 remains blocked because the raw browser path
does not yet display schedule data and the deployment cache classification can
mix Nuxt builds.

## Verified good

- `ItsRunPreviewHosting` is `CREATE_COMPLETE` in account `470447451992`,
  region `ap-northeast-1`.
- Distribution `E22K5S8F2NUP6K` uses two private encrypted S3 origins through
  OAC. The data-bucket allow statement is limited to `data/*` and the exact
  distribution.
- Both buckets block public access and enforce TLS; the data bucket is
  versioned.
- HTML returns `no-cache`; schedule JSON returns
  `public, max-age=0, s-maxage=60`; HSTS, CSP, nosniff, frame, referrer, and
  permissions headers are present.
- Direct unauthenticated S3 access and unknown CloudFront routes are denied.
- The two non-production fixture objects match their recorded SHA-256 values.
- AWS managed-policy default version `v2` exactly matches the committed policy.
  No AdministratorAccess, PowerUserAccess, wildcard action, or cross-account
  trust is attached to the CloudFormation execution role.
- Forbidden legacy dependencies remain absent.

## Required findings

### F01: Native browser schedule reads fail

Severity: release blocker

`HttpScheduleRepository` stores native `window.fetch` in a class property and
invokes it as `this.request(...)`. Browser fetch requires the `Window`
receiver, so the actual call fails with:

```text
TypeError: Failed to execute 'fetch' on 'Window': Illegal invocation
```

The committed preview test replaces `window.fetch` with a bound wrapper before
navigation, masking this production defect. A raw Chromium visit to `/en/`
shows `Unable to load schedule`, no `updatedAt`, and zero available cells at
both desktop and mobile widths.

Required:

- Invoke the request function without rebinding its receiver to the repository
  object.
- Add a unit regression test using a receiver-sensitive request function.
- Remove the `page.addInitScript` fetch replacement, fixture pre-warming,
  conditional Retry click, and unconditional E2E retries.
- Prove a first raw navigation renders the fixture without an alert or retry.

### F02: Mutable Nuxt payloads are cached as stable assets

Severity: release blocker

The deployment helper gives every non-HTML, non-`_nuxt` object a one-day cache
and every `_nuxt` object a one-year immutable cache. Live evidence:

```text
/_payload.json             public, max-age=86400; CloudFront Hit
/_nuxt/builds/latest.json  public, max-age=31536000, immutable
```

`_payload.json` and nested route payloads are mutable across builds. Nuxt's
`_nuxt/builds/latest.json` is also a stable name. The default cache policy
does not include query strings in the cache key, so a new build-id query does
not safely separate `_payload.json` versions. This can combine new HTML/JS
with an old payload.

Required:

- Upload HTML, every root/nested `_payload.json`, and
  `_nuxt/builds/latest.json` with `no-cache, no-store, must-revalidate`.
- Keep content-hashed `_nuxt` assets immutable. Treat build-specific
  `_nuxt/builds/meta/<id>.json` as immutable only because the id is in its
  object key.
- Add deterministic tests for object classification and generated AWS
  commands; do not rely on shell output inspection alone.
- Perform one targeted invalidation of only the previously mis-cached payload
  and latest-manifest keys after the corrected upload. A distribution-wide
  invalidation is not approved.
- Verify the corrected headers and that a second build/deploy cannot serve an
  earlier payload.

### F03: Locale URLs and SEO attributes drift from the contract

Severity: release blocker

With browser locale `en-US`, visiting `/` client-navigates to `/en`. The route
contract says Japanese is unprefixed and `/` is the Japanese Oda page; English
is explicitly under `/en/`. Generated HTML currently has no `lang`,
canonical, or alternate/hreflang attributes. The committed E2E forces
`ja-JP`, hiding the root redirect.

Required:

- Disable browser-language auto-redirection. `/` must remain Japanese for
  both `ja-JP` and `en-US`; `/en/` remains the explicit English route.
- Use the installed Nuxt i18n integration to render localized `html lang`,
  canonical, and Japanese/English alternate links for every public route.
- Do not add an SEO dependency or choose/change production DNS in this task.
  Relative alternate URLs or the already-configured site URL may be used
  consistently; if an absolute canonical requires an undecided production
  hostname, stop for Sol.
- Add generated-HTML assertions and raw browser tests for both browser
  locales.

### F04: Error and loading states are not fully localized or proven

Severity: required behavior

The schedule loading string and accessible caption are hard-coded in English,
and repository error text is rendered directly. The remediation contract
requires localized loading, unpublished, invalid-data, network-error,
retained-last-success, and retry states.

Required:

- Represent repository/UI error kinds without exposing raw technical strings.
- Add Japanese and English translations for loading, caption, network,
  invalid-data, unpublished, retained-data, and retry messages.
- Preserve the last successful months on a later failure and state that stale
  data is retained.
- Add unit tests for every state and for a late older response not replacing a
  newer request.

### F05: Deployment verification stops at authenticated S3

Severity: release safety

`deploy-preview.mjs` hashes each uploaded fixture after an authenticated S3
read but never reads the object through the CloudFront distribution. R07 did
manual CloudFront checks, but the deterministic helper required by the plan
does not enforce them.

Required:

- Require `DistributionDomainName` and `DistributionId` in the stack outputs.
- Fetch every fixture object through HTTPS CloudFront after upload, with a
  bounded retry window for propagation, and compare SHA-256.
- Fail on non-200, unexpected content type/cache metadata, timeout, or hash
  mismatch.
- Keep data-bucket deletion and distribution-wide invalidation forbidden.

### F06: CloudFormation execution policy has unused object permissions

Severity: least privilege

The CloudFormation execution role contains `s3:GetObject`, `PutObject`,
`DeleteObject`, and `AbortMultipartUpload` for preview objects. The stack has
no `BucketDeployment` or object resource; application uploads are performed
by the explicit deployment helper under the selected deployment principal,
not by CloudFormation.

Required:

- Remove the entire `PreviewBucketObjects` statement from the repository
  policy.
- Create managed-policy version `v3` only after proving AWS default version is
  still `v2` and matches commit `22d7fd5`.
- Make `v3` default and prove its only difference is removal of that statement.
  Keep `v1` and `v2`; do not add or broaden any action/resource.
- If a subsequent approved CloudFormation operation reports a denial, stop and
  return to Sol rather than restoring permissions speculatively.

## Luna remediation order

Each task ends with focused tests, an `implementation-log.md` update, and a
commit. Do not squash the existing history.

### P3R01: Fix raw browser reads and honest E2E

1. Fix F01 without a dependency.
2. Add the receiver regression test.
3. Remove all fetch replacement, fixture pre-warming, Retry masking, and
   unconditional retries from preview E2E.
4. Assert first navigation shows fixture values and no alert at desktop/mobile
   widths.

Checks:

```bash
npm run test:unit --workspace @itsrun/web
npm run typecheck --workspace @itsrun/web
npm run lint --workspace @itsrun/web
```

Commit: `P3R01 fix native browser schedule reads`

### P3R02: Correct Nuxt cache classification

1. Implement F02 and deterministic command/classification tests.
2. Keep fixture-data caching at `max-age=0, s-maxage=60`.
3. Do not deploy or invalidate yet.

Checks:

```bash
node --check scripts/migration/deploy-preview.mjs
npm run test:unit
```

Commit: `P3R02 correct mutable Nuxt cache metadata`

### P3R03: Restore locale, SEO, and localized states

1. Implement F03 and F04 without a new dependency.
2. Test generated HTML as well as browser behavior.
3. Keep all current compatibility URLs; do not change product-visible content
   except the required localized state text and metadata.

Checks:

```bash
npm run test:unit --workspace @itsrun/web
npm run build --workspace @itsrun/web
npm run lint
npm run typecheck
```

Commit: `P3R03 restore locale SEO and schedule states`

### P3R04: Complete deployment integrity checks

1. Implement F05 with bounded retries and no dependency.
2. Test failure paths without calling AWS.
3. Run the full root checks under Node 24.

Checks:

```bash
npm ci
npm run check
```

Commit: `P3R04 verify preview through CloudFront`

### P3R05: Reduce IAM, redeploy, and verify

Do this only after P3R01-P3R04 pass locally.

1. Reconfirm profile `codex-prod`, account `470447451992`, and region
   `ap-northeast-1`.
2. Implement F06 and create policy `v3` as an exact permission reduction.
3. Build with the corrected cache classification and deploy only to the two
   named preview buckets.
4. Create one targeted invalidation for the mutable Nuxt keys identified from
   the generated build. Do not invalidate `/*`.
5. Run raw preview E2E without browser fetch instrumentation.
6. Verify both browser locales, visible Oda values, headers, S3 denial,
   CloudFront hashes, unknown route/asset behavior, and a second deploy.
7. Record stack/distribution/policy versions and commands without credentials.

Required final commands:

```bash
npm ci
npm run check
PREVIEW_BASE_URL=https://d2via50thoheqm.cloudfront.net npm run test:e2e:preview
git diff --check
git status --short
```

Commit: `P3R05 redeploy corrected CloudFront preview`

After P3R05, stop for Sol Phase 3 re-review. Do not begin T10, Cognito, API,
administrator features, production migration, DNS, or Firebase changes.

## Retained stop conditions

Stop and return to Sol if:

- A new dependency or architecture decision is required.
- Any IAM permission must be added or broadened.
- An absolute canonical requires choosing an undecided production hostname.
- An existing non-preview resource would be replaced or modified.
- A command would write to Firebase, production DNS, or a pre-existing bucket.
- Correcting the cache requires a distribution-wide invalidation.
- The current deployment principal cannot create the targeted invalidation;
  do not add IAM permission without another Sol review.

## Phase 3 final re-review

Reviewed commit: `f270add`

Review date: 2026-07-31

Result: small corrective pass required before T10

The public preview, schedule-state exclusivity, generated SEO contract,
cache metadata, private S3 origins, and managed-policy `v3` are otherwise
accepted. Independent Sol checks passed:

- `npm run check`
- `npx vitest run scripts/migration/deploy-preview.test.mjs` (17 passed)
- raw and isolated-state preview Playwright suites (84 passed)
- account `470447451992`, region `ap-northeast-1`, managed-policy default `v3`
  with `v1`/`v2` retained
- unauthenticated access to both preview S3 buckets returned `403`

T10 remains blocked by the following finite corrections.

### FF01: CloudFront verification timeout does not bound a hung fetch

Severity: release safety

`readCloudFrontObject` checks `timeoutMs` only before and after an awaited
`fetch`. If one request never settles, the function never reaches the deadline
check. A Sol reproduction using a never-resolving injected fetch remained
pending after 100 ms despite `timeoutMs: 10`.

Required:

- Bound the complete CloudFront read attempt, including response-body reading,
  by the remaining overall deadline.
- Abort or otherwise settle the outstanding attempt when the deadline expires.
- Clear timers and avoid unhandled rejections.
- Add a no-network test with a never-resolving fetch proving the function
  rejects within the configured deadline.
- Retain the deterministic max-attempt and fake-clock coverage.

### FF02: Unavailable localized browser state is not exercised

Severity: test-contract gap

The state-machine unit test classifies `unavailable`, and both locale messages
exist, but the separated browser suite exercises only network, invalid, and
unpublished initial responses. RR01 required the mutually exclusive
`unavailable` state to be proven in localized display.

Required:

- Add a simulated non-404 HTTP failure such as `503` to the separated schedule
  state suite.
- For Japanese and English desktop/mobile projects, assert the localized
  unavailable message, Retry button, no unpublished message, and no raw
  technical error.
- Do not change or instrument the raw preview suite.

### FF03: Implementation log mixes C05 and RR03 history

Severity: audit accuracy

The C05 row now reports the later 84-case RR03 run. C05 completed at `9a05a5d`
with the earlier 64-case raw suite; RR03 is the separate 84-case result. The
RR01 row also says only `follow-up` rather than recording `4ee66e8`, and the
first RR03 E2E run that exposed the negative-assertion test defect is omitted.

Required:

- Restore the C05 check count and wording to its state at `9a05a5d`.
- Keep the corrected C05 commit value `9a05a5d`.
- Record RR03's 84-case final pass separately.
- Replace `follow-up` with exact commit `4ee66e8`.
- Truthfully note the first post-deploy run's eight assertion-only failures and
  the subsequent 84-case pass; do not imply a second AWS deployment.

## Final corrective order

1. Fix FF01 and its no-network tests.
2. Fix FF02 in the separated state suite.
3. Fix FF03 and run:

```bash
npm run check
npx vitest run scripts/migration/deploy-preview.test.mjs
PREVIEW_BASE_URL=https://d2via50thoheqm.cloudfront.net npm run test:e2e:preview
git diff --check
git status --short
```

No AWS write is required or approved for this pass. Do not deploy, invalidate,
change IAM/CloudFormation, create policy `v4`, or modify production, DNS, or
Firebase. After these corrections, stop for Sol approval before T10.

## Phase 3 approval

Reviewed commit: `ecd0186`

Review date: 2026-07-31

Result: approved; T10 may begin

Sol independently reran the final gates:

- `npm run check`
- `npx vitest run scripts/migration/deploy-preview.test.mjs` (20 passed)
- `PREVIEW_BASE_URL=https://d2via50thoheqm.cloudfront.net npm run test:e2e:preview`
  (88 passed: raw 64 plus isolated schedule-state 24)
- `git diff --check`

Read-only AWS verification confirmed account `470447451992`, region
`ap-northeast-1`, managed-policy default `v3`, and retained versions `v1` and
`v2`. FF01 bounds never-settling fetch/body work, FF02 covers localized
unavailable display, and FF03 accurately separates C05 and RR03 history.

No further Phase 3 correction is required. Luna may begin T10 in
`implementation-tasks.md`. T11-T17 remain subject to their dependency order and
the documented stop conditions. This approval does not authorize production
DNS changes, Firebase mutation/deletion, broader IAM, a production hostname
choice, or undocumented dependencies.
