# Phase 4 T16 single-session protected rehearsal

Sol plan date: 2026-08-10

Start clean from the committed Sol handoff with Node 24. Read D034, D028-D033,
all T16 plans/evidence, security, API/data schema, test plan, and runbook.

## SS01: local entry and temporary runner review

Run the eight focused recorder tests, root check, local E2E, and all read-only
AWS/object gates. Require pool/group zero and the exact unchanged D029 object.

Create one temporary runner outside the repository. It may import only installed
Node standard modules and Playwright from the workspace. It must use argument
arrays (no shell), exact account/region/profile/pool/client/group/domain/API/
bucket/key/cell constants, generated credentials, mode-0700/0600 storage,
pre-login BR01 recorder attachment, signed-in sentinels, and sanitized summary
types. Inspect the runner before execution without displaying credential values
(none exist until runtime). Verify explicit `try/finally` cleanup and a guarded
single conditional restore path.

No AWS write in SS01. Record checks and commit only documentation if needed.

## SS02: one-process execution

Run the reviewed temporary process once. Inside that one process, after STS and
baseline recheck:

1. generate credentials and original-byte storage;
2. create the two users, set passwords, add only admin;
3. execute the BR02 four-case alias matrix and unauthenticated 401;
4. load two admin contexts at the same original ETag;
5. perform one 0→1 UI PUT 200 and verify one new version/public freshness;
6. perform one stale UI PUT 409 with no version/retry;
7. verify projected allowlisted audit evidence;
8. perform one exact-key direct `PutObject --if-match <test ETag>` restore with
   original bytes/metadata/checksum;
9. verify exact restored SHA/bytes/parser/value/updatedAt and public freshness;
10. remove membership, delete both users, close browsers, and remove temporary
    credential/original files.

The process outputs only a sanitized result object with role outcomes, status,
counts, durations, ETags/VersionIds/SHA, and booleans. No path, username/email,
credential, query, token/code/claim, header/body, cookie, raw DOM/error/event, or
AWS response object.

If failure occurs before the data PUT, `finally` cleans identities and files.
After the successful data PUT, `finally` attempts the exact restore once before
identity/file cleanup. If restore fails, it must preserve original bytes, not
retry, not delete recovery identities/material, emit only `restore-failed`, and
stop for Sol.

## SS03: independent final readback

After a successful sanitized runner result, independently prove pool/group zero,
restored exact current object and three expected version identities, raw preview
E2E, root check, API no-store, direct S3 denial, alarm/stack, data/invalidation
inventories, no invalidation, `git diff --check`, and clean worktree. Update the
implementation log, commit, and stop before T16E/T17.

Exactly one runner execution is authorized. No retry, password reset, IAM/
policy/deploy/CloudFormation/invalidation, other object/bucket, DeleteObject/
version delete, production/DNS/Firebase, or T17 operation.
