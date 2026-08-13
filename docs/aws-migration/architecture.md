# Target architecture

## Overview

```text
                                  +----------------------+
Public browser -----------------> | CloudFront           |
                                  |                      |
                                  | default -> web S3    |
                                  | /data/* -> data S3   |
                                  | /api/* -> HTTP API   |
                                  +----+-----------+-----+
                                       |           |
                            private OAC |           | no cache
                                       v           v
                               +-------------+  +-------------+
                               | private S3  |  | API Gateway |
                               | web + data  |  | JWT auth    |
                               +-------------+  +------+------+
                                                       |
Admin browser -> Cognito Hosted UI -> JWT              v
                                                +-------------+
                                                | Lambda      |
                                                | validation  |
                                                +------+------+
                                                       |
                                                       v
                                                private data S3
```

## Repository layout

The maintained application is the Nuxt workspace. The removed legacy
application remains recoverable from the approved local immutable tag during
the rollback window; it is not part of the active worktree.

```text
/
├── package.json                 # npm workspaces and shared commands
├── package-lock.json
├── .nvmrc                       # Node 24
├── web/                         # Nuxt 4 static application
├── packages/
│   └── core/                    # provider-neutral domain types and pure logic
├── services/
│   └── schedule-api/            # bare Lambda handlers and S3 adapter
├── infra/                       # AWS CDK v2
├── scripts/
│   └── migration/               # provider-neutral preview and deployment helpers
├── docs/aws-migration/
└── tests/                       # maintained unit, infra, and preview contracts
```

Use npm workspaces. Do not add Turborepo, Nx, pnpm workspace tooling, or a
monorepo build orchestrator for four small packages.

## Runtime choices

### Web

- Nuxt 4
- Vue 3 Composition API and `<script setup lang="ts">`
- TypeScript strict mode
- Nuxt static generation
- `@nuxtjs/i18n` with `prefix_except_default`
- Plain semantic HTML and scoped/global CSS
- `oidc-client-ts` only for the administrator OIDC Authorization Code + PKCE
  flow

Do not add Pinia initially. Shared schedule behavior lives in composables and
provider-neutral repository functions. Add a store only after a concrete
cross-route state requirement is demonstrated.

### Core

`packages/core` has no runtime dependencies. It owns:

- Stadium slugs and metadata types.
- Schedule document types and validation functions.
- Status values and display mapping.
- Japan calendar date helpers.
- Marathon time parsing, formatting, and lap calculations.

Date-only arithmetic uses UTC as an internal calendar representation after
deriving "today" from `Intl.DateTimeFormat` with `Asia/Tokyo`. This avoids a
date library and avoids viewer-local date drift.

### API

- API Gateway HTTP API.
- One Lambda for the small administrator API, split into route handler
  functions internally.
- AWS SDK v3 S3 client, bundled and pinned.
- No Lambda framework and no middleware framework.
- Runtime validation through explicit functions in `packages/core`; TypeScript
  types alone are not validation.

### Infrastructure

- AWS CDK v2 in TypeScript.
- One stack during migration. Use its CloudFront distribution domain for
  preview; attach production DNS only after Phase 5 approval.
- Resources have removal protection where data loss matters.
- CDK context or parameters provide domain, certificate, callback/logout URLs,
  and administrator configuration. Never hard-code credentials.

## AWS resources

### Web bucket

- Block all public access.
- Bucket-owner enforced object ownership.
- Server-side encryption.
- CloudFront read access through Origin Access Control only.
- No Lambda write access.

### Data bucket

- Separate from the web bucket.
- Block all public access.
- Origin Access Control read access limited to `data/*`.
- Versioning enabled.
- Lifecycle policy moves or expires noncurrent versions only after an explicit
  retention decision; default first release keeps them.
- Update Lambda can read current objects and conditionally put only
  `data/v1/stadiums/*/availability/*.json`.
- The Lambda cannot delete objects.

Separate buckets ensure a compromised update path cannot change application
code.

### CloudFront

- HTTPS redirect.
- Modern TLS policy.
- Security response headers.
- Default origin: web bucket.
- `/data/*`: data bucket, GET/HEAD only.
- `/api/*`: API Gateway, caching disabled, required headers forwarded.
- CloudFront Function on the default behavior maps extensionless routes to
  `index.html`.
- Custom error behavior must not turn missing assets or API errors into the
  application shell.

Cache policy:

| Content | Browser | CloudFront |
| --- | --- | --- |
| HTML | `no-cache` | minimum TTL 0 |
| `/_nuxt/*` hashed assets | 1 year immutable | 1 year |
| Images with stable names | 1 day initially | 1 day |
| `/data/*` schedule JSON | 0 seconds | `s-maxage=60` |
| `/api/*` | no-store | disabled |

The public site may display data up to 60 seconds old. Show `updatedAt` in the
schedule UI. Do not invoke a distribution-wide invalidation after each admin
update.

### Cognito

- User Pool only; no Identity Pool.
- Self-service local sign-up disabled.
- Local Cognito users are the only app-client identity provider.
- Hosted UI uses Authorization Code + PKCE.
- `admins` group grants schedule write permission.
- Operators create users explicitly; the `admins` group starts empty.
- API Gateway validates issuer, audience and required scope.
- Lambda independently checks the `cognito:groups` claim.

### API Gateway and Lambda

- Only administrator write endpoints are exposed.
- Public reads go directly through CloudFront to S3.
- Configure bounded throttling on write routes.
- Structured logs omit tokens and request bodies containing identity data.
- CloudWatch alarm on sustained 5xx responses is optional for first preview
  but required before production cutover.

## Nuxt page structure

```text
web/app/
├── app.vue
├── pages/
│   ├── index.vue
│   ├── yumenoshima.vue
│   ├── komazawa.vue
│   ├── todoroki.vue
│   ├── manage.vue
│   ├── pace/marathon.vue
│   └── nozomiantena/index.vue
├── components/
│   ├── AppHeader.vue
│   ├── AppFooter.vue
│   ├── StadiumPage.vue
│   ├── ScheduleTable.vue
│   ├── ScheduleLegend.vue
│   ├── WeekPagination.vue
│   ├── PaceTable.vue
│   └── AdSlot.client.vue
├── composables/
│   ├── useSchedule.ts
│   └── useAdminSession.client.ts
├── repositories/
│   └── httpScheduleRepository.ts
└── assets/css/
    ├── tokens.css
    └── main.css
```

Separate route files preserve URLs and SEO, while `StadiumPage` removes page
duplication.

## Dependencies

### Allowed when their task is reached

Runtime:

- `nuxt`
- `@nuxtjs/i18n`
- `oidc-client-ts`
- `@aws-sdk/client-s3` in the API package
- `aws-cdk-lib` and `constructs` in infrastructure

Development:

- TypeScript
- Vitest
- Playwright
- ESLint with Nuxt's supported integration
- `esbuild` for Lambda bundling

Any additional dependency requires an entry in `decisions.md` containing:
problem, alternatives considered, bundle/maintenance cost, and removal plan.

### Explicitly remove or do not migrate

- Vue 2 and `vue-template-compiler`
- Vue CLI and webpack-specific plugins
- Vuex
- Vue Router as a direct dependency
- `vue-class-component`
- `vue-property-decorator`
- Vuetify and `vuetify-loader`
- Bootstrap
- Stylus and `stylus-loader`
- Moment.js
- `vue-google-adsense`
- `vue-script2`
- `register-service-worker`
- Firebase client SDK
- Core-js 2
- Material Icons webfont

AdSense, if retained, is loaded through a small client-only Nuxt plugin and
component. Google Maps remains a lazy iframe. GA4 is opt-in through environment
configuration; do not migrate the Universal Analytics identifier.

## Provider isolation

The web application knows only:

```ts
interface ScheduleReader {
  getMonth(stadium: StadiumSlug, yearMonth: YearMonth): Promise<ScheduleMonth>
}
```

It fetches `/data/v1/...` using standard HTTP. It does not import S3, Cognito,
CloudFront, or API Gateway SDKs.

The administrator update client calls the HTTP API with an OIDC access token.
AWS-specific code is limited to:

- `services/schedule-api/src/aws/`
- `infra/`

## Authoritative AWS references

- Private S3 origins and OAC:
  https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html
- Extensionless route rewrite:
  https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/example_cloudfront_functions_url_rewrite_single_page_apps_section.html
- API Gateway JWT authorizers:
  https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html
- Cognito external identity providers:
  https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-identity-provider.html
- S3 conditional writes:
  https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html
