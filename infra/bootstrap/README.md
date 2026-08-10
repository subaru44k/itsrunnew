# Preview CDK bootstrap

## T15 D021 policy-v6 gate

The GitHub preview OIDC stack is a separate retained CDK stack. Its
CloudFormation execution policy candidate adds exactly two independent
statements to the reviewed v5 document: the exact OIDC provider lifecycle
actions on `arn:aws:iam::470447451992:oidc-provider/token.actions.githubusercontent.com`
and the exact role lifecycle actions on
`arn:aws:iam::470447451992:role/itsrun-preview-github-web-deploy`.
Before any policy write, verify AWS v5 is the reviewed canonical document,
retain v2-v5, delete only nondefault v1, create exactly v6 as default, and
verify the candidate delta. No PassRole, wildcard action/resource, managed
policy attachment, additional provider/role, or HostingStack deployment is
permitted by this gate.

This policy is only for account `470447451992`, region `ap-northeast-1`, and
the `ItsRunPreviewHosting` preview stack. CloudFront creation APIs require
`Resource: "*"` because AWS does not expose a distribution ARN before the
resource exists; the action list remains explicit. No `Action: "*"`,
`AdministratorAccess`, `PowerUserAccess`, or cross-account trust is permitted.

Create the customer-managed policy only after R01-R05 pass:

```bash
AWS_PROFILE=codex-prod aws iam create-policy \
  --policy-name ItsRunPreviewCloudFormationExecutionPolicy \
  --policy-document file://infra/bootstrap/cloudformation-execution-policy.json
```

If the policy already exists, inspect its default version and update it only
with a reviewed diff. Do not broaden it in response to an access denial;
record the exact action/resource and return to Sol.

## Approved v2 update after the R06 stop

The first deploy attempt was denied because CDK's CloudFormation changeset
reads the existing bootstrap version with the batch API
`ssm:GetParameters`. Sol reviewed the denial and approved adding only that
read action to the existing exact parameter ARN. This does not authorize a new
service, write action, wildcard action, or broader resource.

Luna must first confirm that the AWS default version is still `v1` and matches
the committed pre-change policy. Then create a new version from the reviewed
file and make it default:

```bash
AWS_PROFILE=codex-prod aws iam get-policy \
  --policy-arn arn:aws:iam::470447451992:policy/ItsRunPreviewCloudFormationExecutionPolicy

AWS_PROFILE=codex-prod aws iam get-policy-version \
  --policy-arn arn:aws:iam::470447451992:policy/ItsRunPreviewCloudFormationExecutionPolicy \
  --version-id v1

AWS_PROFILE=codex-prod aws iam create-policy-version \
  --policy-arn arn:aws:iam::470447451992:policy/ItsRunPreviewCloudFormationExecutionPolicy \
  --policy-document file://infra/bootstrap/cloudformation-execution-policy.json \
  --set-as-default
```

After creation, verify that the new default document differs from `v1` only
by `ssm:GetParameters` on
`arn:aws:ssm:ap-northeast-1:470447451992:parameter/cdk-bootstrap/hnb659fds/version`.
Do not delete `v1` during R06. Resume the existing R06 deploy command; do not
run bootstrap again.

## Phase 3 v3 reduction

After verifying AWS default `v2` against commit `22d7fd5`, create v3 from the
current policy file. The entire `PreviewBucketObjects` statement is removed;
no replacement object permission is allowed. Keep `v1` and `v2`.

```bash
AWS_PROFILE=codex-prod AWS_REGION=ap-northeast-1 aws iam create-policy-version \
  --policy-arn arn:aws:iam::470447451992:policy/ItsRunPreviewCloudFormationExecutionPolicy \
  --policy-document file://infra/bootstrap/cloudformation-execution-policy.json \
  --set-as-default
```

## Phase 4 candidate v4

The first Cognito/API/Lambda deployment must follow
`docs/aws-migration/phase4-t12-deploy-plan.md`. The policy file contains the
Sol-reviewed v4 candidate, but its presence in Git does not authorize an AWS
write. Create v4 only after the plan's local policy test, immutable-v3 check,
and explicit bundled approval. Keep v1-v3 and stop on any unreviewed denial.
