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
