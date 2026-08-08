# Phase 4 T12 Sol review

Review target: `98a03f4`

Review date: 2026-08-08

Result: local corrections required before minimum-IAM policy v4 or any AWS
deployment.

## Review evidence

The review used Node `v24.18.1` and independently passed the current tests:

- schedule API unit tests: 6 passed;
- infrastructure tests: 10 passed;
- `git diff --check`.

Those checks do not prove the T12 contract. In particular, the store port uses
lower-camel `ifMatch` and `ifNoneMatch` fields and spreads them into
`PutObjectCommand`. AWS SDK v3 accepts `IfMatch` and `IfNoneMatch` (capital
`I`). The extra lower-camel properties are not serialized, so the deployed
write could be unconditional. This is a release blocker even though the fake
store tests pass.

No AWS operation, policy v4, IAM change, deploy, preview mutation, or
invalidation was performed during this review.

## T12R01: restore the conditional-write boundary

Make the S3 adapter contract impossible to translate incorrectly.

- Use a discriminated conditional-write type for exactly one mode: quoted
  ETag update or `If-None-Match: *` creation.
- Map the update mode to the exact SDK `PutObjectCommand` input property
  `IfMatch` and creation mode to `IfNoneMatch`.
- Reject empty, weak, wildcard, comma-separated, or otherwise malformed
  `If-Match`; accept only one strong quoted ETag.
- Detect header presence independently from truthiness so two present headers,
  including an empty one, are rejected.
- Configure the production `S3Client` with `maxAttempts: 1`; do not retry a
  conditional 409/412 automatically or in handler code.
- Add AWS-free adapter tests that inspect the actual
  `PutObjectCommand.input`. A fake handler-port assertion alone is not enough.
- Test 412 and conditional 409 with one put call and unchanged fake state.

Do not weaken the conditional contract or add an unconditional store method.

## T12R02: make validation and response contracts exact

Match `api-spec.md` rather than adding internal variants.

- Error JSON must be exactly
  `{ "error": { "code", "message", "requestId" } }`; do not place
  `requestId` at the response top level.
- Successful GET/PUT responses must not gain an undocumented `requestId`.
- Use the documented codes: `invalid_request`, `forbidden`,
  `schedule_not_found`, `schedule_conflict`, `unsupported_media_type`, and
  `internal_error`.
- Invalid stored data must be sanitized `500 internal_error`, not an exposed
  internal classification.
- Validate payload-format version, exact route key, and agreement between
  route key and HTTP method before accessing storage.
- Require parsed request JSON to be a plain object before `Object.keys`.
- Convert every client validation failure, including invalid dates/statuses,
  sparse tuples, cross-month dates, and complete-document size after adding
  `updatedAt`, to `400 invalid_request`; these currently fall through to 500.
- Treat missing success ETag, and missing VersionId after PUT to the versioned
  bucket, as sanitized internal failures rather than incomplete success.

Keep API Gateway responsible for ordinary JWT 401 and throttling 429.

## T12R03: bound S3 reads and audit records

- Replace `transformToString()` with a Node-stream reader that counts bytes as
  chunks arrive and stops/destroys the stream immediately above 32 KiB.
- Preserve the metadata pre-check, but do not rely on `ContentLength` being
  present or truthful.
- Test oversized metadata, oversized streamed data without metadata, chunk
  boundaries, empty/missing body, and a normal UTF-8 body without AWS access.
- Emit exactly one audit record per handled request with only the documented
  keys. Omit `undefined` optional values.
- Log only validated stadium/month and one of the two known routes/methods;
  do not copy unbounded attacker-controlled route/path strings.
- Test the exact log-key allowlist and absence of bearer token, raw claims,
  email, raw subject, request body/document, bucket, object key, AWS error,
  and stack details. Keep `actorSubHash` deterministic and one-way.

## T12R04: complete the AWS-free unit-test matrix

Split handler and S3-adapter tests where useful. Cover every matrix item in
`phase4-t12-plan.md`, including:

- missing/non-access token context, missing scope, near-match scope, missing
  admins group, and exact group parsing;
- invalid version/route/method/path/stadium/month/header/media type/body/size;
- primitive/array/null JSON, unknown fields, client `updatedAt`, and every
  invalid shared schedule representation;
- isolated typed S3 keys for every allowed stadium and rejection before store
  access for hostile path values;
- GET success/404/invalid stored data/unexpected failure;
- PUT create/update, exact conditions, server timestamp, ETag, VersionId,
  conflicts without retry, and unexpected failure;
- exact sanitized status/code/envelope and `Cache-Control: no-store` for every
  Lambda response.

Add a focused core test for the typed monthly key helper. Do not connect unit
tests to AWS and do not introduce a new dependency.

## T12R05: tighten CDK assertions and write throttling

Keep the synthesized resource design, but make the contract independently
provable.

- Configure an explicit route setting for the exact PUT route instead of a
  default throttle applied equally to all routes.
- Prefer two Lambda invoke permissions narrowed to this API's exact GET and
  PUT execution-ARN paths. If CDK cannot express this without expanding the
  design, stop for Sol rather than broadening it.
- Assert the Lambda role trust, absence of managed policies, exact two S3
  actions and object suffix, exact two logging actions and LogGroup-stream
  resource, and absence of every prohibited S3/web-bucket permission.
- Assert the Lambda's exact role reference, environment-key set, runtime,
  timeout, memory, LogGroup reference/retention/removal policy, integration
  URI/function reference, invoke source ARNs, and PUT route throttle.
- Retain all T11/T11L05, JWT, CORS, CloudFront no-cache/origin-policy, method
  filter, and dependency-graph assertions.

Do not add `dataBucket.grantReadWrite`, `AWSLambdaBasicExecutionRole`,
`DeleteObject`, `ListBucket`, `s3:*`, web-bucket access, or wildcard API invoke
permission.

## T12R06: truthful log and final local verification

Update `implementation-log.md` without removing the original T12A-T12F
history. Record that Sol found the conditional-property defect after the
original six handler tests passed, and record each correction commit and exact
test count.

Run under Node 24:

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

Commit coherent corrections without squashing prior commits. Stop after
T12R06 for a second Sol minimum-IAM review.

## Authority and stop conditions

Only local source, tests, documentation, and CDK synth are authorized.

Do not perform:

- AWS API calls or writes;
- managed policy v4 creation or IAM changes;
- CDK deploy or CloudFormation changes;
- preview deployment or invalidation;
- Cognito users/admin assignment;
- T13 or later work;
- production data, DNS, Firebase, or non-preview changes;
- dependency additions.

Stop and return to Sol if a new dependency, API/data-schema change, broader
runtime permission, wildcard invoke permission, policy change, or AWS access
appears necessary.

## T12 second Sol review

Review target: `0da39a9`

Review date: 2026-08-09

Result: one final local corrective pass is required before policy v4 review.

Independent checks passed under Node `v24.18.1`: core unit tests 7 passed,
schedule API unit tests 12 passed, schedule API typecheck, infrastructure tests
10 passed, and `git diff --check`. The conditional SDK field correction is
accepted, but the following findings are release blockers or unproven required
contracts.

### T12RR01: valid CloudFormation route settings and exact stage ARN

The synthesized `AWS::ApiGatewayV2::Stage.RouteSettings` currently contains
lower-camel `throttlingBurstLimit` and `throttlingRateLimit`. CloudFormation's
route-settings JSON contract requires `ThrottlingBurstLimit` and
`ThrottlingRateLimit`. The test currently asserts the invalid synthesized
shape.

- Synthesize the exact PUT route map with the two PascalCase CloudFormation
  property names. Because `RouteSettings` is typed as JSON, use an explicit
  property override or an equally deterministic CDK mechanism; inspect the
  final synthesized template, not only the source object.
- Keep GET without a route-level throttle and retain the exact PUT limits.
- Narrow both Lambda permission source ARNs from wildcard stage `/*/` to the
  actual `/$default/` stage, preserving separate exact GET and PUT paths.
- Assert the complete `Fn::Join` structures, including the detected API Ref,
  `$default`, method, and path, without generated logical-ID hard-coding.

### T12RR02: safely terminate bounded streams

`readBodyBounded` extracts `body.destroy` and invokes it without its receiver.
Node `Readable.destroy()` depends on `this`, so an oversized real S3 body can
throw a receiver error instead of the intended bounded-read error. The current
generator tests have no `destroy` method and do not detect this.

- Invoke `destroy` with the body as its receiver and exactly once when the
  limit is exceeded.
- Do not call `destroy` twice through both the loop and `finally`.
- Add a fake async iterable whose `destroy` checks its receiver and records the
  call count.
- Test exactly 32 KiB success, 32 KiB plus one byte failure, chunk-boundary
  overflow, metadata overflow before iteration, missing body, UTF-8 data, and
  stream error sanitization through the handler.
- Prove the production S3 client resolves `maxAttempts` to exactly 1 using an
  exported factory or another deterministic AWS-free test. Do not inspect
  source text as the test.

### T12RR03: finish the required handler matrix

The 12 schedule API tests still do not cover several explicit T12R04 items.
Add focused parameterized tests for:

- both S3 conditional conflicts, 409 and 412, with exactly one put attempt and
  unchanged fake state;
- missing GET ETag, missing PUT ETag, and missing PUT VersionId as sanitized
  `500 internal_error`;
- all relevant shared parser failures through the handler: invalid real date,
  cross-month date, sparse/short/long tuple, string/null/out-of-range status,
  over 31 days, wrong stadium/month, and complete serialized size overflow;
- payload version, route/method disagreement, missing path values, every
  allowed stadium key, base64 input, JSON media-type parameters, both/missing/
  malformed conditional headers, and unexpected store failures;
- Cognito group claims in the actual accepted array and serialized-string
  forms, plus near-match rejection;
- exact success bodies and exact error envelope/code/message/requestId for
  400/403/404/409/415/500;
- exact `content-type` and `cache-control: no-store` on every response;
- exactly one audit record and the exact allowlisted keys on error and PUT
  success, including `s3VersionId` only after success.

Avoid tests that combine unrelated invalid conditions in a way that does not
prove which validator rejected the request.

### T12RR04: complete infrastructure assertions and final log

Strengthen the semantic infrastructure test to assert:

- the Lambda's exact role `Fn::GetAtt`, LogGroup Ref, and environment key set
  containing only the data-bucket Ref;
- LogGroup name, retention, `DeletionPolicy: Retain`, and
  `UpdateReplacePolicy: Retain`;
- exactly one Lambda-trusted role, exactly two inline policies, no managed
  policies, exactly one S3 statement and one logs statement, and each exact
  `Fn::Join` resource structure;
- integration URI contains the exact detected Lambda ARN and the Lambda
  function is the target of both exact `$default` permissions;
- the corrected PascalCase PUT-only route settings;
- all T11/T11L05, JWT, CORS, CloudFront API no-cache/origin-request policy,
  method filter, and dependency assertions remain unchanged.

Update `implementation-log.md` without rewriting the prior correction history.
Record the initial T12RR01 synthesis defect and the exact follow-up commits and
test counts.

Run the full T12R06 command list under Node 24. Do not perform any AWS call,
policy v4/IAM change, deploy, preview mutation, invalidation, T13 work,
production operation, DNS change, Firebase change, or dependency addition.
Stop for Sol minimum-IAM review after T12RR04.

## T12 third Sol review

Review target: `02588ca`

Review date: 2026-08-09

Result: the synthesized RouteSettings, `$default` invoke ARNs, bounded-reader
receiver fix, and production S3 retry configuration are accepted. Policy v4
review remains blocked because several explicitly required AWS-free proofs are
still absent or weaker than the required exact contract.

Independent checks passed under Node `v24.18.1`: core unit tests 7 passed,
schedule API unit tests 18 passed, schedule API typecheck, infrastructure tests
10 passed, and `git diff --check`. The implementation log's T12RR03 count of
8 core tests is inaccurate; the suite contains 7 tests because the stadium-key
change expanded an existing test instead of adding a test case.

### T12F01: complete bounded-reader failure proofs

Keep the accepted `destroy` receiver fix and `maxAttempts: 1` factory. Add
focused AWS-free tests that prove:

- a `ContentLength` above 32 KiB rejects before the response body iterator is
  entered;
- a missing response body rejects with a sanitized `500 internal_error`
  through the handler;
- an async body iterator failure is sanitized as `500 internal_error` through
  the handler;
- technical stream errors do not appear in the response or audit record;
- the existing exact-limit, one-byte overflow, chunk-boundary, receiver,
  destroy-count, UTF-8, and resolved max-attempt tests continue to pass.

Do not change production behavior unless a failing focused test demonstrates
that a correction is required.

### T12F02: finish exact handler contracts

Strengthen the handler tests without combining unrelated invalid inputs. At a
minimum, cover the remaining explicit matrix:

- sparse tuple, `null` status, more than 31 day entries, wrong body stadium,
  wrong body yearMonth, and route/method disagreement;
- missing conditional header independently from both/malformed headers;
- unexpected PUT-store failure independently from missing write metadata;
- exact sanitized error object, status, message, requestId, content type, and
  no-store header for 400, 403, 404, 409, 415, and 500;
- exact GET and PUT success bodies and headers, with no success requestId;
- exactly one audit record with the exact allowlisted key set for an error and
  PUT success; `s3VersionId` must exist only on successful PUT;
- forbidden token, raw claims, email, raw sub, body, document, bucket, key,
  AWS error, and stack trace values must not appear in serialized logs.

Replace `arrayContaining` and partial response matching where the contract
requires exact equality. Keep the existing 409/412 one-attempt and unchanged
state coverage.

### T12F03: finish exact synthesized-IAM assertions

Keep semantic resource discovery and do not hard-code generated logical IDs.
Strengthen the infrastructure test to prove:

- exactly one S3 statement and exactly one logs statement;
- the complete S3 resource `Fn::Join`, including the detected data bucket ARN
  and `/data/v1/stadiums/*/availability/*.json` suffix;
- the complete logs resource `Fn::Join` remains exact;
- the Lambda-trusted role has exactly two inline policies and no managed
  policies;
- the stage dependency set contains exactly the detected GET and PUT routes,
  and each route retains dependencies on the detected integration and JWT
  authorizer;
- the existing exact Lambda, LogGroup, environment, integration, permission,
  RouteSettings, Cognito/JWT/CORS, and CloudFront contracts remain intact.

### T12F04: truthful log and final local verification

Correct the T12RR03 core test count from 8 to 7 without rewriting other
history. Add T12F01-T12F04 rows with actual commit IDs and test counts.

Run the full T12F command list under Node 24:

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

No AWS call, policy v4, IAM change, deploy, preview mutation, invalidation,
dependency addition, T13 work, Cognito user change, production operation, DNS,
or Firebase change is authorized. Stop again for Sol minimum-IAM review after
T12F04.

## T12 local implementation approval

Review target: `742b4d1`

Review date: 2026-08-09

Result: approved for the first T11/T12 preview deployment, subject to the
separate policy-v4 and deployment sequence in
`phase4-t12-deploy-plan.md`.

Sol independently reviewed commits `96f45df`, `3c90bf0`, `7c68bb7`,
`b04cc4d`, `a3355ce`, and `742b4d1`. Under Node `v24.18.1`, core unit tests
passed 7 cases, schedule API unit tests passed 25 cases, schedule API typecheck
passed, infrastructure tests passed 10 cases, `git diff --check` passed, and
the worktree was clean.

Accepted contracts include bounded S3 reads, exact conditional writes with a
single SDK attempt, sanitized API responses and audit records, the local
Cognito public-client flow, exact JWT routes and scope, PUT-only throttling,
API no-cache behavior, the dedicated Lambda role, exact S3/log resources, and
the `$default` GET/PUT invoke permissions.

This approval does not itself authorize an AWS write. It authorizes Sol to
prepare the exact policy-v4 artifact and deployment plan. Creating policy v4,
deploying the stack, publishing the Lambda asset, or changing an AWS resource
still requires the explicit bundled approval described in that plan.
