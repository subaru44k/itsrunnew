# Phase 4 T16 committed preview adapter

Sol plan date: 2026-08-10

Start clean from this Sol commit with Node 24. Read D040, D039-D028, every T16
plan/evidence, security, API/data schema, test plan, runbook, and implementation
log. No live AWS write occurs in PA01-PA03.

## PA01: proof-bearing coordinator correction

Change the coordinator to validate exact allowlisted stage results rather than
mere promise resolution. Define and test the D040 contracts for preflight,
setup, four form/callback/sentinel role paths, data read/update/stale/public,
restore, and cleanup. Preserve `failureCheckpoint` independently; expose
restore/cleanup progress separately. A successful result requires exactly one
confirmed update PUT, one stale PUT/409 with no retry, one verified restore, and
verified zero cleanup. A possible write or successful write must always activate
restoration-first behavior.

Test resolved invalid/missing results, typed form failure results, every stage
throw/timeout, possible-write throw, restore failure, cleanup failure, ordering,
counts, no-op false-success rejection, and canary non-exposure. Run focused
tests, real Chromium form test, root check, diff check; log and commit.

## PA02: committed secret-free executable and fake adapters

Add a committed preview-only executable under `scripts/migration/`. It must not
accept or read identity/password/token/body values from argv or environment.
Generate two D028 `.invalid` aliases and strong passwords with Node crypto in
the owning process. Bind exact constants for profile `codex-prod`, account
`470447451992`, region `ap-northeast-1`, the deployed pool/client/domain,
CloudFront base URL, admins group, data bucket/key, baseline identifiers/hash,
and D029 cell.

Use only `execFile` arrays. Sensitive Cognito calls use the committed D037
mode-0600 `--cli-input-json file://...` boundary and immediate unlink. Store
original bytes only beneath a mode-0700 temporary directory and delete them in
finally. Use real Playwright code/PKCE pages, the committed form driver and
pre-login recorder, path-only callback proof, visible signed-in/logout and API
state sentinels, no token persistence inspection beyond allowlisted key counts,
and no raw logging. The data adapter owns two authenticated admin contexts,
loads the same exact original ETag, changes only D029's cell, observes one PUT
200, attempts one stale PUT 409, polls public tuple 1, then performs one exact
conditional original-byte restore and polls tuple 0. Cleanup users/group last.

The executable prints one sanitized JSON result only. It requires an explicit
literal execution flag but no secret argument. Export factories so AWS-free
tests can inject fake command/browser/filesystem/clock/network adapters. Tests
cover command allowlists and exact resources, protected input, auth matrix,
update/stale/restore ordering, cleanup on every failure, output schema, and
canary absence from executable/argv/env/result/errors. Run focused tests and
root check; update log and commit. Stop for Sol source review; do not execute.

## PA03: Sol-reviewed baseline and one execution

After Sol accepts PA01/PA02, repeat local tests and read-only exact STS,
pool/group zero, Hosted UI selector, and 501-byte D029 baseline gates. Execute
the committed program exactly once with only its explicit literal flag. Do not
inspect its process, temp files, DOM, request material, or raw CloudTrail.

Require a typed, proof-bearing final result. On pre-data failure, identities are
cleaned and no data call occurs. After a possible write, restore is the only
priority. Independently verify final users/group zero and exact baseline object;
remove temp material. Run required T16 checks, update truthful evidence, commit,
and stop for Sol T16E review.

No retry, IAM/policy/deploy/invalidation/other object/production/DNS/Firebase/
T17 operation is permitted.
