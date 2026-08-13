# Current system and compatibility baseline

## Repository state

- Git repository root: repository root containing this document
- Legacy application root: `itsrunnew/`
- Production Firebase project: `itsrun-aaf42`
- Current production hosts:
  - `https://itsrun-aaf42.web.app`
  - `https://itsrun-aaf42.firebaseapp.com`
- Planning baseline commit: `d6de55e`
- Legacy build requirement observed during planning:
  - Node 14.15 builds successfully with warnings.
  - Node 22 crashes in the legacy `esm` dependency.

The legacy application stays untouched until Task T17. It is the behavioral
reference and rollback artifact.

## Current technology

| Concern | Current implementation |
| --- | --- |
| UI | Vue 2.6 class components |
| Build | Vue CLI 3 and webpack |
| State | Vuex 3 singleton store |
| Routing | Vue Router 3 history mode |
| Styling | Vuetify 1.5, Bootstrap 4 CDN, Stylus |
| Data | Firebase 6 namespaced Firestore API |
| Authentication | Firebase Auth Google redirect |
| Dates | Moment.js and viewer-local time |
| Localization | Vue I18n 8 with duplicated routes |
| Hosting | Firebase Hosting |
| Offline | Generated service worker |
| Analytics | Universal Analytics property |
| Ads | `vue-google-adsense` and `vue-script2` |
| Tests | None |

## Public routes that must be preserved

| Route | Behavior |
| --- | --- |
| `/` | Oda Field schedule and stadium information |
| `/index.html` | Redirect to `/` |
| `/yumenoshima` | Yumenoshima schedule and information |
| `/komazawa` | Komazawa schedule and information |
| `/komazawa_olympic` | Redirect to `/komazawa` |
| `/todoroki` | Todoroki schedule and information |
| `/pace/marathon` | Marathon pace table |
| `/nozomiantena/index` | Nozomi Tanaka static records |
| `/en/` | English Oda Field |
| `/en/yumenoshima` | English Yumenoshima |
| `/en/komazawa` | English Komazawa |
| `/en/todoroki` | English Todoroki |
| `/en/pace/marathon` | English marathon pace table |
| `/en/nozomiantena/index` | English route; content quality may remain legacy-equivalent |
| `/manage` | Authenticated schedule editor |

Do not retain the unrestricted legacy `/:lang` behavior. Only `ja` and `en`
are valid locales in the new application.

## Current Firestore model

```text
default/0
  alias_id: string

stadium_info/{stadiumId}
  common_name: string
  time_range: [string, string, string]

availability/{stadiumId}/date/{YYYYMMDD}
  status: [number, number, number]
```

Stored status meanings:

| Value | Meaning |
| --- | --- |
| `0` | Unknown |
| `1` | Available |
| `2` | Unavailable |

`-1` is a UI-only loading state and must never be persisted.

Known stadium IDs:

| Slug | Legacy Firestore ID |
| --- | --- |
| `oda` | `nVfuSmsj9cULg3712chv` |
| `yumenoshima` | `VFurPbbeejEbtu1JNTzF` |
| `komazawa` | `WrrQXe67xvIkGfMtJ51E` |
| `todoroki` | `67c7uxgRWDkxr1S4gPaR` |

## Behavior to correct, not preserve

- Viewer-local dates can differ from Japan dates. New code uses
  `Asia/Tokyo`.
- `targetTimeIndex` does not update consistently. New code uses local,
  explicit selection state.
- Async Firestore failures can leave loading unresolved. New UI renders an
  error and retry action.
- Public and mobile tables duplicate markup. New tables are data-driven.
- Stadium pages duplicate nearly all component code. New pages are driven by
  stadium configuration.
- Arbitrary locale route parameters are accepted. New routing allows only
  Japanese and English.
- Universal Analytics is no longer functional. Add GA4 only when a valid
  measurement ID is supplied.
- Offline caching can show stale availability. Do not migrate the PWA in the
  first release.

## Baseline evidence to capture in T01

Before changing behavior, Luna captures:

- Screenshots at desktop and mobile widths for every public route.
- Current production title and meta description for every route.
- A representative current, previous, and next week response for every
  stadium.
- Pace calculations for the first, middle, and last values of all three
  ranges.
- The current Firebase data export and a SHA-256 manifest.

Secrets, access tokens, Firebase user data, and service-account material must
not be committed.
