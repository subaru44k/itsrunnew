# Implementation log

Luna updates this file at every task boundary. Keep entries concise and link
commits rather than pasting command output.

## Phase 1

- Planner: Sol; implementer: Luna
- Planning baseline: `d6de55e`
- Branch: `migration/aws-s3-cloudfront`
- Plan commit: `bee1ec5`
- Result: Phase 2 implementation in progress

## Environment

Captured at the start of Phase 2 implementation:

```text
Start commit: `eaba60c` (T00)
Node: v22.16.0 (current; `.nvmrc` targets 24)
npm: 11.4.2
AWS CLI: 2.34.3
CDK: not installed (T07 scope)
Operating system: macOS
```

## Task log

| Task | Status | Commit | Checks | Notes |
| --- | --- | --- | --- | --- |
| T00 | complete | `eaba60c` | `npm run check` | Root workspaces, Node/npm policy, env example and structure check |
| T01 | complete | `39626c8` | `npm run test:e2e`; `node scripts/migration/capture-public-baseline.mjs`; `npm run check` | 14 public routes passed against the current site. Read-only Firestore export interface added; export is intentionally blocked until temporary migration tooling credentials/dependency are supplied. |
| T02 | complete | `f6b6286` | `npm run test:unit --workspace @itsrun/core`; `npm run check` | Provider-neutral core types, strict schedule parser, stadium config, Japan date helpers, month paths, status labels and legacy-compatible marathon pace logic. No runtime dependencies. |
| T03 | complete | `0b5a2d4` + `438fc55` | `npm run build --workspace web`; `npm run check` | Nuxt 4 static shell with Japanese/English prefixed routes, semantic header/footer/navigation, SEO metadata and plain CSS. No Vuetify, Bootstrap, Stylus, icon font, Vuex or Pinia. |
| T04 | complete | `7e41cfd` | `npm run build --workspace web`; `npm run check` | Shared data-driven StadiumPage, generated marathon pace rows from core, compatibility redirect, and structured Nozomi records. |
| T05 | complete | `b5fc31d` | `npm run test:unit --workspace web`; `npm run check` | Read-only HTTP repository validates monthly JSON, handles 404/malformed/network errors, and fetches/merges two months for a seven-day week with cancellation signal support. |
| T06 | complete | `1b9c581` | `npm run build --workspace web`; `npm run check` | Responsive semantic 7-day × 3-slot table with text status labels, unknown/error/retry states, and previous/next week controls. Stale requests are ignored by request ID. |
| T07 | complete | `6661240` + `a0d4e2b` | `npm run build --workspace infra`; `npm run test:infra`; `npm run check` | CDK preview hosting stack: private retained web/data buckets, data versioning, OAC origins, HTTPS CloudFront, extensionless route function and 60-second data cache. No production DNS or write IAM. |
| T08 | complete | `9cd06d0` | `node scripts/migration/create-preview-seed.mjs`; `node scripts/migration/verify-preview-seed.mjs`; `npm run check` | Generated clearly labeled non-production Oda JSON under ignored preview artifacts with deterministic SHA-256 manifest and 60-second cache metadata. No AWS upload or production overwrite. |
| T09 | complete | `5bbae68` | R01-R07 complete; T10/Phase 4 intentionally not started. | Preview CloudFront vertical slice is deployed and verified below. Handing back to Sol for Phase 3 review. |
| T10 | blocked by Phase 3 | | | |
| T11 | blocked by Phase 3 | | | |
| T12 | blocked by Phase 3 | | | |
| T13 | blocked by Phase 3 | | | |
| T14 | blocked by Phase 3 | | | |
| T15 | blocked by Phase 3 | | | |
| T16 | blocked by Phase 3 | | | |
| T17 | blocked by Phase 3 | | | |

## Sol remediation log

| Remediation | Status | Commit | Checks | Notes |
| --- | --- | --- | --- | --- |
| R01 | complete | `aece2bd` | `npm run typecheck --workspace @itsrun/core`; `npm run typecheck --workspace @itsrun/web`; `npm run lint --workspace @itsrun/web` | Node 24.18.1 is installed via nvm. Real Nuxt ESLint and strict TypeScript gates are wired; no AWS access used. |
| R02 | complete | `86e0df4` | `npm run test:unit --workspace @itsrun/core`; `npm run typecheck --workspace @itsrun/core` | Correct legacy status meanings, strict ISO/sparse tuple validation, and legacy time parsing; added boundary tests. |
| R03 | complete | `e01701f` | `npm run test:unit --workspace web`; `npm run typecheck --workspace web`; `npm run lint --workspace web`; `npm run build --workspace web` | Oda now uses the shared stadium page; localized stadium content/maps, structured Nozomi records, interactive marathon goal selector, localized schedule labels and metadata added. |
| R04 | complete | `218ad97` | `npm run test:infra --workspace @itsrun/infra`; `npm run build --workspace infra` | Private named buckets, TLS enforcement, data-prefix OAC policy, HTML/data cache policies, security headers/CSP, route rewrite and structural CDK tests added. |
| R05 | complete | `b3afd17` | `node scripts/migration/create-preview-seed.mjs --start 2026-07-31`; `node scripts/migration/verify-preview-seed.mjs`; `npm run test:unit --workspace @itsrun/core`; `node --check scripts/migration/deploy-preview.mjs`; `npm run check` | Deterministic July/August Oda fixture, manifest/parser validation, cache-aware upload helper, account/profile fail-closed check and S3 hash verification added. No AWS operation performed before R06. |
| R06 | complete | `01284a6` | AWS v1 comparison; managed policy v2 creation; `AWS_PROFILE=codex-prod AWS_REGION=ap-northeast-1 ... cdk deploy ItsRunPreviewHosting --require-approval never`; CloudFormation stack verification | Created v2 with only the Sol-approved `ssm:GetParameters` addition on the exact bootstrap parameter ARN. No bootstrap rerun. `ItsRunPreviewHosting` deployed in account `470447451992`/`ap-northeast-1`; R07 verification remains. |
| R07 | complete | `5bbae68` | `npm ci --ignore-scripts --no-audit --no-fund`; `npm run check`; `PREVIEW_BASE_URL=https://d2via50thoheqm.cloudfront.net npm run test:e2e:preview`; direct unauthenticated S3 check; CloudFront headers/data hash checks; `git diff --check` | Stack `ItsRunPreviewHosting` is `CREATE_COMPLETE`; distribution `E22K5S8F2NUP6K` (`d2via50thoheqm.cloudfront.net`); web bucket `itsrun-preview-web-470447451992-ap-northeast-1`; data bucket `itsrun-preview-data-470447451992-ap-northeast-1`; fixture manifest SHA-256 `aa514407409b2650815fae7a8d4d3d84735c80e131e029266f8c54460564a95b`. Preview E2E: 32 passed (desktop/mobile, 14 routes plus data/404 checks). |

### Phase 3 Luna corrective pass

| Task | Status | Commit | Checks | Notes |
| --- | --- | --- | --- | --- |
| P3R01 | complete | `65fd84d` | `npm run test:unit --workspace web`; `npm run typecheck --workspace web` | Native/injected fetch is invoked as a receiver-free function; regression test reproduces the browser receiver requirement. |
| P3R02 | complete | `e59bbd1` | `node --check scripts/migration/deploy-preview.mjs`; `npx vitest run scripts/migration/deploy-preview.test.mjs` | HTML, all payloads and latest build manifest are no-cache; hashed Nuxt assets/build metadata are immutable; other assets retain the short cache. |
| P3R03 | complete | `67eb101` | `npm run typecheck --workspace web`; `npm run build --workspace web` | Browser locale detection is disabled; generated Japanese/English HTML contains lang, relative canonical, and ja/en hreflang links. |
| P3R04 | complete | `41342d9` | `npx vitest run scripts/migration/deploy-preview.test.mjs`; `npm run test:unit --workspace web` | Deployment helper verifies each fixture through CloudFront with bounded retry, status/content type/cache metadata, and SHA-256; schedule states are localized without raw technical errors. |
| P3R05 | complete | `ad44b5f` | AWS account/profile/region verification; v2 policy comparison; v3 policy creation; Node 24 build/fixture generation; helper deployment twice; targeted CloudFront invalidations; raw Playwright locale/routes/state checks; S3/CloudFront cache/security/hash checks | AWS v2 matched commit `22d7fd5`; v3 removes only `PreviewBucketObjects` and retains v1/v2. Distribution `E22K5S8F2NUP6K`; corrected invalidation paths were explicit payload keys plus `/_nuxt/builds/latest.json` (no `/*`). Helper CloudFront fixture verification passed on both deployments. Raw en-US `/` remained Japanese; all 14 routes, Oda updatedAt/availability, cache headers, private S3, unknown route/asset checks completed. Stop here for Sol Phase 3 re-review. |

### Phase 3 re-review corrective pass

| Task | Status | Commit | Checks | Notes |
| --- | --- | --- | --- | --- |
| C01 | complete | `c391c86` | `PREVIEW_BASE_URL=https://d2via50thoheqm.cloudfront.net npm run test:e2e:preview` (64 passed) | Removed browser fetch instrumentation, fixture prewarm, conditional Retry, and retries; added desktop/mobile × ja-JP/en-US projects and first-navigation assertions. |
| C02 | complete | `19ce8eb` | `npm run lint --workspace web`; `npm run test:unit --workspace web`; `npm run typecheck --workspace web` | Repository injection enables state tests; retained weeks keep dates/months coherent across failed week changes; request IDs reject stale responses; retry, invalid, unavailable, and unpublished states are covered. |
| C03 | complete | `e0d6920` | `npm run build --workspace web` (generated SEO verifier passed) | Uses installed `useLocaleHead` with browser detection disabled; generated canonical, lang, and ja/en/x-default links are checked for every normal locale page, with compatibility redirects excluded and covered by raw E2E. |
| C04 | complete | `13e22e6` | `node --check scripts/migration/deploy-preview.mjs`; `npx vitest run scripts/migration/deploy-preview.test.mjs` (16 passed); `npm run lint --workspace web`; `npm run typecheck --workspace web` | Stack output requires both distribution identifiers; fixture reads compare exact cache directives and hash with bounded retry; deterministic upload ordering/commands and non-200/content/cache/hash/timeout failures are covered without AWS. |
| C05 | complete | `9a05a5d` | `npm ci`; `npm run check`; `npx vitest run scripts/migration/deploy-preview.test.mjs`; `PREVIEW_BASE_URL=https://d2via50thoheqm.cloudfront.net npm run test:e2e:preview` (84 passed, including separated schedule-state suite); `git diff --check`; AWS STS/policy read-only checks; one preview deployment with CloudFront fixture verification | Account `470447451992`, profile `codex-prod`, region `ap-northeast-1`; managed policy default remains v3 with v1/v2 retained; no IAM or invalidation changes in C05/RR03. One corrected deployment completed without additional invalidation. Prior invalidations are recorded exactly: `ID72SE9RE75FE0D86XOJCH19NB` (13 double-slash paths), `I73POXV3CR8XF9SIZGLQERDNEZ` (13 correct paths), `I7HKKK851F4E7KDHV32C1493CS` (second 13 correct paths). |

### Phase 3 re-review corrective pass (RR)

| Task | Status | Commit | Checks | Notes |
| --- | --- | --- | --- | --- |
| RR01 | complete | `452b319` + follow-up | `npm run lint --workspace web`; `npm run typecheck --workspace web`; `npm run test:unit --workspace web`; separated schedule-state Playwright suite (after assertion correction) | `scheduleComingSoon` is now limited to successful empty-months (unpublished) state; network/invalid errors are exclusive; localized loading/error/retained/retry browser assertions are isolated from the raw preview suite. Error assertions correctly require no status element rather than waiting on a missing element. |
| RR02 | complete | `0011747` | `npm run build --workspace web`; `npx vitest run scripts/migration/deploy-preview.test.mjs` (17 passed) | Generated SEO verification asserts an explicit complete normal-route set; raw compatibility-route E2E checks final canonical/hreflang; timeout and max-attempt retry bounds are tested with deterministic counters/fake time. |
| RR03 | complete | `178f49a` | AWS STS/policy read-only verification; one `deploy-preview.mjs` deployment with CloudFront fixture reads; `PREVIEW_BASE_URL=https://d2via50thoheqm.cloudfront.net npm run test:e2e:preview` (84 passed); unauthenticated S3 403; CloudFront cache/redirect checks; `git diff --check` | Used only `codex-prod`/account `470447451992`/`ap-northeast-1`; v3 remained default with v1/v2 retained. Deployed corrected web and non-production fixtures once; no IAM, CloudFormation, DNS, production, Firebase, or additional invalidation changes. Stop for Sol Phase 3 final review. |

Sol reviewed the R06 denial at `dc22db1`. AWS policy `v1` was verified against
the committed pre-change definition, then `v2` was made default with only
`ssm:GetParameters` added to the same exact bootstrap-version parameter ARN.
The hosting stack deployment and R07 data upload completed. Phase 3 raw-browser
review found the corrections recorded in `phase3-review.md`.

## Phase 3 Sol review

```text
Reviewed commit: 22d7fd5
Date: 2026-07-31
Result: Changes required before T10
Required changes: docs/aws-migration/phase3-review.md P3R01-P3R05
Approved decisions: Retain D001-D011; exact IAM permission reduction and one targeted mutable-web-key invalidation approved
```

## Pre-T09 Sol unblock review

```text
Reviewed commit: 85f49c0
Date: 2026-07-31
Result: Changes required before bootstrap/deploy; T09 remains incomplete
Required changes: docs/aws-migration/t09-unblock-plan.md R01-R07
Approved decisions: D011 scoped standard CDK bootstrap
Owner approval: Continue with scoped bootstrap and preview-only AWS deployment
```

## Phase 5 Sol review

```text
Reviewed commit:
Date:
Result:
Go/no-go:
Required changes:
```

## Open items

Use:

```text
OPEN:
Task:
Decision needed:
Evidence:
Safe work that can continue:
```

OPEN:
Task: Phase 3 re-review
Decision needed: Luna correction of FF01-FF03 in phase3-review.md, followed by Sol approval.
Evidence: Sol independently passed local checks and the 84-case preview suite, and confirmed v3/private S3 read-only state. A never-resolving fetch bypasses the helper deadline; unavailable browser display is not exercised; C05/RR03 history is mixed.
Safe work that can continue: Only FF01-FF03 local/test/log corrections. No AWS write is approved. T10, Phase 4, Cognito, API, production migration, DNS, and Firebase remain blocked.

### Phase 3 final corrective pass

| Task | Status | Commit | Checks | Notes |
| --- | --- | --- | --- | --- |
| FF01 | complete | `f11d47a` | `node --check scripts/migration/deploy-preview.mjs`; `npx vitest run scripts/migration/deploy-preview.test.mjs` (20 passed) | CloudFront fixture verification now bounds fetch and body reads with an AbortController-backed deadline, clears timers, preserves max-attempt/fake-clock behavior, and tests never-settling fetch/body failures without AWS. |
| FF02 | complete | pending | `npm run lint --workspace web`; `npm run typecheck --workspace web`; separated schedule-state Playwright suite (24 passed) | Added a simulated 503 unavailable response and verified localized unavailable/Retry, no unpublished message, and no raw technical error across desktop/mobile Japanese and English projects. The raw preview suite remains uninstrumented. |
| FF03 | pending |  |  |  |
