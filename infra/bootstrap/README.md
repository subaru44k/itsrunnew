# Preview CDK bootstrap

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
