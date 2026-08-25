import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { ItsRunProductionAutomationStack } from './itsrun-production-automation-stack';

const app = new App();
const stack = new ItsRunProductionAutomationStack(app, 'TestProductionAutomation', {
  env: { account: '470447451992', region: 'ap-northeast-1' },
  githubOidcProviderArn: 'arn:aws:iam::470447451992:oidc-provider/token.actions.githubusercontent.com',
  productionBucketName: 'itsrun-production-example',
  productionDistributionId: 'E123456789EXAMPLE',
});
const template = Template.fromStack(stack);

describe('ItsRunProductionAutomationStack', () => {
  it('trusts only master for this repository', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'itsrun-production-content-deploy',
      AssumeRolePolicyDocument: {
        Statement: [{
          Action: 'sts:AssumeRoleWithWebIdentity',
          Effect: 'Allow',
          Principal: { Federated: 'arn:aws:iam::470447451992:oidc-provider/token.actions.githubusercontent.com' },
          Condition: { StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
            'token.actions.githubusercontent.com:sub': 'repo:subaru44k/itsrunnew:ref:refs/heads/master',
          } },
        }],
      },
    });
  });

  it('can modify only the production content and distribution cache', () => {
    const serialized = JSON.stringify(template.findResources('AWS::IAM::Policy'));
    for (const action of ['s3:ListBucket', 's3:GetObject', 's3:PutObject', 's3:DeleteObject', 'cloudfront:CreateInvalidation']) {
      expect(serialized).toContain(action);
    }
    expect(serialized).toContain('itsrun-production-example');
    expect(serialized).toContain('E123456789EXAMPLE');
    expect(serialized).not.toMatch(/route53:|acm:|iam:|cloudformation:|Resource":"\*"/);
  });
});
