# Phase 4 T16 AdminGetUser response correction

Sol plan date: 2026-08-11

Start clean from this Sol handoff. Read D042, D041, the concrete final plan, and
CF02 evidence.

## AG01: exact local correction

Change only the AdminGetUser proof to require top-level `Username` equal to the
requested internal Username. Correct fakes and test top-level success plus
missing, nested-only, empty, and mismatched failures; every failure must still
attempt both identity deletions/readbacks and expose only typed output. Run the
focused auth/Chromium suite, root check, diff check, log, and commit. No AWS.

## AG02: one corrected auth-only execution

After Sol source acceptance, repeat the exact zero/baseline gates and execute
the committed auth-only program once. Require the four role proofs and final
zero cleanup. Stop without retry; no S3/data/Firestore/IAM/deploy/invalidation/
production/DNS/Firebase/CF03/T17 operation.
