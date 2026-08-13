# Phase 4 T13 Sol review

Review target: `75804cb`

Review date: 2026-08-09

## Result

T13 is not accepted. The first implementation establishes a useful skeleton,
but it does not yet satisfy the committed T13 browser, storage, API, editor,
or test contracts. This review authorizes local source, test, documentation,
and static-build corrections only. It does not authorize any AWS call,
deployment, Cognito administration, real token, or schedule mutation.

## T13R01: OIDC settings and one browser session

1. Keep `oidc-client-ts@3.5.0` as the only added direct dependency.
2. Test the actual `UserManager` settings, not only constants:
   - response type `code`;
   - scopes exactly `openid email profile itsrun/schedule.write`;
   - automatic silent renew disabled;
   - transaction state uses injected session storage;
   - the OIDC `User` and every token use `InMemoryWebStorage` only.
3. Make the OIDC factory browser-lazy and storage-injectable. Importing the
   module, SSR, generation, and unconfigured public pages must not evaluate
   `window` or browser storage.
4. Use exactly one session instance for `/manage` and `/manage/callback` in a
   browser application lifetime. Callback success must update that same
   in-memory session and navigate client-side to the validated internal return
   path. A new component/composable call must not create a new `UserManager`.
5. Process a callback at most once, remove query/fragment callback material on
   both success and failure, and reject external, protocol-relative, encoded,
   backslash, or non-management return paths.
6. Clear the in-memory user before logout redirect and on unloaded, expired,
   or silent-renew-error events. Do not expose the OIDC `User`, raw profile, or
   claims to components; expose only state and the narrow access-token getter.
7. Add deterministic tests for every state, concurrent initialization and
   callback, callback failure/cleanup, safe and hostile return paths, expiry,
   logout success/failure, and sanitized logging. Prove that localStorage,
   sessionStorage, cookies, and IndexedDB do not receive a User or token;
   sessionStorage may contain only transaction/PKCE material.

## T13R02: bounded and exact administrator API client

1. Read every response body incrementally with a hard 32-KiB UTF-8 byte limit.
   `Content-Length` may reject early, but missing, false, or understated length
   must remain bounded. Cancel/release an overflowing or failed stream.
2. Require JSON content type for application responses and parse a bounded
   body only after the status is known. Never surface a raw response or AWS
   error.
3. Require one strong quoted ETag. Reject weak, wildcard, empty, unquoted, and
   multiple ETags. GET success requires the documented document and ETag; PUT
   success additionally requires a non-empty VersionId.
4. Validate the complete response envelope, identity, schema, real dates,
   tuple shape, status values, cross-month dates, and serialized size with the
   shared core parser. Reject unknown envelope fields.
5. Validate the complete outgoing update DTO before fetch. Reject
   `updatedAt`, unknown fields, mismatched identity, malformed days, and a
   serialized body over 32 KiB. Send no unconditional PUT and exactly one of a
   validated `If-Match` or `If-None-Match: *`.
6. Map 400/401/403/404/409/415/429/500, network, invalid JSON, and invalid
   response to stable sanitized kinds. Treat 404 as missing only for GET.
7. Test exact URL/method/header/body contracts, all stadiums, every status,
   absent/false/understated Content-Length, chunk-boundary overflow, stream
   failure, invalid ETags/envelopes/documents, create/update, missing token,
   and absence of forbidden data in errors or logs. Tests must not call AWS or
   preview.

## T13R03: complete editor state and conflict safety

1. Model loading, missing, ready, saving, saved, load failure, save failure,
   forbidden, conflict, comparison failure, and retry as mutually exclusive
   states without discarding a successfully loaded base or unsaved draft.
2. A missing month must create an editable draft containing every real date in
   the selected month (at most 31), with three explicit status values per day.
3. Prevent double save. A save failure preserves the full draft, base, ETag,
   and dirty state. Success atomically replaces base, draft, ETag, updatedAt,
   and VersionId from the validated response.
4. A conflict preserves the original base and full draft, performs one GET for
   the latest version, and never retries PUT. Compute explicit per-cell local
   and latest values. A comparison-fetch failure must also preserve the draft.
5. Reload/discard latest must require confirmation when dirty. The operator
   must be able to keep editing/reapply manually or explicitly replace the
   draft with latest; no silent overwrite is allowed.
6. Add focused tests for missing-month dates (including leap year), dirty
   transitions, double save, every failure state, retry, conflict immutability,
   comparison differences/failure, confirmed reload/discard, and atomic
   success.

## T13R04: accessible localized UI and callback lifecycle

1. Load data when the shared session transitions to signed in, including
   callback navigation. Do not rely on a one-time mounted-state snapshot.
2. Render the correct status semantics already used by core/public pages:
   `0` unpublished/unknown, `1` available, `2` unavailable. Do not introduce
   a conflicting “partly available” meaning.
3. Render all editable dates and three native labeled controls, keyboard focus,
   dirty/save state, server `updatedAt`, and localized Japanese/English text.
4. Render missing, unauthorized/non-admin, loading, invalid response, save
   failure, success, conflict, latest comparison, comparison failure, retry,
   reload, and discard exclusively. Show per-cell conflict values and require
   confirmation before destructive replacement.
5. `/manage` and `/manage/callback` must be `noindex, nofollow` application
   routes and must not weaken canonical/hreflang checks for existing public
   routes. They must never render tokens, claims, subject/email, raw errors,
   bucket/key, stack detail, or request bodies.
6. Add component/browser-visible assertions for both locales, accessible
   names, error exclusivity, technical-error absence, and callback-to-editor
   continuity.

## T13R05: honest local browser suite and E2E command

1. Keep `preview-public-routes.spec.ts` and
   `preview-schedule-states.spec.ts` byte-for-byte unchanged.
2. Make the legacy Playwright config select only the legacy suite instead of
   accidentally running preview tests against Firebase.
3. Add a separate administrator Playwright config and test file. Run a local
   production Nuxt build/server with explicit non-secret fake authority/client
   configuration and narrowly gated test-only OIDC injection. Use Playwright
   routing only in this separate admin suite for API fakes.
4. Cover login URL/settings, callback success and cleanup, no persistent
   tokens/User, configuration/authentication failures, admin GET/edit/update,
   non-admin 403, missing create, stale ETag conflict with no retry and retained
   draft, latest comparison, reload/discard confirmation, logout, and expiry.
   Cover desktop/mobile and Japanese/English where visible text differs.
5. Root `npm run test:e2e` must run the intended legacy regression and local
   admin production-build suite successfully. Preview remains the separate
   explicit command using `PREVIEW_BASE_URL` and must still pass all 88 tests.
6. Test-only injection must default off, be enabled only by the local admin E2E
   configuration, grant no authorization, and never be enabled in the preview
   or generated production output used for deployment.

## T13R06: truthful verification and handoff

Run under Node 24:

```bash
npm ci
npm run test:unit --workspace @itsrun/core
npm run test:unit --workspace @itsrun/web
npm run lint --workspace @itsrun/web
npm run typecheck --workspace @itsrun/web
npm run build --workspace @itsrun/web
npm run check
npm run test:e2e
PREVIEW_BASE_URL=https://d2via50thoheqm.cloudfront.net npm run test:e2e:preview
git diff --check
git status --short
```

Update `implementation-log.md` without removing the first implementation's
failed E2E record. Commit coherent corrections without squashing history and
stop for Sol review. Do not deploy or proceed to T14.

## Stop conditions

Stop without guessing for another dependency, token/User persistence,
unbounded response reads, unconditional or automatic-conflict writes, an
API/data-schema change, real credentials/token, AWS or Cognito operation,
preview data mutation, public-route/SEO/raw-preview weakening, production,
DNS, Firebase, or T14 work.
