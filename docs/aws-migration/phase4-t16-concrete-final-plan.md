# Phase 4 T16 concrete final execution

Sol plan date: 2026-08-11

Start clean from this Sol handoff with Node 24. Read D041, D040-D028, all T16
evidence, security, API/data schema, test plan, and runbook. Do not perform any
Firestore operation. Preserve the exact AWS profile/account/region and preview
resource boundaries.

## CF01: reject the stub and build a concrete auth-only executable

Correct the coordinator proof/count semantics needed by the executable, but do
not rely on `createPreviewAdapters` injections for direct execution. Implement
a committed auth-only executable containing concrete adapters for:

- mode-0700 temporary lifecycle and mode-0600 operation JSON;
- `execFile` AWS CLI JSON/void calls using only `codex-prod` and the exact pool;
- AdminCreateUser response validation and returned internal Username mapping;
- permanent password, group add/remove, get/delete using only internal Username;
- generated in-memory `.invalid` aliases/passwords, never argv/env/output;
- real Chromium desktop/mobile login from `/manage`, pre-login recorder,
  visible form driver, path-only callback, logout/signed-in sentinel;
- exact admin API GET 200 and non-admin API GET 403 with no PUT;
- restoration-free cleanup and final pool/group zero readback.

Direct execution accepts exactly `--execute-preview-auth` and has no injected
dependency requirement. It emits one sanitized allowlisted JSON result. Add
AWS-free fake CLI/browser/filesystem tests plus the real local form fixture.
Prove direct fake execution, internal-ID use, exact six-operation allowlist,
cleanup on each failure, no data/S3 PUT path, typed checkpoint, and canary
absence from source-boundary args/env/output/errors. Run root check, log, commit,
and stop for Sol source review without AWS write.

## CF02: one real auth-only execution

After Sol accepts CF01, repeat exact read-only STS, pool/group zero, Hosted UI
selector, and reserved-object baseline gates. Execute the committed auth-only
program exactly once. No process/temp/DOM/raw-event inspection. Require all four
desktop/mobile role proofs, callback and signed-in sentinels, admin 200,
non-admin 403, no API PUT, cleanup users/group zero, no S3 write, and a typed
result. On failure clean identities and stop; do not retry. Log and commit.

## CF03: concrete data executable and one restored preview rehearsal

Only after CF02 succeeds, implement and fake-test the committed D029 data
executable. It uses two real authenticated admin contexts loaded at the exact
baseline, performs one UI PUT changing only `2026-08-09[0]` 0 to 1, one stale
UI PUT returning 409 without retry, bounded public tuple-1 observation, and one
direct conditional PutObject restoring the protected original bytes/metadata,
then bounded tuple-0 observation. Direct execution accepts exactly
`--execute-preview-data`; it is hard-coded to the one preview object and cannot
list/delete/access another key. Return for Sol source review, then execute once.
After any possible write, restoration is the sole priority.

## CF04: final T16 checks and T17 handoff

Independently verify users/group zero, exact original object, no invalidation,
private S3, API no-store, alarm/stack, raw preview E2E, root check, diff check,
and clean worktree. Record T16 complete and stop for Sol T17 plan. No additional
Firestore export/comparison/history work is required.

No retry, IAM/policy/deploy/invalidation/other object/production/DNS/Firebase
state mutation/T17 is permitted until its stated boundary.
