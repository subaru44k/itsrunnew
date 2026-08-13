# T16E finalization correction

Date: 2026-08-13  
Planner/reviewer: Sol  
Implementer: Luna  
Branch: `migration/aws-s3-cloudfront`  
Start commit: `a1aa56b`

## Diagnosis

The first T16E pass correctly stopped when `npm run test:e2e` reported
`browser.newContext: Target page, context or browser has been closed`. Sol
reproduced the same browser-process failure at a different route (`/komazawa`
instead of `/en/`); the replacement Playwright worker completed every later
route. The route-independent failure occurs in the legacy Firebase smoke suite,
which still creates a full-page screenshot for every successful route despite
the global `screenshot: only-on-failure` policy. Baseline capture already has a
dedicated command and T17 will remove this legacy suite.

Sol review also found three local completeness issues:

- `retries: 0` was unnecessarily added to the raw preview config; omit the
  property so the earlier no-unconditional-retries contract remains literal;
- the keyboard check proves any navigation link and any week button, not both
  exact localized week controls with visible focus;
- the runbook omits the accepted GitHub OIDC provider/deploy-role ARNs, exact
  verification commands, and has a numbered rollback list gap.

## TE01: deterministic test correction

- Remove the unconditional success screenshot call from
  `tests/e2e/legacy-public-routes.spec.ts`. Do not add retries, route skipping,
  masking, or weaker route/content assertions. Failure screenshots/traces
  remain governed by Playwright config.
- Remove the explicit `retries` property from `playwright.preview.config.mjs`.
- Strengthen `preview-operational.spec.ts` to locate both exact localized
  previous/next week buttons, reach each through real Tab navigation, and prove
  the focused element is visible when reached. Keep the raw-network boundary
  and exact 375px/1280px checks.

Run focused legacy and preview operational suites, then the full required E2E.
If Chromium still terminates, stop with the new exact evidence; do not add a
retry.

## TE02: runbook completion

Add the exact non-secret identifiers:

- `arn:aws:iam::470447451992:oidc-provider/token.actions.githubusercontent.com`
- `arn:aws:iam::470447451992:role/itsrun-preview-github-web-deploy`

Fix rollback numbering and add exact read-only verification commands for the
documented preview checks. Commands must pin `AWS_PROFILE=codex-prod` and
`AWS_REGION=ap-northeast-1`; do not include credentials, mutations, or broad
resource discovery. Add the final local/browser command block.

Update `implementation-log.md` without rewriting the truthful first failure or
Sol reproduction. If all checks pass, run the read-only AWS/public checks from
the original plan, mark T16 complete and T17 ready, commit, leave a clean
worktree, and stop for Sol review.

All prohibitions and stop conditions from `phase4-t16-finalization-plan.md`
remain unchanged. No AWS/GitHub write or T17 work is authorized.
