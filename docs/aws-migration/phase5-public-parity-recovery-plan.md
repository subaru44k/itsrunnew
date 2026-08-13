# Phase 5 public parity recovery plan

Date: 2026-08-13  
Planner/reviewer: Sol  
Implementer: Luna  
Branch: `migration/aws-s3-cloudfront`  
Planning start: `361b265`  
Legacy authority: annotated tag `legacy-firebase-vue-final-20260813`

## Why Phase 5 is reopened

The previous acceptance proved the new architecture but not the product. Sol
compared the live Firebase and CloudFront pages at 1440 px and inspected the
legacy tag. The public replacement is visibly and functionally incomplete:

- the legacy marathon calculator shows three selectable ranges, each with 19
  five-minute goal rows and 12 distance/split columns; the current page offers
  only four goals and one vertical result;
- the legacy Nozomi record contains 60 body rows; the current structured data
  contains 44 collapsed/incomplete rows and shows English meet names on the
  Japanese route;
- the current primary navigation omits the records route;
- stadium editorial content was shortened and the legacy open-day title,
  information-card hierarchy, local status symbols, and visual identity were
  not preserved;
- the indigo desktop toolbar/dropdowns, mobile drawer, green language action,
  elevated white content cards, striped/bordered tables, teal contact footer,
  and responsive layouts were replaced by a materially different minimal UI.

Passing route/status/SEO tests did not detect those losses. D057 supersedes the
product/cutover portion of the earlier Phase 5 acceptance. Production
promotion, OIDC trust rotation, PR merge, AWS deploy, and Firebase redirect are
stopped until this plan is accepted by Sol after implementation.

## Source boundaries

Read the exact legacy sources directly from the retained tag. Do not restore
the deleted legacy application tree or its package graph. The authoritative
public references include:

- `src/App.vue`, `src/router.ts`, and both legacy locale files;
- four `src/views/*` stadium pages and schedule components;
- `src/views/LapTime.vue`, both pace-table components,
  `TimeContainerFactory.ts`, `TimeContainer.ts`, and `LapTimeCalculator.ts`;
- `src/views/NozomiAntena.vue`;
- only referenced local public images/icons.

Keep the new AWS schedule repository, error state machine, Nuxt routing/SEO,
admin UI/auth, accessibility, security headers, and responsive correctness.
Legacy defects such as endless loading, unbounded locale routes, raw errors,
inaccessible icon-only status, and persistent tokens are not parity targets.

## PR01: executable parity inventory

Create a deterministic local parity contract, tested without Firebase/AWS:

- exact public navigation destinations and Japanese/English labels, including
  the Nozomi records link;
- exact full stadium editorial strings, headings, contact lines, maps, and Oda
  announcement link from the legacy tag;
- exactly three pace ranges: 2:00–3:30, 3:30–5:00, 5:00–6:30, inclusive in
  five-minute steps (19 goals each), with exact 1/5/10/15/20/half/25/30/35/40/
  full calculations and formatting;
- exactly 60 record body rows, preserving separate events rather than joining
  slash-delimited cells, grouped under 2021 and 2020, with Japanese legacy
  meet names on Japanese routes and locale-equivalent English content;
- expected visible landmarks/classes for desktop and mobile visual identity.

Structured data and pure helpers are preferred. Tests must fail for the
current four-goal pace page, 44-record dataset, missing nav link, or summarized
stadium copy. Do not test source strings in place of rendered behavior where a
component/browser assertion is practical.

Commit PR01 with implementation-log evidence.

## PR02: shell and responsive navigation parity

Rebuild the public shell with semantic components and plain CSS:

- indigo full-width toolbar, white brand, grouped Tokyo/Kanagawa/lap/records
  navigation, and a green locale action on desktop;
- keyboard-operable dropdowns using native/semantic controls and escape/focus
  behavior; no hover-only access;
- mobile hamburger and temporary drawer with the same complete destinations;
- teal contact/request footer linking to `@itsrun_page`, dark copyright bar,
  safe external-link attributes, and the legacy site name;
- migrate only referenced icon/logo assets needed for shell/statuses.

Do not install Vuetify, Bootstrap, an icon font, a menu library, or any new
dependency. Admin pages may share tokens but must retain tested behavior. Add
component/browser coverage for navigation, language preservation, keyboard
operation, mobile drawer, records visibility, and footer link.

Commit PR02 with implementation-log evidence.

## PR03: stadium content and schedule presentation parity

Keep one data-driven `StadiumPage`, but restore all legacy locale content and
the established layout:

- exact open-day heading and availability introduction per stadium;
- Oda's legacy external announcement and explanatory line;
- elevated white schedule card, centered circular previous/next controls,
  bordered table, desktop/mobile readability, and local status visuals;
- accessible visible status text and screen-reader labels in addition to the
  familiar circle/cross/border/loading symbols;
- separate elevated information card with exact official name, responsive
  map, access, contact, and every legacy opinion paragraph in original order;
- retain loading/network/invalid/unavailable/unpublished/retained/retry states
  and consistent last-success dates/months;
- preserve current security, no-cache, and dynamic AWS data behavior.

Do not restore Firestore, Moment, duplicate per-stadium components, or obsolete
ad-loading timing. Preserve content flow but do not enable AdSense without a
separate owner decision and CSP review.

Add Japanese/English semantic-content assertions and desktop/mobile screenshot
baselines for all four stadium routes. Visual tests must exercise loaded and
representative state/error layouts without weakening the raw preview suite.

Commit PR03 with implementation-log evidence.

## PR04: complete marathon pace feature

Replace the four-option single-result page with a data-driven equivalent of the
legacy feature:

- three localized range options, defaulting to 2:00–3:30;
- 19 goal rows per selected range, inclusive at five-minute intervals;
- exact 12-column desktop table and transposed mobile table;
- exact time formatting and floor behavior from the legacy calculator;
- range switching updates all 19 rows without navigation or persistence;
- headings, labels, SEO title/description, card/table styling, horizontal
  overflow behavior, and Japanese/English content match the legacy contract.

Extend dependency-free core functions and unit tests rather than duplicating
57 rows in Vue markup. Test boundary goals, all range counts, overlap values,
representative splits, desktop orientation, mobile orientation, and switching.

Commit PR04 with implementation-log evidence.

## PR05: complete records feature

Rebuild the records page from structured data representing all 60 legacy body
rows. Do not combine multiple same-day/event results into one row. Restore:

- full Japanese title, affiliation summary, descriptive introduction, and
  yearly anchor links;
- 2021 and 2020 headings and separate striped/bordered tables;
- exact Japanese dates, meet names, event names, times, and PB markers;
- locale-equivalent English headings/content without causing Japanese routes
  to display translated English meet names;
- responsive overflow and readable table semantics;
- primary desktop/mobile navigation access and complete SEO metadata.

Tests must assert total 60 rows, per-year counts, representative first/middle/
last and same-day rows, Japanese text, English route rendering, anchor targets,
navigation discoverability, and no collapsed slash-delimited event rows.

Commit PR05 with implementation-log evidence.

## PR06: honest parity gate and local Sol handoff

Strengthen tests so the earlier false acceptance cannot recur:

- run desktop/mobile × ja-JP/en-US against a production Nuxt build for every
  stadium, pace, records, and compatibility route;
- assert complete nav destinations, exact pace range/row/column counts, exact
  record count/content, full stadium markers, footer/contact, locale switching,
  canonical/hreflang, maps, unknown route/asset, and schedule/admin boundaries;
- keep raw CloudFront preview tests unmodified and free of route/fetch masking;
- add maintained visual snapshots at 375 px and 1280 px for shell, Oda, pace,
  and records. Review them side-by-side with fresh live legacy captures;
- verify no removal-list dependencies, Firebase client, AdSense wrapper,
  service worker, or new dependency appears.

Required final commands under Node 24:

```bash
npm ci
npm audit --omit=dev
npm run check
npm run test:e2e
npm ls --all
git diff --check
git status --short
```

Update README, phase5-review.md, this plan, and implementation-log truthfully.
Commit coherent changes without squashing and stop for Sol. Do not deploy the
parity changes to CloudFront yet; deployed preview review is a separate
protected write after Sol accepts local parity.

## Sol review and later deployed proof

## Implementation result — 2026-08-13

The local PR01–PR06 implementation is recorded in commits `9075190`,
`daca42c`, `41a351f`, `32bf847`, `7b7a7f9`, `616fcf7`, and `648f340`. Pace
contracts prove three ranges × 19 goals with 12 desktop columns and mobile
transpose; records prove 60 expanded rows (41/19 by year). Maintained local
Playwright parity coverage runs both configured desktop and mobile locales and
has eight checked-in screenshots for shell, pace, records, and Oda. Local admin
E2E remains 48/48 and the full check remains green. This evidence is local
only and does not replace Sol's independent screenshot review or authorize
preview deployment.

Sol independently inspects every commit and reruns the complete local gate,
including screenshots at both widths. A local acceptance authorizes only a
separate request to deploy the reviewed web build to the existing preview
bucket. After explicit AWS/deployment authorization, run the unmodified raw
preview suite plus the same parity contract on CloudFront and repeat visual
comparison. Only then may Phase 5 technical acceptance be reinstated and the
production cutover plan resumed.

## Stop conditions

Stop without external mutation if any of the following is required:

- a new dependency or UI framework;
- an API, data schema, AWS resource, IAM, Cognito, cache, or security boundary
  change;
- enabling AdSense/GA4 or widening CSP for third-party scripts;
- guessing whether legacy content should be removed or rewritten;
- AWS, GitHub PR-state/merge, Firebase, DNS, production, deployment, or
  invalidation operation;
- weakening existing schedule/admin/raw-preview tests to accommodate styling;
- inability to prove all 60 records or all 57 pace goals from the legacy tag.

## Sol rejection of the first local handoff — PVR01–PVR05

Date: 2026-08-13

Sol rejects commits `9075190` through `2dfe051` as proof of D057 parity. They
are useful partial implementation, but the rendered result and its tests still
permit material product loss. Complete PVR01–PVR05 in order before any preview
deployment. Existing good pace work may be retained; do not squash history.

### PVR01: replace inferred records with an exact legacy transcript

`expandedNozomiRecords()` currently expands slash-delimited rows after adding
already-separated rows. This creates a duplicate third result for 2021-06-27
and reaches 60 by transformation rather than preserving the 60 authoritative
legacy rows. Replace it with exactly 60 explicit structured entries transcribed
in order from
`legacy-firebase-vue-final-20260813:itsrunnew/src/views/NozomiAntena.vue`:

- 41 entries for 2021 and 19 for 2020, with no runtime slash expansion;
- exact Japanese display dates including legacy weekday text, meet names,
  events, results, PB markers, and same-day ordering;
- locale-equivalent English fields stored beside the Japanese authority rather
  than translating Japanese routes at runtime;
- exact Japanese title, affiliation summary, explanatory paragraph, year-link
  labels, section headings, and column headings from the legacy view;
- complete English page content that accurately describes the same dataset.

Tests must deep-compare the complete ordered Japanese 60-row projection to a
fixed expected contract, not merely counts or selected markers. They must
explicitly prove that 2021-06-27 has exactly two entries and that no event or
result contains ` / `. Browser tests must verify the full Japanese introductory
copy and exact per-year counts.

### PVR02: implement the actual responsive shell contract

Replace the flat desktop link list with four labelled groups matching the old
information architecture: Tokyo, Kanagawa, lap time, and records. Each group
must expose the exact destination set and localized labels from the legacy
locale files. On desktop use keyboard-operable disclosure menus; on mobile use
a temporary overlay drawer with the brand/logo, the same groups, focus return,
Escape close, outside-click close, and route-close behavior. It must not be an
inline expansion that pushes page content down.

Show one green action for the opposite locale, preserving the corresponding
page route. Restore the legacy footer sentence and
`https://twitter.com/itsrun_page` target with safe external-link attributes.
Use `/nozomiantena/index` as the legacy navigation destination while keeping
canonical Nuxt/SEO behavior and all existing compatibility redirects. Remove
the anonymous global key listener or register and clean it up deterministically.

Component/browser tests must cover every group and destination, desktop
keyboard operation, mobile overlay semantics, focus restoration, Escape,
outside click, route close, opposite-locale action, and both records URLs.

### PVR03: restore complete stadium content and card/status presentation

The rendered stadium page remains a flat article and the English copy remains
summarized. Model and render, for each locale and all four stadiums, the exact
legacy open-day heading, availability introduction, information heading,
official name, access/contact lines, and every available opinion paragraph in
the original order. Use the retained tag's locale JSON as the authority; do not
rewrite its wording. Restore Oda's announcement and external link from the
legacy view. Ads remain excluded under D057.

Render the schedule and information areas as visibly separate elevated white
cards on the gray canvas. Restore the familiar table hierarchy and local visual
symbols for available, unavailable, unpublished/unknown, and loading states
using dependency-free local SVG/CSS while retaining visible localized text and
screen-reader meaning. Maps must remain responsive and use the exact
per-stadium embed sources already captured in core data. Do not weaken the
newer schedule state machine, error handling, security, or data source.

Tests must assert the complete locale content contract for every stadium, the
Oda announcement, card separation, status icon plus text semantics, and map
source. Representative loaded/error/unpublished browser tests belong only in
the masked local state suite; the raw preview suite remains unmodified.

### PVR04: use a truthful four-condition visual and functional matrix

The first handoff ran only desktop Japanese and mobile English and captured
Oda only. Configure the parity suite for all four independent conditions:
desktop/mobile × ja-JP/en-US. Exercise every stadium route, marathon pace, and
records in every condition. Keep the 375 px and 1280 px visual baselines for
shell, all four stadiums, pace, and records; each baseline must have a unique
project/route identity and be manually inspectable. Do not count duplicated
captures as coverage.

The production-build suite must assert exact rendered content from PVR01–PVR03,
three pace ranges × 19 rows and 12 desktop columns, the mobile transpose,
complete navigation, footer, map, locale switching, canonical/hreflang, and
compatibility routes. Ensure a deterministic representative schedule fixture
is visible in local parity screenshots without changing or masking
`preview-public-routes.spec.ts`.

### PVR05: final local handoff

Implementation handoff: PVR01–PVR04 are committed in `d0562fc` and `22e3f01`.
The explicit transcript has 60 rows (41/19), the shell matrix has four
independent locale/device projects, and all four stadium routes plus pace and
records have unique maintained snapshots. The final local E2E gate passed
124/124 and the required check/build/audit gates passed. This remains a local
Sol handoff; no preview or protected external operation occurred.

Run under Node 24:

```bash
npm ci
npm audit --omit=dev
npm run check
npm run test:e2e
npm ls --all
git diff --check
git status --short
```

Update `implementation-log.md` truthfully with the rejected evidence and each
correction commit. Stop with a clean worktree for Sol screenshot and source
review. No AWS, preview deployment/invalidation, IAM, CloudFormation, Cognito,
GitHub PR-state/merge, Firebase, DNS, production, dependency, AdSense, or
historical-data operation is authorized by PVR01–PVR05.

## Sol rejection of PVR handoff — FPR01–FPR04

Date: 2026-08-13

Sol rejects `d0562fc` through `f8bb9f6` as final parity proof. The four-project
matrix and separate cards are good progress, but the implementation does not
meet its own exact-content or interaction contract. Complete FPR01–FPR04 in
order without squashing.

### FPR01: mechanically exact records model and rendering

The current 60 entries still mix Japanese and English in a single `meet` field,
omit weekday text from most dates, use inconsistent zero padding, and are not
in authoritative year/row order. Its unit test checks only a few markers rather
than the promised complete projection.

Create an explicit locale-aware record type with at least `dateJa`, `dateEn`,
`meetJa`, `meetEn`, `event`, and `result`. Transcribe the Japanese projection
mechanically from every `<tbody><tr>` in the retained legacy view. The rendered
Japanese sequence must match all 60 legacy rows byte-for-byte for date, meet,
event, and result after expanding HTML rowspans into repeated display values.
This includes every weekday character and the legacy spelling/punctuation;
do not normalize dates or invent corrections. Store a complete fixed expected
60-row Japanese tuple list in tests and deep-equal the actual projection. The
test must fail if any one of the 240 cells changes, if ordering changes, if any
slash-combined row appears, or if 2021-06-27 is not exactly two rows.

Render the locale-specific projection. Japanese must contain no English
substitution where the legacy source has Japanese. English fields may be clear
translations/transliterations of those exact 60 rows, but must never change
the Japanese projection. Keep the exact Japanese introductory and heading
copy already restored.

### FPR02: exact legacy stadium content and presentation contract

Replace every summarized/invented stadium field with the exact retained-tag
locale values. Model separate `openTitle`, `availabilityIntroduction`,
`infoTitle`, `officialName`, access lines, contact label/value/telephone, and
opinion heading/paragraphs. Preserve absent legacy sections as absent; for
example, do not invent a Komazawa opinion paragraph. Render the schedule card
with the exact open title and availability introduction, and the information
card with exact information title and official name before map/access/contact/
opinions in legacy order.

For Oda, restore exactly the retained legacy announcement text and URL
`https://newyearscardlottery.link/`; the substituted Tokyo Park URL is not
parity. Keep `target="_blank"` and `rel="noopener noreferrer"`. Ads remain
excluded.

Implement familiar dependency-free local status symbols for available,
unavailable, unknown/unpublished, and loading while retaining visible localized
text. The symbol must be a separate visual element hidden from assistive
technology; the localized text remains accessible. Add unit/component
contracts that deep-equal every legacy locale content object and browser
assertions for exact headings/introduction, Oda link, card ordering, map source,
and icon-plus-text presentation.

### FPR03: complete shell behavior and exact legacy labels

Use the exact legacy group and item labels: Tokyo/東京都の競技場 with Oda,
Yumenoshima, Komazawa; Kanagawa/神奈川県の競技場 with Todoroki; Lap Time/
ラップタイム with Marathon/マラソン; Records/記録集 with Nozomi Tanaka/
田中希実. Link the records item to `/nozomiantena/index` (locale-prefixed in
English) while retaining compatibility/canonical behavior.

Desktop disclosures must close other open groups, close on outside click and
Escape, and return focus to the triggering summary. The temporary mobile drawer
must include the brand/logo and the same complete hierarchy, have a backdrop,
lock neither content permanently nor language action, close on backdrop,
Escape, route selection, and return focus to the hamburger. Use deterministic
listener cleanup. Restore the exact localized legacy footer sentence, exact
`https://twitter.com/itsrun_page` link, and safe external attributes.

Add real browser interaction tests for all behavior above. Do not count visual
snapshots as interaction assertions.

### FPR04: truthful gate and handoff

Strengthen all four parity projects so every stadium asserts its exact localized
headings, introductions and key content; records assert the full rendered
Japanese projection and absence of English substitutions; shell asserts every
group/item/href and drawer/disclosure behavior; loaded local schedule evidence
asserts all status symbol/text combinations. Keep the raw preview suite
unchanged. Regenerate uniquely named visual snapshots only after assertions
pass, then inspect them for clipped content, missing maps/cards, and mobile
drawer coverage.

Run the full PVR05 command list under Node 24. Update the log truthfully and
stop clean for Sol. The same external-operation and dependency prohibitions
from PVR05 remain in force.

### FPR04 local implementation evidence — 2026-08-13

The bounded local gate is implemented from `be49716`: shared test-owned exact
records fixture, four-project shell/stadium/pace/records/SEO assertions,
deterministic schedule interception, and regenerated reviewed snapshots. The
focused parity matrix passed 42 tests with 6 expected skips. The exact Node 24
full gate and clean-worktree Sol handoff remain required; external operations
remain stopped.
