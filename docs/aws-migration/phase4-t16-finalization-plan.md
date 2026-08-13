# Phase 4 T16 finalization plan

Date: 2026-08-13  
Planner/reviewer: Sol  
Implementer: Luna  
Branch: `migration/aws-s3-cloudfront`  
Planning parent: `fb7367b`

## Accepted entry evidence

- T15 is complete and accepted.
- The real Cognito authorization proof passed for desktop/mobile admin and
  authenticated non-admin users. Temporary users and `admins` membership are
  both zero after cleanup.
- CF03 passed with exactly one conditional update, one stale conflict, one
  exact original-byte restore, and cleanup. The restored current object is
  VersionId `3o5npTzfeFLHBhieoYRiNHT6kYwnOevs`, 501 bytes, ETag
  `"b2591d35e23ac1b9f2a133f71198b953"`, and SHA-256
  `ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`.
- The Hosting stack is `UPDATE_COMPLETE`, the GitHub deployment stack is
  `CREATE_COMPLETE`, the API alarm is `OK`, direct S3 is denied, and the
  CloudFront body/hash/cache metadata match S3.
- D041 supersedes historical Firestore migration and comparison requirements.
  Historical Firebase data may be discarded; the accepted preview seed/current
  AWS object is the new-stack baseline.

No T16 AWS write remains. Complete T16E in the following order.

## T16E01: bounded operational browser evidence

Add a separate raw preview operational Playwright suite and include it in
`playwright.preview.config.mjs`. Do not weaken or modify the contracts in the
existing public-route or schedule-state suites.

The new suite must use the real CloudFront preview without `page.route`, fetch
replacement, fixture prefetch, retry masking, or Playwright retries. Verify:

- exact 375px and 1280px viewport widths without document-level horizontal
  overflow and with the primary content and schedule usable;
- keyboard-only focus can reach the public navigation and schedule week
  controls, and focused interactive elements remain visible;
- the schedule table has an accessible caption, column/row header scopes, and
  non-empty localized text for every rendered status cell;
- Japanese and English pages retain the correct language and localized public
  content.

Capture screenshots only as ignored Playwright artifacts; do not commit binary
evidence. The suite is read-only and must not visit the administrator callback
or call the API write route.

## T16E02: truthful operational runbook and log

Update `migration-runbook.md` with the actual non-secret preview identifiers:

- account `470447451992`, region `ap-northeast-1`;
- Hosting stack `ItsRunPreviewHosting` and GitHub stack
  `ItsRunPreviewGitHubDeploy`;
- distribution `E22K5S8F2NUP6K` and
  `d2via50thoheqm.cloudfront.net`;
- web/data buckets `itsrun-preview-web-470447451992-ap-northeast-1` and
  `itsrun-preview-data-470447451992-ap-northeast-1`;
- API `40xqzug59a`, User Pool `ap-northeast-1_nmj9cP9st`, public client
  `1olddro3tldfinupl52u9dl1j4`, Lambda `itsrun-preview-schedule-api`, and alarm
  `itsrun-preview-admin-api-5xx`;
- OIDC provider and web-only deploy role ARNs already recorded in T15.

Name operational responsibilities as roles, without inventing a personal
identity or recording credentials: site owner approves users/cutover; preview
AWS operator executes deployment and rollback; an approved Cognito `admins`
member performs schedule maintenance. Preserve the seven-day observation-window
proposal and exact verification/rollback commands.

Apply D041 explicitly: remove current requirements to export/compare/reconcile
historical Firestore data. State that no unexplained migration differences
remain because historical comparison is out of scope, not because a comparison
was run. Keep Firebase, production DNS, and the production hostname unchanged.
Do not describe the preview distribution as an already selected production
hostname.

Update `implementation-log.md` truthfully. Preserve all prior stop and recovery
records. Record T16A-E evidence, the final restored VersionId, browser results,
read-only AWS results, and D041 disposition. Mark T16 complete only after all
T16E checks pass; mark T17 ready but do not start it in this task.

## T16E03: final verification

Run with Node 24:

```bash
npm ci
npm run check
npm run test:e2e
PREVIEW_BASE_URL=https://d2via50thoheqm.cloudfront.net npm run test:e2e:preview
git diff --check
git status --short
```

Read-only AWS verification may use only `AWS_PROFILE=codex-prod`, account
`470447451992`, and region `ap-northeast-1`. Reconfirm the two stack states,
alarm state/action arrays, zero pool users/admin memberships, public-access
blocks/versioning, direct S3 denial, API `401` plus `no-store`, CloudFront
object hash/cache metadata, and invalidation count. Do not read credentials or
tokens.

Commit coherent source/test changes separately from the final documentation
when practical. Update commit placeholders to real commit IDs, leave a clean
worktree, and stop for Sol review before T17.

## Prohibited operations and stop conditions

Do not perform any AWS write, Cognito administration, S3 write/delete/version
operation, deployment, invalidation, IAM/policy/CloudFormation change,
production DNS/hostname selection, Firebase access/change/deletion, GitHub
workflow dispatch, push, merge, tag creation, T17 removal, or new dependency.

Stop and record exact evidence if a required check fails, any temporary identity
or membership is nonzero, the protected object differs from the accepted
restored baseline, direct S3 becomes public, API responses are cacheable, a
stack/alarm is unhealthy, or completing T16 would require a prohibited action.
