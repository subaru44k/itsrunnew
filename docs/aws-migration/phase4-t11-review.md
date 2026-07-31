# Phase 4 T11 Sol review

Reviewed commit: `5f1d593`

Review date: 2026-07-31

Result: local corrections required before IAM policy v4 or AWS deployment

The T11 local implementation follows D005 and D009 in its main resource
choices. It does not expose a Google client secret, create an Identity Pool,
enable the implicit grant, or persist browser credentials. The synthesized
stack is not yet ready for a least-privilege IAM review or deployment because
the API origin contract and browser authentication CSP are broader or less
complete than the accepted documents require.

## Verified good

- `GoogleClientId`, secret reference, Cognito domain prefix, callback URLs,
  logout URLs, and the future T12 integration URI are CloudFormation
  parameters.
- The Google client secret is represented only as a Secrets Manager dynamic
  reference. No secret value is present in source, tests, or the synthesized
  template.
- The User Pool disables self-service sign-up. The app client is public,
  supports Google only, and enables only the authorization-code grant.
- The custom `itsrun/schedule.write` scope, empty `admins` group, HTTP API JWT
  authorizer, and two documented API route contracts are present.
- The API behavior uses the managed caching-disabled policy.
- No Identity Pool, Lambda, browser AWS credential, new dependency, AWS write,
  bootstrap change, or policy v4 was introduced.
- Independent checks passed under Node 24.18.1:
  `npm run test:infra --workspace @itsrun/infra`,
  `npm run build --workspace @itsrun/infra`, and `git diff --check`.

## Required corrections

### T11R01: Restrict the CloudFront API origin request

Severity: security contract

The `/api/*` behavior currently uses managed
`ALL_VIEWER_EXCEPT_HOST_HEADER`. That forwards all viewer headers except
`Host`, all cookies, and all query strings. `api-spec.md` permits only the
headers needed by the administrator API and says query strings are forwarded
only if later specified.

Replace the managed policy with a stack-owned origin request policy that:

- forwards only `Authorization`, `Content-Type`, `If-Match`, and
  `If-None-Match` from the viewer;
- forwards no cookies;
- forwards no query strings;
- does not include any of those values in a cache key because API caching is
  disabled;
- retains the origin `Host` generated for the API Gateway domain rather than
  forwarding the CloudFront viewer host.

Add exact CDK assertions for header, cookie, and query behavior. Do not accept
an assertion that only checks that an origin-request-policy ID exists.

### T11R02: Enforce the documented API method set at CloudFront

Severity: API boundary

CloudFront requires its seven-method allowed-method set when `PUT` is enabled,
so the synthesized behavior currently also passes `POST`, `PATCH`, and
`DELETE`. API Gateway has no such routes, but `api-spec.md` says CloudFront
permits only `GET`, `PUT`, and `OPTIONS`.

Keep the CloudFront allowed-method set required for `PUT`, and attach a
viewer-request CloudFront Function to the `/api/*` behavior that:

- passes only `GET`, `PUT`, and `OPTIONS`;
- returns `405 Method Not Allowed` for every other method;
- includes `Allow: GET, PUT, OPTIONS`;
- does not log or copy the authorization header.

Test the function deterministically for all seven CloudFront methods. Do not
alter the public-route rewrite behavior.

### T11R03: Complete API CORS and Cognito lifecycle protection

Severity: security contract

The HTTP API has no CORS configuration, while `api-spec.md` requires local
development to allow only a configured Nuxt origin. Add a parameter for the
single local development origin and configure the HTTP API to allow only:

- that exact origin, never `*`;
- `GET`, `PUT`, and `OPTIONS`;
- `Authorization`, `Content-Type`, `If-Match`, and `If-None-Match`;
- no credentialed wildcard behavior.

Use `http://localhost:3000` only as the documented preview-development default;
keep it parameterized. Add exact assertions for the complete CORS contract.

The User Pool is retained by CloudFormation but does not enable Cognito
deletion protection. Enable deletion protection because federated user and
group membership become operational data. Retain the existing removal policy
and assert both protections.

### T11R04: Complete the authentication CSP and outputs

Severity: functional security

The current CSP has `connect-src 'self'`. The T13 PKCE client must exchange an
authorization code at the Cognito token endpoint, so the browser must be able
to connect to the approved parameterized Cognito domain. Keep the existing CSP
restrictions and add only the exact Cognito prefix-domain HTTPS origin to
`connect-src`.

Also output unambiguous values for the later web configuration:

- complete Cognito authentication base URL;
- User Pool issuer URL;
- User Pool ID;
- public app-client ID.

Do not add Google endpoints to `connect-src` without a demonstrated browser
request. Google sign-in is a top-level redirect through Cognito, not a reason
to widen all script, frame, or connection directives.

### T11R05: Make infrastructure assertions semantic

Severity: test robustness

The new tests depend on generated logical IDs and only check that JWT
issuer/audience and an origin policy are truthy. Refactor them to locate
resources by type and stable properties, then assert:

- JWT audience is exactly the app-client reference;
- JWT issuer is exactly the User Pool provider URL;
- both exact API route keys use JWT and `itsrun/schedule.write`;
- callback/logout values refer to their parameters;
- the app client has no implicit or client-credentials flow and no generated
  secret;
- the Google secret field is the expected Secrets Manager dynamic reference;
- no Identity Pool exists;
- the API cache policy is the managed caching-disabled policy;
- the T11R01 through T11R04 contracts are exact.

### T11R06: Remove misleading dependency edges and warnings

Severity: maintainability

The API integration and authorizer currently depend on the API stage, while
routes depend on the integration and authorizer. Remove the unnecessary
integration/authorizer-to-stage edges. Use the current CDK resource-dependency
API instead of deprecated `addDependency`, and model any stage dependency in
the direction required by the final route graph.

The focused infrastructure test and synth must finish without the repeated
`CfnResource#addDependency` deprecation warning.

## IAM review status

Do not create or apply policy v4 yet. The corrected synth will add a custom
CloudFront origin request policy, so the final execution policy must include
the exact CloudFront origin-request-policy operations in addition to the
already reviewed v3 actions. The final review must also cover:

- Cognito User Pool, client, domain, Google identity provider, resource server,
  and group lifecycle actions;
- API Gateway HTTP API, stage, JWT authorizer, integration, and route lifecycle
  actions;
- `secretsmanager:GetSecretValue` on the exact preview Google OAuth secret ARN;
- no Lambda or Lambda execution-role permissions until T12;
- no `Action: "*"`, AdministratorAccess, PowerUserAccess, production resource,
  DNS, or Firebase permission.

An exact v4 document cannot be approved until the Google secret exists and its
ARN is recorded, and until T11R01-T11R06 produce the final resource graph. Do
not use a wildcard Secrets Manager resource as a temporary substitute.

## Luna correction order

1. Implement T11R01 and its exact assertions.
2. Implement T11R02 and deterministic method-filter tests.
3. Implement T11R03 and its exact CORS/deletion-protection assertions.
4. Implement T11R04 and assert the token endpoint origin/output contract.
5. Implement T11R05 and remove logical-ID-dependent assertions.
6. Implement T11R06 and rerun all local checks.
7. Update `implementation-log.md`, make meaningful commits, and stop for a
   second Sol IAM review.

Required checks:

```bash
npm run test:infra --workspace @itsrun/infra
npm run build --workspace @itsrun/infra
npm run check
git diff --check
git status --short
```

## Stop conditions

This pass authorizes local source, test, documentation, and synth changes
only. Stop without making the change if any of the following is needed:

- a new dependency or architecture decision;
- any AWS write or read of the Google secret value;
- managed policy v4 creation or any IAM modification;
- Cognito, API Gateway, CloudFront, CloudFormation, or preview deployment;
- T12 Lambda implementation or administrator UI work;
- production hostname/DNS, Firebase, or non-preview resource changes.
