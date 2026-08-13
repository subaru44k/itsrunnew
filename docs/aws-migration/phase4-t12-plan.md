# Phase 4 T12 schedule API implementation plan

Sol review target: `49d4301`

Review date: 2026-08-08

Result: D012 local-user transition accepted; one focused T11 assertion must
pass before T12, then T12 local implementation is authorized.

## Deployment decision

Do not deploy T11 with a guessed or placeholder `ApiIntegrationUri`. Implement
the T12 Lambda and bind the existing HTTP API integration to the synthesized
function first. Sol will then review one complete T11/T12 resource graph and
one minimum policy v4 before the first authentication/API deployment.

This avoids an unusable API, a dummy ARN, and two successive bootstrap-policy
expansions. It does not authorize AWS writes in this pass.

## T11L05 prerequisite: prove app-client scope issuance

Before changing T12 source, strengthen the semantic infrastructure assertions
without generated logical-ID hard-coding:

- exactly one `AWS::Cognito::UserPoolResourceServer` belongs to the User Pool;
- its identifier is exactly `itsrun` and its only scope is
  `schedule.write` with the documented description;
- the app client's `AllowedOAuthScopes` is exactly `openid`, `email`,
  `profile`, and a reference to that resource server's `schedule.write`;
- `AllowedOAuthFlowsUserPoolClient` is `true`;
- existing COGNITO-only, code-only, no-secret, callback/logout, JWT route
  scope, no-IdP, and no-Identity-Pool assertions remain exact.

Run the focused infrastructure test and synth. If this prerequisite fails for
any reason other than the assertion itself, stop before T12.

## T12A: service workspace and provider-neutral handler

Use the existing `services/schedule-api` workspace. Add only dependencies
already allowed by `architecture.md`:

- exact-pinned `@aws-sdk/client-s3` as a runtime dependency;
- `@itsrun/core` through the local workspace;
- exact-pinned `esbuild` as a development dependency if a direct build tool is
  required.

Do not add a Lambda framework, middleware framework, validation library,
logging library, date library, or AWS SDK to the public web workspace.

Create TypeScript source with a dependency-injected handler and an S3 port so
unit tests never call AWS. Keep the AWS adapter separate from routing,
validation, authorization, response formatting, and audit logging.

Add a typed core helper that constructs
`data/v1/stadiums/{stadium}/availability/{yearMonth}.json` only from an already
validated `StadiumSlug` and `YearMonth`. Do not construct an S3 key from raw
path strings or use a broad encoder as a security boundary.

The production Lambda entrypoint may instantiate `S3Client` once outside the
handler. Bundle the pinned S3 client; do not depend on the runtime's mutable
SDK version.

## T12B: request, authorization, and validation contract

Implement only payload-format `2.0` GET and PUT events for the two existing
route keys.

For every Lambda invocation:

1. Treat path, headers, body, and JWT claims as untrusted.
2. Require an access token context and independently require
   `cognito:groups` to contain the exact `admins` group.
3. Require the `itsrun/schedule.write` scope defensively in Lambda as well as
   in API Gateway.
4. Parse the stadium through the existing stadium enum/config and parse
   `yearMonth` through the core calendar validator before constructing a key.
5. Return the documented generic error envelope with request ID; never expose
   AWS details, stack traces, bucket names, claims, tokens, or object content
   in errors.

`GET`:

- read exactly one validated object key;
- parse the stored object with `parseScheduleMonth` and the path identity;
- return `{ document, etag }` and `Cache-Control: no-store`;
- map a missing key to `404 schedule_not_found`;
- treat invalid stored data as sanitized `500 internal_error`.

`PUT`:

- require JSON media type; reject other media types with 415;
- reject malformed JSON, base64-encoded request bodies, unknown fields, wrong
  schema/stadium/month, invalid dates/status tuples, and oversized input;
- use an update DTO containing exactly `schemaVersion`, `stadium`,
  `yearMonth`, and `days`; reject client-supplied `updatedAt`;
- set `updatedAt` from an injected server clock, then validate the complete
  `ScheduleMonth` through the shared parser;
- require exactly one conditional mode: a valid quoted `If-Match` ETag for an
  update, or exact `If-None-Match: *` for creation;
- pass the condition directly to `PutObject`; never perform an unconditional
  write and never silently retry a conflict;
- map S3 412 and conditional 409 to `409 schedule_conflict`;
- return `{ document, etag, versionId }` only after success, with
  `Cache-Control: no-store`.

The actor subject is never stored in public JSON. Hash the validated `sub`
with SHA-256 only for the structured audit record.

## T12C: structured audit logging

Inject the logger and clock in unit tests. Emit one bounded JSON audit record
per handled request containing only the documented fields:

```text
requestId
route
method
status
stadium
yearMonth
actorSubHash
durationMs
s3VersionId on success
```

Do not log the bearer token, raw claims, email/username, raw subject, request
body, schedule document, S3 key/bucket, AWS error message, or stack trace.
Tests must inspect serialized log output for forbidden values.

## T12D: S3 adapter and unit-test matrix

Use `GetObject`, `PutObject`, `IfMatch`, and `IfNoneMatch` from the pinned AWS
SDK v3 client. Bound object reads to the 32 KiB contract using available
metadata and a bounded body reader; do not trust stored object size.

Unit tests use only fakes and cover at least:

- exact authorization group and scope parsing;
- missing/invalid route, stadium, month, method, headers, and JSON;
- unknown fields, client `updatedAt`, oversized body/document, every invalid
  core schedule representation, and path/key isolation;
- GET success, missing object, invalid stored object, and unexpected failure;
- PUT update success with `If-Match` and create success with
  `If-None-Match: *`;
- missing, both, malformed, or wrong conditional headers;
- exact SDK conditional-input mapping;
- S3 412 and conditional 409 mapped to API 409 with the fake store unchanged;
- server-controlled timestamp, ETag, and VersionId;
- sanitized 400/403/404/409/415/500 responses;
- audit log allowlist and absence of token, claims, body, subject, bucket, key,
  and raw technical errors.

API Gateway owns ordinary missing/invalid-token 401 and throttling 429 before
Lambda. Infrastructure assertions must prove the authorizer/scope and bounded
stage throttling instead of manufacturing Lambda responses for those cases.

## T12E: CDK integration and least-privilege runtime role

Replace the `ApiIntegrationUri` parameter with a real bundled Lambda proxy
integration. Preserve payload format `2.0` and the reviewed GET/PUT routes.

Infrastructure contract:

- Node.js `nodejs24.x` managed runtime;
- explicitly bounded timeout and memory;
- one pre-created CloudWatch Log Group with finite retention and reviewed
  removal policy; do not use deprecated `logRetention` custom-resource flow;
- explicit execution role trusted only by Lambda;
- role allows only `s3:GetObject` and `s3:PutObject` on
  `arn:aws:s3:::itsrun-preview-data-470447451992-ap-northeast-1/data/v1/stadiums/*/availability/*.json`;
- no `s3:DeleteObject`, `s3:ListBucket`, bucket-policy action, web-bucket ARN,
  `s3:*`, or infrastructure mutation;
- logging permissions only for the function's exact Log Group streams;
- API Gateway invoke permission restricted by the HTTP API execution ARN;
- environment contains only the data bucket name and non-secret configuration;
- API responses and CloudFront `/api/*` remain uncached;
- write-route throttling is explicit and bounded;
- no public-web AWS SDK.

Add CDK assertions for the Lambda, role, inline policies, log retention,
permission source ARN, integration URI, removed `ApiIntegrationUri` parameter,
and every negative IAM requirement.

Do not use `dataBucket.grantReadWrite`; it can grant actions broader than the
two explicitly accepted object operations. Add the exact resource policy
statement directly.

## T12F: checks, commits, and handoff

Commit coherent milestones without squashing prior history. Update
`implementation-log.md` after each milestone and record exact test counts.

Required final commands under Node 24:

```bash
npm ci
npm run test:unit --workspace @itsrun/core
npm run test:unit --workspace @itsrun/schedule-api
npm run typecheck --workspace @itsrun/schedule-api
npm run build --workspace @itsrun/schedule-api
npm run test:infra --workspace @itsrun/infra
npm run build --workspace @itsrun/infra
npm run check
git diff --check
git status --short
```

Report the corrected synthesized resource graph, Lambda runtime policy,
CloudFormation execution-role candidates, CDK asset-publishing operations, and
any unresolved integration input. Stop for Sol minimum-IAM review before any
AWS operation.

## Allowed dependency decision

`@aws-sdk/client-s3` and `esbuild` are already explicitly allowed by
`architecture.md`; their addition does not require a new decision. Use exact
versions in the service package and commit the lockfile. Any other new runtime
or development dependency is a stop condition.

## Stop conditions

Stop and record evidence without guessing if implementation requires:

- an API or data-schema change;
- any dependency other than the two explicitly allowed above and the local
  core workspace;
- unconditional S3 writes, automatic conflict retry, DeleteObject, web-bucket
  access, broad S3 resources, or bucket-policy mutation;
- token persistence, a new authentication flow, Identity Pool, or external
  IdP;
- an IAM/CloudFormation execution-policy change, policy v4, AWS write, deploy,
  preview mutation, invalidation, DNS, Firebase, or production operation;
- T13 administrator UI work;
- a real administrator account or production data.
