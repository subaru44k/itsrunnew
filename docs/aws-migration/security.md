# Security requirements

These requirements are release blockers.

## Trust boundaries

```text
Untrusted:
  browser input
  route parameters
  JSON fetched from storage
  JWT claims until API Gateway validation
  legacy Firestore data until migration validation

Trusted only after validation:
  API Gateway JWT context
  shared schedule parser output
  CDK-generated resource identifiers
```

## S3

- Enable Block Public Access on both buckets.
- Use bucket-owner enforced object ownership; do not use ACLs.
- Grant CloudFront access using Origin Access Control, not an S3 website
  endpoint and not legacy OAI.
- Enforce TLS.
- Enable versioning on the data bucket.
- Lambda write permission is restricted to:
  `data/v1/stadiums/*/availability/*.json`.
- Lambda receives no `s3:DeleteObject` or bucket-policy permissions.
- CI deploy role can write web artifacts but cannot write schedule data.
- API role can write schedule data but cannot write web artifacts.
- Use conditional writes for updates.

## Cognito and API

- Use Authorization Code + PKCE; do not use implicit flow.
- Do not store access or refresh tokens in localStorage.
- Keep tokens in memory; if persistence becomes necessary, pause for Sol
  review before adding it.
- Disable unauthenticated identities and Cognito Identity Pools.
- Disable local public sign-up.
- Create local Cognito users only through an approved operator workflow.
- Authentication alone is not authorization.
- Require the Cognito `admins` group in Lambda.
- Never infer administrator membership from an email address or domain.
- Reject ID tokens when an access token and scope are required.
- Validate route values before constructing an S3 key.
- Construct keys only from parsed enum/date values, never raw path text.
- Enforce request and serialized-object size limits.
- Return generic errors.

## Browser security

CloudFront response headers must include at least:

- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- A reviewed `Content-Security-Policy`
- `Permissions-Policy`
- Framing protection through CSP `frame-ancestors`

CSP must explicitly account for only the providers actually retained:

- Google Maps iframe.
- Google AdSense script/frame endpoints if advertising remains enabled.
- GA4 endpoints only if a GA4 ID is supplied.
- Cognito Hosted UI for `/manage`.

Do not weaken CSP globally to solve a single third-party integration. If
AdSense makes a meaningful CSP impossible, document the tradeoff for Sol.

All external links opened in a new tab use `rel="noopener noreferrer"`.

## Secrets

- No AWS access keys in GitHub secrets or source.
- GitHub Actions assumes a deployment role through GitHub OIDC.
- Do not add a Google OAuth client, external IdP secret, or Secrets Manager
  dependency for administrator authentication under D012.
- `.env.example` contains names only, never values.
- Never commit Firebase service-account credentials or exported user records.
- Scrub generated artifacts and logs before committing.

## IAM review checklist

Phase 3 and Phase 5 Sol reviews verify:

- Every role is used.
- No `Action: "*"`.
- No `Resource: "*"` except where an AWS API strictly requires it and the
  reason is documented.
- CI trust policy restricts repository and branch/ref.
- CloudFront OAC bucket policy restricts the distribution ARN.
- Lambda role cannot change infrastructure.
- Web deployment role cannot access Cognito secrets or schedule objects.
- Log retention is finite.

## Abuse and operational controls

- API Gateway throttles administrator writes.
- Lambda times out quickly and has bounded memory.
- CloudWatch alarms on authorization anomalies are optional; 5xx alarm is
  required for production.
- Add AWS Budgets outside CDK or in a dedicated billing stack if account
  permissions allow. Budget setup is operational and must not block local
  implementation.
- Do not add WAF initially. Reconsider only with observed abuse or a specific
  requirement.

## Required security tests

- Unauthenticated API read and write are rejected.
- Authenticated non-admin is rejected.
- Admin can read and update.
- Invalid stadium and month cannot influence the S3 key.
- Unknown fields and oversized documents are rejected.
- `-1`, strings, arrays of the wrong length, invalid dates and cross-month
  dates are rejected.
- Stale ETag returns conflict without changing S3.
- New document requires `If-None-Match: *`.
- Web and data buckets synthesize with public access blocked.
- Lambda role has no delete action.
- API CloudFront behavior disables cache.
