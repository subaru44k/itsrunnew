#!/usr/bin/env bash
set -euo pipefail

readonly EXPECTED_ACCOUNT='470447451992'
readonly EXPECTED_REGION='ap-northeast-1'
readonly EXPECTED_BUCKET='itsrunpreviewstack-sitebucket397a1860-khjbgxk7mmdb'
readonly EXPECTED_DISTRIBUTION='E2F8WYHWRDA3NS'
readonly EXPECTED_DOMAIN='d2xryux7a95b54.cloudfront.net'

: "${AWS_REGION:?AWS_REGION is required}"
: "${PREVIEW_BUCKET:?PREVIEW_BUCKET is required}"
: "${PREVIEW_DISTRIBUTION_ID:?PREVIEW_DISTRIBUTION_ID is required}"
: "${PREVIEW_DOMAIN:?PREVIEW_DOMAIN is required}"

[[ "$AWS_REGION" == "$EXPECTED_REGION" ]] || { echo 'Unexpected AWS region.' >&2; exit 1; }
[[ "$PREVIEW_BUCKET" == "$EXPECTED_BUCKET" ]] || { echo 'Unexpected Preview bucket.' >&2; exit 1; }
[[ "$PREVIEW_DISTRIBUTION_ID" == "$EXPECTED_DISTRIBUTION" ]] || { echo 'Unexpected Preview distribution.' >&2; exit 1; }
[[ "$PREVIEW_DOMAIN" == "$EXPECTED_DOMAIN" ]] || { echo 'Unexpected Preview domain.' >&2; exit 1; }
[[ -f dist/index.html && -d dist/assets ]] || { echo 'dist/ is missing or incomplete.' >&2; exit 1; }

caller_account="$(aws sts get-caller-identity --query Account --output text)"
[[ "$caller_account" == "$EXPECTED_ACCOUNT" ]] || { echo 'Unexpected AWS account.' >&2; exit 1; }

bucket_project="$(aws s3api get-bucket-tagging --bucket "$PREVIEW_BUCKET" --query "TagSet[?Key=='Project'].Value | [0]" --output text)"
bucket_environment="$(aws s3api get-bucket-tagging --bucket "$PREVIEW_BUCKET" --query "TagSet[?Key=='Environment'].Value | [0]" --output text)"
[[ "$bucket_project" == 'ItsRun' && "$bucket_environment" == 'Preview' ]] || { echo 'Preview bucket tags do not match.' >&2; exit 1; }

distribution_domain="$(aws cloudfront get-distribution --id "$PREVIEW_DISTRIBUTION_ID" --query Distribution.DomainName --output text)"
distribution_status="$(aws cloudfront get-distribution --id "$PREVIEW_DISTRIBUTION_ID" --query Distribution.Status --output text)"
distribution_origin="$(aws cloudfront get-distribution --id "$PREVIEW_DISTRIBUTION_ID" --query 'Distribution.DistributionConfig.Origins.Items[0].DomainName' --output text)"
[[ "$distribution_domain" == "$PREVIEW_DOMAIN" && "$distribution_status" == 'Deployed' ]] || { echo 'Preview distribution identity or status does not match.' >&2; exit 1; }
[[ "$distribution_origin" == "$PREVIEW_BUCKET.s3.$AWS_REGION.amazonaws.com" ]] || { echo 'Preview distribution origin does not match.' >&2; exit 1; }

aws s3 sync dist "s3://$PREVIEW_BUCKET" \
  --delete \
  --exclude 'index.html' \
  --exclude 'assets/*' \
  --cache-control 'public,max-age=300' \
  --only-show-errors
aws s3 sync dist/assets "s3://$PREVIEW_BUCKET/assets" \
  --delete \
  --cache-control 'public,max-age=31536000,immutable' \
  --only-show-errors
aws s3 cp dist/index.html "s3://$PREVIEW_BUCKET/index.html" \
  --cache-control 'no-cache' \
  --content-type 'text/html' \
  --only-show-errors
aws s3 cp dist/service-worker.js "s3://$PREVIEW_BUCKET/service-worker.js" \
  --cache-control 'no-cache' \
  --content-type 'application/javascript' \
  --only-show-errors

invalidation_id="$(aws cloudfront create-invalidation \
  --distribution-id "$PREVIEW_DISTRIBUTION_ID" \
  --paths '/' '/index.html' '/service-worker.js' '/en/' '/tracks' '/en/tracks' '/oda-field' '/en/oda-field' \
    '/nozomiantena/index' '/en/nozomiantena/index' '/ryuji-miura/index' '/en/ryuji-miura/index' \
  --query Invalidation.Id \
  --output text)"
aws cloudfront wait invalidation-completed --distribution-id "$PREVIEW_DISTRIBUTION_ID" --id "$invalidation_id"
invalidation_status="$(aws cloudfront get-invalidation --distribution-id "$PREVIEW_DISTRIBUTION_ID" --id "$invalidation_id" --query Invalidation.Status --output text)"
[[ "$invalidation_status" == 'Completed' ]] || { echo 'CloudFront invalidation did not complete.' >&2; exit 1; }

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'invalidation_id=%s\n' "$invalidation_id" >> "$GITHUB_OUTPUT"
fi

printf 'Preview content deployed; invalidation %s completed.\n' "$invalidation_id"
