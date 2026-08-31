import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

export interface ItsRunProductionStackProps extends cdk.StackProps {
  domainName?: string;
  certificateArn?: string;
}

const applicationRoutes = [
  '/', '/en/',
  '/oda-field', '/en/oda-field',
  '/yumenoshima', '/en/yumenoshima',
  '/komazawa', '/en/komazawa',
  '/todoroki', '/en/todoroki',
  '/pace/marathon', '/en/pace/marathon',
  '/nozomiantena/index', '/en/nozomiantena/index',
  '/about', '/en/about',
  '/tracks/guide', '/en/tracks/guide',
  '/privacy', '/en/privacy',
];

function routerFunctionCode() {
  return `function queryString(query) {
  query = query || {};
  var parts = [];
  for (var key in query) {
    var item = query[key];
    var values = item.multiValue || [item];
    for (var index = 0; index < values.length; index += 1) {
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(values[index].value || ''));
    }
  }
  return parts.length ? '?' + parts.join('&') : '';
}

function redirect(location, query) {
  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: { location: { value: location + queryString(query) } }
  };
}

function handler(event) {
  var request = event.request;
  var aliases = {
    '/tracks': '/',
    '/en/tracks': '/en/',
    '/index.html': '/',
    '/komazawa_olympic': '/komazawa',
    '/manage': '/'
  };
  if (aliases[request.uri]) return redirect(aliases[request.uri], request.querystring);
  var routes = ${JSON.stringify(applicationRoutes)};
  if (routes.indexOf(request.uri) !== -1) {
    var routeShells = ['/en/', '/oda-field', '/en/oda-field'];
    if (routeShells.indexOf(request.uri) !== -1) {
      var shellPath = request.uri;
      if (shellPath.charAt(shellPath.length - 1) === '/') shellPath = shellPath.slice(0, -1);
      request.uri = shellPath + '/index.html';
    } else {
      request.uri = '/index.html';
    }
    return request;
  }
  if (/^\\/(en\\/)?tracks\\/[a-z0-9-]+\\/?$/.test(request.uri)) {
    request.uri = request.uri.replace(/\\\/$/, '') + '/index.html';
    return request;
  }
  return request;
}`;
}

function noIndexFunctionCode(domainName: string) {
  return `function handler(event) {
  var response = event.response;
  var host = event.request.headers.host && event.request.headers.host.value;
  if (host !== '${domainName}') {
    response.headers['x-robots-tag'] = { value: 'noindex, nofollow' };
  }
  return response;
}`;
}

export class ItsRunProductionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ItsRunProductionStackProps) {
    super(scope, id, props);

    const domainConfigured = Boolean(props.domainName && props.certificateArn);
    const incompleteDomainConfiguration = Boolean(props.domainName || props.certificateArn) && !domainConfigured;
    if (incompleteDomainConfiguration) throw new Error('Production domain and certificate ARN must be configured together.');

    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
    });

    const routerFunction = new cloudfront.Function(this, 'RouteFunction', {
      comment: 'Serve known ItsRun SPA routes and permanently redirect legacy aliases.',
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(routerFunctionCode()),
    });
    const noIndexFunction = new cloudfront.Function(this, 'NoIndexDefaultDomainFunction', {
      comment: 'Keep the CloudFront default domain out of search indexes.',
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(noIndexFunctionCode(props.domainName ?? 'itsrun.info')),
    });

    const certificate = domainConfigured
      ? acm.Certificate.fromCertificateArn(this, 'ProductionCertificate', props.certificateArn!)
      : undefined;
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: 'ItsRun production static website',
      defaultRootObject: 'index.html',
      domainNames: domainConfigured ? [props.domainName!] : undefined,
      certificate,
      minimumProtocolVersion: certificate ? cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021 : undefined,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        functionAssociations: [
          { function: routerFunction, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST },
          { function: noIndexFunction, eventType: cloudfront.FunctionEventType.VIEWER_RESPONSE },
        ],
      },
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 404, responsePagePath: '/404.html', ttl: cdk.Duration.seconds(0) },
        { httpStatus: 404, responseHttpStatus: 404, responsePagePath: '/404.html', ttl: cdk.Duration.seconds(0) },
      ],
    });

    cdk.Tags.of(this).add('Project', 'ItsRun');
    cdk.Tags.of(this).add('Environment', 'Production');

    new cdk.CfnOutput(this, 'VerificationUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront production verification URL',
    });
    new cdk.CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new cdk.CfnOutput(this, 'DistributionDomainName', { value: distribution.distributionDomainName });
    new cdk.CfnOutput(this, 'BucketName', { value: siteBucket.bucketName });
  }
}
