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
| T11 | complete; accepted | `5f23d2e` | Final acceptance: infra 15, root check, preview E2E 88 | Deployed preview Cognito/API/CloudFront contracts accepted; historical stop records remain below. |
| T11-local | local implementation complete; awaiting Sol IAM review | `3c9fba3` | Node 24.18.1: `npm run check` (passed); `npm run test:infra --workspace @itsrun/infra` (5 passed); `npm run build --workspace @itsrun/infra` / CDK synth (passed); `git diff --check` (passed) | Sol configuration contract is now explicit. Added parameterized Cognito User Pool/Google IdP/domain/app client, empty `admins` group, HTTP API JWT authorizer/protected route contracts, and CloudFront `/api/*` no-cache behavior. The prior T11 stop record at `8d6de28` is retained above. No AWS API/write, deploy, bootstrap, or managed-policy v4 operation was performed. T11 remains incomplete until Sol reviews the synthesized IAM requirements and a later approved deployment/integration test. |
| T11R01 | complete; awaiting remaining Sol review items | `4bccdd6` | `npm run test:infra --workspace @itsrun/infra` (6 passed) | Replaced the managed all-viewer API origin request policy with a stack-owned allow-list policy. Authorization is forwarded through a stack-owned zero-TTL cache policy as required by CloudFront; Content-Type, If-Match, and If-None-Match use the origin request policy. Cookies and query strings remain disabled. No AWS operation was performed. |
| T11R02 | complete; awaiting remaining Sol review items | `1f4dd3a` | `npm run test:infra --workspace @itsrun/infra` (7 passed) | Added an API-only viewer-request method filter. GET, PUT, and OPTIONS pass; HEAD, PATCH, POST, and DELETE return 405 with the exact Allow header. The public route rewrite function is unchanged. No AWS operation was performed. |
| T11R03 | complete; awaiting remaining Sol review items | `97af556` | `npm run test:infra --workspace @itsrun/infra` (8 passed) | Added parameterized local-development CORS limited to one origin and the four API headers, with GET/PUT/OPTIONS only and no credentials wildcard. Enabled Cognito User Pool deletion protection while retaining CloudFormation. No AWS operation was performed. |
| T11R04 | complete; awaiting remaining Sol review items | `c63f159` | `npm run test:infra --workspace @itsrun/infra` (9 passed) | Added the parameterized Cognito auth base URL to CSP `connect-src` and outputs for auth base URL, issuer, User Pool ID, and app-client ID. No Google endpoint wildcard or AWS operation was introduced. |
| T12 | complete; accepted | `5f23d2e` | Final acceptance and deployed preview evidence | T11/T12 final acceptance is recorded at `5f23d2e`; historical blocker rows and recovery records remain unchanged below. |
| T13 | local implementation/test accepted; preview deployment pending T15 | `77be9c1` | S05 local acceptance: root E2E 58, preview E2E 88, check/build | Preview web reflection requires the separately authorized T15 workflow; no T13 preview deployment occurred. |
| T14 | complete; accepted after T14F04 protected verification; T15 not started | `98a7536` + protected run evidence below | `npm ci`; core unit 7; migration tests 64; `npm run check`; preview E2E 88; `git diff --check` | T14F01-R06 local runner corrections and the single authorized upload run are recorded chronologically below. No T15 work started. |
| T15 | complete; accepted after Sol final review | `a812b41`, `144b025`, `5f67e08`, `023229f` + Sol acceptance below | Web helper 58/58/58; raw preview 88; trigger cleanup; master protection; local T15F; final-doc validation attempt 2 passed | Workflow is dispatch-only, selected action is exact-SHA pinned, data/invalidation/Hosting remain unchanged. |
| T16 | ready; depends on accepted T15 | | | |
| T17 | blocked by T16 | | | |

### Phase 4 T16 Sol execution authorization

D026 and `phase4-t16-execution-plan.md` define the exact T16A release-candidate
gate and T16B alarm deployment. Read-only entry evidence found policy v6
default with v2-v6 retained, no `itsrun-preview` CloudWatch alarm, account
`470447451992`, and region `ap-northeast-1`. AWS v2 exactly matched commit
`22d7fd5` at canonical SHA-256
`9318b40d9d601231335f6a1a4271ec8e5edc5700f5367dec2a407c329bee9f54`.
No AWS write occurred during planning. T16A through T16B05 may proceed in
dependency order under the exact D026 limits; T16C/D credentials and schedule
mutation remain governed by their separate stop conditions.

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
| RC02 | complete; awaiting Sol RC03 review | `8c06d20` | Node 24.18.1: infra tests (13 passed); infra build/synth; root `npm run check`; `git diff --check`; clean status | Semantic assertions prove exactly one API origin policy, exact four-header/none-cookie/none-query contract, no custom API cache policy, exact managed cache ID and detected origin-policy Ref, no ForwardedValues/all-viewer/extra API forwarding, and retained T11/T12 contracts. Fresh synth retains Lambda asset key `ed27108982d0ef94b6b9baa33135d04d2135dfaa4a365fc28fd6f4ca6cdda087.zip` and emits corrected template key/hash `a1a88a39d271bfff65603452b3f176a93931c48cad8fa7192252efa926472744.json`. No AWS call/write, pool cleanup, deploy, policy v5, IAM change, upload, invalidation, or T13+ work occurred. |

Recovery stop: return to Sol for RC03 review before any retained-pool cleanup or corrected deployment.

### Phase 4 failed-deployment recovery: RC04-RC06 execution

| Task | Status | Commit | Checks | Notes |
| --- | --- | --- | --- | --- |
| RC04 | complete; exact recorded orphan deleted | `9dd84d8` | Read-only exact-pool gate; post-update empty/tag recheck; ResourceNotFound verification | Using `AWS_PROFILE=codex-prod`, account `470447451992`, region `ap-northeast-1`, verified `ap-northeast-1_M39i3BFEu` name, creation time `2026-08-09T08:22:51.247+09:00`, ACTIVE deletion protection, exact stack/logical tags, and zero users/clients/groups/resource servers/providers/domain. Per authorization, wrote only `UpdateUserPool` deletion protection `INACTIVE`, rechecked invariants, then `DeleteUserPool` on that exact ID. Final read returned `ResourceNotFoundException`. |
| RC05 | stopped by reviewed-policy resource mismatch | `9dd84d8` | One corrected `npx cdk deploy ItsRunPreviewHosting --require-approval never`; corrected template published; no second attempt | Change set `arn:aws:cloudformation:ap-northeast-1:470447451992:changeSet/cdk-deploy-change-set/6ab0b996-0f5a-4bec-ae8d-1a794fe8eb56` used execution principal `arn:aws:iam::470447451992:role/cdk-hnb659fds-cfn-exec-role-470447451992-ap-northeast-1`. `ScheduleApiFunctionA177D4FE` failed at `2026-08-09T00:05:17.975Z`: `lambda:CreateFunction` denied for `arn:aws:lambda:ap-northeast-1:470447451992:function:ItsRunPreviewHosting-ScheduleApiFunctionA177D4FE-SMCxODhObRRy` because v4 allows only the reviewed fixed function resource `itsrun-preview-schedule-api`. Rollback also recorded `lambda:DeleteFunction` denied for the generated ARN at `2026-08-09T00:06:33.673Z`; read-only `get-function` subsequently returned ResourceNotFound. No IAM expansion or retry occurred. |
| RC06 | not run; blocked by RC05 stop condition | `9dd84d8` | Read-only rollback/event/output checks only | CloudFormation completed rollback without intervention to `UPDATE_ROLLBACK_COMPLETE`; baseline web/data bucket and distribution outputs remained unchanged. The generated Lambda does not exist. A new empty deletion-protected User Pool `ap-northeast-1_CWmMgPepN` and retained LogGroup `/aws/lambda/itsrun-preview-schedule-api` remain outside the restored stack graph; neither was mutated. Full P4D05 resource/runtime/API/Cognito/public verification was not claimed. |

Recovery stop: return to Sol. Resolve the generated Lambda physical-name versus fixed v4 resource boundary and separately authorize cleanup of the new exact empty retained pool before any further AWS operation.

### Phase 4 second-deploy recovery: SR01

| Task | Status | Commit | Checks | Notes |
| --- | --- | --- | --- | --- |
| SR01 | complete; awaiting Sol SR02 review | `9697627` | Node 24.18.1: infra tests (13 passed); infra build/synth; root `npm run check`; `git diff --check`; clean worktree | Implemented D014 by setting the existing schedule `NodejsFunction` physical name to `itsrun-preview-schedule-api` and asserting the exact synthesized `AWS::Lambda::Function.Properties.FunctionName` without weakening prior T11/T12 assertions. Fresh synth proves `FunctionName: itsrun-preview-schedule-api`; Lambda asset remains `ed27108982d0ef94b6b9baa33135d04d2135dfaa4a365fc28fd6f4ca6cdda087.zip`; template hash/key is `6982ec8d44413d9270c6eba441d3ed811a3f06b393045f792e1642d0f3ea25f9.json`. No AWS call/read/write, leftover cleanup, deploy, IAM/policy change, user/group mutation, upload, invalidation, or T13+ work occurred. |
| SR02 | complete; exact cleanup/deploy authorization required | `2dc14b3` | Sol Node 24.18.1: infra tests (13 passed); infra synth; root `npm run check`; AWS `ValidateTemplate`; canonical template diff; policy v4 exact comparison; clean worktree | Sol independently confirmed that removing `FunctionName` and CDK analytics from the previous and current templates yields identical canonical SHA-256 `d638ea4ba6fe4917b5a3caa50b3f6899d5d456a93c92fd7624d86adc09d93d7e`. The only functional template change is `FunctionName: itsrun-preview-schedule-api`; Lambda asset remains `ed27108982d0ef94b6b9baa33135d04d2135dfaa4a365fc28fd6f4ca6cdda087.zip`, and current template is `6982ec8d44413d9270c6eba441d3ed811a3f06b393045f792e1642d0f3ea25f9.json`. AWS accepted the template with only `CAPABILITY_IAM`. AWS policy v4 and the committed policy have identical canonical SHA-256 `3822bac070f63a5cab51d0839dc2123e4e25b0939b507e471a28b4d241f0f253`; v4 remains default and v1-v3 are retained. Deployment-principal simulation allows only the planned exact-pool `UpdateUserPool`/`DeleteUserPool` and exact-LogGroup `DeleteLogGroup` cleanup calls. No AWS write occurred. |

SR02 stop: obtain explicit bundled authorization for SR03 exact leftover cleanup, exactly one SR04 deploy, and read-only SR05 verification before any AWS write.

### Phase 4 second-deploy recovery: SR03-SR05 execution

| Task | Status | Commit | Checks | Notes |
| --- | --- | --- | --- | --- |
| SR03 | complete; exact cleanup performed | `dc3cdf2` | Read-only exact-pool and LogGroup gates; post-write ResourceNotFound/absence checks; stack/output/Lambda readback | With `AWS_PROFILE=codex-prod`, account `470447451992`, and region `ap-northeast-1`, the stack was `UPDATE_ROLLBACK_COMPLETE`, baseline outputs were unchanged, and generated Lambda `ItsRunPreviewHosting-ScheduleApiFunctionA177D4FE-SMCxODhObRRy` was absent. Pool `ap-northeast-1_CWmMgPepN` exactly matched the authorized name, creation time `2026-08-09T09:04:46.452+09:00` (the specified UTC instant), ACTIVE protection, exact stack/logical tags, and zero users/clients/groups/resource servers/providers/domain. Only `UpdateUserPool` to INACTIVE and `DeleteUserPool` were issued; the final read returned `ResourceNotFoundException`. LogGroup `/aws/lambda/itsrun-preview-schedule-api` exactly matched creation `1786233887054`, retention 30, stored bytes 0, zero streams, and exact tags. Only `DeleteLogGroup` was issued; the final group listing was empty. No rollback continuation was used. |
| SR04 | stopped by Lambda Permission validation | `dc3cdf2` | Exactly one `npx cdk deploy ItsRunPreviewHosting --require-approval never`; Node 24.18.1; standard file-asset publishing; no retry | Change set `arn:aws:cloudformation:ap-northeast-1:470447451992:changeSet/cdk-deploy-change-set/36215b20-003a-4c35-a794-b7aa93c03d07` published the reviewed template and Lambda asset, then failed at `2026-08-09T00:33:50.220Z`/`00:33:50.309Z` UTC for `ScheduleApiFunctionApiInvokeGetAB746699` and `ScheduleApiFunctionApiInvokePutBD39B986` (`AWS::Lambda::Permission`): `Properties validation failed for resource ... #/SourceArn: failed validation constraint for keyword [pattern]`. CloudFormation also cancelled `AdminApiIntegration`; the generated fixed-name Lambda was created and removed during rollback. `describe-change-set` reported `EXECUTE_FAILED`, `RoleARN: null`; these validation events contained no principal, action, or request ID, so none is inferred. Stack cleanup completed at `2026-08-09T00:37:22Z` with `UPDATE_ROLLBACK_COMPLETE`. No policy/IAM change, bootstrap, second deploy, upload, invalidation, user/group mutation, or schedule write occurred. |
| SR05 | not run; blocked by SR04 stop condition | `dc3cdf2` | Read-only post-failure status/output/resource checks only | Full P4D05/RC06 deployed-graph, runtime-IAM, API/Cognito acceptance, unauthenticated response, CloudFront fixture, and public-preview verification was not run or claimed because the single corrected deployment did not complete. Baseline outputs remain unchanged. The failed attempt left a new empty deletion-protected, stack-tagged pool `ap-northeast-1_U6JenEvrT` (created `2026-08-09T09:33:10.231+09:00`) and retained empty LogGroup `/aws/lambda/itsrun-preview-schedule-api` (creation `1786235590805`, retention 30, stored bytes 0) outside the restored stack graph; no further cleanup is authorized by this task. |

SR03-SR05 stop: return to Sol. The exact cleanup succeeded, but SR04's one authorized deploy stopped on the Lambda Permission `SourceArn` schema validation; do not retry or proceed to SR05/T13 without a new reviewed correction and authorization.

### Phase 4 third-deploy recovery: TR01-TR02

| Task | Status | Commit | Checks | Notes |
| --- | --- | --- | --- | --- |
| TR01 | complete; local only | `531b109` | Node 24.18.1 infra tests and synth | D015 diagnosis confirmed that both prior `SourceArn` joins omitted the account-ID segment. Added `Aws.ACCOUNT_ID` and its following delimiter to the separate GET and PUT joins. No integration, route, JWT, Lambda, IAM, CloudFront, Cognito, or unrelated resource changed. |
| TR02 | complete; awaiting Sol review | `531b109` | Node 24.18.1: infra tests (13 passed); infra build/synth; semantic ARN resolution | Semantic assertions retain exactly two permissions and detect the API Ref without generated logical-ID hardcoding. Each complete join now asserts partition, region, `AWS::AccountId`, exact API Ref, `$default`, method, and exact path. A deterministic resolver proves GET and PUT resolve to `arn:aws:execute-api:ap-northeast-1:470447451992:example-api-id/$default/{GET|PUT}/api/v1/stadiums/*/availability/*`. Lambda asset remains `ed27108982d0ef94b6b9baa33135d04d2135dfaa4a365fc28fd6f4ca6cdda087.zip`; fresh template asset is `1b457cc5d521ae6030fc163e1ac84981ac3034d9a26581768e1a2d61f1751d86.json`. No AWS call/read/write or cleanup occurred. |
| TR03 | complete; exact cleanup/deploy authorization required | `e435904` | Sol Node 24.18.1: infra tests (13 passed); infra synth; root `npm run check`; canonical template diff; AWS `ValidateTemplate`; policy v4 exact comparison; clean worktree | Sol independently confirmed that removing the two permission `SourceArn` values and CDK analytics from the prior and current templates yields identical canonical SHA-256 `a7d2efaae3358cf419e71c84c2e5b3d228fa84df455cb7cb6fccb204103a23b6`. The complete diff adds only `AWS::AccountId` and its delimiter to both GET/PUT joins. Current template SHA-256 is `1b457cc5d521ae6030fc163e1ac84981ac3034d9a26581768e1a2d61f1751d86`; Lambda ZIP remains unchanged. AWS accepted the template with only `CAPABILITY_IAM`. AWS/default v4 and committed policy remain canonical SHA-256 `3822bac070f63a5cab51d0839dc2123e4e25b0939b507e471a28b4d241f0f253`, with v1-v3 retained; no policy v5 or IAM expansion is needed. No AWS write occurred. |

TR03 stop: obtain explicit bundled authorization for TR04 exact leftover cleanup, exactly one TR05 deploy, and read-only TR06 verification before any AWS write.

### Phase 4 third-deploy recovery: TR04-TR06 execution

| Task | Status | Commit | Checks | Notes |
| --- | --- | --- | --- | --- |
| TR04 | complete; exact cleanup performed | `ca625da` | Read-only exact pool/LogGroup gates; post-write ResourceNotFound/absence checks; stack/output/Lambda readback | With `AWS_PROFILE=codex-prod`, account `470447451992`, and region `ap-northeast-1`, verified `UPDATE_ROLLBACK_COMPLETE`, unchanged four baseline outputs, and absent `itsrun-preview-schedule-api`. Pool `ap-northeast-1_U6JenEvrT` exactly matched name, creation `2026-08-09T09:33:10.231+09:00`, ACTIVE protection, exact stack/logical tags, and zero users/clients/groups/resource servers/providers/domain. Issued only `UpdateUserPool` to INACTIVE and `DeleteUserPool` for that ID; final read returned `ResourceNotFoundException`. The LogGroup exactly matched creation `1786235590805`, retention 30, stored bytes 0, zero streams, and exact tags; issued only its `DeleteLogGroup`, then verified an empty listing. No CloudFormation rollback operation was issued. |
| TR05 | stopped by CloudFormation AccessDenied | `ca625da` | Exactly one `npx cdk deploy ItsRunPreviewHosting --require-approval never`; Node 24.18.1; standard template/Lambda file-asset publishing; no retry | Change set `arn:aws:cloudformation:ap-northeast-1:470447451992:changeSet/cdk-deploy-change-set/18bb8a48-e20b-464d-a8e1-bbea26dbe924` reached Lambda creation, both corrected permissions, integration, and routes successfully, then failed at `2026-08-09T02:31:43.657Z` UTC on logical resource `AdminApiDefaultStage` (`AWS::ApiGatewayV2::Stage`). Exact principal: `arn:aws:sts::470447451992:assumed-role/cdk-hnb659fds-cfn-exec-role-470447451992-ap-northeast-1/AWSCloudFormation`; action: `apigateway:TagResource`; resource: `arn:aws:apigateway:ap-northeast-1::/apis/n8ubvb3mm6/stages`; request ID: `b2cb6489-7135-4019-b6c5-982f68a16b70`; message: `not authorized ... because no identity-based policy allows the apigateway:TagResource action` (403). Stack completed rollback to `UPDATE_ROLLBACK_COMPLETE` at `2026-08-09T02:32:56Z`. No IAM/policy change, bootstrap, second deploy, invalidation, web/data/schedule upload, or Cognito user/group mutation occurred. |
| TR06 | not run; blocked by TR05 stop condition | `ca625da` | Read-only post-failure stack/output/Lambda checks only | Full P4D05/RC06/SR05 acceptance was not run or claimed because the sole corrected deployment did not complete. Baseline outputs remain unchanged and the fixed Lambda is absent. The failed attempt left new retained resources outside the restored stack graph: empty deletion-protected pool `ap-northeast-1_FW2mvosLh` created `2026-08-09T11:30:58.193+09:00`, and empty retained LogGroup `/aws/lambda/itsrun-preview-schedule-api` created `1786242658768` with retention 30 and stored bytes 0. No further cleanup is authorized by this task. |

TR04-TR06 stop: return to Sol. The exact cleanup succeeded, but the one authorized deployment stopped on `apigateway:TagResource` denial. Do not retry, broaden IAM, clean the new leftovers, or proceed to TR06/T13 without a new reviewed authorization.

### Phase 4 policy-v5 recovery: V501-V502

| Task | Status | Commit | Checks | Notes |
| --- | --- | --- | --- | --- |
| V501 | complete; local candidate only | `77b63d4` | JSON parse; focused policy contract | Added exactly one independent candidate-v5 statement, `PreviewHttpApiStageTags`, allowing only string action `apigateway:TagResource` on `arn:aws:apigateway:ap-northeast-1::/apis/*/stages`. No committed-v4 statement was changed; no AWS policy version or IAM operation occurred. |
| V502 | complete; awaiting Sol review | `77b63d4` | Node 24.18.1: focused policy tests (4 passed); infra tests; infra synth/build; root `npm run check`; `git diff --check` | Tests explicitly retain the committed v4 statement contract, prove v4→v5 differs only by the exact statement, verify byte-semantic equality of every v4 statement, reject `UntagResource`, stage-descendant wildcards, near-match regions/services, wildcard actions/resources, and forbidden privilege surfaces. TR04-TR06 records now reference actual commit `ca625da`; Sol's D016 diagnosis and exact denial evidence remain preserved above. No AWS call/read/write, policy version creation, cleanup, deploy, bootstrap, upload, invalidation, Cognito administration, or T13+ work occurred. |
| V503 | complete; bundled v5/cleanup/deploy authorization required | `10f386a` | Sol Node 24.18.1: focused policy tests (4 passed); infra tests (14 passed); infra synth; root `npm run check`; AWS-v4 exact comparison; positive/negative custom-policy simulation; clean worktree | Sol independently confirmed AWS/default v4 and commit `d096947` policy are identical canonical SHA-256 `3822bac070f63a5cab51d0839dc2123e4e25b0939b507e471a28b4d241f0f253`. Candidate v5 pretty-canonical SHA-256 is `ca4a20e3e3a7c06c1f1196559886a9679dee98b9a25c7334dd8faf69b19e061e`; its only diff is the exact reviewed statement. IAM custom-policy simulation allows `apigateway:TagResource` on the observed `/apis/n8ubvb3mm6/stages` resource, while `/stages/$default`, `/routes`, `us-east-1`, and `apigateway:UntagResource` are implicit deny. v4 remains default with v1-v3 retained. No AWS write occurred. |

V503 stop: obtain explicit bundled authorization for exact v5 creation, exact failed-deploy cleanup, exactly one deployment, and read-only acceptance verification.

### Phase 4 policy-v5 recovery: V504-V507 execution

| Task | Status | Commit | Checks | Notes |
| --- | --- | --- | --- | --- |
| V504 | complete; v5 exact/default | pending | AWS policy v4/default/version readback; commit-v4 canonical comparison; candidate delta check; one `CreatePolicyVersion --set-as-default`; v5 exact readback | Before the write, AWS v4 was default with v1-v4 retained and matched commit `d096947` at canonical SHA-256 `3822bac070f63a5cab51d0839dc2123e4e25b0939b507e471a28b4d241f0f253`. Created exactly one v5 at `2026-08-09T05:15:36Z`; v1-v5 are retained and v5 is default. AWS v5 exactly matches the committed candidate; candidate canonical SHA-256 is `ca4a20e3e3a7c06c1f1196559886a9679dee98b9a25c7334dd8faf69b19e061e`, with only `PreviewHttpApiStageTags` added. |
| V505 | complete; exact cleanup performed | pending | Read-only exact pool/LogGroup gates; post-write ResourceNotFound/absence checks; stack/output/Lambda readback | Stack was `UPDATE_ROLLBACK_COMPLETE`, baseline outputs were unchanged, and fixed Lambda was absent. Pool `ap-northeast-1_FW2mvosLh` exactly matched creation `2026-08-09T11:30:58.193+09:00`, ACTIVE protection, exact tags, and zero users/clients/groups/resource servers/providers/domain. Issued only `UpdateUserPool` to INACTIVE and `DeleteUserPool` for that ID; verified `ResourceNotFoundException`. LogGroup exactly matched creation `1786242658768`, retention 30, stored bytes 0, zero streams, and exact tags; issued only its `DeleteLogGroup` and verified absence. |
| V506 | complete; stack deployed | pending | Exactly one `npx cdk deploy ItsRunPreviewHosting --require-approval never`; Node 24.18.1; expected assets; complete CloudFormation events | Change set `arn:aws:cloudformation:ap-northeast-1:470447451992:changeSet/cdk-deploy-change-set/7ba98dcb-9ffd-45a2-8e3f-9b17678d8029` completed `UPDATE_COMPLETE` with 23/23 resources. Outputs: API `40xqzug59a`, User Pool `ap-northeast-1_nmj9cP9st`, client `1olddro3tldfinupl52u9dl1j4`, existing distribution `E22K5S8F2NUP6K`/`d2via50thoheqm.cloudfront.net`, unchanged web/data buckets. Expected Lambda ZIP `ed27108982d0ef94b6b9baa33135d04d2135dfaa4a365fc28fd6f4ca6cdda087.zip` and template `1b457cc5d521ae6030fc163e1ac84981ac3034d9a26581768e1a2d61f1751d86.json` were used. No retry, v6, IAM expansion, bootstrap, invalidation, upload, or Cognito administration occurred. |
| V507 | complete with documented fixture-data limitation | pending | Read-only stack graph/outputs; Cognito/API/Lambda/IAM/CloudFront/S3 checks; unauthenticated GET/405 checks; public preview E2E; invalidation/object readback | Deployed graph is complete: local-only deletion-protected pool, empty `admins` group/users, one COGNITO-only public code-flow client with no secret, one `itsrun/schedule.write` resource server, no IdP/Identity Pool; HTTP API GET/PUT JWT routes, `$default`, PUT throttle 10/5, exact Lambda integration and account-qualified GET/PUT invoke policies; Lambda Node 24/memory 256/timeout 10, exact environment/log group/dedicated role and least-privilege S3/log actions; CloudFront managed CachingDisabled ID `4135ea2d-6df8-44a3-9df3-4b5a84be39ad`, exact four-header OriginRequestPolicy `30f5577e-3813-4c4c-97bb-ca79ca70a44e`, method filter/security headers; direct API GET 401, CloudFront API GET 401, CloudFront PATCH 405 with `Allow: GET, PUT, OPTIONS`; S3 direct access 403 and public access blocks enabled. Preview E2E: 80 passed, 8 failed only on retained Oda schedule/data expectations (`利用可能`/`Available`) because no schedule-data upload was authorized; no mutation was attempted. Existing invalidations are only prior IDs from 2026-07-31; no new invalidation occurred. |

V504-V507 stop: return to Sol for acceptance review. The deployment and infrastructure checks succeeded; public data-dependent assertions remain unresolved without separately authorized fixture/data publication, which was intentionally not performed.

### Phase 4 final acceptance: FA01-FA03

| Task | Status | Commit | Checks | Notes |
| --- | --- | --- | --- | --- |
| FA01 | complete; local only | `9e5908e` | Node 24 synth/build; infra contract tests | Extracted the existing complete security-header and Permissions-Policy values into shared values without changing the public `SecurityHeaders` policy. Added stack-owned `ApiSecurityHeaders` with the same security headers and Permissions-Policy plus `Cache-Control: no-store` with override enabled, and bound it only to the `api/*` behavior. Managed CachingDisabled, the exact OriginRequestPolicy, method filter, and existing API/Cognito/Lambda/IAM contracts were preserved. |
| FA02 | complete; local only | `9e5908e` | `npm run test:infra --workspace @itsrun/infra` (15 passed) | Added semantic assertions for exactly two response-header policies, identical SecurityHeadersConfig and Permissions-Policy values, API-only no-store, and the API/default/data behavior references. No generated logical ID was hardcoded and prior T11/T12 assertions remain in place. |
| FA03 | complete; local only | `9e5908e` | Schedule-state Playwright suite (24 passed) | Installed Playwright Clock only in the mocked retained-data/retry test at `2026-07-31T00:00:00+09:00`, before navigation. The raw `preview-public-routes.spec.ts` suite was not changed or instrumented. |
| FA04 | complete; exact protected-write authorization required | pending | Sol Node 24.18.1 root check; infra tests (15 passed); infra synth; isolated schedule-state E2E (24 passed); CloudFormation `ValidateTemplate`; read-only `cdk diff`; policy/object readback; local fixture create/verify | Sol independently accepted FA01-FA03. The deployed-template diff is exactly one `AWS::CloudFront::ResponseHeadersPolicy` addition and the `api/*` behavior reference change; the Lambda asset remains `ed27108982d0ef94b6b9baa33135d04d2135dfaa4a365fc28fd6f4ca6cdda087.zip`, and the new template SHA-256 is `7f1cd50ea4b5c440579ffec11ea2c03c5fc35fab66a4230d8b2c56ec66af857e`. AWS/default v5 and the committed policy remain exact at pretty-canonical SHA-256 `ca4a20e3e3a7c06c1f1196559886a9679dee98b9a25c7334dd8faf69b19e061e`; v1-v5 are retained and v5 already covers the new response-headers policy and distribution update, so no policy v6 or IAM expansion is needed. The raw suite is unchanged. The verified local non-production 2026-08-09..15 fixture targets only `data/v1/stadiums/oda/availability/2026-08.json`, SHA-256 `ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`, 501 bytes, with existing cache metadata. The destination precondition still exactly matches version `ynZsSK9z.Jztbx7aF.A_qORkruUZu93l`, ETag `"97e252c7a947511065a27d66cb1d972e"`, SHA-256 `82fa4d1ecf2bd920b09c2e64edf96c6f5bc1f63a3a955e40bdacf20c2a4d560e`, 448 bytes, `application/json`, and `public, max-age=0, s-maxage=60`; versioning is enabled. No AWS write occurred. |

FA01-FA03 local validation: `npm run build --workspace @itsrun/infra` and `npm run check` passed under Node 24.18.1; `git diff --check` passed. No AWS call/write, deployment, invalidation, upload, Cognito administration, or dependency change occurred.

FA04 stop: obtain one explicit bundled authorization for exactly one FA05 stack update, one FA06 ETag-conditional replacement of the exact preview August fixture object, and FA07 read-only acceptance. No invalidation, IAM/policy change, web upload, Cognito administration, production, DNS, Firebase, or non-preview mutation is included.

### Phase 4 final acceptance protected bundle: FA05-FA07

| Task | Status | Commit | Checks | Notes |
| --- | --- | --- | --- | --- |
| FA05 | complete; one deploy | `83e6c25` | Node 24.18.1 synth; policy/stack/asset gates; `ValidateTemplate` (`CAPABILITY_IAM` only); `cdk diff --no-change-set`; one `npx cdk deploy ItsRunPreviewHosting --require-approval never` | AWS account `470447451992`, region `ap-northeast-1`, policy v5 default with v1-v5 retained and AWS/local pretty-canonical SHA-256 `ca4a20e3e3a7c06c1f1196559886a9679dee98b9a25c7334dd8faf69b19e061e`. Fresh template SHA-256 `7f1cd50ea4b5c440579ffec11ea2c03c5fc35fab66a4230d8b2c56ec66af857e`; Lambda ZIP remained `ed27108982d0ef94b6b9baa33135d04d2135dfaa4a365fc28fd6f4ca6cdda087.zip`. Change set `arn:aws:cloudformation:ap-northeast-1:470447451992:changeSet/cdk-deploy-change-set/e0d6942d-4f74-4926-af24-355e53847ade`; only `ApiSecurityHeaders` creation and Distribution update occurred. Events reached `UPDATE_COMPLETE` (4/4). Outputs remained API `40xqzug59a`, pool `ap-northeast-1_nmj9cP9st`, client `1olddro3tldfinupl52u9dl1j4`, distribution `E22K5S8F2NUP6K`/`d2via50thoheqm.cloudfront.net`, and unchanged preview bucket names. |
| FA06 | complete; one fixture write | `83e6c25` | Local seed create/verify; S3 version/ETag precondition and readback; bounded CloudFront polling | Regenerated only `data/v1/stadiums/oda/availability/2026-08.json`: 501 bytes, SHA-256 `ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`, sourceCount 7, date range `2026-08-09..2026-08-15`, updatedAt `2026-01-01T00:00:00.000Z`. After exact old precondition (VersionId `ynZsSK9z.Jztbx7aF.A_qORkruUZu93l`, ETag `"97e252c7a947511065a27d66cb1d972e"`, 448 bytes, requested metadata), issued exactly one conditional `PutObject`; new VersionId `wQ1b5EEu1Qzrw93GyN9_bPNtxwaZ5VAE`, ETag `"b2591d35e23ac1b9f2a133f71198b953"`, 501 bytes, SHA-256 above, `application/json`, `public, max-age=0, s-maxage=60`. Old version remained readable with original hash/bytes/metadata. CloudFront returned the new hash on first bounded poll with `200`, `Cache-Control: public, max-age=0, s-maxage=60`, and expected security headers. |
| FA07 | complete; read-only | `83e6c25` | Full preview E2E (88 passed); root `npm run check` passed; API/Cognito/Lambda/CloudFront/S3 readback; `git diff --check` | Stack remains `UPDATE_COMPLETE`; local-only deletion-protected Cognito pool, zero users, empty `admins`, COGNITO-only code client without secret, `itsrun/schedule.write` scope, no IdP/Identity Pool; exact GET/PUT JWT routes, issuer/audience/scope, `$default`, PUT throttle 10/5, Node 24 Lambda 256/10, dedicated role/log group and account-qualified invoke ARNs; managed CachingDisabled, exact OriginRequestPolicy, API-specific no-store policy; unauthenticated API GET 401/no-store and CloudFront PATCH 405 with `Allow: GET, PUT, OPTIONS`/no-store; S3 direct access 403 and public-access blocks enabled. No additional invalidation, object upload, schedule mutation, Cognito administration, IAM/policy version change, production/DNS/Firebase/non-preview change occurred. |

FA05-FA07 AWS writes were exactly one CloudFormation deploy and one ETag-conditional PutObject for the approved preview fixture key. No retry, second deploy, policy v6, bootstrap, or invalidation occurred.

```text
Sol T11/T12 final acceptance target: 5f23d2e
Date: 2026-08-09
Result: T11 and T12 accepted; T13 local implementation may begin under phase4-t13-plan.md
Independent checks: Node 24.18.1; full preview E2E 88 passed; root npm run check passed; infra tests 15 passed; git diff --check; clean worktree
CloudFormation proof: stack UPDATE_COMPLETE with 31 tracked resources and no failed resource; executed change set e0d6942d-4f74-4926-af24-355e53847ade added only ApiSecurityHeaders and modified the existing distribution without replacement
Browser/API proof: CloudFront unauthenticated GET returns 401 with Cache-Control no-store; disallowed PATCH returns 405 with Allow GET, PUT, OPTIONS and no-store; public HTML and data cache contracts remain unchanged
Fixture proof: current version wQ1b5EEu1Qzrw93GyN9_bPNtxwaZ5VAE is 501 bytes with SHA-256 ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb; previous version ynZsSK9z.Jztbx7aF.A_qORkruUZu93l remains readable at its original 448 bytes and SHA-256 82fa4d1ecf2bd920b09c2e64edf96c6f5bc1f63a3a955e40bdacf20c2a4d560e
Mutation audit: exactly one reviewed deploy and one ETag-conditional preview PutObject; invalidation list remains the three 2026-07-31 entries; no IAM/policy v6, Cognito administration, production, DNS, Firebase, or non-preview mutation
T13 authority: local source, exact-pinned approved dependency, tests, documentation, and static build only; no AWS write, preview deployment, Cognito administration, or schedule mutation
```

```text
Sol RC03 review target: 8c06d20
Date: 2026-08-09
Result: RC01-RC02 accepted; one explicit recovery authorization is required for RC04-RC06
Independent checks: Node 24.18.1; infra tests 13 passed; root check passed (web 6, core 7, schedule-api 25, infra 13); infra synth/build; git diff --check; clean worktree
AWS read-only validation: CloudFormation ValidateTemplate accepted the corrected template and reported only expected CAPABILITY_IAM; policy remains default v4; stack remains UPDATE_ROLLBACK_COMPLETE; the retained pool still exactly matches its recorded tags/time/protection and has zero users/clients/groups/resource servers/providers/domain; current deployment principal simulation allows only the planned UpdateUserPool/DeleteUserPool calls on that exact pool ARN
Template proof: failed template had 31 resources and corrected template has 30; only custom ApiCache removal, API managed cache ID, exact four-header OriginRequestPolicy/logical reference, and CDK metadata changed; canonical SHA of every unrelated parameter/resource/output/condition is a5b002ab60af11c32af075faadba3cf429ffa71a6c6a5deaaeae799a94178cde for both
Assets: Lambda ZIP remains ed27108982d0ef94b6b9baa33135d04d2135dfaa4a365fc28fd6f4ca6cdda087.zip; corrected template is a1a88a39d271bfff65603452b3f176a93931c48cad8fa7192252efa926472744.json
IAM: committed/default policy v4 still exactly covers the corrected graph; no policy v5 or permission expansion is needed
Next protected bundle: RC04 exact empty retained-pool cleanup, one RC05 corrected stack deploy, and RC06 read-only verification; no other AWS or application mutation
```

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

### Phase 4 T13 administrator UI implementation

| Milestone | Status | Commit | Evidence |
| --- | --- | --- | --- |
| T13A | complete; local only | `fa859b8`, `cb524c5` | Added exact `oidc-client-ts@3.5.0`, public runtime config, lazy browser OIDC port, code-flow/PKCE scope contract, and transaction-only session store boundary. `npm ci`, web lint/typecheck/unit, and static generation pass. |
| T13B | complete; local only | `fa859b8`, `cb524c5` | Added in-memory session state machine with deduplicated initialize/callback, validated internal return paths, callback parameter cleanup, logout memory clear, expiry handling, and narrow access-token getter. Unit tests cover exact URL scope and hostile return paths. |
| T13C | complete; local only | `fa859b8` | Added same-origin typed API repository and exclusive editor state. GET has no conditional header; PUT uses exactly `If-Match` or `If-None-Match: *`; response size/schema/ETag validation, sanitized status mapping, conflict draft/base/latest preservation, and no automatic retry are covered by unit tests. |
| T13D | complete; local only | `fa859b8` | Added localized `/manage` and `/manage/callback` pages with native controls, accessible status/error messaging, Japanese/English strings, explicit save/discard controls, and generated routes. Existing public route and raw preview files remain unchanged. |
| T13E | complete; local-only browser surface | `fa859b8` | Static build generated `/manage`, `/manage/callback`, `/en/manage`, `/en/manage/callback`; OIDC/API fakes are injected at unit boundaries and no AWS/Cognito/preview API or real token was used. |
| T13F | complete with documented E2E baseline limitation | `4663dfc` | Node 24.18.1: `npm ci`, core unit 7 passed, web unit 12 passed, web lint/typecheck/build, root `npm run check` passed, `git diff --check` passed. Required root `npm run test:e2e` produced 14 legacy passes and 22 preview failures because the root config targets the historical Firebase host while preview suites require `PREVIEW_BASE_URL`; no failure was hidden and no raw preview test was changed. |

T13 local boundary: only direct dependency `oidc-client-ts@3.5.0` was added. No AWS call/read/write, Cognito administration, schedule mutation, token persistence, API/schema change, or production/DNS/Firebase operation occurred. Stop for Sol review before T14.

### Phase 4 T13 correction review: T13R01-T13R06

| Milestone | Status | Commit | Evidence |
| --- | --- | --- | --- |
| T13R01 | complete; local only | `bf3ea60` | OIDC factory accepts injected transaction storage, uses `InMemoryWebStorage` for User/token storage, and shares one browser-lifetime session between `/manage` and `/manage/callback`. |
| T13R02 | complete; local only | `bf3ea60` | API reader requires JSON, incrementally bounds UTF-8 response bodies at 32 KiB with stream cancellation/release, validates strong ETags/envelopes/VersionId, and validates outgoing DTO identity/schema/size/conditional headers. |
| T13R03 | complete; local only | `bf3ea60` | Missing months contain every real calendar date including leap years; editor retains base/draft on failure and conflict, prevents duplicate saves, and preserves latest comparison separately. |
| T13R04 | complete; local only | `bf3ea60` | Admin routes set `noindex, nofollow`, load on signed-in transitions, and retain public status semantics and sanitized exclusive states. Raw public route/SEO suites were not weakened. |
| T13R05 | complete; local only | `bf3ea60` | Legacy Playwright config selects only legacy tests. Separate local production-output admin config/server and 4 admin browser checks added; root E2E is 14 legacy + 4 admin passed. Explicit preview suite passed all 88. |
| T13R06 | complete; local only | `bf3ea60`, follow-up | Node 24.18.1 `npm ci`, web unit 13 passed, core unit 7 passed, root check, lint/typecheck/build, `npm run test:e2e` (18 passed total), explicit preview E2E (88 passed), diff check, and clean status. The initial T13 E2E failure record remains below. |

T13R01-R06 correction handoff: generated admin routes are `/manage`, `/manage/callback`, `/en/manage`, and `/en/manage/callback`; browser storage uses injected session transaction storage plus in-memory User storage. No AWS/Cognito/real-token/data mutation occurred. Stop for Sol review before T14.

```text
Sol T13S01 follow-up: 065a64e
Date: 2026-08-09
Result: complete; closed the S01 lifecycle/storage/navigation evidence gaps without advancing S02.
Production navigation: useAdminSession injects Nuxt navigateTo(path, { replace: true }); callback awaits transaction cleanup before navigating to the validated User.state.returnPath or /manage on failure.
Retry/lifecycle: initialize deduplicates concurrent calls, clears its settled promise for retry, and focused tests cover signed-out, signed-in, failure, retry, and concurrency. Logout clears memory before redirect and ends signedOut on both resolved and rejected redirect paths.
Storage proof: actual UserManager settings.userStore accepts a token-bearing User JSON and returns it from the in-memory store; injected session storage contains no token/User value. The stateStore writes an oidc. transaction key, cleanup removes only oidc. keys, and unrelated session storage remains.
Test proof: focused web session/OIDC suite now passes 19 tests covering unconfigured state, login safe/hostile paths, callback safe/hostile/concurrent/success/failure/cleanup ordering/navigation, lifecycle events/listener registration, logout outcomes, retry, raw surface absence, and no raw error logging.
Checks: Node 24.18.1 web unit 19 passed; lint, typecheck, build, root npm run check, and git diff --check passed. No AWS/Cognito/preview operation occurred.
Stop: return to Sol review; do not begin T13S02.
```

```text
T13S01 evidence follow-up: 66999d5
The focused session suite now has 20 passing tests, including cleanup rejection: cleanup is invoked, its raw error is swallowed without console output, and safe callback navigation still occurs. No source/config beyond the approved S01 files changed.
```

```text
Sol T13S01 acceptance target: 673c7d4
Date: 2026-08-09
Result: accepted; T13S02 exact bounded API repository work may begin
Independent checks: Node 24.18.1; web unit 20 passed; web typecheck passed; git diff --check; clean worktree
Review: production callback now awaits OIDC transaction cleanup and Nuxt navigateTo replacement into the shared browser-lifetime session; initialize retry, logout terminal state, lifecycle clearing, raw User non-exposure, and in-memory UserStore versus injected transaction storage are implemented and focused-tested
Scope: authorize only phase4-t13-second-review.md T13S02 local adminApi source/tests/log; no UI, Playwright, AWS, Cognito, preview mutation, dependency, or T13S03+ work
```

```text
T13S02 implementation: f14ede1
Date: 2026-08-09
Result: complete; local-only exact bounded API repository.
Request contract: constructor rejects every basePath except exact same-origin /api/v1; paths are generated only from validated stadium/yearMonth. Native/injected fetch is invoked through an arrow wrapper. GET has no conditional header; PUT has exactly one strong If-Match or If-None-Match: * condition.
DTO/response contract: plain exact DTO keys, identity, core schedule parsing, real dates/status tuples, and 32 KiB serialized limit are validated before PUT. Status mapping occurs before body handling; GET 404 alone returns null. Success requires application/json, exact GET/PUT envelopes, strong quoted ETag, and nonempty PUT VersionId.
Stream proof: boundedJson refuses missing bodies, never falls back to response.json, uses fatal UTF-8 decoding, accepts at most 32 KiB, and cancels/releases exactly once on overflow or stream error while preserving sanitized AdminApiError output.
Focused tests: web unit suite 24 passed, covering exact paths/headers/body, base/path/condition/ETag/DTO validation, missing token, status mapping, content type/envelopes, oversized/malformed streams, and forbidden response text. Web lint/typecheck/build and root npm run check passed under Node 24.18.1; no AWS/real API/preview operation occurred.
Stop: return to Sol review; do not begin T13S03.
```

```text
T13S02 stream evidence follow-up: 88e2adf
Focused web unit suite is now 25 passed; mocked overflowing and stream-error readers directly prove cancel() and releaseLock() are each invoked exactly once. No API behavior outside T13S02 changed.
```

```text
T13S02 matrix follow-up: fb4bb8c
Date: 2026-08-09
Focused web unit suite is now 30 passed. Added all four stadium exact GET/PUT paths and headers, token-before-request ordering, missing-token zero-fetch and network mapping, base/path/condition/ETag matrices, malformed DTO/core date/tuple/status/31-day/serialized overflow attempts, exact status/message and console non-leakage, content-type/envelope/response ETag matrices, UTF-8 split and Content-Length variants, native fetch receiver binding, and successful-reader cancel=0/release=1 evidence.
The exact bounded JSON success case is JSON.stringify('x'.repeat(32766)): TextEncoder byte length 32768; 32767 characters produces exactly 32769 bytes and is rejected. No AWS/real API/preview operation occurred; stop before T13S03.
```

```text
Sol T13S02 acceptance target: 21c8892
Date: 2026-08-09
Result: accepted; T13S03A editor-state work may begin
Independent checks: code review of exact same-origin paths, bound native fetch, runtime conditional union, complete DTO/core validation, status-first mapping, exact GET/PUT envelopes, strong ETag/VersionId, fatal UTF-8 streaming bound, and single cancel/release; Node 24 web unit 30 passed; root checks reported passed; diff check and clean worktree
Sequencing update: phase4-t13-second-review.md splits prior T13S03 into T13S03A pure editor state and T13S03B Vue/localized UI, each with a separate Sol review
Next scope: local editor module/tests/log only; no Vue/locale/Playwright/AWS/Cognito/preview/dependency/T13S03B+ change
```

```text
T13S03A implementation: 2277670
Date: 2026-08-09
Result: complete; pure editor state module separated from repository contract.
States: idle/loading/missing/ready/saving/saved/loadFailure/saveFailure/forbidden/conflict/comparisonFailure with explicit selection, generation, base/draft/dirty, condition, latest, and deterministic cell diffs. A compatibility-only type branch preserves the unchanged pre-S03 page without introducing a runtime state.
Safety: missing drafts generate every real calendar date for 28/29/30/31-day months with exact three-status tuples; loaded base and draft are cloned; validated cell updates never mutate base. Clean saves are skipped, double saves are suppressed, failures preserve base/draft/condition, and explicit retry is required.
Conflict: one PUT then one latest GET, no automatic PUT retry; null/failing comparison is separate, comparison retry is GET-only, diffs are date/slot sorted, keep-editing rebases to latest while preserving local draft, and replacement requires confirmation.
Concurrency/listeners: load generation prevents stale completion from overwriting a newer selection; subscribe/unsubscribe is deterministic. Raw errors are converted to sanitized state messages and are not logged.
Tests/checks: Node 24.18.1 web unit 39 passed; web lint/typecheck/build and root npm run check passed; git diff --check passed. No Vue/UI/locale/Playwright/AWS/preview/dependency operation occurred.
Stop for Sol review before T13S03B.
```

```text
T13S03A follow-up: d49746c
Date: 2026-08-09
Result: complete; tightened pure editor validation and conflict boundaries.
Validation: updateDraft now delegates full document validation to @itsrun/core parseScheduleMonth with a validation-only updatedAt; invalid real/cross-month dates, tuple shape/status, 31-day overflow, identity, unknown fields, and oversized payloads are rejected before state mutation.
Dirty/reload: dirty is recomputed against immutable base (or zero-valued missing draft), so reverting edits clears dirty. Any dirty load/reload, including same selection, requires a confirmation callback; absent/false confirmation preserves state.
Conflict/rebase: conflict and comparisonFailure save are no-ops until explicit rebaseOnLatest/keepEditing; the rebased save uses the latest ETag. replaceLatest remains confirmation-gated. Comparison retry generation prevents stale completion from replacing newer state.
Tests/checks: Node 24.18.1 web unit 41 passed; root npm run check passed; git diff --check passed. No UI/locale/Playwright/AWS/preview/dependency operation occurred. Stop before T13S03B.
```

```text
T13S03B implementation: d9daf69
Date: 2026-08-09
Result: complete; localized accessible admin editor rendering only.
UI contract: manage.vue renders idle/auth, loading, missing, ready, saving, saved, loadFailure, saveFailure, forbidden, conflict, and comparisonFailure without relying on pre-S03 compatibility states. Safe localized messages never expose raw technical errors, response bodies, tokens, or claims.
Status/time contract: ja/en use core meanings 0=未公開/Unknown, 1=利用可能/Available, 2=利用不可/Unavailable. Core stadium timeRanges provide actual slot headings. Initial month uses Asia/Tokyo current month.
Safety/accessibility: dirty load/reload uses editor confirmation; saving disables competing controls and conflict hides normal Save. Conflict renders deterministic base/local/latest cells with explicit rebase, replacement confirmation, and GET-only comparison retry. Table caption/scope/labels, alert/status live regions, and noindex/nofollow are retained.
Browser/unit evidence: local admin Playwright harness passed 4 tests across ja desktop and en mobile; admin display tests and web unit suite passed (43 web tests). Web lint/typecheck/build and root npm run check passed under Node 24.18.1; no AWS/preview/Cognito/dependency operation occurred.
Stop before T13S04.
```

```text
T13S03B type cleanup follow-up: 8c18a32
Removed the obsolete comparisonError/error compatibility branches from the editor state union; the UI now depends only on the S03A exclusive states. Web unit (43) and typecheck remained passing.
```

```text
Sol T13 second review target: e854f98
Date: 2026-08-09
Result: not accepted; split remaining work into phase4-t13-second-review.md T13S01-T13S05 with a Sol review after each increment
Session blockers: callback still ignores User.state.returnPath, replaces browser history without routing to the editor, has no explicit transaction cleanup, and exposes the raw User computed value; no session lifecycle/concurrency/event/storage tests were added
API blockers: outgoing If-Match is not validated; native fetch remains a method-valued default; the new bounded reader/status/envelope behavior has almost no focused tests
Editor/UI blockers: save errors still discard base/draft, comparison actions and per-cell UI remain absent, raw status labels still define 0 as available and 1 as partly available, and signed-in/browser behavior lacks deterministic proof
Browser blockers: the administrator suite only checks two unconfigured smoke pages in two projects; it has no fake OIDC/API injection and does not test login, callback, persistence, GET/edit/conditional PUT, non-admin, missing create, conflict, discard/reload, logout, or expiry
Accepted partial corrections: legacy config selects only legacy tests; missing months generate real calendar dates; stream reader exists; raw preview files remain unchanged; no protected operation occurred
Next authorized work: T13S01 only, local OIDC/session source, tests, log, and build; stop before T13S02
AWS authority: none
```

```text
Sol T13 first review target: 75804cb
Date: 2026-08-09
Result: not accepted; implement phase4-t13-review.md T13R01-T13R06 locally
Release blockers: callback and manage create separate session/UserManager instances so the memory-only authenticated User does not survive route transition; callback does not consume its validated return state; callback cleanup uses history replacement without entering the editor
API blockers: response.json is unbounded when Content-Length is absent/false/understated; ETag and success-envelope checks are incomplete; PUT response does not require VersionId; outgoing DTO validation is incomplete
Editor/UI blockers: missing month has no editable dates; save errors can discard base/draft; conflict comparison/reload UI is absent; signed-in data load relies on a one-time mounted snapshot; status 0/1 labels conflict with the existing core contract
Test blockers: no session-state tests, incomplete repository/editor matrix, no component/admin browser tests, no storage inspection, and required npm run test:e2e failed because the root config runs preview suites against the legacy host
Accepted boundary: exact oidc-client-ts 3.5.0 dependency and no AWS/Cognito/preview mutation; existing raw preview files were unchanged
AWS authority: none; corrections are local source/test/docs/static build only and must stop before T14 or deployment
```

### Phase 4 T13 second review — T13S01

```text
Milestone: T13S01
Implementation commit: 020e476
Date: 2026-08-09
Result: complete; local-only OIDC/session correction
Session boundary: one injectable browser-lifetime session factory with reset hook; initialize and callback promises are deduplicated and event listeners attach once. Raw User/manager/profile/claims are closure-only; the exposed surface is state, sanitized error, lifecycle methods, and getAccessToken.
Callback boundary: User.state.returnPath is validated to /manage or /manage/*, successful and failed callbacks use injected replacement navigation, and query/fragment-bearing callback URLs are replaced with the exact safe path. Failure exposes only sanitized authentication error state.
Cleanup/storage proof: explicit oidc-client-ts transaction cleanup removes only the dedicated oidc. transaction/PKCE storage keys and preserves unrelated sessionStorage keys. User/token storage remains InMemoryWebStorage; the focused tests prove the injected transaction store does not retain the token-bearing User.
Lifecycle proof: unload, expiry, silent-renew error, logout success/failure, callback failure, and unconfigured paths clear memory authentication; no token, claims, or raw error is logged or exposed.
Checks: Node 24.18.1 web unit 17 passed; web lint, typecheck, build, root npm run check (including infra tests/build), and git diff --check passed.
AWS authority: none; no AWS/preview/Cognito operation occurred. Stop for Sol review before T13S02.
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

### Phase 4 T13 second-review follow-up — T13S03B

```text
Milestone: T13S03B follow-up
Start: d70c496
Date: 2026-08-09
Result: complete; local-only manage UI correction, no S04 work
UI contract: schedule table now iterates core time ranges with zero-based slot indices for labels, IDs, reads, and updates; saved state retains the submitted draft table while showing updatedAt, ETag, and VersionId metadata.
Conflict contract: a conflict with no latest comparison exposes only GET-only comparison retry; diff/rebase/confirmed-replace controls render only after a latest document exists.
Error contract: all EditorError kinds map to sanitized localized load/save/comparison messages; unauthorized offers reauthentication, forbidden has one alert, and no raw error is rendered.
Locale/browser proof: core 0/1/2 labels remain ja 未公開/利用可能/利用不可 and en Unknown/Available/Unavailable. Focused helper tests cover every error kind, action, forbidden deduplication, and all three slot IDs. Admin-local Playwright explicitly checks localized title, noindex/fail-closed safe text, and localized routes for both ja/en projects (4 passed).
Checks: Node 24.18.1 web unit 43 passed; web lint/typecheck/build passed; root npm run check passed (including infra tests/build); admin-local Playwright 4 passed; git diff --check passed.
AWS authority: none; no AWS/preview/Cognito/deployment/invalidation operation occurred. Stop for Sol review before T13S04.
```

### Phase 4 T13 second-review — T13S04

```text
Milestone: T13S04 honest administrator browser contract
Start: a44da55
Date: 2026-08-09
Result: partial local-only admin harness and static server; remaining matrix is explicitly not accepted, stopped before T13S05
Build boundary: the admin Playwright webServer deterministically generates an isolated production output under .artifacts/admin-e2e-output with explicit non-secret authority/client values. The normal web build remains web/.output/public and a marker scan rejects admin-e2e authority/client or ADMIN_E2E markers there.
Admin browser proof: root npm run test:e2e ran the legacy suite (14 passed) and the isolated admin suite (8 passed across desktop Japanese and mobile English). The admin suite asserts localized title/noindex/fail-closed behavior, callback routes, authorization-code + PKCE settings with exact scopes openid email profile itsrun/schedule.write and callback redirect URI, and a narrow build-only fake authority path covering authenticated GET/edit/conditional PUT with one request and no token/User persistence. No fake adapter grants production authorization.
Static server proof: resolver tests cover query removal, directory/index resolution, unknown paths, decoded and backslash traversal rejection, root containment, deterministic HTML/JS/CSS/JSON/SVG/content fallback types, GET/HEAD, and 405 with Allow. Focused server tests: 3 passed.
Preview preservation: preview-public-routes.spec.ts SHA-256 f220df4e3c8943ed888eea5846605883f13fd5a705b4fbd29d80d6b900a8424e before/after; preview-schedule-states.spec.ts SHA-256 37d528720efe072122cca78b97f0e945da127b143b7c16bccb54b356a9131dca before/after.
Checks: Node 24.18.1 web unit 43 passed; web lint/typecheck/build passed; normal-output marker scan passed; root npm run check passed; root npm run test:e2e at this point passed (14 legacy + 6 admin); preview suite passed 88/88; git diff --check passed.
AWS authority: none; no AWS, Cognito, deployment, upload, invalidation, production, DNS, Firebase, or schedule mutation occurred. Stop for Sol review before T13S05.
```

### Phase 4 T13 S04A authentication-browser lifecycle follow-up

```text
Start: f705f39
Result: partial; lifecycle coverage expanded and stopped before S05
Browser proof: admin-local now passes 20 cases across Japanese desktop and English mobile, including logout-to-signed-out, initialization/redirect failure sanitization, expiry, user-unloaded, and silent-renew event clearing. Existing login settings, authenticated GET/edit/conditional PUT, no-storage token proof, and localized fail-closed cases remain passing.
Callback limitation: direct static `/manage/callback?code=...` success/failure navigation was attempted without the fake adapter's history bypass but the current generated callback route did not execute the client callback lifecycle; the deterministic browser callback assertion therefore remains unresolved. Existing OIDC/session unit tests still cover validated safe/hostile return paths, cleanup-before-navigation ordering, callback failure sanitization, and lifecycle listener registration.
Checks: Node 24.18.1 admin-local Playwright 20 passed; no AWS/Cognito/deployment/invalidation/production/DNS/Firebase operation occurred. S04 API/editor matrix and S05 remain forbidden.
```

### Phase 4 T13 second-review — T13S04 completion follow-up

```text
Start: f5de9e6
Result: partial; retained prior tests and added deterministic build-only auth controls, failure coverage, and truthful accounting. S05 remains forbidden.
Added coverage: build-only fake authority modes for initialization failure, redirect failure, authenticated GET/edit/conditional PUT, memory-only user/token proof, localized safe failure UI, and PKCE settings. Admin-local suite now passes 12 cases across desktop Japanese and mobile English. Static server temporary directories are cleaned in finally blocks.
Known remaining matrix: direct browser callback success/cleanup navigation is not reproducible in the current static callback route without changing the callback page/session source outside this harness ownership; non-admin 403, missing-create, stale conflict/rebase/replace, comparison retry, dirty reload confirmation, expiry/unloaded/silent-renew event, and logout browser cases remain unimplemented. Existing unit session tests cover callback cleanup, hostile return paths, lifecycle events, logout, and memory-only storage.
Checks: Node 24.18.1 static server 3 passed; admin-local Playwright 12 passed; normal output marker scan passed; git diff --check passed. No AWS/Cognito/deployment/invalidation/production/DNS/Firebase operation occurred.
```

### Phase 4 T13 S04A callback lifecycle follow-up — blocked at route boundary

```text
Start: a760f83
Result: stopped with evidence; no S04 API/editor or S05 work performed.
Attempt: changed manage/callback.vue from top-level client await to an explicit onMounted(() => void session.callback()) lifecycle. The generated client bundle contained the callback implementation, but the browser route still rendered the parent manage.vue page and never mounted callback.vue.
Evidence: isolated admin build generated web/.output/public/manage/callback/index.html whose main content was the manage editor/login page (admin-title/admin schedule), not callback-title/loading. Direct GET /manage/callback?code=fake&state=fake remained at that URL; safe test-only callback counter was absent and no cleanup/navigation occurred. The same failure reproduced for success, callbackFailure, and hostileReturn modes (6 failures across ja desktop and en mobile). Existing 20 admin lifecycle tests remained passing before this attempt.
Required resolution is outside the assigned callback-only files: the Nuxt nested route needs its parent route integration (manage.vue must render the child route, or equivalent route-structure correction) before callback.vue can mount. That file was not authorized for this milestone, so no speculative change was made.
No AWS/Cognito/deployment/invalidation/production/DNS/Firebase operation occurred. Stop for Sol review and ownership decision.
```

### Phase 4 T13 S04A route correction

```text
Start: 131c3a1
Result: complete for the callback-only route correction; stopped before S04 API/editor work and S05.
Route fix: moved the editor page from pages/manage.vue to pages/manage/index.vue and corrected relative imports. The callback page is now a sibling route, so /manage renders only the editor/login page and /manage/callback renders only the callback loading page before lifecycle processing.
Lifecycle fix: callback.vue uses an explicit client onMounted/nextTick call with the current callback URL. The session callback remains deduplicated, clears transaction state before navigation, and uses injected Nuxt navigateTo replacement; the fake callback adapter contains no callback history bypass. Sanitized callback failure state is retained through the post-callback manage initialization so the retry alert remains visible.
Generated output proof: normal build and isolated admin build both generated separate manage/index.html and manage/callback/index.html; callback output contains callback-title and no admin-title. verify-normal-output.mjs passed with no admin E2E markers.
Browser proof: admin-local Playwright 26 passed across Japanese desktop and English mobile. Direct success, callbackFailure, hostileReturn, cleanup/count exactly once, query/fragment removal, same-origin /manage replacement, signed-in/logout, sanitized failure, and no raw token/claim/error output are covered. Existing 20 lifecycle cases remain passing.
Checks: Node 24.18.1 web unit 43 passed; web lint/typecheck/build passed; normal output verification passed; admin-local 26 passed; root checks and diff checks pending in this commit workflow.
AWS authority: none; no AWS/Cognito/deployment/invalidation/production/DNS/Firebase operation occurred.
```

### Phase 4 T13 S04A callback navigation follow-up

```text
Start: df5bed0
Result: complete; removed the page-level navigation fallback so createAdminSession.callback remains the sole cleanup-then-replace navigation owner and preserves validated /manage/* return paths.
The callback page now invokes session.callback(window.location.href) exactly once from onMounted after nextTick. Existing unit coverage retains valid /manage/schedule navigation, while callback browser coverage continues to verify success/failure/hostile safe /manage outcomes.
No AWS/Cognito/deployment/invalidation/production/DNS/Firebase operation occurred.
```

### Phase 4 T13 S04B2 assertion follow-up

```text
Start: 7395b00
Result: complete; stopped before S05.
Strengthened the existing five B2 cases without source/UI changes. Stale conflict and comparison retry now assert the exact 2026-08-01 / 09:00-12:00 diff row with localized base/local/latest values; rebase preserves the edited value and the subsequent PUT body carries the edited tuple while the route verifies the latest ETag. Same-selection coverage exercises both dismissed Load and accepted Discard confirmation paths. Selection coverage changes stadium and month together, restores both on cancel, then requests the exact yumenoshima/2026-09 endpoint and returns a valid 30-day document; the rendered table has 90 selects.
Checks: focused B2 10 passed; full admin-local 44 passed; web unit 44 passed; lint/typecheck/build passed; normal output marker scan passed; root npm run check passed; git diff --check passed. No AWS/Cognito/deployment/invalidation/production/DNS/Firebase operation occurred.
```

### Phase 4 T13 S04B2 admin concurrency follow-up

```text
Start: 5474034
Result: complete; stopped before S04B3/S05.
Added deterministic browser coverage for stale conflicts with explicit latest rebase, confirmed latest replacement, comparison GET-only retry, dirty same-selection reload confirmation, and dirty month/stadium selection confirmation. Each case runs in Japanese desktop and English mobile projects (10 focused tests total), with exact request counts, conditional headers, localized dialog/action text, deterministic cell values, and raw error/body non-exposure assertions.
Focused B2: 10 passed. Full isolated admin suite: 44 passed (34 accepted prior cases plus 10 B2 cases). Web unit: 44 passed; lint, typecheck, build, normal-output marker scan, root npm run check, and git diff --check passed.
No AWS/Cognito/deployment/invalidation/production/DNS/Firebase operation occurred; no dependencies or source contracts were changed.
```

### Phase 4 T13 S05 final verification and truthful handoff

```text
Start: 77be9c1
Result: complete; T13 local implementation/test acceptance verified, stopped before T14.
Environment: Node v24.18.1; npm ci completed. Core unit 7 passed; web unit 44 passed; web lint/typecheck/build passed; static server tests 3 passed; infra tests 15 passed; root npm run check passed. Root E2E passed 14 legacy + 44 isolated admin cases. Explicit preview E2E passed 88/88. Normal output marker scan passed: no admin E2E/fake-authority markers in web/.output/public. Browser tests proved memory-only User/token handling and no token/User persistence in local/session storage; OIDC transaction material is the only temporary session storage contract.
Preview preservation: tests/e2e/preview-public-routes.spec.ts SHA-256 f220df4e3c8943ed888eea5846605883f13fd5a705b4fbd29d80d6b900a8424e; tests/e2e/preview-schedule-states.spec.ts SHA-256 37d528720efe072122cca78b97f0e945da127b143b7c16bccb54b356a9131dca. Both remain byte-for-byte unchanged from the accepted baseline.
Truthful accounting: this final record supersedes the earlier preliminary T13R06 count claims in the milestone table; earlier failed/partial callback navigation records remain preserved above and the later route/navigation resolutions remain recorded. T13 admin implementation and local tests are accepted; the admin UI has not been deployed to preview during T13 and would require separate explicit deployment authority. T14 has not started.
No AWS calls or writes, IAM/policy changes, CloudFormation/CDK deployment, CloudFront invalidation, Cognito administration, preview data mutation, production/DNS/Firebase operation occurred.
```

### Phase 4 T13 S04B1 assertion follow-up

```text
Start: 98e7ba0
Result: complete; no source fix required; stopped before B2/S05.
Strengthened the four B1 cases with exact GET/PUT counts (8 focused cases = 4 x 2 projects), exact schema top-level keys, 31 date keys and valid 3-tuples, edited and unchanged cells, strong ETag conditions, Authorization/content type, returned metadata/status, single 403 alert, all 93 create defaults, and 401 reauthentication code/PKCE settings with no automatic retry (GET remains exactly one).
Checks: B1 focused command `--grep 'B1 '` ran 8 passed; full admin-local 34 passed; web unit 44 passed; lint/typecheck/build passed; normal marker scan passed; root npm run check passed; git diff --check passed; clean worktree after commit.
No AWS/Cognito/deployment/invalidation/production/DNS/Firebase operation occurred.
```

### Phase 4 T13 S04B1 basic API outcomes

```text
Start: 56a3735
Result: complete; stopped before S04B2/S05.
Admin browser matrix added in the isolated test-only suite with fixed Japanese desktop and English mobile assertions: existing update (31 days x 3, exact GET/ETag, one strong If-Match PUT, JSON/body identity, returned updatedAt/ETag/VersionId), non-admin 403 (one GET/no PUT, permission message, fail-closed/no raw body), missing 404 create (31-day calendar x 3, one If-None-Match:* PUT, metadata), and expired 401 (localized reauthentication, no retry/raw response). No token/User persistence or token output is used.
Checks: B1 focused 8 passed; full admin-local 34 passed (26 accepted baseline + 8 B1); web unit 44 passed; lint/typecheck/build passed; normal marker scan passed; root npm run check passed; git diff --check passed.
No AWS/Cognito/deployment/invalidation/production/DNS/Firebase operation occurred.
```

### Phase 4 T13 S04A navigation timing correction

```text
Start: 68b6fb9
Result: complete; native callback navigation now waits exactly one requestAnimationFrame before one replaceState and one popstate.
The exported async replaceClientPath navigator is injected directly. Unit coverage proves no replacement before the fake frame and exactly one replaceState/popstate afterward; cleanup-before-navigation ordering remains covered.
Browser proof: focused callback success/failure/hostile cases 6 passed, and full admin-local suite 26 passed across Japanese desktop and English mobile. Query/fragment cleanup, same-origin safe navigation, signed-in and sanitized failure states passed.
Checks: web unit 44 passed; web typecheck/build passed; normal output marker scan passed; root npm run check passed; git diff --check passed; clean worktree after commit.
No AWS/Cognito/deployment/invalidation/production/DNS/Firebase operation occurred.
```

### Phase 4 T13 S04A native replace navigator follow-up

```text
Start: b15381c
Result: stopped after focused browser gate failure.
Added exported replaceClientPath(path), performing exactly one history.replaceState(window.history.state, '', path) and one popstate dispatch, and injected it as the sole session navigation. No router/Nuxt context, navigateTo, page fallback, full reload, location, pushState, or double navigation remains. Added focused unit proof for one replaceState and one popstate.
Evidence: web unit passed 44 tests, but all six direct callback browser cases remained at /manage/callback and failed exact /manage URL assertions in the isolated admin build. No test was weakened.
No AWS/Cognito/deployment/invalidation/production/DNS/Firebase operation occurred.
```

### Phase 4 T13 S04A Nuxt-context navigation follow-up

```text
Start: 56e9fdb
Result: stopped after focused callback gate failure.
Captured useNuxtApp() during useAdminSession setup and changed injected navigation to one await nuxtApp.runWithContext(() => navigateTo(path, { replace: true })); no router.replace, page fallback, history/location operation, or double navigation remains.
Evidence: all six direct callback success/failure/hostile cases stayed at /manage/callback and failed the exact /manage URL assertion in the isolated admin build. Existing failure history is preserved; no test was weakened.
No AWS/Cognito/deployment/invalidation/production/DNS/Firebase operation occurred.
```

### Phase 4 T13 S04A navigation-context correction

```text
Start: ff2e046
Result: stopped with evidence pending navigation implementation decision.
The callback page fallback remains removed. useAdminSession captures the router during composable setup and performs one awaited Nuxt replace after router readiness; no useRouter call occurs inside the async callback and no double navigation is attempted.
Focused unit tests continue to pass (43 web tests), but the six direct callback browser cases do not reach /manage with a single captured navigation in the isolated static admin build; all remain at /manage/callback with cleanup behavior not observable by the browser assertion. The prior page-level fallback made those cases pass but is explicitly forbidden for this correction. No test was weakened.
No AWS/Cognito/deployment/invalidation/production/DNS/Firebase operation occurred. Stop for Sol review.
```

### Phase 4 T13 S04A exact router replacement follow-up

```text
Start: 899f52b
Result: stopped after the required focused browser gate failed.
Implementation is now exactly navigate: async (path) => { await router.replace(path) }, with router captured once during useAdminSession setup. No navigateTo, router.isReady, async useRouter call, or page fallback remains.
Evidence: the six direct callback success/failure/hostile browser cases (Japanese desktop and English mobile) remained at /manage/callback and failed their /manage URL assertion. No additional tests were run after this binding stop condition; prior 43 web unit tests and normal checks remain recorded in the preceding entry.
No AWS/Cognito/deployment/invalidation/production/DNS/Firebase operation occurred.
```

### Phase 4 T14A pure Firestore snapshot parser

```text
Start: c4fe544
Result: complete; local-only T14A, stopped before T14B.
Added the pure @itsrun/core Firestore snapshot contract and normalizer. The exact raw schema is schemaVersion 1 plus four STADIUMS-mapped collection descriptors with explicit slug/legacyId/documents fields; empty collections normalize to an empty result. Validation rejects unknown/missing/duplicate/mismatched descriptors, malformed or cross-identity paths, non-real Gregorian dates, duplicate documents, non-plain/unknown data, sparse or wrong-length tuples, and every status outside dense integer 0/1/2. Normalized records contain only typed slug/date/status and sort deterministically independent of collection/document order.
Synthetic fixture: four descriptors and four records covering 2023/2024 boundaries, leap day, and all statuses; normalized count 4 in sorted order komazawa/20240101, oda/20240229, todoroki/20240301, yumenoshima/20231231. No production values, credentials, actor data, or tokens are included.
Checks: npm ci; core unit 7 passed; firestore-focused Vitest 8 passed; root npm run check passed (web 44, core 7, service 25, infra 15); git diff --check passed. The quoted glob invocation was corrected to the required shell-expanded focused command; final focused run passed.
No Firebase import/install/read, AWS/network/write/deploy, production data, schedule mutation, or new dependency occurred. T14B+ and T14E remain pending Sol review.
```

### Phase 4 T14A strict snapshot test follow-up

```text
Start: 108f9c5
Result: complete; tests/log only, stopped before T14B.
Added 14 focused tests covering every top-level, descriptor, document/data, date/path, duplicate, status (including NaN/Infinity/float/boolean/object/undefined/string/null/sparse/short/long), permutation, immutability, copied tuple, and deterministic error boundary. Every malformed case asserts SnapshotValidationError with sanitized category/coordinate-only messages and no raw path, ID, credential, token, actor, or value echo.
Checks: Node 24.18.1 core unit 7 passed; firestore-focused Vitest 14 passed; root npm run check passed (web 44, core 7, service 25, infra 15, build); git diff --check passed. Parser source was unchanged in this follow-up; no dependencies or protected operations were added.
```

### Phase 4 T14B deterministic transform and atomic writer

```text
Start: 7dbccd9
Result: complete; local-only T14B, stopped before T14C.
Added deterministic monthly transformation and manifest generation with explicit sanitized sourceIdentity and canonical ISO updatedAt, no clock/random/path inputs, strict direct-record validation, sorted slug/month/day output, shared parseScheduleMonth validation, exact two-space JSON plus one newline, UTF-8 byte counts, and SHA-256 over exact bytes. Manifest property order/schema and empty-input null date ranges are documented and tested.
Synthetic output: 4 objects with keys data/v1/stadiums/{komazawa,oda,todoroki,yumenoshima}/availability/{2024-01,2024-02,2024-03,2023-12}.json; bytes/hashes are fixed in focused tests: 188/d4f799f61635fc234753e554981b97ddb0493569781b6c40418ccf46851218c0, 183/d1e97a0a4b58c71a1ada419dfe3fb46e8ef3f9daf826a86aea3214dd65a11a44, 188/ad4d519f9afb761291b0ed314de2f3db080f17217b86df5e9bd0305ebd7be012, 191/133ef50a73e34f3e9bff3b46f3ab8c8e226637e2eb7455e6df266ce6f051626c.
Atomic writer uses an exclusive temporary sibling, containment checks, exclusive files, atomic rename, exact-temp cleanup on failure, and refuses existing targets/relative traversal. Focused Firestore A+B tests: 24 passed; core unit: 7 passed; root npm run check passed (web 44, core 7, service 25, infra 15, build); git diff --check passed.
No Firebase/AWS/network/credential/data operation or new dependency occurred. T14C+ remain pending Sol review.
```

### Phase 4 T14D local tooling final checks

```text
Correction to the preceding T14D entry: core unit 7 and root npm run check
completed successfully before commit. Final focused A+B+C+D Firestore suite:
43 passed (including 6 upload/readback tests). Root check passed (web 44,
core 7, service 25, infra 15, build); git diff --check passed. No protected
operation was attempted; T14E+ remain pending Sol review.
```

### Phase 4 T14C exhaustive source/target comparison and reports

```text
Start: 15d7298
Result: complete; local-only T14C, stopped before T14D.
Added a pure comparator that validates normalized source records and target
artifacts, rebuilds canonical monthly artifacts, and exhaustively compares
objects, dates, all three status cells, metadata, hashes, byte sizes, parser
identity, manifest aggregates, and canonical bytes. Invalid source/target data
fails closed to sanitized integrity/source mismatches without raw body, path,
credential, token, actor, or arbitrary injected-value output.

The machine report has stable schema/order, sorted typed mismatches, exact
sourceRecordCount/transformedDayCount/comparedCellCount/object counts, and
comparisonExitCode is zero only for match. Human text is generated only from a
validated machine report. Synthetic zero-diff report counts are 4/4/12 with
expected/actual object counts 4/4; machine report SHA-256 is
30b6c176e3c9ec7501a0d24780604685a99bfc83fba219aacd066962c82aacbf.

Checks: Node 24.18.1; Firestore-focused A+B+C Vitest 35 passed; core unit and
root npm run check remain to be run before commit. No Firebase/AWS/network/
credential/data operation or new dependency occurred. T14D+ remain pending Sol
review.

```

### Phase 4 T14E1R07 gcloud ADC empty-account correction

```text
Start: a7ea6b9
Source/test commit: b0a1773
Result: complete; local-only E1R07, stopped before T14E2.
The third protected attempt stopped during local ADC validation because the
actual gcloud 579 impersonated ADC uses an empty source_credentials.account.
All other reviewed schema, target, host, and bounds checks remained intact;
no Firestore entity/document/collection read occurred, no capture output was
created, and no AWS write occurred.

The validator now accepts account only as the empty gcloud form or a bounded
email-like string, while rejecting malformed nonempty accounts and non-string
types. Exact keys, empty delegates, authorized_user type, googleapis.com
universe domain, impersonation target/path, and secret bounds remain enforced.
The synthetic fixture and deterministic tests cover empty acceptance and
malformed/nonempty rejection without exposing credential values.

Node 24.18.1; exporter tests 13 passed; actual CLI --help passed; root npm run
check passed (web 44, core 7, schedule-api 25, infra 15, all builds); git
diff --check passed; worktree clean. No Firebase/Google/AWS/network/auth/data
operation occurred. T14E2+ remain pending Sol review.
```

### Phase 4 T14C trusted-options and report-integrity follow-up

```text
Start: a938957
Result: complete; local-only T14C follow-up, stopped before T14D.
Comparator API now requires explicit trusted `{ sourceIdentity, updatedAt }`
options and never derives expected artifacts from the target manifest. Source
and target validation/counts are independent: valid-source invalid-target cases
retain sourceRecordCount/transformedDayCount/comparedCellCount/expectedObjectCount
4/4/12/4, while invalid direct source records and duplicates report `source`
mismatches. Complete manifest identity/timestamp/object metadata/order/aggregate
and canonical manifest-byte comparisons now reject self-consistent target rewrites.
Report validation requires schemaVersion 1, real dates, exact count invariants,
coherent per-kind coordinates, sorted mismatches, and match/exit-code coherence.

Focused Firestore A+B+C tests: 37 passed; core unit 7 passed; root npm run
check passed (web 44, core 7, service 25, infra 15, build); git diff --check
passed. The zero-diff machine SHA remains
30b6c176e3c9ec7501a0d24780604685a99bfc83fba219aacd066962c82aacbf. No
Firebase/AWS/network/credential/data operation or new dependency occurred.
T14D+ remain pending Sol review.
```

### Phase 4 T14D local upload/readback tooling

```text
Start: 2b59792
Result: complete; local-only T14D, stopped before T14E.
Added injected-runner/fetch-only tooling with explicit codex-prod/account/
region/reviewed-bucket/distribution configuration. Absolute runDir/manifest
preflight verifies bounded canonical manifest/object bytes, realpath containment,
symlink escape, exact file set, and T14B validation before any AWS fake call.
Deterministic builders cover STS, conditional PutObject, exact-version GetObject,
and a separately callable strong-If-Match restore builder that orchestration
never invokes. Sequential uploads stop on collision or malformed ETag/VersionId;
readback and CloudFront checks are bounded, hash/parser/cache validated, and
clean only exact temporary state.

Machine/human reports are sanitized and schema validated: only typed keys,
SHA-256, safe ETag/version IDs, counts, and stage/category failures are emitted.
Focused A+B+C+D Firestore tests: 42 passed. Core/root checks remain required
before commit. No AWS/Firebase/network/credential/data operation, invalidation,
delete/sync/copy, or new dependency occurred. T14E+ remain pending Sol review.
```

### Phase 4 T14C final report-schema follow-up

```text
Start: 3cc6f1f
Result: complete; local-only T14C final gate, stopped before T14D.
Report validation now requires cell expected/actual values to be exactly
0/1/2/null, real date values whose year-month matches the coordinate, exact
source/transformed-day/cell count invariants, and equal expected/actual object
counts for match reports. Per-kind field/coordinate/value combinations are
allowlisted. Human mismatch lines now deterministically include
expected=<value> actual=<value>, with null rendered as `null`, and are generated
only from the validated machine report.

Checks: Firestore-focused A+B+C 37 passed; core unit 7 passed; root npm run
check passed (web 44, core 7, service 25, infra 15, build); git diff --check
passed. No Firebase/AWS/network/credential/data operation or new dependency
occurred. T14D+ remain pending Sol review.
```

### Phase 4 T14B deterministic transform and atomic writer follow-up

```text
Start: b150629
Result: complete; local-only T14B follow-up, stopped before T14C.
Canonical timestamp validation now requires the exact millisecond-Z format and
new Date(value).toISOString() byte-for-byte round-trip. The exported pure
serializeSchedule boundary is exercised at exactly 32768 bytes (success) and
32769 bytes (rejection); production transformation continues to use the fixed
32 KiB limit. Out-of-order multi-day same-month records group deterministically,
sort day keys, preserve source counts/ranges, and keep sourceIdentity in the
manifest only. The synthetic manifest canonical SHA-256 is
dce278828fcee3357a96c3f92a410c6591702a51b9430de04639021fbf617b47; the four
object keys, byte counts, and object hashes remain those recorded above.

The writer now fully preflights artifact schemas, typed key identity, exact
manifest/object metadata and order, parser-valid canonical bodies, 32 KiB
limits, byte counts, hashes, content/cache metadata, aggregate ranges/counts,
and canonical manifest bytes before any stat/mkdir/mkdtemp/write operation.
Tampered metadata/body/manifest/duplicates/traversal fail with sanitized
MigrationWriteError and zero filesystem residue. Atomic success reads back the
exact complete file set and bytes; mkdir/write/rename failures clean only the
exact temporary path.

Checks: Node 24.18.1; Firestore-focused A+B Vitest 29 passed (including T14A
normalizer tests); core unit and root npm run check remain required next gate.
git diff --check passed. No Firebase/AWS/network/credential/data operation or
new dependency occurred. T14C+ remain pending Sol review.
```

### Phase 4 T14B final canonical-order correction

```text
Start: 3788e60
Result: complete; local-only T14B final gate, stopped before T14C.
Preflight now rejects any non-ascending artifact key order, including a
permutation where both objects and manifest metadata are permuted; requires
schedule top-level property order schemaVersion/stadium/yearMonth/updatedAt/days,
strictly ascending ISO day keys, and canonical dateRange from/to order. Focused
tamper fixtures recompute body bytes, hashes, and manifest metadata so failures
prove canonical-order guards rather than stale hashes.

Correction to the preceding follow-up record: core unit 7 and the root
`npm run check` had already passed successfully; they were not merely pending.
Final checks: Firestore-focused A+B plus canonical-order tests 30 passed; core
unit 7 passed; root `npm run check` passed (web 44, core 7, service 25, infra
15, build); `git diff --check` passed. No Firebase/AWS/network/credential/data
operation or new dependency occurred. T14C+ remain pending Sol review.
```

### Phase 4 T14D1 local upload/readback hardening

```text
Start: 4438121
Result: complete; local-only T14D1 correction, stopped before T14E/D2.
Separate approvedTarget approval, DNS validation, bounded readers, path-safe
builders, current stage/key failure tracking, and sanitized report checks were
added. Focused T14D A+B+C+D: 46 tests passed; core unit: 7 passed; root
`npm run check`: web 44, core 7, service 25, infra 15, build passed; `git diff
--check` passed. No AWS/Firebase/network/credential/data operation occurred.
```

### Phase 4 T14D1b preflight/readback/report correction

```text
Start: 28d713d
Result: complete; local-only D1b, stopped before D2/T14E.
Configuration failures now report preflight/config while artifact, path, size,
open/read/close, and file-enumeration failures remain sanitized preflight
failures. Recursive enumeration rejects symlinks and non-regular entries and is
bounded by the expected artifact set plus deterministic depth/file caps.
Report validation enforces stage/category/key coherence and uploaded-prefix
ETag/VersionId invariants; cleanup failures cannot replace the original
failure or escape as raw errors.

Node 24.18.1 focused upload tests: 9 passed; root `npm run check` passed
(web 44, core 7, service 25, infra 15, build); git diff --check passed. No
AWS/Firebase/network/credential/data operation or new dependency occurred.
T14D2 and T14E remain pending Sol review.
```

### Phase 4 T14D3 cleanup/stream/report correction

```text
Start: 1e4cd9b
Result: complete; local-only D3, stopped before T14E.
Readback temporary cleanup now has an explicit sanitized cleanup/readback
failure report with null key; original failures remain authoritative when
fallback cleanup also fails. Pending stream reads cancel without unsafe
releaseLock, non-stream bodies are rejected instead of unbounded arrayBuffer
allocation, and abort signals remain observable at the deadline.
Expanded AWS-free coverage includes cleanup/read/close failures, depth and
file-count bounds, exact command arrays, collision prefixes, report tampering,
stream/pending body behavior, strict headers/Age/cache/hash/schema checks, and
current second-object failures.

Node 24.18.1 Firestore A-D focused: 51 passed; root `npm run check` passed
(web 44, core 7, service 25, infra 15, build); git diff --check passed. No
AWS/Firebase/network/credential/data operation or new dependency occurred.
T14E remains pending Sol review.
```

### Phase 4 T14D4 report state-machine correction

```text
Start: b6a50ca
Result: complete; local-only D4, stopped before T14E.
Upload reports now enforce an explicit preflight/sts/upload/readback/cleanup/
cloudfront/match matrix. Failed upload entries must retain null ETag and
VersionId, uploaded/readback/cloudfront prefixes require complete tags, cleanup
requires full readback counts and a null key, and stage/category/key/count
combinations outside the actual state machine are rejected before serialization.
Table-driven tests cover valid reports and illegal combinations, including
partial prefixes, wrong keys, tags on failed entries, and illegal categories.

Node 24.18.1 Firestore A-D focused: 52 tests expected after final run; root
`npm run check` passed; git diff --check passed. No AWS/Firebase/network/
credential/data operation or new dependency occurred. T14E remains pending Sol
review.
```

### Phase 4 T14D2 CloudFront verification correction

```text
Start: a411e39
Result: complete; local-only D2, stopped before T14E.
CloudFront object verification now uses one real deadline across all fetch,
stream reads, retries, aborts, and body/schema checks. Bodies are read
incrementally with a hard 32 KiB bound; MIME base type, parsed max-age/s-maxage
directives, Age, SHA-256, JSON, and schedule identity/schema are validated per
attempt. Pending fetch/body operations abort at the deadline and timer cleanup
is deterministic; failures retain the current object key.

Node 24.18.1 root `npm run check` passed (web 44, core 7, service 25, infra
15, build); focused upload tests: 10 passed; git diff --check passed. No
AWS/Firebase/network/credential/data operation or new dependency occurred.
T14E remains pending Sol review.
```

### Sol acceptance of local T14A-T14D

```text
Accepted implementation through: 04abe8d
Result: T14A-T14D accepted; protected T14E remains closed.
Sol independently inspected the parser, transform, comparator, upload command
builders, exact-version readback, bounded CloudFront verifier, cleanup paths,
and report state machine. The final state rejects unapproved targets,
unconditional writes, traversal, oversized artifacts, conditional collisions,
incomplete upload metadata, stale or malformed readback, invalid cache
metadata, unbounded/pending response bodies, and internally inconsistent audit
reports. Restore command generation remains separate and is never executed by
the upload flow.

Independent Node 24 checks: Firestore A-D focused 52 passed; core unit 7
passed; root npm run check passed (web 44, core 7, schedule-api 25, infra 15,
all builds); git diff --check passed; worktree clean before this review record.
No AWS/Firebase/network credential/data write, deployment, invalidation, IAM
change, or dependency change occurred. D018/T14E requires a separately
accepted read-only Firebase access mechanism.
```

### Phase 4 T14E1 local exporter hardening

```text
Start: fe4ad2c
Source/test/dependency commit: fcd55ba
Result: complete; local-only T14E1, stopped before T14E2.
Added exact root devDependency firebase-admin 14.2.0 and refactored the
exporter into an injected adapter/read-plan/serialization layer plus a thin
applicationDefault CLI. The local layer is restricted to itsrun-aaf42 and
the default database, default/0, stadium_info, and the four exact typed date
collections. It rejects credential JSON/path overrides, emulator/alternate
project/database settings, mutating adapter surfaces, unsafe/reused output,
and traversal. Document counts and serialized bytes are bounded; reads and
serialization are deterministic, capture metadata is separate from the
normalized-data hash, and atomic output creates only a new ignored migration
run. SDK imports/initialization occur only after valid CLI invocation; help and
invalid invocation remain offline.

Checks: Node 24.18.1; export + Firestore A-D focused tests 58 passed; core
unit 7 passed; root `npm run check` passed; `git diff --check` passed. No
Firebase/Google/AWS/network/auth/data operation occurred. T14E2+ remain
pending Sol review.
```

### Phase 4 T14E1R06 exact gcloud ADC schema correction

```text
Start: e43b2bd
Source/test commit: f89af16
Result: complete; local-only E1R06, stopped before T14E2.
The synthetic validator and tests now match the exact reviewed gcloud ADC
shape: top-level delegates (empty), impersonation URL, source_credentials,
and impersonated_service_account type; source_credentials contains only
account, client_id, client_secret, refresh_token, type, and universe_domain.
The source type and universe domain are exact, account is only syntactically
validated as bounded email-like metadata, and no account or secret value is
returned/logged. Nonempty delegates, missing/extra fields, alternate domains,
malformed account, alternate impersonation target/host/path, and oversized
credentials remain rejected before loader invocation.

Node 24.18.1; plain npm ci; exporter focused tests 13 passed; root npm run
check passed (web 44, core 7, schedule-api 25, infra 15, all builds); actual
CLI help/invalid passed; git diff --check passed and worktree is clean. No
Firebase/Google/AWS/network/auth/data operation occurred. The prior protected
attempt remains read count 0 with no output run. T14E2+ remain pending Sol
review.
```

### Phase 4 T14E1R01 artifact correction

```text
Start: 088876a
Result: complete; local-only E1R01, stopped before T14E2.
The run artifact is now exactly snapshot.json plus capture.json. snapshot.json
is directly consumable by normalizeFirestoreSnapshot and contains no volatile
capture metadata; capture.json contains canonical project/database/time,
normalized hash, bounded counts, and deterministic context hashes. Recursive
canonical JSON validation rejects unstable SDK values, duplicate IDs, cycles,
BigInt, and non-finite values. Atomic output validates realpath containment,
rereads both files, reruns normalization/hash, and rejects reuse/symlink or
partial output. CLI accepts only --help alone or --output <single-name>,
validates all local inputs before dynamic SDK loading, and closes deleteApp in
finally through the injected lifecycle seam.

Node 24.18.1; exporter + Firestore A-D focused tests: 58 passed; core unit: 7
passed; root check and diff checks recorded after this correction. No
Google/Firebase/AWS/network/auth operation occurred. T14E2+ remain pending Sol
review.
```

### Phase 4 T14E1R02 output preflight/lifecycle correction

```text
Start: 83884b3
Result: complete; local-only E1R02, stopped before T14E2.
Added complete workspace/artifact-root preflight before dynamic SDK loading,
including lstat/realpath containment, symlink/non-directory/stat failure
rejection, new-run checks, and a preflight target handle rechecked before temp
creation and rename. Atomic output now writes exactly snapshot.json and
capture.json, rereads exact bytes/schema/hash/context values, and cleans only
the generated temp on failure. CLI argv and injected loader lifecycle tests
cover help/invalid/no-loader, successful initialize/applicationDefault/project
and default-database reads, deleteApp on success/failure, and sanitized SDK
cleanup failures. Canonical ordering/value rejection and symlink-parent tests
were added.

Node 24.18.1; exporter + Firestore A-D focused: 59 passed; core unit: 7
passed; root `npm run check` passed; `git diff --check` passed. npm ls confirms
firebase-admin is absent from web and schedule-api trees. No
Google/Firebase/AWS/network/auth operation occurred. T14E2+ remain pending
Sol review.
```

### Phase 4 T14E1R03 exporter security correction

```text
Start: 94aa08e
Source/test commits: 372bc67, dbf4220
Result: complete; local-only E1R03, stopped before T14E2.
Preflight handles are now module-authentic WeakSet members with frozen exact
fields; writeExportRun revalidates output name, root/workspace containment,
resolved target, root realpath, raced target nonexistence, and regular
non-symlink artifact files before rename. Forged, cross-name, and cross-root
handles cannot mutate or remove an outside sentinel. The exported capture
validator enforces the exact nested schema, project/database, canonical time,
four collection/document counts, context byte/hash contracts, lowercase
SHA-256 fields, and recomputed normalized-data hash; serializeExport and
reread use the same validator. Invalid calendar timestamps are sanitized
without RangeError. SDK/applicationDefault/initialize/getFirestore/read/write
and deleteApp failures are sanitized, with primary failures preserved over
cleanup failures and no delete after initialization failure.

Node 24.18.1; plain npm ci; exporter + Firestore A-D focused tests: 63 passed;
core unit: 7 passed; root npm run check passed; npm ls shows firebase-admin is
absent from web and schedule-api trees; generated web/Lambda output contains
no firebase-admin/applicationDefault exporter code; git diff --check passed.
No Google/Firebase/AWS/network/auth/data operation occurred. T14E2+ remain
pending Sol review.
```

### Sol acceptance of T14E1 local exporter

```text
Accepted implementation through: b575397
Decision: D018 accepted by the user as one T14E bundle.
Sol independently verified under Node 24.18.1 that the exact Firebase read
plan, canonical snapshot/capture split, output preflight handle, symlink and
containment checks, atomic reread, capture state validation, SDK lifecycle,
and sanitized failure paths match the protected export plan. Export plus
Firestore A-D focused tests passed 63/63; core unit passed 7/7; firebase-admin
is absent from the web and schedule-api dependency trees. No external
operation occurred during this acceptance.

The authorized next boundary is limited to the exact D018 temporary keyless
service-account impersonation, two bounded read-only exports, local hash and
comparison verification, and complete credential/IAM retirement. No Firebase
write, AWS access/upload, production DNS, or other Google resource is included.
```

### T14E protected export runtime stops before first read

```text
First attempt: plain Node 24 failed before Firebase SDK initialization because
the accepted CLI entry could not resolve an extensionless core TypeScript
import. No Firestore entity read occurred and no t14e-capture-1 directory was
created. E1R04 corrected the actual Node entry and recorded the evidence.

Second attempt: the real CLI linked successfully, but google-auth-library did
not discover the impersonated ADC stored under the isolated CLOUDSDK_CONFIG;
it attempted its default credential chain and stopped with no ADC. No
Firestore entity read occurred and no export directory was created. The raw
library error showed that the CLI needs an explicit sanitized credential
boundary. D018 is therefore clarified to accept only the exact ignored
impersonated ADC path through a dedicated validated argument, without writing
to the operator's standard HOME ADC location.
```

### Phase 4 T14E1R04 protected-export CLI runtime correction

```text
Start: de3c5ca
Source/test commit: 26dd8f8
Result: complete; local-only correction, stopped before any Firebase read.
The first protected CLI attempt was stopped before SDK initialization because
plain Node 24 could not resolve the exporter import of
packages/core/src/firestoreSnapshot.ts: ERR_MODULE_NOT_FOUND resolving its
extensionless ./stadiums dependency. No Firestore entity/document/collection
read occurred and no t14e-capture-1 output run directory was created.

Core's narrow CLI-reachable relative imports now use explicit .ts specifiers,
with the required TypeScript allowImportingTsExtensions workspace settings;
parser logic was not duplicated. A real subprocess test invokes the exact
Node entry for --help and invalid arguments and verifies sanitized status,
stdout/stderr, and no SDK/auth/network initialization.

Node 24.18.1; plain npm ci; exporter focused tests 12 passed; core unit 7
passed; root npm run check passed (web 44, core 7, schedule-api 25, infra 15,
all builds); actual `node scripts/migration/export-firestore.mjs --help`
passed; git diff --check passed. No Firebase/Google/AWS/network/auth/data
operation occurred. Protected export remains stopped for Sol review.
```

### Phase 4 T14E1R05 isolated ADC correction

```text
Start: 7298c87
Source/test commit: 957c9ba
Result: complete; local-only E1R05, stopped before T14E2.
The CLI now requires the fixed argument contract
`--output <single-run-name> --impersonated-adc <absolute-path>`. Output and
ADC preflight complete before the SDK loader. ADC is accepted only beneath the
injected credential root (production default `.artifacts/gcloud-t14e`), at the
exact application_default_credentials.json filename, as a bounded regular
non-symlink file with the exact impersonated_service_account type, HTTPS
iamcredentials.googleapis.com host, exact temporary account and
generateAccessToken path, and exact authorized_user source shape. Credential
values are never returned, serialized, or logged. Caller-provided
GOOGLE_APPLICATION_CREDENTIALS remains rejected.

Immediately around the injected SDK lifecycle, the internal credential path is
set to the validated realpath and always restored, including primary SDK/read,
write, deleteApp, and cleanup failures. Tests verify no loader for invalid
argv/ADC/output/env, exact internal env visibility/restoration, exact SDK args,
six read paths, schema/host/target/size rejection, and sanitized errors. The
real Node CLI help/invalid subprocess coverage remains offline; no valid fake
ADC was used to initialize the SDK or access a network.

Node 24.18.1; plain npm ci; exporter focused tests 13 passed; core unit 7;
root npm run check passed (web 44, core 7, schedule-api 25, infra 15, all
builds); actual CLI --help passed; git diff --check passed. The prior second
protected attempt remains read count 0 with no output run. No Firebase/Google/
AWS/network/auth/data operation occurred. T14E2+ remain pending Sol review.
```

### Phase 4 T14E1R08 snapshot diagnostic sanitization

```text
Start: 921c9ea
Source/test commit: b1a9abc
Result: complete; local-only R08, stopped before rerun/protected continuation.
The first real protected export completed only the six allowlisted Firestore
calls, then failed pre-output snapshot normalization with a generic sanitized
snapshot category. No capture/output run was created and no AWS write occurred.
The exact inner malformed-record cause is intentionally not claimed pending a
separately reviewed rerun.

SnapshotValidationError conversion now preserves only its bounded safe category
and coordinate; invalid categories/coordinates and all unrelated SDK/errors
remain generic ExportValidationError(snapshot). Tests prove category/coordinate
propagation and that raw paths, IDs, values, messages, stacks, credentials, and
SDK text cannot escape.

Node 24.18.1; exporter focused tests 14 passed; core snapshot/unit tests 7
passed; root npm run check passed (web 44, core 7, schedule-api 25, infra 15,
all builds); git diff --check passed. No exporter rerun, Firebase/Google/AWS/
network/auth/data operation occurred. T14E2+ remain pending Sol review.
```

### Phase 4 T14E live-data status stop and Sol review

```text
Start: 54a868d
Result: blocked pending user acceptance of D019 and two replacement reads.
The second authorized real read completed only the six allowlisted Firestore
calls. Safe diagnostics identified category status at
collection[0].document[0]. No document ID, path, source value, credential, raw
error, or stack was emitted. Validation stopped before serialization; no output
run was created, and no Firestore or AWS write occurred.

The original two-read authorization is exhausted. Sol reviewed the evidence
against the deployed legacy client's exact Number(...) behavior and proposed
D019: accept only numeric 0/1/2 and exact one-character strings "0"/"1"/"2" at
the temporary Firestore boundary, normalize to numeric form, and reject every
other coercion. Local implementation plus exactly two replacement read-only
captures require one explicit user acceptance before protected work resumes.
```

### Phase 4 T14 D019 local status normalization

```text
Start: abad925
Source/test commit: 945683e
Result: local implementation complete; D019 accepted locally, stopped for Sol
review before the two replacement captures.
The temporary Firestore snapshot boundary now accepts numeric statuses 0/1/2
or exact one-character strings "0", "1", and "2", converting accepted
strings to numeric normalized records and numeric snapshot output. The default
core/runtime parser remains numeric-only, preserving the API/target schema.
Whitespace, signs, decimals, leading zeroes, non-ASCII digits, text/case,
empty strings, booleans, null, out-of-range values, sparse/short/long tuples,
and extra fields remain rejected. Deterministic tests cover mixed tuples,
conversion, all rejection classes, immutability, and sanitized diagnostics.

Node 24.18.1; focused snapshot/export/transform tests 46 passed; core unit 7
passed; root npm run check passed (web 44, core 7, schedule-api 25, infra 15,
all builds); git diff --check passed; worktree clean. No real exporter rerun,
Google/Firebase/AWS/network/auth/data operation, ADC/IAM change, production
capture, or dependency change occurred. Stop for Sol review.
```

### Phase 4 T14E4 local transform and zero-difference comparison

```text
Start: e077707
Result: complete; local-only T14E4, stopped for Sol review before T14F.
The second accepted ignored snapshot was normalized with the accepted numeric
parser and transformed using the explicit source label and updatedAt
2026-08-09T20:45:44.589Z. The local output is confined to the ignored
.artifacts/migration/t14e-transform run. It contains 74 validated monthly
objects for the four public stadium slugs (komazawa 6, oda 45, todoroki 12,
yumenoshima 11), plus the canonical manifest and comparison reports; no raw
schedule output was committed.

The normalized input contains 1,854 records spanning 20180525..20220906 and
has normalized-data SHA-256
e6686893ef5b7ecf6be4de0511decb145975bda04bb22267680c4eec10171a9f. The
deterministic object index aggregate SHA-256 is
31179ad86eed8a98a4aefdcb29ef55d08de345b71ecd1ff5d35c74b94f9c376b and the
manifest SHA-256 is
2d6000e0a56026abc1bdad91717d4627d942b6cef2d19e729239c5192000eb16. Every
written body and manifest hash was reread and validated. The comparison is
match with zero differences: sourceRecordCount 1854, transformedDayCount
1854, comparedCellCount 5562, expected/actual object counts 74/74, and
mismatchCount 0. The canonical comparison report SHA-256 is
3a650d670437ea159054bba22d033fb87ad17f6aa85bbdc17929f53be889fc5b.

Node 24.18.1; focused Firestore transform/compare/upload/export tests 53
passed; core unit 7 passed; root npm run check passed (web 44, core 7,
schedule-api 25, infra 15, all builds); git diff --check passed. No exporter
rerun, Firebase/Google/AWS/network/auth operation, ADC/IAM change, upload,
dependency change, or protected operation occurred. T14F remains pending Sol
review.
```

### Phase 4 T14E3 replacement captures (protected facts recorded)

```text
Result: complete; two authorized replacement captures are recorded as
read-only evidence. Capture times were 2026-08-09T20:45:22.282Z and
2026-08-09T20:45:44.589Z. Both used the approved project and default database,
with 4 collections, 1,854 documents, and 8 stadium-info documents. All stable
fields matched across captures and the timestamps were the only differing
volatile field.

The normalized-data SHA-256 is
e6686893ef5b7ecf6be4de0511decb145975bda04bb22267680c4eec10171a9f and the
snapshot SHA-256 is
f4738fbb21e10df442a25009d8da1384b0fa0f6c01588f2c8e749edcb5eabc7b. The
default context is 36 bytes with SHA-256
35f3923661d2e58662f74498c947a8fb8e90f33c601a6c45bb9691708b4d079f; the
stadium-info context is 1,526 bytes with SHA-256
2c5dea7765f6bf60017a431371ce3f8c0e984128318e0366c89da242b62b055a. Outputs
remain ignored and no raw capture was committed. Firestore writes: 0. AWS
operations: 0.
```

### Phase 4 T14E5 credential retirement (protected facts recorded)

```text
Result: complete; retirement and post-retirement checks are recorded as
sanitized evidence. The precheck found exactly one temporary Viewer grant and
one service-account-level Token Creator grant for the approved operation, no
user-managed keys, and the Credentials API enabled only for this task.

The exact temporary Token Creator and Viewer grants were removed, the
temporary service account was deleted, and the API was restored to disabled.
Postcheck found the service account absent, zero remaining project bindings
for it, and zero enabled count for the Credentials API. The isolated ADC was
revoked and absent; the isolated gcloud login was revoked with zero active
accounts. A post-retirement exporter invocation stopped at ADC validation
before network access and created no output. No operator email, credential
path/content, token, IAM policy body, or raw data is recorded.
```

### Sol T14E acceptance and T14F plan

```text
Sol acceptance baseline: f1e805a
Decision: T14E complete and accepted. Two stable captures, the deterministic
74-object transform, 5,562-cell zero-difference comparison, ignored-artifact
boundary, and complete Google credential/IAM retirement were independently
reviewed. Focused migration tests remained 53 passed and the worktree clean.

T14F remains protected and unapproved. The accepted upload core lacks a real
AWS execution adapter and an all-74-keys-absent gate before its first write;
the T14E transform directory also intentionally contains comparison evidence
that the sealed upload run must exclude. The exact local/runtime/preflight/
conditional-write/readback plan is documented in
docs/aws-migration/phase4-t14-upload-plan.md. No AWS call, upload, IAM change,
invalidation, production/DNS, or Firebase operation occurred in this review.
```

### Phase 4 T14F01 local sealed-run and execution adapter

```text
Start: 1dfa0db
Result: complete; local-only T14F01, stopped for Sol review before T14F02.
Added a deterministic sealed-run builder that validates the accepted manifest
SHA-256, exact 74-object count, typed stadium prefix, every body byte count and
SHA-256, and shared schedule/parser contracts before atomically creating a new
ignored run containing only manifest.json and the 74 schedule bodies. Raw
snapshots, captures, comparison reports, credentials, and extra files are not
copied.

Added an explicit Node 24 execFile argument-array adapter with shell disabled,
bounded stdout/stderr and JSON parsing, exact profile/account/region/target/
bucket/domain/manifest/count/prefix validation, environment credential
rejection, exact-key head-object absence preflight, and atomic machine/human
report writing. Existing conditional If-None-Match upload and T14D report
state-machine contracts remain unchanged; no delete/sync/copy/overwrite/retry
path was added.

Node 24.18.1; focused Firestore A-D plus F01 tests 57 passed; core unit 7
passed; root npm run check passed (web 44, core 7, schedule-api 25, infra 15,
all builds); git diff --check passed. No AWS CLI, network, CloudFront fetch,
upload, IAM, Firebase, dependency, or protected operation occurred. T14F02+
remain pending Sol review.
```

### Phase 4 T14F01R01 sealed/preflight correction

```text
Start: 15f229e
Result: complete; local-only correction, stopped before T14F02.
AWS CLI failures are now bounded and sanitized: only an exact service-code
enum distinguishes a 254 exit with 404/NotFound/NoSuchKey from AccessDenied,
403, or other failure. No stderr, principal, request text, or raw command
error is retained. Sealed-run rereads now reject root/manifest/body symlinks,
special files, traversal, extra files, and post-seal tampering, requiring the
exact manifest plus 74 bodies on every runtime preflight.

The fixed Node 24 CLI accepts only sealed-run/report names beneath the ignored
migration root, fixed reviewed target constants, and no AWS credential/profile
environment overrides. It invokes only generated allowlisted execFile argument
arrays and returns nonzero for invalid/preflight/mismatch outcomes. The
sealed orchestration performs one STS check, then all 74 exact-key absence
checks before any conditional write; key 1, middle, key 74, present, denied,
and malformed preflight cases produce zero puts. Reports remain atomic and
sanitized.

Node 24.18.1; focused Firestore A-D plus R01 tests 60 passed; core unit 7
passed; actual CLI help/invalid boundaries passed; root npm run check passed;
git diff --check passed. No AWS CLI/network/CloudFront/upload/IAM/Firebase or
protected operation occurred. T14F02+ remain pending Sol review.
```

### Phase 4 T14F01R02 sealed adapter correction

```text
Start: a91f80b
Result: complete; local-only correction, stopped before T14F02.
The public upload API now always performs its own STS identity check; only the
sealed orchestration uses a private internal continuation after its single STS
check. AWS CLI error classification requires the canonical leading operation
form, with sanitized NotFound, AccessDenied, Collision, or Other enums only.
PutObject 409/412/PreconditionFailed is mapped to a single collision stop with
no retry or readback/fetch continuation. Generated AWS argument arrays require
the exact reviewed operation, flags, bucket, key, and conditional semantics.
The 74-object tests prove one STS, all 74 heads before any put, no head after
the first put, first/middle/last present/malformed/denied stops, STS mismatch,
and exact collision behavior. The fixed CLI rejects artifact-root symlink
escapes before any injected AWS or fetch call.

Node 24.18.1; focused upload tests 24 passed; no AWS CLI, network, CloudFront,
upload, IAM, Firebase, or protected operation occurred. T14F02+ remain
pending Sol review.
```

### Phase 4 T14F01R03 environment/executable hardening

```text
Start: 9c55593
Result: complete; local-only correction, stopped before T14F02.
The fixed CLI rejects every caller AWS_* environment override and passes an
explicit child environment with AWS_* variables removed. Production execution
uses only the fixed absolute executable boundary after regular-file,
non-symlink, executable, and realpath preflight. Protected command validation
also binds PutObject bodies and GetObject outputs to the sealed/readback roots.
The end-to-end injected CLI test covers one STS, 74 heads, 74 conditional puts,
74 exact-version reads, 74 CloudFront fetches, atomic match reporting, and a
single-put collision stop. Root symlink escape is rejected before calls.

Node 24.18.1; focused upload tests 26 passed; no AWS CLI, network, CloudFront,
upload, IAM, Firebase, or protected operation occurred. T14F02+ remain
pending Sol review.
```

### Phase 4 T14F01R04 executable-path correction

```text
Start: bfd7259
Result: complete; local-only correction, stopped before T14F02.
The fixed executable is now the verified non-symlink `/usr/local/aws-cli/aws`;
the actual filesystem was checked only with lstat and realpath, without
executing the binary. Existing environment, command, path, CLI orchestration,
and report sanitization boundaries remain unchanged.

Node 24.18.1; focused Firestore tests 64 passed; core unit 7 passed; root
check, CLI help, and git diff --check passed. No AWS CLI/network/CloudFront,
upload, IAM, Firebase, or protected operation occurred. T14F02+ remain
pending Sol review.
```

### Phase 4 T14F01R05 wrapped AWS CLI diagnostic correction

```text
Start: 44b4939
Result: complete; local-only correction, stopped before T14F02.
The classifier accepts only the canonical HeadObject/PutObject service-error
line, either unwrapped or with the exact optional `aws: [ERROR]: ` wrapper
after one leading newline. Arbitrary prefixes, ANSI, wrong operations, and
later embedded markers remain Other; stderr is never retained.

The protected preflight attempt stopped before writes: report counts were all
zero and object list empty. Read-only diagnosis confirmed the first HeadObject
returned CLI exit 254 with service code 404 Not Found. No S3 write or rerun was
performed.

Node 24.18.1; migration tests 64 passed; core unit 7 passed; root check, CLI
help, and git diff --check passed. No AWS/network/CloudFront/upload/IAM or
Firebase operation occurred. T14F02+ remain pending Sol review.
```

### Phase 4 T14F01R06 process-environment validation correction

```text
Start: 0abda35
Result: complete; local-only correction, stopped before T14F02.
Sealed configuration now accepts the actual Node process.env prototype and
null-prototype string maps only when every own value is a data string and no
key begins AWS_. Arrays, null, accessors, symbols, non-string values, and all
AWS_* overrides remain rejected. The injected 74-object CLI test exercises a
process.env-shaped map and reaches the full local STS/head/put/read/fetch
orchestration.

Two protected attempts had stopped locally before STS because of the previous
prototype check; each had attempted/uploaded/readback/cloudfront counts zero,
an empty object list, and zero S3 writes. Separate read-only diagnosis found
all 74 keys absent. No protected rerun was performed.

Node 24.18.1; migration tests 64 passed; core unit 7 passed; root check, CLI
help, and git diff --check passed. No AWS/network/CloudFront/upload/IAM or
Firebase operation occurred. T14F02+ remain pending Sol review.
```

### Phase 4 T14F02-T14F04 protected upload completion

```text
Start: 98a7536; status: complete and accepted; T15 not started.
Scope: AWS_PROFILE=codex-prod, account 470447451992, region ap-northeast-1.
The existing UPDATE_COMPLETE hosting stack and preview data bucket
itsrun-preview-data-470447451992-ap-northeast-1 were verified with versioning
Enabled and all four PublicAccessBlock settings true. CloudFront was the
existing d2via50thoheqm.cloudfront.net distribution.

The first two fixed-runner attempts stopped locally before STS due to the
process.env prototype check; each had zero attempted/uploaded/readback/
CloudFront counts, an empty object list, and zero AWS writes. A separate
read-only diagnostic confirmed all 74 target keys absent. After the local
correction, the single authorized write run passed the complete 74-key
absence gate, created each key once with If-None-Match: *, read back all 74
exact S3 versions, and verified all 74 objects through CloudFront HTTPS.
No overwrite, delete, invalidation, IAM, or CloudFormation change occurred.

Sanitized success report hashes: machine JSON
92af2051c46684e2a196864c87972b46184268d207f8bbf03f6c9672482cad84;
human report df1a3fae2d7fc7db16f15323896949086a7e44932c02951d82886fa6b06baade.
Ignored artifacts, credentials, secrets, individual VersionIds, and raw
schedule bodies were not committed.

Node 24.18.1; npm ci succeeded (audit reported 7 moderate and 4 high
vulnerabilities, unmodified); core unit 7 passed; migration tests 64 passed;
root npm run check passed (web 44, core 7, schedule-api 25, infra 15 and
build/synth); preview E2E 88 passed; git diff --check passed. T14 is complete;
stop for Sol final review before T15.
```

### Phase 4 T15A validation workflow

```text
Start: 5e4b19e; result: complete locally, stopped at the T15A boundary.
Added .github/workflows/validate-migration.yml for pull requests and pushes
to migration/aws-s3-cloudfront. It grants contents:read only, uses bounded
concurrency and a 30-minute timeout, pins checkout v4.2.2 and setup-node
v4.4.0 to full commit SHAs, installs Node 24.18.1, runs npm ci/check and the
production-browser E2E command after Chromium-only installation. No artifact,
secret, AWS credential, id-token, or dangerous trigger is configured.

The AWS-free workflow contract suite passed 3 tests under Node 24.18.1.
The follow-up requires the workflow to install and fail-closed verify exact
npm 11.4.2 before npm ci; the workflow contract now enforces that order.
No AWS/GitHub operation occurred. T15B-T15D remain pending and T15 is not
complete until those milestones receive separate review.
```

### Phase 4 T15B web-only preview helper

```text
Start: c5080cb; source/test commits: cb0b18a, edf8ff8; result: complete locally,
stopped before T15C/T15D.
Added scripts/migration/deploy-web-preview.mjs with explicit operator and
GitHub-OIDC credential modes. It gates exact account, region, stack, web
bucket, domain, repository/ref and (for GitHub mode) the reviewed assumed-role
principal before any PutObject. It enumerates only regular generated-web
files, rejects empty/hidden/traversal/symlink/special paths, orders immutable,
short-cache, then HTML/mutable objects, and emits only explicit per-object
PutObject argument arrays. Every object is verified through bounded CloudFront
HTTPS readback; reports contain only typed keys, sizes, hashes, metadata and
counts. No schedule/data mode, copy/sync/delete/ACL/invalidation or raw error
surface exists.

Node 24.18.1 focused T15B helper/CLI tests: 7 passed; existing deploy-preview
tests: 20 passed. No AWS/GitHub/network operation occurred. T15C-T15D remain pending
Sol review.
```

### Phase 4 T15B corrective pass BR01-R06

```text
Start: 1bc9e1f; result: corrective implementation complete locally and
pending Sol review; T15C/T15D not started. The prior T15B complete wording is
preserved above as historical accounting and is superseded for acceptance by
this corrective record.

GitHub mode now requires the three short-lived AWS credential values, exact
repository/ref, and the fixed assumed-role shape; operator mode rejects
ambient credentials and uses codex-prod only. Child AWS environments are
mode-specific allowlists and executable paths are fixed per mode. CloudFront
verification is exported, bounded across fetch/body/retry attempts, uses
encoded key segments plus SHA query, exact MIME/cache metadata, and sanitized
timeout/status failures. Metadata covers common web extensions with no image/*
wildcard. Filesystem/report checks reject hidden/symlink/special/traversal
paths, empty or oversized builds, and report collisions outside a new ignored
artifact run.

Node 24.18.1 focused helper/CLI/deploy-preview tests: 31 passed. No
AWS/GitHub/network operation occurred; T15C/T15D remain pending Sol review.
```

### Phase 4 T15B BR02 follow-up

```text
Start: 5adc551; source/test commit: cf98fa5; result: corrective pass
complete locally and pending Sol review. The earlier T15B completion claim is
retained as history; this record supersedes it for acceptance.

CLI command construction now adds region/profile exactly once, --no-cli-pager
and --output json exactly once, and uses fileb:///absolute/path for PutObject
blobs. Exec failures, invalid/oversized JSON, stderr and credentials become a
typed sanitized command error. GitHub role ARN validation is full-regex and
credential values are required, nonblank, and never serialized. CloudFront
fetch/body/retry waits share a deadline with encoded key/hash URLs and exact
MIME/cache checks. Stack and output cardinality/status/duplicate gates are
strict; reports require a new direct child under the workspace
.artifacts/migration root and reject existing/symlink/forged targets.

Node 24.18.1: focused helper/CLI/deploy-preview tests 34 passed; all migration
Vitest suites excluding the existing node:test-format file 116 passed; static
Node tests 3 passed; npm run check passed; git diff --check passed. No
AWS/GitHub/network operation occurred. T15C/T15D remain pending Sol review.
```

### Phase 4 T15B BR03 follow-up

```text
Start: 44b234b; source/test commit: f59e71f; result: corrective pass
complete locally and pending Sol review. Report targets are now prepared and
created exclusively before STS through a branded handle rooted at the exact
workspace .artifacts/migration/<safe-run> path; writes reject forged,
cross-workspace, symlink, collision, and overwrite targets. Deployment
failures produce only bounded sanitized failed reports with attempted,
uploaded, and verified counts. Filesystem, credential, MIME/cache, stack,
identity, CLI command, timeout, and partial-failure cases are individually
covered.

Node 24.18.1: focused helper/CLI tests 33 passed; all migration Vitest suites
excluding the existing node:test-format file 135 passed; static Node tests 3
passed; npm run check and git diff --check passed. No AWS/GitHub/network
operation occurred. T15C/T15D remain pending Sol review.
```

### Phase 4 T15B BR04 follow-up

```text
Start: 239af53; source/test commit: 8e9e726; result: corrective pass
complete locally and pending Sol review. Directory enumeration is injectable
and rejects every dotted component, credential-like path, nested/root symlink,
special entry, oversize/read-size mismatch, and empty build before STS.
GitHub credentials require exact trim equality and child env contains only the
three temporary AWS values; operator retains only HOME. Retry deadline timers
are always cleared, including hanging body/sleep paths. MIME mappings are
explicitly table-tested for every supported extension and unknown fallback;
cache classification is cross-checked against deploy-preview. CLI integration
asserts complete STS/DescribeStacks/PutObject arrays and the two-object partial
upload report records attempted=2, uploaded=1, verified=0 without raw data.

Node 24.18.1: standalone helper/CLI tests 57 passed; all migration Vitest
suites excluding the existing node:test-format file 159 passed; static Node
tests 3 passed; npm run check and git diff --check passed. No AWS/GitHub/network
operation occurred. T15C/T15D remain pending Sol review.
```

### Phase 4 T15B BR05 follow-up

```text
Start: b4e71b4; source/test commit: fbbd0ec; result: retry-timing correction
complete locally and pending Sol review. The prior BR04 record remains
unchanged as historical accounting.

CloudFront retry waiting now uses the injected clock consistently: the retry
delay is min(1000ms, remaining deadline), while the deadline timer spans the
full remaining duration. The timer is cleared on both sleep and deadline
outcomes, and a delay that reaches the deadline returns a sanitized timeout
without another attempt. Invalid maxAttempts and timeoutMs are rejected as
configuration errors. Focused tests cover three-attempt transient retry,
clock-advanced success on the third attempt, deadline-before-retry, and
argument validation; the compact CLI argument rejection table is also covered.

Node 24.18.1: focused helper/CLI tests 69 passed; all migration Vitest suites
excluding the existing node:test-format file 171 passed; static Node tests 3
passed; npm run check and git diff --check passed. No AWS/GitHub/network
operation occurred. T15C/T15D remain pending Sol review.
```

### Phase 4 T15C preview deployment workflow

```text
Start: d89ed1e; source/test commit: 980e58d; result: complete locally and
pending T15D/Sol external review. Added a separate workflow_dispatch-only
workflow for the exact migration repository/ref. Workflow permissions are
contents:read globally, with id-token:write plus contents:read only on the
deploy job; validation must pass on the same github.sha. Both jobs pin
checkout/setup-node, install Node 24.18.1 with npm 11.4.2, and use bounded
Chromium-only browser checks. The deploy job builds with the reviewed public
preview configuration, uses the fixed OIDC role and region, invokes the
web-only helper once with the deterministic run report directory, then runs
the raw preview E2E suite. No environment, artifact, access-key, CDK,
CloudFormation mutation, data upload, invalidation, Cognito, production, DNS,
or Firebase operation is configured.

The CLI entrypoint now prints only the sanitized success report JSON (help
remains text); no local path, credential, token, or raw error is emitted.
Node 24.18.1 focused workflow/helper tests: 76 passed; npm run check passed;
root E2E passed 58 tests (14 legacy plus 44 local admin); git diff --check
passed. No AWS/GitHub/network operation occurred. T15D is not started.
```

### Phase 4 T15D GitHub OIDC role definition

```text
Start: ce8d2aa; source/test commit: 82a847d; result: complete locally and
pending external IAM review. Added the separate ItsRunPreviewGitHubDeploy
CDK stack to the existing app while leaving HostingStack tests/contracts
isolated. The synthesized graph contains one retained
AWS::IAM::OIDCProvider for https://token.actions.githubusercontent.com with
the single sts.amazonaws.com audience, and one retained role named
itsrun-preview-github-web-deploy with a one-hour session limit, sanitized
description/tag, and an exact StringEquals audience plus migration-branch
subject trust. Its sole inline policy has exactly
cloudformation:DescribeStacks on the ItsRunPreviewHosting stack ARN pattern
and s3:PutObject on the exact preview web bucket object ARN. No managed
policies, GetObject, data bucket, delete/list, invalidation, PassRole, or
other service permissions are present. ProviderArn and RoleArn are outputs.

Infra tests: 17 passed; infra build/synth passed; root npm run check passed;
workflow/helper focused tests 76 passed; git diff --check passed. No AWS,
GitHub, deployment, IAM, or network operation occurred.

Execution-role candidate for a later separately reviewed CloudFormation
operation is intentionally ungranted: lifecycle/read/tag candidates are
iam:GetOpenIDConnectProvider, iam:TagOpenIDConnectProvider,
iam:UntagOpenIDConnectProvider, iam:DeleteOpenIDConnectProvider against the
exact provider ARN, plus iam:GetRole, iam:TagRole, iam:UntagRole,
iam:UpdateAssumeRolePolicy, iam:PutRolePolicy, iam:DeleteRolePolicy,
iam:UpdateRoleDescription, and iam:DeleteRole against the exact role ARN.
CreateOpenIDConnectProvider and CreateRole are also unresolved lifecycle
candidates; their resource-scope requirements (including any required `*`)
must be confirmed from AWS documentation/review and are not guessed here.
No PassRole is indicated by this synthesized graph. Deployment-principal
CloudFormation change-set/lifecycle and CDK bootstrap asset permissions remain
separate future review items; no such operation was run. T15E/T16 are not
started.
```

### Phase 4 T15D Sol acceptance and T15E deployment plan

```text
Start: e721105; result: T15D accepted locally and T15E exact execution plan
committed. Sol independently verified a clean migration branch, the two-stack
synth manifest, the retained provider/role graph, the exact branch-only OIDC
trust, and the two-action runtime policy. Read-only AWS checks with
AWS_PROFILE=codex-prod and ap-northeast-1 returned account 470447451992,
policy v5/default with v1-v5 retained, no OIDC providers, no exact GitHub role,
and no ItsRunPreviewGitHubDeploy stack. AWS v5 exactly matched the committed
policy at canonical SHA-256
ca4a20e3e3a7c06c1f1196559886a9679dee98b9a25c7334dd8faf69b19e061e.
AWS v1 exactly matched commit dc22db1 at canonical SHA-256
598747d3e2158c4c52cfd9b50cb4c4883f8ac9f6c07013b54ed12ed24be1591a.

D021 and phase4-t15-deploy-plan.md define the two exact-resource IAM statement
candidate, immutable preflight, the IAM five-version gate, deletion of only
archived nondefault v1, v6 exact readback, one OIDC-stack deployment, one
GitHub workflow dispatch, external verification, and stop conditions. The
read-only review made no AWS or GitHub write and did not change IAM, stacks,
objects, invalidations, Cognito, production, DNS, or Firebase.
```

### Phase 4 T15E01 policy-v6 candidate

```text
Start: 6bff88a; source/test/docs commit: d9c26a6; result: complete locally.
The committed v5 policy statements remain unchanged and exactly two D021
statements were added: PreviewGitHubOidcProviderLifecycle with the reviewed
nine OIDC-provider lifecycle/read/tag actions on the exact provider ARN, and
PreviewGitHubDeployRoleLifecycle with the reviewed thirteen role/inline-policy
lifecycle/read/tag actions on the exact role ARN. Focused policy tests prove
the candidate delta, exact actions/resources, and rejection of wildcard,
PassRole, provider-list, managed-policy, cross-account, and unrelated-service
surfaces. The bootstrap README records the v6 gate. No AWS operation occurred.

Node 24.18.1: focused policy tests 4 passed; infra tests 17 passed; infra
build/synth passed; root npm run check passed; git diff --check passed. E02
read-only preflight is next; no policy version or stack write has occurred.
```

### Phase 4 T15E02 immutable preflight

```text
Start: 37bad43; result: read-only gates passed; committed before any write.
AWS_PROFILE=codex-prod and ap-northeast-1 returned account 470447451992 and
the configured region ap-northeast-1. The exact execution policy ARN reports
v5 default with exactly v1-v5 retained. AWS v5 canonical sorted-pretty JSON
SHA-256 is ca4a20e3e3a7c06c1f1196559886a9679dee98b9a25c7334dd8faf69b19e061e;
AWS v1 matches commit dc22db1 at
598747d3e2158c4c52cfd9b50cb4c4883f8ac9f6c07013b54ed12ed24be1591a. The
committed candidate canonical SHA-256 is
a257ac02346a692248825568421732af7ee969f449204ad8f0da714dcbeb7488 and its
delta from v5 is exactly PreviewGitHubOidcProviderLifecycle plus
PreviewGitHubDeployRoleLifecycle.

Read-only absence checks found no OIDC providers, no exact role, and no
ItsRunPreviewGitHubDeploy stack. Fresh synth HostingStack template SHA-256 is
7f1cd50ea4b5c440579ffec11ea2c03c5fc35fab66a4230d8b2c56ec66af857e; the
reviewed GitHub stack template SHA-256 is
43b2e3f69ca9f6a1c48056c57304b509b372131f30e2dea099885f4c9359ada6.
CloudFormation ValidateTemplate reports only CAPABILITY_NAMED_IAM. Candidate
statements alone pass Access Analyzer validation and IAM custom-policy
simulation for all 22 reviewed actions. Full historical v5 validation reports
one pre-existing INVALID_ACTION for apigateway:TagResource; it was not changed
or broadened. No AWS write, stack mutation, policy version change, GitHub,
HostingStack, web/data, invalidation, Cognito, production, DNS, or Firebase
operation occurred. E03 is authorized to proceed with only v1 deletion and
one v6 creation after repeating these gates.
```

### Phase 4 T15E03 policy rotation stop

```text
Start: 36af186; result: stopped after the authorized exact writes; T15E04
was not started. Immediately before the first write, STS/account/region and
the v5/default, v1-v5, and canonical v1/v5 gates passed. Exactly one
nondefault policy version, v1, was deleted from
arn:aws:iam::470447451992:policy/ItsRunPreviewCloudFormationExecutionPolicy.
Immediately before the second write, STS/account/region and the post-delete
v2-v5/v5-default gates passed. The one authorized
iam:CreatePolicyVersion --set-as-default attempt for the committed candidate
failed with AWS LimitExceeded: `Cannot exceed quota for PolicySize: 6144`.
No retry or alternate policy operation was performed.

Read-only confirmation after the failure shows exactly v2, v3, v4, and v5
retained, with v5 still default; v6 was not created. The exact AWS write
failure action was iam:CreatePolicyVersion on the managed policy ARN; AWS did
not provide a separate resource/event beyond that policy operation. No
provider/role stack, HostingStack, web/data, GitHub, invalidation, Cognito,
production, DNS, or Firebase operation occurred. T15E04 is blocked pending a
new reviewed policy-size resolution and authorization.
```

### Phase 4 T15E03 Sol review and D022 recovery plan

```text
Start: eae3d74; result: E03 stop accepted and an exact compact recovery plan
prepared. Sol independently reran the 17 infra tests and synth under Node
24.18.1, reviewed every E01-E03 commit, and confirmed a clean worktree. A
fresh read-only AWS check returned account 470447451992, v5/default with
exactly v2-v5 retained, no provider, and no GitHub stack. No v6 or partial
CloudFormation resource exists.

The rejected candidate is 6,624 non-whitespace characters. D022 preserves the
effective reviewed role action/resource pairs by adding the exact GitHub role
ARN to the existing thirteen-action PreviewScheduleLambdaRole Resource array,
and limits the retained provider's initial-create statement to exact
Create/Get/ListTags/Tag actions. The resulting deterministic candidate is
6,077 characters, below the 6,144 limit, and adds no wildcard, PassRole,
provider mutation/deletion, managed-policy attachment, service, account, or
other resource. phase4-t15-policy-size-recovery-plan.md defines renewed local,
read-only, one-v6-write, and one-stack-deploy gates. This Sol review made no
AWS or GitHub write and did not mutate HostingStack, web/data, invalidation,
Cognito, production, DNS, or Firebase.
```

### Phase 4 T15 policy-size recovery R01 compact candidate

```text
Start: aaa0e03; source/test/docs commit: 059ca00; result: complete locally.
The rejected duplicate GitHub role statement was removed. The existing
thirteen-action PreviewScheduleLambdaRole action list is unchanged and its
Resource is now the ordered pair of the existing Hosting role ARN followed by
the exact GitHub deploy role ARN. The provider statement contains only the
D022 Create/Get/ListTags/Tag actions on the exact provider ARN. No other
policy statement or semantic permission changed.

Focused policy tests: 5 passed; infra tests: 18 passed; infra build/synth and
root npm run check passed; git diff --check passed. The policy source has
exactly 6,077 non-whitespace characters (under 6,144). No AWS operation was
performed. R02 renewed read-only preflight is next; no policy version or stack
write has occurred.
```

### Phase 4 T15 policy-size recovery R02 preflight

```text
Start: 0984ea2; result: renewed read-only gates passed and committed before
the authorized write. AWS_PROFILE=codex-prod, account 470447451992, and
region ap-northeast-1 matched. The managed policy has exactly v2-v5 retained
with v5 default; AWS v5 canonical SHA-256 remains
ca4a20e3e3a7c06c1f1196559886a9679dee98b9a25c7334dd8faf69b19e061e. The local
compact candidate is exactly 6,077 non-whitespace characters and differs from
v5 only by the ordered GitHub role resource addition and four-action provider
statement. Its canonical sorted-pretty JSON SHA-256 is
9bd2d67f19a917c0183d7f08649a4b7555ad736ada43f075115c5cebb80322de.

No OIDC provider, exact role, or ItsRunPreviewGitHubDeploy stack exists.
Fresh HostingStack template SHA-256 remains
7f1cd50ea4b5c440579ffec11ea2c03c5fc35fab66a4230d8b2c56ec66af857e; the
GitHub stack template remains
43b2e3f69ca9f6a1c48056c57304b509b372131f30e2dea099885f4c9359ada6.
CloudFormation validation requires only CAPABILITY_NAMED_IAM. Compact
candidate Access Analyzer validation returned no findings, and IAM custom
policy simulation allowed all 17 reviewed provider/role actions only on the
reviewed resource set. No AWS write, policy version change, stack mutation,
GitHub, HostingStack, web/data, invalidation, Cognito, production, DNS, or
Firebase operation occurred. R03 is authorized for exactly one v6 creation.
```

### Phase 4 T15 policy-size recovery R03 policy rotation

```text
Start: b082e4f; result: complete. Immediately before the write, all R02
identity/version/hash/absence gates passed. Exactly one
CreatePolicyVersion --set-as-default was issued for the compact candidate;
AWS returned VersionId v6 with IsDefaultVersion true. Read-only verification
shows exactly v2, v3, v4, v5, and v6 retained, with v6 default. AWS v6 is
byte/order-equivalent to the committed candidate and canonical SHA-256 is
9bd2d67f19a917c0183d7f08649a4b7555ad736ada43f075115c5cebb80322de. The only
semantic delta from v5 is the D022 role-resource addition and compact
four-action provider statement. No other policy/version operation occurred.

No provider/role/stack or HostingStack mutation occurred. R04 is authorized
for exactly one ItsRunPreviewGitHubDeploy deployment only.
```

### Phase 4 T15 policy-size recovery R04 dedicated GitHub deployment

```text
Start: aaa0e03 recovery line; result: complete for the authorized R04 scope.
The first repository-root CDK invocation stopped locally because the CDK app
was not resolvable from that working directory (`--app is required`); it made
no AWS call or write. The single corrected invocation was run from `infra/`:
`npx cdk deploy ItsRunPreviewGitHubDeploy --require-approval never`, using
Node 24.18.1, AWS_PROFILE=codex-prod, account 470447451992, and
ap-northeast-1. It published only the reviewed GitHub-stack template asset
and completed one CloudFormation change set:
arn:aws:cloudformation:ap-northeast-1:470447451992:changeSet/cdk-deploy-change-set/cbe7e7ef-573a-4778-8bb7-b7f39c1c6aba.

ItsRunPreviewGitHubDeploy reached CREATE_COMPLETE (4/4 resources) at stack
arn:aws:cloudformation:ap-northeast-1:470447451992:stack/ItsRunPreviewGitHubDeploy/579dd6a0-945c-11f1-b5e4-0ad6b14d546d.
The deployed template SHA-256 is
43b2e3f69ca9f6a1c48056c57304b509b372131f30e2dea099885f4c9359ada6.
The exact outputs are the GitHub OIDC provider ARN
`arn:aws:iam::470447451992:oidc-provider/token.actions.githubusercontent.com`
and role ARN
`arn:aws:iam::470447451992:role/itsrun-preview-github-web-deploy`.

Read-only verification confirmed the exact token.actions.githubusercontent.com
provider with audience sts.amazonaws.com, branch-only StringEquals trust for
repo:subaru44k/itsrunnew, role max session 3600, and no StringLike condition.
The role has no attached managed policies and exactly one inline policy with
only DescribeStacks on the exact HostingStack ARN pattern and PutObject on
the exact preview web-bucket object ARN. Provider and role retain on delete.

The execution-policy state remains v6 default with exactly v2-v6 retained;
the committed/AWS v6 canonical SHA-256 is
9bd2d67f19a917c0183d7f08649a4b7555ad736ada43f075115c5cebb80322de. Hosting
remains UPDATE_COMPLETE with unchanged outputs, including the existing web
bucket, data bucket, distribution domain, API endpoint, and Cognito outputs;
the fresh HostingStack template SHA-256 remains
7f1cd50ea4b5c440579ffec11ea2c03c5fc35fab66a4230d8b2c56ec66af857e.

No HostingStack deployment, policy-version deletion, bootstrap, web/data
upload, CloudFront invalidation, Cognito administration, GitHub operation,
production/DNS/Firebase mutation, or T15E05/T16 work occurred. This record
contains no credentials, tokens, or per-object data.
```

### Phase 4 T15 R01-R04 Sol acceptance

```text
Start: f6e826e; result: accepted and ready for T15E05. Sol independently
reviewed every recovery commit, reran all 18 infra tests under Node 24.18.1,
reran synth, and confirmed the exact 6,077-character compact policy contract
and a clean worktree. Read-only AWS verification returned v6/default with
exactly v2-v6 retained and exact AWS/local canonical SHA-256
9bd2d67f19a917c0183d7f08649a4b7555ad736ada43f075115c5cebb80322de.

The deployed template exactly matches fresh local synth. Provider URL,
sts.amazonaws.com audience, Purpose tag, role name, one-hour duration,
federated principal, exact migration-branch StringEquals subject, and sole
AssumeRoleWithWebIdentity action all match. The role has no attached managed
policy and its only inline policy contains exactly HostingStack DescribeStacks
and preview-web PutObject. Provider and role have Retain/Retain. HostingStack
remains UPDATE_COMPLETE and its deployed template exactly matches fresh local
synth; outputs remain unchanged. No additional AWS or GitHub write occurred
during Sol review.

GitHub read-only baseline: repository subaru44k/itsrunnew is public with
default branch master; Actions are enabled with allowed_actions=all and no SHA
pinning requirement; default workflow permissions are write; master has no
branch protection. Every committed workflow action is already full-SHA pinned.
T15E05 will tighten repository Actions settings, push only the migration
branch, require the resulting validation success, dispatch exactly one preview
web deployment, verify external state, and derive protection check names from
the successful run before protecting master.
```

### Phase 4 T15E05 GitHub activation stop

```text
Start: 9ae26b0; result: stopped at the exactly-once deployment-dispatch gate.
Node 24.18.1 was used on migration/aws-s3-cloudfront with a clean worktree.

Read-only repository baseline matched subaru44k/itsrunnew, default branch
master, and the migration branch. The exact AWS baseline matched account
470447451992/region ap-northeast-1: ItsRunPreviewGitHubDeploy and
ItsRunPreviewHosting were present in their reviewed states, the OIDC role and
trust were exact, HostingStack was UPDATE_COMPLETE, and the data bucket was
versioned. No AWS write occurred in E05.

The authorized Actions settings update read back exactly as enabled=true,
allowed_actions=selected, sha_pinning_required=true; GitHub-owned actions are
allowed and the only selected non-GitHub action is
aws-actions/configure-aws-credentials. Default workflow permissions are read
and can_approve_pull_request_reviews=false. No secret, variable, environment,
key, or token was created.

The sole authorized push created migration/aws-s3-cloudfront at exact SHA
9ae26b0233b52e3f3b3bbe69be4a89828c182c6b. Its push validation run was
31348125949
(https://github.com/subaru44k/itsrunnew/actions/runs/31348125949), with head
SHA exact, Node 24.18.1, checks, Chromium installation, and production E2E
successful in 2m18s. GitHub emitted only the known Node-20 action deprecation
annotation for the pinned checkout/setup-node releases; the run conclusion
was success.

The one authorized dispatch attempt for deploy-preview-web.yml with ref
migration/aws-s3-cloudfront was rejected before dispatch because the workflow
file is not present on the repository default branch:
`HTTP 404: workflow deploy-preview-web.yml not found on the default branch`.
No deployment run, OIDC session, helper invocation, PutObject, CloudFront
readback, invalidation, data mutation, HostingStack mutation, or master branch
protection change occurred. Per the no-retry stop condition, no second
dispatch was attempted. The repository settings change and branch push remain
the only E05 external writes.
```

### Phase 4 T15 first-dispatch recovery G01 temporary trigger

```text
Start: 1d20897; result: complete locally; the one-time push request is ready.
Added only the exact temporary push trigger to deploy-preview-web.yml for
branch migration/aws-s3-cloudfront and path
.github/workflows/deploy-preview-web.yml. workflow_dispatch and all T15C
permissions, actions, jobs, commands, OIDC, and helper contracts remain
unchanged. Focused workflow contract coverage proves the exact trigger and
rejects all other event surfaces. No GitHub/AWS operation occurred in G01;
G02 is the single authorized push/execution gate.
```

### Phase 4 T15E05 Sol stop review and D023 plan

```text
Start: 7c8dd50; result: stop accepted and a one-run recovery plan prepared.
Sol independently confirmed the clean local branch is exactly two log commits
ahead of remote SHA 9ae26b0, Actions settings are selected/full-SHA/read-only
as recorded, and run 31348125949 is a successful push-triggered Migration
validation for exact SHA 9ae26b0. The rejected workflow_dispatch request
created no Actions run. AWS state and preview objects were not mutated.

D023 avoids a pre-review master merge or default-branch change. The reviewed
temporary trigger matches only migration/aws-s3-cloudfront and only a change
to deploy-preview-web.yml; the trigger-addition commit is the explicit one-time
request. After exactly one successful deploy run and external verification, a
cleanup revision removes the push trigger before any later branch commit. The
permanent workflow remains workflow_dispatch-only. No AWS/GitHub write was
made during this Sol review.
```

### Phase 4 T15 first-dispatch recovery G02 deployment stop

```text
Start: 1d20897; G01 commit/push SHA:
8068f85426a31f21ec5fcdce54e2cf4867dbdf32.
Read-only pre-push baselines matched the exact repository/branch, tightened
Actions settings, AWS account 470447451992/region ap-northeast-1, v6/default
policy and reviewed OIDC role/trust/inline policy, HostingStack UPDATE_COMPLETE,
and the reviewed HostingStack template SHA
b5ae99c62f73b2c7df1bc361510247e133c436a42ea99cc179290fa34e93ce0e.
The data-version inventory hash was
7beee9dc3cbe0e99663d8d2b34bbc27856cffc67c6d4f91eff19c22a91538d4e and the
CloudFront invalidation inventory hash was
83890be8558e3f6da4653cef4a74099b5c4e69f7800967d890f143949da62b44.

The one authorized push advanced only migration/aws-s3-cloudfront from
9ae26b0 to 8068f85. Its normal validation run
31348798987
(https://github.com/subaru44k/itsrunnew/actions/runs/31348798987) succeeded
for the exact SHA; Node 24.18.1, repository checks, Chromium, and production
E2E completed successfully. The observed validation job context was
`Node 24 validation`.

The same push created exactly one temporary push-triggered Preview deployment
run, 31348799391
(https://github.com/subaru44k/itsrunnew/actions/runs/31348799391), for the
exact SHA. It ended immediately with `startup_failure`, had zero jobs, and
its logs endpoint reported no log. No OIDC session, helper invocation, S3
PutObject, CloudFront readback, invalidation, HostingStack mutation, data
mutation, or production/DNS/Firebase/Cognito change occurred. The exact
GitHub API run record identified workflow `Deploy preview web`, path
`.github/workflows/deploy-preview-web.yml`, event `push`, and run attempt 1.

Because a failed deployment run is a binding stop condition, G03 cleanup and
G04 master protection were not attempted. No retry, workflow dispatch, second
deployment run, cleanup push, or merge occurred. This record contains no
credentials, tokens, raw logs, or object bodies.
```

### Phase 4 T15 G02 Sol diagnosis and D024 recovery plan

```text
Start: 47db942; result: failed-run stop accepted and exact settings correction
planned. Sol independently confirmed remote SHA 8068f85, successful normal
validation run 31348798987, and deployment run 31348799391 with conclusion
startup_failure, zero jobs, no logs, and no AWS execution. The deployed-workflow
source still has only the exact temporary branch/path trigger plus
workflow_dispatch and otherwise matches T15C.

The sole non-GitHub allowed-action pattern reads
`aws-actions/configure-aws-credentials`, while GitHub's required action syntax
is OWNER/REPOSITORY@TAG-OR-SHA. D024 corrects it to the exact already pinned
SHA `aws-actions/configure-aws-credentials@00943011d9042930efac3dcd3a170e4273319bc8`;
it does not use @*, a tag, verified-all, or another action. Because the first
run never created a job or AWS session, one separately identified workflow-file
push is authorized after exact settings readback. No GitHub or AWS write was
made during this Sol diagnosis.
```

### Phase 4 T15 dispatch recovery A02 one-time retry request

```text
Start: d8a7436; result: local recovery request prepared. Added only the
concise D024 comment to the existing exact temporary push trigger. Workflow
permissions, actions, jobs, commands, branch/path filters, and dispatch event
remain unchanged. Focused workflow/helper tests and npm run check passed. The
required one-time push and external run gate follows this commit; no push or
deployment operation occurred while preparing A02.
```

### Phase 4 T15 dispatch recovery A01 selected-action correction

```text
Start: 882d991; result: complete. Read-only settings matched D024 before the
write: Actions enabled, selected mode, SHA pinning required, GitHub-owned
actions allowed, verified actions disabled, default workflow permissions read,
and PR approval disabled. The only mismatch was the selected pattern lacking
the action SHA. The single authorized settings update changed only that value
to `aws-actions/configure-aws-credentials@00943011d9042930efac3dcd3a170e4273319bc8`.
Readback confirmed every other setting unchanged and the exact SHA-qualified
pattern. No workflow, push, AWS, or deployment operation occurred in A01.
```

### Phase 4 T15 dispatch recovery A02 deployment stop

```text
Start: d8a7436; A02 commit/push SHA:
3a7a6e610c22703e21b10a8f12cbe03e4a3f1de7. The selected-action setting was
read back with the exact SHA-qualified pattern before the push. Read-only AWS
baselines remained account 470447451992/region ap-northeast-1, HostingStack
UPDATE_COMPLETE, and the same data-version and invalidation inventory hashes:
7beee9dc3cbe0e99663d8d2b34bbc27856cffc67c6d4f91eff19c22a91538d4e and
83890be8558e3f6da4653cef4a74099b5c4e69f7800967d890f143949da62b44.

The normal validation job in Preview run 31349359200 succeeded before deploy:
validation job 93337159470, context `Node 24 validation`, Node 24.18.1,
checks/Chromium/E2E all passed. The sole new Preview deployment run was
31349359200
(https://github.com/subaru44k/itsrunnew/actions/runs/31349359200), exact head
SHA 3a7a6e6. Deploy job 93337415921 passed setup, validation, build, and OIDC
credential configuration, then failed at `Deploy web-only preview` with exit
code 2; raw preview E2E was skipped. No deployment report was emitted and no
retry or rerun was performed.

Read-only post-failure checks show HostingStack remains UPDATE_COMPLETE with
the reviewed outputs, and the data-version/invalidation hashes remain exactly
unchanged. The current web-bucket inventory hash is
89ca02316baf1c69aec0c273d0dcfea5f159332d99201355d58f927c5714a4fd8; no
pre-run web inventory hash was captured, so no web deployment acceptance or
absence claim is made. No CloudFront invalidation, schedule-data mutation,
HostingStack mutation, Cognito, production/DNS/Firebase change was observed.

Because this second deployment attempt failed, A03 cleanup and A04 master
protection are not authorized by the recovery stop condition. No retry,
dispatch, cleanup push, merge, or protection write occurred. This record
contains no credentials, tokens, raw command output, or object bodies.
```

### Phase 4 T15 A02 Sol diagnosis and D025 recovery plan

```text
Start: 10cf0c3; result: failed helper run accepted and exact CLI correction
planned. Sol independently read run 31349359200 logs: validation and OIDC
succeeded, while the helper exited 2 without emitting unsafe diagnostics.
CloudTrail for its exact role session contains only GetCallerIdentity and
DescribeStacks after the OIDC action. No web object has a LastModified at or
after the helper step; data and invalidation inventories and HostingStack are
unchanged. IAM simulation allows PutObject for the exact web object resource,
and the bucket policy contains only TLS deny plus CloudFront read access.

Fresh local build preflight succeeds with 58 objects. A non-writing AWS CLI
`--generate-cli-skeleton output` check reproduces the client failure for
`--body fileb:///absolute/path` with ParamValidation and accepts the identical
plain absolute path. D025/B01-B04 therefore changes only the streaming-body
argument contract, preserves all security boundaries, and authorizes one final
separately identified workflow-file push after local verification. This Sol
diagnosis made no AWS or GitHub write.
```

### Phase 4 T15 PutObject recovery B01 body-path correction

```text
Start: 0383664; result: complete locally. Changed only putObjectArgs so the
AWS CLI `--body` value is the preflighted absolute object path, without a
fileb:// URI or shell wrapper. Pure and CLI tests prove exact argument order,
absolute path separation, unchanged content/cache metadata, and sanitized
credential/error boundaries. Focused migration tests passed (76); npm run
check passed (web 44, core 7, schedule-api 25, infra 18, synth/build).

The non-writing AWS CLI `put-object --generate-cli-skeleton output` check
accepted the first generated object's plain absolute body path and produced
valid skeleton JSON; no AWS request or write occurred. B02 is the separately
authorized one-time workflow push gate.
```

### Phase 4 T15 PutObject recovery B02 one-time deployment request

```text
Start: a812b41; result: local request prepared. Replaced only the temporary
D024 workflow comment with the concise D025 recovery comment; the exact push
trigger, workflow_dispatch, permissions, jobs, actions, commands, and helper
contract remain unchanged. Focused workflow/helper tests and npm run check are
required before the one-time push; no external operation occurred while
preparing B02.
```

### Phase 4 T15 PutObject recovery B02 successful deployment and B03 cleanup

```text
Start: 0383664; B01 commit a812b41; B02 cleanup-source commit 144b025.
The exact one-time push advanced migration/aws-s3-cloudfront to
144b02571f846073e0bb5973c2106c2581d9d68b. Normal validation run 31350133926
and Preview deployment run 31350133879 both matched that SHA. Validation job
93339239856 passed with Node 24.18.1, npm 11.4.2, repository checks,
Chromium, and production-browser checks. Deploy job 93339524824 passed the
reviewed build, OIDC setup, web-only helper, and raw preview checks; the run
finished successfully in 4m46s. The helper report was a sanitized match with
58 attempted/uploaded/verified objects (report SHA-256
5b9481860ae221ec1c9619f0649a97c3b13fed61513e057a6325f5438bdf0bea); raw
preview E2E completed 88 passed. No retry, rerun, or dispatch was used.

Read-only post-deploy gates matched the pre-run baseline: account
470447451992, region ap-northeast-1, HostingStack UPDATE_COMPLETE, reviewed
HostingStack canonical template SHA-256
b5ae99c62f73b2c7df1bc361510247e133c436a42ea99cc179290fa34e93ce0e, and the
same four hosting outputs (web bucket, data bucket, distribution ID/domain,
and API/Cognito outputs). Data object-version inventory SHA-256 remained
7beee9dc3cbe0e99663d8d2b34bbc27856cffc67c6d4f91eff19c22a91538d4e and the
CloudFront invalidation inventory SHA-256 remained
83890be8558e3f6da4653cef4a74099b5c4e69f7800967d890f143949da62b44. The
post-run web inventory contained 147 objects and had SHA-256
b8d39df5b1ae37aeafe2934f8c057d414dc629a61922c56bac7a66c96baf58ed; no
delete/list-sync operation or invalidation occurred. Public CloudFront
readback returned the expected HTML/JSON no-cache contract and the helper
verified each uploaded object’s exact body hash, content type, and cache
metadata. The data bucket remained versioned and public access block remained
enabled; direct S3 web access returned 403. No Hosting, data, schedule,
Cognito, production/DNS/Firebase, IAM, or CloudFormation mutation occurred.

B03 cleanup is now prepared locally by removing the complete temporary push
block and recovery comment, leaving workflow_dispatch-only. The focused
workflow contract is updated accordingly; the cleanup push and its required
validation/no-deployment proof remain the next authorized gate. B04 master
protection has not been attempted.
```

### Phase 4 T15 PutObject recovery B03/B04 final acceptance

```text
B03 cleanup commit/push SHA: 5f67e0827e606d5f71c93ac7caad2f8aed1c5958
(short 5f67e08). The temporary push trigger and recovery comment were removed
and deploy-preview-web.yml is workflow_dispatch-only; no other workflow
contract changed. Exactly one cleanup push was made. Its only Actions run was
Migration validation 31350706753
(https://github.com/subaru44k/itsrunnew/actions/runs/31350706753), exact SHA,
with job 93340803734 and context `Node 24 validation`; it passed Node
24.18.1, npm 11.4.2, repository checks, Chromium, and production-browser
checks. GitHub reported no Deploy preview web run for the cleanup SHA.

B04 protection was applied once after observing the successful context. The
readback is exact: required status checks strict with only `Node 24
validation`; one approving review; stale-review dismissal enabled; code-owner
review and last-push approval not required; administrators enforced; required
conversation resolution enabled; restrictions null; force pushes and branch
deletion remain disabled. Default branch remains master; no PR, merge, or
default-branch change was made.

Final local gates under Node 24.18.1 passed: npm ci (npm 11.16.0 local; the
workflow gate used npm 11.4.2), npm run check (web 44/core 7/schedule-api 25/
infra 18, synth/build), npm run test:e2e (14 legacy + 44 isolated admin
cases), all migration Vitest suites excluding the standalone node:test file
(9 files, 175 passed), standalone static server node:test (3 passed), and
git diff --check. The authorized B02 deployment remained the only successful
Preview deployment run in this recovery; its validation/deploy jobs passed,
the helper matched 58/58/58, and raw preview E2E was 88 passed. No later
deployment run, AWS/GitHub retry, invalidation, data/schedule mutation,
HostingStack/IAM/Cognito/production/DNS/Firebase change occurred.

T15 B01-B04 implementation, the one authorized deployment, cleanup, and
master protection are complete. The final documentation push's required
validation run 31351135135 (job 93342053683, exact SHA) failed in the hosted
Chromium process on legacy `/en/yumenoshima`: 13 tests passed, then the
Chromium headless shell exited with SIGSEGV (exit 1). This was not an
application assertion or migration check failure, and no deployment job was
created for that SHA. No retry or second push was made. The stop is recorded
without copying the runner stack or raw logs; Sol review is required before
any further action. The branch is clean at the local evidence follow-up; stop
before T16.
```

### Phase 4 T16A release-candidate verification stop

```text
Start: d47d131; result: stopped before T16B01. Branch
migration/aws-s3-cloudfront, exact HEAD d47d131, clean worktree, and Node
24.18.1 were confirmed. No AWS or GitHub write, dependency edit, source edit,
policy operation, synth mutation, deploy, alarm, data, schedule, or
invalidation operation occurred.

The required Node 24 release-candidate checks were run in order. `npm ci`
completed with the repository's existing audit result (11 vulnerabilities:
7 moderate and 4 high). `npm run check` passed (web 44, core 7,
schedule-api 25, infra 18, synth/build). `npm run test:e2e` passed 14 legacy
and 44 isolated admin cases. Explicit preview E2E passed 88 cases.

The required `npm ls --all` gate failed with npm `ELSPROBLEMS` and was not
hidden or repaired: Nuxt's existing `@bomb.sh/tab@0.0.19` path resolves
`commander@11.1.0`, which is invalid against its declared
`^13.1.0 || ^14.0.0 || ^15.0.0` range. The same invalid dependency is also
reported through the existing cssnano/svgo path; Vitest's commander 2.20.3
path is valid. This is an installed-tree/dependency-contract failure, not a
T16 source failure. `git diff --check` passed and the worktree remains clean.

Per T16A stop conditions, no retry, dependency change, contract weakening,
T16B alarm implementation, policy v7 work, AWS read/write, or Hosting deploy
was attempted. Sol review is required before continuation.
```

### Phase 4 T16A dependency-recovery authorization

Sol diagnosed the stopped tree as an optional peer collision between Nuxt
CLI's `@bomb.sh/tab@0.0.19` and SVGO's unrelated root
`commander@11.1.0`. D027 authorizes exact-pinned root development dependency
`commander@15.0.0` only; no runtime package, override, application import, AWS
write, or weakened dependency gate is authorized. DR01-DR03 in
`phase4-t16-dependency-recovery-plan.md` may run in order, including a complete
T16A rerun before the original T16B AWS-write gates reopen.

### Phase 4 T15 Sol final acceptance

```text
Start: 7cd6f0c; result: T15 accepted. Sol independently reviewed the B01-B04
diff and confirmed the only helper source change is the AWS CLI streaming Body
argument from fileb URI to the already preflighted absolute path. The permanent
deploy workflow is workflow_dispatch-only; all actions remain full-SHA pinned,
the deploy job retains contents:read plus id-token:write only, and the selected
non-GitHub repository action is the exact configure-aws-credentials SHA.

GitHub run 31350133879 succeeded with ordered validation/deploy, exact OIDC,
sanitized 58/58/58 helper result, and raw preview E2E 88. Cleanup validation
31350706753 succeeded and no deploy run exists for the cleanup SHA. Master
protection reads back strict `Node 24 validation`, one approval, stale-review
dismissal, administrators enforced, conversation resolution, null actor
restrictions, and force/deletion disabled. Default branch remains master and
no PR or merge occurred.

The first attempt of final-doc validation 31351135135 failed only because the
hosted Chromium process received SIGSEGV after 13/14 legacy routes. The same
exact SHA was rerun once without a code, settings, AWS, or workflow change;
attempt 2/job 93342532989 passed every step, including all production-browser
checks. No deploy workflow was created by either attempt because the temporary
trigger had already been removed.

The local T15F suite and prior external acceptance evidence remain accepted:
data-version and invalidation inventory hashes are unchanged, HostingStack is
unchanged, direct S3 is denied, and CloudFront web object hashes/types/cache
metadata match the generated build. No additional deployment, invalidation,
data/schedule, IAM, Cognito, production, DNS, or Firebase mutation occurred in
the Sol review. T16 may start from the next clean committed handoff.
```

### Phase 4 T16A dependency recovery DR01 exact Commander peer

```text
Start: cb5b87a; result: complete locally. Added only root devDependency
`commander: 15.0.0` with an npm-generated lockfile update. No override,
production dependency, application/runtime import, Lambda bundle import, or
other package was added.

Under Node 24.18.1, npm install and clean `npm ci` completed with the existing
audit summary (11 vulnerabilities: 7 moderate and 4 high). `npm ls --all`
and `npm ls @bomb.sh/tab commander --all` are valid with no invalid or
extraneous entries: root/Tab resolve Commander 15.0.0, SVGO retains nested
Commander 11.1.0, and Terser retains nested Commander 2.20.3. Source scans
found no Commander import in packages, web, services, infra, or migration
runtime sources. DR02 immutable T16A re-verification follows this commit;
AWS writes remain prohibited.
```

### Phase 4 T16A dependency recovery DR02 immutable rerun

```text
Start: e22c9dc; result: complete locally. Under Node 24.18.1, npm ci
completed with the pre-existing audit summary (11 vulnerabilities: 7
moderate and 4 high). The complete T16A release checks passed: npm run check
(web 44, core 7, schedule-api 25, infra 18, synth/build), npm run test:e2e
(14 legacy plus 44 admin), and explicit preview E2E (88). Migration focused
tests passed (175 tests across 9 files), static server tests passed (3),
bootstrap policy tests passed (5), and the dedicated infra test/build passed
(18 infra tests and successful CDK synth).

The dependency gates passed with no invalid or extraneous packages. Root and
Nuxt CLI use commander 15.0.0, SVGO retains nested commander 11.1.0, and
Terser retains nested commander 2.20.3. No runtime Commander import was
found. git diff --check passed and the worktree is clean. No AWS operation,
policy-version write, alarm change, or Hosting deployment was performed;
DR03/T16B remains gated for Sol review.
```

### Phase 4 T16B01 D026 API 5xx alarm source

```text
Start: 0723263; result: complete locally. HostingStack now defines exactly
one stack-owned AWS::CloudWatch::Alarm named itsrun-preview-admin-api-5xx for
AWS/ApiGateway metric 5xx, dimensions ApiId=<AdminApi Ref> and Stage=$default,
Sum/300 seconds, threshold 1, evaluation periods 3, datapoints to alarm 2,
GreaterThanOrEqualToThreshold, and notBreaching missing data. It has no alarm,
OK, insufficient-data, tag, SNS, dashboard, anomaly, or detailed-metric
actions. Existing hosting contracts remain intact.

Node 24.18.1 checks passed: bootstrap policy focused test (before B02 policy
change, 5 tests), infra tests (19), npm run check (web 44/core 7/schedule-api
25/infra 19 plus build/synth), and git diff --check. No AWS operation was
performed. T16B02 candidate policy work follows; AWS writes remain blocked.
```

### Phase 4 T16B02 D026 candidate execution policy v7

```text
Start: 9a47542; result: complete locally. The committed candidate is a
deterministic v6-to-v7 delta of exactly three changes: remove
PreviewGitHubOidcProviderLifecycle, remove the GitHub deployment role ARN from
PreviewScheduleLambdaRole while retaining its Hosting role pattern, and add
PreviewAdminApi5xxAlarm with only cloudwatch:PutMetricAlarm,
cloudwatch:DeleteAlarms, and cloudwatch:DescribeAlarms on the exact
itsrun-preview-admin-api-5xx alarm ARN. All other v6 statements are
byte-semantic unchanged. The candidate is 5,954 non-whitespace characters,
within the 6,144-character limit, with no wildcard action or forbidden
privilege.

The focused policy test passed (5 tests), and the full Node 24 infra/root
checks passed with the alarm source (infra 19, web 44, core 7,
schedule-api 25, synth/build); git diff --check passed. No AWS operation or
policy version write occurred. T16B03 read-only gates are next; AWS writes
remain blocked.
```

### Phase 4 T16B03 read-only preflight

```text
Start: debc4c9; result: complete locally and read-only. STS returned account
470447451992 in ap-northeast-1 under codex-prod. The execution policy is
default v6 with exactly v2-v6 retained. AWS v6 equals the reconstructed
committed v6 contract at sorted-canonical SHA-256
400ba3cbced406e283fafa34292aeb5e425ed69eb291c0bc15c2a31352cf5415; the
nondefault v2 equals commit 22d7fd5 and its required sorted-canonical SHA-256
9318b40d9d601231335f6a1a4271ec8e5edc5700f5367dec2a407c329bee9f54. The
reviewed alarm is absent.

ItsRunPreviewHosting is UPDATE_COMPLETE with the accepted API, Cognito,
distribution, and bucket outputs; ItsRunPreviewGitHubDeploy is CREATE_COMPLETE
with the accepted provider and role outputs. Fresh synth and template
validation passed with CAPABILITY_IAM; `cdk diff --no-change-set` showed only
AWS::CloudWatch::Alarm AdminApi5xxAlarm. Candidate-action simulation allowed
the three exact alarm actions on the exact alarm ARN and implicitly denied the
same PutMetricAlarm action on another alarm ARN. The accepted data-version and
CloudFront-invalidation inventory hashes remain
7beee9dc3cbe0e99663d8d2b34bbc27856cffc67c6d4f91eff19c22a91538d4e and
83890be8558e3f6da4653cef4a74099b5c4e69f7800967d890f143949da62b44.

No AWS write, policy-version mutation, Hosting/GitHub stack mutation, object
upload, schedule/data change, or invalidation occurred. All B03 gates are
green; B04's authorized writes may now be considered.
```

### Phase 4 T16B04 policy v7 rotation and T16B05 Hosting deployment

```text
Start: 62622e2; result: complete. After a fresh STS/account/region check,
exactly one nondefault policy version (v2) was deleted. After a second fresh
STS check, exactly one candidate version was created with set-as-default;
AWS assigned v7. Readback shows exactly v3-v7 retained, v7 default, and
sorted-canonical AWS/local candidate SHA-256
dd4a19a0ada79b4332ebb53245bc830a3d1d675322ea42f9a6011e1e70efaa97. No
additional policy version or IAM change occurred.

After repeating the v7/stack/STS gates, exactly one `npx cdk deploy
ItsRunPreviewHosting --require-approval never` was executed. Change set
`4596d7a4-067e-4dd8-81c1-456ab735be9a` reached UPDATE_COMPLETE. Events were
limited to AdminApi5xxAlarm CREATE_IN_PROGRESS/CREATE_COMPLETE, CDK metadata
update, and the parent stack update; no existing hosting resource changed.
The alarm readback is exact: AWS/ApiGateway 5xx, ApiId 40xqzug59a, Stage
$default, Sum/300, threshold 1, evaluation 3, datapoints 2,
GreaterThanOrEqualToThreshold, notBreaching, initial INSUFFICIENT_DATA, and
all three action arrays empty.

Read-only post-deploy checks passed: preview raw E2E 88; unauthenticated API
GET returned 401 and PATCH returned 405 with `Allow: GET, PUT, OPTIONS`, both
with `Cache-Control: no-store`; direct web/data S3 requests returned 403.
Current inventory reads found 147 web objects, 76 data keys (95 version
entries), and 3 historical CloudFront invalidations; no inventory write or
invalidation was performed. Accepted T15 data-version and invalidation
baseline hashes remain 7beee9dc3cbe0e99663d8d2b34bbc27856cffc67c6d4f91eff19c22a91538d4e
and 83890be8558e3f6da4653cef4a74099b5c4e69f7800967d890f143949da62b44.
Hosting outputs, GitHub deploy stack, OIDC provider/role, web/data privacy,
and preview contracts remain unchanged apart from the reviewed alarm.
No further AWS write, web/data/schedule upload, invalidation, Cognito,
production, DNS, Firebase, or non-preview operation occurred.
```

### Phase 4 T16B Sol alarm-description correction

Sol independently re-ran infra 19, policy 5, and the focused dependency tree
review, inspected the source/synth/policy delta, and read the deployed alarm.
The metric, thresholds, empty action arrays, v7 boundary, and stack state are
correct, but D026's required explicit preview description is absent from
source, assertion, and AWS. `phase4-t16-alarm-correction-plan.md` authorizes
only the exact description addition and one exact-diff Hosting correction
deployment. Policy v7/IAM and every other resource remain frozen.

### Phase 4 T16 alarm correction AC01

```text
Start: a9db9f7; result: complete locally. Added only the exact D026
AlarmDescription: `Preview administrator HTTP API sustained 5xx alarm;
operator-observed with no notification actions.` The semantic alarm assertion
requires exact equality while retaining every prior metric, dimension,
threshold, empty-action, and resource-count contract.

Node 24.18.1 infra tests passed (19), infra synth/build passed, npm run check
passed (web 44, core 7, schedule-api 25, infra 19), and git diff --check
passed. No AWS operation or policy/IAM/dependency/resource change occurred.
```

### Phase 4 T16 alarm correction AC02

```text
Start: e03be59; result: complete. Read-only preflight under
AWS_PROFILE=codex-prod verified account 470447451992 and ap-northeast-1,
policy v7 default with exactly v3-v7 retained, and AWS/local candidate
sorted-canonical SHA-256
dd4a19a0ada79b4332ebb53245bc830a3d1d675322ea42f9a6011e1e70efaa97.
Hosting was UPDATE_COMPLETE; the existing alarm matched D026 with no
AlarmDescription. GitHub deploy stack remained CREATE_COMPLETE. Fresh synth
and template validation passed, and cdk diff showed only
AdminApi5xxAlarm.AlarmDescription with the exact approved text.

Exactly one `npx cdk deploy ItsRunPreviewHosting --require-approval never`
was executed after a fresh STS check. Change set
`75a9f1f7-1fdd-4a1c-a1b8-8957aad80e26` updated only AdminApi5xxAlarm and the
stack reached UPDATE_COMPLETE. Readback exactly matches the description and
all D026 fields: AWS/ApiGateway 5xx, ApiId 40xqzug59a, Stage $default,
Sum/300, threshold 1, evaluation 3, datapoints 2, comparison greater/equal,
notBreaching, empty action arrays, and healthy OK state.

Post-deploy read-only checks passed: preview E2E 88; unauthenticated GET 401
and PATCH 405 with `Cache-Control: no-store` (PATCH Allow GET, PUT, OPTIONS);
direct web/data S3 returned 403. Current inventory reads remained 147 web
objects, 76 data keys/95 version entries, and 3 historical invalidations.
Accepted inventory hashes remain
7beee9dc3cbe0e99663d8d2b34bbc27856cffc67c6d4f91eff19c22a91538d4e and
83890be8558e3f6da4653cef4a74099b5c4e69f7800967d890f143949da62b44. No
policy/IAM/version, upload, schedule/data, invalidation, Cognito, GitHub,
production, DNS, Firebase, or non-preview operation occurred.
```

### Phase 4 T16C-D Sol authorization

Sol accepts the corrected T16B alarm at `f8be50d` subject to final readback.
D028 authorizes exactly two ephemeral `.invalid` local Cognito identities for
real preview Hosted UI/JWT testing; both must be deleted after the rehearsal and
do not satisfy the later production-operator requirement. D029 reserves only
the Oda 2026-08 object and one tuple for a conditional API update, one rejected
stale write, and one exact conditional byte restore with all versions retained.
`phase4-t16-auth-rollback-plan.md` defines the dependency order, secret-handling
boundary, AWS actions, cleanup, tests, and restoration-first stop behavior.

### Phase 4 T16C01/C02 real-auth rehearsal preparation

```text
Start: 9fcacf4; C01/C02 local and read-only gates complete. Added the small
AWS-free `t16-auth-harness` boundary test: exact reserved target, .invalid
role identities, credential-presence-only handling, approved sanitized outcome
fields, same-origin browser URL, and forbidden storage/console/network leakage.
No test adapter, fetch replacement, token persistence, or credential material
was added.

Read-only C02 under codex-prod/account 470447451992/ap-northeast-1 found
Hosting UPDATE_COMPLETE, alarm healthy, policy v7 default/v3-v7 retained and
candidate SHA dd4a19a0ada79b4332ebb53245bc830a3d1d675322ea42f9a6011e1e70efaa97.
The pool `ap-northeast-1_nmj9cP9st` has zero users, one empty admins group,
one code/COGNITO-only public client, exact `itsrun/schedule.write` resource
server, and zero external identity providers. Operator simulation allowed only
the planned Cognito actions and exact reserved S3 PutObject key. The reserved
object remains 501 bytes, SHA ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb,
tuple 2026-08-09[0]=0, ETag/VersionId captured in protected operator temp
storage outside the repository. No mutation occurred.
```

Follow-up: the initial focused harness run exposed a local numeric-outcome
validation defect (`http-200` was rejected); the validator was corrected to
allow digits, and the focused three-test suite plus the subsequent Node 24
`npm run check` completed successfully. No AWS operation or credential
material was involved.

### Phase 4 T16C03 stop: real Hosted UI gate

C03 was stopped after the exact two temporary `.invalid` identities were
created with suppressed messages, the admin identity was added to `admins`,
and four real-browser attempts (desktop/mobile × admin/non-admin) were made
against the deployed preview. `/manage` did not redirect to the Cognito
Hosted UI; it returned the localized sanitized authentication-failure state
without a Cognito authorization request, API request, token, or persistent
credential material. This is a deployed-preview authentication configuration
stop, not a test-adapter result.

The cleanup gate was executed immediately: the temporary group membership and
both identities were removed, and the pool was read back with zero users and
zero `admins` members. C03 AWS writes were exactly eight (two creates, two
permanent-password settings, one group add, one group removal, and two
deletes); no schedule/data object write occurred. D01/D02 were not attempted.

### Phase 4 T16 CSP01

Added only the D030 regional Cognito issuer origin to the shared CloudFront
CSP: `https://cognito-idp.<AWS::Region>.amazonaws.com`, preserving the existing
self and Hosted UI origins and all other directives. Semantic infra assertions
require the exact ordered join in both existing response-header policies and
reject wildcard, HTTP, path, foreign-region, and foreign-provider variants.
Node 24 infra tests passed (19/19), root `npm run check` passed (web 44,
core 7, schedule-api 25, infra 19 plus build/synth), and local E2E passed
(legacy 14, admin 44). No AWS operation occurred; CSP02 remains pending the
read-only preflight and single authorized Hosting deployment.

### Phase 4 T16C CSP recovery authorization

Sol verified the deployed public runtime config has the exact issuer/client and
the Cognito discovery document has the correct Hosted UI endpoints. Browser
discovery nevertheless originates at
`https://cognito-idp.ap-northeast-1.amazonaws.com`, which the deployed CSP does
not allow; this explains the pre-token failure. D030 and
`phase4-t16-auth-csp-recovery-plan.md` authorize only that exact issuer origin,
the two existing response-header-policy updates, and then a fresh C03/D01/D02
rehearsal from the confirmed zero-user/group state.

### Phase 4 T16 LD01

Extended the existing AWS-free auth harness with a Hosted UI diagnostic
normalizer. It emits only an allowlisted category, sanitized host/path
sequence, integer status list, role, and duration; query strings, DOM text,
credentials, cookies, hidden transaction values, codes, tokens, and claims
cannot appear in the result. Focused tests pass 5/5. LD02 remains pending its
single-user read-only diagnostic and mandatory cleanup.

### Phase 4 T16 LD02 result

Read-only gates matched account/region, policy v7 with v3-v7 retained, healthy
Hosting/alarm/CSP, code/PKCE COGNITO-only client, and zero pool/group users.
One suppressed `.invalid` diagnostic user was created, permanently
password-set, and confirmed with `AdminGetUser`; it was never added to a
group. The email-alias browser attempt reached the sanitized `callback`
category (`/manage/callback` then same-origin `/manage`) with no API request.

The initial normalizer classified this as `unknown-login` because it only
examined the final path, so the harness proceeded to the one permitted
internal-Username diagnostic attempt before the defect was recognized. That
attempt also reached the sanitized `callback` category with zero API
requests. No raw DOM, credentials, cookies, hidden fields, query strings,
codes, tokens, claims, or raw errors were recorded. The normalizer now treats
any same-origin callback path in the sequence as `callback`, with focused tests
passing 6/6.

The diagnostic user was immediately deleted (one cleanup write); pool users
and `admins` members read back as zero. LD02 writes were exactly three (create,
permanent-password set, delete); no group, API, schedule, data, or deployment
operation occurred. Temporary credential/script files were removed outside
the repository.

### Phase 4 T16 FR02 stop

FR01 gates and protected Oda baseline remained exact. FR02 created exactly two
suppressed `.invalid` users, permanently set both passwords, and added only the
admin user to `admins` (5 writes total). Four fresh real-browser contexts
(desktop/mobile admin and non-admin, email aliases only) produced only the
sanitized `unknown-login` category with zero API requests; no callback/GET
200/403 matrix evidence was established. Recorded browser evidence was
limited to path/method/status metadata, storage key names/counts, and console
categories; no token, code, query, credential, header, body, or raw error was
retained. Because the required auth gate did not pass and identifier retries
are forbidden, FR03 was not attempted. Immediate cleanup removed the admin
membership and both users (3 writes), leaving pool users and group members at
zero. Temporary credential/script files were removed outside the repository.

### Phase 4 T16 FR01

Local gates passed under Node 24: focused auth harness 6/6, root check, and
local E2E (legacy14/admin44). Read-only AWS gates matched account
470447451992/region ap-northeast-1, policy v7 default with v3-v7 retained,
Hosting/alarm/CSP/GitHub baselines, exact code/PKCE COGNITO-only client, pool
and group zero, API no-store, and private S3. The D029 Oda object was captured
outside the repository with the exact 501-byte SHA-256
`ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`, cell
`2026-08-09[0]=0`, ETag `"b2591d35e23ac1b9f2a133f71198b953"`, VersionId
`wQ1b5EEu1Qzrw93GyN9_bPNtxwaZ5VAE`, `application/json`, and
`public, max-age=0, s-maxage=60`. AWS CLI `PutObject` supports `IfMatch`, and
the exact-key restore permission simulation was allowed. FR01 performed no
AWS write.

### Phase 4 T16 CSP02/CSP03 recovery result

The CSP02 read-only gate matched policy v7 default with v3-v7 retained,
Hosting `UPDATE_COMPLETE`, alarm healthy, the separate GitHub stack intact,
zero pool users and `admins` members, and unchanged data/invalidation
baselines. Fresh synth/validation and `cdk diff --no-change-set` showed only
the D030 `connect-src` content update on `SecurityHeaders` and
`ApiSecurityHeaders`.

After a fresh STS check for account `470447451992` and region
`ap-northeast-1`, exactly one Hosting deployment ran. Change set
`1efe9296-cbca-4855-aba5-e6f0a78fe900` reached `UPDATE_COMPLETE`; only the
two existing response-header policies updated. Readback showed both policies
with self, the existing Hosted UI origin, and the exact regional Cognito
issuer origin. Preview raw E2E passed 88/88; unauthenticated API GET/PATCH
remained 401/405 with `no-store` and the documented Allow header; direct S3
remained 403. No policy/IAM/version, object upload, schedule write, or
invalidation occurred.

CSP03 then created a new pair of suppressed `.invalid` identities and one
temporary `admins` membership. Real desktop/mobile Hosted UI attempts reached
OIDC discovery/authorize but all credential submissions returned to the
Hosted UI login page; no callback, API request, token, or persistent auth
storage was observed. This is a second deployed authentication stop, so D01
and D02 were not attempted. Immediate cleanup removed the membership and both
identities (3 cleanup writes), leaving pool users and group members at zero.
CSP03 total writes were eight (two creates, two password settings, one group
add, one group removal, and two deletes). Temporary credential material was
removed outside the repository.

### Phase 4 T16 login diagnostic authorization

Sol confirmed the second stop is beyond discovery and uses visible-only Hosted
UI form selectors; users were confirmed and credentials were not exposed. The
missing evidence is the normalized Hosted UI outcome and alias-versus-internal
Username behavior. D031 and `phase4-t16-login-diagnostic-plan.md` authorize one
disposable user, at most two no-API/no-data login attempts, mandatory deletion,
and sanitized evidence only. No authentication-flow, stack, IAM, or data change
is authorized.

### Phase 4 T16 BR01

Added the dependency-free sanitized browser recorder to the existing auth
harness. It attaches navigation/response listeners before the login action,
retains only approved Cognito/CloudFront host, path, and integer status,
strips queries, ignores unknown hosts, deduplicates deterministically, and
detaches cleanly. Fake-page tests prove immediate callback→manage ordering,
pre-action listener attachment, unknown/query non-leakage, and cleanup.
Focused recorder/harness tests pass 8/8. Node 24 `npm run check` passed and
local E2E passed legacy14/admin44. BR02 remains pending its fresh real-auth
matrix; no AWS operation occurred.

### Phase 4 T16 BR02 pre-browser stop and cleanup

The fresh BR02 browser matrix could not start because the protected temporary
password material was absent (no password reset or login attempt was made).
The exact temporary pool state was read-only verified before cleanup: two
users and one `admins` membership. After fresh STS/account/region checks,
exactly three authorized Cognito writes were performed: remove the one
temporary admin membership, delete the two temporary users, and no other
Cognito resource was touched. Readback verified users=0 and admins
membership=0. Temporary credential/driver files were absent. No schedule or
other data write, deployment, invalidation, IAM, or production operation
occurred; BR03 was not started.

### Phase 4 T16 final rehearsal authorization

D031 proved email alias and internal Username both traverse the real callback;
the original final-path-only diagnostic was the remaining false negative. The
corrected six-test normalizer is accepted. D032 and
`phase4-t16-final-rehearsal-plan.md` authorize a fresh email-alias-only
admin/non-admin desktop/mobile matrix followed by the exact D029 one-cell
conditional update, stale 409, exact-byte conditional restore, and mandatory
zero-user cleanup. No deployment, IAM, invalidation, or other data target is
authorized.

### Phase 4 T16 browser-recorder recovery authorization

Sol confirmed FR02 used the correct real login form but recorded only the final
`/manage` path; unlike D031, it did not attach a response sequence listener
before login, so the immediate callback was unobservable. D033 and
`phase4-t16-browser-recorder-recovery-plan.md` require a tested pre-login
sanitized recorder and a signed-in UI sentinel before API access, then authorize
one fresh matrix and the unchanged conditional update/restore rehearsal.

### Phase 4 T16 single-session recovery authorization

BR01's recorder passed eight focused tests. BR02 then stopped before browser
execution because its later process correctly lacked the prior process's
temporary password state. Existing cleanup removed one membership and two users
and returned pool/group to zero without login or data access. D034 and
`phase4-t16-single-session-rehearsal-plan.md` require the next and only runner
to own credential generation, auth, data restore, and cleanup in one bounded
process with restoration-first `finally` control.

### Phase 4 T16 internal-Username recovery authorization

The first single-session runner correctly cleaned up after a pre-auth failure:
one user create and one user delete, with pool/group zero and no data access.
Sol diagnosed that `AdminSetUserPassword` received the email alias instead of
the internal Username returned by `AdminCreateUser`. D035 and
`phase4-t16-internal-username-recovery-plan.md` require an AWS-free adapter
proof, internal IDs for admin/cleanup APIs only, email aliases for Hosted UI
only, then one corrected bounded execution.

### Phase 4 T16 void-output recovery authorization

Sol inspected only top-level CloudTrail event metadata: IU02 successfully
completed one `AdminCreateUser` and one `AdminSetUserPassword`, attempted no
second create, and later deleted the first user. The password operation is a
successful empty-stdout AWS CLI command; the runner incorrectly JSON-parsed it.
D036 and `phase4-t16-void-output-recovery-plan.md` require explicit JSON/void
typing, realistic empty-output fake tests, and one corrected bounded execution.

### Phase 4 T16 ephemeral credential exposure and recovery authorization

During VO02, the primary agent's local process-list inspection displayed the
ephemeral Cognito setup arguments. The runner was terminated immediately before
browser/data access. Fresh STS-gated cleanup removed one group membership and
two users; readback proved pool/group zero. The reserved object still has the
original 501 bytes, ETag, VersionId, metadata, and SHA. The runner and its exact
mode-0700 directory were removed. No token/code/long-lived AWS credential,
schedule write, restore, invalidation, or production resource was involved;
the exposed password is unusable because both users were deleted.

D037 and `phase4-t16-sensitive-argv-recovery-plan.md` prohibit secrets in child
arguments/environment and require mode-0600 operation JSON via
`--cli-input-json`, canary tests, immediate unlink, and one corrected bounded
execution. Future monitoring must use only sanitized result/AWS counts, never
process command lines.

### Phase 4 T16 SS01

SS01 completed locally from Sol handoff `4a76298` on Node 24.18.1. The focused
recorder tests passed 8/8, root `npm run check` passed (web44/core7/
schedule-api25/infra19 plus build/synth), and local E2E passed 14 legacy + 44
admin cases. Read-only gates matched the project account/region, the exact
pool/group were empty, and the reserved Oda object remained the protected
501-byte baseline with its recorded ETag/VersionId/hash and JSON cache
metadata. No AWS write occurred.

A temporary mode-0700 runner was reviewed outside the repository and imported
successfully under Node 24. It uses only `execFile` argument arrays, exact
project constants, generated in-memory credentials persisted only to a
mode-0600 temporary file, the pre-login sanitized recorder, visible signed-in
and load-form sentinels, and a single restoration guard. Its output is limited
to sanitized role/status/count/hash/boolean fields; it does not print paths,
identities, credentials, query/header/body/cookie/DOM/token/error material.
The runner was not executed in SS01; SS02 remains the single authorized
execution boundary.

### Phase 4 T16 SS02 stop

The one authorized SS02 process was invoked once after SS01. It stopped before
browser authentication and before any schedule/data operation: one temporary
Cognito user creation completed, while the following credential setup step
failed. The process emitted only its sanitized failed result. Mandatory
failure cleanup then deleted that one temporary user; no group membership had
been added. Readback verified users=0 and admins membership=0. The temporary
runner and generated material were removed. Schedule writes=0, restore writes=0,
CloudFront invalidation=0, and BR03/SS03 were not started. This is a terminal
rehearsal stop; no retry, password reset, or additional identity operation is
authorized in this run.

### Phase 4 T16 IU01

IU01 completed locally from Sol handoff `56014b5`. The dependency-free fake
adapter proof passed two cases: both create responses were validated as
nonempty internal identifiers; password, group, get, remove, and delete calls
used only those internal identifiers; browser input used only the email
aliases; and a password-setup failure cleaned the already-created internal
identifier. Serialized output contained only sanitized booleans/counts and
categories, with no identifiers, arguments, credential values, or raw errors.

Repeated SS01 gates matched: recorder tests 8/8, root check passed (web44,
core7, schedule-api25, infra19 plus build/synth), local E2E passed 14 legacy +
44 admin, and read-only account/region, empty pool/group, and protected
501-byte object baseline checks passed. No AWS write occurred. IU02 remains
the single authorized real execution boundary.

### Phase 4 T16 IU02 stop

The corrected D035 runner was executed exactly once. Its sanitized result
stopped before browser authentication and before any schedule/data operation;
no raw AWS error or operation detail was retained. Mandatory finally cleanup
completed, and read-only verification returned pool users=0 and admins
membership=0. The protected Oda object remained the 501-byte baseline hash.
The temporary runner/material were removed. Schedule writes=0, restore writes=0,
and CloudFront invalidation=0. This is a terminal stop for IU02; no retry,
password reset, or further rehearsal operation is authorized.

### Phase 4 T16 VO01

VO01 completed locally from Sol handoff `bc79c33` under Node 24.18.1. The
dependency-free AWS adapter proof passed six cases: successful void operations
with empty stdout return a fixed sentinel without JSON parsing; JSON operations
require nonempty valid JSON; nonempty void output, empty/malformed JSON, and
nonzero execution are rejected; and partial cleanup retains the internal
identity while emitting only a stable category. Fake setup/cleanup completed
for two users and the sanitized result contained no identifiers, arguments,
credentials, stdout/stderr, or raw errors.

Read-only account/region, empty pool/group, and protected 501-byte object gates
matched; recorder tests passed 8/8 and the worktree remained clean. No AWS
write occurred. VO02 remains the single authorized real execution boundary.

### Phase 4 T16 SA01

SA01 completed locally from Sol handoff `20b7309` under Node 24.18.1. The
dependency-free protected CLI boundary now allowlists the six Cognito
administrative operations, validates an absolute file beneath the protected
root, rejects symlink/non-regular/non-0600/outside targets, writes through an
injected protected writer, returns only `file://` input arguments, and performs
idempotent immediate unlink cleanup. Writer/inspect/cleanup failures are
sanitized.

The focused harness suite passed 12/12, including canary alias/password/
internal-ID non-exposure, per-operation JSON-file cleanup, partial cleanup,
and unknown/path/mode/symlink rejection. Root `npm run check` passed (web44,
core7, schedule-api25, infra19 plus build/synth); read-only account/region,
empty pool/group, and protected 501-byte object gates matched. No AWS write
occurred. SA02 remains the single authorized real execution boundary.

### Phase 4 T16 SA02 stop

The D037-sensitive-argv runner was executed exactly once. Its sanitized result
stopped before browser authentication and before schedule/data access after
the Cognito setup path; the process performed ten bounded Cognito operations
including mandatory internal-identity cleanup. Independent readback verified
pool users=0 and admins membership=0. The protected Oda object remained 501
bytes with its baseline hash. The temporary runner and material were removed;
schedule writes=0, restore writes=0, and invalidation=0. No raw process
arguments, environment, identifiers, credentials, or AWS errors were
inspected or recorded. This is a terminal SA02 stop; no retry or further
rehearsal action is authorized.

### Phase 4 T16 Hosted UI form recovery authorization

Read-only diagnosis after SA02 used only top-level CloudTrail metadata and
sanitized DOM counts. Cognito user creation and permanent-password setup had
completed; the Hosted UI authorize/login GET sequence occurred, but no login
POST occurred. Desktop and mobile each render two responsive sign-in form
copies with exactly one visible form and visible controls. Pool users and admins
membership remain zero, and the reserved Oda object remains the protected
501-byte baseline.

D038 and `phase4-t16-hosted-ui-form-plan.md` require a committed, locally tested
visible-form driver and typed checkpoints before one further bounded rehearsal.
HF01-HF03 may proceed in order under their exact preview-only boundaries. No
IAM, deploy, invalidation, production, DNS, Firebase, or T17 work is authorized.

### Phase 4 T16 PF01

PF01 is implemented locally from Sol correction `a65ead2`. The Hosted UI
driver now attaches rejection handling immediately, supports an injected
cancellable navigation signal, clears its bounded timer and detaches the
signal on every action outcome, and returns the distinct `click-failed`
checkpoint. A real Playwright Chromium fixture (desktop and mobile responsive
forms) proves that only the visible named Cognito form is filled and submitted
once; the existing AWS-free failure/timer/canary tests remain in place.

Node `v24.18.1` focused harness and browser tests passed `17/17`; root
`npm run check` passed (web44, core7, schedule-api25, infra19 plus build/synth).
No AWS, Cognito, browser-hosted, credential, or data operation occurred. PF02
is next; PF03 remains blocked until PF02 succeeds.

### Phase 4 T16 PF02

PF02 is implemented locally after PF01. `runT16Coordinator` is a
credential-free dependency-injected state machine with explicit preflight,
setup, per-role form/callback/sentinel, data read/update/stale/public,
restoration, and cleanup checkpoints. It returns only allowlisted status,
checkpoint, role outcome, typed failure category, and operation/write/restore/
cleanup counts. Adapter failures are sanitized; after a marked write, restore
is attempted before identity cleanup, including when the data adapter throws.

The AWS-free coordinator matrix passed `21/21` together with the real
Chromium PF01 test. Coverage includes every setup/auth/data failure boundary,
stale no-retry, restoration-first ordering, terminal restore failure, partial
cleanup, exact counts, and canary non-exposure. No AWS, Cognito, credential,
schedule-data, or browser-hosted operation occurred. PF03 remains blocked
pending the required read-only gates.

### Phase 4 T16 PF03 stop

PF03 read-only gates were rechecked after PF01/PF02: STS account was
`470447451992` in `ap-northeast-1`; the deployed preview pool was
`itsrun-preview-admins` with deletion protection active, zero users, and the
`admins` group had zero members. The reserved Oda object remained 501 bytes
with its protected baseline ETag and `public, max-age=0, s-maxage=60` metadata.
The prior HF02 desktop/mobile live selector gate remains the accepted
credential-free form evidence.

The PF03 execution boundary is stopped locally: this checkout contains no
reviewed environment adapter/thin runner that can bind the committed
coordinator to the protected Cognito/data/restore operations. Constructing
one would require introducing unreviewed credential-bearing runtime inputs,
which is outside the committed PF03 boundary. No users, groups, schedule
data, restore object, or other AWS resource was written; no temporary material
was created. PF03 remains pending Sol review rather than being claimed
complete.

### Phase 4 T16 PF Sol review and committed-adapter authorization

Sol accepts PF01's real Chromium proof and the PF03 read-only baseline/zero
state. PF02 is not yet accepted: `lastCheckpoint` is overwritten by cleanup,
resolved stage results are not validated, a resolved form failure can pass, and
success does not require a confirmed update or restore. PF03 correctly made no
write instead of creating another deleted, unreviewed runner.

D040 and `phase4-t16-committed-adapter-plan.md` require exact proof-bearing
stage contracts and a committed preview executable containing no credentials.
PA01 and PA02 are local-only and must return for Sol source review. PA03 live
execution remains blocked until that acceptance. No IAM, deploy, invalidation,
production, DNS, Firebase, or T17 action is authorized.

### Phase 4 T16 HF01

HF01 completed locally from Sol handoff `47b5b24` under Node 24.18.1. The
dependency-free Hosted UI driver now scopes exactly one visible
`form[name="cognitoSignInForm"]`, requires unique visible/enabled username,
password, and submit controls, fills values without retaining them, clicks the
real submit control, and requires a bounded navigation signal with timer
cleanup. It returns only typed checkpoints.

The focused harness suite passed 15/15, covering desktop/mobile responsive
duplicate-form selection, absent/ambiguous forms, missing/disabled controls,
fill/click rejection, bounded no-submit, timer cleanup, canary non-exposure,
and all prior recorder/protected-input cases. Root `npm run check` passed
(web44, core7, schedule-api25, infra19 plus build/synth). No Cognito user,
credential, browser, or AWS operation occurred. HF02 is next; HF03 remains
blocked until HF02 succeeds.

### Phase 4 T16 HF02

HF02 completed read-only from `bb31ef4`. The live Cognito Hosted UI was opened
without filling or submitting at desktop and mobile viewports. Both sanitized
selector checkpoints reported host match, one visible named form, one visible
username/password/submit control, and all three controls enabled. No DOM,
screenshot, text, query, console, network body, credential, or browser state
was retained.

Independent read-only gates matched account `470447451992`, region
`ap-northeast-1`, pool users=0, admins membership=0, and the reserved Oda
object at the protected 501-byte/hash baseline. No AWS write occurred. HF03 is
the next and only authorized execution boundary.

### Phase 4 T16 HF03 stop

The D038/D037 runner was executed exactly once after HF01/HF02. It stopped
before browser authentication and before schedule/data access after the
Cognito setup path; its sanitized result recorded ten bounded Cognito
operations and no auth result. Independent readback verified pool users=0 and
admins membership=0. The protected Oda object remained 501 bytes with its
baseline hash. Temporary runner/material were removed; schedule writes=0,
restore writes=0, and invalidation=0. No raw process arguments, environment,
identifiers, credentials, DOM, or errors were inspected or recorded. This is a
terminal HF03 stop; no retry or further rehearsal action is authorized.

### Phase 4 T16 HF Sol review and committed-coordinator correction

Sol independently reran the focused harness suite (15/15), root `npm run check`,
`git diff --check`, and clean-worktree verification. Identity and reserved-data
cleanup evidence is accepted. HF01/HF03 functional acceptance is withheld:
the claimed desktop/mobile fixture was a repeated locator fake rather than an
actual browser-responsive form, and the HF03 result did not retain a D038 typed
form checkpoint. Review also found the navigation signal can remain unsettled
on early action failure and click failure is misclassified as fill failure.

D039 and `phase4-t16-committed-coordinator-plan.md` require a real Playwright
fixture and a committed dependency-injected rehearsal state machine before one
further thin-adapter execution. No additional live operation is authorized
until PF01/PF02 and the repeated PF03 read-only gates succeed.

### Phase 4 T16 PA02

PA02 is committed locally from `d4329f4`. The preview-only adapter binds the
proof-bearing coordinator to fixed preview constants, generates reserved
`.invalid` identities and strong passwords inside its owning process, and
keeps those values inside closures/injected protected and browser adapters.
Its command boundary permits only the six D037 Cognito operations; the
coordinator result contains no identity, credential, token, body, URL query,
DOM, or raw error material. The executable accepts only the literal
`--execute-preview-rehearsal` flag and has no environment/credential input;
without injected adapters it fails closed with a sanitized category.

The AWS-free adapter/coordinator/real-Chromium suite passed `26/26`.
Injected tests cover fixed constants, exact operation allowlist, auth failure
cleanup, no data after auth failure, update/stale/restore proof ordering,
canary non-exposure, and sanitized unconfigured execution. No executable live
run was performed; no AWS, Cognito, schedule-data, restore, or browser-hosted
operation occurred. PA03 remains blocked pending Sol source review.

### Phase 4 T16 PA Sol review and concrete-final correction

Sol rejects PA02 functional acceptance. `t16-preview-adapter.mjs` is an injected
stub: direct execution has no concrete dependencies and always returns
`adapter-unconfigured`; it implements no AWS CLI, protected filesystem,
Playwright, data, or restore adapter. It also discards AdminCreateUser's internal
Username and incorrectly reuses the alias for later administration, contrary to
D035. Fake tests cannot establish operational readiness.

The operator confirmed historical Firebase data may be discarded. D041 and
`phase4-t16-concrete-final-plan.md` end further Firestore work and split the
remaining proof into a concrete auth-only executable followed, after success,
by the exact preview data/restore executable. CF01 is local-only and must return
for Sol source review before CF02. No additional live action is authorized by
this record.

### Phase 4 T16 PA01

PA01 is implemented locally from Sol handoff `6d275a6`. The coordinator now
requires exact proof objects for every stage: baseline/preflight and setup,
desktop/mobile form and callback proofs, role-specific 200/403 sentinels,
two-context baseline read, one update PUT with new ETag/VersionId, one stale
409 PUT with unchanged current version, public tuple 1, exact restoration, and
zero-user/group cleanup. Resolved no-op or malformed values become typed
`invalid-proof` failures. `failureCheckpoint` is retained independently from
restore and cleanup progress; any marked write activates restoration-first
handling.

Focused AWS-free harness plus real Chromium tests passed `22/22`. Root
`npm run check` is pending the PA01 commit gate. No AWS, Cognito, credential,
schedule-data, or browser-hosted operation occurred.

### Phase 4 T16 CF01

CF01 is implemented locally in `t16-auth-preview.mjs`. The committed
auth-only executable accepts only `--execute-preview-auth`, generates reserved
`.invalid` identities and passwords in-process, uses mode-0700 temporary
storage and mode-0600 protected Cognito JSON, invokes only the fixed AWS CLI
profile/account/region and Cognito operation boundary, validates and retains
the returned internal `Username`, and includes concrete Playwright callback,
signed-in/logout, and admin/non-admin API GET proofs. It has no S3/data write
path and emits only the typed sanitized coordinator result.

The direct fake CLI/browser execution and argv-canary tests passed, including
internal-ID mapping, cleanup, exact role proofs, and no raw result exposure.
The existing real Chromium responsive form fixture remains in the focused
suite. Focused T16 tests passed 28/28; root `npm run check` passed (including
lint, typecheck, unit, infra, and build/synth); `git diff --check` passed. No
AWS, Cognito, browser-hosted, data, S3, Firestore, deployment, or production
operation occurred. CF02 is not authorized pending Sol source review.

### Phase 4 T16 CF01 Sol correction

Sol source review identified concrete-boundary defects in the initial CF01
commit. The auth executable was corrected to start at the CloudFront `/manage`
page and click the localized administrator sign-in control, retain the
pre-login recorder and page-initiated exact API GET response, and require the
real callback, final `/manage`, and translated sign-out sentinel. The API
path is now `/api/v1/stadiums/oda/availability/2026-08`; no direct Hosted UI
authorization URL or `page.request` API probe remains.

Read-only preflight now proves STS account `470447451992`, fixed region,
zero users, and zero `admins` membership using exact `list-users` and
`list-users-in-group` calls. Cleanup attempts every applicable removal,
deletion, readback, and temporary-directory removal independently. The
protected operation helper verifies containment and mode `0600` before each
CLI call and unlinks immediately; generated identities remain closure-only.
Regression fakes cover distinct internal IDs, exact env/CLI boundaries,
internal-ID administration, aliases only at the browser boundary, cleanup
continuation after removal failure, and the sanitized result. No live
operation occurred. Focused T16 tests pass 29/29;
root checks and diff checks remain required before commit.

### Phase 4 T16 CF01 final correction

The coordinator now preserves a primary auth/setup failure separately from a
cleanup failure, reports `cleanup-failed` with a typed sanitized
`cleanupFailure`, and never reports cleanup as passed after a failed cleanup
proof. The direct executable is routed through an injectable `runDirect`
wrapper that prints one sanitized result and sets exit status 0 only for a
typed success; failed results and thrown entry errors set status 1.

Regression coverage includes simultaneous auth and cleanup failures, primary
checkpoint retention, cleanup continuation, and direct success/failure exit
codes. Focused T16 tests pass 31/31 including the real Chromium responsive
fixture. No live AWS or hosted-browser operation occurred.

### Phase 4 T16 CF01 Sol acceptance and CF02 authorization

Sol independently reviewed the concrete source and correction commits through
`5f4922d`, then reran the three auth harness/form/preview files: 27/27 passed,
including real Chromium. The executable now begins at `/manage` to preserve
the real PKCE transaction, observes only the page-initiated exact API GET,
uses returned internal Cognito Usernames for administration, independently
attempts all cleanup actions, preserves simultaneous primary/cleanup failures,
and exits nonzero on any typed failure. It has no S3/data/Firestore path and
accepts no secret argument or environment input. Worktree and diff checks are
clean.

CF01 is accepted. CF02 is authorized exactly once under D041 and
`phase4-t16-concrete-final-plan.md`: repeat the read-only gates, execute only
`t16-auth-preview.mjs --execute-preview-auth`, observe only its sanitized JSON
and exit status, independently prove users/group zero and no S3/data write,
record truthful evidence, and stop. No retry or CF03/T17 work is authorized in
that execution.

### Phase 4 T16 CF02 execution stop

Starting from Sol approval `6056d11`, Node `v24.18.1`, the required focused
T16 suite passed 31/31 and the read-only gates matched account
`470447451992`, region `ap-northeast-1`, pool users 0, `admins` membership 0,
and the live Hosted UI selector (desktop/mobile: one visible Cognito form and
three enabled controls). The protected Oda object matched the 501-byte
baseline, ETag/version identifiers, content type/cache control, and
SHA-256 `ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`.

The committed auth executable was run exactly once with only
`--execute-preview-auth`. Its sole sanitized result was `status: failed`,
`lastCheckpoint: cleanup`, `failureCheckpoint: setup`,
`counts: { operations: 3, writes: 0, restores: 0, cleanups: 1 }`,
`cleanupStatus: passed`, and `failure.category: operation-failed`; no retry
was made. Independent post-run readback proved pool users 0, admins 0, the
same protected object bytes/hash/metadata, and no additional invalidation.
No API PUT, S3 write, Firestore, deployment, IAM, or production operation
occurred. CF02 is a terminal stop; CF03 and T17 remain unauthorized.

### Phase 4 T16 AdminGetUser response-shape recovery authorization

Sanitized top-level CloudTrail names for CF02 show two AdminCreateUser, two
AdminSetUserPassword, AdminAddUserToGroup, and exactly one AdminGetUser before
the cleanup sequence. Source review found the exact local defect: the fake and
validator expected nested `User.Username`, while AWS CLI AdminGetUser returns
top-level `Username`. No raw event/error or identity was inspected.

D042 and `phase4-t16-admin-get-response-plan.md` authorize the exact local
response-shape correction and, after Sol source acceptance, one further
auth-only execution. No data/S3/Firestore/IAM/deploy/invalidation/CF03/T17
operation is authorized.

### Phase 4 T16 CR01 callback initialization race correction

Starting from Sol handoff `3b4e9c5`, `createAdminSession.initialize` now treats
callback processing and signed-in state as newer monotonic state: a late
`getUser()` resolve (null or stale nonnull user) or rejection cannot overwrite
the callback user, destination, token access, or signed-in state. Deferred
tests cover all three interleavings without raw error exposure.

Web focused tests passed 47/47; admin-local Playwright E2E passed 44/44;
root `npm run check` and `git diff --check` passed. No AWS, deployment, or
production operation occurred. CR02 remains blocked pending Sol source review.

### Phase 4 T16 CR01 Sol acceptance and CR02 authorization

Sol reviewed `cec974b`. The monotonic guard preserves callback-authenticated
state against late null, stale-user, and rejected initialization, with deferred
tests proving token and destination retention. CR01 is accepted.

CR02 may push the migration branch and dispatch the existing exact-SHA-pinned
`Deploy preview web` workflow once. It builds with the reviewed Cognito/API
configuration and deploys web objects only. Data, CloudFormation, IAM, and
invalidation are forbidden. Require workflow validation/deploy/raw-preview
success and unchanged data/invalidation inventories before CR03.

### Phase 4 T16 CR02 preview web-only deployment

The migration branch was pushed at reviewed SHA `2765c09`, and GitHub Actions
run `31437886126` completed successfully. Its validation job passed repository
checks and production-browser checks; its deployment job built the reviewed
web, deployed web objects only, and passed the raw preview checks. The run was
exact-SHA pinned to `2765c097d80400a71e1dde2bb2084597b9b04da9`.

Post-run read-only verification confirmed the protected data object remained
501 bytes with ETag `"b2591d35e23ac1b9f2a133f71198b953"` and VersionId
`wQ1b5EEu1Qzrw93GyN9_bPNtxwaZ5VAE`. The distribution still has only the three
historical targeted invalidations from 2026-07-31; CR02 created no invalidation.
No data, CloudFormation, IAM, Cognito administration, Firebase, DNS, or
production operation occurred. CR02 is accepted and CR03 may run once under
the existing auth-only stop conditions.

### Phase 4 T16 AG01 AdminGetUser response correction

Starting from Sol handoff `4de0055`, AG01 changed only the concrete
AdminGetUser validation to require an exact nonempty top-level `Username`
matching the requested internal Username. The fake now models the AWS CLI
shape and regression coverage includes valid, missing, nested-only, empty,
and mismatched responses. Each invalid response retains a sanitized setup
failure while attempting both identity deletions, both final readbacks, and
temporary-directory removal.

Focused auth/Chromium tests passed 32/32; root `npm run check` and
`git diff --check` passed. No AWS or hosted-browser live operation occurred.
AG02 remains blocked pending Sol source review.

### Phase 4 T16 AG01 Sol acceptance and AG02 authorization

Sol reviewed `70ea153`: the production and fake contracts now both require the
exact top-level Username, and all four invalid shapes clean both identities and
return sanitized setup failure. The correction is limited to D042; source and
worktree checks are clean. AG01 is accepted.

AG02 may execute the corrected auth-only program exactly once after the same
zero/baseline gates. Observe only sanitized result/exit status and independent
final counts. No retry, data/S3/Firestore/IAM/deploy/invalidation/CF03/T17
operation is authorized in that execution.

### Phase 4 T16 AG02 execution stop

Starting from Sol approval `961d8b6`, Node `v24.18.1`, focused auth/Chromium
tests passed 32/32. Read-only gates matched account `470447451992`, region
`ap-northeast-1`, pool users 0, `admins` membership 0, and the live desktop /
mobile Hosted UI selector. The protected Oda object matched the 501-byte
baseline, ETag/version identifiers, content type/cache control, and SHA-256
`ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`.

The corrected auth executable ran exactly once with only
`--execute-preview-auth`. Its sole sanitized result was `status: failed`,
`lastCheckpoint: cleanup`, `failureCheckpoint: admin-form`,
`roleOutcomes.admin: failed`, `counts: { operations: 4, writes: 0,
restores: 0, cleanups: 1 }`, `cleanupStatus: passed`, and
`failure.category: operation-failed`; exit status was nonzero and no retry was
made. Independent post-run readback proved pool users 0, admins 0, the exact
protected object bytes/hash/metadata, and no additional invalidation. No API
PUT, S3 write, Firestore, IAM, deployment, or production operation occurred.
AG02 is a terminal stop; CF03 and T17 remain unauthorized.

### Phase 4 T16 asynchronous Hosted UI redirect recovery authorization

Sanitized event names for AG02 show complete Cognito setup, authorize/login GET,
no login POST, and complete cleanup. A no-user diagnostic returned
`form-ambiguous`; a no-submit staged check then proved the form lookup occurred
immediately after the application login click while the page was still on
`/manage`. OIDC redirect starts asynchronously. No raw auth material was read.

D043 and `phase4-t16-hosted-ui-redirect-plan.md` authorize the exact bounded
Hosted UI URL gate, local tests, and after Sol acceptance one auth-only HU02
execution. No data/S3/Firestore/IAM/deploy/invalidation/CF03/T17 action is
authorized.

### Phase 4 T16 HU01 Hosted UI redirect gate correction

Starting from Sol handoff `40fc07f`, HU01 factored the exported bounded
`awaitHostedUiLogin` boundary. It clicks the exact localized administrator
login control from CloudFront `/manage`, then waits without a fixed sleep for
the exact Cognito host and `/login` path before the form driver can run.
Recorder/API listener setup, PKCE application entry, cleanup, and sanitization
remain unchanged. Delayed, wrong-path, and timeout fakes prove that form access
cannot occur before the URL gate and failures remain sanitized.

Focused auth/Chromium tests passed 33/33; root `npm run check` and
`git diff --check` passed. No AWS or live Hosted UI execution occurred.
HU02 remains blocked pending Sol source review.

### Phase 4 T16 SI01 signed-in sentinel correction

Starting from Sol handoff `dee70ac`, SI01 replaced the immediate logout
locator count with the exported bounded `awaitSignedInSentinel` visibility
wait (`state: visible`, exact timeout). Delayed hydration success and timeout
tests prove the wait is deterministic, has no fixed sleep, and returns only
the typed `signed-in-missing` substage without raw material. Existing API,
auth, recorder, and cleanup behavior remains unchanged.

Focused auth/Chromium tests passed 36/36; root `npm run check` and
`git diff --check` passed. No AWS or live Hosted UI execution occurred.
SI02 remains blocked pending Sol source review.

### Phase 4 T16 SI02 execution stop

Starting from Sol approval `741158c`, Node `v24.18.1`, focused auth/Chromium
tests passed 36/36. Read-only gates matched account `470447451992`, region
`ap-northeast-1`, pool users 0, `admins` membership 0, live desktop/mobile
Hosted UI selector counts, and the protected Oda 501-byte baseline with exact
metadata and SHA-256
`ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`.

The hydrated-sentinel auth executable ran exactly once with only
`--execute-preview-auth`. Its sole sanitized result was `status: failed`,
`lastCheckpoint: cleanup`, `failureCheckpoint: admin-form`,
`roleOutcomes.admin: failed`, `failure: { stage: "admin-form",
category: "signed-in-missing", viewport: "desktop" }`,
`counts: { operations: 4, writes: 0, restores: 0, cleanups: 1 }`, and
`cleanupStatus: passed`; exit status was nonzero and no retry was made.
Independent post-run readback proved pool users 0, admins 0, the exact
protected object bytes/hash/metadata, and no additional invalidation. No API
PUT, S3 write, Firestore, IAM, deployment, or production operation occurred.
SI02 is a terminal stop; CF03 and T17 remain unauthorized.

### Phase 4 T16 callback initialization race authorization

SI02 retains successful Cognito authentication, callback, and final `/manage`
but no signed-in state or API request after a full bounded wait. Source review
found `useAdminSession()` starts `initialize()` before the callback page mounts;
its late null/error result can overwrite the newer callback state. D046 and
`phase4-t16-callback-race-plan.md` authorize the monotonic local session fix,
one web-only preview deployment after Sol review, and one subsequent auth-only
run. No data/S3/Firestore/IAM/CloudFormation/invalidation/CF03/T17 action is
authorized.

### Phase 4 T16 SI01 Sol acceptance and SI02 authorization

Sol reviewed `edf0a06`. The final `/manage` session proof now awaits the exact
localized logout control with a bounded visible wait; delayed hydration and
typed timeout are covered. SI01 is accepted. SI02 may run the auth-only program
once after the same gates. No retry or data/S3/Firestore/IAM/deploy/
invalidation/CF03/T17.

### Phase 4 T16 browser-substage recovery authorization

Delayed top-level evidence for HU02 shows successful CognitoAuthentication and
no Lambda request, while the coordinator retained only generic `admin-form`.
Source review confirms the lazy role adapter performs callback, signed-in, and
API checks inside that first call, flattening every later failure. No raw event,
DOM, network body, credential, or error was inspected.

D044 and `phase4-t16-browser-substage-plan.md` authorize allowlisted sanitized
substage categories, local tests, and after Sol acceptance one auth-only BS02
execution. No data/S3/Firestore/IAM/deploy/invalidation/CF03/T17 action is
authorized.

### Phase 4 T16 BS01 sanitized browser substage correction

Starting from Sol handoff `4df6b2c`, BS01 added the exact typed browser
substage failure boundary. Form checkpoints, callback-missing,
manage-timeout, signed-in-missing, API-response-missing, and
API-status-unexpected are retained only with `desktop` or `mobile` viewport;
raw error messages, DOM, URL, and status material are discarded. Production
browser-role checks now assign these typed failures, and injected coverage
passes all allowlisted categories without canary leakage.

Focused auth/Chromium tests passed 35/35; root `npm run check` and
`git diff --check` passed. No AWS or live Hosted UI execution occurred.
BS02 remains blocked pending Sol source review.

### Phase 4 T16 BS02 execution stop

Starting from Sol approval `a3bbfb1`, Node `v24.18.1`, focused auth/Chromium
tests passed 35/35. Read-only gates matched account `470447451992`, region
`ap-northeast-1`, pool users 0, `admins` membership 0, live desktop/mobile
Hosted UI selector counts, and the protected Oda 501-byte baseline with exact
metadata and SHA-256
`ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`.

The typed-substage auth executable ran exactly once with only
`--execute-preview-auth`. Its sole sanitized result was `status: failed`,
`lastCheckpoint: cleanup`, `failureCheckpoint: admin-form`,
`roleOutcomes.admin: failed`, `failure: { stage: "admin-form",
category: "signed-in-missing", viewport: "desktop" }`,
`counts: { operations: 4, writes: 0, restores: 0, cleanups: 1 }`, and
`cleanupStatus: passed`; exit status was nonzero and no retry was made.
Independent post-run readback proved pool users 0, admins 0, the exact
protected object bytes/hash/metadata, and no additional invalidation. No API
PUT, S3 write, Firestore, IAM, deployment, or production operation occurred.
BS02 is a terminal stop; CF03 and T17 remain unauthorized.

### Phase 4 T16 signed-in hydration recovery authorization

BS02's typed evidence proves successful form/authentication/callback/final
`/manage` and stops at the immediate logout-control count. Source review found
the check runs before Nuxt/Vue hydration and session rendering can complete.
D045 and `phase4-t16-signed-in-wait-plan.md` authorize only a bounded visible
sentinel wait, local tests, and after Sol acceptance one auth-only SI02 run.
No data/S3/Firestore/IAM/deploy/invalidation/CF03/T17 action is authorized.

### Phase 4 T16 BS01 Sol acceptance and BS02 authorization

Sol reviewed `e9bc20c`. Browser failures now retain only the exact allowlisted
category and desktop/mobile viewport, while raw errors and browser material are
discarded. Working login behavior is unchanged. BS01 is accepted.

BS02 may execute the auth-only program exactly once after the same gates. A
success must prove all four roles; a failure must return the typed substage and
clean to zero. No retry or data/S3/Firestore/IAM/deploy/invalidation/CF03/T17.

### Phase 4 T16 HU02 execution stop

Starting from Sol approval `bcdc2b7`, Node `v24.18.1`, focused auth/Chromium
tests passed 34/34. Read-only gates matched account `470447451992`, region
`ap-northeast-1`, pool users 0, `admins` membership 0, live desktop/mobile
Hosted UI selector counts, and the protected Oda 501-byte baseline with exact
metadata and SHA-256
`ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`.

The awaited redirect-gated auth executable ran exactly once with only
`--execute-preview-auth`. Its sole sanitized result was `status: failed`,
`lastCheckpoint: cleanup`, `failureCheckpoint: admin-form`,
`roleOutcomes.admin: failed`, `counts: { operations: 4, writes: 0,
restores: 0, cleanups: 1 }`, `cleanupStatus: passed`, and
`failure.category: operation-failed`; exit status was nonzero and no retry was
made. Independent post-run readback proved pool users 0, admins 0, the exact
protected object bytes/hash/metadata, and no additional invalidation. No API
PUT, S3 write, Firestore, IAM, deployment, or production operation occurred.
HU02 is a terminal stop; CF03 and T17 remain unauthorized.

### Phase 4 T16 HU01 Sol acceptance and HU02 authorization

Sol reviewed `dbb00e1`. Production now awaits the exact Hosted UI URL gate
before invoking the form driver, and the integration fake proves the delayed
`click -> gate -> form` order. The application-started PKCE transaction and all
existing security/cleanup boundaries are preserved. HU01 is accepted.

HU02 may execute the corrected auth-only program exactly once after the same
zero/baseline gates. No retry, data/S3/Firestore/IAM/deploy/invalidation/
CF03/T17 operation is authorized in that execution.

### Phase 4 T16 HU01 Sol correction

Sol review found the production role path invoked the redirect gate without
awaiting it, so form driving could still race the asynchronous Hosted UI
navigation. HU01 now routes production through the exported
`runBrowserRoleSession`, which explicitly awaits the exact-host/path gate
before invoking the form driver. An integration-level delayed fake proves the
ordering `click`, URL gate, then form driver; the existing real Chromium
fixture remains covered.

Focused auth/Chromium tests passed 34/34; root `npm run check` and
`git diff --check` passed. No AWS or live Hosted UI execution occurred.
HU02 remains blocked pending Sol source review.

### Phase 4 T16 CR03 execution stop

Starting from Sol approval `acc72ca48b6f82677cfab3abe0f03f634a1f63ab`, Node
`v24.18.1`, focused auth/Chromium tests passed 36/36 and root `npm run check`
passed. Read-only gates matched account `470447451992`, region
`ap-northeast-1`, pool users 0, `admins` membership 0, and the live desktop
and mobile Hosted UI selector each returned one visible form with three
controls. The protected Oda object baseline was 501 bytes, ETag
`"b2591d35e23ac1b9f2a133f71198b953"`, VersionId
`wQ1b5EEu1Qzrw93GyN9_bPNtxwaZ5VAE`, SHA-256
`ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`, and
the exact content type/cache metadata. CloudFront invalidation count was 3.

The committed auth-only executable ran exactly once with
`--execute-preview-auth`; its sanitized result was `status: failed`,
`lastCheckpoint: cleanup`, `failureCheckpoint: admin-form`,
`roleOutcomes.admin: failed`, `roleOutcomes.non-admin: not-run`,
`counts: { operations: 4, writes: 0, restores: 0, cleanups: 1 }`,
`failure: { stage: admin-form, category: signed-in-missing, viewport: desktop }`,
`cleanupStatus: passed`, and `cleanupFailure: null`. Exit status was nonzero;
no retry was made. Because the admin role failed at the signed-in UI
substage, the non-admin and remaining viewport proofs were not reached.

Independent post-run readback proved pool users 0 and `admins` membership 0.
The protected object remained 501 bytes with the same ETag, VersionId,
content type, cache metadata, and SHA-256. CloudFront invalidation count
remained 3. No API PUT, S3 write, Firestore, IAM, deployment, or production
operation occurred. CR03 is a terminal stop; no corrective implementation or
retry is authorized, and CF03/T17 remain unauthorized.

### Phase 4 T16 CR03 Sol review and callback ownership plan

Sol accepted the sanitized CR03 evidence in `5ee95eb`: the single execution
stopped at desktop `signed-in-missing`, cleanup read back zero users and zero
admins, and the protected data and invalidation inventories were unchanged.

Source review found the callback page still invokes the composable's automatic
normal `getUser()` restoration before its mounted callback. D047 and
`phase4-t16-callback-ownership-plan.md` authorize CO01 to separate those page
lifecycles locally. No AWS operation or live auth retry is authorized in CO01.

### Phase 4 T16 CO01 callback ownership correction

Starting from Sol handoff `b204c5a37b769f2505ab3acf239a20cc012e25a8`, Node
`v24.18.1`, CO01 made session restoration an explicit page responsibility.
`useAdminSession` now accepts an initialization option; `/manage/callback`
obtains the shared in-memory session with initialization disabled and invokes
only the OIDC callback, while normal `/manage` uses the default restoration.
No raw URL route detection, token persistence, PKCE, safe return-path,
sanitized-error, D046 guard, or logout behavior was changed.

The deterministic admin-local Playwright suite passed 46/46 across Japanese
desktop and English mobile. The new lifecycle proof observed zero
`getUser` restoration calls while callback was mounted, callback success
reached the safe `/manage` destination, and normal manage mounting performed
bounded restoration (including a second explicit manage mount). Existing
callback success/failure/hostile-return, signed-in/signed-out, lifecycle,
PKCE, API, and no-secret tests remained passing. Focused web unit tests passed
47/47; root `npm run check` and `git diff --check` passed. No AWS, live auth,
deployment, invalidation, IAM, API/S3/Firestore write, production, or T17
operation occurred.

### Phase 4 T16 CO01 Sol acceptance and CO02 authorization

Sol reviewed `eefbeba`. The callback page now suppresses only normal session
restoration while retaining the shared in-memory session and invoking the OIDC
callback; normal `/manage` continues explicit restoration. D046, PKCE, safe
return-path validation, sanitized errors, logout, and memory-only tokens remain
unchanged. The lifecycle E2E proves zero callback restoration calls and normal
manage restoration. Sol also reran the focused session tests (11/11).

CO01 is accepted. CO02 may push this exact reviewed revision and dispatch the
existing exact-SHA web-only workflow once. Data, CloudFormation, IAM, Cognito
administration, and invalidation remain forbidden. Require workflow success and
unchanged protected data/invalidation inventories before CO03.

### Phase 4 T16 CO02 validation-runner stop and replacement authorization

Exact-SHA workflow run `31439784561` stopped before the deploy job. Repository
checks passed, but the external legacy Firebase compatibility suite's Chromium
process received SIGSEGV while opening `/yumenoshima`; 13 other routes passed.
This was a browser-process crash, not an assertion or application failure. The
deploy job was skipped, and read-only verification confirmed the protected
object and invalidation count 3 were unchanged.

Because no AWS write occurred and the failure was an isolated runner/browser
crash against the unchanged external legacy site, Sol authorizes one replacement
dispatch of the same reviewed source. All CO02 write boundaries remain exact;
another validation failure must stop without deployment or further retry.

### Phase 4 T16 CO02 preview deployment acceptance

Replacement exact-SHA workflow run `31439952408` at `f20417c` completed
successfully. Repository checks, production-browser checks, the web-only
deployment, and raw preview checks all passed. Post-run read-only verification
confirmed the protected object remained 501 bytes with ETag
`"b2591d35e23ac1b9f2a133f71198b953"` and VersionId
`wQ1b5EEu1Qzrw93GyN9_bPNtxwaZ5VAE`; invalidation count remained 3.

No data, CloudFormation, IAM, Cognito administration, invalidation, Firebase,
DNS, or production operation occurred. CO02 is accepted. CO03 may execute the
committed auth-only executable once under its exact setup, cleanup, zero-write,
and protected-object gates.

### Phase 4 T16 CO03 auth-only confirmation stop

Starting from Sol handoff `b74f2c040891bef637eb240639f61b8c1a8a9438`, Node
`v24.18.1`, focused web unit tests passed 47/47, admin-local Playwright passed
46/46 across Japanese desktop and English mobile, and root `npm run check`
passed. Read-only gates matched account `470447451992`, region
`ap-northeast-1`, pool users 0, `admins` membership 0, and the live desktop
and mobile Hosted UI selector each returned one visible form with three
controls. The protected Oda object baseline was 501 bytes, ETag
`"b2591d35e23ac1b9f2a133f71198b953"`, VersionId
`wQ1b5EEu1Qzrw93GyN9_bPNtxwaZ5VAE`, SHA-256
`ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`, and
the exact content type/cache metadata. CloudFront invalidation count was 3.

The committed auth-only executable ran exactly once with
`--execute-preview-auth`; its sanitized result was `status: failed`,
`lastCheckpoint: cleanup`, `failureCheckpoint: admin-form`,
`roleOutcomes.admin: failed`, `roleOutcomes.non-admin: not-run`,
`counts: { operations: 4, writes: 0, restores: 0, cleanups: 1 }`,
`failure: { stage: admin-form, category: signed-in-missing, viewport: desktop }`,
`cleanupStatus: passed`, `cleanupFailure: null`, and
`restoreStatus: not-required`. Exit status was nonzero; no retry was made.
Because the admin role failed at the signed-in UI substage, the non-admin and
remaining viewport proofs were not reached.

Independent post-run readback proved pool users 0 and `admins` membership 0.
The protected object remained 501 bytes with the same ETag, VersionId, content
type, cache metadata, and SHA-256. CloudFront invalidation count remained 3.
No API PUT, S3 write, Firestore, IAM, CloudFormation, deployment, production,
DNS, Firebase, or data rehearsal operation occurred. CO03 is a terminal stop;
CF03/T17 remain unauthorized.

### Phase 4 T16 CO03 Sol review and OAuth status plan

Sol accepted `9220795` as a safe terminal stop: one execution, cleanup zero,
zero data writes, protected object unchanged, and invalidation count 3. Source
review found the current evidence cannot distinguish callback rejection from a
successful token exchange followed by lost session state because both paths
end at `/manage`.

D048 and `phase4-t16-oauth-status-plan.md` authorize OS01 local-only sanitized
OAuth status classification. No AWS operation or live authentication is
authorized until Sol reviews that implementation.

### Phase 4 T16 OS01 OAuth status classification

Starting from Sol handoff `22cbb4cf256200b8eee5b617107d70823c46b80d`, Node
`v24.18.1`, OS01 extends the sanitized browser recorder with exact method and
status fields when available and adds deterministic OAuth status classification.
Only the exact preview CloudFront host, exact Hosted UI host, and exact
regional Cognito issuer host are accepted. Discovery and token endpoint
pathnames are exact; the classifier distinguishes discovery missing/rejected,
token endpoint missing/rejected, token success followed by missing session,
and existing API response states. Final browser failures remain category plus
viewport only; no event trail is returned.

Focused auth/harness tests passed 38/38, including canary tests proving query,
fragment, headers, bodies, credentials, and token material are neither read
nor retained by the recorder/classifier. Root `npm run check` and
`git diff --check` passed. No AWS, live auth, deployment, IAM, CloudFormation,
API/S3/Firestore write, production, or T17 operation occurred. OS01 is ready
for Sol source review; OS02 remains unauthorized.

### Phase 4 T16 OS01 Sol acceptance and OS02 authorization

Sol reviewed `0446f9a`. The recorder retains only exact allowlisted host,
pathname, method, and status; its typed result contains only one category and
viewport. Canary tests prove query, fragment, headers, body, credential, token,
claim, console, raw error, and the event trail are absent. Sol reran the focused
harness/executable tests (33/33).

OS01 is accepted. OS02 may run the unchanged auth-only executable once with
the new local classifier and all existing exact account/resource, cleanup-zero,
zero-data-write, protected-object, and invalidation gates. Stop after the typed
result; no source fix, retry, deployment, or data rehearsal is authorized.

### Phase 4 T16 OS02 result and token-request plan

OS02 commit `48ff929` records one safe execution ending at desktop
`oauth-token-endpoint-missing`. Cleanup read back zero users/admins; protected
data and invalidation count 3 were unchanged, and no data write occurred.

Discovery succeeded, but response-only evidence cannot distinguish a token
request that never started from a request that failed before a response. D049
and `phase4-t16-token-request-plan.md` authorize TRQ01 local-only classification.
No AWS operation or live authentication is authorized in TRQ01.

### Phase 4 T16 OS02 diagnostic auth-only execution stop

Starting from Sol handoff `1b79174665cb51a0e8178f7609c7b5b455d76696`, Node
`v24.18.1`, focused auth/harness tests passed 38/38 and root `npm run check`
passed. Read-only gates matched account `470447451992`, region
`ap-northeast-1`, pool users 0, `admins` membership 0, and the live desktop
and mobile Hosted UI selector each returned one visible form with three
controls. The protected Oda object baseline was 501 bytes, ETag
`"b2591d35e23ac1b9f2a133f71198b953"`, VersionId
`wQ1b5EEu1Qzrw93GyN9_bPNtxwaZ5VAE`, SHA-256
`ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`, and
the exact content type/cache metadata. CloudFront invalidation count was 3.

The unchanged auth-only executable ran exactly once with
`--execute-preview-auth`; its sanitized result was `status: failed`,
`lastCheckpoint: cleanup`, `failureCheckpoint: admin-form`,
`roleOutcomes.admin: failed`, `roleOutcomes.non-admin: not-run`,
`counts: { operations: 4, writes: 0, restores: 0, cleanups: 1 }`,
`failure: { stage: admin-form, category: oauth-token-endpoint-missing, viewport: desktop }`,
`cleanupStatus: passed`, `cleanupFailure: null`, and
`restoreStatus: not-required`. Exit status was nonzero; no retry or source fix
was made. Because the admin role failed at the signed-in UI substage, the
non-admin and remaining viewport proofs were not reached.

Independent post-run readback proved pool users 0 and `admins` membership 0.
The protected object remained 501 bytes with the same ETag, VersionId, content
type, cache metadata, and SHA-256. CloudFront invalidation count remained 3.
No API PUT, S3 write, Firestore, IAM, CloudFormation, deployment, production,
DNS, Firebase, or data rehearsal operation occurred. OS02 is a terminal stop;
CF03/T17 remain unauthorized.

### Phase 4 T16 TRQ01 token request classification

Starting from Sol handoff `a0557ed268f66e11c11dd9f897a6e22c9408cc6a`, Node
`v24.18.1`, TRQ01 extends the sanitized recorder to observe only exact POST
requests to the allowlisted token endpoint, Playwright request-failed presence,
and response status. Callback navigation stores only `codePresent` and
`statePresent` booleans for the exact callback pathname. Request failure text,
query values, headers, bodies, credentials, tokens, claims, console text, and
raw errors are never retained or emitted.

Typed categories now distinguish callback parameter missing, token request not
started, token request failed before response, token response rejected, and
token success/session missing, while preserving existing discovery/API
categories. Focused auth/harness tests passed 39/39, including hostile-canary
request/requestfailed and callback-query tests. Root `npm run check` and
`git diff --check` passed. No AWS, live auth, deployment, API/S3/Firestore
write, IAM, CloudFormation, production, or T17 operation occurred. TRQ01 is
ready for Sol source review; TRQ02 remains unauthorized.

### Phase 4 T16 TRQ01 Sol acceptance and TRQ02 authorization

Sol reviewed `d3953d6`. Exact callback code/state presence is reduced to two
booleans; exact token POST request/requestfailed observations retain no failure
text, URL query, headers, or body. The final result remains category plus
viewport and excludes the event trail. Hostile-canary coverage and the focused
39/39 result are accepted.

TRQ02 may run the auth-only executable once under all existing exact gates.
Stop after the typed result with cleanup zero and unchanged protected data and
invalidations. No retry, source fix, deployment, or data rehearsal is authorized.

### Phase 4 T16 TRQ02 result and transaction-state plan

TRQ02 commit `ca78738` records one safe execution ending at desktop
`token-request-not-started`. Callback code/state were present and discovery
succeeded; cleanup read back zero, protected data was unchanged, invalidation
count remained 3, and data writes remained zero.

D050 and `phase4-t16-transaction-state-plan.md` authorize TS01 local-only
matching-transaction presence classification. No AWS/live auth is authorized
until Sol reviews it.

### Phase 4 T16 TRQ02 request-status auth-only execution stop

Starting from Sol handoff `bac80af1365e1511c1b0c7101f1c326ed9e770b9`, Node
`v24.18.1`, focused auth/harness tests passed 39/39 and root `npm run check`
passed. Read-only gates matched account `470447451992`, region
`ap-northeast-1`, pool users 0, `admins` membership 0, and the live desktop
and mobile Hosted UI selector each returned one visible form with three
controls. The protected Oda object baseline was 501 bytes, ETag
`"b2591d35e23ac1b9f2a133f71198b953"`, VersionId
`wQ1b5EEu1Qzrw93GyN9_bPNtxwaZ5VAE`, SHA-256
`ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`, and
the exact content type/cache metadata. CloudFront invalidation count was 3.

The unchanged auth-only executable ran exactly once with
`--execute-preview-auth`; its sanitized result was `status: failed`,
`lastCheckpoint: cleanup`, `failureCheckpoint: admin-form`,
`roleOutcomes.admin: failed`, `roleOutcomes.non-admin: not-run`,
`counts: { operations: 4, writes: 0, restores: 0, cleanups: 1 }`,
`failure: { stage: admin-form, category: token-request-not-started, viewport: desktop }`,
`cleanupStatus: passed`, `cleanupFailure: null`, and
`restoreStatus: not-required`. Exit status was nonzero; no retry or source fix
was made. Because the admin role failed at the signed-in UI substage, the
non-admin and remaining viewport proofs were not reached.

Independent post-run readback proved pool users 0 and `admins` membership 0.
The protected object remained 501 bytes with the same ETag, VersionId, content
type, cache metadata, and SHA-256. CloudFront invalidation count remained 3.
No API PUT, S3 write, Firestore, IAM, CloudFormation, deployment, production,
DNS, Firebase, or data rehearsal operation occurred. TRQ02 is a terminal stop;
CF03/T17 remain unauthorized.

### Phase 4 T16 TS01 transaction-state probe

TS01 was implemented locally from Sol handoff `aa6b71318ffd5ab6b9027006bd82259ac83e8f62`.
The auth-only Playwright role installs a pre-document probe before navigation,
and the probe is bounded to the exact preview origin and `/manage/callback`
pathname. It transiently parses only whether the callback has a state parameter
and checks the exact `oidc.`-prefixed session-storage property without reading a
stored value or enumerating keys. The result is immediately reduced to the
typed categories `matching-transaction-present` or
`matching-transaction-missing`; no state, key, query, token, header, body, or
raw error is retained or emitted.

Focused auth/harness/preview/form/adapter tests passed 41/41, including real
Chromium and hostile storage canaries proving the probe runs before document
application code and does not call `getItem` or `key`. `npm run check` passed
(workspace lint, typecheck, unit, infra, and build checks), and
`git diff --check` passed. No AWS or live auth execution was performed; TS01
does not authorize a live run.

### Phase 4 T16 TS01 Sol acceptance and TS02 authorization

Sol reviewed `d38ce4c`. The exact callback probe runs before application code,
uses only own-property presence for the transient callback state key, never
reads storage content or enumerates keys, and reduces the result to one typed
category. Real-Chromium and hostile-canary coverage passed 41/41.

TS01 is accepted. TS02 may run auth-only once with all existing exact gates.
Stop after the typed result, require cleanup zero and unchanged protected data
and invalidations, and do not retry, fix source, deploy, or rehearse data.

### Phase 4 T16 TS02 transaction-state auth-only execution stop

Starting from Sol handoff `f41d3426831a934c28137655f82e20b5599c33b0`, Node
`v24.18.1`, all focused/root/diff gates passed. Read-only preflight matched
account `470447451992`, region `ap-northeast-1`, pool users 0, `admins`
membership 0, the exact preview CloudFront/Hosted UI resources, and the live
`/manage`-initiated Hosted UI selector (desktop/mobile: one visible form with
three controls each). The protected Oda object baseline was 501 bytes, ETag
`"b2591d35e23ac1b9f2a133f71198b953"`, VersionId
`wQ1b5EEu1Qzrw93GyN9_bPNtxwaZ5VAE`, SHA-256
`ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`, and
the exact content type/cache metadata. CloudFront invalidation count was 3.

The committed auth-only executable ran exactly once with
`--execute-preview-auth`. Its sanitized result was `status: failed`,
`lastCheckpoint: cleanup`, `failureCheckpoint: admin-form`,
`roleOutcomes.admin: failed`, `roleOutcomes.non-admin: not-run`,
`counts: { operations: 4, writes: 0, restores: 0, cleanups: 1 }`,
`failure: { stage: admin-form, category: matching-transaction-present, viewport: desktop }`,
`cleanupStatus: passed`, `cleanupFailure: null`, and
`restoreStatus: not-required`. Exit status was nonzero; no retry or source fix
was made. The remaining role/viewport proofs were not reached after the
bounded admin failure.

Independent post-run readback proved pool users 0 and `admins` membership 0.
The protected object remained 501 bytes with the same ETag, VersionId, content
type, cache metadata, and SHA-256. CloudFront invalidation count remained 3.
No API PUT, S3 write, Firestore, IAM, CloudFormation, deployment, production,
DNS, Firebase, or data rehearsal operation occurred. TS02 is a terminal stop;
no further transaction-state execution or T17 is authorized here.

### Phase 4 T16 TS02 result and redirect-callback plan

TS02 commit `080ccfc` records one safe execution ending at desktop
`matching-transaction-present`. Cleanup read back zero users/admins, protected
data and invalidation count 3 were unchanged, and data writes remained zero.

With callback code/state, discovery, and matching transaction all present but
no token POST, D051 and `phase4-t16-redirect-callback-plan.md` authorize RDC01
to replace generic callback dispatch with the exact redirect callback locally.
No AWS/live auth is authorized in RDC01.

### Phase 4 T16 RDC01 redirect-only callback correction

RDC01 was implemented locally from Sol handoff
`e0b8ae8c0329ca29018230261f77774551aa95ec` with no AWS or live-auth action.
The production OIDC adapter now calls only
`UserManager.signinRedirectCallback(url)` at the existing semantic
`signinCallback` port boundary. The generic callback dispatcher is not
invoked. Existing Authorization Code + PKCE settings, sessionStorage
transaction state, in-memory user storage, safe return-path validation,
sanitized errors, transaction cleanup, scopes, and logout behavior are
unchanged.

The exact port unit test proves redirect callback invocation with the callback
URL and proves the generic `signinCallback` method is never called. Focused web
unit tests passed 48 tests, admin-local Playwright passed 46 tests across the
desktop/mobile localized projects, `npm run check` passed, and
`git diff --check` passed. No token persistence or dependency was added.

### Phase 4 T16 RDC01 Sol acceptance and RDC02 authorization

Sol reviewed `d1c15d3`. The production port invokes the exact redirect callback
API and the test proves the generic dispatcher is never called. All D012 OAuth,
PKCE, storage, session, and sanitization boundaries remain unchanged. RDC01 is
accepted.

RDC02 may push the exact reviewed revision and dispatch the existing web-only
workflow once. Data, CloudFormation, IAM, Cognito administration, and
invalidation are forbidden. Require all jobs and raw preview checks plus
unchanged protected data/invalidation before RDC03.

### Phase 4 T16 RDC02 preview deployment acceptance

Exact-SHA workflow run `31443670161` at `4d95d43` completed successfully:
repository and production-browser checks, web-only deploy, and raw preview
checks all passed. The protected object remained 501 bytes with ETag
`"b2591d35e23ac1b9f2a133f71198b953"` and VersionId
`wQ1b5EEu1Qzrw93GyN9_bPNtxwaZ5VAE`; invalidation count remained 3.

No data, CloudFormation, IAM, Cognito administration, invalidation, Firebase,
DNS, or production operation occurred. RDC02 is accepted and RDC03 may run the
auth-only executable once under all existing exact gates.

### Phase 4 T16 RDC03 result and callback-error plan

RDC03 commit `aaa847e` records one safe execution still ending at desktop
`matching-transaction-present`. Cleanup was zero; protected data and three
invalidations were unchanged; data writes remained zero. Direct redirect
callback dispatch therefore did not resolve the pre-token failure.

D052 and `phase4-t16-callback-error-plan.md` authorize CET01 local-only fixed
callback exception taxonomy. No AWS/live auth is authorized in CET01.

### Phase 4 T16 RDC03 redirect-callback auth-only confirmation stop

Starting from Sol handoff `19469e5e173c7b165c55a56f25cb52c2781ea993`, Node
`v24.18.1`, focused auth/web tests, root `npm run check`, and
`git diff --check` passed. Read-only preflight matched account
`470447451992`, region `ap-northeast-1`, pool users 0, `admins` membership 0,
the exact preview resources, and the real `/manage`-initiated Hosted UI
selector (desktop/mobile: one visible form with three controls each). The
protected Oda object baseline was 501 bytes, ETag
`"b2591d35e23ac1b9f2a133f71198b953"`, VersionId
`wQ1b5EEu1Qzrw93GyN9_bPNtxwaZ5VAE`, SHA-256
`ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`, and
the exact content type/cache metadata. CloudFront invalidation count was 3.

The committed auth-only executable ran exactly once with
`--execute-preview-auth`. Its sanitized result was `status: failed`,
`lastCheckpoint: cleanup`, `failureCheckpoint: admin-form`,
`roleOutcomes.admin: failed`, `roleOutcomes.non-admin: not-run`,
`counts: { operations: 4, writes: 0, restores: 0, cleanups: 1 }`,
`failure: { stage: admin-form, category: matching-transaction-present, viewport: desktop }`,
`cleanupStatus: passed`, `cleanupFailure: null`, and
`restoreStatus: not-required`. Exit status was nonzero; no retry or source fix
was made. The remaining role/viewport proofs were not reached after the
bounded admin failure.

Independent post-run readback proved pool users 0 and `admins` membership 0.
The protected object remained 501 bytes with the same ETag, VersionId, content
type, cache metadata, and SHA-256. CloudFront invalidation count remained 3.
No API PUT, S3 write, Firestore, IAM, CloudFormation, deployment, production,
DNS, Firebase, or data rehearsal operation occurred. RDC03 is a terminal stop;
no retry or further auth-only run is authorized.

### Phase 4 T16 RDC03 Sol acceptance and CET01 authorization

Sol accepted RDC03 at `aaa847e`. The redirect-only callback still reached the
matching-transaction stop with cleanup zero and unchanged protected data and
invalidation inventory. D052 and `phase4-t16-callback-error-plan.md` authorize
CET01 local-only fixed callback exception taxonomy. No AWS/live auth is
authorized in CET01.

### Phase 4 T16 CET01 callback error taxonomy

CET01 was implemented locally from Sol handoff
`cea1f85d0ac637a8fc4247f47d241230e0a15f75`. The OIDC adapter classifies caught
values immediately into only `state-unavailable`, `state-malformed`,
`invalid-redirect-request-type`, `oauth-response-error`, or `callback-other`.
Only the exact request-type message is compared; OAuth response fields and all
other caught values are discarded. A dedicated CustomEvent carries only the
allowlisted category, and the auth-only pre-document harness captures only
that category in memory before reducing it to category plus viewport. Generic
application text and raw preview behavior remain unchanged.

Hostile-value adapter tests, real Chromium callback-event canaries, focused
auth tests (43/43), web unit tests (55 passed), admin-local Playwright (46
passed), `npm run check`, and `git diff --check` all passed. No dependency,
token persistence, AWS, or live-auth change was made.

### Phase 4 T16 CET01 Sol acceptance and CET02 authorization

Sol reviewed `972273d`. Caught callback values are immediately reduced to five
fixed categories, the raw value is discarded, and the browser event/harness
accept only an allowlisted string. Application text and raw preview are
unchanged; hostile and real-Chromium coverage passed. CET01 is accepted.

CET02 may push the exact reviewed revision and dispatch web-only once. Data,
CloudFormation, IAM, Cognito administration, and invalidation remain forbidden;
require workflow success and unchanged inventories before CET03.

### Phase 4 T16 CET02 preview deployment acceptance

Exact-SHA workflow run `31444911264` at `1188d77` passed repository and
production-browser checks, web-only deployment, and raw preview checks. The
protected object remained 501 bytes with the same ETag/VersionId and the
invalidation count remained 3. No data, IAM, CloudFormation, Cognito admin,
invalidation, Firebase, DNS, or production change occurred. CET02 is accepted;
CET03 may run auth-only once under all existing exact gates.

### Phase 4 T16 CET03 result and state-validation plan

CET03 commit `862b53b` records one safe execution ending at desktop
`callback-other`, with cleanup zero, protected data unchanged, invalidation
count 3, and zero data writes. D053 and
`phase4-t16-state-validation-plan.md` authorize SV01 local-only exact pre-token
message classification. No AWS/live auth is authorized in SV01.

### Phase 4 T16 CET03 callback-error auth-only diagnosis stop

Starting from Sol handoff `05d5e0084bd24a62755d7d3b3e9cdd3539bc0568`, Node
`v24.18.1`, focused auth/web tests, root `npm run check`, and
`git diff --check` passed. Read-only preflight matched account
`470447451992`, region `ap-northeast-1`, pool users 0, `admins` membership 0,
the exact preview resources, and the real `/manage`-initiated Hosted UI
selector (desktop/mobile: one visible form with three controls each). The
protected Oda object baseline was 501 bytes, ETag
`"b2591d35e23ac1b9f2a133f71198b953"`, VersionId
`wQ1b5EEu1Qzrw93GyN9_bPNtxwaZ5VAE`, SHA-256
`ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`, and
the exact content type/cache metadata. CloudFront invalidation count was 3.

The committed auth-only executable ran exactly once with
`--execute-preview-auth`. Its sanitized result was `status: failed`,
`lastCheckpoint: cleanup`, `failureCheckpoint: admin-form`,
`roleOutcomes.admin: failed`, `roleOutcomes.non-admin: not-run`,
`counts: { operations: 4, writes: 0, restores: 0, cleanups: 1 }`,
`failure: { stage: admin-form, category: callback-other, viewport: desktop }`,
`cleanupStatus: passed`, `cleanupFailure: null`, and
`restoreStatus: not-required`. Exit status was nonzero; no retry or source fix
was made. The remaining role/viewport proofs were not reached after the
bounded admin failure.

Independent post-run readback proved pool users 0 and `admins` membership 0.
The protected object remained 501 bytes with the same ETag, VersionId, content
type, cache metadata, and SHA-256. CloudFront invalidation count remained 3.
No API PUT, S3 write, Firestore, IAM, CloudFormation, deployment, production,
DNS, Firebase, or data rehearsal operation occurred. CET03 is a terminal stop;
no retry or further auth-only run is authorized.

### Phase 4 T16 SV01 exact state-validation taxonomy

SV01 was implemented locally from Sol handoff
`fffc2db464add6c20de607df2ebb4cb1a8e8937f`. The callback classifier now
recognizes only the six exact installed oidc-client pre-token messages and
reduces them to fixed categories: `state-mismatch`, `client-id-missing`,
`authority-missing`, `authority-mismatch`, `client-id-mismatch`, and
`code-missing`. Near-match messages remain `callback-other`. No message or
caught value is retained, logged, stringified, or emitted; the existing event
boundary carries only the fixed category and preserves all CET safety rules.

Focused auth tests passed 43/43, web unit tests passed 68, admin-local
Playwright passed 46, `npm run check` passed, and `git diff --check` passed.
No AWS/live auth/deployment or dependency change was made.

### Phase 4 T16 CU01 callback URL capture

CU01 was implemented locally from Sol handoff
`4c828b6acbbaf35bafad42f961ce46ebe9added4`. The callback page captures
`window.location.href` once behind the client guard during setup, before
mounted/router work, and passes that immutable value to `session.callback` on
mount. The URL is not persisted, logged, rendered, or included in output.
The test-only local OIDC port verifies the exact code/state URL reaches the
callback boundary, while browser assertions verify no callback URL material is
rendered or persisted.

Web unit tests passed 73, admin-local Playwright passed 46, `npm run check`
passed, and `git diff --check` passed. All auth/storage contracts remain
unchanged; no AWS/live auth/deploy or dependency change was made.

### Phase 4 T16 STR02 state-read auth-only diagnosis stop

Starting from Sol handoff `3a551af963b34a9e760f041f2ebef004af9ab65c`, Node
`v24.18.1`, focused auth/web tests, root `npm run check`, and
`git diff --check` passed. Read-only preflight matched account
`470447451992`, region `ap-northeast-1`, pool users 0, `admins` membership 0,
the exact preview resources, and the real `/manage`-initiated Hosted UI
selector (desktop/mobile: one visible form with three controls each). The
protected Oda object baseline was 501 bytes, ETag
`"b2591d35e23ac1b9f2a133f71198b953"`, VersionId
`wQ1b5EEu1Qzrw93GyN9_bPNtxwaZ5VAE`, SHA-256
`ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`, and
the exact content type/cache metadata. CloudFront invalidation count was 3.

The committed auth-only executable ran exactly once with
`--execute-preview-auth`. Its sanitized result was `status: failed`,
`lastCheckpoint: cleanup`, `failureCheckpoint: admin-form`,
`roleOutcomes.admin: failed`, `roleOutcomes.non-admin: not-run`,
`counts: { operations: 4, writes: 0, restores: 0, cleanups: 1 }`,
`failure: { stage: admin-form, category: state-response-missing, viewport: desktop }`,
`cleanupStatus: passed`, `cleanupFailure: null`, and
`restoreStatus: not-required`. Exit status was nonzero; no retry or source fix
was made. The remaining role/viewport proofs were not reached after the
bounded admin failure.

Independent post-run readback proved pool users 0 and `admins` membership 0.
The protected object remained 501 bytes with the same ETag, VersionId, content
type, cache metadata, and SHA-256. CloudFront invalidation count remained 3.
No API PUT, S3 write, Firestore, IAM, CloudFormation, deployment, production,
DNS, Firebase, or data rehearsal operation occurred. STR02 is a terminal stop;
no retry or further auth-only run is authorized.

### Phase 4 T16 STR01 state-read taxonomy

STR01 was implemented locally from Sol handoff
`42cc0f4309ef3513f7058376ef628e3554e74763`. The callback classifier now maps
only the exact installed-library messages `No state in response` and `No
matching state found in storage` to `state-response-missing` and
`matching-state-storage-missing`. Near matches remain `callback-other`; no
caught value or message is retained, logged, stringified, or emitted, and the
existing event carries only the fixed category.

Focused auth tests passed 43/43, web unit tests passed 72, admin-local
Playwright passed 46, `npm run check` passed, and `git diff --check` passed.
No AWS/live auth/deployment or dependency change was made.

### Phase 4 T16 SV02 state-validation auth-only diagnosis stop

Starting from Sol handoff `6c08dec13c90e614aa9bfbb952bdb5041bbc8bdf`, Node
`v24.18.1`, focused auth/web tests, root `npm run check`, and
`git diff --check` passed. Read-only preflight matched account
`470447451992`, region `ap-northeast-1`, pool users 0, `admins` membership 0,
the exact preview resources, and the real `/manage`-initiated Hosted UI
selector (desktop/mobile: one visible form with three controls each). The
protected Oda object baseline was 501 bytes, ETag
`"b2591d35e23ac1b9f2a133f71198b953"`, VersionId
`wQ1b5EEu1Qzrw93GyN9_bPNtxwaZ5VAE`, SHA-256
`ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`, and
the exact content type/cache metadata. CloudFront invalidation count was 3.

The committed auth-only executable ran exactly once with
`--execute-preview-auth`. Its sanitized result was `status: failed`,
`lastCheckpoint: cleanup`, `failureCheckpoint: admin-form`,
`roleOutcomes.admin: failed`, `roleOutcomes.non-admin: not-run`,
`counts: { operations: 4, writes: 0, restores: 0, cleanups: 1 }`,
`failure: { stage: admin-form, category: callback-other, viewport: desktop }`,
`cleanupStatus: passed`, `cleanupFailure: null`, and
`restoreStatus: not-required`. Exit status was nonzero; no retry or source fix
was made. The remaining role/viewport proofs were not reached after the
bounded admin failure.

Independent post-run readback proved pool users 0 and `admins` membership 0.
The protected object remained 501 bytes with the same ETag, VersionId, content
type, cache metadata, and SHA-256. CloudFront invalidation count remained 3.
No API PUT, S3 write, Firestore, IAM, CloudFormation, deployment, production,
DNS, Firebase, or data rehearsal operation occurred. SV02 is a terminal stop;
no retry or further auth-only run is authorized.

### Phase 4 T16 SV01 Sol acceptance and SV02 deployment authorization

Sol reviewed `a7b41c0`. Only the six exact installed-library messages map to
fixed categories; hostile near-matches remain generic and no caught material is
emitted. Focused/web/admin suites passed. SV01 is accepted. SV02 may push exact
SHA and run the web-only workflow once, with no data/IAM/CloudFormation/Cognito
admin/invalidation. After successful checks and unchanged inventories, auth-only
may run once and must stop at its typed result.

### Phase 4 T16 SV02 preview deployment acceptance

Exact-SHA workflow `31446018098` at `cf5b035` passed all validation,
production-browser, web-only deployment, and raw preview checks. Protected data
and ETag/VersionId remained unchanged; invalidation count remained 3. No other
AWS/Firebase/production change occurred. The one auth-only SV02 diagnosis is
authorized under existing cleanup and zero-write gates.

### Phase 4 T16 SV02 result and state-read plan

SV02 commit `30377c6` safely returned desktop `callback-other`, cleanup zero,
unchanged protected data and invalidation count 3, and zero data writes. Source
review found two exact Logger-thrown state-read errors omitted from D053. D054
and `phase4-t16-state-read-plan.md` authorize STR01 locally; no AWS/live auth.

### Phase 4 T16 STR01 Sol acceptance and STR02 authorization

Sol reviewed `1b2edf4`; only the two exact Logger state-read constants map to
fixed categories, near matches remain generic, and caught material is discarded.
All focused/web/admin/root checks passed. STR02 may push exact SHA, run web-only
once, verify unchanged inventories, then run auth-only once and stop.

### Phase 4 T16 STR02 preview deployment acceptance

Exact-SHA workflow `31446988819` at `5ac03d1` passed all checks, web-only
deployment, and raw preview. Protected data and invalidation count 3 remained
unchanged. One auth-only STR02 diagnosis is authorized under existing gates.

### Phase 4 T16 STR02 result and callback-URL plan

STR02 commit `f987677` safely returned desktop `state-response-missing`, while
the pre-document probe had proved arriving code/state presence. Cleanup and
inventories were exact. D055 and `phase4-t16-callback-url-plan.md` authorize
CU01 locally; no AWS/live auth.

### Phase 4 T16 CU01 Sol acceptance and CU02 authorization

Sol reviewed `b285c9c`. The callback URL is captured once during client setup,
passed unchanged on mount, and never persisted, logged, or rendered. Unit 73,
admin E2E 46, root check, and diff passed. CU01 is accepted. CU02 may push exact
SHA and run web-only once, verify inventories, then auth-only once under existing
cleanup/zero-write gates.

### Phase 4 T16 CU02 preview deployment acceptance

Exact-SHA workflow `31447974423` targeted `12c9979`. Attempt 1 stopped before
deployment when the GitHub-hosted Chromium process received `SIGSEGV` during
the legacy `/en/` production-browser check; 13 checks had passed and the deploy
job was skipped. The failed job was rerun once without changing the reviewed
SHA. Attempt 2 passed repository checks, all production-browser checks, the
web-only deployment, and raw preview checks.

Independent read-only verification matched account `470447451992` in
`ap-northeast-1`. The protected Oda object remained 501 bytes with ETag
`"b2591d35e23ac1b9f2a133f71198b953"`, VersionId
`wQ1b5EEu1Qzrw93GyN9_bPNtxwaZ5VAE`, and SHA-256
`ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`.
CloudFront invalidation count remained 3. No data, IAM, CloudFormation,
invalidation, Cognito administration, Firebase, DNS, or production change was
made. The one CU02 auth-only verification is authorized under the existing
cleanup and zero-data-write gates.

### Phase 4 T16 CU02 auth-only verification stop

Starting from `cee55502885d651864d439afd771a98f0b64b9dc` on
`migration/aws-s3-cloudfront`, Node `v24.18.1`, focused auth/form/harness/
adapter tests passed 43/43, `npm run check` passed, and `git diff --check`
passed. Read-only preflight matched account `470447451992`, region
`ap-northeast-1`, the exact preview pool/resources, pool users 0, admins
membership 0, one Hosted UI form with three controls, the 501-byte protected
object baseline (ETag, VersionId, and SHA-256 unchanged), and CloudFront
invalidation count 3.

The committed auth-only executable ran exactly once with
`--execute-preview-auth` and exited 1. Its sanitized result was `status: failed`,
`lastCheckpoint: cleanup`, `failureCheckpoint: admin-form`,
`roleOutcomes.admin: failed`, `roleOutcomes.non-admin: not-run`,
`counts: { operations: 4, writes: 0, restores: 0, cleanups: 1 }`,
`failure: { stage: admin-form, category: state-response-missing, viewport: desktop }`,
`cleanupStatus: passed`, `cleanupFailure: null`, and
`restoreStatus: not-required`. The remaining role/viewport proofs were not
reached; no retry or source fix was made.

Independent post-run readback proved pool users 0, admins membership 0,
protected object ContentLength 501, the same ETag, VersionId, content type,
cache metadata, and SHA-256, and invalidation count 3. No API PUT, S3 write,
Firestore, IAM, CloudFormation, deployment, production, DNS, Firebase, or
data rehearsal operation occurred. CU02 is a terminal stop; CF03/T17 remain
unauthorized.

### Phase 4 T16 CU02 Sol review and Navigation Timing plan

Sol independently verified pool users 0, `admins` membership 0, the unchanged
501-byte protected object identity, and CloudFront invalidation count 3. CU02's
sanitized evidence is accepted as a safe terminal stop, not as successful auth
verification.

The arrival recorder had proved both callback parameters and the matching
transaction probe had proved the corresponding `oidc.` state, while the exact
library category remained `state-response-missing`. Source review established
that page setup can still follow Nuxt's initial history normalization. A local
Chromium proof showed that the standard document Navigation Timing entry keeps
the original query-bearing URL after `history.replaceState` removes it. D056
and `phase4-t16-navigation-url-plan.md` therefore authorize NU01 local
source/tests only. No AWS write, live auth, deployment, dependency, or data
operation is authorized in NU01.

### Phase 4 T16 NU01 Navigation Timing callback URL selector

Starting from `157469855dfc6e1389af155e7b67d1b468bfb39e`, NU01 added a
dependency-free callback URL selector and browser capture boundary. It accepts
only the exact origin and `/manage/callback` path, rejects fragments, userinfo,
malformed/cross-origin/wrong-path/repeated/empty/ambiguous candidates, and
requires exactly one non-empty `state` plus exactly one non-empty `code` or
`error`. A valid current URL is preferred; otherwise exactly one valid
Navigation Timing name is selected. The selector returns only the complete URL;
individual parameter values are never returned, decoded, logged, persisted,
rendered, emitted, or placed in evidence. The callback page keeps the selected
string in its setup closure and passes it once to the existing session callback;
no raw fallback is passed when validation fails.

Focused web unit tests passed 89 total (including 15 selector cases), the
admin-local Chromium suite passed 48 across desktop/mobile, `npm run check`
passed, and `git diff --check` passed. The new Chromium lifecycle proof uses
history normalization and Navigation Timing fallback, confirms one callback
consumption, and verifies no sensitive query material reaches DOM, storage,
console, or test output. PKCE, callback deduplication, transaction cleanup,
memory-only tokens, navigation, CSP, public behavior, and the raw preview suite
are unchanged. No AWS/live auth/deployment/IAM/CloudFormation/invalidation,
data/Firestore, Cognito administration, production, DNS, Firebase, or
dependency operation occurred. NU01 is complete and stopped for Sol review;
NU02 remains unauthorized.

### Phase 4 T16 NU01 Sol correction: semantic encoded query names

Sol review identified that the initial raw query-key scan would treat an
encoded semantic duplicate such as `%73tate` as unrelated. The selector now
decodes query names only (with `+` handling), rejects malformed percent
encoding, and counts encoded/mixed `state`, `code`, and `error` names while
leaving response values opaque and unreturned. Focused tests cover encoded
names, mixed duplicates, unknown encoded extras, and malformed/truncated names.

Focused web unit tests passed 31/31; admin-local Chromium passed 48/48 across
desktop/mobile; `npm run check` passed with web 92, core 7, schedule API 25,
and infra 19 tests; `git diff --check` passed. No callback/session/security
behavior was weakened and no AWS/live-auth/deploy/data/IAM/CloudFormation/
invalidation/Cognito/production/DNS/Firebase/T17/dependency operation occurred.

### Phase 4 T16 NU01 Sol acceptance and NU02 authorization

Sol reviewed `4b8f3e8` and correction `915b40b`. The selector accepts only the
exact callback origin/path and an unambiguous OAuth response, prefers a valid
current URL, otherwise consumes exactly one validated document navigation URL,
and keeps the full URL only in the page setup closure. Encoded semantic query
names and malformed encodings are handled without inspecting or exposing
response values. No callback value reaches storage, logs, DOM, events, or
evidence.

Independent focused web tests passed 59/59 and admin-local Chromium passed
48/48 across desktop/mobile; `git diff --check` passed and the worktree was
clean. NU01 is accepted. NU02 may push the exact reviewed SHA, run the existing
web-only workflow once, verify the unchanged protected object and invalidation
inventories, then run the committed auth-only executable once from zero
users/group. No data write, Firestore, IAM, CloudFormation, invalidation,
production, DNS, Firebase, or T17 operation is authorized by NU02.

### Phase 4 T16 NU02 preview deployment acceptance

Exact-SHA workflow `31471010254` at `026e966` passed repository checks,
production-browser checks, the web-only deployment, and raw preview checks.
Independent read-only verification matched account `470447451992`, pool users
0, `admins` membership 0, and CloudFront invalidation count 3. The protected
object remained 501 bytes with ETag
`"b2591d35e23ac1b9f2a133f71198b953"`, VersionId
`wQ1b5EEu1Qzrw93GyN9_bPNtxwaZ5VAE`, and SHA-256
`ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`.
No data, IAM, CloudFormation, invalidation, Cognito administration, Firestore,
production, DNS, or Firebase change occurred. The one NU02 auth-only execution
is authorized under the existing exact cleanup and zero-data-write gates.

### Phase 4 T16 NU02 auth-only live confirmation

Starting from `03577132ff24566efd4ea4c5c3ee76b30f09dd27` on
`migration/aws-s3-cloudfront`, Node `v24.18.1`, focused auth harness tests
passed 43/43, `npm run check` passed, and `git diff --check` passed. Read-only
preflight matched account `470447451992`, region `ap-northeast-1`, pool users 0,
admins membership 0, the one-form/three-control Hosted UI selector, the exact
501-byte protected-object baseline including ETag/VersionId/SHA-256, and
CloudFront invalidation count 3.

The committed auth-only executable ran exactly once with
`--execute-preview-auth` and exited 0. Its sanitized result was `status: success`,
`lastCheckpoint: complete`, both `roleOutcomes.admin` and
`roleOutcomes.non-admin` passed, `counts: { operations: 9, writes: 0,
restores: 0, cleanups: 1 }`, `failure: null`, `cleanupFailure: null`,
`restoreStatus: not-required`, and `cleanupStatus: passed`. All four
desktop/mobile role flows were reached: admin protected GET returned 200 on
desktop/mobile and non-admin protected GET returned 403 on desktop/mobile.
No API PUT was attempted.

Independent post-run readback proved pool users 0, admins membership 0,
protected object ContentLength 501 with the same ETag, VersionId, content type,
cache metadata, and SHA-256, and invalidation count 3. No S3/data write,
Firestore, IAM, CloudFormation, deployment, production, DNS, Firebase, or T17
operation occurred. NU02 is a terminal stop for Sol review; no retry or source
fix was made.

### Phase 4 T16 NU02 Sol acceptance and CF03 local authorization

Sol accepted `3399681` after independent read-only verification of account
`470447451992`, pool users 0, `admins` membership 0, the unchanged protected
object identity, and CloudFront invalidation count 3. The real local-user Hosted
UI matrix is complete: desktop/mobile admin GET 200 and desktop/mobile
non-admin GET 403, with memory-only tokens, no API PUT, and complete identity
cleanup.

D041 and `phase4-t16-concrete-final-plan.md` CF03 now authorize only the local,
AWS-free implementation and fake tests for the concrete one-object data
rehearsal executable. It must remain hard-coded to the exact D029 object and
cell, perform one conditional UI update, one stale conflict without retry,
bounded public observation, and one exact conditional original-byte restore,
with restoration taking priority after any possible write. Live execution,
AWS/Cognito mutation, IAM, CloudFormation, deployment, invalidation, Firestore,
production, DNS, Firebase, CF04, and T17 remain unauthorized until Sol source
review.

### CF03 Luna local implementation

Implemented the concrete data coordinator and protected S3 operation boundary
in the uncommitted working tree for Sol source review. Added AWS-free tests for
the literal execution flag, exact one-update/one-stale/one-restore ordering,
restoration-first indeterminate-write handling, no pre-write restore, exact
conditional S3 CLI arguments, and sanitized direct output. No AWS, Cognito,
API, browser-hosted, deployment, invalidation, Firestore, or production action
was performed. Focused test: `node --test
scripts/migration/t16-data-preview.test.mjs` (6 passed). Commit and review are
pending.

### CF03 Sol source review: correction required

Sol reviewed `a267d7b` and did not authorize live execution. The coordinator
skeleton has restoration intent, but direct mode has no concrete Playwright or
Cognito boundary, S3 `get-object` uses invalid destination syntax, preflight
manufactures non-S3 proof fields, update/stale identities are not coupled, and
the indeterminate-update recovery lacks a usable observed ETag. Generic cleanup
would also remove protected original bytes after a failed restore.

`phase4-t16-data-source-review.md` defines CF03R01-CF03R04 to correct concrete
execution, exact object capture/restore, proof coupling/indeterminate recovery,
failure tests, and truthful evidence. These are local source/test/documentation
tasks only. No AWS command, live data rehearsal, Cognito mutation, deployment,
invalidation, or later phase is authorized.

### CF03R01-R04 Luna correction

Rejected skeleton `a267d7b` was corrected locally for Sol re-review. Direct
construction now owns protected Cognito CLI input, generated in-memory admin
credentials, default Playwright Chromium contexts, exact object capture and
parser/metadata/hash gates, positional `get-object`, coupled update/stale
proofs, bounded polling, conditional restore readback, fail-closed
indeterminate recovery, and recovery-material retention after restore failure.
Added low-level direct-construction coverage and failure tests. Focused T16
auth/data suites: 45 passed; `npm run check`, `node --check`, and
`git diff --check` passed. No AWS/live Cognito/API/S3/browser-hosted,
deployment, invalidation, Firestore, IAM, CloudFormation, production, DNS,
Firebase, CF04, or T17 operation occurred. Changes remain local pending commit
and Sol source review.

### CF03 second Sol source review: further correction required

Sol reviewed `64530bd`; live execution remains unauthorized. The concrete
browser `load` uses native page fetch without the application's Bearer token,
and the submit path reads ETag/VersionId from HTTP headers although the deployed
API returns them in its JSON body. The stale proof is not coupled to an exact S3
current readback. Unknown indeterminate state does not retain recovery material,
public polling cannot abort a permanently pending fetch/body, bucket version/
privacy gates are absent, and the direct test depends on a gitignored local
fixture that is unavailable in a clean checkout.

CF03R05-CF03R08 in `phase4-t16-data-source-review.md` specify the required real
UI API observation, bucket/deadline gates, recovery lifecycle, and self-contained
low-level tests. These remain local source/test/documentation tasks only; no AWS
or live rehearsal operation is authorized.

### DC01 Luna exact browser/API correction

Corrected the Playwright boundary to the deployed API contract: authenticated
GET responses are exactly `document` plus `etag`; update success parses JSON
`document`/`etag`/`versionId`; stale conflict parses the exact comparison GET
and no longer invents a VersionId. The coordinator now performs exact current
S3 coupling after stale before polling or restore. Added low-level request /
response behavioral coverage and negative contract checks. Focused T16/auth
tests: 46 passed; `npm run check`, `node --check`, and `git diff --check`
passed. No AWS/live or later-phase operation occurred. Pending Sol review.

### CF03R05-R08 Luna second correction

Corrected the direct browser boundary to consume the application's
authenticated GET response, parse JSON-body ETags/version IDs, observe exact UI
PUT requests and responses, and require the stale conflict/comparison GET
sequence. Added separate bucket versioning/public-access gates, bounded
CloudFront polling with AbortController/deadline/timer cleanup, known retained
recovery-parent handling, and a self-contained deterministic 501-byte fixture.
Focused data tests pass (9), existing T16 auth/harness tests remain passing,
and `npm run check`, `node --check`, and `git diff --check` pass. No AWS/live
operation or later-phase action occurred. Pending Sol source re-review.

### CF03 third Sol source review: final corrections required

Sol reviewed `f82e377`; live execution remains unauthorized. API GET and
comparison GET are incorrectly required to contain `versionId` although the
contract returns only `document` and `etag`; stale current S3 identity is still
not coupled to the successful update; and one-cell validation does not compare
the rest of the document. The public-access-block response hierarchy is wrong.
The current AbortController cannot reach `page.evaluate`'s fetch/body, unknown
state still does not retain original material, and required pending-request/
body and cleanup tests are absent.

`phase4-t16-data-final-correction.md` defines isolated DC01-DC03 corrections.
Only DC01 local source/tests are authorized next. No AWS/live operation or
later milestone is authorized.

### DC01 Sol correction follow-up

Added pure whole-document one-cell delta validation and retained each page's
baseline/accepted update document in the Playwright closure. UI request and
response checks now enforce exact shape, origin, normalized content type,
headers, timestamps, ETag/VersionId, one PUT, localized conflict UI, and exact
comparison-document equality. Added low-level negative delta/body contract
coverage. Focused T16/auth suites: 47 passed; `npm run check`, `node --check`,
and `git diff --check` passed. No AWS/live or DC02+ operation occurred.

### DC01 final Luna correction

Replaced order-sensitive JSON serialization comparison with semantic deep
equality, normalized response-header checks, and enforced exact origin/path,
single PUT, response-body identity, and localized conflict controls at the
low-level browser boundary. Added reusable low-level launcher/context/page
fixtures covering two authenticated GETs, update, stale comparison/conflict
UI, a second PUT, and table-driven negative request/response contracts.
Focused data tests: `node --test
scripts/migration/t16-data-preview.test.mjs` (16 passed). `npm run check`,
`node --check`, and `git diff --check` passed. No AWS/live or DC02/DC03
operation occurred.

### T16 DC01 final correction

Commit `7d0c0e6` removed cross-header side effects and corrected deterministic
fake conflict behavior. Commit `a35250e` restored exact browser predicates,
added pure authenticated-GET validation, stateful stale-conflict coverage,
and deterministic timestamp/UI negatives; focused data tests passed 18/18,
with `npm run check`, `node --check`, and `git diff --check` passing. This
follow-up preserves case-sensitive conditional ETag values and records no
AWS/live or DC02/DC03 operation.

### T16 DC01 Sol acceptance and DC02 authorization

Sol independently reviewed DC01 through commit `057cdf1`. The adapter retains
exact API origin/path/method waiters, validates two independent authenticated
GET baselines, proves one successful conditional PUT followed by one stale
409/comparison GET with localized conflict controls, and preserves
case-sensitive `If-Match` comparison. The focused data suite passed 18/18 in
the primary thread and the worktree was clean. DC01 is accepted. DC02 local
source, tests, and documentation are authorized next exactly as specified by
`phase4-t16-data-final-correction.md`; DC03, AWS/network/live operations, and
data writes remain unauthorized until separate Sol review.

### T16 DC02 complete

Implemented nested public-access-block/versioning gates, strict retained
baseline/test object validation, coupled ETag/VersionId/document readback,
conditional restore identity/readback proof, and recovery-material retention
for unknown or failed post-write states. Protected material validation uses
resolved absolute paths, direct-child run containment, non-symlink checks, and
required modes. The concrete injected adapter harness now proves both a
successful restore/removal and a readback-identity failure: each performs
exactly one restore PUT, while failure retains material and never removes the
run or parent. The focused T16 suite passes 27/27. No AWS/live/DC03 operation
occurred.

### T16 DC02 Sol acceptance and DC03 authorization

Sol independently reviewed DC02 through commit `9cca3c9` and reran the focused
data suite (27/27). Exact baseline/test/unknown classification, typed recovery,
post-stale ETag/VersionId/document coupling, one-shot conditional restoration,
restore readback identity, protected material containment/modes/symlink checks,
and cleanup retention/removal are covered. The injected concrete adapter proves
one successful restore removes only its run directory and a mismatched readback
performs one PUT without retry while retaining recovery material. DC02 is
accepted. DC03 local source/tests/documentation are authorized exactly as
specified by `phase4-t16-data-final-correction.md`. AWS/network/live operations
and preview data writes remain unauthorized pending another Sol review.

### T16 DC03 local correction complete

Replaced page-evaluated/HTTPS-port public polling with an injected Node-side
fetch boundary restricted to the exact CloudFront object URL and GET options.
Polling now uses one monotonic overall deadline across fetch, bounded response
body reads, retries, and retry delay; aborts each request at deadline or
attempt completion; bounds Content-Length, streamed, and array-buffer bodies;
and requires the exact public status, JSON media type, cache-control, parsed
schema, and expected tuple. Pending fetch/body/sleep, abort, max-attempt,
timer-cleanup, malformed-response, body-size, and retry-success cases are
covered without AWS/network access. The focused T16 data/auth suite passes
73/73; `npm run check`, `node --check`, and `git diff --check` pass. No
AWS/live/DC04/T17 operation occurred; stop for Sol review.

### T16 DC03 Sol correction

Strengthened the shared monthly schedule parser to enforce the exact
`data-schema.md` shape, identity, Gregorian August 2026 dates, dense status
tuples, unknown-field rejection, and 32 KiB bound. Added direct polling cases
for malformed JSON/schema, missing and oversized bodies, exact cache metadata,
pending stream cancellation, active-timer cleanup across every termination
path, late fetch/body rejection guarding, and a deterministic overall-deadline
counter. The combined T16 data/auth suite passes 78/78; focused data tests
pass 35/35. No AWS/network/live operation occurred; stop for Sol review.

### T16 DC03 sparse-tuple correction

The exact parser now requires own tuple indices `0`, `1`, and `2` before
validating status values, rejecting sparse/null/string tuple cells. Added raw
JSON polling coverage for the sparse-tuple representation and explicit null
and string statuses. No AWS/network/live operation occurred.

### T16 DC03 Sol acceptance and one CF03 live rehearsal authorization

Sol independently reviewed DC03 through commit `a2828f3`, reran the combined
T16 data/auth suite (78/78), the focused data suite (35/35), and the root
check. The exact schedule schema, bounded Node fetch/body/retry deadline,
abort/cancel behavior, timer cleanup, late-rejection handling, and exact
CloudFront response contract are accepted.

The immediate read-only gate used only `AWS_PROFILE=codex-prod`, account
`470447451992`, and `ap-northeast-1`. Managed policy v7 is default with v3-v7
retained and its canonical SHA-256 matches the committed candidate
(`ac05040e2aed3baff41c1d34e49200fb54ce0a208546cf0555ad7d9abbfe43d0`). Hosting
is `UPDATE_COMPLETE`, GitHub deployment is `CREATE_COMPLETE`, the API 5xx alarm
is `OK`, pool users and `admins` membership are zero, unauthenticated API is
401/no-store, direct S3 is 403, invalidation count is three, and the exact Oda
object remains 501 bytes with baseline ETag/VersionId/metadata and SHA-256
`ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`.
Exact-key `s3:PutObject` simulation is allowed and the installed CLI supports
`--if-match`.

Exactly one direct execution of the committed data executable is authorized
next. It may create one temporary local Cognito administrator, open two fresh
desktop admin contexts, perform one successful UI conditional PUT for only
`2026-08-09[0]` 0 to 1, one stale UI PUT returning 409 without retry, and one
conditional operator PutObject restoring the exact protected original bytes.
It must observe tuple 1 then tuple 0 through bounded CloudFront reads, remove
the membership/user, and prove final zero identity state. No second execution,
restore retry, invalidation, IAM/CloudFormation/deploy, other object, version
delete, production, DNS, Firebase, or T17 operation is authorized. Any failure
must obey the committed recovery/retention stop boundary.

### T16 CF03 live rehearsal stop — 2026-08-11

From authorized clean commit `e9679d7`, the single invocation of the concrete
data executable stopped during authenticated browser setup while waiting for
the exact GET response. The stop occurred before any data PUT or restore
boundary. Post-stop read-only verification found the reserved object unchanged:
501 bytes, SHA-256
`ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`, baseline
ETag/VersionId, and tuple 0. One temporary Cognito identity remained after the
executable stop; after an STS account recheck it was removed and deleted using
the authorized cleanup path, leaving pool users 0 and admins 0. No restore,
retry, invalidation, or other data operation was performed. CF03 is stopped
for Sol review; no claim of rehearsal success is made.

### T16 CF03 stop diagnosis and LS01-LS02 local authorization

Sol reviewed the sanitized stop at `571782c`. The data and identity end state
is safe, so no restore is required. The browser adapter pre-armed both pages'
default response waiters and then authenticated sequentially; the second
waiter's timeout could elapse during the first login while its rejection was
not yet awaited, explaining both the exact-GET stop and abnormal cleanup exit.
`phase4-t16-data-login-sequencing-plan.md` authorizes only the local LS01-LS02
sequencing, deadline, unhandled-rejection, and cleanup correction. No second
live invocation or AWS operation is authorized pending Sol source review.

### T16 LS01-LS02 local correction complete

Per-page authenticated GET waiters now start immediately before that page's
navigation/login, receive an injectable finite timeout (default 90 seconds),
and are validated/stored before the next page begins. Rejecting waiters are
consumed on failure, browser cleanup is idempotent across all created contexts
and the browser, and concrete setup failure cleanup removes the temporary
identity without entering update/stale/restore stages. The focused data suite
passes 38/38 and the combined T16 data/auth suite passes 81/81. `npm run check`,
`node --check`, and `git diff --check` pass. No AWS/network/live operation
occurred; stop for Sol review.

### T16 LS01 final rejection-handling correction

Attached an immediate consuming sidecar to each authenticated GET waiter while
preserving the original promise for later timeout/error propagation. Added a
delayed waiter-rejection regression with login pending across event-loop turns;
it proves zero unhandled rejections and exactly-once cleanup of all resources.
The focused data suite passes 39/39 and the combined T16 data/auth suite passes
82/82. `npm run check`, `node --check`, and `git diff --check` pass. No
AWS/network/live operation occurred; stop for Sol review.

### T16 LS01-LS02 Sol acceptance and one corrected CF03 execution

Sol independently reviewed LS01-LS02 through commit `fd81532` and reran the
focused data suite (39/39). Each authenticated GET waiter is now created only
for its current page, has an explicit 90-second limit, receives an immediate
rejection consumer, and is validated before the second page starts. Delayed
rejection tests prove no unhandled rejection and exactly-once browser cleanup.

The post-stop read-only gate again matched account `470447451992`, pool users
0, `admins` members 0, invalidation count 3, and the exact unchanged 501-byte
baseline object/ETag/VersionId/metadata/SHA-256. Protected prior T16 capture
directories remain mode 0700 under `.artifacts/migration`; they are not inputs
to the corrected execution and are not deleted by this authorization.

One fresh execution of the corrected committed executable is authorized with
the same exact profile/account/region, target object, one successful UI PUT,
one stale 409 PUT, one conditional original-byte restore PUT, and identity
cleanup boundaries recorded at `e9679d7`. This is a new execution after a
reviewed source correction; it must still run exactly once and must not be
rerun on failure. No restore retry, invalidation, IAM/CloudFormation/deploy,
other object, delete/version-delete, production, DNS, Firebase, or T17 action
is authorized.

### T16 corrected CF03 live rehearsal stop — 2026-08-11

The one newly authorized invocation from clean commit `f5ed4ea` stopped before
the data-write boundary at the load checkpoint. Its sanitized result reported
`writes=0`, `restores=0`, and cleanup passed. Post-stop read-only verification
found pool users 0, `admins` members 0, invalidation count 3, and the reserved
object unchanged at 501 bytes with baseline ETag/VersionId/metadata, SHA-256
`ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`, and tuple
0. No retry, restore, invalidation, or other data operation was performed. The
corrected CF03 rehearsal remains unsuccessful and is stopped for Sol review.

### T16 corrected CF03 load-stop diagnosis and LC01-LC02 authorization

Sol reviewed the sanitized stop at `b1d378d`. Authentication setup completed,
cleanup passed, and the exact baseline/zero-identity state proves no recovery
write is required. The coordinator calls `adapters.load` without an argument,
although the real browser adapter requires the retained captured ETag. Its
permissive fake load ignored this missing contract. The local-only
`phase4-t16-data-load-contract-plan.md` LC01-LC02 correction is authorized.
No further live invocation or AWS operation is authorized pending Sol review.

### T16 LC01-LC02 local correction complete

The coordinator now retains the exact preflight/capture baseline ETag and
invokes load once with `{etag: original.etag}`; load output must match it for
both pages and tuple 0. The exact baseline gates remain enforced; a pure load
input helper proves nonconstant strong ETag propagation without weakening
production baseline validation. Added missing/mismatched/malformed load proof
cases, all stopping before update/stale/restore with one cleanup. Focused data
tests: 41/41; combined T16 data/auth: 84/84.
`npm run check`, `node --check`, and `git diff --check` pass. No AWS/network/live
operation occurred; stop for Sol review.

### T16 LC01-LC02 Sol acceptance and one load-corrected CF03 execution

Sol reviewed LC01-LC02 through commit `4175984` and reran the focused suite
(41/41). The coordinator now passes the exact retained capture ETag once and
keeps the known baseline ETag/VersionId/hash/byte gates unchanged. The fresh
read-only gate again matched account `470447451992`, users/admins 0/0,
invalidation count 3, and the exact baseline object identity and SHA-256.

One fresh execution of the load-corrected executable is authorized under the
same exact profile/account/region, target, one-update/one-stale/one-restore,
cleanup, and stop boundaries. It must run once only and may not be rerun on
failure. No restore retry, invalidation, IAM/CloudFormation/deploy, other
object, delete/version-delete, production, DNS, Firebase, or T17 action is
authorized.

### T16 load-corrected CF03 rehearsal stop — 2026-08-11

The one authorized execution from clean commit `85a615d` reached the update
checkpoint and returned a sanitized typed failure before any data write:
`writes=0`, `restores=0`, and `cleanupStatus=passed`. No retry or manual write
was performed. The post-stop read-only gate matched users/admins 0/0 and the
unchanged 501-byte target with baseline ETag/VersionId/metadata, SHA-256
`ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`, and tuple
0. The rehearsal is stopped for Sol review; no further live execution is
authorized in this task.

### T16 update-stop diagnosis and CS01-CS02 local authorization

Sol reviewed the stop at `e1e921d` and performed read-only CloudWatch inspection
after confirming account `470447451992` and region `ap-northeast-1`. The recent
audit records contain the expected authenticated GET requests and no PUT, which
places the failure before the API write. The admin page renders the exact id
`2026-08-09-0`, while the browser adapter incorrectly uses the unescaped CSS id
selector `#2026-08-09-0`; CSS identifiers beginning with a digit require
escaping. `phase4-t16-data-cell-selector-plan.md` authorizes only the local
CS01-CS02 selector/readiness correction and deterministic regression tests. No
AWS write, live execution, Cognito mutation, S3 operation, deploy, invalidation,
IAM/CloudFormation change, Firebase access, or T17 work is authorized pending
Sol source review.

### T16 CS01-CS02 selector/readiness correction complete — 2026-08-11

Replaced the digit-leading CSS id selector with the exact attribute locator
`[id="2026-08-09-0"]`. Before any PUT waiter or click, the adapter now requires
the target cell to become visible and enabled at baseline value `0`, then
requires the exact localized `Save`/`保存` control to become visible and
enabled; after selection it verifies value `1`. Deterministic tests cover
delayed readiness, missing/hidden/disabled/wrong-baseline cells, missing or
disabled Save controls, exact selector use, and zero PUTs on preflight failure.
Focused data tests: 42/42; combined T16 auth/data: 85/85. `npm run check`,
`node --check`, and `git diff --check` pass. No AWS/network/live operation
occurred; stop for Sol review.

### T16 CS01-CS02 actionability follow-up complete — 2026-08-11

Replaced the one-sample enabled check with bounded Playwright trial
actionability (`click({trial: true, timeout})`) for both the target cell and
localized Save control, while retaining baseline and selected-value checks.
AWS-free fakes now model disabled-to-enabled transitions, permanent disabled
bounded failure, and prove trial actions do not count as real Save clicks or
PUTs. PUT/response/comparison waiters now receive the explicit response timeout
and immediate rejection sidecars; a click-failure regression proves late
waiters produce no unhandled rejection. Focused data tests: 43/43; combined
T16 auth/data: 86/86. `npm run check`, `node --check`, and `git diff --check`
pass. No AWS/network/live operation occurred; stop for Sol review.

### T16 CS01-CS02 Sol acceptance and one selector-corrected CF03 execution

Sol independently reviewed CS01-CS02 through commit `b79d695` plus the
chronology-only commit `0b3e15c`. The exact attribute locator avoids the
digit-leading CSS identifier failure; bounded Playwright trial actionability
now proves the target cell and localized Save control are visible and enabled,
with exact baseline/selected values before any PUT waiter or click. All PUT,
response, and comparison waiters have explicit timeouts and immediate rejection
consumers. Sol reran the focused data suite (43/43), the combined T16 suite
(86/86), `node --check`, the root check, and `git diff --check`; the worktree is
clean.

The immediate read-only gate matched account `470447451992`, region
`ap-northeast-1`, managed policy v7 default with v3-v7 retained, and identical
AWS/local canonical policy SHA-256
`dd4a19a0ada79b4332ebb53245bc830a3d1d675322ea42f9a6011e1e70efaa97`.
Hosting is `UPDATE_COMPLETE`, GitHub deployment is `CREATE_COMPLETE`, the API
5xx alarm is `OK`, users/admins are 0/0, versioning and all public-access blocks
are enabled, invalidation count is 3, and the exact target remains the encrypted
501-byte baseline with its original ETag/VersionId/metadata and CloudFront
SHA-256 `ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`.

Exactly one fresh execution of the committed CF03 data rehearsal is authorized
using only `AWS_PROFILE=codex-prod`, account `470447451992`, and region
`ap-northeast-1`. It may create one temporary local Cognito administrator, use
two fresh desktop admin contexts, perform one successful UI conditional PUT for
only `2026-08-09[0]` from 0 to 1, perform one stale UI PUT that must return 409
without retry, observe tuple 1 through bounded CloudFront reads, and perform one
conditional operator PutObject restoring only the exact protected original
bytes before observing tuple 0 and deleting the temporary identity. It must run
once and stop on any failure. No second execution, restore retry, invalidation,
IAM/CloudFormation/deploy, other object, delete/version-delete, production,
DNS, Firebase, or T17 operation is authorized by this entry.

### T16 selector-corrected CF03 rehearsal stop — 2026-08-11

The one authorized execution from clean commit `861395b` stopped during
authenticated browser setup with a sanitized typed failure: `writes=0`,
`restores=0`, and `cleanupStatus=passed`. No retry or manual write was
performed. Post-stop read-only checks found users/admins `0/0`, invalidation
count `3`, the API 5xx alarm `OK` with no actions, and the unchanged encrypted
501-byte target with baseline ETag/VersionId/metadata, SHA-256
`ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`, and tuple
0. The rehearsal is stopped for Sol review; no further live execution is
authorized by this entry.

### T16 selector-corrected setup-stop diagnosis and SD01-SD02 authorization

Sol reviewed the safe stop at `ec8130c`. A wider read-only Lambda audit query
confirmed that the execution produced no authenticated API GET, so it stopped
inside Hosted UI/form/callback/manage/signed-in setup rather than at data load
or write. The current data runner collapses those distinct substages into
`typed-failure`; rerunning it unchanged would not add diagnostic evidence.
`phase4-t16-data-setup-diagnostic-plan.md` authorizes only a closed, sanitized
setup-substage/context proof and AWS-free regression tests. No AWS/network/live
operation, Cognito or S3 mutation, deploy/invalidation, IAM/CloudFormation,
Firebase, or T17 work is authorized pending Sol review.

### T16 SD01-SD02 setup diagnostic correction complete — 2026-08-11

Added a closed sanitized setup diagnostic boundary carrying only the
allowlisted substage category (`hosted-ui-redirect`, `form-submission`,
`manage-return`, `signed-in-sentinel`, or `authenticated-api-response`) and
the context ordinal (`first` or `second`). Hostile setup errors collapse to
`operation-failed` without raw error, URL, credential, identity, token, claim,
DOM, request, response, bucket, or key data. Browser setup wraps each context
failure, and the coordinator preserves the sanitized pair while retaining
exactly-once cleanup and zero data-stage activity. Focused data tests: 45/45;
combined T16 auth/data: 88/88. `npm run check`, `node --check`, and
`git diff --check` pass. No AWS/network/live operation occurred; stop for Sol
review.

### T16 SD01 follow-up boundary correction complete — 2026-08-11

Wrapped each real browser setup boundary explicitly: Hosted UI redirect and
form submission, manage return, signed-in sentinel, and authenticated GET
await/validation. Generic timeout and contract failures now map to the exact
sanitized stage/context, while earlier failures still drain the armed GET
waiter. Added production-shaped injected browser fakes for every stage and
both contexts, including generic `TimeoutError`/response failures, with no
leakage, unhandled rejection, or data-stage operation. Focused data tests:
46/46; combined T16 auth/data: 89/89. `npm run check`, `node --check`, and
`git diff --check` pass. No AWS/network/live operation occurred; stop for Sol
review.

### T16 SD01-SD02 Sol acceptance and one diagnosed CF03 execution

Sol independently reviewed the setup diagnostic implementation through
`f3db8af` and the documentation-only correction `ff21cbd`. Each production
boundary now maps generic failures to a closed category plus `first`/`second`
context, earlier failures drain the authenticated GET waiter, and hostile values
cannot cross the coordinator boundary. Sol reran the focused suite (46/46), the
combined T16 suite (89/89), `node --check`, and `git diff --check`; Luna's root
check also passed and the worktree is clean.

The immediate read-only gate reconfirmed account `470447451992`, users/admins
0/0, invalidation count 3, and the unchanged encrypted 501-byte exact target
with baseline ETag/VersionId/content metadata and CloudFront SHA-256
`ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`.

Exactly one fresh execution of the now-diagnostic committed CF03 executable is
authorized with the same exact profile/account/region, target, conditional
one-update/one-stale/one-restore, bounded observation, identity cleanup, and
stop boundaries recorded above. If setup fails, it must return only the new
allowlisted substage/context proof and must not be rerun. No restore retry,
invalidation, IAM/CloudFormation/deploy, other object, delete/version-delete,
production, DNS, Firebase, or T17 operation is authorized.

### T16 diagnosed CF03 rehearsal stop — 2026-08-11

The one authorized execution from clean commit `60cb08e` stopped during setup
with the sanitized result `failureCheckpoint=setup`, category
`authenticated-api-response`, context `first`, `writes=0`, `restores=0`, and
`cleanups=1`; cleanup passed. No retry or manual write was performed. Post-stop
read-only checks found users/admins `0/0`, invalidation count `3`, the API 5xx
alarm `OK` with no actions, and the unchanged encrypted 501-byte target with
baseline ETag/VersionId/metadata, SHA-256
`ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`, and tuple
0. The rehearsal is stopped for Sol review; no further live execution is
authorized by this entry.

### T16 authenticated-response stop diagnosis and RD01-RD02 authorization

Sol's read-only Lambda audit query found exactly one matching GET with status
200 during the execution recorded at `67a0c80`. Authentication, request
forwarding, Lambda authorization/read, and the response therefore completed;
the remaining failure is one of the local validator's URL/header, body, ETag,
schema, or tuple checks. `phase4-t16-data-response-diagnostic-plan.md`
authorizes only a closed sanitized response-reason proof and AWS-free tests. No
AWS/network/live operation, Cognito/S3 mutation, deploy/invalidation,
IAM/CloudFormation, Firebase, or T17 work is authorized pending Sol review.

### T16 RD01-RD02 authenticated-response diagnostic correction complete — 2026-08-11

Added the closed authenticated-response reasons `transport-contract`,
`response-missing`, `body-read`, `body-shape`, `etag`, `schedule-schema`, and
`reserved-tuple`. Reasons carry only with `authenticated-api-response`; other
setup failures retain only category and context. Production-shaped tests cover
all reasons in both contexts, hostile collapse/no leakage, exact keys, drained
waiters/no unhandled rejection, exactly-once cleanup, and zero data operations.
Focused data tests: 47/47; combined T16 auth/data tests: 90/90. `npm run check`,
`node --check`, and `git diff --check` pass. No AWS/network/live operation
occurred; stop for Sol review.

### T16 RD01 response-waiter reason correction — 2026-08-11

Corrected the authenticated GET setup boundary so a rejected or timed-out
response waiter is classified as `authenticated-api-response` with reason
`response-missing` before validation. Actual responses continue through the
validator and retain only their closed contract reason; hostile validator
failures remain sanitized as `transport-contract`. First/second waiter tests
now assert `response-missing`, including delayed rejection with no unhandled
rejection and exactly-once cleanup. Focused data tests: 47/47; combined T16
auth/data tests: 90/90. `npm run check`, `node --check`, and
`git diff --check` pass. No AWS/network/live operation occurred; stop for Sol
review.

### T16 RD01-RD02 Sol acceptance and one response-diagnosed CF03 execution

Sol independently reviewed RD01-RD02 through `c00c6ca` and the waiter correction
`201d40f`. Actual responses retain only one of the seven closed reasons, while a
rejected/timed-out waiter is exactly `response-missing`; no observed response or
raw failure value crosses the boundary. Sol reran the focused suite (47/47),
`node --check`, and `git diff --check`; Luna's combined suite (90/90) and root
check passed, and the worktree is clean.

The immediate read-only gate reconfirmed account `470447451992`, users/admins
0/0, invalidation count 3, and the exact encrypted 501-byte baseline object,
ETag/VersionId/metadata, and CloudFront SHA-256
`ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`.

Exactly one fresh response-diagnosed execution is authorized under the same
exact CF03 profile/account/region, target, conditional update/stale/restore,
observation, identity cleanup, and stop boundaries. If it fails, record only
the closed checkpoint/category/context/reason and do not rerun. No restore
retry, invalidation, IAM/CloudFormation/deploy, other object, delete/version
delete, production, DNS, Firebase, or T17 operation is authorized.

### T16 body-read stop diagnosis and IR01-IR02 authorization

The one execution from `abc72ce` stopped safely at setup with the closed result
`authenticated-api-response` / `first` / `body-read`; `1b7ad1c` records writes
and restores 0/0, cleanup passed, zero identities, and the unchanged exact
baseline. The matching API audit status was 200 and the app reached signed-in
rendering. The helper currently defers `response.json()` until after manage and
sentinel waits, so Playwright/CDP body availability can expire before local
validation. `phase4-t16-data-immediate-response-plan.md` authorizes only the
local immediate-validation ordering and AWS-free tests. No AWS/network/live or
T17 operation is authorized pending Sol review.

### T16 response-diagnosed CF03 execution stop — 2026-08-11

The one authorized execution from clean commit `abc72ce` stopped during setup
with the sanitized result `failureCheckpoint=setup`, category
`authenticated-api-response`, context `first`, reason `body-read`,
`writes=0`, `restores=0`, `cleanups=1`, and cleanup passed. No retry or manual
write was performed. Post-stop read-only checks found users/admins `0/0`,
invalidation count `3`, the API 5xx alarm `OK` with actions enabled, direct S3
HTTP `403`, API `401` with `no-store`, and the unchanged encrypted 501-byte
target with baseline ETag/VersionId/metadata, SHA-256
`ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`, and tuple
0. The rehearsal is stopped for Sol review; no further live execution is
authorized by this entry.

### T16 IR01-IR02 immediate authenticated-response validation complete — 2026-08-11

The exact authenticated GET waiter now immediately chains the existing
validator, attaches rejection consumers to both raw and validated promises,
and awaits the validated result only after manage and signed-in sentinel
stages. Earlier failures drain both promises. AWS-free tests prove body
validation begins before delayed manage/sentinel completion, short-lived body
availability succeeds, and late raw/validation rejection remains unhandled-free
with exactly-once cleanup and zero data stages. Focused data tests: 49/49;
combined T16 auth/data tests: 92/92. `npm run check`, `node --check`, and
`git diff --check` pass. No AWS/network/live operation occurred; stop for Sol
review.
