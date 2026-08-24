import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { ItsRunPreviewAutomationStack } from './itsrun-preview-automation-stack';

const createTemplate = () => {
  const app = new App();
  const stack = new ItsRunPreviewAutomationStack(app, 'TestStack', {
    env: { account: '470447451992', region: 'ap-northeast-1' },
    githubOidcProviderArn: 'arn:aws:iam::470447451992:oidc-provider/token.actions.githubusercontent.com',
    previewBucketName: 'itsrunpreviewstack-sitebucket397a1860-khjbgxk7mmdb',
    previewDistributionId: 'E2F8WYHWRDA3NS',
  });
  return Template.fromStack(stack);
};
const synthesizedTemplate = createTemplate();

describe('ItsRunPreviewAutomationStack', () => {
  it('trusts only the master branch of this repository through GitHub OIDC', () => {
    synthesizedTemplate.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'itsrun-track-preview-deploy',
      AssumeRolePolicyDocument: {
        Statement: [{
          Action: 'sts:AssumeRoleWithWebIdentity',
          Effect: 'Allow',
          Principal: {
            Federated: 'arn:aws:iam::470447451992:oidc-provider/token.actions.githubusercontent.com',
          },
          Condition: {
            StringEquals: {
              'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
              'token.actions.githubusercontent.com:sub': 'repo:subaru44k/itsrunnew:ref:refs/heads/master',
            },
          },
        }],
      },
    });
  });

  it('contains only Preview S3 content and CloudFront invalidation permissions', () => {
    const policies = synthesizedTemplate.findResources('AWS::IAM::Policy');
    const serialized = JSON.stringify(policies);
    for (const action of [
      's3:ListBucket',
      's3:GetObject',
      's3:PutObject',
      's3:DeleteObject',
      'cloudfront:GetDistribution',
      'cloudfront:GetInvalidation',
      'cloudfront:CreateInvalidation',
    ]) expect(serialized).toContain(action);
    expect(serialized).toContain('itsrunpreviewstack-sitebucket397a1860-khjbgxk7mmdb');
    expect(serialized).toContain('E2F8WYHWRDA3NS');
    expect(serialized).not.toMatch(/route53:|acm:|iam:|cloudformation:|Resource":"\*"/);
  });
});
