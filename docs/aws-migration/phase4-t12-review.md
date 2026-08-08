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
