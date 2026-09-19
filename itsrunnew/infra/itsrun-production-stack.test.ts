import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import { ItsRunProductionStack } from './itsrun-production-stack';
import pageMetadata from '../src/data/page-metadata.json';

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
    expect(functions).toContain("'/en/oda-field'");
    expect(functions).toContain("request.uri.replace");
    expect(functions).toContain("tracks\\\\/[a-z0-9-]+");
    expect(functions).toContain("x-robots-tag");
  }, 20_000);

  it('attaches the custom domain only when a certificate is supplied with it', () => {
    const app = new App();
    const stack = new ItsRunProductionStack(app, 'TestProductionDomain', {
      env: environment,
      domainName: 'itsrun.info',
      certificateArn: 'arn:aws:acm:us-east-1:470447451992:certificate/00000000-0000-0000-0000-000000000000',
    });
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({ Aliases: ['itsrun.info'] }),
    });
    template.resourceCountIs('AWS::Route53::RecordSet', 0);
  });

  it('permanently redirects both Oda languages and preserves encoded query values', () => {
    const app = new App();
    const template = Template.fromStack(new ItsRunProductionStack(app, 'OdaRedirects', { env: environment }));
    const functions = Object.values(template.findResources('AWS::CloudFront::Function'));
    const code = functions.find(resource => resource.Properties.FunctionCode.includes('function redirect('))!.Properties.FunctionCode;
    const handler = runInNewContext(`${code}; handler`);
    for (const prefix of ['', '/en']) {
      for (const suffix of ['', '/']) {
        const response = handler({ request: {
          uri: `${prefix}/oda-field${suffix}`,
          querystring: {
            date: { value: '2026-09-20' },
            tag: { multiValue: [{ value: 'a%26b' }, { value: '%E6%97%A5%E6%9C%AC%E8%AA%9E' }] },
          },
        } });
        expect(response.statusCode).toBe(301);
        expect(response.headers.location.value).toBe(`${prefix}/tracks/yoyogi-park-athletic-track?date=2026-09-20&tag=a%26b&tag=%E6%97%A5%E6%9C%AC%E8%AA%9E`);
      }
      const destination = handler({ request: { uri: `${prefix}/tracks/yoyogi-park-athletic-track`, querystring: {} } });
      expect(destination.uri).toBe(`${prefix}/tracks/yoyogi-park-athletic-track/index.html`);
      expect(destination.statusCode).toBeUndefined();
    }
  });

  it('rewrites every fixed route to its own shell while keeping the root at index.html', () => {
    const app = new App();
    const template = Template.fromStack(new ItsRunProductionStack(app, 'FixedRouteShells', { env: environment }));
    const functions = Object.values(template.findResources('AWS::CloudFront::Function'));
    const code = functions.find(resource => resource.Properties.FunctionCode.includes('function redirect('))!.Properties.FunctionCode;
    const handler = runInNewContext(`${code}; handler`);
    const fixedRoutes = Object.values(pageMetadata).flatMap(page => [
      page.path ? `/${page.path}` : '/',
      page.path ? `/en/${page.path}` : '/en/',
    ]);

    for (const route of fixedRoutes) {
      const response = handler({ request: { uri: route, querystring: {} } });
      const shellPath = route === '/' ? '/index.html' : `${route.replace(/\/$/, '')}/index.html`;
      expect(response.uri).toBe(shellPath);
      expect(response.statusCode).toBeUndefined();
    }
  });

  it('rejects incomplete domain configuration', () => {
    const app = new App();
    expect(() => new ItsRunProductionStack(app, 'InvalidProduction', {
      env: environment,
      domainName: 'itsrun.info',
    })).toThrow(/configured together/);
  });
});
