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

## D016: Exact HTTP API stage tagging permission

Status: accepted

Problem:

After the D015 correction, CloudFormation reached `AdminApiDefaultStage` but
failed with an explicit authorization denial. The execution role was denied
`apigateway:TagResource` on
`arn:aws:apigateway:ap-northeast-1::/apis/n8ubvb3mm6/stages`, request ID
`b2cb6489-7135-4019-b6c5-982f68a16b70`. Policy v4 permits the API Gateway HTTP
management verbs on `/apis` and `/apis/*`, but it does not contain the distinct
`apigateway:TagResource` action requested by the CloudFormation resource
provider. The stack rolled back to `UPDATE_ROLLBACK_COMPLETE` and retained
another empty User Pool and empty schedule LogGroup outside the restored graph.

Decision:

Prepare managed policy v5 by adding one independent statement only:

- `Sid`: `PreviewHttpApiStageTags`;
- `Action`: `apigateway:TagResource`;
- `Resource`: `arn:aws:apigateway:ap-northeast-1::/apis/*/stages`.

Do not add the action to the broader `/apis/*` lifecycle statement. Do not add
`UntagResource`, another API Gateway action, a stage descendant wildcard,
another region, `Action: *`, or `Resource: *`. Tests must prove v5 differs from
the exact committed v4 contract only by this statement, and AWS policy
simulation must allow the exact denied action/resource while leaving unrelated
tag resources implicitly denied.

After explicit authorization, create exactly one v5 managed-policy version and
set it default without deleting v1-v4. Read it back and require exact equality
with the committed candidate before any cleanup or deployment. Then clean only
the fully gated empty failed-deploy resources, run exactly one deployment, and
perform read-only acceptance verification.

Alternatives:

- Add `TagResource` to `PreviewHttpApi`: rejected because that grants it across
  every `/apis/*` descendant instead of the observed stages collection.
- Add `UntagResource` preemptively: rejected because no denial or current
  operation requires it.
- Remove stack tags or bypass CloudFormation tagging: rejected because standard
  ownership tags are required for audit and exact cleanup gates.
- Use AdministratorAccess or PowerUserAccess: rejected.

Cost and maintenance effect:

The statement adds no runtime resource or cost. It preserves exact
CloudFormation ownership tags while limiting the new tagging action to preview
HTTP API stage collections in one region.

Rollback/removal:

After T11/T12 deployment stabilizes, reassess whether this creation-time action
is needed for ongoing deployments; remove it in a later least-privilege policy
version if not. The failed-deploy cleanup exception applies only to the exact
empty resources recorded in the recovery plan.

## D017: Browser no-store enforcement and time-bounded preview fixture refresh

Status: accepted

Problem:

The first successful T11/T12 deployment proved the complete infrastructure
graph, but final acceptance exposed two independent gaps:

1. `/api/*` uses the managed `CachingDisabled` policy, yet CloudFront responses
   generated before Lambda (JWT 401 and method-filter 405) do not explicitly
   send the architecture's browser contract `Cache-Control: no-store`.
2. The honest raw preview suite and the isolated schedule-state suite were
   written against the deterministic non-production fixture for
   2026-07-31 through 2026-08-06. On 2026-08-09 they correctly render the new
   week as unpublished, so eight availability assertions fail despite both
   July and August fixture objects remaining present, valid, private, and
   readable through CloudFront.

Decision:

Create a separate stack-owned API response-headers policy. It must reproduce
the complete existing security-header and Permissions-Policy contract and add
exactly `Cache-Control: no-store` with override enabled. Bind it only to
`api/*`; keep the public HTML and data behaviors on the existing security
policy so immutable/data cache metadata is not overwritten. Keep managed
`CachingDisabled`, the exact origin request policy, and the method filter.

For the mocked schedule-state suite only, use Playwright's standard clock API
to pin the retained-data test to its documented fixture window. Do not add any
clock, route, fetch, retry, or fixture interception to the raw public suite.

For the raw end-to-end acceptance, generate the existing clearly labeled
seven-day non-production fixture for 2026-08-09 through 2026-08-15. After
explicit authorization, conditionally replace only
`data/v1/stadiums/oda/availability/2026-08.json` in the versioned preview data
bucket using its exact current strong ETag. Preserve the previous version, use
the existing JSON/cache metadata, upload no web or other data object, perform
no invalidation, and wait for the bounded 60-second CloudFront data cache to
return the new exact hash.

The direct HTTP API's authorizer-generated 401 is not customizable by the
Lambda response code and is not the browser endpoint. Acceptance requires the
CloudFront `/api/*` browser path to send explicit no-store; Lambda unit tests
continue to require no-store on every application response.

Alternatives:

- Add no-store to the shared response policy: rejected because it would
  override browser caching for public HTML, assets, and `/data/*`.
- Add a viewer-response function: rejected because a response-headers policy
  also covers viewer-request-generated 405 responses with less edge code.
- Weaken or remove the availability assertions: rejected because preview must
  prove real CloudFront/private-S3 data renders in the UI.
- Mock time or fetch in the raw suite: rejected because it must remain an
  unmodified browser/network acceptance test.
- Invalidate CloudFront: rejected because `/data/*` has a bounded 60-second
  cache and routine data writes must not require invalidation.

Cost and maintenance effect:

One response-headers policy has negligible cost. The fixture write creates one
recoverable S3 object version only. Preview fixtures remain explicitly
non-production and need a deliberate date-window refresh when raw acceptance
is rerun outside their published range.

Rollback/removal:

Rebind `api/*` to the original security policy to remove the browser no-store
override. Restore the recorded previous August object version if fixture
rollback is required; never delete versions or apply this procedure to
production data.

## D018: Temporary read-only Firestore export authentication

Status: proposed

Problem:

T14E must read the legacy Firestore project `itsrun-aaf42` twice without
granting write access, committing a credential, or turning an operator token
into a migration artifact. The repository intentionally does not contain
`firebase-admin`, and this workstation currently has no `gcloud` executable.

Decision:

Prefer short-lived Google Application Default Credentials belonging to a named
operator who has only `roles/datastore.viewer` on `itsrun-aaf42`. Install exact
`firebase-admin@14.2.0` as a root migration-only development dependency and
change the exporter to use `applicationDefault()` with the exact project ID.
The operator performs the interactive ADC login outside logs; no token or ADC
file is copied into the repository or chat. The exporter remains restricted in
code to `default/0`, `stadium_info`, and the four documented
`availability/{legacyId}/date` collections. It performs two successive reads,
normalizes both snapshots, and requires identical normalized-data hashes
before transformation proceeds.

The operator revokes ADC immediately after the second verified export and the
temporary Firestore Viewer binding is removed after the migration evidence is
accepted. Remove `firebase-admin` and the credential adapter in T17. A
dedicated temporary service-account JSON key is a fallback only if ADC cannot
be made available; it requires a separate explicit amendment because key
creation and handling have a larger credential surface.

This decision authorizes neither installing `gcloud`, granting Google Cloud
IAM, authenticating, reading Firestore, nor installing the repository
dependency until the user accepts D018 and selects an operator procedure.

Alternatives:

- Temporary service-account JSON with `roles/datastore.viewer`: operationally
  simple but creates a long-lived private key and therefore is not the default.
- Firestore REST calls with a copied access token: rejected because token
  handling and Firestore value decoding add avoidable security and correctness
  risk.
- Managed Firestore export to Cloud Storage: rejected because it adds a GCS
  write target and broader export permissions while T14 needs only five exact
  collection/document scopes.

Cost and maintenance effect:

The dependency and operator IAM binding are temporary. The two bounded reads
have negligible cost for this dataset. No credential remains in Git, AWS, or
the migration artifacts.

Rollback/removal:

Revoke ADC, remove the temporary Viewer binding, delete ignored raw exports
after evidence retention is satisfied, and remove `firebase-admin` plus the
export adapter in T17. No Firebase data is mutated, so no data rollback is
required.

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
