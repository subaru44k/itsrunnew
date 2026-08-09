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

Sol accepted T13S03A through follow-up commits `d49746c` and `5a72fcc`.
The independent review confirmed shared-schema draft validation, reversible dirty
tracking, confirmation-gated reloads, explicit latest-ETag rebasing, and stale
comparison suppression. Web unit tests passed 41/41 under Node 24.18.1. T13S03B
may proceed; this approval does not authorize AWS writes or T13S04 work.

After Sol accepts T13S03A, implement the complete T13R04 UI contract. Correct
the locale meanings to `0` unpublished/unknown, `1` available, and `2`
unavailable. Render every exclusive editor state, per-cell conflict values,
manual rebase/confirmed replacement, retry, and accessible controls. Add
browser-visible localized UI assertions, commit, and stop before T13S04.

## T13S04: honest administrator browser contract

Sol accepted T13S03B through commits `d9daf69`, `8c18a32`, `7cc58da`,
and their documentation commits. Independent Node 24 review passed 43 web unit
tests and `npx playwright test --config playwright.admin.config.mjs` (4/4).
The review confirmed zero-based slot mapping, exclusive conflict actions,
sanitized authorization failures, localized status meanings, and retained saved
metadata. T13S04 may proceed without AWS-write authority.

After Sol accepts T13S03B, replace the current two fail-closed smoke assertions
with the complete T13R05 local-production fake-OIDC/API matrix. Test injection
must be default-off and visibly absent from a normal preview build. The static
server must reject traversal and serve deterministic cache/content types.
Legacy, admin, and explicit 88-test preview suites must all pass. Commit and
stop before T13S05.

Sol accepted the T13S04 authentication lifecycle and callback-route boundary
through `da46b33`: the editor and callback are sibling routes, callback cleanup
and safe replacement are browser-tested, lifecycle events clear memory auth,
and the normal build excludes the fake adapter. Complete the remaining matrix
in two non-overlapping increments:

- **T13S04B1 — basic API outcomes:** existing update, non-admin 403, missing
  create with `If-None-Match: *`, and expired/401 reauthentication. Assert exact
  conditional headers, request counts, sanitized localized UI, and metadata.
- **T13S04B2 — concurrency and operator decisions:** stale ETag conflict,
  comparison failure and GET-only retry, explicit latest rebase/confirmed
  replacement, and dirty reload/selection confirmation. Assert no automatic
  PUT retry and retained base/draft/latest values.

Sol accepted T13S04B1 through `98e7ba0` and `cd3f677`. Independent review
confirmed exact one-request outcomes, strict request bodies and conditional
headers, fail-closed 403/401 rendering, 31-day create defaults, returned
metadata, and operator-triggered PKCE reauthentication. T13S04B2 may proceed.

Each increment must keep the 26 accepted administrator tests, the normal-build
marker exclusion, and the preview-spec hashes unchanged. Stop after each for
Sol review. Neither increment authorizes AWS writes or T13S05.

Sol accepted T13S04B2 through `7395b00` and `0a2e53b`. The completed isolated
administrator suite has 44 deterministic cases and covers the full T13R05
authentication, conditional-write, conflict, comparison, lifecycle, and dirty
selection contract across Japanese desktop and English mobile. T13S04 is
accepted. T13S05 may run the T13R06 final verification and truthful log audit;
it may not deploy or begin T14.

## T13S05: final verification and truthful acceptance log

Sol accepted T13S05 at `6cd3b52`. Node 24 verification passed core 7, web
44, infra 15, static-server 3, legacy browser 14, isolated administrator 44,
and explicit preview 88 tests. The normal build contains no administrator E2E
adapter markers, the accepted preview specs are unchanged, and the worktree is
clean. T13 is accepted as local implementation and test completion; it was not
deployed during this milestone.

Run the complete T13R06 command list under Node 24, preserve all earlier
failure/review history, correct any premature completion claims, and stop for
Sol acceptance. No deployment or T14 work.

## Stop conditions

Use the stop conditions in `phase4-t13-review.md`. Do not weaken a test or mark
an increment complete without implementing its entire specified contract.
