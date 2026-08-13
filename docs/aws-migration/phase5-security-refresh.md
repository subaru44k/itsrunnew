# Phase 5 dependency security refresh

Date: 2026-08-13  
Planner/reviewer: Sol  
Implementer: Luna  
Branch: `migration/aws-s3-cloudfront`  
Committed plan: `5af3db3`

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

## S01 result and stop condition

Commit `6d04e04` applied only the approved direct updates: Nuxt `^4.5.2`,
root `aws-cdk` `^2.1136.0`, `aws-cdk-lib` `^2.264.0`, and `constructs`
`^10.8.1`; npm regenerated the lockfile. The first required audit gate then
reported two remaining high vulnerabilities: `js-yaml` 4.0.0–4.3.0 and the
CDK-bundled `brace-expansion` 4.0.0–5.0.8. The audit offered a generic
`npm audit fix`, which is not authorized because it could widen the bounded
dependency scope. S02 full regression was not started after this binding stop
condition. No unrelated direct dependency, runtime/source, infrastructure,
AWS, Firebase, GitHub, deployment, DNS, tag, or ignored-file change was made.

## S03: reviewed transitive lock correction

Sol reviewed the stopped lock graph. No override, new direct dependency, or
major update is required:

- `@rollup/plugin-yaml@4.1.2` permits `js-yaml ^4.1.0`; update only the
  resolved lock version from 4.3.0 to the patched 4.3.1;
- `aws-cdk-lib@2.264.0` permits `minimatch ^10.2.5`, which permits
  `brace-expansion ^5.0.8`; update all affected resolved lock instances to
  patched 5.0.9 or later within that same major/range.

Use npm's normal targeted transitive update (`npm update ... --package-lock-only`
or an equivalently bounded npm command). Do not add root `overrides`, direct
dependencies, force/legacy-peer flags, or update unrelated manifest entries.
Review the resulting lock diff and exact dependency paths, run `npm ci`, then
execute the complete S02 audit/regression gate. The audit must be zero. Stop on
any unrelated direct-package change, unresolved vulnerability, test drift, or
install inconsistency.

## S03 result and stop condition

Commit `ac63aad` applied the targeted lock refresh: `node_modules/js-yaml` is
4.3.1 and the deduped `node_modules/brace-expansion` is 5.0.9. The required
audit still reports one high vulnerability at
`node_modules/aws-cdk-lib/node_modules/brace-expansion`, which remains bundled
at 5.0.8 by `aws-cdk-lib@2.264.0`. Targeted npm package-lock-only updates for
`js-yaml`, `brace-expansion`, and the approved infra workspace could not
rewrite that bundled package. The generic `npm audit fix` remains outside the
authorization. S02 full regression was not started after this binding audit
failure; no override, direct dependency, source/runtime, infrastructure, or
external operation was performed.

The required `npm ci` completed successfully against the resulting lockfile;
the subsequent audit reproduced the same one high finding at the bundled
5.0.8 path. The remaining S02 checks were therefore not run.

## S04: classify CDK libraries as build-only dependencies

Sol confirmed that `aws-cdk-lib@2.264.0` is the latest published release and
that its bundled `brace-expansion@5.0.8` cannot be replaced by npm's normal
lock resolution. The affected package belongs only to CDK synthesis and is
not part of the static web or schedule Lambda runtime. Keeping
`aws-cdk-lib` and `constructs` under the infra workspace's production
dependencies therefore gives `npm audit --omit=dev` an inaccurate runtime
boundary.

Move the existing `aws-cdk-lib` and `constructs` entries, without changing
their versions, from `infra/package.json` `dependencies` to
`devDependencies`, then regenerate the lockfile using npm. Do not add an
override, patch the bundled package, add a dependency, or change application
or infrastructure source. Normal development installs must continue to
include these packages and CDK tests/synthesis must still pass.

Run the complete S02 gate. In addition, run an unfiltered `npm audit` and
record its exact result truthfully. Acceptance requires:

- `npm audit --omit=dev` reports zero production/runtime vulnerabilities;
- the full audit has no finding other than the known high-severity
  `aws-cdk-lib`-bundled `brace-expansion@5.0.8` finding;
- `npm ls --all`, infra assertions/synthesis, all unit/build checks, maintained
  admin E2E, and raw preview E2E pass;
- the synthesized resource contract and deployed preview remain unchanged.

This is a classification correction, not a claim that the upstream package is
patched. Record the residual build-tool finding for replacement by the first
patched `aws-cdk-lib` release. Stop if the production audit remains non-zero,
the full audit contains any additional finding, npm changes dependency
versions unexpectedly, or a regression occurs. Do not perform AWS, Firebase,
deployment, invalidation, DNS, tag, merge, or ready-for-review operations.

## S04 result

Commit `0970aff` classified the existing `aws-cdk-lib ^2.264.0` and
`constructs ^10.8.1` entries as infra `devDependencies` without changing
versions, source, or infrastructure contracts. `npm ci` passed;
`npm audit --omit=dev` reports zero vulnerabilities. The unfiltered audit has
exactly one finding: high `brace-expansion@5.0.8` bundled under
`node_modules/aws-cdk-lib/node_modules/brace-expansion`. This is the known
upstream build-tool finding authorized by S04.

The complete S02 gate passed: `npm run check` (92 web, 7 core, 25 schedule
API, 19 infra tests, builds/synth), local E2E 48/48, public preview E2E 100/100,
`npm ls --all`, and `git diff --check`. No external operation occurred.
