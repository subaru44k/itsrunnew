import { App, Aws, CfnOutput, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import { fileURLToPath } from 'node:url'

const routeFunctionCode = `function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.indexOf('/data/') === 0 || uri.indexOf('/api/') === 0) return request;
  if (uri === '/index.html') return { statusCode: 301, statusDescription: 'Moved Permanently', headers: { location: { value: '/' } } };
  if (uri === '/en/index.html') return { statusCode: 301, statusDescription: 'Moved Permanently', headers: { location: { value: '/en/' } } };
  if (uri === '/komazawa_olympic' || uri === '/komazawa_olympic/') return { statusCode: 301, statusDescription: 'Moved Permanently', headers: { location: { value: '/komazawa' } } };
  if (uri === '/en/komazawa_olympic' || uri === '/en/komazawa_olympic/') return { statusCode: 301, statusDescription: 'Moved Permanently', headers: { location: { value: '/en/komazawa' } } };
  if (uri.indexOf('.') !== -1) return request;
  if (uri.slice(-6) === '/index') request.uri = uri + '.html';
  else if (uri.slice(-1) === '/') request.uri = uri + 'index.html';
  else request.uri = uri + '/index.html';
  return request;
}`

export class HostingStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props)
    const webBucket = new s3.Bucket(this, 'WebBucket', {
      bucketName: `itsrun-preview-web-${Aws.ACCOUNT_ID}-${Aws.REGION}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
    })
    const dataBucket = new s3.Bucket(this, 'DataBucket', {
      bucketName: `itsrun-preview-data-${Aws.ACCOUNT_ID}-${Aws.REGION}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
    })
    const rewrite = new cloudfront.Function(this, 'RouteRewrite', { code: cloudfront.FunctionCode.fromInline(routeFunctionCode) })
    const htmlCache = new cloudfront.CachePolicy(this, 'HtmlCache', { defaultTtl: Duration.seconds(0), minTtl: Duration.seconds(0), maxTtl: Duration.days(1) })
    const dataCache = new cloudfront.CachePolicy(this, 'DataCache', { defaultTtl: Duration.seconds(60), minTtl: Duration.seconds(0), maxTtl: Duration.seconds(60) })
    const responseHeaders = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
      securityHeadersBehavior: {
        strictTransportSecurity: { accessControlMaxAge: Duration.days(365), includeSubdomains: true, preload: true, override: true },
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        referrerPolicy: { referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN, override: true },
        contentSecurityPolicy: { contentSecurityPolicy: "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src https://www.google.com https://maps.google.com; form-action 'self';", override: true },
      },
      customHeadersBehavior: { customHeaders: [{ header: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()', override: true }] },
    })
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: { origin: origins.S3BucketOrigin.withOriginAccessControl(webBucket), viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, cachePolicy: htmlCache, responseHeadersPolicy: responseHeaders, functionAssociations: [{ function: rewrite, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }] },
      additionalBehaviors: { 'data/*': { origin: origins.S3BucketOrigin.withOriginAccessControl(dataBucket), viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, cachePolicy: dataCache, responseHeadersPolicy: responseHeaders, allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD } },
    })
    const dataPolicy = dataBucket.node.tryFindChild('Policy')?.node.defaultChild
    dataPolicy?.addPropertyOverride('PolicyDocument.Statement.1.Resource', `${dataBucket.bucketArn}/data/*`)
    new CfnOutput(this, 'DistributionId', { value: distribution.distributionId })
    new CfnOutput(this, 'DistributionDomainName', { value: distribution.distributionDomainName })
    new CfnOutput(this, 'WebBucketName', { value: webBucket.bucketName })
    new CfnOutput(this, 'DataBucketName', { value: dataBucket.bucketName })
  }
}

export function createApp() {
  const app = new App()
  new HostingStack(app, 'ItsRunPreviewHosting')
  return app
}

if (process.argv[1] === fileURLToPath(import.meta.url)) createApp().synth()
