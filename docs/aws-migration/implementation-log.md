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
| T10 | complete | `40c07f3` | Node 24.18.1: `npm run check`; `npx vitest run scripts/migration/deploy-preview.test.mjs` (20 passed); `PREVIEW_BASE_URL=https://d2via50thoheqm.cloudfront.net npm run test:e2e:preview` (88 passed); `git diff --check` | Confirmed all Phase 3 P3R/C/RR/FF findings are closed with no new dependency or architecture change. Phase 4 may proceed to T11. |
| T11 | blocked by stop condition | `8d6de28` | Read-only repository/config inspection; no AWS write attempted | Cognito/Google federation cannot be safely parameterized for deployment: no Google client ID or secret reference, Cognito domain prefix, callback/logout URLs, or administrator configuration is provided. `.env.example` contains only an empty `NUXT_PUBLIC_SITE_URL` and `/api/v1`; no undocumented value was inferred. T11 and dependent T12-T17 are paused pending the exact configuration and authority. |
| T11-local | local implementation complete; awaiting Sol IAM review | `3c9fba3` | Node 24.18.1: `npm run check` (passed); `npm run test:infra --workspace @itsrun/infra` (5 passed); `npm run build --workspace @itsrun/infra` / CDK synth (passed); `git diff --check` (passed) | Sol configuration contract is now explicit. Added parameterized Cognito User Pool/Google IdP/domain/app client, empty `admins` group, HTTP API JWT authorizer/protected route contracts, and CloudFront `/api/*` no-cache behavior. The prior T11 stop record at `8d6de28` is retained above. No AWS API/write, deploy, bootstrap, or managed-policy v4 operation was performed. T11 remains incomplete until Sol reviews the synthesized IAM requirements and a later approved deployment/integration test. |
| T11R01 | complete; awaiting remaining Sol review items | `4bccdd6` | `npm run test:infra --workspace @itsrun/infra` (6 passed) | Replaced the managed all-viewer API origin request policy with a stack-owned allow-list policy. Authorization is forwarded through a stack-owned zero-TTL cache policy as required by CloudFront; Content-Type, If-Match, and If-None-Match use the origin request policy. Cookies and query strings remain disabled. No AWS operation was performed. |
| T11R02 | complete; awaiting remaining Sol review items | `1f4dd3a` | `npm run test:infra --workspace @itsrun/infra` (7 passed) | Added an API-only viewer-request method filter. GET, PUT, and OPTIONS pass; HEAD, PATCH, POST, and DELETE return 405 with the exact Allow header. The public route rewrite function is unchanged. No AWS operation was performed. |
| T11R03 | complete; awaiting remaining Sol review items | `97af556` | `npm run test:infra --workspace @itsrun/infra` (8 passed) | Added parameterized local-development CORS limited to one origin and the four API headers, with GET/PUT/OPTIONS only and no credentials wildcard. Enabled Cognito User Pool deletion protection while retaining CloudFormation. No AWS operation was performed. |
| T11R04 | complete; awaiting remaining Sol review items | `c63f159` | `npm run test:infra --workspace @itsrun/infra` (9 passed) | Added the parameterized Cognito auth base URL to CSP `connect-src` and outputs for auth base URL, issuer, User Pool ID, and app-client ID. No Google endpoint wildcard or AWS operation was introduced. |
| T12 | blocked by T10/T11 | | | |
| T13 | blocked by T10-T12 | | | |
| T14 | blocked by T10-T12 and migration credentials | | | |
| T15 | blocked by T10-T14 | | | |
| T16 | blocked by T11-T15 | | | |
| T17 | blocked by T16 | | | |

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
| C05 | complete | `9a05a5d` | `npm ci`; `npm run check`; `PREVIEW_BASE_URL=https://d2via50thoheqm.cloudfront.net npm run test:e2e:preview` (64 passed); `git diff --check`; AWS STS/policy read-only checks; one preview deployment with CloudFront fixture verification | Account `470447451992`, profile `codex-prod`, region `ap-northeast-1`; managed policy default remains v3 with v1/v2 retained; no IAM or invalidation changes in C05. One corrected deployment completed without additional invalidation. Prior invalidations are recorded exactly: `ID72SE9RE75FE0D86XOJCH19NB` (13 double-slash paths), `I73POXV3CR8XF9SIZGLQERDNEZ` (13 correct paths), `I7HKKK851F4E7KDHV32C1493CS` (second 13 correct paths). |

### Phase 3 re-review corrective pass (RR)

| Task | Status | Commit | Checks | Notes |
| --- | --- | --- | --- | --- |
| RR01 | complete | `452b319` + `4ee66e8` | `npm run lint --workspace web`; `npm run typecheck --workspace web`; `npm run test:unit --workspace web`; separated schedule-state Playwright suite (after assertion correction) | `scheduleComingSoon` is now limited to successful empty-months (unpublished) state; network/invalid errors are exclusive; localized loading/error/retained/retry browser assertions are isolated from the raw preview suite. Error assertions correctly require no status element rather than waiting on a missing element. |
| RR02 | complete | `0011747` | `npm run build --workspace web`; `npx vitest run scripts/migration/deploy-preview.test.mjs` (17 passed) | Generated SEO verification asserts an explicit complete normal-route set; raw compatibility-route E2E checks final canonical/hreflang; timeout and max-attempt retry bounds are tested with deterministic counters/fake time. |
| RR03 | complete | `178f49a` | AWS STS/policy read-only verification; one `deploy-preview.mjs` deployment with CloudFront fixture reads; first post-deploy E2E 76 passed/8 assertion failures; corrected test-only run 84 passed; unauthenticated S3 403; CloudFront cache/redirect checks; `git diff --check` | Used only `codex-prod`/account `470447451992`/`ap-northeast-1`; v3 remained default with v1/v2 retained. The first 8 failures were caused by the test's negative assertion waiting for an absent status element. The assertion was corrected without redeployment; the single AWS deployment remained the only deployment and no additional invalidation was performed. |

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

## Phase 4 T11 Sol review

```text
Reviewed commit: 5f1d593
Date: 2026-07-31
Result: Local corrections required before IAM policy v4 or AWS deployment
Required changes: docs/aws-migration/phase4-t11-review.md T11R01-T11R06
AWS authority: None; local implementation, tests, documentation, and synth only
```

```text
Second review target: f4f0267
Date: 2026-07-31
Result: T11R01-R04 and T11R06 accepted; T11R05 assertion coverage incomplete
Required local correction: phase4-t11-review.md T11RR01
AWS evidence: codex-prod/account 470447451992/ap-northeast-1; managed policy default v3; configured Google secret name not found
AWS authority: None; test/documentation-only correction is authorized
```

```text
Final local review target: 8cd8709
Date: 2026-07-31
Result: T11RR01 accepted; local T11 source and assertion contract approved
Independent check: Node 24.18.1; infrastructure tests 9 passed; infra source/resource graph unchanged
Blocker: exact Google OAuth secret ARN and non-secret Google OAuth client ID have not been supplied
AWS authority: None; no AWS operation, secret read, policy v4, deploy, or T12 authorization
```

```text
D012 owner approval: 2026-08-08
Planning base: 1cd7c42
Decision: replace un-deployed Google federation with Cognito local users
Plan: docs/aws-migration/phase4-t11-local-auth-plan.md T11L01-T11L04
Removed blocker: Google OAuth client ID and Google client secret are no longer required
AWS authority: None; local source/test/documentation/synth correction only
```

### Phase 4 T11 local-user transition

| Task | Status | Commit | Checks | Notes |
| --- | --- | --- | --- | --- |
| T11L01 | complete | `9218d84` | infra tests (9 passed) | Removed the undeployed Google parameters, Google User Pool IdP, Secrets Manager dynamic reference, and provider dependency. The public app client now uses Cognito local users only. No AWS operation occurred. |
| T11L02 | complete | `9218d84` | infra tests (9 passed) | Updated semantic assertions for zero external IdPs, zero Identity Pools, no Google/Secrets Manager template content, COGNITO-only provider, and preserved T11R/T11RR contracts. |
| T11L03 | complete; awaiting Sol IAM review | `23f1905` | infra synth | Corrected synth has no Google IdP or secret parameter. Candidate execution permissions are reduced to local Cognito lifecycle plus the existing API Gateway/CloudFront/S3/SSM scope; no policy file was changed. |
| T11L04 | complete; awaiting Sol IAM review | `23f1905` | Node 24; infra tests (9 passed); infra synth | Local source, tests, documentation, and synth are complete. No dummy ApiIntegrationUri, AWS write, deploy, invalidation, or T12 implementation was performed. |

```text
Sol D012 implementation review target: 49d4301
Date: 2026-08-08
Result: local-user resource transition accepted; T11L05 assertion correction required
Independent checks: Node 24.18.1; infra tests 9 passed; infra synth; npm run check; git diff --check; clean worktree
Deployment decision: implement T12 locally and review one combined T11/T12 graph before first auth/API deployment
Authorized next work: docs/aws-migration/phase4-t12-plan.md T11L05 then T12A-T12F
AWS authority: None; no policy v4, IAM change, deploy, preview mutation, T13, DNS, or Firebase work
```

Corrected synthesized resource types are: two S3 buckets and bucket policies;
CloudFront distribution, three cache policies, OriginRequestPolicy, two
CloudFront Functions, two OACs, and response headers policy; Cognito UserPool,
UserPoolClient, UserPoolDomain, UserPoolGroup, and UserPoolResourceServer; and
API Gateway V2 API, stage, JWT authorizer, integration, and two routes. The
template parameters are now only `ApiIntegrationUri`, `BootstrapVersion`,
`CallbackUrls`, `CognitoDomainPrefix`, `LocalDevelopmentOrigin`, and
`LogoutUrls`.

The remaining candidate CloudFormation execution permissions are limited to
the local Cognito resource lifecycle (`cognito-idp` UserPool, app client,
domain, resource server, and group operations), the already reviewed
CloudFront/S3/SSM operations, and API Gateway V2 API/stage/authorizer/
integration/route operations. Resource ARNs must be narrowed to the preview
User Pool and API graph wherever AWS supports it; create/list operations that
cannot be resource-scoped require an explicit service limitation in Sol's
policy review. No `cognito-idp` identity-provider actions,
`secretsmanager:GetSecretValue`, Lambda, IAM role, or `iam:PassRole` action is
included in this candidate set.

### Phase 4 T11 corrective pass

| Task | Status | Commit | Checks | Notes |
| --- | --- | --- | --- | --- |
| T11R01 | complete; awaiting Sol IAM review | `4bccdd6` | infra tests (6 passed) | Replaced the managed all-viewer origin policy with a stack-owned origin request policy. Cookies and query strings are not forwarded; the zero-TTL API cache policy carries Authorization as required by CloudFront's header-forwarding constraint. |
| T11R02 | complete; awaiting Sol IAM review | `1f4dd3a` | infra tests (7 passed) | Added an API-only viewer-request function that permits GET/PUT/OPTIONS and returns 405 with the exact Allow header for the other four methods. Public route rewrite behavior is unchanged. |
| T11R03 | complete; awaiting Sol IAM review | `97af556` | infra tests (8 passed) | Added parameterized LocalDevelopmentOrigin CORS with the exact API headers/methods and enabled Cognito deletion protection while retaining the user pool. |
| T11R04 | complete; awaiting Sol IAM review | `c63f159` | infra tests (9 passed) | Added parameterized Cognito auth-base/issuer outputs and the Cognito token origin to connect-src without adding Google endpoints or broad wildcards. |
| T11R05 | complete; awaiting Sol IAM review | `0d6a390` | infra tests (9 passed) | Reworked assertions to locate resources by type and stable properties, and asserted JWT, route, OAuth, secret-reference, no-identity-pool, cache, and T11R01-T11R04 contracts. |
| T11R06 | complete; awaiting Sol IAM review | `26e2528` | infra tests (9 passed); infra CDK synth; no deprecation warnings | Replaced deprecated addDependency calls with addResourceDependency and made the API stage depend on its final routes, removing the incorrect integration/authorizer-to-stage dependency direction. |

The corresponding log updates were committed as `17f2b28`, `5ad3ea2`,
`73b080b`, and `b07af4e` for T11R01-T11R04. T11 remains local-implementation
complete and is not marked complete: Sol must review the minimum IAM actions
and resources before any AWS write or policy v4.

| T11RR01 | complete; awaiting final Sol IAM review | `7780bae` | `npm run test:infra --workspace @itsrun/infra` (9 passed) | Strengthened only infrastructure assertions: exact route-key set, route authorizer/integration references, stack-owned API cache/origin policy references, exact Secrets Manager dynamic reference, and parameterized OAuth client URLs. `infra/bin/app.mjs` and the synthesized resource contract were unchanged; no AWS operation was performed. |

### Phase 4 T12 local implementation

| T11L05 | complete; awaiting Sol IAM review | `52b8505` | infra tests (9 passed); infra synth; git diff --check | Added semantic assertions for the single `itsrun` resource server, its sole `schedule.write` scope, the detected resource-server Ref in app-client scopes, and code-only public-client settings. No AWS operation occurred. |
| T12A | complete; awaiting Sol review | `d4de50a` | core unit tests (6 passed); schedule-api unit tests (5 passed); typecheck; build | Added dependency-injected TypeScript handler/store boundaries, typed schedule key construction, exact-pinned S3 SDK and esbuild dependencies, and no public-web AWS SDK. |
| T12B | complete; awaiting Sol review | `d4de50a` | schedule-api unit tests (5 passed) | Implemented payload 2.0 event handling for authenticated GET/PUT, schema/path/body/header validation, conditional S3 mapping, server timestamps, ETag/version responses, no-store responses, and sanitized errors. |
| T12C | complete; awaiting Sol review | `d4de50a` | schedule-api unit tests (5 passed) | Restricted authorization checks to access tokens with `itsrun/schedule.write` and the `admins` group; logs use only the documented allowlist with hashed actor subject. |
| T12D | complete; awaiting Sol review | `ac48e17` | schedule-api unit tests (6 passed) | Added AWS-free tests for auth, validation, missing/invalid data, conditional create/update, conflict sanitization, no-store output, and forbidden raw claim exposure. |
| T12E | complete; awaiting Sol review | `c0efdc6` | infra tests (10 passed); infra synth | Replaced the URI parameter with a bundled Node.js 24 Lambda, explicit retained LogGroup, dedicated role, exact data-object S3 permissions, API invoke permission, and bounded stage throttling. No AWS write occurred. |
| T12F | local implementation complete; awaiting Sol minimum-IAM review | `ac48e17` | Node 24: `npm ci`; core unit (6 passed); schedule-api unit (6 passed); schedule-api typecheck/build; infra tests (10 passed); infra build; `npm run check`; `git diff --check`; clean status | Final local source, tests, documentation, and CDK synth completed. AWS deployment, policy v4, preview mutation, and integration verification remain intentionally blocked. |

```text
Sol T12 review target: 98a03f4
Date: 2026-08-08
Result: local corrections required before minimum-IAM policy v4 or AWS deployment
Independent checks: Node 24.18.1; schedule-api unit tests 6 passed; infra tests 10 passed; git diff --check
Release blocker: lower-camel ifMatch/ifNoneMatch are spread into PutObjectCommand, but AWS SDK serializes only IfMatch/IfNoneMatch; the current deployed write could therefore be unconditional
Additional corrections: exact API error envelope/codes, client-validation 400 mapping, bounded streaming S3 reads, full AWS-free test matrix, audit allowlist, exact PUT throttling and stronger IAM/invoke assertions
Required work: docs/aws-migration/phase4-t12-review.md T12R01-T12R06
AWS authority: None; no policy v4, IAM change, deploy, preview mutation, T13, DNS, Firebase, or production operation
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
Task: Phase 4 T10
Decision needed: None for documented Phase 4 work; follow dependency order and stop before work that needs external configuration or broader authority.
Evidence: Sol approved Phase 3 at `ecd0186` after independently passing root checks, helper 20 tests, preview E2E 88 tests, and confirming managed-policy v3 with v1/v2 retained.
Safe work that can continue: T10, then T11-T17 in documented dependency order as each prerequisite completes. Production DNS and Firebase mutation remain forbidden before Phase 5; all stop conditions remain active.

### Phase 3 final corrective pass

| Task | Status | Commit | Checks | Notes |
| --- | --- | --- | --- | --- |
| FF01 | complete | `f11d47a` | `node --check scripts/migration/deploy-preview.mjs`; `npx vitest run scripts/migration/deploy-preview.test.mjs` (20 passed) | CloudFront fixture verification now bounds fetch and body reads with an AbortController-backed deadline, clears timers, preserves max-attempt/fake-clock behavior, and tests never-settling fetch/body failures without AWS. |
| FF02 | complete | `ba90aad` | `npm run lint --workspace web`; `npm run typecheck --workspace web`; separated schedule-state Playwright suite (24 passed) | Added a simulated 503 unavailable response and verified localized unavailable/Retry, no unpublished message, and no raw technical error across desktop/mobile Japanese and English projects. The raw preview suite remains uninstrumented. |
| FF03 | complete | `c0bb6b6` | `npm run check`; `npx vitest run scripts/migration/deploy-preview.test.mjs` (20 passed); `PREVIEW_BASE_URL=https://d2via50thoheqm.cloudfront.net npm run test:e2e:preview` (88 passed); `git diff --check`; `git status --short` | Restored C05's 64-case history, recorded exact RR01/FF commits, and separated RR03's initial 76/8 test-only failure from its final 84-case pass. No AWS deployment or invalidation was performed. |
