import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { ItsRunProductionStack } from './itsrun-production-stack';

const environment = { account: '470447451992', region: 'ap-northeast-1' };

describe('ItsRunProductionStack', () => {
  it('creates retained, versioned private hosting with real route and 404 handling', () => {
    const app = new App();
    const template = Template.fromStack(new ItsRunProductionStack(app, 'TestProduction', { env: environment }));
    template.hasResource('AWS::S3::Bucket', {
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
      Properties: Match.objectLike({
        VersioningConfiguration: { Status: 'Enabled' },
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      }),
    });
    const distributions = template.findResources('AWS::CloudFront::Distribution');
    const serialized = JSON.stringify(distributions);
    expect(serialized).toContain('404.html');
    expect(serialized).toContain('HttpVersion":"http2and3');
    expect(serialized).not.toContain('itsrun.info');
    const functions = JSON.stringify(template.findResources('AWS::CloudFront::Function'));
    expect(functions).toContain("'/tracks': '/'");
    expect(functions).toContain("request.uri = '/index.html'");
    expect(functions).toContain("x-robots-tag");
  }, 20_000);

  it('attaches the apex alias only when certificate and hosted zone are supplied together', () => {
    const app = new App();
    const stack = new ItsRunProductionStack(app, 'TestProductionDomain', {
      env: environment,
      domainName: 'itsrun.info',
      certificateArn: 'arn:aws:acm:us-east-1:470447451992:certificate/00000000-0000-0000-0000-000000000000',
      hostedZoneId: 'Z0123456789EXAMPLE',
    });
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({ Aliases: ['itsrun.info'] }),
    });
    template.resourceCountIs('AWS::Route53::RecordSet', 2);
  });

  it('rejects incomplete domain configuration', () => {
    const app = new App();
    expect(() => new ItsRunProductionStack(app, 'InvalidProduction', {
      env: environment,
      domainName: 'itsrun.info',
    })).toThrow(/configured together/);
  });
});
