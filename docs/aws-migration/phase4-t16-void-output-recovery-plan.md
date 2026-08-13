# Phase 4 T16 void-output recovery

Sol plan date: 2026-08-10

Start clean from the committed Sol handoff with Node 24. Read D036, D035, D034,
the IU02 event evidence, and all protected rehearsal controls.

## VO01: exact CLI adapter proof

Recreate the temporary runner outside Git and type each AWS operation as JSON or
void. Fake successful void operations with empty stdout and prove no parse is
attempted, two users reach confirmed/setup/group state, and cleanup void calls
complete. Add cases for nonempty void stdout rejection, empty JSON rejection,
malformed JSON, nonzero exit, and partial cleanup. Returned test evidence is
sanitized.

Repeat local/read-only/object/pool gates and runner inspection. No AWS write.

## VO02: one corrected bounded execution

Execute the corrected runner exactly once and follow IU02/SS02/SS03 in full.
Commit final sanitized evidence on success or the precise permitted operation/
code category after mandatory cleanup/restore on failure.

All prior single-attempt, restoration-first, secret, data, IAM, deployment,
invalidation, production/DNS/Firebase, and T17 boundaries remain unchanged.
