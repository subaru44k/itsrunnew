import { App, Aws, CfnOutput, CfnParameter, Duration, Fn, RemovalPolicy, Stack, Tags } from 'aws-cdk-lib'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import path from 'node:path'
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

const apiMethodFilterCode = `function handler(event) {
  var request = event.request;
  if (request.method === 'GET' || request.method === 'PUT' || request.method === 'OPTIONS') return request;
  return {
    statusCode: 405,
    statusDescription: 'Method Not Allowed',
    headers: { allow: { value: 'GET, PUT, OPTIONS' } }
  };
}`

export class HostingStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props)
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
    const localDevelopmentOrigin = new CfnParameter(this, 'LocalDevelopmentOrigin', {
      type: 'String',
      default: 'http://localhost:3000',
      description: 'The single local Nuxt origin allowed by the API CORS policy.',
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
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
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
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
      oAuth: {
        flows: { authorizationCodeGrant: true, implicitCodeGrant: false, clientCredentials: false },
        callbackUrls: callbackUrls.valueAsList,
        logoutUrls: logoutUrls.valueAsList,
        defaultRedirectUri: Fn.select(0, callbackUrls.valueAsList),
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE, cognito.OAuthScope.resourceServer(resourceServer, scheduleScope)],
      },
    })
    const adminsGroup = new cognito.UserPoolGroup(this, 'AdminsGroup', {
      userPool,
      groupName: 'admins',
      description: 'Users explicitly approved to update schedules; initially empty.',
    })
    const api = new apigwv2.CfnApi(this, 'AdminApi', {
      name: 'itsrun-preview-admin-api',
      protocolType: 'HTTP',
      description: 'Authenticated schedule administration API.',
      corsConfiguration: {
        allowCredentials: false,
        allowHeaders: ['Authorization', 'Content-Type', 'If-Match', 'If-None-Match'],
        allowMethods: ['GET', 'PUT', 'OPTIONS'],
        allowOrigins: [localDevelopmentOrigin.valueAsString],
      },
    })
    const scheduleLogGroup = new logs.LogGroup(this, 'ScheduleApiLogGroup', {
      logGroupName: '/aws/lambda/itsrun-preview-schedule-api',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.RETAIN,
    })
    const scheduleRole = new iam.Role(this, 'ScheduleApiRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        ScheduleApiDataAccess: new iam.PolicyDocument({ statements: [new iam.PolicyStatement({
          actions: ['s3:GetObject', 's3:PutObject'],
          resources: [Fn.join('', [dataBucket.bucketArn, '/data/v1/stadiums/*/availability/*.json'])],
        })] }),
        ScheduleApiLogging: new iam.PolicyDocument({ statements: [new iam.PolicyStatement({
          actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
          resources: [Fn.join('', [scheduleLogGroup.logGroupArn, ':*'])],
        })] }),
      },
    })
    const scheduleFunction = new lambdaNodejs.NodejsFunction(this, 'ScheduleApiFunction', {
      entry: path.join(path.dirname(fileURLToPath(import.meta.url)), '../../services/schedule-api/src/index.ts'),
      handler: 'handler',
      functionName: 'itsrun-preview-schedule-api',
      runtime: lambda.Runtime.NODEJS_24_X,
      timeout: Duration.seconds(10),
      memorySize: 256,
      role: scheduleRole,
      logGroup: scheduleLogGroup,
      environment: { DATA_BUCKET_NAME: dataBucket.bucketName },
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
      integrationUri: Fn.join('', ['arn:', Aws.PARTITION, ':apigateway:', Aws.REGION, ':lambda:path/2015-03-31/functions/', scheduleFunction.functionArn, '/invocations']),
      integrationMethod: 'POST',
      payloadFormatVersion: '2.0',
      timeoutInMillis: 10000,
    })
    const routePath = '/api/v1/stadiums/*/availability/*'
    scheduleFunction.addPermission('ApiInvokeGet', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: Fn.join('', ['arn:', Aws.PARTITION, ':execute-api:', Aws.REGION, ':', Aws.ACCOUNT_ID, ':', api.ref, '/$default/GET', routePath]),
    })
    scheduleFunction.addPermission('ApiInvokePut', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: Fn.join('', ['arn:', Aws.PARTITION, ':execute-api:', Aws.REGION, ':', Aws.ACCOUNT_ID, ':', api.ref, '/$default/PUT', routePath]),
    })
    const apiScope = ['itsrun/schedule.write']
    const getRouteKey = 'GET /api/v1/stadiums/{stadium}/availability/{yearMonth}'
    const putRouteKey = 'PUT /api/v1/stadiums/{stadium}/availability/{yearMonth}'
    const apiRoutes = []
    for (const [idSuffix, routeKey] of [
      ['GetSchedule', getRouteKey],
      ['PutSchedule', putRouteKey],
    ]) {
      const route = new apigwv2.CfnRoute(this, `AdminApi${idSuffix}Route`, {
        apiId: api.ref,
        routeKey,
        authorizationType: 'JWT',
        authorizerId: jwtAuthorizer.ref,
        authorizationScopes: apiScope,
        target: Fn.join('', ['integrations/', apiIntegration.ref]),
      })
      route.addResourceDependency(apiIntegration)
      route.addResourceDependency(jwtAuthorizer)
      apiRoutes.push(route)
    }
    for (const route of apiRoutes) apiStage.addResourceDependency(route)
    apiStage.addPropertyOverride('RouteSettings', {
      [putRouteKey]: { ThrottlingBurstLimit: 10, ThrottlingRateLimit: 5 },
    })
    new cloudwatch.CfnAlarm(this, 'AdminApi5xxAlarm', {
      alarmName: 'itsrun-preview-admin-api-5xx',
      alarmDescription: 'Preview administrator HTTP API sustained 5xx alarm; operator-observed with no notification actions.',
      namespace: 'AWS/ApiGateway',
      metricName: '5xx',
      statistic: 'Sum',
      period: 300,
      threshold: 1,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: 'GreaterThanOrEqualToThreshold',
      treatMissingData: 'notBreaching',
      dimensions: [
        { name: 'ApiId', value: api.ref },
        { name: 'Stage', value: '$default' },
      ],
    })
    const apiDomainName = Fn.join('', [api.ref, '.execute-api.', Aws.REGION, '.amazonaws.com'])
    const cognitoAuthBaseUrl = Fn.join('', ['https://', cognitoDomainPrefix.valueAsString, '.auth.', Aws.REGION, '.amazoncognito.com'])
    // The CDK L2 rejects Authorization in an OriginRequestPolicy even though
    // CloudFront permits it when caching is disabled. Use the L1 resource to
    // express the reviewed four-header contract; see the current authorization
    // forwarding guidance: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/add-origin-custom-headers.html
    const apiOriginRequestPolicy = new cloudfront.CfnOriginRequestPolicy(this, 'ApiOriginRequestPolicy', {
      originRequestPolicyConfig: {
        name: 'ItsRunPreviewApiOriginRequest',
        comment: 'Only authenticated API headers; no viewer cookies or query strings.',
        headersConfig: {
          headerBehavior: 'whitelist',
          headers: ['Authorization', 'Content-Type', 'If-Match', 'If-None-Match'],
        },
        cookiesConfig: { cookieBehavior: 'none' },
        queryStringsConfig: { queryStringBehavior: 'none' },
      },
    })
    const apiCache = cloudfront.CachePolicy.fromCachePolicyId(this, 'ApiCache', '4135ea2d-6df8-44a3-9df3-4b5a84be39ad')
    const rewrite = new cloudfront.Function(this, 'RouteRewrite', { code: cloudfront.FunctionCode.fromInline(routeFunctionCode) })
    const apiMethodFilter = new cloudfront.Function(this, 'ApiMethodFilter', { code: cloudfront.FunctionCode.fromInline(apiMethodFilterCode) })
    const htmlCache = new cloudfront.CachePolicy(this, 'HtmlCache', { defaultTtl: Duration.seconds(0), minTtl: Duration.seconds(0), maxTtl: Duration.days(1) })
    const dataCache = new cloudfront.CachePolicy(this, 'DataCache', { defaultTtl: Duration.seconds(60), minTtl: Duration.seconds(0), maxTtl: Duration.seconds(60) })
    const sharedSecurityHeaders = {
      strictTransportSecurity: { accessControlMaxAge: Duration.days(365), includeSubdomains: true, preload: true, override: true },
      contentTypeOptions: { override: true },
      frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
      referrerPolicy: { referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN, override: true },
      contentSecurityPolicy: { contentSecurityPolicy: Fn.join('', ["default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ", cognitoAuthBaseUrl, " https://cognito-idp.", Aws.REGION, ".amazonaws.com; frame-src https://www.google.com https://maps.google.com; form-action 'self';"]), override: true },
    }
    const permissionsPolicyHeader = { header: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()', override: true }
    const responseHeaders = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
      securityHeadersBehavior: sharedSecurityHeaders,
      customHeadersBehavior: { customHeaders: [permissionsPolicyHeader] },
    })
    const apiResponseHeaders = new cloudfront.ResponseHeadersPolicy(this, 'ApiSecurityHeaders', {
      securityHeadersBehavior: sharedSecurityHeaders,
      customHeadersBehavior: { customHeaders: [permissionsPolicyHeader, { header: 'Cache-Control', value: 'no-store', override: true }] },
    })
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: { origin: origins.S3BucketOrigin.withOriginAccessControl(webBucket), viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, cachePolicy: htmlCache, responseHeadersPolicy: responseHeaders, functionAssociations: [{ function: rewrite, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }] },
      additionalBehaviors: {
        'data/*': { origin: origins.S3BucketOrigin.withOriginAccessControl(dataBucket), viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, cachePolicy: dataCache, responseHeadersPolicy: responseHeaders, allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD },
        'api/*': { origin: new origins.HttpOrigin(apiDomainName), viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, cachePolicy: apiCache, originRequestPolicy: apiOriginRequestPolicy, responseHeadersPolicy: apiResponseHeaders, allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL, functionAssociations: [{ function: apiMethodFilter, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }] },
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
    new CfnOutput(this, 'CognitoAuthBaseUrl', { value: cognitoAuthBaseUrl })
    new CfnOutput(this, 'UserPoolIssuer', { value: userPool.userPoolProviderUrl })
    new CfnOutput(this, 'AdminApiId', { value: api.ref })
    new CfnOutput(this, 'AdminApiEndpoint', { value: Fn.join('', ['https://', apiDomainName]) })
    new CfnOutput(this, 'AdminsGroupName', { value: adminsGroup.groupName })
  }
}

export class GitHubDeployStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props)
    const provider = new iam.CfnOIDCProvider(this, 'GitHubActionsOidcProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIdList: ['sts.amazonaws.com'],
      tags: [{ key: 'Purpose', value: 'ItsRun preview web deployment' }],
    })
    provider.applyRemovalPolicy(RemovalPolicy.RETAIN)
    const role = new iam.Role(this, 'GitHubWebDeployRole', {
      roleName: 'itsrun-preview-github-web-deploy',
      description: 'OIDC role for the reviewed ItsRun preview web deployment workflow.',
      maxSessionDuration: Duration.hours(1),
      assumedBy: new iam.FederatedPrincipal(provider.ref, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          'token.actions.githubusercontent.com:sub': 'repo:subaru44k/itsrunnew:ref:refs/heads/migration/aws-s3-cloudfront',
        },
      }, 'sts:AssumeRoleWithWebIdentity'),
      inlinePolicies: {
        PreviewWebDeployment: new iam.PolicyDocument({ statements: [
          new iam.PolicyStatement({
            actions: ['cloudformation:DescribeStacks'],
            resources: ['arn:aws:cloudformation:ap-northeast-1:470447451992:stack/ItsRunPreviewHosting/*'],
          }),
          new iam.PolicyStatement({
            actions: ['s3:PutObject'],
            resources: ['arn:aws:s3:::itsrun-preview-web-470447451992-ap-northeast-1/*'],
          }),
        ] }),
      },
    })
    Tags.of(role).add('Purpose', 'ItsRun preview web deployment')
    role.applyRemovalPolicy(RemovalPolicy.RETAIN)
    new CfnOutput(this, 'GitHubActionsProviderArn', { value: provider.attrArn })
    new CfnOutput(this, 'GitHubWebDeployRoleArn', { value: role.roleArn })
  }
}

export function createApp() {
  const app = new App()
  new HostingStack(app, 'ItsRunPreviewHosting')
  new GitHubDeployStack(app, 'ItsRunPreviewGitHubDeploy')
  return app
}

if (process.argv[1] === fileURLToPath(import.meta.url)) createApp().synth()
