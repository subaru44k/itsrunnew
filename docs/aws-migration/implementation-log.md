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

### Phase 4 T12 Sol corrective pass

| T12R01 | complete; awaiting remaining Sol review items | `d99f56f` | Node 24; core unit (7 passed); schedule-api unit (8 passed); schedule-api typecheck | Replaced lower-camel conditional fields with a discriminated write condition mapped to exact SDK `IfMatch`/`IfNoneMatch` inputs, rejected malformed ETags, set S3 client maxAttempts to 1, and added AWS-free adapter/body-boundary tests. No AWS operation occurred. |
| T12R02 | complete; awaiting remaining Sol review items | `70e1a84` | schedule-api unit (9 passed) | Corrected the API error envelope and documented error codes, removed requestId from success payloads, validated payload 2.0 routes and plain-object bodies, and mapped client validation failures to `invalid_request`. |
| T12R03 | complete; awaiting remaining Sol review items | `224f6ff` | schedule-api unit (10 passed); schedule-api typecheck | Added no-metadata and oversized-stream adapter coverage for the 32 KiB read boundary. Audit fields remain allowlisted and sanitized. |
| T12R04 | complete; awaiting remaining Sol review items | `2a36b05` | schedule-api unit (12 passed) | Expanded AWS-free coverage for authorization variants, unexpected failures, hostile paths, malformed conditionals, invalid schedule tuples, and oversized requests. |
| T12R05 | complete; awaiting remaining Sol review items | `618fc9b` | infra tests (10 passed) | Applied PUT-only bounded stage throttling, split Lambda invoke permissions by exact GET/PUT API execution paths, and strengthened role/logging/resource assertions. No AWS operation occurred. |
| T12R06 | local corrective pass complete; awaiting Sol minimum-IAM re-review | `618fc9b` | Node 24.18.1: `npm ci`; core unit (7 passed); schedule-api unit (12 passed); schedule-api typecheck/build; infra tests (10 passed); infra build; `npm run check`; `git diff --check`; clean worktree before this log commit | Final local verification passed. AWS deployment, policy v4, IAM changes, preview mutation, and integration verification remain prohibited. |

### Phase 4 T12 second Sol review corrective pass

| T12RR01 | complete; awaiting remaining Sol review items | `cbfa3da` | infra tests (10 passed) | Corrected API Gateway default-stage invoke permission ARNs to `/$default/`, emitted PascalCase CloudFormation RouteSettings, and asserted the PUT-only throttle contract. No AWS operation occurred. |
| T12RR02 | complete; awaiting remaining Sol review items | `e1b02ea` | schedule-api unit (13 passed); schedule-api typecheck | Made bounded stream overflow call destroy with the stream receiver exactly once, covered the exact 32 KiB boundary, UTF-8, and resolved production S3 maxAttempts to one through an exported factory. No AWS operation occurred. |
| T12RR03 | complete; awaiting remaining Sol review items | `6857f97` | core unit (7 passed); schedule-api unit (18 passed) | Expanded AWS-free API tests for both conflict statuses, immutable conflict state, missing metadata, parser/path/media/conditional failures, exact sanitized envelopes, audit records, Cognito group representations, and every typed stadium key. |
| T12RR04 | local corrective pass complete; awaiting Sol minimum-IAM re-review | `ab589f1` | Node 24.18.1: core unit (7 passed); schedule-api unit (18 passed); schedule-api typecheck/build; infra tests (10 passed); infra build; `npm run check`; `git diff --check`; clean worktree | Added semantic assertions for the complete Lambda, LogGroup, role, inline policy, integration, invoke permission, exact `$default` ARNs, PascalCase PUT-only RouteSettings, and retained T11 contracts. AWS deployment and policy v4 remain prohibited. |

```text
Third Sol T12 review target: 02588ca
Date: 2026-08-09
Result: synthesized infrastructure corrections accepted; focused test-contract corrections remain before minimum-IAM policy v4 review
Independent checks: Node 24.18.1; core unit 7 passed; schedule-api unit 18 passed; schedule-api typecheck; infra tests 10 passed; git diff --check
Accepted: PascalCase PUT-only RouteSettings, exact $default GET/PUT invoke ARNs, bounded-reader destroy receiver/count behavior, resolved S3 maxAttempts 1
Incomplete proof: metadata-before-iteration and missing/failed body sanitization; remaining handler validation/exact response/audit matrix; exact S3 IAM Fn::Join and route dependency assertions
Log correction required: T12RR03 reports 8 core tests, but the actual suite has 7
Required work: docs/aws-migration/phase4-t12-review.md T12F01-T12F04
AWS authority: None; no policy v4, IAM change, deploy, preview mutation, invalidation, T13, Cognito-user, DNS, Firebase, or production operation
```

```text
Second Sol T12 review target: 0da39a9
Date: 2026-08-09
Result: final local corrections required before minimum-IAM policy v4 review
Independent checks: Node 24.18.1; core unit 7 passed; schedule-api unit 12 passed; schedule-api typecheck; infra tests 10 passed; git diff --check
Release blockers: synthesized RouteSettings uses lower-camel keys not the CloudFormation RouteSettings property contract; bounded reader invokes destroy without its receiver
Incomplete proof: conditional 409/412 call/state behavior, missing write metadata, full parser-to-400 matrix, exact response/log contracts, exact Lambda/LogGroup/IAM/integration assertions
Required work: docs/aws-migration/phase4-t12-review.md T12RR01-T12RR04
AWS authority: None; no policy v4, IAM change, deploy, preview mutation, T13, DNS, Firebase, or production operation
```

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

### Phase 4 T12 third Sol corrective pass

| Task | Status | Commit | Checks | Notes |
| --- | --- | --- | --- | --- |
| T12F01 | complete; awaiting Sol minimum-IAM review | `96f45df` | schedule-api unit (21 passed) | Proved oversized ContentLength rejects before body iteration. Handler tests cover missing and failed S3 bodies as sanitized 500 responses with no technical stream, bucket, key, or stack leakage. |
| T12F02 | complete; awaiting Sol minimum-IAM review | `3c90bf0` | schedule-api unit (21 passed) | Added focused sparse/null/overlong/wrong-identity/route-disagreement validation and exact 400/409 response, header, and audit-key assertions while retaining conflict and state coverage. |
| T12F03 | complete; awaiting Sol minimum-IAM review | `7c68bb7` | infra tests (10 passed) | Asserted exactly one S3 and one logging statement, complete detected-bucket/log-group Fn::Join resources, two inline policies without managed policies, and exact detected route dependency sets. |
| T12F04 | complete; awaiting Sol minimum-IAM review | `b04cc4d` | Node 24.18.1: `npm ci`; core unit (7 passed); schedule-api unit (21 passed); schedule-api typecheck/build; infra tests (10 passed); infra build; `npm run check`; `git diff --check`; clean status | Corrected the T12RR03 core count from 8 to 7 and completed the full prescribed local verification. No AWS call, policy v4/IAM change, deploy, preview mutation/invalidation, dependency addition, T13, Cognito user change, production/DNS, or Firebase work occurred. |

### T12 follow-up exact handler proofs

| Task | Status | Commit | Checks | Notes |
| --- | --- | --- | --- | --- |
| T12F follow-up | complete; awaiting Sol minimum-IAM review | `a3355ce` | schedule-api unit (25 passed); schedule-api typecheck | Replaced partial error assertions with exact ApiResponse equality for 403/404/409/415/500, added exact GET/PUT success bodies and headers without requestId, and independently covered successful PUT audit records and unexpected PUT-store failure. |

```text
Sol T12 local approval target: 742b4d1
Date: 2026-08-09
Result: local T11/T12 implementation approved; proceed only through docs/aws-migration/phase4-t12-deploy-plan.md
Independent checks: Node 24.18.1; core unit 7 passed; schedule-api unit 25 passed; schedule-api typecheck; infra tests 10 passed; git diff --check; clean worktree
Read-only AWS checks: account 470447451992; region ap-northeast-1; ItsRunPreviewHosting CREATE_COMPLETE; execution policy default v3; AWS v3 exactly matched committed local v3 before drafting v4
AWS writes: none during this review
Next authority required: one bundled approval for managed-policy v4 plus the first T11/T12 preview deployment
```

### Phase 4 P4D01: local policy contract and immutable baseline

| Task | Status | Commit | Checks | Notes |
| --- | --- | --- | --- | --- |
| P4D01 | complete; stop before P4D02 | `3e99bb1` | Node 24.18.1: focused policy contract tests (3 passed); infra tests/synth; root check; JSON parse; `git diff --check` | Added deterministic AWS-free assertions for the exact candidate-v4 statements, fixed account/region/preview resources, Lambda-only PassRole condition, forbidden services/actions/resources, and no wildcard actions. The test proves the candidate's unchanged v3 statements and reviewed OriginRequestPolicy/v4 additions from a committed contract; no mutable Git state or AWS call is used. No policy version, IAM, deployment, invalidation, Cognito-user, schedule-data, DNS, Firebase, or T13 operation occurred. |
| P4D01 follow-up | complete; stop before P4D02 | `4da7f9c` | Node 24.18.1: focused policy contract tests (3 passed); infra tests (13 passed) | Split the committed v3 CloudFront baseline from the five reviewed OriginRequestPolicy actions, proved all other v3 statements byte-equivalent to the hardcoded contract, constrained wildcard resources to the reviewed Sid allowlist, and expanded forbidden service/IAM-action checks. |

### Phase 4 P4D02: pre-write identity and baseline verification

| Task | Status | Commit | Checks | Notes |
| --- | --- | --- | --- | --- |
| P4D02 | complete; stop before P4D03 | `31f2aec` | Read-only AWS identity, IAM policy, and CloudFormation checks | Verified on branch `migration/aws-s3-cloudfront` at start commit `67aa9e3b744d0d29b4f14969a9c2f2a3004e9c52` with a clean worktree. Repository `.nvmrc` requires Node 24; this read-only check used the existing Node `v22.16.0` and did not run Node-dependent implementation checks. `AWS_PROFILE=codex-prod` and `AWS_REGION=ap-northeast-1` were used for every AWS call; `aws configure get region --profile codex-prod` returned `ap-northeast-1`; `aws sts get-caller-identity` returned account `470447451992` (principal `arn:aws:iam::470447451992:user/amplify-UfEp0`). `aws iam get-policy` reported `ItsRunPreviewCloudFormationExecutionPolicy` default `v3`; `list-policy-versions` showed retained `v1`, `v2`, and `v3` only, with v3 default. `get-policy-version --version-id v3` was URL-decoded and compared with `git show ad44b5f:infra/bootstrap/cloudformation-execution-policy.json`; canonical sorted JSON matched exactly (SHA-256 `cee49354b0cf438cd449004ae0ce00312e79c3c2c6933ca09549ab44fed7c107` for both). `aws cloudformation describe-stacks --stack-name ItsRunPreviewHosting` returned `CREATE_COMPLETE` and unchanged documented outputs: DataBucketName `itsrun-preview-data-470447451992-ap-northeast-1`, WebBucketName `itsrun-preview-web-470447451992-ap-northeast-1`, DistributionId `E22K5S8F2NUP6K`, DistributionDomainName `d2via50thoheqm.cloudfront.net`. No AWS write, policy v4, deployment, invalidation, user mutation, schedule write, production/DNS, Firebase, or P4D03 operation occurred. |

### Phase 4 P4D03-P4D06 bundled preview operation

| Task | Status | Commit | Checks | Notes |
| --- | --- | --- | --- | --- |
| P4D03 | complete; v4 verified; deployment stopped | `3cb3d7b` | Node 24.18.1 focused policy tests (3 passed), infra tests (13 passed), infra synth/build, root `npm run check`, JSON parse, `git diff --check`; AWS STS/account/region and baseline checks | Created exactly one managed-policy version `v4` at `2026-08-08T23:21:47Z` with `--set-as-default`. Readback exactly matched the committed candidate. v1, v2, and v3 remain retained; v3 exactly matched `ad44b5f`; v3-to-v4 changed only the reviewed `PreviewCloudFront` OriginRequestPolicy actions and the reviewed Cognito/API/Lambda/IAM/Logs/bootstrap-asset statements. |
| P4D04 | stopped by CloudFormation validation | `3cb3d7b` | One `npx cdk deploy ItsRunPreviewHosting --require-approval never`; asset publishing reached the standard bootstrap file-asset bucket; no bootstrap rerun, container image, web/data upload, invalidation, Cognito user mutation, or schedule write | Deploy change set `arn:aws:cloudformation:ap-northeast-1:470447451992:changeSet/cdk-deploy-change-set/8b2ccff7-06dc-4047-b897-6e8cdc1e2de1` started with execution principal `arn:aws:iam::470447451992:role/cdk-hnb659fds-cfn-exec-role-470447451992-ap-northeast-1`. `AWS::CloudFront::CachePolicy` logical resource `ApiCacheA0112D40` failed at `2026-08-08T23:22:50.781Z`; CloudFormation message: `Invalid request provided: AWS::CloudFront::CachePolicy: The parameter HeaderBehavior is invalid for policy with caching disabled. (Service: CloudFront, Status Code: 400, Request ID: 636c7aea-8919-461f-9b3d-1d5c3b90194e) (RequestToken: 1defa18d-318f-6cba-0265-47234aef31cb, HandlerErrorCode: InvalidRequest)`. The attempted provider action was CloudFront `CreateCachePolicy` on the new `ItsRunPreviewApiNoCache` resource (resource-level create scope is `*` in reviewed v4). Stack rolled back to `UPDATE_ROLLBACK_COMPLETE` at `2026-08-08T23:25:06.802Z`; existing outputs remain unchanged. |
| P4D05 | not run; blocked by P4D04 stop condition | `3cb3d7b` | Read-only rollback/output/event verification only | No post-deployment resource-graph, runtime-IAM, API/Cognito, unauthenticated-response, or public-preview acceptance verification was claimed because the stack update did not complete. The failed cache-policy resource was deleted during rollback; the prior web/data buckets and distribution remain. Sol later confirmed the retained/deletion-protected User Pool remained outside the rolled-back stack graph; see the recovery review below. |
| P4D06 | stop record complete; awaiting Sol review | `3cb3d7b` | AWS read-only event/output checks; asset manifest inspection | Fresh Node-24 synth asset manifest recorded Lambda ZIP SHA-256/key `ed27108982d0ef94b6b9baa33135d04d2135dfaa4a365fc28fd6f4ca6cdda087` (`.zip`) and stack template SHA-256/key `dc69f7e343f501818723f8967ce25bdc9567c53f7b0bd1c11ba1c5b733cf91fc.json` in `cdk-hnb659fds-assets-470447451992-ap-northeast-1`; `dockerImages` is empty. Stop before any corrective source/IAM change, second deployment, T13, Cognito administration, or schedule mutation. |

```text
Sol failed-deployment review target: 3cb3d7b
Date: 2026-08-09
Result: stop condition confirmed; D013 and phase4-t12-deploy-recovery-plan.md define the local correction and protected recovery sequence
Independent AWS checks: policy v4 default/exact with v1-v3 retained; stack UPDATE_ROLLBACK_COMPLETE; original four outputs unchanged; asset objects present; API/Lambda absent
Additional retained state: exact empty User Pool ap-northeast-1_M39i3BFEu remains deletion-protected and stack-tagged but is absent from the rolled-back stack resource list; zero users/clients/groups/resource servers/providers/domain
Local next step: RC01-RC02 only; no AWS write until Sol re-review and a bundled retained-pool-cleanup/corrected-deploy authorization
AWS authority: None for recovery work; no pool mutation/deletion, second deploy, policy v5, IAM, Cognito user/group, schedule data, invalidation, production/DNS, or Firebase operation authorized by this review
```

### Phase 4 failed-deployment recovery: RC01-RC02

| Task | Status | Commit | Checks | Notes |
| --- | --- | --- | --- | --- |
| RC01 | complete; local only | `a03e314` | Node 24.18.1 infra synth | Removed the custom `ItsRunPreviewApiNoCache` resource. `/api/*` now uses managed `CachingDisabled` ID `4135ea2d-6df8-44a3-9df3-4b5a84be39ad`; the stack-owned L1 `AWS::CloudFront::OriginRequestPolicy` forwards exactly `Authorization`, `Content-Type`, `If-Match`, and `If-None-Match`, with no cookies or query strings. The source comment records the CDK L2 validation gap and current AWS authorization-forwarding documentation. No AWS call occurred. |
| RC02 | complete; awaiting Sol RC03 review | pending | Node 24.18.1: infra tests (13 passed); infra build/synth; root `npm run check`; `git diff --check`; clean status | Semantic assertions prove exactly one API origin policy, exact four-header/none-cookie/none-query contract, no custom API cache policy, exact managed cache ID and detected origin-policy Ref, no ForwardedValues/all-viewer/extra API forwarding, and retained T11/T12 contracts. Fresh synth retains Lambda asset key `ed27108982d0ef94b6b9baa33135d04d2135dfaa4a365fc28fd6f4ca6cdda087.zip` and emits corrected template key/hash `a1a88a39d271bfff65603452b3f176a93931c48cad8fa7192252efa926472744.json`. No AWS call/write, pool cleanup, deploy, policy v5, IAM change, upload, invalidation, or T13+ work occurred. |

Recovery stop: return to Sol for RC03 review before any retained-pool cleanup or corrected deployment.

### Phase 4 T13 advance planning

```text
Sol planning baseline: 2b86639
Date: 2026-08-09
Result: detailed T13 plan prepared; implementation remains gated on P4D03-P4D06 and Sol deployment acceptance
Dependency contract: exact-pinned oidc-client-ts@3.5.0 only; already allowed by architecture.md
Security contract: tokens and OIDC User remain memory-only; sessionStorage is limited to transient authorization/PKCE transaction state; no automatic conflict write
Plan: docs/aws-migration/phase4-t13-plan.md T13A-T13F
AWS authority: None; no policy v4, deployment, Cognito-user/group, schedule write, invalidation, production/DNS, or Firebase operation occurred
```

### Phase 4 T14 advance planning

```text
Sol planning baseline: e4e13e6
Date: 2026-08-09
Result: T14A-T14D local migration-tool plan prepared; real Firestore export and schedule upload remain protected gates
Dependency contract: no dependency for local transformer/comparator/uploader tests; existing firebase-admin exporter remains blocked and uninstalled
Data contract: strict four-stadium legacy normalization, deterministic monthly JSON/manifest, exhaustive cell comparison, If-None-Match-only first upload, exact-version readback
Plan: docs/aws-migration/phase4-t14-plan.md T14A-T14F
External inputs still required: approved read-only Firestore mechanism/credential for T14E; explicit destination/write authority for T14F
Protected operations: no Firebase read, AWS write, production data access, overwrite/delete/dual-write, invalidation, DNS, or Firebase-state change occurred
```

### Phase 4 T15 advance planning and read-only baseline

```text
Sol planning baseline: f025be9
Date: 2026-08-09
Result: T15 local CI/web-only deployment/OIDC plan prepared; external writes remain gated
GitHub read-only evidence: repo subaru44k/itsrunnew; default master; migration branch migration/aws-s3-cloudfront; Actions enabled/all actions; SHA pinning not enforced; master unprotected; zero environments/variables
AWS read-only evidence: account 470447451992; zero IAM OIDC providers; no itsrun GitHub role
Trust candidate: aud sts.amazonaws.com and exact sub repo:subaru44k/itsrunnew:ref:refs/heads/migration/aws-s3-cloudfront
Deployment scope candidate: exact preview web bucket only; no schedule-data, delete, invalidation, CDK, CloudFormation mutation, Cognito, production, DNS, or Firebase access
Plan: docs/aws-migration/phase4-t15-plan.md T15A-T15F
Protected operations: no GitHub settings/workflow push, AWS/OIDC/IAM write, deployment, invalidation, production/DNS, or Firebase operation occurred
```

### Phase 4 T16/T17 advance planning

```text
Sol planning baseline: 6bab082
Date: 2026-08-09
Result: T16 operational/auth/rollback and T17 migration-branch legacy-removal plan prepared; no implementation or protected operation started
T16 external inputs: named admin/non-admin operators, designated schedule object and original ETag/VersionId/hash/bytes, maintenance window, rollback operator, and alarm deployment authority
T16 invariants: real PKCE local-user tests, non-admin denial, one conditional update, stale-ETag no-write proof, exact original-byte restore as a new version, no token/body leakage
T17 baseline: 77 tracked files under itsrunnew; removal-list dependencies confirmed in legacy package; ignored local env/node_modules/dist are not deletion targets
Plan: docs/aws-migration/phase4-t16-t17-plan.md
Protected operations: no Cognito user/group, schedule write/restore, alarm/IAM/stack change, tag push, tracked legacy removal, production/DNS, or Firebase operation occurred
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
