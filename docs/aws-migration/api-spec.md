# Administrator API

Base path: `/api/v1`

Public schedule reads do not use this API. They read CloudFront-hosted JSON.

## Authentication

All endpoints require:

```text
Authorization: Bearer <Cognito access token>
```

API Gateway JWT authorizer validates:

- Cognito issuer.
- App-client audience.
- Token expiry and signature.
- Required write scope.

Lambda then requires `cognito:groups` to contain `admins`.

## Common response

```ts
interface ApiError {
  error: {
    code: string
    message: string
    requestId: string
  }
}
```

Messages must not expose bucket names, AWS request details, stack traces,
tokens, claims, or object contents.

## GET schedule month for editing

```text
GET /api/v1/stadiums/{stadium}/availability/{yearMonth}
```

Purpose: authenticated editor read that returns the current document and ETag.

Success `200`:

```json
{
  "document": {
    "schemaVersion": 1,
    "stadium": "oda",
    "yearMonth": "2026-07",
    "updatedAt": "2026-07-31T03:00:00.000Z",
    "days": {
      "2026-07-31": [1, 2, 0]
    }
  },
  "etag": "\"example-etag\""
}
```

Missing object `404`:

```json
{
  "error": {
    "code": "schedule_not_found",
    "message": "Schedule month does not exist.",
    "requestId": "..."
  }
}
```

## PUT schedule month

```text
PUT /api/v1/stadiums/{stadium}/availability/{yearMonth}
Content-Type: application/json
If-Match: "<etag>"
```

For creation:

```text
If-None-Match: *
```

Request body is `ScheduleMonth`, except the server ignores/replaces:

- `updatedAt` with the server timestamp.

Prefer a request DTO that omits this field:

```ts
interface UpdateScheduleMonthRequest {
  schemaVersion: 1
  stadium: StadiumSlug
  yearMonth: YearMonth
  days: ScheduleMonth['days']
}
```

Success `200`:

```json
{
  "document": {},
  "etag": "\"new-etag\"",
  "versionId": "s3-version-id"
}
```

## Status codes

| Status | Code | Condition |
| --- | --- | --- |
| `200` | none | Read or update succeeded |
| `400` | `invalid_request` | Invalid path, JSON, headers, schema or size |
| `401` | `unauthorized` | Missing or invalid JWT, normally returned by API Gateway |
| `403` | `forbidden` | Valid token without `admins` membership |
| `404` | `schedule_not_found` | Authenticated read of a missing month |
| `409` | `schedule_conflict` | ETag mismatch or create collision |
| `415` | `unsupported_media_type` | PUT is not JSON |
| `429` | `rate_limited` | API throttling |
| `500` | `internal_error` | Sanitized unexpected failure |

## CORS and CloudFront

Production uses the same CloudFront host and `/api/*` behavior, so no
cross-origin request is necessary. During local development, allow only the
configured local Nuxt origin. Never use wildcard origin with credentials.

CloudFront must:

- Forward `Authorization`, `Content-Type`, `If-Match`, and `If-None-Match`.
- Forward query strings only if later specified.
- Disable cache for every API method.
- Permit only GET, PUT, and OPTIONS on `/api/*`.

## Logging

Log structured fields only:

```text
requestId
route
method
status
stadium
yearMonth
actorSubHash
durationMs
s3VersionId on success
```

Do not log the bearer token, raw claims, raw identity attributes, or full
request body.
