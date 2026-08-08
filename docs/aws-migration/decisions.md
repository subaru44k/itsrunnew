# Architecture decision log

## D001: Nuxt 4 static generation

Status: accepted

Use Nuxt 4 with static generation. Dynamic schedule content is fetched in the
browser. This preserves SEO for editorial pages without requiring an
always-running server.

## D002: CloudFront and private S3

Status: accepted

Use regular private S3 bucket origins with CloudFront Origin Access Control.
Do not use public S3 website endpoints.

## D003: Monthly JSON instead of a database

Status: accepted

Store one availability document per stadium per calendar month. Current access
patterns require only key-based read and whole-month update. DynamoDB would add
data modeling, permissions and operational surface without a current query or
concurrency requirement that justifies it.

Revisit if:

- Multiple independent editors frequently update the same stadium/month.
- Partial updates or searchable history become product requirements.
- A monthly object approaches the 32 KiB contract limit.

## D004: Separate web and mutable-data buckets

Status: accepted

The schedule-update Lambda must not have a path to modify executable website
content.

## D005: Cognito User Pool with Google federation

Status: superseded by D012

Preserve Google sign-in through standard OIDC. Use API Gateway JWT validation
and a Lambda `admins` group check. Do not use Cognito Identity Pools or expose
AWS credentials to the browser.

Superseded before the first Cognito deployment. No Google IdP or Google OAuth
secret was created by this migration.

## D006: Minimal dependencies

Status: accepted

Use plain CSS and semantic HTML. Do not migrate Vuetify, Bootstrap, Stylus,
Moment, Vuex, Firebase, AdSense wrappers or the service-worker package.

Every new dependency beyond the allowlist in `architecture.md` needs a new
decision entry before installation.

## D007: No date dependency

Status: accepted

Use `Intl.DateTimeFormat` to derive the Japan calendar date and pure,
well-tested date-only helpers for arithmetic. Do not use viewer-local
`Date` arithmetic.

## D008: No PWA in the first release

Status: accepted

Availability freshness matters more than offline behavior. Reintroducing a
service worker requires a separate cache/freshness design.

## D009: Same-origin administrator API

Status: accepted

Route `/api/*` through CloudFront to API Gateway. This avoids production CORS
complexity and keeps one browser origin. Public reads remain `/data/*`.

## D010: Single AWS preview-to-production stack

Status: accepted

To reduce cost, create one AWS stack and validate it through the CloudFront
distribution domain. Attach production DNS after final approval instead of
maintaining duplicate long-lived staging infrastructure.

## D011: Scoped standard CDK bootstrap

Status: accepted

Problem:

The target account is not bootstrapped. The standard bootstrap defaults the
CloudFormation execution role to `AdministratorAccess`, which is broader than
the preview hosting stack needs.

Decision:

Use the standard modern CDK bootstrap in account `470447451992`, region
`ap-northeast-1`, with no cross-account trust and with a project-specific
managed CloudFormation execution policy. The policy permits only the named
preview S3 buckets, the CloudFront operations required by the hosting stack,
bootstrap-version SSM reads (`GetParameter` and the CDK changeset's
`GetParameters` call), and conditional creation of the CloudFront
service-linked role. Unsupported resource-level CloudFront operations may use
`Resource: "*"` but never `Action: "*"`.

Alternatives:

- Default `AdministratorAccess`: rejected as unnecessarily broad.
- `PowerUserAccess`: rejected because it grants unrelated services.
- A bootstrapless synthesizer using the current IAM user directly: rejected
  because it removes the distinct deployment role and creates a nonstandard
  long-term operational path.

Cost and maintenance effect:

Standard bootstrap adds an empty staging bucket and ECR repository plus CDK
roles. Empty resources have negligible ongoing cost; the managed execution
policy must be reviewed when the stack gains a new AWS service.

Rollback/removal:

Before production use, the `ItsRunPreviewHosting` and `CDKToolkit` stacks and
the project execution policy can be removed after confirming no other CDK
application uses the default qualifier in this account/region.

## D012: Cognito local users for administrator authentication

Status: accepted

Problem:

Google federation requires a Google Cloud OAuth application, a client secret,
Secrets Manager storage, identity-provider lifecycle permissions, and ongoing
coordination with an external provider. The administrator population is small
and no requirement for Google Workspace SSO has been demonstrated.

Decision:

Use Cognito User Pool local users as the only app-client identity provider.
Keep the Cognito Hosted UI, Authorization Code + PKCE, the public app client,
self-service sign-up disabled, no Identity Pool, the custom write scope, API
Gateway JWT validation, and the independent Lambda `admins` group check.

Operators create users explicitly. The `admins` group starts empty; an
operator adds only approved users. A local authenticated user who is not in
`admins` is the required non-admin authorization test subject. Do not add
automatic domain/email-based administrator assignment.

Alternatives:

- Google federation: rejected for the first release because it adds an
  external credential and IAM surface without a current SSO requirement.
- A custom login form using Cognito APIs: rejected because the Hosted UI keeps
  the browser on the reviewed OIDC Authorization Code + PKCE path.
- Cognito Identity Pool: rejected because the browser must never receive AWS
  credentials.

Cost and maintenance effect:

Remove the Google identity-provider resource, Google OAuth parameters,
Secrets Manager reference, and their deployment permissions. Cognito becomes
the password, recovery, and optional MFA operator, so administrator account
creation, disablement, recovery, and group membership must be documented and
tested.

Rollback/removal:

Google federation can be reconsidered in a later decision if an explicit SSO
requirement appears. It must not be enabled by an undocumented console-only
change. Before production retirement, retain or export the required operator
account inventory; user passwords cannot be exported.

## Decision template

Copy for new decisions:

```text
## DNNN: Title

Status: proposed | accepted | superseded

Problem:

Decision:

Alternatives:

Cost and maintenance effect:

Rollback/removal:
```
