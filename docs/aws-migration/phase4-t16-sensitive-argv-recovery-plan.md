# Phase 4 T16 sensitive-argv recovery

Sol plan date: 2026-08-10

Start clean from the committed Sol handoff with Node 24. Read D037, D036-D034,
all T16 rehearsal plans, security, and the incident evidence.

## SA01: tested protected-input boundary

Extend the committed T16 harness with a dependency-free pure boundary for
sensitive Cognito CLI operations: validate operation and a file path under a
supplied protected temporary root, return arguments containing only
`--cli-input-json file://<path>`, and keep payload creation behind an injected
0600 writer. Tests must use unmistakable canary alias/password/internal ID and
prove canaries are absent from executable, argv, env, outcome, and errors;
reject outside-root/symlink/non-0600 paths and unknown operations.

Recreate the temporary runner with operation-specific protected JSON files,
immediate unlink, JSON/void typing, internal-ID administration, BR01 recorder,
signed-in sentinels, restoration-first finally, and sanitized stable failure
category. Run all fake adapter paths and local/read-only gates. No AWS write.
Commit harness/tests/log coherently.

## SA02: one protected bounded execution

Execute the reviewed corrected runner exactly once. Do not inspect its process
arguments or environment. Observe only its sanitized final result and independent
AWS counts. Follow VO02/SS02/SS03 fully, including the auth matrix, conditional
update/stale conflict, exact one-attempt restore, identity cleanup, and final
readback.

On any pre-data failure, cleanup users/files and stop with operation/code only.
After data write, exact restore remains the sole priority. All existing no-retry,
IAM/deploy/invalidation/other-data/production/DNS/Firebase/T17 boundaries apply.
