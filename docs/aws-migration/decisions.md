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

Status: accepted

Problem:

T14E must read the legacy Firestore project `itsrun-aaf42` twice without
granting write access, committing a credential, or turning an operator token
into a migration artifact. The repository intentionally does not contain
`firebase-admin`, and this workstation currently has no `gcloud` executable.

Decision:

Prefer a temporary service account named `itsrun-fs-export-20260809` in
`itsrun-aaf42`, with only `roles/datastore.viewer`, and short-lived impersonated
Google Application Default Credentials. Grant the named operator
`roles/iam.serviceAccountTokenCreator` on that exact service account only; do
not create a service-account key. Install exact `firebase-admin@14.2.0` as a
root migration-only development dependency and change the exporter to use
`applicationDefault()` with the exact project ID. The operator performs the
interactive gcloud login and creates impersonated ADC outside logs; no token
or ADC file is copied into the repository or chat. The exporter remains
restricted in code to `default/0`, `stadium_info`, and the four documented
`availability/{legacyId}/date` collections. It performs two successive reads,
normalizes both snapshots, and requires identical normalized-data hashes
before transformation proceeds.

The operator CLI receives the exact absolute path of that ignored impersonated
ADC file through a dedicated argument. Before loading Firebase Admin it
realpath-validates containment beneath the reviewed isolated gcloud directory,
parses only the non-secret credential type and impersonation URL contract, and
requires the exact temporary service-account email. It may set
`GOOGLE_APPLICATION_CREDENTIALS` internally only for the Firebase SDK
lifecycle, then restores the prior environment in `finally`. Arbitrary
environment overrides, service-account key JSON, external-account files, user
ADC, alternate impersonation targets, symlinks, and repository-tracked paths
remain rejected. This avoids writing or replacing the operator's standard
HOME ADC location.

The operator revokes ADC immediately after the second verified export. Remove
the Token Creator and Viewer bindings and delete the temporary service account
after the migration evidence is accepted. Remove `firebase-admin` and the
credential adapter in T17. A temporary service-account JSON key is a fallback
only if impersonated ADC cannot be made available; it requires a separate
explicit amendment because key creation and handling have a larger credential
surface.

This decision authorizes neither installing `gcloud`, granting Google Cloud
IAM, authenticating, reading Firestore, nor installing the repository
dependency until the user accepts D018 and selects an operator procedure.

Alternatives:

- Direct user ADC: rejected because an existing owner/operator account can
  carry permissions broader than the export needs.
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

Revoke ADC, remove the service-account Token Creator and project Viewer
bindings, delete the temporary service account, delete ignored raw exports
after evidence retention is satisfied, and remove `firebase-admin` plus the
export adapter in T17. No Firebase data is mutated, so no data rollback is
required.

## D019: Normalize exact legacy status strings during Firestore export

Status: accepted

Problem:

The first two authorized production reads completed the six exact allowlisted
Firestore calls but stopped before output. The reviewed diagnostic reports a
`status` validation failure at the first availability document. The legacy
client deliberately applied `Number(...)` to each of the three stored status
slots, while the migration parser currently accepts only numeric `0`, `1`, and
`2`. No source value was logged or committed.

Decision:

At the Firestore migration boundary only, accept each status slot when it is
either numeric `0`, `1`, or `2`, or the exact one-character string `"0"`,
`"1"`, or `"2"`. Normalize the exact string form to the corresponding number
before T14B transformation. Continue to reject every other string, number,
type, tuple length, sparse tuple, extra field, date, path, or collection
identity. Keep the runtime API and target data schema numeric-only.

After local implementation and tests, permit two additional bounded read-only
captures using the existing exact temporary identity and read plan. Both
normalized hashes, counts, and context hashes must match. No diagnostic third
capture, broader read, Firestore write, or AWS operation is authorized.

Alternatives:

- Reject the source as malformed: safe but prevents migration of values the
  deployed legacy client intentionally interpreted as valid statuses.
- Accept arbitrary numeric strings or call `Number(...)`: rejected because it
  would admit whitespace, alternate formatting, and values outside the schema.
- Inspect or log raw source values: rejected because migration evidence does
  not require production content disclosure.

Cost and maintenance effect:

The compatibility rule is isolated to the temporary Firestore snapshot parser
and has no runtime dependency or infrastructure effect.

Rollback/removal:

Remove the temporary Firestore exporter and its compatibility rule with
`firebase-admin` in T17 after migration evidence is accepted.

## D020: Explicit credential modes for the preview web deployment helper

Status: accepted

Problem:

T15B requires an exact local AWS profile, while T15C must use GitHub OIDC and
must not create a profile or long-lived AWS credential. Treating both as an
implicit ambient credential chain would weaken fail-closed account and
principal checks; forcing `--profile codex-prod` in Actions would prevent the
OIDC session from being used correctly.

Decision:

The web-only deployment helper has two explicit, mutually exclusive credential
modes. Operator mode requires the exact `codex-prod` profile and rejects the
GitHub Actions execution context. GitHub mode accepts no profile or access-key
input, requires the exact repository and branch-ref context, and consumes only
the short-lived environment credentials established by the reviewed OIDC
action. Both modes call STS before any mutation and require account
`470447451992`; GitHub mode additionally requires the assumed-role principal
for the fixed role `itsrun-preview-github-web-deploy`.

The GitHub trust policy remains the security boundary and matches only
`repo:subaru44k/itsrunnew:ref:refs/heads/migration/aws-s3-cloudfront` with
audience `sts.amazonaws.com`. Environment-context checks in the helper are
defence in depth, not a substitute for that trust. Credentials, tokens, and
profiles are never accepted as workflow inputs, command arguments, reports,
or artifacts. The helper must not fall back from one mode to the other.

Alternatives:

- Always pass `--profile codex-prod`: rejected because GitHub OIDC supplies an
  ephemeral environment session, not a workstation profile.
- Accept the default AWS credential chain without a mode: rejected because a
  local or CI misconfiguration could select an unintended principal.
- Materialize OIDC credentials into an AWS profile: rejected because it adds
  a credential file and unnecessary secret-handling surface.

Cost and maintenance effect:

The extra mode and STS assertions are small pure validation branches with no
runtime dependency. The physical role name is stable so the expected STS ARN
can be asserted and audited.

Rollback/removal:

Remove GitHub mode and the dedicated role/provider if Actions deployment is
retired. Operator mode remains preview-only and does not authorize production
deployment.

## D021: Extend the existing preview CloudFormation execution policy for GitHub OIDC

Status: superseded by D022 after the T15E03 policy-size stop

Problem:

`ItsRunPreviewGitHubDeploy` is deliberately managed by CloudFormation, so its
execution role needs narrowly scoped IAM lifecycle permissions for one OIDC
provider and one role. The existing preview execution policy already has five
saved versions (`v1` through `v5`), which is the IAM limit. Creating a second
manually attached policy would introduce bootstrap-role attachment drift, while
creating `v6` without first removing a nondefault version is impossible.

Decision:

Extend the existing `ItsRunPreviewCloudFormationExecutionPolicy` with exactly
two independent statements. One statement covers the explicit lifecycle,
read, and tag actions required by `AWS::IAM::OIDCProvider` on only
`arn:aws:iam::470447451992:oidc-provider/token.actions.githubusercontent.com`.
The other covers the explicit role and inline-policy lifecycle, read, and tag
actions required by `AWS::IAM::Role` on only
`arn:aws:iam::470447451992:role/itsrun-preview-github-web-deploy`.

Do not add `iam:PassRole`, `iam:ListOpenIDConnectProviders`, managed-policy
attachment actions, wildcard actions or resources, another provider/role, or
any non-IAM service action. Before creating `v6`, require all of the following:

- AWS/default `v5` exactly matches the committed pre-change policy;
- AWS `v1` exactly matches commit `dc22db1` and its canonical SHA-256 is
  `598747d3e2158c4c52cfd9b50cb4c4883f8ac9f6c07013b54ed12ed24be1591a`;
- `v1` is nondefault and `v5` is default;
- the provider, role, and stack do not already exist;
- the candidate differs from `v5` only by the two reviewed statements.

Delete only nondefault `v1`, then immediately create `v6` with
`--set-as-default`. Preserve `v2` through `v5` and verify AWS `v6` exactly
matches the committed candidate before any stack deployment. The deleted `v1`
document remains recoverable from commit `dc22db1`; record the deletion and
hash in the implementation log. A failed create after the deletion is a stop
condition, not authority to remove another version or broaden permissions.

Alternatives:

- Attach a second managed policy directly to the bootstrap execution role:
  rejected because it creates separately managed attachment state outside the
  existing bootstrap policy contract.
- Create the OIDC provider or role manually: rejected because it creates
  console/CLI drift from the reviewed CloudFormation stack.
- Use account-wide IAM resources or `iam:*`: rejected because the two physical
  resource names are known before deployment.

Cost and maintenance effect:

There is no runtime cost. The execution policy gains two exact-resource IAM
statements; four rollback versions remain available and `v1` remains archived
in Git history.

Rollback/removal:

Set a retained prior version (`v5`) as default before rolling back the stack.
Because both resources use retain policies, remove them only through a future
separately reviewed retirement plan; do not infer deletion authority from a
workflow rollback.

## D022: Fit the initial OIDC deployment into the existing policy size limit

Status: accepted

Problem:

The exact D021 candidate has 6,624 non-whitespace characters. IAM rejected its
single authorized creation attempt because a customer-managed policy is limited
to 6,144 characters. The attempt made no policy version; `v5` remains default
and `v2` through `v5` remain available. Deleting another version cannot solve a
per-version size limit, and a second managed policy would retain the bootstrap
attachment drift rejected by D021.

Decision:

Keep one execution policy and preserve its effective v5 contract. Reuse the
existing `PreviewScheduleLambdaRole` statement because it already contains the
exact thirteen role and inline-policy actions reviewed for the GitHub deploy
role. Change only its `Resource` from the existing schedule-role ARN to an
array containing that unchanged ARN and the exact
`arn:aws:iam::470447451992:role/itsrun-preview-github-web-deploy` ARN. This is
semantically the same action/resource permission pair reviewed in D021 without
duplicating the action list.

For the initial retained `AWS::IAM::OIDCProvider` creation, grant only:

- `iam:CreateOpenIDConnectProvider`;
- `iam:GetOpenIDConnectProvider`;
- `iam:ListOpenIDConnectProviderTags`;
- `iam:TagOpenIDConnectProvider`.

Scope all four actions to only
`arn:aws:iam::470447451992:oidc-provider/token.actions.githubusercontent.com`.
Do not pre-grant provider update, client-ID mutation, thumbprint mutation,
untag, or deletion actions. The CDK provider has retain policies, and none of
those actions is required by the reviewed initial-create template. A future
provider update or retirement requires its own exact policy review.

The compact candidate must remain at or below 6,144 non-whitespace characters;
the reviewed construction is 6,077. It must differ from AWS/default v5 only by
the exact role Resource addition and one four-action provider statement. No
existing action is removed, and no wildcard, PassRole, list-provider, managed
policy, service, account, provider, or role scope is added.

Alternatives:

- Delete another policy version: rejected because version count and policy
  document size are independent limits.
- Remove existing v5 permissions: rejected because the deployed HostingStack
  still requires its lifecycle contract.
- Grant all OIDC lifecycle actions now: rejected because they are unnecessary
  for initial creation and do not fit the existing policy.

Cost and maintenance effect:

There is no runtime cost or additional managed policy. The 67-character size
headroom is small but deterministic and protected by an exact size assertion.

Rollback/removal:

Set v5 as default to remove all GitHub-stack execution permissions. Retained
provider/role cleanup remains a separately reviewed future operation.

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
