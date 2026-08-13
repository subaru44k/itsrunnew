# Phase 4 T13 administrator UI plan

Sol planning baseline: `2b86639`

Plan date: 2026-08-09

## Entry gate and authority boundary

This plan is ready for Luna implementation only after P4D03-P4D06 in
`phase4-t12-deploy-plan.md` complete and Sol accepts the first T11/T12 preview
deployment. Preparing this plan does not authorize T13 implementation or any
AWS write.

T13 is local source, test, documentation, and static-build work. A later,
separate Sol review may authorize one preview web deployment. The task does
not authorize Cognito user or group changes, schedule-data writes, IAM or
CloudFormation changes, CloudFront invalidation, production/DNS changes, or
Firebase access.

The only new runtime dependency is exact-pinned `oidc-client-ts@3.5.0`, which
is already allowed by `architecture.md`. Do not add Amplify, an AWS SDK, an
authentication framework, a state store, a UI/form framework, a validation
library, or a date library to the web application.

## Authentication and browser-storage contract

- Use the Cognito User Pool issuer and public app-client ID from reviewed
  stack outputs as non-secret Nuxt public runtime configuration.
- Derive the callback and logout return URLs from the current browser origin:
  `/manage/callback` and `/manage`. They must match the stack parameters for
  the environment under test.
- Use Authorization Code + PKCE through Cognito Hosted UI. Never request or
  implement implicit or client-credentials flow.
- Keep the authenticated `User`, access token, ID token, and refresh token in
  an in-memory user store only. A full page reload ending the session is an
  accepted consequence of the release-blocking no-persistence rule.
- Browser `sessionStorage` may hold only the short-lived OIDC authorization
  request state and PKCE transaction material needed across the Hosted UI
  redirect. It must not hold a `User` or any token. Clear completed or failed
  callback state.
- Do not use `localStorage`, cookies, IndexedDB, service workers, or URL
  parameters for token persistence. Do not log authorization URLs containing
  state, callback parameters, tokens, claims, user profile, or API bodies.
- The UI may use authentication state to decide what to render, but it must
  not treat that as authorization. API Gateway and Lambda remain authoritative
  and the UI must render a sanitized non-admin response from the API.

## T13A: client boundary and deterministic configuration

1. Install only exact-pinned `oidc-client-ts@3.5.0` in `@itsrun/web`.
2. Add explicit non-secret public runtime configuration for:
   - Cognito issuer/authority;
   - Cognito public app-client ID;
   - the existing same-origin API base path `/api/v1`.
3. Fail closed with a localized configuration error when required Cognito
   values are absent. Public pages and the static build must continue to work
   without administrator configuration.
4. Define a small injected OIDC port and a `.client.ts` implementation around
   `oidc-client-ts`. Instantiate browser-only objects lazily; SSR, generation,
   and unit tests must not access `window` during module evaluation.
5. Configure scopes exactly as `openid email profile
   itsrun/schedule.write`, response type `code`, in-memory user storage, and
   transaction-only session storage.

Tests must prove exact settings, no token-bearing persistent store, safe
server import/generation, exact callback/logout URLs, and sanitized handling
of missing configuration and callback failure.

Commit source, lockfile, tests, and the T13A log entry coherently.

## T13B: in-memory session state and callback lifecycle

Implement `useAdminSession.client.ts` as a dependency-injected state machine:

```text
unconfigured -> signedOut -> redirecting -> processingCallback -> signedIn
                                      \-> sanitizedError
signedIn -> signingOut -> signedOut
```

- Deduplicate concurrent initialization and callback handling.
- `login()` starts the PKCE redirect and preserves only a validated internal
  return path.
- `/manage/callback` processes the response once, removes callback parameters,
  and uses client-side navigation to `/manage` so the in-memory user survives.
- Reject external return URLs, protocol-relative paths, encoded redirect
  tricks, and non-admin application paths.
- `logout()` clears the in-memory user before navigating to the Cognito logout
  endpoint. Do not put tokens in the logout URL.
- Expired-user and access-token-expired events clear the session and return to
  the signed-out state; no silent renew iframe or refresh-token persistence.
- Expose the access token only through a narrow `getAccessToken()` operation
  used immediately by the API repository. Do not expose raw claims to
  components.

Unit tests must cover every transition, repeated calls, callback error and
cleanup, hostile return paths, expiry, logout, and absence of tokens from
logs and persistent browser storage.

## T13C: administrator API repository and editor state

1. Add a dependency-injected same-origin repository for the two exact API
   routes. Build paths only from parsed `StadiumSlug` and `YearMonth`; do not
   concatenate unvalidated form input.
2. Send `Authorization: Bearer` only at request time. GET sends no conditional
   header. PUT sends exactly one of:
   - the server-returned strong ETag as `If-Match`; or
   - `If-None-Match: *` for a confirmed missing month.
3. Send only the update DTO fields from `api-spec.md`; never send `updatedAt`,
   unknown fields, identity data, or an unconditional PUT.
4. Validate every success response through shared core parsers and explicit
   ETag/version checks. Bound response reads consistently with the API's
   32-KiB document contract.
5. Map 400/401/403/404/409/415/429/500 and network/invalid responses to
   localized, non-technical UI errors. Never render an AWS error or raw body.
6. Model editor state as exclusive discriminated states. Keep the last loaded
   server document/ETag separate from the editable draft.
7. On 409, preserve the complete unsaved draft and its original base, fetch
   the latest document into a separate comparison state, and never retry PUT
   automatically. The operator can discard/reload or manually reapply changes.
8. A 404 GET creates an explicit empty-month draft whose first save uses
   `If-None-Match: *`; it is not treated as an arbitrary API failure.
9. Show success only from a validated 200 PUT response, then replace the base,
   draft, ETag, updatedAt, and version ID atomically.

Unit tests must cover request/header/body exactness, all statuses, malformed
responses, create/update, double save prevention, conflict immutability,
latest-version comparison, failed comparison fetch, and success-state
atomicity. Tests must not call AWS or the preview API.

## T13D: accessible administrator pages

- Add `/manage` and `/manage/callback` without changing any existing public
  route, locale, canonical, or hreflang contract.
- Signed-out `/manage` displays a clear login action. Redirecting and callback
  processing render an accessible busy state. Errors are sanitized and
  retryable.
- Signed-in UI provides native stadium and month controls and a semantic table
  of at most 31 dates by three time slots. Each cell uses a labeled native
  select or radio group for statuses 0, 1, and 2; do not use `contenteditable`
  or a UI/form framework.
- Keyboard operation, focus visibility, error association, live save status,
  and destructive/discard confirmations must be explicit. Japanese and
  English strings belong in the existing locale files.
- Render loading, missing month, invalid response, non-admin, conflict,
  comparison, save failure, and save success as mutually exclusive states.
- Conflict comparison identifies each locally changed cell and its latest
  server value. Reloading latest requires confirmation when a dirty draft
  exists. No control may silently discard or overwrite edits.
- Never display or embed access tokens, raw claims, Cognito subject/email,
  raw API errors, bucket/key names, stack details, or request bodies.

Component tests must exercise Japanese and English display states and keyboard
labels. Keep stateful/mock-auth browser tests separate from the unmodified raw
public-preview suite.

## T13E: browser contract and regression coverage

Use local production builds with injected OIDC/API fakes for destructive or
stateful cases. Cover desktop/mobile and Japanese/English where visible text
differs:

- unauthenticated `/manage` starts the exact Hosted UI authorization flow;
- callback success reaches the editor without persisting tokens;
- callback/configuration/authentication failures are sanitized;
- authenticated admin GET, edit, and conditional PUT succeed;
- authenticated non-admin 403 cannot edit or claim success;
- missing month uses create semantics;
- stale ETag preserves draft, displays latest comparison, and never retries;
- reload/discard confirmation and retry behavior;
- logout and token expiry clear the in-memory session;
- storage inspection proves no tokens or `User` in localStorage,
  sessionStorage, IndexedDB, cookies, or generated output;
- public routes, raw preview tests, SEO verification, and schedule-state tests
  remain unchanged and passing.

Do not use a real administrator token or mutate preview schedule data in this
task. A real Cognito admin/non-admin preview test belongs to T16 and requires
explicit operator authorization and designated test data.

## T13F: final local verification and Sol handoff

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
git diff --check
git status --short
```

Update `implementation-log.md` for every milestone and make coherent commits
without squashing existing history. Stop for Sol review after T13F. Do not
deploy the web build, create users, add group membership, or proceed to T14.

The handoff must report commits, exact dependency version, tests, generated
routes, runtime configuration contract, storage inspection evidence, conflict
behavior, unresolved items, and clean worktree.

## Stop conditions

Stop without guessing if implementation requires token persistence beyond
transaction-only OIDC state, a dependency other than exact-pinned
`oidc-client-ts`, a custom login/password form, an API/data-schema change,
broader IAM, AWS mutation, preview schedule mutation, external IdP, Identity
Pool, production hostname, DNS, Firebase access, weakening public route/SEO or
raw-preview tests, or an unconditional/automatic-conflict write.
