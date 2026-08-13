# Phase 4 T16 sanitized browser substage

Sol plan date: 2026-08-11

## BS01: typed local browser failures

Implement D044 with an exact category/viewport allowlist. Preserve categories
through the coordinator result without raw messages. Add injected tests for
form, callback, final manage, signed-in, missing API response, and unexpected
status failures, plus canary non-exposure. Do not change the working login/PKCE/
form sequence. Run focused/Chromium, root and diff checks; log/commit. No AWS.

## BS02: one auth-only execution

After Sol acceptance, repeat zero/baseline gates and execute once. If successful
require all four role proofs; otherwise retain only the typed substage and clean
to zero. No retry or data/S3/Firestore/IAM/deploy/invalidation/CF03/T17.
