#!/usr/bin/env bash
set -euo pipefail

readonly EXPECTED_ACCOUNT='470447451992'
readonly EXPECTED_REGION='ap-northeast-1'

: "${AWS_REGION:?AWS_REGION is required}"
: "${PRODUCTION_BUCKET:?PRODUCTION_BUCKET is required}"
: "${PRODUCTION_DISTRIBUTION_ID:?PRODUCTION_DISTRIBUTION_ID is required}"
: "${PRODUCTION_DOMAIN:?PRODUCTION_DOMAIN is required}"
: "${PRODUCTION_URL:?PRODUCTION_URL is required}"

[[ "$AWS_REGION" == "$EXPECTED_REGION" ]] || { echo 'Unexpected AWS region.' >&2; exit 1; }
[[ "$PRODUCTION_URL" == "https://$PRODUCTION_DOMAIN" ]] || { echo 'Production URL and domain do not match.' >&2; exit 1; }
[[ -f dist/index.html && -d dist/assets ]] || { echo 'dist/ is missing or incomplete.' >&2; exit 1; }

caller_account="$(aws sts get-caller-identity --query Account --output text)"
[[ "$caller_account" == "$EXPECTED_ACCOUNT" ]] || { echo 'Unexpected AWS account.' >&2; exit 1; }

bucket_project="$(aws s3api get-bucket-tagging --bucket "$PRODUCTION_BUCKET" --query "TagSet[?Key=='Project'].Value | [0]" --output text)"
bucket_environment="$(aws s3api get-bucket-tagging --bucket "$PRODUCTION_BUCKET" --query "TagSet[?Key=='Environment'].Value | [0]" --output text)"
[[ "$bucket_project" == 'ItsRun' && "$bucket_environment" == 'Production' ]] || { echo 'Production bucket tags do not match.' >&2; exit 1; }

distribution_domain="$(aws cloudfront get-distribution --id "$PRODUCTION_DISTRIBUTION_ID" --query Distribution.DomainName --output text)"
distribution_status="$(aws cloudfront get-distribution --id "$PRODUCTION_DISTRIBUTION_ID" --query Distribution.Status --output text)"
distribution_origin="$(aws cloudfront get-distribution --id "$PRODUCTION_DISTRIBUTION_ID" --query 'Distribution.DistributionConfig.Origins.Items[0].DomainName' --output text)"
distribution_aliases="$(aws cloudfront get-distribution --id "$PRODUCTION_DISTRIBUTION_ID" --query 'Distribution.DistributionConfig.Aliases.Items' --output text)"
[[ "$distribution_status" == 'Deployed' ]] || { echo 'Production distribution is not deployed.' >&2; exit 1; }
[[ "$distribution_origin" == "$PRODUCTION_BUCKET.s3.$AWS_REGION.amazonaws.com" ]] || { echo 'Production distribution origin does not match.' >&2; exit 1; }
if [[ "$PRODUCTION_DOMAIN" == 'itsrun.info' ]]; then
  [[ "$distribution_aliases" == *'itsrun.info'* ]] || { echo 'Production alias is not attached.' >&2; exit 1; }
else
  [[ "$PRODUCTION_DOMAIN" == "$distribution_domain" ]] || { echo 'Production verification domain does not match.' >&2; exit 1; }
fi

aws s3 sync dist "s3://$PRODUCTION_BUCKET" \
  --delete \
  --exclude 'index.html' \
  --exclude 'assets/*' \
  --cache-control 'public,max-age=300' \
  --only-show-errors
aws s3 sync dist/assets "s3://$PRODUCTION_BUCKET/assets" \
  --delete \
  --cache-control 'public,max-age=31536000,immutable' \
  --only-show-errors
aws s3 cp dist/index.html "s3://$PRODUCTION_BUCKET/index.html" \
  --cache-control 'no-cache' \
  --content-type 'text/html' \
  --only-show-errors
aws s3 cp dist/service-worker.js "s3://$PRODUCTION_BUCKET/service-worker.js" \
  --cache-control 'no-cache' \
  --content-type 'application/javascript' \
  --only-show-errors

invalidation_id="$(aws cloudfront create-invalidation \
  --distribution-id "$PRODUCTION_DISTRIBUTION_ID" \
  --paths '/' '/index.html' '/service-worker.js' '/en/' '/tracks' '/en/tracks' '/oda-field' '/en/oda-field' \
  --query Invalidation.Id \
  --output text)"
aws cloudfront wait invalidation-completed --distribution-id "$PRODUCTION_DISTRIBUTION_ID" --id "$invalidation_id"
invalidation_status="$(aws cloudfront get-invalidation --distribution-id "$PRODUCTION_DISTRIBUTION_ID" --id "$invalidation_id" --query Invalidation.Status --output text)"
[[ "$invalidation_status" == 'Completed' ]] || { echo 'CloudFront invalidation did not complete.' >&2; exit 1; }

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'invalidation_id=%s\n' "$invalidation_id" >> "$GITHUB_OUTPUT"
fi

printf 'Production content deployed to %s; invalidation %s completed.\n' "$PRODUCTION_URL" "$invalidation_id"
