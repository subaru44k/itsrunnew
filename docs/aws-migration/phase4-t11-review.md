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

Replace the managed policy with a stack-owned origin request policy plus a
stack-owned zero-TTL cache policy that together:

- forward only `Authorization`, `Content-Type`, `If-Match`, and
  `If-None-Match` from the viewer;
- forwards no cookies;
- forwards no query strings;
- include `Authorization` in the zero-TTL cache policy because CloudFront
  requires that header to be listed in a cache policy before it can forward it;
  `MinTTL`, `DefaultTTL`, and `MaxTTL` must all be zero, so the API remains
  uncached;
- retains the origin `Host` generated for the API Gateway domain rather than
  forwarding the CloudFront viewer host.

Add exact CDK assertions for both policies' header, cookie, query, and TTL
behavior. Do not accept an assertion that only checks that an origin-request-
policy ID exists.

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

## T11 second Sol review

Reviewed commit: `f4f0267`

Review date: 2026-07-31

Result: one local assertion correction and external secret metadata are
required before IAM policy v4 or AWS deployment.

### Independently verified

- T11R01 through T11R04 match the accepted resource contracts in the
  synthesized template. Authorization is carried by the custom zero-TTL cache
  policy because CloudFront does not permit it in the custom origin request
  policy; the remaining three headers are in the origin request policy, and
  cookies/query strings are disabled in both.
- T11R02's viewer-request function passes GET, PUT, and OPTIONS and returns
  405 with the exact Allow header for HEAD, PATCH, POST, and DELETE. It neither
  reads nor logs Authorization.
- T11R03's CORS and User Pool lifecycle protections are exact.
- T11R04's CSP adds only the parameterized Cognito origin to connect-src, and
  the four authentication outputs are unambiguous.
- T11R06 uses `addResourceDependency`; stage depends on the final routes, and
  focused tests/synth produce no `CfnResource#addDependency` warning.
- Node 24.18.1 independently passed the 9 infrastructure tests, infrastructure
  synth, root `npm run check`, and `git diff --check` with a clean worktree.
- Read-only AWS checks used `codex-prod`, account `470447451992`, region
  `ap-northeast-1`. The project execution policy remains default `v3`.
  No AWS write or secret-value read was performed.

### T11RR01: finish the semantic assertion contract

The implementation is correct, but T11R05's tests do not yet prove all of the
contract they claim to cover. Make test-only changes, without changing the
synthesized template, to assert all of the following by resource type and
stable properties:

- the route-key set is exactly:
  `GET /api/v1/stadiums/{stadium}/availability/{yearMonth}` and
  `PUT /api/v1/stadiums/{stadium}/availability/{yearMonth}`;
- both routes reference the exact JWT authorizer and exact integration;
- both routes have exactly `JWT` and `itsrun/schedule.write`;
- the `/api/*` behavior references the exact stack-owned
  `ItsRunPreviewApiNoCache` cache policy and exact stack-owned origin request
  policy;
- the Google `client_secret` is exactly the `Fn::Sub` Secrets Manager dynamic
  reference whose `SecretReference` is the
  `GoogleClientSecretReference` parameter;
- the app client contains only the code grant, has `GenerateSecret: false`,
  supports only Google, and its callback/logout values are the exact parameter
  references.

Do not weaken or duplicate the existing R01-R04 tests. Run the focused infra
tests, infra synth, root check, and diff check, update the implementation log,
commit, and stop for Sol review. No source/resource change or AWS operation is
authorized by T11RR01.

### External stop condition: Google secret does not exist

Read-only `secretsmanager:DescribeSecret` returned
`ResourceNotFoundException` for
`itsrun/preview/google-oauth-client-secret`. Therefore its exact ARN cannot be
recorded and the required resource-scoped `secretsmanager:GetSecretValue`
statement cannot be approved. The owner must create the secret directly in
Secrets Manager in account `470447451992`, region `ap-northeast-1`, without
putting its value in Git, chat, logs, fixtures, or CDK output. Only the ARN and
name may be handed back for review.

The Google OAuth client ID is also required as a non-secret deployment
parameter. Its value must be provided out-of-band or as an explicit deployment
parameter; it must not be guessed or hard-coded.

### IAM v4 status

Policy v4 remains unapproved and must not be created. After T11RR01 passes and
the exact secret ARN is available, Sol will produce the final document. The
candidate delta from v3 is limited to:

- CloudFront origin-request-policy create/read/list/update/delete operations;
- Cognito User Pool, app client, domain, Google IdP, resource server, and group
  lifecycle operations for the synthesized preview resources;
- API Gateway Management V2 create/read/update/delete operations for the
  synthesized HTTP API graph;
- `secretsmanager:GetSecretValue` on the one exact preview secret ARN.

Create operations that AWS does not support resource-scoping may use
`Resource: "*"` only when the final policy documents that service limitation.
No Lambda, IAM role, `iam:PassRole`, administrator membership, production,
DNS, Firebase, or secret-management permission belongs in the T11 delta.

### Authority after this review

Authorized: T11RR01 test/documentation-only correction.

Not authorized: policy v4, IAM changes, secret creation through this workflow,
secret-value reads, CDK deploy, CloudFormation changes, preview deployment,
invalidation, T12, production resources, DNS, or Firebase changes.

## T11 final local Sol review

Reviewed commit: `8cd8709`

Review date: 2026-07-31

Result: local T11 implementation and assertion contract approved; external
configuration and minimum-IAM review remain blocked.

T11RR01 is accepted. Independent review confirmed that the test suite now
asserts the exact two route keys, exact authorizer and integration references,
exact JWT scope, exact stack-owned cache/origin-policy references, the exact
Secrets Manager dynamic-reference structure, and the exact public app-client
OAuth contract. `infra/bin/app.mjs` and the synthesized resource graph are
unchanged from `b859b76`. Node 24.18.1 independently passed all 9 focused
infrastructure tests.

No additional local correction is required. T11 is not complete and T12 is
not authorized because the exact Google OAuth secret ARN and Google OAuth
client ID have not been supplied for deployment review. This review did not
perform any AWS operation or secret-value read and did not create policy v4.

Next owner action:

1. Create `itsrun/preview/google-oauth-client-secret` directly in Secrets
   Manager in account `470447451992`, region `ap-northeast-1`.
2. Provide only its exact ARN and the non-secret Google OAuth client ID.
3. Return to Sol to finalize the resource-scoped policy v4 and deployment
   contract.

Do not send Luna a T12 or deployment prompt before those two values have been
reviewed and Sol has explicitly approved policy v4 and the T11 deploy.

## D012 local-user design override

Owner approval date: 2026-08-08

D012 supersedes D005 before the first Cognito deployment. The Google OAuth
client ID and secret are no longer required, so the external-secret blocker
and the instruction immediately above to wait for those values are superseded.
Historical findings remain accurate for the commits they reviewed.

The authorized local correction is defined in
`phase4-t11-local-auth-plan.md`. It removes the Google identity provider,
credential parameters, Secrets Manager dynamic reference, and corresponding
IAM candidates while retaining the Cognito Hosted UI with local users,
Authorization Code + PKCE, and the complete `admins` authorization boundary.

No AWS operation, policy v4, deploy, or T12 implementation is authorized by
this override. Luna must complete T11L01-T11L04 and return to Sol.
