# Phase 4 T13 second Sol review

Review target: `e854f98`

Review date: 2026-08-09

## Result

T13 remains unaccepted. The previous correction fixed the missing-month date
generation and introduced a bounded stream reader and separate Playwright
configs, but most T13R01-T13R05 acceptance claims are not represented by code
or tests. Work is split into small Sol-reviewed increments below. Complete and
review each increment before starting the next one.

No increment authorizes AWS access, deployment, Cognito administration, a real
token, preview data mutation, production, DNS, Firebase, or T14.

## T13S01: shared OIDC session and lifecycle proof

Change only the OIDC boundary, session composable/factory, callback page, their
tests, and the implementation log.

- Keep one browser-lifetime session and one `UserManager` across management
  routes. Provide a pure injectable singleton/session factory so this is tested
  without Nuxt globals and can be reset between tests.
- Callback must read `User.state.returnPath`, pass it through the existing safe
  path validator, update the shared in-memory session, clear callback query and
  fragment material, and perform injected client-side replacement navigation
  to that exact safe management path. Failure must navigate cleanly to
  `/manage` while preserving a sanitized-error state.
- Deduplicate concurrent initialize and callback calls. Attach each event
  listener exactly once. Clear in-memory authentication on unloaded, token
  expiry, silent-renew error, logout success, and logout failure.
- Remove raw `User`, claims, and profile from the object exposed to components.
  Only expose state, sanitized error, lifecycle methods, and
  `getAccessToken()`.
- Make transaction cleanup an explicit OIDC-port operation invoked after both
  callback success and failure. It may clear only OIDC transaction/PKCE state,
  never unrelated session storage.
- Keep actual OIDC settings at code flow, exact scopes, no automatic silent
  renew, injected transaction storage, and `InMemoryWebStorage` user store.
  Tests must exercise `stateStore` and `userStore`: transaction writes reach
  only the injected session store, while a token-bearing User value remains in
  the in-memory store and never appears in the injected storage.
- Test unconfigured, initialize signed-out/signed-in/failure, concurrent calls,
  safe/hostile callback return paths, success/failure cleanup and navigation,
  login, logout success/failure, every expiry/unload event, listener count,
  absence of raw User exposure, and absence of token/claim/error logging.

Required checks: web unit, web lint, web typecheck, web build, root check, diff
check, clean status. Commit and stop for Sol review before T13S02.

## T13S02: exact bounded API repository

After Sol accepts T13S01, change only `adminApi` and its tests plus the log.

- Validate the base path is exactly same-origin `/api/v1`.
- Bind/wrap native fetch so it is never invoked as an illegal receiver method.
- Validate outgoing strong ETag before fetch and prove exactly one conditional
  header. Validate the complete DTO and byte size.
- Keep all response bodies bounded at 32 KiB with exact cancel/release behavior
  for absent, accurate, false, and understated Content-Length.
- Add the complete T13R02 status, stream, envelope, ETag, VersionId, schema,
  path, body, and forbidden-output test matrix.

Required focused and root checks, commit, and stop before T13S03.

## T13S03A: editor state and conflict safety

After Sol accepts T13S02, implement the complete T13R03 state contract in a
separate editor module with exhaustive deterministic tests. Preserve
base/draft/dirty state on every failure, prevent stale async completion and
double save, implement per-cell latest conflict comparison, comparison retry,
explicit keep/rebase, and confirmed replacement operations. Commit and stop
for Sol review before changing the Vue pages or locale files.

## T13S03B: accessible localized UI

After Sol accepts T13S03A, implement the complete T13R04 UI contract. Correct
the locale meanings to `0` unpublished/unknown, `1` available, and `2`
unavailable. Render every exclusive editor state, per-cell conflict values,
manual rebase/confirmed replacement, retry, and accessible controls. Add
browser-visible localized UI assertions, commit, and stop before T13S04.

## T13S04: honest administrator browser contract

After Sol accepts T13S03B, replace the current two fail-closed smoke assertions
with the complete T13R05 local-production fake-OIDC/API matrix. Test injection
must be default-off and visibly absent from a normal preview build. The static
server must reject traversal and serve deterministic cache/content types.
Legacy, admin, and explicit 88-test preview suites must all pass. Commit and
stop before T13S05.

## T13S05: final verification and truthful acceptance log

Run the complete T13R06 command list under Node 24, preserve all earlier
failure/review history, correct any premature completion claims, and stop for
Sol acceptance. No deployment or T14 work.

## Stop conditions

Use the stop conditions in `phase4-t13-review.md`. Do not weaken a test or mark
an increment complete without implementing its entire specified contract.
