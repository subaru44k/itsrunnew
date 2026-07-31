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
| T09 | blocked by Stop condition | `3b84ad0` | `AWS_PROFILE=codex-prod npx cdk deploy ItsRunPreviewHosting --require-approval never` (blocked); `AWS_PROFILE=codex-prod aws cloudformation describe-stacks` (not found) | Target account lacks `/cdk-bootstrap/hnb659fds/version`. `cdk bootstrap` would create IAM roles and expand permissions, so it was not run. No CloudFormation resources, bucket uploads, DNS, Firebase or production writes occurred. Phase 3 Sol review requested. |
| T10 | blocked by Phase 3 | | | |
| T11 | blocked by Phase 3 | | | |
| T12 | blocked by Phase 3 | | | |
| T13 | blocked by Phase 3 | | | |
| T14 | blocked by Phase 3 | | | |
| T15 | blocked by Phase 3 | | | |
| T16 | blocked by Phase 3 | | | |
| T17 | blocked by Phase 3 | | | |

## Phase 3 Sol review

```text
Reviewed commit:
Date:
Result:
Required changes:
Approved decisions:
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
Task: T09 preview deployment
Decision needed: Implement R01-R05, then use the approved scoped bootstrap in R06.
Evidence: `cdk deploy` failed because `/cdk-bootstrap/hnb659fds/version` is absent in account 470447451992/ap-northeast-1; CloudFormation stack does not exist.
Safe work that can continue: Luna remediation R01-R05; AWS mutation begins only at R06 after local checks pass.
