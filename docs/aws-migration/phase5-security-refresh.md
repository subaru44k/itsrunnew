# Phase 5 dependency security refresh

Date: 2026-08-13  
Planner/reviewer: Sol  
Implementer: Luna  
Branch: `migration/aws-s3-cloudfront`  
Start commit: `SECURITY_PLAN_COMMIT`

## Finding

After Phase 5 local acceptance and draft PR creation, Sol ran a fresh
`npm audit --omit=dev`. The current branch reports five vulnerable package
entries: direct `nuxt@4.4.8` plus its builder, and transitive `js-yaml`,
`nanoid`, and `brace-expansion`. Four entries are high and one is moderate.
All have fixes available. The 398-vulnerability message shown during push
belongs to the old default `master` dependency graph and is not this branch's
audit result.

The static deployment reduces exposure to several Nuxt SSR/server-island
advisories, but leaving a known fixed high-severity direct framework version
would violate the migration's maintainability/security objective.

## S01: bounded existing-dependency update

Update only already-approved dependency families, with no new direct package:

- `web` Nuxt to current compatible `4.5.2`;
- `infra` `aws-cdk-lib` to `2.264.0` and `constructs` to `10.8.1`;
- root CDK CLI to `2.1136.0`.

Regenerate `package-lock.json` through npm. Do not run `npm audit fix --force`,
change TypeScript major, or update unrelated direct dependencies. Transitive
lock changes caused by these exact updates are allowed; review that no new
direct dependency or removal-list package appears.

Run focused Nuxt build/SEO, infra assertions/synth, schedule API tests/build,
and workflow contract tests before the full gates.

## S02: complete regression and audit gate

Run Node 24:

```bash
npm ci
npm audit --omit=dev
npm run check
npm run test:e2e
PREVIEW_BASE_URL=https://d2via50thoheqm.cloudfront.net npm run test:e2e:preview
npm ls --all
git diff --check
git status --short
```

The production audit must report zero known vulnerabilities. If a vulnerability
remains, a required major/unapproved direct dependency appears, generated SEO
or cache/routes differ, infra synth contracts change, or any test fails, stop
and record exact sanitized evidence without widening the update.

Update `phase5-review.md`, `implementation-log.md`, and README truthfully;
commit coherent dependency/lock and evidence changes without squashing. Stop
for Sol review. Do not perform AWS/Firebase/GitHub/deployment/DNS operations,
change the recovery tag, merge/ready the draft PR, or touch ignored files.
