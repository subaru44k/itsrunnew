# Phase 4 T16 concrete data executable source review

Sol review date: 2026-08-11

Commit `a267d7b` is a useful coordinator skeleton but is not executable or safe
enough for the one live rehearsal. Complete CF03R01-CF03R04 locally in order.
No AWS command or live mode is authorized during these corrections.

## CF03R01: concrete identity and browser boundary

Direct execution must construct concrete protected Cognito and Playwright
boundaries by default. It must not require an injected `browser` object and
must not accept a complete no-op adapter as proof of direct executability.
Refactor/reuse the reviewed auth executable boundaries without weakening its
tests: create exactly one ephemeral local admin with protected CLI input,
validate the returned internal Username, set its generated in-memory password,
add only that Username to `admins`, and always remove membership/user. Open two
independent desktop Chromium contexts, complete the real Hosted UI callback in
each, and keep all tokens/credentials inside their context/closure.

Both contexts must load the exact existing document/ETag. Context A changes
only `2026-08-09[0]` from 0 to 1 and clicks Save once. Context B submits its
already-loaded stale draft once. Observe only allowlisted API method/path/status
and internally validate response data; never emit request/response bodies,
headers, tokens, URLs, query values, credentials, email, or raw errors.

## CF03R02: exact object capture and restore boundary

Preflight must concretely prove STS account/region, users/group zero, the exact
bucket/key object identity and metadata, parser tuple, and private/versioned
bucket contract. Never manufacture users/admins/tuple/hash proof constants from
an S3 HEAD response. Capture bytes with valid AWS CLI syntax: the `get-object`
destination is the required final positional argument, not `--output`. Verify
the protected directory/file are mode 0700/0600, contained, non-symlink, 501
bytes, exact SHA/parser/updatedAt, and unchanged between final pre-write read
and both browser loads.

The restore command must be exactly one `put-object` for the reserved bucket/key
with `--if-match` set to the observed test ETag, original Content-Type,
Cache-Control, and base64 SHA-256 checksum. No unconditional write,
DeleteObject, wildcard, other bucket/key, or invalidation is possible. Read back
the restored current object and require a new strong ETag/VersionId plus exact
original bytes/hash/parser/updatedAt/tuple.

## CF03R03: coupled proofs and indeterminate recovery

Require the update proof to include exactly status 200, strong quoted ETag,
non-empty new VersionId, `Cache-Control: no-store`, server-controlled valid
`updatedAt`, tuple 1, and exactly one PUT. Require stale status 409,
`Cache-Control: no-store`, exactly one PUT/no retry, and an immediate exact-key
readback whose ETag/VersionId/content equal the successful update. Do not accept
arbitrary truthy stale identities. Bounded CloudFront reads must enforce both
attempt and elapsed-time limits for tuple 1 and restored tuple 0.

If the update boundary returns an indeterminate transport result, immediately
read the exact current object. If it is still the exact baseline, no restore is
needed. If it is exactly the approved one-cell test state, use that observed
strong current ETag for the single restore attempt. Any other state is a typed
recovery-required stop; do not guess or overwrite. After a possible write,
restore/readback is the sole priority before public polling, test assertions,
or identity cleanup.

If restore or restored readback fails, keep the protected original bytes in a
known ignored operator-recovery location with restrictive modes and report only
`recoveryMaterialRetained: true`; do not print its path or contents and do not
delete it in generic cleanup. Identity cleanup may proceed because direct S3
recovery does not require the browser identity. A restore attempt is never
retried.

## CF03R04: deterministic behavior tests and truthful log

Tests must exercise direct construction through injected low-level CLI,
filesystem, browser-launcher, clock/timer, and HTTPS ports, not by replacing the
complete adapter. Keep coordinator unit tests, but they do not satisfy direct
proof alone. Cover exact CLI argv including positional `get-object`, protected
file modes/containment, real identity command sequence/internal Username,
independent contexts, exact one-cell/UI attempts, coupled ETag/VersionId,
no-store/server timestamp, bounded polls, and success cleanup.

Inject failure/indeterminate results at capture, setup, both loads, update,
stale, updated polling, restore, restored readback/polling, and cleanup. Prove
no restore before a possible write; exactly one restore for every approved
post-write state; exact-baseline indeterminate no-write handling; unknown state
fail-closed; restore failure retains original material; and no forbidden
operation, second PUT/restore, other key, delete/list wildcard, or sensitive
value reaches argv except the protected `file://` Cognito input and required
non-secret S3 resource/condition arguments. Result/log/output remain allowlisted.

Run the new focused suite, all existing T16 auth/harness suites,
`npm run check`, `node --check`, and `git diff --check`. Update
`implementation-log.md` to identify `a267d7b` as rejected skeleton and record
the corrected commits/tests. Stop clean for Sol source re-review. Do not run
`--execute-preview-data`, AWS CLI, Cognito, API, S3, deployment, invalidation,
Firestore, IAM, CloudFormation, production, DNS, Firebase, CF04, or T17.

## Second Sol re-review: CF03R05-CF03R08

Commit `64530bd` corrected the first review's filesystem, CLI, identity, and
coordinator skeleton issues, but direct browser/API and recovery behavior still
cannot be executed safely. Complete the following locally before live review.

### CF03R05: observe the real authenticated UI API contract

Do not call native `fetch` from `page.evaluate` for protected API reads; that
request has no Bearer token. Before each Hosted UI login, install an exact
same-origin GET response waiter/recorder. After the signed-in sentinel, consume
the application's authenticated GET response, require 200, application/json,
`Cache-Control: no-store`, bounded JSON, exact schema/object/tuple, and the ETag
from the JSON body. Both independent contexts must retain their own exact
baseline document and ETag.

For context A, observe the exact UI-generated PUT request and response. Require
one request, exact path, Content-Type, strong `If-Match` baseline, no
`If-None-Match`, and a JSON body with only schemaVersion/stadium/yearMonth/days,
no `updatedAt`/unknown field, and exactly the approved one-cell delta. Parse the
200 JSON response body for `document`, `etag`, and `versionId`; these are not
HTTP response headers. Require no-store, valid new server timestamp, exact
one-cell document, strong new ETag, and new VersionId.

For context B, observe exactly one UI PUT 409/no-store and the UI's automatic
authenticated comparison GET 200/no-store. Require the localized conflict UI,
one PUT/no retry, and comparison JSON equal to the approved test document/ETag.
Then perform an exact S3 current read and require its ETag, VersionId, bytes,
hash, and tuple equal the successful update before public polling or restore.

### CF03R06: complete concrete preflight and bounded public reads

Add exact read-only bucket-versioning and public-access-block operations and
require versioning `Enabled` plus all four public block booleans true. Keep the
object-only operation allowlist separate and prohibit listing/deleting. Verify
the final captured original immediately before identity/browser setup.

Implement CloudFront public reads with a real overall deadline that includes
each fetch and body read, retry delays, and all attempts. Use AbortController or
equivalent standard APIs, clear every timer, abort pending requests at the
deadline, and prevent unhandled rejections. Require 200, application/json,
expected cache metadata, bounded body, exact schema, and expected tuple. Add
fake-clock/call-count and permanently-pending fetch/body tests.

### CF03R07: recovery state and material lifecycle

After an indeterminate update, an exact baseline current state may clean the
original with no restore; an exact approved test state must restore once using
its observed ETag; an unknown state must set a typed `recovery-required`
failure, make no speculative restore, set `recoveryMaterialRetained: true`, and
preserve the original. Preserve material as well after restore/readback failure.

Use a known gitignored operator-recovery parent under `.artifacts/migration`
with mode 0700 and a unique contained run directory/file at 0700/0600. Fail if
containment, mode, or symlink checks fail. Generic identity/browser cleanup must
never remove retained recovery material. Output only the retention boolean,
not the path or contents. Successful restore or proven baseline-no-write may
remove the run directory.

### CF03R08: self-contained direct tests

Remove reliance on gitignored pre-existing `.artifacts/preview-seed` content.
Build the exact 501-byte baseline deterministically inside the test or generate
it into a new protected temporary directory, and assert its known SHA. Test the
concrete Playwright boundary through low-level fake launcher/context/page/
response objects, not only a complete browser adapter replacement. Prove the
authenticated GET capture, exact UI request/response parsing, conflict+
comparison sequence, and forbidden-field/delta checks.

Add tests for exact bucket gates, coupled S3 current readback, unknown-state
retention, known recovery directory modes, hanging fetch/body deadlines/timer
cleanup, every post-write failure, and exact single restore. Run all checks from
CF03R04. Update the truthful log and stop clean. The same no-AWS/live-operation
boundary remains absolute.
