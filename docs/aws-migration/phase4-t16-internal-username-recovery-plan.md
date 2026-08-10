# Phase 4 T16 internal-Username recovery

Sol plan date: 2026-08-10

Start clean from the committed Sol handoff with Node 24. Read D035, D034, the
single-session plan, runner stop evidence, and all preceding T16 controls.

## IU01: fake-adapter correction proof

Recreate the temporary runner outside Git with the D035 mapping. Before any AWS
write, execute its fake adapter path and prove:

- both create responses are parsed and validated as nonempty internal IDs;
- password/group/get/remove/delete calls receive only internal IDs;
- browser fields receive only aliases;
- partial create/password failure cleanup receives the already-created internal
  ID;
- sanitized output contains neither value nor AWS arguments/errors.

Repeat SS01 local/read-only gates and exact object capture. Inspect the runner's
single-process/finally/restore controls. No AWS write in IU01.

## IU02: one corrected execution and final readback

Execute the corrected runner exactly once, following SS02 in full. On success,
perform SS03 independent verification and commit truthful evidence. On a
pre-data failure, clean identities/material and stop with operation/error-code
category. After data mutation, exact one-attempt restore remains the only
priority and protected original bytes must survive a restore failure.

No password reset/retry, IAM/policy/deploy/CloudFormation/invalidation, other
object/bucket, DeleteObject/version delete, production/DNS/Firebase, or T17.
