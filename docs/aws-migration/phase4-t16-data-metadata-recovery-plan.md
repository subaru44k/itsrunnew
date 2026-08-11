# T16 CF03 exact metadata-loss recovery

## Sol recovery classification

The execution at `b7bf704` performed the intended API update, but the Lambda
PutObject omitted `Cache-Control`. The runner correctly classified the object as
unknown and retained protected recovery material without attempting a restore.
The current object is uniquely identified as:

- 252 bytes, tuple `1`, AES256, `application/json`, no Cache-Control;
- ETag `"f95b5fa3e287f0b5911b4f517656429e"`;
- VersionId `VnSpdQWZY9IKU.sRz.npUeFLZCt4TAsb`;
- SHA-256 `73893d6015b796eb4212237c0a3afcb56d60ddb20224c17c72ff040e4cdd286b`.

The retained exact original is the 0600 regular file
`.artifacts/migration/t16-data-5pUAiv/capture-2-389e0fd91ec0a794.json`
inside a direct 0700 run directory. It is 501 bytes and has the approved
baseline SHA-256
`ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb`.

## MR01: one conditional recovery

After rechecking STS/profile/region, zero users/admins, bucket versioning/public
blocks, exact current identity above, and exact protected-file containment,
perform exactly one S3 PutObject to the reserved key using:

- the protected original as body;
- `If-Match` equal to the exact current test ETag above;
- `Content-Type: application/json`;
- `Cache-Control: public, max-age=0, s-maxage=60`;
- SHA-256 checksum headers produced from the protected bytes.

Do not retry for any result. Do not delete any version or retained material.

## MR02: recovery proof

Read back the exact key and prove a new strong ETag/new VersionId, 501 bytes,
the approved baseline SHA-256, tuple 0, exact content/cache metadata, and AES256.
Use bounded CloudFront reads to prove tuple 0 and the same hash/metadata. Prove
users/admins 0/0, invalidations still 3, and alarm OK. Record only non-sensitive
identity/hash/metadata evidence in `implementation-log.md` and commit it.

## Stop conditions

Only the single exact conditional recovery PutObject and read-only proof are
authorized. On any mismatch or failure, do not retry and retain the recovery
material. Do not run CF03, create an identity, update another object, delete an
object/version/material, invalidate, deploy, change IAM/CloudFormation, access
Firebase, or begin T17.
