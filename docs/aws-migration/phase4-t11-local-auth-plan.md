# Phase 4 T11 Cognito local-user transition plan

Sol planning commit base: `1cd7c42`

Decision: D012 supersedes D005 before the first Cognito deployment.

## Outcome

Replace the un-deployed Google-federated T11 graph with Cognito User Pool local
users while preserving the reviewed browser and API security boundaries:

- Cognito User Pool only; no Identity Pool;
- self-service sign-up disabled;
- Cognito local users are the app client's only identity provider;
- Cognito Hosted UI with Authorization Code + PKCE only;
- public app client with no client secret;
- in-memory browser tokens only;
- exact callback/logout parameters and Cognito-domain CSP;
- empty `admins` group, custom write scope, API Gateway JWT authorizer, and
  independent Lambda group enforcement;
- no Google OAuth application, Google IdP, Google secret, or Secrets Manager
  permission.

Historical Google review records remain factual history. Do not rewrite old
commits or claim that they were deployed.

## Luna execution order

### T11L01: replace Google federation with Cognito local users

In `infra/bin/app.mjs`:

1. Remove `GoogleClientId` and `GoogleClientSecretReference` parameters.
2. Remove `SecretValue` if it becomes unused.
3. Remove the Google User Pool identity-provider resource and its app-client
   dependency edge.
4. Set the app client's supported identity providers to Cognito local users
   only.
5. Preserve code-only OAuth, PKCE-compatible public client behavior,
   `GenerateSecret: false`, callback/logout parameter references, custom
   `itsrun/schedule.write` scope, empty `admins` group, User Pool retention and
   deletion protection, JWT issuer/audience, route authorization, CORS, API
   CloudFront behavior, cache/origin policies, method filter, CSP, and outputs.
6. Do not add a custom login form, SRP client, Identity Pool, Lambda, secret,
   new dependency, or token persistence.

Focused checks:

```bash
npm run test:infra --workspace @itsrun/infra
npm run build --workspace @itsrun/infra
```

Commit the coherent source/test change with `T11L01` in the message.

### T11L02: make the local-user assertions exact

Update `infra/test/stack.test.mjs` semantically, without generated logical-ID
hard-coding:

- assert that `GoogleClientId` and `GoogleClientSecretReference` parameters do
  not exist;
- assert zero `AWS::Cognito::UserPoolIdentityProvider` resources;
- assert zero `AWS::Cognito::IdentityPool` resources;
- assert the app client supports exactly `COGNITO`, code grant only, and
  `GenerateSecret: false`;
- assert exact callback/logout parameter references;
- retain exact User Pool self-sign-up, deletion-protection, retention, group,
  scope, JWT issuer/audience, route, CORS, CloudFront API policy, CSP, output,
  and dependency-graph assertions;
- assert that the synthesized template contains no Secrets Manager dynamic
  reference, Google OAuth credential parameter, or Google identity provider.

Do not weaken T11R01-T11R04, T11R06, or T11RR01 coverage merely because the
provider changed.

Focused checks:

```bash
npm run test:infra --workspace @itsrun/infra
npm run build --workspace @itsrun/infra
```

If T11L01 already contains these inseparable assertion changes, record T11L02
in the same coherent commit rather than manufacturing a test-only commit.

### T11L03: record the corrected synth and IAM reduction

Update `implementation-log.md` without deleting the historical Google review
entries. Record:

- D012 was approved before any Cognito deployment;
- the Google IdP, Google parameters, and secret reference were removed;
- no Google OAuth client or Secrets Manager secret is required;
- no AWS operation occurred;
- the corrected synthesized resource list;
- the candidate CloudFormation execution-role actions after removal of all
  Secrets Manager and Cognito identity-provider actions.

Do not edit `infra/bootstrap/cloudformation-execution-policy.json` and do not
create policy v4. Sol will derive the exact policy from the corrected synth.

### T11L04: final local verification and handoff

Run under Node 24:

```bash
npm run test:infra --workspace @itsrun/infra
npm run build --workspace @itsrun/infra
npm run check
git diff --check
git status --short
```

Stop for Sol review after a clean worktree. Report commits, tests, corrected
resource list, removed parameters/resources, and IAM candidate actions.

## Deployment sequencing

T11 local infrastructure may be approved before T12, but the current HTTP API
integration intentionally consumes the future `ApiIntegrationUri` parameter.
Do not invent a placeholder integration URI and do not deploy an unusable API.
After this local transition, Sol will decide whether to:

1. approve T12 local implementation before the first combined T11/T12 deploy;
   or
2. separate the integration/routes into T12 if a standalone T11 deployment is
   operationally required.

That choice must not be made by silently supplying a dummy ARN.

## Stop conditions

Stop without making the change if any of the following is required:

- a new dependency or custom authentication flow;
- token persistence;
- a Google/external IdP, Identity Pool, or browser AWS credentials;
- an API/data-schema change;
- AWS, IAM, CloudFormation, secret, deploy, preview, invalidation, DNS, or
  Firebase operation;
- T12 implementation;
- a placeholder or guessed integration URI.
