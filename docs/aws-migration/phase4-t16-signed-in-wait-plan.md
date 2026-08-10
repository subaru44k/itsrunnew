# Phase 4 T16 signed-in hydration wait

Sol plan date: 2026-08-11

## SI01: bounded sentinel wait

Implement D045 with a testable locator visibility wait after final `/manage`.
Test delayed success and bounded timeout without fixed sleeps/raw material.
Preserve all auth/API/cleanup behavior. Run focused/Chromium, root/diff checks,
log/commit. No AWS.

## SI02: one auth-only execution

After Sol acceptance, repeat gates and run once. Require all four role proofs
and zero cleanup or return the typed failure. No retry or data/S3/Firestore/
IAM/deploy/invalidation/CF03/T17.
