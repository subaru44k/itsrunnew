# Implementation log

Luna updates this file at every task boundary. Keep entries concise and link
commits rather than pasting command output.

## Phase 1

- Planner: Sol; implementer: Luna
- Planning baseline: `d6de55e`
- Branch: `migration/aws-s3-cloudfront`
- Plan commit: `bee1ec5`
- Result: Phase 2 implementation in progress

## Environment

Captured at the start of Phase 2 implementation:

```text
Start commit: `eaba60c` (T00)
Node: v22.16.0 (current; `.nvmrc` targets 24)
npm: 11.4.2
AWS CLI: 2.34.3
CDK: not installed (T07 scope)
Operating system: macOS
```

## Task log

| Task | Status | Commit | Checks | Notes |
| --- | --- | --- | --- | --- |
| T00 | complete | `eaba60c` | `npm run check` | Root workspaces, Node/npm policy, env example and structure check |
| T01 | complete | `39626c8` | `npm run test:e2e`; `node scripts/migration/capture-public-baseline.mjs`; `npm run check` | 14 public routes passed against the current site. Read-only Firestore export interface added; export is intentionally blocked until temporary migration tooling credentials/dependency are supplied. |
| T02 | complete | `f6b6286` | `npm run test:unit --workspace @itsrun/core`; `npm run check` | Provider-neutral core types, strict schedule parser, stadium config, Japan date helpers, month paths, status labels and legacy-compatible marathon pace logic. No runtime dependencies. |
| T03 | complete | pending | `npm run build --workspace web`; `npm run check` | Nuxt 4 static shell with Japanese/English prefixed routes, semantic header/footer/navigation, SEO metadata and plain CSS. No Vuetify, Bootstrap, Stylus, icon font, Vuex or Pinia. |
| T04 | pending | | | |
| T05 | pending | | | |
| T06 | pending | | | |
| T07 | pending | | | |
| T08 | pending | | | |
| T09 | pending | | | Phase 3 stop |
| T10 | blocked by Phase 3 | | | |
| T11 | blocked by Phase 3 | | | |
| T12 | blocked by Phase 3 | | | |
| T13 | blocked by Phase 3 | | | |
| T14 | blocked by Phase 3 | | | |
| T15 | blocked by Phase 3 | | | |
| T16 | blocked by Phase 3 | | | |
| T17 | blocked by Phase 3 | | | |

## Phase 3 Sol review

```text
Reviewed commit:
Date:
Result:
Required changes:
Approved decisions:
```

## Phase 5 Sol review

```text
Reviewed commit:
Date:
Result:
Go/no-go:
Required changes:
```

## Open items

Use:

```text
OPEN:
Task:
Decision needed:
Evidence:
Safe work that can continue:
```
