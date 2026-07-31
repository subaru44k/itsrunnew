import { App, Aws, CfnOutput, CfnParameter, Duration, Fn, RemovalPolicy, SecretValue, Stack } from 'aws-cdk-lib'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2'
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
    const googleClientId = new CfnParameter(this, 'GoogleClientId', {
      type: 'String',
      description: 'Google OAuth web client ID; never store the client secret here.',
    })
    const googleSecretReference = new CfnParameter(this, 'GoogleClientSecretReference', {
      type: 'String',
      default: 'itsrun/preview/google-oauth-client-secret',
      description: 'Secrets Manager name or ARN containing the Google OAuth client secret.',
      noEcho: true,
    })
    const cognitoDomainPrefix = new CfnParameter(this, 'CognitoDomainPrefix', {
      type: 'String',
      default: 'itsrun-preview-470447451992',
    })
    const callbackUrls = new CfnParameter(this, 'CallbackUrls', {
      type: 'CommaDelimitedList',
      default: 'https://d2via50thoheqm.cloudfront.net/manage/callback',
    })
    const logoutUrls = new CfnParameter(this, 'LogoutUrls', {
      type: 'CommaDelimitedList',
      default: 'https://d2via50thoheqm.cloudfront.net/manage',
    })
    // T12 supplies the Lambda integration URI. Keeping this as a parameter lets
    // T11 synthesize and assert the protected routes without inventing a
    // placeholder Lambda or granting the bootstrap role Lambda permissions.
    const apiIntegrationUri = new CfnParameter(this, 'ApiIntegrationUri', {
      type: 'String',
      description: 'T12 Lambda proxy integration URI for the administrator API.',
    })
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
    const userPool = new cognito.UserPool(this, 'AdminUserPool', {
      userPoolName: 'itsrun-preview-admins',
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      removalPolicy: RemovalPolicy.RETAIN,
    })
    const googleSecretValue = SecretValue.unsafePlainText(Fn.sub(
      '{{resolve:secretsmanager:${SecretReference}:SecretString}}',
      { SecretReference: googleSecretReference.valueAsString },
    ))
    const googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleIdentityProvider', {
      userPool,
      clientId: googleClientId.valueAsString,
      clientSecretValue: googleSecretValue,
      scopes: ['openid', 'profile', 'email'],
      attributeMapping: {
        email: cognito.ProviderAttribute.GOOGLE_EMAIL,
        givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
        familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
      },
    })
    const domain = new cognito.UserPoolDomain(this, 'AdminUserPoolDomain', {
      userPool,
      cognitoDomain: { domainPrefix: cognitoDomainPrefix.valueAsString },
    })
    const scheduleScope = new cognito.ResourceServerScope({ scopeName: 'schedule.write', scopeDescription: 'Update schedule months' })
    const resourceServer = new cognito.UserPoolResourceServer(this, 'ScheduleResourceServer', {
      userPool,
      identifier: 'itsrun',
      scopes: [scheduleScope],
    })
    const userPoolClient = new cognito.UserPoolClient(this, 'AdminAppClient', {
      userPool,
      generateSecret: false,
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.GOOGLE],
      oAuth: {
        flows: { authorizationCodeGrant: true, implicitCodeGrant: false, clientCredentials: false },
        callbackUrls: callbackUrls.valueAsList,
        logoutUrls: logoutUrls.valueAsList,
        defaultRedirectUri: Fn.select(0, callbackUrls.valueAsList),
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE, cognito.OAuthScope.resourceServer(resourceServer, scheduleScope)],
      },
    })
    userPoolClient.node.addDependency(googleProvider)
    const adminsGroup = new cognito.UserPoolGroup(this, 'AdminsGroup', {
      userPool,
      groupName: 'admins',
      description: 'Users explicitly approved to update schedules; initially empty.',
    })
    const api = new apigwv2.CfnApi(this, 'AdminApi', {
      name: 'itsrun-preview-admin-api',
      protocolType: 'HTTP',
      description: 'Authenticated schedule administration API.',
    })
    const apiStage = new apigwv2.CfnStage(this, 'AdminApiDefaultStage', {
      apiId: api.ref,
      stageName: '$default',
      autoDeploy: true,
    })
    const jwtAuthorizer = new apigwv2.CfnAuthorizer(this, 'AdminApiJwtAuthorizer', {
      apiId: api.ref,
      authorizerType: 'JWT',
      identitySource: ['$request.header.Authorization'],
      name: 'CognitoAccessTokenAuthorizer',
      jwtConfiguration: {
        audience: [userPoolClient.userPoolClientId],
        issuer: userPool.userPoolProviderUrl,
      },
    })
    const apiIntegration = new apigwv2.CfnIntegration(this, 'AdminApiIntegration', {
      apiId: api.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: apiIntegrationUri.valueAsString,
      integrationMethod: 'POST',
      payloadFormatVersion: '2.0',
      timeoutInMillis: 10000,
    })
    const apiScope = ['itsrun/schedule.write']
    for (const [idSuffix, routeKey] of [
      ['GetSchedule', 'GET /api/v1/stadiums/{stadium}/availability/{yearMonth}'],
      ['PutSchedule', 'PUT /api/v1/stadiums/{stadium}/availability/{yearMonth}'],
    ]) {
      const route = new apigwv2.CfnRoute(this, `AdminApi${idSuffix}Route`, {
        apiId: api.ref,
        routeKey,
        authorizationType: 'JWT',
        authorizerId: jwtAuthorizer.ref,
        authorizationScopes: apiScope,
        target: Fn.join('', ['integrations/', apiIntegration.ref]),
      })
      route.addDependency(apiIntegration)
      route.addDependency(jwtAuthorizer)
    }
    apiIntegration.addDependency(apiStage)
    jwtAuthorizer.addDependency(apiStage)
    const apiDomainName = Fn.join('', [api.ref, '.execute-api.', Aws.REGION, '.amazonaws.com'])
    const apiOriginRequestPolicy = new cloudfront.OriginRequestPolicy(this, 'ApiOriginRequestPolicy', {
      originRequestPolicyName: 'ItsRunPreviewApiOriginRequest',
      comment: 'Only authenticated API headers; no viewer cookies or query strings.',
      // CloudFront requires Authorization to be part of a cache policy before
      // it can forward that header. The zero-TTL API cache policy below keeps
      // the API uncached while this policy forwards the remaining API headers.
      headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList('Content-Type', 'If-Match', 'If-None-Match'),
      cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
      queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.none(),
    })
    const apiCache = new cloudfront.CachePolicy(this, 'ApiCache', {
      cachePolicyName: 'ItsRunPreviewApiNoCache',
      comment: 'Zero TTL; Authorization is forwarded and included only to satisfy CloudFront header rules.',
      minTtl: Duration.seconds(0),
      defaultTtl: Duration.seconds(0),
      maxTtl: Duration.seconds(0),
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Authorization'),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
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
      additionalBehaviors: {
        'data/*': { origin: origins.S3BucketOrigin.withOriginAccessControl(dataBucket), viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, cachePolicy: dataCache, responseHeadersPolicy: responseHeaders, allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD },
        'api/*': { origin: new origins.HttpOrigin(apiDomainName), viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, cachePolicy: apiCache, originRequestPolicy: apiOriginRequestPolicy, responseHeadersPolicy: responseHeaders, allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL },
      },
    })
    const dataPolicy = dataBucket.node.tryFindChild('Policy')?.node.defaultChild
    dataPolicy?.addPropertyOverride('PolicyDocument.Statement.1.Resource', `${dataBucket.bucketArn}/data/*`)
    new CfnOutput(this, 'DistributionId', { value: distribution.distributionId })
    new CfnOutput(this, 'DistributionDomainName', { value: distribution.distributionDomainName })
    new CfnOutput(this, 'WebBucketName', { value: webBucket.bucketName })
    new CfnOutput(this, 'DataBucketName', { value: dataBucket.bucketName })
    new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId })
    new CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId })
    new CfnOutput(this, 'UserPoolDomain', { value: domain.domainName })
    new CfnOutput(this, 'AdminApiId', { value: api.ref })
    new CfnOutput(this, 'AdminApiEndpoint', { value: Fn.join('', ['https://', apiDomainName]) })
    new CfnOutput(this, 'AdminsGroupName', { value: adminsGroup.groupName })
  }
}

export function createApp() {
  const app = new App()
  new HostingStack(app, 'ItsRunPreviewHosting')
  return app
}

if (process.argv[1] === fileURLToPath(import.meta.url)) createApp().synth()
