# Phase 4 T11/T12 final acceptance recovery plan

Sol review target: `3331e15`

Review date: 2026-08-09

## Verified deployed state and acceptance gaps

Sol independently confirmed:

- policy v5 is default, v1-v5 are retained, and AWS v5 exactly matches the
  committed candidate at canonical SHA-256
  `ca4a20e3e3a7c06c1f1196559886a9679dee98b9a25c7334dd8faf69b19e061e`;
- stack `ItsRunPreviewHosting` is `UPDATE_COMPLETE` with 30 tracked resources,
  no failed resource, complete Cognito/API/Lambda/CloudFront graph, unchanged
  hosting bucket/distribution outputs, and exact new outputs;
- deployed Cognito, JWT routes, integration, throttle, Lambda permissions,
  runtime role, private S3, managed API cache policy, and exact origin request
  policy match the reviewed contracts;
- direct and CloudFront unauthenticated API requests return 401; PATCH returns
  405 with the exact Allow header; CloudFront cache is disabled, but these
  browser-path responses lack explicit `Cache-Control: no-store`;
- preview objects `2026-07.json` and `2026-08.json` return 200 with correct
  cache/security metadata and `updatedAt`; August contains 2026-08-01 through
  2026-08-06 only;
- all eight E2E failures are the same date-window drift: four raw-suite and four
  isolated retained-state assertions expect an available cell in the current
  2026-08-09 through 2026-08-15 week;
- current August object is version
  `ynZsSK9z.Jztbx7aF.A_qORkruUZu93l`, ETag
  `"97e252c7a947511065a27d66cb1d972e"`, SHA-256
  `82fa4d1ecf2bd920b09c2e64edf96c6f5bc1f63a3a955e40bdacf20c2a4d560e`,
  448 bytes, `application/json`, and
  `public, max-age=0, s-maxage=60`; bucket versioning is enabled.

No additional AWS write, invalidation, data mutation, Cognito administration,
production, DNS, or Firebase change occurred during this review.

## FA01: API-only no-store response policy

Local-only; no AWS call or new dependency.

1. Factor the existing security-header behavior and Permissions-Policy value
   into shared source values without changing their synthesized content.
2. Keep the existing `SecurityHeaders` policy for default and `data/*`.
3. Add `ApiSecurityHeaders` with exactly the same security and permissions
   headers plus custom `Cache-Control: no-store`, override true.
4. Bind only `api/*` to the API policy.
5. Preserve managed CachingDisabled, exact origin policy, method filter, routes,
   Cognito, Lambda, IAM, and all unrelated resources.

## FA02: semantic API-response assertions

Strengthen infra tests without generated logical-ID hardcoding:

- exactly two response-headers policies identified by stable properties;
- identical complete `SecurityHeadersConfig` and Permissions-Policy in both;
- only API policy has exact Cache-Control/no-store/override;
- API behavior references the API policy; default and data reference the
  public policy;
- no no-store header is attached to HTML/data policies;
- all prior T11/T12 and policy-v5 assertions remain strict.

## FA03: deterministic isolated schedule-state clock

In `preview-schedule-states.spec.ts`, pin only the mocked retained-data/retry
test to a documented date whose initial and next-week fixtures contain an
available cell. Use Playwright Clock before navigation. Do not modify
`preview-public-routes.spec.ts` and do not add retries, fetch replacement,
fixture prefetch, page routing, or clock manipulation to the raw suite.

Run Node 24 infra tests/synth, root check, local preview schedule-state suite,
`git diff --check`, update the log, commit, and stop for Sol review before AWS
writes.

## FA04: Sol local, policy, and fixture review

Sol independently verifies the synth diff is limited to one response-headers
policy and the API behavior reference, policy v5 already covers the graph, all
tests pass, and the raw suite remains unmodified. Generate and verify the
2026-08-09 seven-day seed locally, record its exact manifest/object hash and
bytes, and confirm the conditional destination preconditions. No AWS write.

## FA05: exactly one stack update

Protected AWS write; requires explicit bundled authorization. Reverify STS,
account, region, policy v5, stack state, template diff/hash, and Node 24. Run
exactly one CDK deployment for the API response-policy update. No retry, policy
v6, IAM change, bootstrap, invalidation, or unrelated mutation.

## FA06: exact conditional preview fixture refresh

After FA05 succeeds, re-read the exact August object's version, ETag, hash,
bytes, content type, cache control, and the versioning state. Require the values
recorded above. Use one conditional `PutObject` with the exact strong ETag to
write only the verified 2026-08-09 through 2026-08-15 non-production fixture.
Record the new version/ETag/hash, read it back exactly, and verify the previous
version remains readable. Do not delete a version, write another object, upload
web assets, or invalidate CloudFront. Use bounded polling until CloudFront
returns the exact new hash and cache/security metadata.

## FA07: final acceptance verification

Run the complete P4D05/RC06/SR05/TR06/V507 read-only checks again. Additionally
require CloudFront API 401 and 405 responses to include exact no-store, public
HTML/data cache contracts to remain unchanged, the isolated state suite to
pass, and the full raw preview suite to pass all 88 tests. Update the log,
commit, and stop for Sol acceptance before T13.

## Stop conditions

Stop for an unexpected synth/policy delta, policy v6 or IAM expansion, failed
fixture precondition, another object/version target, non-fixture data, second
deploy or PutObject, invalidation, web upload, Cognito administration,
production/DNS/Firebase/non-preview mutation, or new dependency.
