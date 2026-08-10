# Phase 4 T16 callback initialization race

Sol plan date: 2026-08-11

## CR01: local session race correction

From this clean Sol handoff, read D046, security, admin auth source/tests, and
SI02 evidence. Update `createAdminSession.initialize` so late getUser resolve or
reject cannot overwrite `processingCallback` or `signedIn`. Add deferred tests
where initialize begins first, callback succeeds, then getUser resolves null or
rejects; require signed-in state, callback destination, token access, and no raw
error. Preserve normal signed-out initialization, retry, PKCE, memory-only user
store, and logout. Run web focused/unit, root check, admin local E2E, diff check;
log/commit. No AWS.

## CR02: preview web-only deployment

After Sol source review, use the accepted preview deployment path with exact
account/region. Deploy the corrected generated web only; do not upload data,
change CloudFormation/IAM, or invalidate CloudFront. Verify exact hash/cache/
headers, raw preview 88, and unchanged data/invalidation inventories. Log/commit.

## CR03: one corrected auth-only execution

After CR02 acceptance, repeat gates and run auth-only once. Require all four
role proofs and zero cleanup. Stop without retry; no data/S3/Firestore/IAM/
CloudFormation/invalidation/CF03/T17.
