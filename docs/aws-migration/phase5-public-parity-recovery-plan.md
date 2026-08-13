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
