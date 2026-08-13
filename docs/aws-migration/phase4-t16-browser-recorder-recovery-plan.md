# Phase 4 T16 browser recorder recovery

Sol plan date: 2026-08-10

Start clean from the committed Sol handoff, Node 24. Read D033, D028-D032, all
T16 auth evidence, the final rehearsal plan, security, and implementation log.

## BR01: deterministic sanitized recorder

Extend the existing T16 harness with a small dependency-free recorder/normalizer
contract suitable for a Playwright-like page. Attach navigation/response
listeners before login, retain only approved Cognito/CloudFront host and path
plus integer status, and reject/query-strip all other material. Add fake-page
tests proving an immediate callback then history replacement is retained,
listener ordering is before action, duplicate events are deterministic, unknown
hosts/queries do not leak, and cleanup detaches listeners.

No public/runtime source or dependency change. Run focused tests, root check,
local E2E, and `git diff --check`; log and commit.

## BR02: repeat real matrix with signed-in sentinel

Repeat FR01 read-only gates and object capture. Create a fresh D028 pair. For
each email-alias case, attach the BR01 recorder before clicking login, perform
real Hosted UI code/PKCE, require callback in the sanitized sequence, require
the signed-in logout control and admin load form, then execute only GET:
admin desktop/mobile 200, non-admin desktop/mobile 403. Require unauthenticated
401 and all prior storage/leakage boundaries. Keep identities for BR03. Log and
commit sanitized evidence.

## BR03: final data rehearsal and cleanup

Continue FR03 exactly as `phase4-t16-final-rehearsal-plan.md`, using the same
BR01 driver for two authenticated admin contexts: one 0→1 PUT 200, one stale PUT
409/no version, bounded public observation, one conditional exact-byte restore,
bounded restored observation, projected audit evidence, all versions retained,
identity/group/temporary-state cleanup, and final regression/inventory checks.
Commit and stop for Sol T16E review.

Before data write, any failure cleans identities and stops. After data write,
restore is the sole priority and receives one conditional attempt. No
IAM/policy/deploy/CloudFormation/invalidation/other data/production/DNS/Firebase
or T17 operation.
