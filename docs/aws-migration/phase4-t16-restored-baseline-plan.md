# T16 restored baseline identity correction

## Sol diagnosis

The exact recovery restored identical 501-byte content, ETag, metadata, hash,
and tuple, but versioned S3 correctly assigned the new current VersionId
`K7Bf..b6RWTudXarByS0s53Qi3t7E2d6`. The rehearsal constant still names the
pre-recovery VersionId, so its exact preflight would stop before login.

## RB01: current baseline identity

- Replace only `DATA_CONSTANTS.baselineVersionId` with the exact current
  post-recovery VersionId above.
- Preserve baseline bytes/hash/ETag, schema, tuple, key, account/region, and all
  transaction/recovery rules.
- Update deterministic exact-constant and classifier/recovery tests so the old
  VersionId is rejected and the new one is required.

Run focused/combined T16 tests, `node --check`, `npm run check`, and
`git diff --check`; update the chronological log and commit coherently.

## Stop conditions

Only local helper source, tests, and docs are authorized. No AWS/network/live,
Cognito/S3, deploy/invalidation, IAM/CloudFormation, Firebase, or T17 operation.
Stop for Sol review.
