import { App, CfnOutput, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'

class HostingStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props)
    const webBucket = new s3.Bucket(this, 'WebBucket', { blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, encryption: s3.BucketEncryption.S3_MANAGED, objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED, removalPolicy: RemovalPolicy.RETAIN })
    const dataBucket = new s3.Bucket(this, 'DataBucket', { blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, encryption: s3.BucketEncryption.S3_MANAGED, objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED, versioned: true, removalPolicy: RemovalPolicy.RETAIN })
    const rewrite = new cloudfront.Function(this, 'RouteRewrite', { code: cloudfront.FunctionCode.fromInline(`function handler(event) { var r = event.request; if (!r.uri.includes('.') && !r.uri.startsWith('/data/') && !r.uri.startsWith('/api/')) r.uri = '/index.html'; return r; }`) })
    const dataCache = new cloudfront.CachePolicy(this, 'DataCache', { defaultTtl: Duration.seconds(60), minTtl: Duration.seconds(0), maxTtl: Duration.seconds(60) })
    const distribution = new cloudfront.Distribution(this, 'Distribution', { defaultBehavior: { origin: origins.S3BucketOrigin.withOriginAccessControl(webBucket), viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED, functionAssociations: [{ function: rewrite, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }] }, additionalBehaviors: { 'data/*': { origin: origins.S3BucketOrigin.withOriginAccessControl(dataBucket), viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, cachePolicy: dataCache, allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD } } })
    new CfnOutput(this, 'DistributionDomainName', { value: distribution.distributionDomainName })
    new CfnOutput(this, 'WebBucketName', { value: webBucket.bucketName })
    new CfnOutput(this, 'DataBucketName', { value: dataBucket.bucketName })
  }
}
const app = new App()
new HostingStack(app, 'ItsRunPreviewHosting')
app.synth()
