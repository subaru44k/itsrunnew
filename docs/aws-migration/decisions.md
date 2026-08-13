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

## D023: Bootstrap the first preview deployment without a default-branch merge

Status: accepted

Problem:

GitHub accepted and validated the migration branch, but rejected the sole
`workflow_dispatch` API request with HTTP 404 because the deployment workflow
does not yet exist on the default branch. GitHub only registers a manually
dispatched workflow from the default branch. Merging the migration or workflow
to `master` now would violate the Phase 5 review boundary, and temporarily
changing the default branch would weaken repository controls.

Decision:

Use one temporary, branch-and-path-restricted push trigger to bootstrap the
first preview deployment entirely from `migration/aws-s3-cloudfront`. Add a
`push` trigger to `deploy-preview-web.yml` that matches only that exact branch
and only changes to `.github/workflows/deploy-preview-web.yml`. Keep
`workflow_dispatch` unchanged for later use after the reviewed workflow reaches
the default branch. Do not add pull-request, schedule, tag, wildcard branch,
repository-dispatch, environment, or input triggers.

The commit adding this trigger is the explicit one-time deployment request.
Push it once, require the workflow's own validation job to succeed, then allow
its deploy job to assume the exact OIDC role and update only preview web
objects. Do not retry a failed deployment run. After successful external
verification, remove only the temporary push trigger and push the cleanup
commit. GitHub evaluates the workflow definition at the pushed revision, so
the cleanup revision has no push trigger and cannot deploy. Require the normal
validation workflow on every pushed revision.

This exception authorizes exactly one deployment run, not a second dispatch.
The prior rejected API request created no run and consumed no AWS authority.
It does not authorize `master`, HostingStack, data, invalidation, IAM, Cognito,
production, DNS, or Firebase changes.

Alternatives:

- Cherry-pick the workflow to `master`: rejected because it crosses the final
  migration review/merge boundary early.
- Change the repository default branch temporarily: rejected because it is a
  broad repository-control mutation with ambiguous workflow effects.
- Keep a permanent push deploy trigger: rejected because later workflow edits
  could deploy implicitly.

Cost and maintenance effect:

The temporary trigger exists for one reviewed commit interval and is removed
immediately after acceptance. No dependency or AWS resource is added.

Rollback/removal:

The mandatory cleanup commit removes the temporary trigger. The permanent
workflow remains `workflow_dispatch` only until a later reviewed default-branch
merge makes manual dispatch available.

## D024: Correct the selected-action pattern before the one deployment retry

Status: accepted

Problem:

The D023 push created exactly one deployment workflow run, but GitHub ended it
at `startup_failure` before creating a job. The selected-action setting read
back as `aws-actions/configure-aws-credentials`, which lacks the required
`@TAG-OR-SHA` suffix and therefore matches no action invocation. The normal
validation workflow succeeded because it uses only GitHub-owned actions. The
failed deployment run had zero jobs, logs, OIDC sessions, and AWS writes.

Decision:

Correct the repository's sole non-GitHub selected-action pattern to the exact
already reviewed workflow reference:

```text
aws-actions/configure-aws-credentials@00943011d9042930efac3dcd3a170e4273319bc8
```

Keep `github_owned_allowed=true`, `verified_allowed=false`, selected-only
actions, SHA pinning required, and default workflow permissions read-only.
Do not use `@*`, a tag, organization wildcard, another action, or verified-all.
Read the setting back before another workflow push.

Authorize one new push-triggered deployment run because the first run never
entered a job and could not exercise deployment authority. Make the recovery
request an explicit workflow-file commit while the exact D023 trigger is still
present. Do not use GitHub's rerun endpoint or `workflow_dispatch`. After a
successful run, continue the mandatory D023 trigger cleanup and master
protection. A second startup/deployment failure is a hard stop.

Alternatives:

- Allow `aws-actions/configure-aws-credentials@*`: rejected because only one
  audited SHA is used.
- Allow all verified actions: rejected because it is substantially broader.
- Rerun the failed run: rejected because the run snapshot predates the explicit
  settings correction and the plan requires a separately identifiable request.

Cost and maintenance effect:

No AWS or runtime change. The repository policy becomes both syntactically
valid and narrower than the originally intended repository-level pattern.

Rollback/removal:

Remove the exact AWS action pattern if GitHub preview deployment is retired.
The D023 cleanup still removes the temporary push trigger after success.

## D025: Use the AWS CLI streaming-blob path contract for PutObject

Status: accepted

Problem:

After the D024 repository policy correction, the deployment workflow created
jobs, passed validation/build/OIDC, and failed in the helper immediately after
successful `GetCallerIdentity` and `DescribeStacks`. CloudTrail contains no
write event and S3 contains no object updated during the run. A local
non-sending AWS CLI skeleton validation reproduces the failure:
`s3api put-object --body fileb:///absolute/path` returns `ParamValidation`
because the streaming `Body` option requires a filesystem path. Passing the
same absolute path without a URI prefix validates successfully.

Decision:

Change only `putObjectArgs` so `--body` is followed by the already preflighted
absolute `object.path`, not `fileb://${object.path}`. Preserve the exact
executable, argument-array execution, child environment, bucket/key/content
type/cache metadata, object ordering, size/path/symlink checks, reports, OIDC
checks, and every other helper/workflow contract. Never invoke a shell or log
the local path.

Add deterministic tests proving the body value is the exact absolute path,
contains no `file:`, and remains a separate argument. Run AWS CLI
`--generate-cli-skeleton output` locally for one generated object as a
non-writing integration check. No new dependency or IAM permission is needed.

Authorize one final new workflow-file push and deployment run because both
prior failed runs made zero S3 writes: the first had zero jobs, and the second
failed client-side before PutObject. Do not rerun either run or use dispatch.
After success, remove the temporary trigger and complete T15 protection and
verification. Any further deployment failure is terminal.

Alternatives:

- Use `aws s3 cp`: rejected because it weakens the exact per-object metadata
  and command allow-list contract.
- Pass file contents on stdin: rejected because it complicates bounded child
  input and testing.
- Add S3/IAM permissions: rejected because policy simulation already allows
  the exact PutObject resource and the request never reached S3.

Cost and maintenance effect:

One argument changes; no AWS resource, dependency, or permission changes.

Rollback/removal:

Revert the argument only if a future AWS CLI contract changes and a reviewed
non-writing validation demonstrates the replacement.

## D026: Rotate the execution policy from T15 creation authority to the exact T16 alarm

Status: accepted

Problem:

T16 requires one stack-owned HTTP API 5xx alarm. The current CloudFormation
execution policy v6 is 6,077 non-whitespace characters against IAM's 6,144
character limit, so appending CloudWatch permissions is not possible. V6 also
retains two T15-only creation surfaces after the OIDC provider and deployment
role have reached their reviewed steady state: OIDC-provider creation/tagging
and lifecycle authority for the GitHub deployment role.

Decision:

Use the standard `AWS/ApiGateway` HTTP API metric named `5xx`, with exact
dimensions `ApiId` and `Stage=$default`. Create exactly one metric alarm named
`itsrun-preview-admin-api-5xx`: Sum over 300 seconds, threshold 1,
`EvaluationPeriods=3`, `DatapointsToAlarm=2`, comparison greater than or equal
to threshold, and `TreatMissingData=notBreaching`. It has an explicit preview
description and no alarm action, SNS topic, dashboard, anomaly detector, or
route-level detailed-metric charge.

Create candidate execution policy v7 by starting from committed v6 and making
only these changes:

- remove `PreviewGitHubOidcProviderLifecycle` in full;
- restore `PreviewScheduleLambdaRole.Resource` to the Hosting schedule role
  pattern only, removing the exact GitHub deployment role ARN;
- add `PreviewAdminApi5xxAlarm`, permitting only
  `cloudwatch:PutMetricAlarm`, `cloudwatch:DeleteAlarms`, and
  `cloudwatch:DescribeAlarms` on
  `arn:aws:cloudwatch:ap-northeast-1:470447451992:alarm:itsrun-preview-admin-api-5xx`.

The alarm receives no tags, so CloudFormation does not need CloudWatch tag
actions. Before creating v7, prove AWS v6 equals the committed v6 candidate and
AWS nondefault v2 equals commit `22d7fd5` (canonical SHA-256
`9318b40d9d601231335f6a1a4271ec8e5edc5700f5367dec2a407c329bee9f54`).
Delete only v2 to free the fifth version slot, create v7 as default, and retain
v3-v7. Deploy only `ItsRunPreviewHosting` after template validation, exact
diff review, and policy simulation pass.

Alternatives:

- Attach a second broad execution policy: rejected because it creates another
  independently drifting privilege surface.
- Keep the OIDC creation permissions and broaden a wildcard statement: rejected
  because the policy is at its size limit and the T15 creation authority is no
  longer needed for Hosting maintenance.
- Alarm on a route-level metric: rejected because it requires paid detailed
  metrics; the exact API and `$default` stage already isolate this admin API.
- Add notifications: rejected until an operator endpoint is deliberately
  selected.

Cost and maintenance effect:

One standard metric alarm has a small recurring CloudWatch charge. The
execution role loses T15 creation authority and gains only exact-alarm
lifecycle authority. GitHub web deployments keep using their separate runtime
role and are unaffected.

Rollback/removal:

CloudFormation may delete the exact alarm using v7. V6 remains retained for a
bounded rollback, but re-creating the OIDC provider or GitHub role requires a
new Sol review rather than silently restoring their creation authority.

## D027: Satisfy Nuxt CLI's optional Commander peer at the workspace root

Status: accepted

Problem:

T16A's required `npm ls --all` gate reports `ELSPROBLEMS`. Nuxt 4.4.8 brings
`@nuxt/cli@3.37.0` and `@bomb.sh/tab@0.0.19`. Tab declares optional peer
`commander` as `^13.1.0 || ^14.0.0 || ^15.0.0`, but npm resolves the unrelated
SVGO root copy `commander@11.1.0` to that peer. Builds and tests pass, but the
installed tree is not semantically valid. Updating Nuxt would be a broad,
unrelated release change and a global override would break SVGO's `^11.1.0`
contract.

Decision:

Add exact-pinned `commander@15.0.0` as a root development-only dependency. It
supports the project's Node 24 baseline and satisfies Tab's optional CLI peer;
npm must keep `commander@11.1.0` nested for SVGO and `2.20.3` nested for Terser.
No application source may import Commander and it must not enter the public web
or Lambda runtime bundles. Update only the root manifest and lockfile, then run
a clean install, exact dependency-tree assertions, and the complete T16A suite
again at the new immutable commit.

Alternatives:

- Ignore `npm ls` or use `--legacy-peer-deps`: rejected because it weakens the
  release dependency gate.
- Globally override Commander: rejected because SVGO requires major 11.
- Upgrade Nuxt and its CLI transitively: rejected as a much broader migration
  during release verification.
- Patch `node_modules` or the lockfile manually: rejected as non-reproducible.

Cost and maintenance effect:

This adds one build-time package already expected by an installed CLI peer and
does not change deployed runtime dependencies. Remove it when the Nuxt CLI tree
no longer exposes the optional peer collision, after `npm ls --all` proves the
tree remains valid.

Rollback/removal:

Remove the root dev dependency and regenerate the lockfile only together with
a reviewed Nuxt/CLI update that satisfies a clean `npm ls --all`.

## D028: Use ephemeral reserved-domain identities for preview authorization proof

Status: accepted

Problem:

T16 must prove the deployed local Cognito admin and non-admin flows, but no
production operator identity is yet approved. Inferring a real email from Git
metadata or sending invitations would be inappropriate. Skipping real Hosted
UI/JWT verification would leave the central authorization boundary untested.

Decision:

For T16 preview verification only, create exactly two ephemeral Cognito local
users whose email-shaped usernames use the reserved `.invalid` domain and
identify only the roles `preview-t16-admin` and `preview-t16-nonadmin`. Suppress
all Cognito messages, mark the synthetic email attributes verified, generate
strong random passwords only in an operator process or mode-0600 temporary
storage outside the repository, and never print or persist credentials/tokens.

The `admins` group must be empty before creation. Add only the synthetic admin,
prove the non-admin is excluded, execute real Authorization Code + PKCE Hosted
UI flows, and inspect browser storage/logging boundaries. After the T16D exact
data restore and evidence collection, remove the admin from the group and
delete both users. Prove the group and pool return to zero users. These users do
not authorize production cutover; a named human operator remains a Phase 5
entry requirement.

Alternatives:

- Infer the repository author's email: rejected because commit authorship is
  not administrator authorization.
- Ask for or log passwords: rejected because credentials stay outside chat and
  Git.
- Use mocked tokens or the test-only browser adapter: rejected because T16 must
  prove the deployed Cognito/Lambda boundary.
- Retain synthetic accounts: rejected because they have no operational owner.

Cost and maintenance effect:

The two preview users exist only during a bounded rehearsal and produce
ordinary Cognito/API/CloudWatch usage. No identity provider, pool, client, IAM,
or application change is required.

Rollback/removal:

On failure before schedule mutation, remove membership and delete both users.
On failure after mutation, exact schedule restoration takes priority; delete
the users only after restoration evidence is secure.

## D029: Rehearse one conditional Oda update and restore exact versioned bytes

Status: accepted

Problem:

The admin editor, Lambda conditional write, public 60-second freshness, conflict
handling, and rollback path require a real preview data rehearsal. The API
sets `updatedAt`, so using it to restore the old logical document cannot restore
the exact original bytes.

Decision:

Reserve only
`data/v1/stadiums/oda/availability/2026-08.json`. Immediately before mutation,
capture its current ETag, VersionId, metadata, length, SHA-256, and exact bytes
outside Git; validate the document and require the known pre-rehearsal tuple
`2026-08-09[0] = 0`. In the admin UI change only that tuple to `1` and save once
with the loaded strong ETag. Use a second authenticated admin browser loaded
before the first save to issue one stale conditional save and prove 409 with no
additional S3 version.

After public/API/log verification, restore the captured exact bytes with one
direct operator `s3:PutObject` to that exact key, preserving content type and
cache control and requiring `If-Match` against the test version's ETag. Do not
delete/copy/delete-marker any version and do not use an unconditional write.
Verify the restored current SHA-256 equals the original, record the three
VersionIds/ETags, validate parser output, and observe CloudFront returning the
restored tuple within the 60-second contract. The temporary bytes are removed
only after exact restoration is proven.

Alternatives:

- Restore through the API: rejected because server-controlled `updatedAt`
  changes the exact bytes.
- Delete the test version: rejected because rollback evidence and version
  history must remain intact.
- Unconditional operator overwrite: rejected because it could erase concurrent
  work.
- Exercise a different or production object: rejected; this is the already
  reviewed preview Oda fixture-derived object.

Cost and maintenance effect:

Exactly two successful new S3 object versions are expected: the test API write
and the conditional exact restore. The rejected stale write creates no version.
No invalidation is used; verification observes the 60-second cache contract.

Rollback/removal:

The restored version remains current and prior versions remain retained. If the
conditional restore precondition fails, stop all other work, retain the exact
bytes/version reference, and return to Sol without attempting another write.

## D030: Permit the exact Cognito issuer origin for browser OIDC discovery

Status: accepted

Problem:

The first real T16 Hosted UI attempt safely failed before authorization. The
deployed runtime config contains the exact user-pool issuer and client ID, and
the issuer's OIDC metadata correctly points to the Hosted UI authorization and
token endpoints. However, `oidc-client-ts` must first fetch
`/.well-known/openid-configuration` from the issuer origin
`https://cognito-idp.ap-northeast-1.amazonaws.com`. The current CloudFront CSP
allows only self and the Hosted UI auth origin in `connect-src`, so the browser
blocks discovery and the application reports a sanitized authentication error.

Decision:

Add only `https://cognito-idp.<stack-region>.amazonaws.com` to `connect-src`,
alongside self and the existing parameterized Cognito Hosted UI origin. Do not
allow a path, wildcard region/domain, Google endpoint, `*.amazonaws.com`, or any
other connect origin. Apply the same shared CSP to the existing web and API
response-header policies as today. Assert the exact ordered CSP string and
absence of broad/foreign origins.

Alternatives:

- Hard-code OIDC metadata in the web: rejected because discovery is the
  standards-based source of the deployed authorization/token endpoints.
- Use the Hosted UI domain as issuer: rejected because JWT issuer validation
  must remain the User Pool provider URL.
- Add an AWS wildcard: rejected because one exact regional origin is sufficient.
- Disable CSP or browser auth: rejected because both are security requirements.

Cost and maintenance effect:

No new resource, dependency, IAM permission, or recurring charge. Updating the
two existing response-header policies changes only one exact CSP origin and
allows standards-based discovery.

Rollback/removal:

Remove this origin only if the administrator OIDC client no longer performs
browser discovery and an equivalent reviewed issuer-validation design replaces
it.

## D031: Diagnose Hosted UI credentials with one disposable user and no data access

Status: accepted

Problem:

After D030, real browsers reach OIDC discovery, authorize, and the legacy
Hosted UI login form, but valid-looking credential submissions return to login
without callback. Duplicate responsive forms were handled with visible-only
selectors; users were `CONFIRMED`; password values were strongly generated,
quoted, and never logged. The previous run did not capture the Hosted UI's
sanitized error category or distinguish email-alias resolution from the
internal Cognito username.

Decision:

Create one new suppressed `.invalid` diagnostic user, set one permanent
password composed of `Aa1!` plus cryptographically random hexadecimal
characters, and capture the returned internal Username only in protected
operator memory. Confirm status/attributes through `AdminGetUser`. From one
fresh OIDC authorization transaction, attempt the email alias once; capture
only redirect hosts/paths, HTTP status, and a normalized allowlisted error
category. If it fails before callback, repeat once in a fresh context with the
internal Username. Never print page HTML, entered values, cookies, CSRF/ASF
data, codes, tokens, claims, query strings, or raw errors.

Do not add the user to `admins`, call the API, or touch schedule data. Delete
the user immediately after both outcomes or the first successful callback,
clear all temporary state, and prove pool/group zero. This is a bounded
diagnostic, not a weakening of email-based sign-in or a production identity
decision.

Alternatives:

- Guess that `.invalid` aliases are unsupported: rejected without evidence.
- Enable password auth flows on the app client: rejected because the browser
  contract remains Authorization Code + PKCE only.
- Capture raw login pages/network bodies: rejected because they contain
  credentials and transaction material.
- Use a real email: rejected until a named production operator is approved.

Cost and maintenance effect:

One short-lived Cognito user and at most two login attempts. No resource,
dependency, IAM, configuration, or data change.

Rollback/removal:

The user is always deleted and browser/credential state cleared. A successful
diagnosis is converted into a separate reviewed recovery plan before another
T16 rehearsal.

## D032: Resume the rehearsal with the corrected callback classifier and email aliases

Status: accepted

Problem:

D031 proved that both the synthetic email alias and internal Cognito Username
complete Authorization Code + PKCE and traverse `/manage/callback` to
`/manage`. The earlier C03 runs were falsely reported as login failures because
the diagnostic looked only at the final history-replaced path. The corrected
normalizer recognizes any observed callback path and has an AWS-free regression
test. Internal Username is an implementation identifier and should not become
an operator login contract.

Decision:

Accept the corrected callback classifier and resume T16C/D using only the
synthetic email aliases. Run the full desktop/mobile admin/non-admin matrix,
then two independently authenticated admin editor contexts for the conditional
update/conflict. Preserve all D028-D029 secret, cleanup, conditional-write, and
exact-restore controls. Internal Usernames may be used only by Cognito cleanup
APIs in protected operator memory and never for login or evidence.

Alternatives:

- Treat immediate history replacement as auth failure: rejected by the real
  callback sequence and the application design.
- Use internal UUID usernames operationally: rejected because the pool is
  configured for email sign-in.
- Skip the full matrix after the diagnostic: rejected because no API/admin-group
  authorization has yet been proven.

Cost and maintenance effect:

No resource, dependency, IAM, or application change. The corrected test harness
prevents false-negative operational evidence.

Rollback/removal:

Keep the classifier while the callback page uses same-document history
replacement. D028 cleanup and D029 exact data restore remain mandatory.

## D033: Record callback navigation before login and require signed-in UI state

Status: accepted

Problem:

FR02's four cases ended at `/manage` with no API request, but its driver did not
attach response/navigation collection before authentication and supplied only
the final URL to the callback normalizer. Cognito legitimately replaces
`/manage/callback` with `/manage` immediately, so the evidence lost the callback
that D031's pre-registered listener had observed. This is a test-driver evidence
defect, not a new Cognito failure.

Decision:

Add an AWS-free tested browser recorder boundary that is attached before the
login click and retains only allowlisted host/path/status metadata, never query,
headers, bodies, cookies, or DOM. The operational driver must require both an
observed `/manage/callback` and a signed-in UI sentinel (logout control plus the
admin load form) before making the role-appropriate GET. Waiting for final
`/manage` alone is insufficient. Use this one driver for every desktop/mobile
admin/non-admin case and the two stale-editor contexts.

Alternatives:

- Increase a fixed sleep: rejected because it does not repair lost event
  ordering.
- Treat final `/manage` as proof: rejected because signed-out and signed-in
  states share the path.
- Inspect tokens or network headers: rejected because UI state and API outcome
  prove authorization without exposing credentials.

Cost and maintenance effect:

No runtime/dependency/AWS change. A deterministic operator-test boundary avoids
another false negative and preserves sanitized evidence.

Rollback/removal:

Keep the recorder while the callback uses immediate history replacement;
replace it only with an equivalent tested event-ordering contract.

## D034: Keep the protected rehearsal in one bounded credential-owning process

Status: accepted

Problem:

BR02 stopped before login because Cognito setup and browser execution were
separated across operator processes; the protected password state was correctly
unavailable to the later process. The users were immediately cleaned up and no
data write occurred. Recreating or resetting passwords between milestones adds
unnecessary identity writes and another failure surface.

Decision:

Run the next protected rehearsal in one bounded local process that generates
credentials, creates users/membership, drives all browser contexts, performs the
conditional update/conflict, restores exact bytes, and cleans identities. The
process may use a newly created mode-0700 directory and mode-0600 files outside
the repository for credentials and original bytes. It must validate those files
before the first AWS write, never print their path/content, and remove them in a
`finally` cleanup after successful restore.

The process source is temporary and outside Git. Before execution, inspect it
for exact targets/actions, no shell interpolation, sanitized output only, a
single-attempt restore guard, restoration-first failure handling, and identity
cleanup. Emit one sanitized summary only after cleanup. Do not split setup and
browser work across turns or processes.

Alternatives:

- Persist passwords in Git, chat, Actions, or shell history: rejected.
- Reset passwords in each milestone: rejected as unnecessary mutation.
- Store browser tokens/storage state between processes: rejected by the
  memory-only token contract.
- Keep users after failure: rejected; pre-data failures require cleanup.

Cost and maintenance effect:

No repository/runtime/AWS resource change. The bounded process reduces
credential lifetime and ensures cleanup/restore control flow owns all mutable
state.

Rollback/removal:

Delete the temporary process and directory after verified restore and identity
cleanup. Preserve the protected original bytes only if the single conditional
restore fails and Sol recovery is required.

## D035: Use Cognito's returned internal Username for administration only

Status: accepted

Problem:

The first D034 runner stopped safely after `AdminCreateUser` because
`AdminSetUserPassword` received the email alias rather than the internal
Username returned by Cognito. In a pool configured with `UsernameAttributes:
[email]`, the email is the sign-in alias while Cognito generates a stable
internal Username for administrative APIs. The runner discarded stderr and
cleaned the single user; pool/group/data returned to zero.

Decision:

Parse and validate each `AdminCreateUser` response in memory and use its exact
returned internal Username for password setting, group membership, AdminGetUser,
group removal, and deletion. Use the email alias only in the Hosted UI form.
Never output either identifier. Before AWS execution, run an adapter-level fake
test proving create returns an internal identifier, every subsequent admin call
uses it, browser input uses only the alias, and cleanup retains the internal
identifier on partial failure.

The temporary runner may classify future AWS failures by operation and stable
service error code, but must not emit stderr/message/request IDs or arguments.

Alternatives:

- Continue using the alias for admin APIs: rejected by the observed failure.
- Use internal UUID for browser login: rejected because email is the documented
  operator sign-in contract.
- Log both values for debugging: rejected as unnecessary identity exposure.

Cost and maintenance effect:

No AWS resource, dependency, or runtime change. One in-memory mapping corrects
the operator harness.

Rollback/removal:

Remove the mapping only if Cognito changes the pool's username contract in a
separately reviewed migration.

## D036: Treat successful no-output AWS CLI operations as void

Status: accepted

Problem:

Top-level CloudTrail metadata for IU02 shows `AdminCreateUser` and
`AdminSetUserPassword` both completed, no second create was attempted, and the
first user was later deleted. `admin-set-user-password` returns empty stdout on
success. The temporary runner parsed every successful AWS CLI stdout as JSON,
so the empty successful response caused a local parse failure. The fake adapter
incorrectly returned an object and missed this contract.

Decision:

The temporary runner's command adapter must distinguish JSON-returning and
void-success operations. For an exit-code-zero void operation, require empty or
whitespace stdout and return a fixed internal `void-success` sentinel; never
call `JSON.parse`. JSON operations must still require nonempty valid JSON.
Update the AWS-free adapter test to model real empty stdout for password set,
group add/remove, and user delete, and prove the sequence proceeds to the second
create while cleanup remains exact.

Failure evidence may expose only the operation category and stable local/service
code, not stderr, stdout, arguments, identities, or messages.

Alternatives:

- Make AWS CLI emit synthetic JSON: rejected because the operation contract is
  naturally void.
- Ignore all parse errors: rejected because JSON-returning operations must stay
  strictly validated.
- Infer an AWS service failure: rejected by the successful CloudTrail event.

Cost and maintenance effect:

No AWS/runtime/dependency change. The operator adapter matches AWS CLI output
semantics and gains a regression test.

Rollback/removal:

Keep explicit JSON/void operation typing for all future operational runners.

## D037: Keep Cognito credentials out of child-process argument lists

Status: accepted

Problem:

During the authorized VO02 run, a primary read-only process inspection printed
the child AWS CLI argument list, which contained the ephemeral email/password
used for Cognito setup. The runner was immediately terminated before browser or
data access; the exact two users and one group membership were deleted; the
pool/group and object returned to baseline; process memory, temporary directory,
and runner were removed. No token, authorization code, long-lived AWS
credential, schedule write, or restore was involved. The incident also exposed
a design flaw: sensitive AWS CLI values should not be command-line arguments
because any local process listing can observe them.

Decision:

For Cognito operations containing alias, temporary/permanent password, or
internal Username, write one operation-specific JSON document in the runner's
mode-0700 directory with mode 0600 and invoke AWS CLI with only
`--cli-input-json file://<validated-temporary-path>`. Delete each input file
immediately after the child exits. No sensitive value may occur in executable
arguments, environment, output, error, shell history, report, or process title.
Browser credentials remain only in the owning Node process memory.

Add an AWS-free test that scans every constructed child executable/argument/
environment value and proves neither aliases nor passwords nor internal IDs are
present, while the protected JSON payload is written only through the injected
mode-0600 file adapter. Do not inspect process command lines during the next
run; monitor only sanitized runner status and independent AWS counts.

Alternatives:

- Continue passing quoted arguments: rejected because quoting does not hide
  process arguments.
- Put secrets in environment variables: rejected because process environments
  are another inspection surface.
- Add the Cognito SDK: rejected because secure CLI input files solve the problem
  without a dependency.
- Reuse exposed credentials: rejected; their users were deleted.

Cost and maintenance effect:

No AWS/runtime/dependency change. Short-lived protected input files replace
sensitive argv and are deleted after each operation.

Rollback/removal:

Never revert to sensitive argv. A future SDK migration must preserve the same
no-log/no-env/no-process-title boundary.

## D038: Drive only the visible Hosted UI sign-in form and retain typed checkpoints

Status: accepted

Problem:

The protected SA02 rehearsal completed both local-user setup paths but stopped
before browser authentication. Top-level CloudTrail metadata shows the Hosted
UI authorize/login GET sequence and no login POST. A read-only desktop/mobile
DOM inspection found Cognito renders two responsive copies of the sign-in
form, with exactly one visible copy. The committed harness proves callback
recording and protected CLI inputs, but the temporary runner's form selection,
fill, and submit sequence has no deterministic test or sanitized operation
checkpoint. Repeating the same opaque runner would not produce new evidence.

Decision:

Add a dependency-free Hosted UI form driver to the committed T16 harness. It
must scope all controls to exactly one visible `cognitoSignInForm`, require one
visible username, password, and submit control, fill the two values without
returning or logging them, confirm only boolean/non-secret readiness, and use a
real submit-control click so Cognito's existing submit handler still runs. The
driver returns only an allowlisted checkpoint category. A local browser fixture
must reproduce the duplicate responsive forms on desktop and mobile and prove
that the visible form alone submits exactly once. Failure cases cover no visible
form, ambiguous visible forms, missing/disabled controls, fill failure, and no
observed submit, without preserving DOM or raw errors.

Before another real execution, run a no-credential, no-submit read-only check
against the live Hosted UI to prove the exact scoped controls are singular,
visible, and enabled at both viewports. Then one new protected execution may
run from an independently verified empty pool/group and unchanged reserved
object. It must expose only typed setup/form/callback/sentinel/data/cleanup
checkpoints. No process inspection, raw CloudTrail event, DOM, URL query,
identity, credential, token, AWS error, or stack trace may be recorded.

On a pre-data failure, cleanup and stop with the typed checkpoint. After the
first conditional schedule write, exact restoration remains the only priority.
All D028-D037 no-retry, exact-object, no-invalidation, preview-only, and cleanup
boundaries remain unchanged.

Alternatives:

- Retry the temporary runner unchanged: rejected because it would repeat an
  unobservable failure.
- Submit the form programmatically with `requestSubmit`: rejected because it
  can bypass the existing control-click behavior used by Cognito's page.
- Capture screenshots, DOM, console, request bodies, or raw errors: rejected
  because they can retain credentials or authentication material.

Cost and maintenance effect:

No dependency or AWS resource change. The operational form boundary becomes
locally reproducible and future Hosted UI markup drift produces a typed stop.

Rollback/removal:

Keep the typed form driver while Hosted UI is used; remove it only with the T16
operational harness after migration acceptance.

## D039: Commit and test the rehearsal coordinator before another protected run

Status: accepted

Problem:

HF01's unit test used a hand-built locator fake and repeated the same object for
the desktop/mobile labels; it did not exercise Playwright, responsive CSS,
locator visibility, or a real form submit event as D038 required. HF03 then
returned only a generic failure after setup, without any D038 form checkpoint.
The data and identities were safely restored to baseline, but the temporary
runner still owned too much uncommitted orchestration for Sol to review or test.

The current driver also starts the injected navigation promise before fill but
does not settle/cancel it on an early fill or click failure, and classifies a
click failure as `fill-failed`. These are locally correctable contract gaps; a
further opaque rehearsal would not be justified.

Decision:

Keep the environment-specific credential and AWS/browser adapters temporary,
but move the complete credential-free rehearsal coordinator into the committed
harness. It receives injected Cognito, browser-role, data-rehearsal, and cleanup
adapters; advances through an explicit allowlisted state machine; and always
returns the last safe checkpoint and cleanup/restoration counts. Its tests must
cover full success, every pre-browser/setup failure, every form/callback/
sentinel role outcome, post-write failure with restoration priority, cleanup
failure, and sanitized output. No credential, identity, object body, raw error,
or adapter argument may enter the result.

Replace the simulated responsive proof with a real local Chromium test using
the already installed Playwright dependency. The HTML fixture renders two
Cognito-shaped responsive forms with CSS selecting one at desktop and the other
at mobile. The committed driver must fill and click only the visible scoped
form, observe exactly one real submit event, and leave the hidden form empty.
Fix the navigation-signal lifecycle so early action failures cannot leave an
unhandled rejection or timer, and distinguish `fill-failed` from `click-failed`.

Only after these committed tests and a repeated read-only baseline gate succeed
may one protected run use a thin temporary adapter around the exact committed
coordinator. The final result must identify the last typed checkpoint even on
failure. Do not retry an untyped or mismatched result.

Alternatives:

- Patch another temporary runner: rejected because Sol cannot reproduce its
  control flow after deletion.
- Keep the locator fake as browser proof: rejected because it cannot detect
  Playwright selector, visibility, or submit-event mismatches.
- Commit credentials or environment-specific identities: rejected; only the
  credential-free coordinator belongs in Git.

Cost and maintenance effect:

No dependency or AWS resource change. More of the operational workflow becomes
reviewable and deterministic, reducing repeated live Cognito rehearsals.

Rollback/removal:

Retain the coordinator through T16 acceptance and remove it with migration-only
operational tooling in the documented cleanup phase.

## D040: Commit the secret-free preview adapter and require proof-bearing stage results

Status: accepted

Problem:

PF03 correctly refused to invent another unreviewed temporary runner. Sol's
review of the new coordinator found that its `lastCheckpoint` is always replaced
by `cleanup`, resolved adapter calls are accepted without validating their
result, a resolved form failure can be treated as success, and the coordinator
can report success without a confirmed update or restore. The coordinator is a
useful boundary but is not yet proof-bearing.

The environment adapter does not need credentials in source, arguments, or
environment. The two reserved-domain aliases and strong passwords can be
generated inside one Node process; Cognito CLI payloads can continue through
D037 protected JSON; and Playwright can receive values directly in memory.
Therefore the adapter source itself can and should be committed and tested.

Decision:

Define exact, non-secret results for every coordinator stage. Preflight proves
the exact target/baseline; setup proves users=2/admins=1; each form proves
`form-submitted`; callbacks prove observed callback; signed-in sentinels prove
the expected admin 200 or non-admin 403; data read proves both contexts loaded
the baseline; update proves one PUT and a new ETag/VersionId; stale proves one
PUT, 409, and unchanged current version; public observation proves tuple 1;
restore proves one conditional write and exact original bytes/hash/metadata;
cleanup proves users=0/admins=0. Any other resolved value is a typed contract
failure. Preserve the failure checkpoint separately from cleanup/restore
progress. Successful completion is impossible unless update, stale conflict,
restore, and cleanup proofs all pass.

Commit a preview-specific, credential-free executable adapter. It contains only
reviewed constants and code, generates ephemeral aliases/passwords in process,
uses protected mode-0600 Cognito CLI JSON, drives real Playwright pages with the
committed form driver/recorder, and retains original object bytes only in its
mode-0700 temporary directory. It prints only the coordinator's sanitized
allowlisted result. The executable accepts no username/password/token/body
argument or environment variable. Unit/integration tests inject fake CLI,
browser, clock, and object adapters and scan process boundaries/output for
canaries. Direct execution requires an explicit preview-only confirmation flag,
exact AWS profile/account/region gates, zero starting users/group, and the D029
object baseline.

One execution is permitted only after Sol accepts the committed executable and
all AWS-free tests. No process inspection or raw authentication material is
allowed. Restoration-first and all existing preview-only boundaries remain.

Alternatives:

- Continue with deleted temporary runners: rejected because their behavior is
  neither reviewable nor reproducible.
- Put credentials in environment variables: rejected by D037 and because child
  processes can inherit them.
- Accept resolved calls without proof objects: rejected because no-op adapters
  could produce false success.

Cost and maintenance effect:

No dependency or AWS resource change. The one-time rehearsal becomes a normal
reviewed operational program with deterministic fake tests.

Rollback/removal:

Remove the preview executable and coordinator after T16 evidence is accepted;
keep the operational evidence and security decisions.

## D041: Replace the injected adapter stub with two concrete bounded executables

Status: accepted

Problem:

PA02 did not implement its plan. The committed module still requires six
injected environment adapters, and direct execution always fails as
`adapter-unconfigured`. It contains no concrete AWS CLI, protected filesystem,
Playwright, API/data, or restoration implementation. It also discards the
internal Username returned by AdminCreateUser and uses the email alias for
password/group/delete operations, reintroducing the D035 failure. Fake tests
therefore prove only the stub, not an executable rehearsal.

The operator has also confirmed that historical Firebase data may be discarded.
No further Firestore capture, historical comparison, or production-history
preservation is required. This does not remove the need to prove real Cognito
authorization and one preview conditional write, but it allows the remaining
work to focus only on the new stack.

Decision:

Split the final live proof into two concrete committed executables. The first is
authentication-only: it implements the protected AWS CLI and Playwright
adapters in source, creates two ephemeral users, uses returned internal
Usernames for all administration, proves desktop/mobile admin 200 and non-admin
403 through the real callback, then cleans identities. It cannot call S3 PUT.

Only after that succeeds, the second executable reuses the reviewed authenticated
browser boundary for the exact D029 one-cell preview update, stale conflict,
public observation, and exact original-byte restoration. It cannot access any
other object. Both executables generate credentials internally, accept no
secret input, print one sanitized result, and are fake-tested before one live
execution each. Do not add another generic injected stub.

T17 removes Firebase runtime/configuration and migration-only Firestore tooling
and dependencies. Historical source artifacts need not be carried into the AWS
site. Production DNS/cutover remains a separate explicit boundary.

Alternatives:

- Continue extending the generic stub: rejected because it has repeatedly
  allowed fake success while direct execution is impossible.
- Skip real authentication: rejected because the Hosted UI path is the last
  unproven user-facing dependency.
- Repeat Firestore export/compare: rejected as unnecessary under the updated
  data-retention requirement.

Cost and maintenance effect:

No AWS resource or dependency change. The live steps become smaller, observable,
and independently recoverable; Firestore work ends.

Rollback/removal:

Remove both preview executables with the migration harness after T16 acceptance.

## D042: Validate AdminGetUser's top-level Username response

Status: accepted

Problem:

The one CF02 run safely stopped during setup and cleaned both users. Sanitized
top-level CloudTrail event names show both creates/passwords and the group add
succeeded, followed by exactly one AdminGetUser and cleanup. The concrete code
and fake incorrectly modeled AdminGetUser as `{ User: { Username } }`; AWS CLI
returns `{ Username, ... }`. The first successful service response was therefore
rejected locally before the second get or any browser/data operation.

Decision:

Validate the exact nonempty top-level `Username` and require it to equal the
internal Username supplied to AdminGetUser. Correct the fake to the real shape
and add negative missing/nested/mismatched response tests. Re-run all local auth
checks, then permit one further auth-only CF02 execution after Sol source review.
No other contract, resource, permission, or live-data action changes.

Alternatives:

- Remove AdminGetUser verification: rejected because the internal-ID mapping is
  a useful pre-browser gate.
- Inspect raw CloudTrail/AWS errors: rejected; the sanitized event sequence and
  committed response-shape defect are sufficient.

Cost and maintenance effect:

No dependency or AWS change. The fake matches the real CLI response contract.

Rollback/removal:

Keep the exact response validation until the T16 harness is removed.

## D043: Wait for the asynchronous Hosted UI redirect before locating its form

Status: accepted

Problem:

AG02 passed all Cognito setup gates and stopped at `admin-form`; CloudTrail
showed authorize/login GET and no login POST. A no-user diagnostic using the
committed driver returned `form-ambiguous`. A second no-submit staged check
proved the page was still on the application immediately after the login-button
click: oidc-client begins its redirect asynchronously, while the executable
looked for `cognitoSignInForm` without first waiting for the Hosted UI URL.

Decision:

After clicking the `/manage` login button, wait with a bounded deadline for the
exact Hosted UI host and `/login` path before calling `driveHostedUiSignIn`.
Add a dependency-injected test with a delayed redirect and prove the form
locator is not used before that URL gate. Keep the existing PKCE/application
entry, recorder, API response listener, and all security boundaries unchanged.
After Sol source acceptance, permit one corrected auth-only execution.

Alternatives:

- Add a fixed sleep: rejected because it is timing-dependent.
- Navigate directly to Hosted UI: rejected because it bypasses the application's
  PKCE transaction setup.

Cost and maintenance effect:

No AWS/dependency change; the browser sequence matches oidc-client behavior.

Rollback/removal:

Keep the explicit URL gate while the operational harness exists.

## D044: Preserve the exact sanitized browser substage on auth-only failure

Status: accepted

Problem:

HU02 again reported coordinator checkpoint `admin-form`, but delayed CloudTrail
metadata shows `CognitoAuthentication` succeeded and Lambda had no request log.
The concrete role adapter executes form, callback, signed-in, and API sentinel
inside the first lazy `form` call; any later exception is therefore flattened
to `admin-form/operation-failed`.

Decision:

Without logging raw errors or browser material, attach one allowlisted category
and viewport to role-adapter failures: form checkpoint, callback missing,
manage timeout, signed-in sentinel missing, API response missing, or unexpected
API status. `safeFailure` may return only those stable categories. Tests exercise
each substage and prove canary/raw material is discarded. Then permit one
auth-only execution after Sol review.

Alternatives:

- Inspect DOM/network/raw browser errors: rejected as unnecessary and sensitive.
- Continue with generic `operation-failed`: rejected because it cannot direct a
  correction.

Cost and maintenance effect:

No functional/AWS/dependency change; operational evidence becomes actionable.

Rollback/removal:

Remove with the auth harness after T16.

## D045: Await the hydrated signed-in sentinel after callback navigation

Status: accepted

Problem:

BS02 proved form submission, Cognito authentication, callback observation, and
final `/manage`, then returned `signed-in-missing`. The executable checks the
logout locator with immediate `count()` as soon as the URL changes. Nuxt/Vue
hydration and the callback session update are asynchronous, so URL completion
does not imply the signed-in control has rendered.

Decision:

Replace the immediate count with the locator's bounded visible wait, then await
the already bounded API response. Keep `signed-in-missing` as the timeout
category. Add an injected delayed-render test proving the sentinel can appear
after URL completion and that timeout remains sanitized. After Sol review,
permit one auth-only run.

Alternatives:

- Fixed sleep: rejected as timing-dependent.
- Remove the sentinel: rejected because callback URL alone does not prove an
  application session.

Cost and maintenance effect:

No AWS/dependency change; browser timing matches hydrated UI behavior.

Rollback/removal:

Keep bounded visibility waiting while the harness exists.

## D046: Prevent late session initialization from overwriting a callback login

Status: accepted

Problem:

SI02 still reached successful Cognito authentication, callback, and final
`/manage`, but no signed-in control or API request appeared even with a bounded
hydration wait. On the callback page, `useAdminSession()` starts `initialize()`
immediately and `onMounted` starts `callback()`. A slower `manager.getUser()`
can resolve null or reject after callback has set `processingCallback` or
`signedIn`, overwriting the successful callback state with `signedOut` or an
error. Existing tests do not cover this interleaving.

Decision:

Make initialization monotonic: after awaiting `getUser`, do not modify current
user/state if callback processing or a signed-in state has begun; likewise a
late initialize error must not overwrite those states. Add deterministic
deferred resolve/reject tests proving callback success wins. Do not persist
tokens or change OIDC settings.

After local review, deploy only the corrected static web to the existing preview
through the accepted deployment path, with no data fixture write or invalidation.
Run raw preview E2E, then one auth-only execution. No Firestore work is required.

Alternatives:

- Increase browser wait: rejected because the application remains signed out.
- Serialize callback behind initialize: rejected because callback must consume
  the authorization response promptly and owns the newer state.

Cost and maintenance effect:

No dependency/infrastructure change. Session state becomes race-safe.

Rollback/removal:

Revert the monotonic guard and redeploy web if the focused tests regress.

## D047: Separate callback completion from normal session restoration

Status: accepted

Problem:

CR03 again completed Cognito authentication and returned through the callback,
but the signed-in UI did not appear. D046 prevents a late restoration result
from overwriting callback state, yet the callback page still starts normal
`getUser()` restoration automatically before its mounted callback. The two
independent authentication lifecycles remain unnecessarily coupled.

Decision:

Make initialization an explicit page responsibility. The callback page obtains
the shared session without starting restoration and exclusively consumes the
authorization response. The normal manage page explicitly starts restoration.
Keep D046 as defense in depth and preserve the existing in-memory token store,
PKCE, return-path validation, and sanitized failures.

After local review, deploy the static web only and perform one auth-only
confirmation. Historical Firestore comparison and migration remain out of
scope because the user authorized discarding old data.

Alternatives:

- Add another wait or retry: rejected because it does not remove competing
  session lifecycles.
- Persist the user/token: rejected by the security contract.

Cost and maintenance effect:

No new dependency or AWS resource; page lifecycle ownership becomes explicit.

Rollback/removal:

Restore automatic initialization only if callback and normal entry are later
made mutually exclusive by a different reviewed session architecture.

## D048: Diagnose callback failure from sanitized OAuth status only

Status: accepted

Problem:

CO03 still ended at `signed-in-missing`. The current executable proves the
browser reached `/manage/callback` and later `/manage`, but callback failure also
navigates to `/manage`; therefore those URLs do not prove discovery, code/token
exchange, or local session creation succeeded. Further app changes would be
speculation.

Decision:

Use the existing browser recorder to derive one typed failure category from
only exact allowlisted hosts, pathnames, methods, and status codes. Explicitly
discard query/fragment, headers, bodies, credentials, tokens, claims, console
text, and raw errors. After local security review, permit one auth-only
diagnostic execution with the existing cleanup and zero-data-write gates.

Alternatives:

- Read raw browser/network errors: rejected because OAuth material may leak.
- Continue changing session timing: rejected without evidence of the failed
  OAuth substage.

Cost and maintenance effect:

No dependency or AWS change. Failure evidence becomes actionable and safe.

Rollback/removal:

Remove the temporary detailed classifier after T16 is accepted; retain generic
sanitized categories in reusable tests if useful.

## D049: Distinguish absent token request from browser request failure

Status: accepted

Problem:

OS02 proved discovery succeeded and no token response was observed, but a
response-only recorder cannot distinguish a pre-request callback/state failure
from CSP/network failure after the request starts. It also does not prove the
callback carried both required OAuth parameters.

Decision:

For exact allowlisted paths only, retain request-start and request-failed
booleans plus method/status, and derive only code/state presence booleans at the
callback. Never inspect or retain values, headers, bodies, failure text, or raw
events in the result. After local review, run one auth-only diagnosis.

Alternatives:

- Capture raw Playwright failure text: rejected as unnecessary and potentially
  sensitive.
- Assume state loss or CSP: rejected because the current evidence supports both.

Cost and maintenance effect:

No dependency/AWS change; one more bounded diagnostic separates the root causes.

Rollback/removal:

Remove callback presence and request-failure detail after the live issue closes.

## D050: Probe only matching transaction presence before callback code

Status: accepted

Problem:

TRQ02 proved code/state are present, discovery succeeds, and no token POST
starts. The remaining meaningful distinction is whether the callback state has
a matching oidc-client transaction in sessionStorage before callback code runs.

Decision:

In auth-only Playwright, use a pre-document exact-origin/path probe to derive a
single matching-key presence boolean. Parse the state only transiently; do not
read stored content, expose key names, or retain any value. Reduce the boolean
immediately to a typed category. Do not add instrumentation to the application
or raw preview suite.

Alternatives:

- Inspect session storage/key values: rejected as sensitive and unnecessary.
- Change the state store immediately: rejected until loss/mismatch is proven.

Cost and maintenance effect:

No application, dependency, or AWS change; one bounded execution completes the
pre-token diagnosis.

Rollback/removal:

Remove the auth-only probe after the transaction issue is fixed.

## D051: Use the exact redirect callback API

Status: accepted

Problem:

TS02 proved the exact callback has code/state, discovery succeeds, and the
matching transaction exists, yet no token POST starts. The application only
supports redirect authorization code flow, but the port invokes oidc-client's
generic callback dispatcher, which rereads state to choose among redirect,
popup, and silent callbacks before processing the redirect.

Decision:

Call `signinRedirectCallback` directly at the port boundary. Keep all PKCE,
storage, token-memory, and sanitized application contracts unchanged. Deploy
web-only after local review, then perform one auth-only confirmation.

Alternatives:

- Continue instrumenting stored state content: rejected as sensitive.
- Support popup/silent callbacks: rejected because neither is in architecture.

Cost and maintenance effect:

No dependency/AWS change; implementation matches the single allowed OAuth flow.

Rollback/removal:

Restore generic dispatch only if popup or silent flows are explicitly designed.

## D052: Reduce callback exceptions to fixed safe categories

Status: accepted

Problem:

RDC03 still stopped before token POST with a matching transaction. The remaining
failure is inside redirect callback state loading/validation, but raw exceptions
must not be inspected or logged.

Decision:

At the adapter boundary, classify only exact known exception shapes into fixed
constants and discard the exception. Emit the constant through a dedicated
ephemeral browser event consumed only by auth diagnosis. Do not change user
text or expose raw material.

Alternatives:

- Capture raw errors: rejected by the security boundary.
- Continue speculative state changes: rejected without the exception class.

Cost and maintenance effect:

No dependency/AWS change; one diagnostic identifies the exact local branch.

Rollback/removal:

Remove the diagnostic event after the callback issue closes.

## D053: Classify exact oidc-client pre-token validation messages

Status: accepted

Problem:

CET03 returned callback-other. Installed oidc-client source shows only six fixed
generic Error messages between state loading and token POST.

Decision:

Compare only those exact constants and emit fixed categories. Reject near
matches and discard all caught material. After local review, deploy web-only and
run one auth-only diagnosis.

Cost and maintenance effect:

No dependency/AWS change; identifies the mismatched configuration field.

Rollback/removal:

Remove detailed categories after T16 closes.

## D054: Classify exact state-read failures thrown by Logger

Status: accepted

Problem:

SV02 remained callback-other because oidc-client `Logger.throw` throws the Error
before the following null throw. Two exact state-read messages were omitted.

Decision:

Classify only `No state in response` and `No matching state found in storage` as
fixed constants, discard caught material, then deploy web-only and diagnose once.

Cost and maintenance effect:

No dependency/AWS change.

Rollback/removal:

Remove detailed categories after T16 closes.

## D055: Capture callback URL before mounted router work

Status: accepted

Problem:

STR02 proved the arriving document has state but oidc-client receives a response
without state. The callback page reads `window.location.href` only in onMounted.

Decision:

Capture the URL once during client setup and pass the immutable value on mount;
never persist or expose it. After review, deploy web-only and confirm once.

Cost and maintenance effect:

No dependency/AWS change.

Rollback/removal:

Keep early capture while callback is client-rendered.

## D056: Recover the initial callback URL from Navigation Timing

Status: accepted

Problem:

CU02 again proved that the browser arrives at `/manage/callback` with both
`code` and `state`, and that the matching `oidc.` transaction exists, while
`oidc-client-ts` throws the exact `No state in response` error. Capturing
`window.location.href` in page setup is still after Nuxt's initial hydration
and history normalization. A local Chromium proof confirmed that
`PerformanceNavigationTiming.name` retains the original query-bearing document
URL after `history.replaceState` removes the query.

Decision:

At the callback page boundary, select a URL only from the current location or
the single document navigation entry. Accept it only when origin and pathname
exactly match the configured callback and the OAuth response contains one
non-empty `state` plus exactly one non-empty `code` or `error`. Prefer the
current URL when it is valid; otherwise use the validated initial navigation
URL. Keep the selected string only in the page setup closure, pass it once to
the existing redirect callback, and never persist, log, render, or include it
in evidence. Reject cross-origin, wrong-path, fragment, repeated-parameter, and
ambiguous candidates. Use only standard browser APIs and add no dependency.

Alternatives:

- Store the initial URL in session/local storage or a global: rejected because
  authorization code material would outlive the immediate callback boundary.
- Log or probe the actual query values: rejected as sensitive and unnecessary.
- Continue capturing `window.location.href` earlier in the page lifecycle:
  rejected because CU02 proved page setup is already too late.

Cost and maintenance effect:

No AWS, dependency, or architecture change. The helper is a small pure boundary
with deterministic browser coverage.

Rollback/removal:

Keep the validated Navigation Timing fallback while the statically generated
Nuxt callback route can be normalized before page setup. Remove the temporary
detailed diagnostic categories with the T16 harness after acceptance.

## D057: Restore full public visual and functional parity before cutover

Status: accepted

Problem:

Phase 5 accepted infrastructure, routing, security, administration, and a
narrow public smoke contract, but that contract did not prove the stated
product migration goal. Direct comparison with the retained legacy tag and
live Firebase site found material regressions: the marathon page reduced three
19-goal tables to four single-goal choices; the records page reduced 60 result
rows to 44 and translated Japanese content; records disappeared from primary
navigation; stadium editorial content was summarized; and the established
indigo/teal shell, cards, tables, responsive drawer, status visuals, and
content hierarchy were replaced by a materially different minimal layout.

Decision:

Revoke Phase 5 product/cutover acceptance while retaining the accepted AWS and
security architecture. Restore the complete public content and behavior from
`legacy-firebase-vue-final-20260813` using Nuxt 4, semantic HTML, plain CSS,
provider-neutral core functions, and local assets. Preserve the legacy visual
identity and responsive information architecture closely enough that desktop
and mobile users do not experience a redesign during the technology migration.
Accessibility, secure headers, Japan-calendar handling, explicit error states,
and the Cognito administration improvements remain additive and must not be
removed to imitate legacy defects.

The parity contract includes the complete responsive navigation (including
records), full stadium copy and maps, legacy card/table hierarchy, local status
symbols plus accessible text, three exact marathon goal ranges with 19 rows
each and desktop/mobile orientations, all 60 Nozomi result rows without
collapsing events, locale-equivalent headings/content, footer/contact behavior,
and all established public URLs. No Vuetify, Bootstrap, Stylus, Vuex, Moment,
Firebase client SDK, AdSense wrapper, icon font, or new runtime dependency may
return.

Advertising is not silently treated as product parity. Existing migration
documents already make AdSense conditional on an explicit production business
requirement and compatible CSP. Preserve the content layout without asserting
obsolete ad timing; do not enable third-party advertising or widen CSP during
the parity recovery unless the owner separately confirms advertising remains
required.

Alternatives:

- Treat route existence and basic text as parity: rejected because the live
  comparison proves visible features and content are missing.
- Restore Vuetify/Bootstrap to reproduce screenshots: rejected because that
  defeats the maintainability objective and is unnecessary with scoped CSS.
- Continue production promotion and repair later: rejected because it would
  replace the working legacy product with a known incomplete one.

Cost and maintenance effect:

The public Nuxt components, structured content, CSS, and tests grow, but no new
runtime package or AWS resource is required. Data-driven tables and shared
components avoid restoring the old duplicated markup.

Rollback/removal:

Production promotion remains stopped until the D057 parity plan passes local
and deployed visual/functional review. Reverting D057 would require explicit
owner approval to accept a redesign or feature removal; infrastructure success
alone is not sufficient.

## D058: Treat private-origin missing schedule objects as unpublished

Status: accepted

Problem:

The public schedule origin is a private S3 bucket behind CloudFront OAC. S3
does not reveal object existence to an unauthenticated viewer and CloudFront
therefore returns 403 for a missing typed schedule object, not the 404 used by
the local repository contract. The deployed preview has Oda fixtures but no
historical/current objects for Yumenoshima, Komazawa, or Todoroki, so those
valid public pages show an unavailable error instead of the intended
unpublished state. Historical Firebase data is explicitly discarded.

Decision:

For the public, schema-typed `/data/v1/stadiums/<validated-slug>/availability/
<validated-year-month>.json` repository only, treat both 403 and 404 as an
absent month and render the localized unpublished state. Continue treating
401, 5xx, network failures, invalid JSON, and schema mismatches as errors. The
known Oda fixture remains the live canary for origin access, content, cache
metadata, and schema, so a broad origin failure is not silently accepted by
the deployment gate.

Alternatives:

- Upload empty objects for every stadium/month forever: rejected because it
  creates ongoing operational work and merely emulates absence with data.
- Configure a distribution-wide 403 response rewrite: rejected because it
  would weaken diagnostics for unknown assets and unrelated behaviors.
- Restore discarded Firebase history: rejected by the owner and D041.

Cost and maintenance effect:

One repository status mapping and deterministic tests; no dependency, AWS
resource, IAM, data migration, or recurring fixture generation is added.

Rollback/removal:

If the data origin later provides reliable path-specific 404 responses, remove
the 403 mapping after a deployed regression test proves unpublished behavior.

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
