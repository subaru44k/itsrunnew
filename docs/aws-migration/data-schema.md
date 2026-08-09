# Schedule data contract

## Storage keys

Static stadium configuration is version controlled and generated with the web
application. Mutable availability is stored by month:

```text
data/v1/stadiums/{stadiumSlug}/availability/{YYYY-MM}.json
```

Examples:

```text
data/v1/stadiums/oda/availability/2026-07.json
data/v1/stadiums/oda/availability/2026-08.json
```

A seven-day view fetches at most two monthly documents.

## Types

```ts
type StadiumSlug = 'oda' | 'yumenoshima' | 'komazawa' | 'todoroki'
type AvailabilityStatus = 0 | 1 | 2
type IsoDate = `${number}-${number}-${number}`
type YearMonth = `${number}-${number}`

interface ScheduleMonth {
  schemaVersion: 1
  stadium: StadiumSlug
  yearMonth: YearMonth
  updatedAt: string
  days: Record<IsoDate, [
    AvailabilityStatus,
    AvailabilityStatus,
    AvailabilityStatus
  ]>
}
```

Status values preserve the legacy public contract:

| Value | Meaning |
| --- | --- |
| `0` | Unknown / not published |
| `1` | Available |
| `2` | Unavailable |

There is no persisted `busy` status. Loading is UI state and `-1` is invalid.

Example:

```json
{
  "schemaVersion": 1,
  "stadium": "oda",
  "yearMonth": "2026-07",
  "updatedAt": "2026-07-31T03:00:00.000Z",
  "days": {
    "2026-07-31": [1, 2, 0]
  }
}
```

The document is publicly readable through CloudFront, so it must not contain a
Cognito subject, email address, administrator name, or other actor identifier.
The API writes a one-way hash of the actor subject to structured audit logs,
along with the resulting S3 version ID.

## Validation rules

The shared parser rejects a document unless all conditions hold:

- The top-level value is a plain object.
- No unknown top-level fields exist.
- `schemaVersion` is exactly `1`.
- `stadium` is a known slug and matches the URL/key.
- `yearMonth` matches `^\d{4}-(0[1-9]|1[0-2])$` and matches the URL/key.
- `updatedAt` is a valid ISO timestamp.
- `days` is a plain object with at most 31 entries.
- Every day key is a real Gregorian date in the stated month.
- Every day value is an array of exactly three integers.
- Every status is `0`, `1`, or `2`.
- Serialized UTF-8 payload size is at most 32 KiB.

`-1`, `null`, numeric strings, sparse arrays, extra cells, and dates from
another month are invalid.

## Static stadium configuration

`packages/core/src/stadiums.ts` is the typed source for:

- slug
- legacy Firestore ID during migration
- localized display-name keys
- three display time ranges
- public route
- map embed URL
- contact and content identifiers

Do not store translated editorial content or secrets in mutable S3 JSON.

## Missing data

- Missing monthly object: render all requested dates as unknown and show a
  non-blocking "schedule not published" message.
- Existing monthly object with missing date: that date is unknown.
- Invalid object: do not partially render it; show an error with retry and log
  a sanitized diagnostic.
- Network error: preserve the last successfully loaded week in the UI and show
  retry.

## Loading state

Loading is a discriminated UI state, not a status value:

```ts
type ScheduleLoadState =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'loaded'; schedule: WeekSchedule }
  | { state: 'error'; message: string }
```

## Optimistic concurrency

The data read used by the administrator returns the current S3 ETag through
the API. Update requests must include it:

```text
If-Match: "<etag>"
```

For a new month, use:

```text
If-None-Match: *
```

Lambda passes the condition to S3 `PutObject`. A mismatch returns HTTP `409`
without writing. The administrator reloads, compares, and reapplies the
change. Never perform an unconditional overwrite.

S3 Versioning is enabled in addition to conditional writes. Versioning is the
rollback mechanism; `If-Match` is the concurrent-edit protection.

## Firestore transformation

For each legacy document:

```text
availability/{legacyId}/date/{YYYYMMDD}
```

transform:

```text
legacy stadium ID -> slug
YYYYMMDD -> YYYY-MM-DD
status -> validated tuple
```

Group output by stadium and calendar month. The export tool must:

1. Read without modifying Firestore.
2. Validate every source status tuple.
3. Produce deterministic JSON with sorted day keys.
4. Write a manifest with object path, source count, date range and SHA-256.
5. Fail the whole export on malformed source data unless an explicit,
   reviewed exception is recorded.
6. Never include Firebase credentials in output.

## T14A raw Firestore snapshot contract

The local, credential-free snapshot parser accepts exactly this top-level
shape; no other fields are allowed:

```ts
type RawFirestoreSnapshot = {
  schemaVersion: 1
  collections: Array<{
    slug: 'oda' | 'yumenoshima' | 'komazawa' | 'todoroki'
    legacyId: string
    documents: Array<{
      path: `availability/${string}/date/${string}`
      data: { status: [0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2] }
    }>
  }>
}
```

`collections` contains exactly one descriptor for each `STADIUMS` entry, and
each `legacyId` must match that entry. Empty `documents` arrays are valid.
Document paths must be `availability/{legacyId}/date/{YYYYMMDD}` with a real
Gregorian date, and `data` is a plain object containing only a dense tuple of
three integer statuses. Unknown fields, duplicate dates, sparse tuples,
cross-identity paths, and prototype-bearing objects are rejected.

Normalization emits only `{ slug, date: YYYYMMDD, status }`, sorted by slug and
date. It does not retain capture times, project metadata, credentials, actor
records, tokens, or raw source values in records or validation errors. The
committed synthetic fixture at
`scripts/migration/fixtures/firestore-snapshot.synthetic.json` is test data,
not a production export.
