# T16 schedule API cache-metadata correction

## Sol diagnosis

The live admin PUT succeeded, produced the exact one-cell tuple change, and
returned a new ETag/VersionId, but the S3 adapter supplied only
`ContentType: application/json`. S3 replaced the prior object metadata and left
Cache-Control absent. The exact recovery restored the baseline. The product
defect is therefore the missing PutObject CacheControl input.

## CM01: local adapter correction

- Add exact `CacheControl: public, max-age=0, s-maxage=60` to every schedule
  PutObject, preserving `ContentType: application/json`.
- Preserve the discriminated `IfMatch`/`IfNoneMatch` mapping, maxAttempts 1,
  typed key, body, no DeleteObject/ListBucket, and all handler contracts.
- Strengthen the AWS-free S3 adapter test to assert the complete exact
  PutObjectCommand input for update and create, including absence of the
  opposite conditional field and unknown fields.
- Add no dependency and do not change the public web or data schema.

## CM02: local verification and deploy review evidence

Run schedule-api unit/typecheck/build, infra tests/synth, root `npm run check`,
focused/combined T16 tests, and `git diff --check`. Update
`implementation-log.md` and commit coherently. Report the fresh Lambda asset
hash and exact synthesized template diff/resource graph for Sol deployment
review.

## Stop conditions

Only local source, tests, docs, build, and synth are authorized. Do not perform
AWS/network operations, deploy, publish an asset, change IAM/policy,
CloudFormation, Cognito, S3, CloudFront, Firebase, or T17. Stop for Sol review.
