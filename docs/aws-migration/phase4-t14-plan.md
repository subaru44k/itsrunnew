# Phase 4 T14 data migration plan

Sol planning baseline: `e4e13e6`

Plan date: 2026-08-09

## Entry gate and authority boundary

T14 depends on the accepted T12 API/data contract. Its pure transformer,
fixture, parser, comparison, report, and AWS-free upload-command tests can be
implemented after the P4D deployment review without a Firestore credential or
AWS write. Production export, preview/production schedule upload, readback,
restore, and Firebase access remain separate protected operations.

The existing `export-firestore.mjs` is intentionally blocked because
`firebase-admin` and a read-only credential have not been approved or
provided. Do not install `firebase-admin`, read Firebase, request a credential,
or change AWS while implementing T14A-T14D. That boundary is T14E.

No new application runtime dependency is permitted. Prefer pure Node standard
library code and deterministic AWS CLI argument builders for migration-only
operations. Do not add the AWS SDK to the public web or migration script
package.

## Canonical artifacts and privacy contract

All local artifacts live under ignored `.artifacts/migration/` unless a small
synthetic fixture is deliberately committed under a test fixture directory.
Never commit raw production exports, Firebase credentials, access tokens,
administrator/user records, or production schedules.

The pipeline uses four distinct artifacts:

1. raw read-only Firestore snapshot with sorted document paths and decoded
   document data;
2. normalized source records containing only validated legacy stadium ID,
   `YYYYMMDD`, and three status values;
3. deterministic target monthly JSON plus a machine-readable manifest;
4. comparison/upload/readback reports, with a human-readable summary derived
   from the machine report.

Volatile execution time, local paths, credentials, tokens, and host details
must not influence target bytes or their SHA-256 values. `updatedAt` is an
explicit required migration input recorded once for a run; rerunning the same
snapshot with the same value must produce byte-identical output.

## T14A: fixture and strict legacy snapshot parser

1. Extract a pure parser/normalizer from the current export script boundary.
2. Define and document the exact raw snapshot schema used by the exporter.
3. Map the four legacy IDs only through `STADIUMS`; reject an unknown,
   duplicate, missing, or slug/legacy-ID mismatch.
4. Accept only document paths matching
   `availability/{legacyId}/date/{YYYYMMDD}` and plain objects with exactly one
   `status` field.
5. Require a real Gregorian `YYYYMMDD` and an exact dense three-element tuple
   of integer statuses 0, 1, or 2. Reject `-1`, strings, null, sparse/short/long
   arrays, cross-identity data, unknown fields, and conflicting duplicates.
6. Sort normalized records by slug/date independent of Firestore return order.
7. Add a fully synthetic four-stadium fixture covering month/year/leap-day
   boundaries. Do not copy current production values into the repository.

AWS/Firebase-free tests must cover every rejection above, permutation/order
independence, all stadium mappings, empty collections, and sanitized errors
that do not echo raw records or credentials.

## T14B: deterministic monthly transformation and manifest

Sol accepted T14A through `108f9c5` and `de5db05`. The strict four-stadium
snapshot contract, sanitized normalizer, synthetic fixture, permutation
independence, and complete rejection matrix passed 14 focused tests under Node
24. T14B may proceed without Firebase or AWS authority.

1. Group validated records by stadium and calendar month and build only typed
   `data/v1/stadiums/{slug}/availability/{YYYY-MM}.json` keys.
2. Require one explicit ISO `updatedAt` argument for the migration run. Do not
   call the current clock inside the pure transformer.
3. Sort object keys and day keys; use one documented JSON indentation/newline
   format. Pass every object through `parseScheduleMonth` and the 32-KiB limit.
4. Create a canonical manifest containing schema version, source identity
   label, explicit migration timestamp, total source count/date range, and for
   every object: key, stadium, month, source count/date range, bytes, SHA-256,
   content type, and `public, max-age=0, s-maxage=60` metadata.
5. Fail the whole transformation on any invalid record or size violation. Do
   not emit a partial successful manifest.
6. Write atomically into a newly created run directory; refuse to reuse a
   non-empty output directory.

Tests must prove byte-for-byte determinism across repeated runs and input
permutations, exact counts/date ranges/hashes, parser acceptance, stable
serialization, and no credential or actor data in output.

## T14C: exhaustive source/target comparison and reports

Implement a pure comparator that checks, for every normalized source record
and every one of its three cells:

- exactly one expected target object and date exist;
- status values match exactly;
- no unexplained target date, cell, month, stadium, or object exists;
- every target object identity, parser result, byte count, and SHA-256 matches
  the manifest;
- aggregate source-document count, transformed-day count, and compared-cell
  count are exact.

The machine-readable report records deterministic counts and a sorted list of
sanitized mismatch coordinates (`stadium`, `date`, `slot`, expected/actual).
It must not include credentials, raw source documents, local paths, bucket
names, or tokens. Generate the human-readable report solely from the machine
report so the two cannot disagree.

Exit nonzero for any unexplained difference. Tests cover missing/extra/changed
cells and objects, manifest tampering, hash/size mismatch, deterministic report
ordering, and the zero-difference fixture.

## T14D: fail-closed conditional upload and readback tooling

1. Build deterministic `aws s3api put-object` arguments using exact manifest
   keys, `application/json`, cache metadata, and `--if-none-match '*'`. Never
   use `aws s3 sync`, unconditional `s3 cp`, wildcard keys, delete, or an
   overwrite option.
2. Require explicit profile, account, region, bucket, manifest, and run
   directory. Resolve and validate every local path under the run directory.
3. Before a later authorized write, verify STS account and region and confirm
   the target is the reviewed data bucket. Do not infer production targets.
4. A precondition failure or collision stops the entire run. Do not retry a
   conditional conflict and do not fall back to overwrite.
5. Record the returned ETag and VersionId for each successful object, then
   read that exact version back from S3 into memory with a byte bound and
   compare SHA-256/parser identity.
6. Read representative/all configured objects through CloudFront HTTPS with
   bounded retries and verify 200, JSON content type, exact cache metadata,
   hash, and at-most-60-second freshness contract.
7. Produce an upload/readback report without bodies, credentials, tokens,
   local paths, or raw AWS errors. A sanitized failure report may name the
   typed object key but not a credential or caller secret.
8. Keep S3 version restore as a separate explicit operation for T16. This
   task may generate and test restore commands with fakes but must not execute
   them.

Tests mock the process/fetch boundary and cover exact argument arrays,
account/region/bucket mismatch, traversal, conditional collision, missing
ETag/VersionId, readback/hash/parser/cache failures, timeout, no DeleteObject,
and no write after a preflight failure. They must not connect to AWS.

## T14E: protected Firestore export decision and execution gate

Stop and return to Sol after T14A-T14D. Before production export, the user must
approve one concrete read-only mechanism and provide its non-secret reference
or operator procedure. The current candidate is a temporary exact-pinned
`firebase-admin` migration-only development dependency with a least-privilege
read-only credential kept outside Git. Because that dependency is not in the
current architecture allowlist, it requires a separate decision entry before
installation.

The approved exporter must:

- authenticate only to Firebase project `itsrun-aaf42` with read-only access;
- enumerate only `default/0`, `stadium_info`, and the four documented
  `availability/{legacyId}/date` collections;
- perform no create/update/delete/listener/auth-user operation;
- sort documents deterministically and write only the raw snapshot contract;
- never print or copy the credential/token into logs or artifacts;
- support two successive read-only exports whose normalized data hashes can be
  compared, while keeping capture metadata outside the normalized-data hash;
- destroy or revoke the temporary credential through an operator-controlled
  process after verified migration.

If the real source violates the documented schema, do not add coercion or an
exception silently. Record exact sanitized coordinates/counts and stop for a
Sol decision.

## T14F: protected upload and verification gate

After Sol accepts the real export and zero-difference comparison report, one
separate authorization must name the destination bucket/prefix and overwrite
policy. The first production-data migration uses only `If-None-Match: *` and
must stop on any existing object; it does not authorize overwrite, delete,
dual-write, invalidation, production DNS, or Firebase change.

Run the complete transform, compare, conditional upload, exact-version S3
readback, and CloudFront verification. Commit only sanitized manifests/reports
approved for source control, never the production snapshot or schedule body.

## Local checks and handoff

T14A-T14D must expose focused Vitest tests and root commands without adding a
new workspace or build orchestrator. Run under Node 24:

```bash
npm ci
npm run test:unit --workspace @itsrun/core
npx vitest run scripts/migration/*.test.mjs
npm run check
git diff --check
git status --short
```

Update `implementation-log.md` and commit coherent milestones without
squashing history. The handoff reports commits, tests, exact artifact schemas,
dependency changes (expected: none), deterministic hashes/counts from the
synthetic fixture, protected operations not attempted, and clean worktree.

## Stop conditions

Stop without guessing for any new dependency, production credential, Firebase
read, AWS write, existing-object collision, malformed production record,
unexplained comparison difference, overwrite/delete/dual-write need, broader
IAM, schedule-data mutation, invalidation, production hostname/DNS, or
Firebase-state change not explicitly authorized for that protected gate.
