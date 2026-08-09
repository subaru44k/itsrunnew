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

## D013: CloudFront API authorization forwarding with managed caching disabled

Status: accepted

Problem:

The first T11/T12 deployment proved that CloudFront rejects a custom cache
policy whose minimum, default, and maximum TTL are all zero while its
`HeaderBehavior` whitelists `Authorization`. CloudFormation returned
`The parameter HeaderBehavior is invalid for policy with caching disabled` for
`ApiCacheA0112D40`. The CDK L2 origin-request-policy helper also rejects
`Authorization`, although the current CloudFront service documentation permits
forwarding it individually in an origin request policy when caching is fully
disabled.

The failed stack update rolled back safely, but the User Pool's intentional
deletion protection and `RETAIN` policy left one empty, stack-tagged User Pool
outside the rolled-back stack resource graph.

Decision:

Use the AWS-managed `CachingDisabled` cache policy for `/api/*`. Create the
stack-owned API origin request policy through the CloudFormation L1 resource so
its exact whitelist is `Authorization`, `Content-Type`, `If-Match`, and
`If-None-Match`. Forward no cookies or query strings and never forward the
viewer `Host` header. Keep the existing GET/PUT/OPTIONS viewer method filter.

The L1 resource is a narrow escape hatch for a current CloudFront capability
that the installed CDK L2 validation does not expose. Semantic assertions must
pin the managed cache-policy ID and the complete custom origin-policy config.
Do not replace it with all-viewer forwarding or a positive cache TTL.

Before the corrected retry, and only after explicit authorization, remove the
empty retained pool created by the failed update. Reconfirm its exact ID,
CloudFormation tags, deletion protection, creation time, and zero users,
clients, groups, resource servers, external providers, and domain immediately
before disabling deletion protection and deleting it. Never apply this cleanup
procedure to a populated or differently tagged pool.

Alternatives:

- Keep the custom zero-TTL cache policy: rejected by the CloudFront service.
- Forward all viewer headers except `Host`: rejected because it forwards more
  untrusted viewer state than the documented four-header contract.
- Use a positive TTL so `Authorization` can be in the cache key: rejected
  because administrator API responses must never be cached.
- Use deprecated `ForwardedValues`: technically supports exact headers and
  zero TTL, but rejected while the current individual origin-policy service
  capability is available.
- Rename or abandon the retained User Pool: rejected because it would leave an
  unmanaged resource and weaken cleanup/accountability.
- Import the pool with a temporary CloudFormation template: rejected as a more
  complex multi-template recovery for an empty, never-used failed-deploy
  resource.

Cost and maintenance effect:

The managed cache policy creates no stack resource and the custom origin
policy was already included in reviewed policy v4, so no policy v5 or new
service is required. The L1 assertion is intentionally strict to detect a
future CDK/service contract change. The empty-pool cleanup and corrected stack
retry are separate protected AWS writes recorded in the implementation log.

Rollback/removal:

CloudFront behavior can return to another reviewed no-cache mechanism only
through a new decision. The deployed User Pool remains deletion-protected and
retained; the empty-pool cleanup exception applies only to the exact orphan
created by the failed 2026-08-09 preview update.

## D014: Stable physical name for the preview schedule Lambda

Status: accepted

Problem:

Policy v4 intentionally limits Lambda lifecycle operations to
`arn:aws:lambda:ap-northeast-1:470447451992:function:itsrun-preview-schedule-api`.
The second T11/T12 deployment synthesized no `FunctionName`, so CloudFormation
generated `ItsRunPreviewHosting-ScheduleApiFunctionA177D4FE-SMCxODhObRRy` and
was denied `lambda:CreateFunction`. Rollback also reported denied
`lambda:DeleteFunction` for that generated ARN, although the function was not
created. CloudFormation subsequently reached `UPDATE_ROLLBACK_COMPLETE`
without intervention. The failed update retained a second empty User Pool and
the explicit empty schedule LogGroup outside the restored stack graph.

Decision:

Set the schedule Lambda's physical name explicitly to
`itsrun-preview-schedule-api` and assert the exact synthesized `FunctionName`.
This makes the template match the already-reviewed least-privilege policy v4;
no policy v5 or IAM expansion is permitted. Keep the existing exact LogGroup
name, role, API integration, invoke permissions, runtime, environment, and
runtime IAM contracts unchanged.

Before another deployment, remove only the exact failed-deploy leftovers after
fresh read-only gates and explicit authorization: User Pool
`ap-northeast-1_CWmMgPepN`, and LogGroup
`/aws/lambda/itsrun-preview-schedule-api`. The pool must retain its exact stack
tags, creation time, deletion protection, and zero users, clients, groups,
resource servers, identity providers, and domain. The LogGroup must retain its
exact stack tags, creation time, 30-day retention, zero streams, and zero stored
bytes. Any mismatch stops cleanup. No CloudFormation rollback recovery call is
needed while the stack is `UPDATE_ROLLBACK_COMPLETE`.

Alternatives:

- Broaden policy v4 to the generated-name prefix: rejected because a stable,
  environment-specific name is already documented and narrower.
- Create policy v5 for only the failed generated ARN: rejected because the
  function is absent and CloudFormation completed rollback without it.
- Import or reuse the empty retained resources: rejected as more complex than
  deleting unused failed-deploy leftovers before their first successful stack
  ownership.

Cost and maintenance effect:

The stable name makes IAM review deterministic and adds no resource or runtime
cost. Exact cleanup prevents unmanaged empty resources and a same-name
LogGroup collision on the next deployment.

Rollback/removal:

Changing the physical Lambda name later requires a new decision and matching
least-privilege IAM review. The failed-deploy cleanup exception applies only to
the two exact resources recorded above and does not authorize deleting any
deployed or populated resource.

## D015: Account-qualified API Gateway invoke permissions

Status: accepted

Problem:

The third T11/T12 deployment reached Lambda permission creation but
CloudFormation rejected both `AWS::Lambda::Permission.SourceArn` values with
`failed validation constraint for keyword [pattern]`. The synthesized joins
were missing the account-ID component and its following colon, producing the
equivalent of `arn:aws:execute-api:ap-northeast-1:<api-id>/...` rather than the
documented execute-api ARN form. Existing tests asserted the same malformed
join and therefore did not detect it. The update rolled back to
`UPDATE_ROLLBACK_COMPLETE`; the fixed-name Lambda is absent, and another empty
User Pool and empty retained schedule LogGroup remain outside the restored
stack graph.

Decision:

Insert the `AWS::AccountId` pseudo parameter and delimiter into both exact
GET/PUT Lambda permission source ARNs. The required shape is
`arn:<partition>:execute-api:<region>:<account-id>:<api-id>/$default/<method>/api/v1/stadiums/*/availability/*`.
Retain the separate GET and PUT permissions, exact `$default` stage, exact
methods and path, API Ref, Lambda ARN Ref, and API Gateway service principal.

Semantic tests must assert the complete joins, including `AWS::AccountId`, and
resolve them with deterministic example pseudo-parameter/API values to prove
the resulting strings match the documented ARN contract. No wildcard stage or
method, broader path, IAM policy change, or policy v5 is permitted.

Before another deployment, and only after fresh explicit authorization, remove
the exact empty failed-deploy User Pool `ap-northeast-1_U6JenEvrT` and exact
empty retained LogGroup `/aws/lambda/itsrun-preview-schedule-api` using the same
complete gates as D014. Then allow exactly one corrected deploy and read-only
acceptance verification.

Alternatives:

- Use a stage/method wildcard or the whole API execution ARN: rejected because
  the two exact routes are known and least privilege is required.
- Change Lambda or CloudFormation IAM: rejected because the failure is template
  schema validation, not an authorization denial.
- Reuse the orphaned empty resources: rejected because they are no longer in
  the rolled-back stack graph and would collide with explicit names.

Cost and maintenance effect:

The correction adds no resource, dependency, or runtime cost. Deterministic
resolved-ARN tests prevent another syntactically incomplete permission from
passing semantic assertions.

Rollback/removal:

Any future API stage, route, or account change requires matching permission and
test updates. The cleanup exception applies only to the exact empty resources
recorded above.

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
