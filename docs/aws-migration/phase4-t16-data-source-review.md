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
