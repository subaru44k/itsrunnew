# Phase 4 T14F protected upload plan

Sol planning baseline: `f1e805a`

## Accepted input

T14E is accepted. Two replacement Firestore captures are stable at 1,854
records with normalized-data SHA-256
`e6686893ef5b7ecf6be4de0511decb145975bda04bb22267680c4eec10171a9f`.
The T14B output contains 74 monthly objects, and T14C compared 5,562 cells with
zero differences. Google ADC, the temporary service account, both temporary
bindings, and the task-only IAM Credentials API state have been retired.

T14F targets only:

- profile: `codex-prod`;
- account: `470447451992`;
- region: `ap-northeast-1`;
- bucket: `itsrun-preview-data-470447451992-ap-northeast-1`;
- prefix: `data/v1/stadiums/{oda|yumenoshima|komazawa|todoroki}/availability/`;
- CloudFront domain: `d2via50thoheqm.cloudfront.net`;
- exact 74 keys in the accepted manifest, spanning `20180525..20220906`.

This is production-derived schedule data in the existing preview data bucket.
It does not select a production hostname or change production DNS.

## T14F01: local sealed-run and execution adapter

Before any AWS access, Luna implements and tests the missing protected runtime
boundary without adding a dependency:

1. Create a new ignored sealed upload run containing exactly the accepted
   `manifest.json` and its 74 object bodies. Do not include the raw Firestore
   snapshot, capture metadata, comparison reports, credentials, or another
   file. Re-read and verify every byte count and SHA-256 while sealing.
2. Add an explicit Node 24 runner around the accepted T14D helper. Use
   `execFile`/argument arrays, never a shell command, and bound AWS stdout,
   stderr, JSON, response bodies, attempts, and total CloudFront time.
3. Hard-code or exact-validate the profile, account, region, bucket, domain,
   manifest hash, object count, and allowed prefix. User-supplied alternate
   targets, arbitrary AWS commands, environment credentials, and extra files
   fail before AWS access.
4. Before the first write, issue an exact-key read-only existence preflight for
   all 74 manifest keys. Every key must be absent. An existing key, ambiguous
   403, malformed response, permission failure, or incomplete preflight stops
   with zero writes.
5. Keep `If-None-Match: *` on every `PutObject`. A race/collision or any other
   failure stops the sequence and never retries, overwrites, deletes, copies,
   syncs, or broadens the target.
6. Write machine and human reports atomically to a separate ignored report
   directory. Reports may contain typed public keys, SHA-256, ETag, VersionId,
   counts, and sanitized failure stage/category, but no bodies, local paths,
   credentials, principal, raw AWS error, or stack.

AWS-free tests cover sealed-run traversal/symlink/extra-file/hash rejection,
exact 74-key ordering, all-absent preflight, existing/403/malformed/partial
preflight, no write before all keys are absent, exact subprocess arguments,
bounded output, conditional collision, partial-write stop, exact-version
readback, CloudFront deadline, report atomicity, and forbidden commands.

Stop for Sol review after T14F01. No AWS call is authorized by this local task.

## T14F02: protected read-only preflight

After local acceptance and bundled user authorization:

1. use only `AWS_PROFILE=codex-prod` and region `ap-northeast-1`;
2. verify STS account `470447451992` immediately before the protected run;
3. read CloudFormation outputs and require the exact bucket/domain above;
4. require bucket versioning enabled and public access blocked;
5. run the helper's complete exact-key absence preflight and require 74/74
   absent before the first write.

Access denial or a present/ambiguous key stops with zero writes. Do not add IAM
permissions or reinterpret 403 as absence.

## T14F03: one conditional upload and complete verification

If T14F02 succeeds, permit at most one `PutObject` for each of the exact 74
manifest keys, in deterministic order, with `If-None-Match: *`, exact JSON
content type, and `public, max-age=0, s-maxage=60`.

For every successful object, require a strong ETag and VersionId, read that
exact version back with a 32 KiB bound, and verify SHA-256 and the core parser.
After all 74 exact-version reads pass, verify all 74 through CloudFront HTTPS
with bounded retry/deadline, status 200, JSON content type, exact cache
directives, at-most-60-second age, SHA-256, stadium/month identity, and parser.

No invalidation is necessary because the 74 keys passed the all-absent gate.
Do not retry a conditional write. If a non-collision failure occurs after a
proper subset was created, record the exact sanitized prefix and stop. No
automatic DeleteObject or overwrite rollback is authorized; S3 versioning
retains all successfully created evidence pending a separate Sol decision.

## T14F04: evidence and handoff

Commit only sanitized manifest/report summaries. Keep schedule bodies, raw
captures, detailed runtime reports, ETags, and VersionIds ignored until Sol
reviews their retention need. Re-run focused migration tests, core tests, root
check, preview public E2E, diff check, and require a clean worktree.

On full success, mark T14 complete and stop for Sol review before T15/T16.

## Bundled authorization boundary

One user acceptance may authorize T14F01 through T14F04 as a bundle, including
the read-only AWS preflight and at most 74 conditional first-creation writes.
It does not authorize IAM/policy changes, CloudFormation/deploy/bootstrap,
invalidation, overwrite, delete, copy/sync, API/Lambda writes, Cognito
administration, production hostname/DNS, Firebase access, or a second upload
run.

## Stop conditions

Stop without guessing for a new dependency, source/manifest/hash mismatch,
unsealed or extra artifact, unexpected target/output, STS/region/output drift,
missing AWS permission, any present or ambiguous key, bucket safety/versioning
failure, conditional collision, partial upload, readback/CloudFront mismatch,
need for invalidation, IAM expansion, overwrite/delete, or non-preview impact.

## Required checks

```bash
npm ci
npm run test:unit --workspace @itsrun/core
npx vitest run scripts/migration/firestore-*.test.mjs
npm run check
PREVIEW_BASE_URL=https://d2via50thoheqm.cloudfront.net npm run test:e2e:preview
git diff --check
git status --short
```
