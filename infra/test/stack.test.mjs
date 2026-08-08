import test from 'node:test'
import assert from 'node:assert/strict'
import { App, assertions } from 'aws-cdk-lib'
import { HostingStack } from '../bin/app.mjs'

const template = () => {
  const app = new App()
  new HostingStack(app, 'TestHosting')
  return assertions.Template.fromStack(app.node.findChild('TestHosting'))
}

test('hosting stack keeps both buckets private and data versioned', () => {
  const result = template()
  result.resourceCountIs('AWS::S3::Bucket', 2)
  const buckets = result.findResources('AWS::S3::Bucket')
  for (const bucket of Object.values(buckets)) assert.deepEqual(bucket.Properties.PublicAccessBlockConfiguration, { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true })
  assert.ok(Object.values(buckets).some((bucket) => bucket.Properties.VersioningConfiguration?.Status === 'Enabled'))
  result.resourceCountIs('AWS::CloudFront::OriginAccessControl', 2)
})

test('cloudfront has route rewrite, secure headers, and bounded data cache', () => {
  const result = template()
  result.resourceCountIs('AWS::CloudFront::ResponseHeadersPolicy', 1)
  const functions = result.findResources('AWS::CloudFront::Function')
  const code = Object.values(functions).map((resource) => resource.Properties.FunctionCode).find((value) => value.includes('komazawa_olympic'))
  assert.match(code, /data\//)
  assert.match(code, /komazawa_olympic/)
  const distributions = result.findResources('AWS::CloudFront::Distribution')
  const distribution = Object.values(distributions)[0].Properties.DistributionConfig
  assert.equal(distribution.DefaultCacheBehavior.ViewerProtocolPolicy, 'redirect-to-https')
  assert.equal(distribution.CacheBehaviors[0].PathPattern, 'data/*')
  assert.deepEqual(distribution.CacheBehaviors[0].AllowedMethods, ['GET', 'HEAD'])
  const handler = new Function(`${code}; return handler`)()
  assert.equal(handler({ request: { uri: '/' } }).uri, '/index.html')
  assert.equal(handler({ request: { uri: '/yumenoshima' } }).uri, '/yumenoshima/index.html')
  assert.equal(handler({ request: { uri: '/nozomiantena/index' } }).uri, '/nozomiantena/index.html')
  assert.equal(handler({ request: { uri: '/data/v1/example.json' } }).uri, '/data/v1/example.json')
  assert.equal(handler({ request: { uri: '/index.html' } }).statusCode, 301)
})

test('data bucket policy is limited to data prefix', () => {
  const result = template()
  const policies = result.findResources('AWS::S3::BucketPolicy')
  const dataPolicy = Object.values(policies).find((resource) => JSON.stringify(resource).includes('data/*'))
  assert.ok(dataPolicy)
  const statements = dataPolicy.Properties.PolicyDocument.Statement
  const allow = statements.find((statement) => statement.Effect === 'Allow')
  assert.equal(allow.Principal.Service, 'cloudfront.amazonaws.com')
  assert.match(JSON.stringify(allow.Resource), /data\\*|data\\\//)
})

test('T11 auth uses local Cognito users, code-only, and has no identity pool', () => {
  const result = template()
  const templateJson = result.toJSON()
  const pools = Object.entries(result.findResources('AWS::Cognito::UserPool'))
  assert.equal(pools.length, 1)
  const [poolLogicalId, pool] = pools[0]
  const clients = Object.entries(result.findResources('AWS::Cognito::UserPoolClient')).filter(([, resource]) => resource.Properties.UserPoolId.Ref === poolLogicalId)
  assert.equal(clients.length, 1)
  const [clientLogicalId, client] = clients[0]
  const resourceServers = Object.entries(result.findResources('AWS::Cognito::UserPoolResourceServer')).filter(([, resource]) => resource.Properties.UserPoolId.Ref === poolLogicalId)
  assert.equal(resourceServers.length, 1)
  const [resourceServerLogicalId, resourceServer] = resourceServers[0]
  assert.equal(resourceServer.Properties.Identifier, 'itsrun')
  assert.deepEqual(resourceServer.Properties.Scopes, [{ ScopeDescription: 'Update schedule months', ScopeName: 'schedule.write' }])
  const groups = Object.values(result.findResources('AWS::Cognito::UserPoolGroup')).filter((resource) => resource.Properties.UserPoolId.Ref === poolLogicalId)
  assert.equal(groups.length, 1)
  const providers = Object.values(result.findResources('AWS::Cognito::UserPoolIdentityProvider')).filter((resource) => resource.Properties.UserPoolId.Ref === poolLogicalId)
  assert.equal(providers.length, 0)
  assert.equal(templateJson.Parameters.GoogleClientId, undefined)
  assert.equal(templateJson.Parameters.GoogleClientSecretReference, undefined)
  assert.equal(templateJson.Parameters.CognitoDomainPrefix.Default, 'itsrun-preview-470447451992')
  assert.equal(templateJson.Parameters.CallbackUrls.Default, 'https://d2via50thoheqm.cloudfront.net/manage/callback')
  assert.equal(templateJson.Parameters.LogoutUrls.Default, 'https://d2via50thoheqm.cloudfront.net/manage')
  assert.equal(templateJson.Parameters.LocalDevelopmentOrigin.Default, 'http://localhost:3000')
  assert.equal(pool.Properties.AdminCreateUserConfig.AllowAdminCreateUserOnly, true)
  assert.equal(pool.Properties.DeletionProtection, 'ACTIVE')
  assert.equal(pool.DeletionPolicy, 'Retain')
  assert.equal(client.Properties.GenerateSecret, false)
  assert.deepEqual(client.Properties.AllowedOAuthFlows, ['code'])
  assert.equal(client.Properties.AllowedOAuthFlowsUserPoolClient, true)
  assert.deepEqual(client.Properties.AllowedOAuthScopes, [
    'openid', 'email', 'profile',
    { 'Fn::Join': ['', [{ Ref: resourceServerLogicalId }, '/schedule.write']] },
  ])
  assert.deepEqual(client.Properties.SupportedIdentityProviders, ['COGNITO'])
  assert.equal(groups[0].Properties.GroupName, 'admins')
  assert.equal(Object.keys(result.findResources('AWS::Cognito::IdentityPool')).length, 0)
  assert.deepEqual(client.Properties.CallbackURLs, { Ref: 'CallbackUrls' })
  assert.deepEqual(client.Properties.LogoutURLs, { Ref: 'LogoutUrls' })
  assert.deepEqual(client.Properties.UserPoolId, { Ref: poolLogicalId })
  assert.doesNotMatch(JSON.stringify(templateJson), /resolve:secretsmanager/i)
  assert.equal(client.Properties.UserPoolId.Ref, poolLogicalId)
  assert.ok(clientLogicalId)
})

test('T11R03 limits API CORS to the configured local Nuxt origin', () => {
  const result = template()
  const apis = Object.values(result.findResources('AWS::ApiGatewayV2::Api'))
  assert.equal(apis.length, 1)
  const cors = apis[0].Properties.CorsConfiguration
  assert.equal(cors.AllowCredentials, false)
  assert.deepEqual(cors.AllowHeaders, ['Authorization', 'Content-Type', 'If-Match', 'If-None-Match'])
  assert.deepEqual(cors.AllowMethods, ['GET', 'PUT', 'OPTIONS'])
  assert.deepEqual(cors.AllowOrigins, [{ Ref: 'LocalDevelopmentOrigin' }])
  assert.doesNotMatch(JSON.stringify(cors), /\*/)
})

test('T11R04 exposes Cognito endpoints and permits only the token origin in CSP', () => {
  const result = template()
  const templateJson = result.toJSON()
  const poolLogicalId = Object.keys(result.findResources('AWS::Cognito::UserPool'))[0]
  assert.deepEqual(templateJson.Outputs.CognitoAuthBaseUrl.Value, {
    'Fn::Join': ['', ['https://', { Ref: 'CognitoDomainPrefix' }, '.auth.', { Ref: 'AWS::Region' }, '.amazoncognito.com']],
  })
  assert.deepEqual(templateJson.Outputs.UserPoolIssuer.Value, { 'Fn::GetAtt': [poolLogicalId, 'ProviderURL'] })
  const headersPolicy = Object.values(result.findResources('AWS::CloudFront::ResponseHeadersPolicy'))[0]
  const csp = JSON.stringify(headersPolicy.Properties.ResponseHeadersPolicyConfig.SecurityHeadersConfig.ContentSecurityPolicy)
  assert.match(csp, /CognitoDomainPrefix/)
  assert.match(csp, /amazoncognito\.com/)
  assert.doesNotMatch(csp, /accounts\.google|\*\.google|unsafe-eval/)
})

test('T11 protects API routes with Cognito JWT and disables API caching', () => {
  const result = template()
  const authorizer = Object.values(result.findResources('AWS::ApiGatewayV2::Authorizer')).find((resource) => resource.Properties.AuthorizerType === 'JWT')
  assert.ok(authorizer)
  const authorizerEntries = Object.entries(result.findResources('AWS::ApiGatewayV2::Authorizer')).filter(([, resource]) => resource.Properties.AuthorizerType === 'JWT')
  assert.equal(authorizerEntries.length, 1)
  const [authorizerLogicalId] = authorizerEntries[0]
  const integrationEntries = Object.entries(result.findResources('AWS::ApiGatewayV2::Integration')).filter(([, resource]) => resource.Properties.IntegrationType === 'AWS_PROXY')
  assert.equal(integrationEntries.length, 1)
  const [integrationLogicalId] = integrationEntries[0]
  assert.equal(authorizer.Properties.AuthorizerType, 'JWT')
  assert.deepEqual(authorizer.Properties.IdentitySource, ['$request.header.Authorization'])
  const clientLogicalId = Object.keys(result.findResources('AWS::Cognito::UserPoolClient'))[0]
  const poolLogicalId = Object.keys(result.findResources('AWS::Cognito::UserPool'))[0]
  assert.deepEqual(authorizer.Properties.JwtConfiguration.Audience, [{ Ref: clientLogicalId }])
  assert.deepEqual(authorizer.Properties.JwtConfiguration.Issuer, { 'Fn::GetAtt': [poolLogicalId, 'ProviderURL'] })
  const routes = Object.values(result.findResources('AWS::ApiGatewayV2::Route'))
  assert.equal(routes.length, 2)
  assert.deepEqual(routes.map((route) => route.Properties.RouteKey).sort(), [
    'GET /api/v1/stadiums/{stadium}/availability/{yearMonth}',
    'PUT /api/v1/stadiums/{stadium}/availability/{yearMonth}',
  ])
  for (const route of routes) {
    assert.equal(route.Properties.AuthorizationType, 'JWT')
    assert.deepEqual(route.Properties.AuthorizationScopes, ['itsrun/schedule.write'])
    assert.deepEqual(route.Properties.AuthorizerId, { Ref: authorizerLogicalId })
    assert.deepEqual(route.Properties.Target, { 'Fn::Join': ['', ['integrations/', { Ref: integrationLogicalId }]] })
  }
  const distribution = Object.values(result.findResources('AWS::CloudFront::Distribution'))[0].Properties.DistributionConfig
  const apiBehavior = distribution.CacheBehaviors.find((behavior) => behavior.PathPattern === 'api/*')
  assert.ok(apiBehavior)
  const apiCacheEntries = Object.entries(result.findResources('AWS::CloudFront::CachePolicy')).filter(([, resource]) => resource.Properties.CachePolicyConfig.Name === 'ItsRunPreviewApiNoCache')
  assert.equal(apiCacheEntries.length, 1)
  const [apiCacheLogicalId] = apiCacheEntries[0]
  const apiOriginEntries = Object.entries(result.findResources('AWS::CloudFront::OriginRequestPolicy')).filter(([, resource]) => resource.Properties.OriginRequestPolicyConfig.Name === 'ItsRunPreviewApiOriginRequest')
  assert.equal(apiOriginEntries.length, 1)
  const [apiOriginLogicalId] = apiOriginEntries[0]
  assert.deepEqual(apiBehavior.CachePolicyId, { Ref: apiCacheLogicalId })
  assert.deepEqual(apiBehavior.OriginRequestPolicyId, { Ref: apiOriginLogicalId })
  assert.equal(apiBehavior.ViewerProtocolPolicy, 'redirect-to-https')
})

test('T12 Lambda integration is bounded and data access is least privilege', () => {
  const result = template()
  const templateJson = result.toJSON()
  assert.equal(templateJson.Parameters.ApiIntegrationUri, undefined)
  const functions = Object.values(result.findResources('AWS::Lambda::Function'))
  assert.equal(functions.length, 1)
  assert.equal(functions[0].Properties.Runtime, 'nodejs24.x')
  assert.equal(functions[0].Properties.Timeout, 10)
  assert.equal(functions[0].Properties.MemorySize, 256)
  const logGroups = Object.values(result.findResources('AWS::Logs::LogGroup'))
  assert.equal(logGroups.length, 1)
  assert.equal(logGroups[0].Properties.RetentionInDays, 30)
  const stage = Object.values(result.findResources('AWS::ApiGatewayV2::Stage'))[0]
  assert.deepEqual(stage.Properties.RouteSettings, {
    'PUT /api/v1/stadiums/{stadium}/availability/{yearMonth}': { ThrottlingBurstLimit: 10, ThrottlingRateLimit: 5 },
  })
  const integration = Object.values(result.findResources('AWS::ApiGatewayV2::Integration'))[0]
  assert.match(JSON.stringify(integration.Properties.IntegrationUri), /lambda:path\/2015-03-31\/functions/)
  assert.equal(integration.Properties.PayloadFormatVersion, '2.0')
  const permissions = Object.values(result.findResources('AWS::Lambda::Permission'))
  assert.equal(permissions.length, 2)
  const sourceArns = permissions.map((permission) => JSON.stringify(permission.Properties.SourceArn)).sort()
  assert.match(sourceArns[0], /execute-api.*\/$default\/GET\/api\/v1\/stadiums\/\*\/availability\/\*/) 
  assert.match(sourceArns[1], /execute-api.*\/$default\/PUT\/api\/v1\/stadiums\/\*\/availability\/\*/) 
  for (const permission of permissions) {
    assert.equal(permission.Properties.Principal, 'apigateway.amazonaws.com')
    assert.equal(permission.Properties.Action, 'lambda:InvokeFunction')
    assert.match(JSON.stringify(permission.Properties.FunctionName), /ScheduleApiFunction/)
  }
  const roles = Object.values(result.findResources('AWS::IAM::Role')).filter((role) => JSON.stringify(role.Properties.AssumeRolePolicyDocument).includes('lambda.amazonaws.com'))
  assert.equal(roles.length, 1)
  assert.equal(roles[0].Properties.ManagedPolicyArns, undefined)
  assert.deepEqual(roles[0].Properties.AssumeRolePolicyDocument.Statement[0].Principal, { Service: 'lambda.amazonaws.com' })
  const statements = roles[0].Properties.Policies.flatMap(({ PolicyDocument }) => PolicyDocument.Statement)
  const dataStatements = statements.filter((statement) => JSON.stringify(statement.Action).includes('s3:'))
  assert.deepEqual(dataStatements[0].Action, ['s3:GetObject', 's3:PutObject'])
  assert.match(JSON.stringify(dataStatements[0].Resource), /data\/v1\/stadiums\/\*\/availability\/\*\.json/)
  const logStatements = statements.filter((statement) => JSON.stringify(statement.Action).includes('logs:'))
  assert.deepEqual(logStatements[0].Action, ['logs:CreateLogStream', 'logs:PutLogEvents'])
  assert.match(JSON.stringify(logStatements[0].Resource), /ScheduleApiLogGroup.*:\*/)
  assert.doesNotMatch(JSON.stringify(dataStatements), /DeleteObject|ListBucket|s3:\*/)
  assert.doesNotMatch(JSON.stringify(dataStatements), /itsrun-preview-web/)
})

test('T11R01 forwards only the documented API headers', () => {
  const result = template()
  const policies = Object.values(result.findResources('AWS::CloudFront::OriginRequestPolicy'))
  assert.equal(policies.length, 1)
  const config = policies[0].Properties.OriginRequestPolicyConfig
  assert.equal(config.HeadersConfig.HeaderBehavior, 'whitelist')
  assert.deepEqual(config.HeadersConfig.Headers, [
    'Content-Type', 'If-Match', 'If-None-Match',
  ])
  assert.deepEqual(config.CookiesConfig, { CookieBehavior: 'none' })
  assert.deepEqual(config.QueryStringsConfig, { QueryStringBehavior: 'none' })
  const distribution = Object.values(result.findResources('AWS::CloudFront::Distribution'))[0].Properties.DistributionConfig
  const apiBehavior = distribution.CacheBehaviors.find((behavior) => behavior.PathPattern === 'api/*')
  assert.equal(apiBehavior.OriginRequestPolicyId.Ref, Object.keys(result.findResources('AWS::CloudFront::OriginRequestPolicy'))[0])
  const cachePolicies = Object.values(result.findResources('AWS::CloudFront::CachePolicy'))
  const apiCache = cachePolicies.find((policy) => policy.Properties.CachePolicyConfig.Name === 'ItsRunPreviewApiNoCache')
  assert.ok(apiCache)
  const cacheConfig = apiCache.Properties.CachePolicyConfig
  assert.equal(cacheConfig.MinTTL, 0)
  assert.equal(cacheConfig.DefaultTTL, 0)
  assert.equal(cacheConfig.MaxTTL, 0)
  assert.equal(cacheConfig.ParametersInCacheKeyAndForwardedToOrigin.HeadersConfig.HeaderBehavior, 'whitelist')
  assert.deepEqual(cacheConfig.ParametersInCacheKeyAndForwardedToOrigin.HeadersConfig.Headers, ['Authorization'])
  assert.deepEqual(cacheConfig.ParametersInCacheKeyAndForwardedToOrigin.CookiesConfig, { CookieBehavior: 'none' })
  assert.deepEqual(cacheConfig.ParametersInCacheKeyAndForwardedToOrigin.QueryStringsConfig, { QueryStringBehavior: 'none' })
})

test('T11R02 filters API methods at the viewer request edge', () => {
  const result = template()
  const functions = result.findResources('AWS::CloudFront::Function')
  const filterEntry = Object.entries(functions).find(([, resource]) => resource.Properties.FunctionCode.includes('Method Not Allowed'))
  assert.ok(filterEntry)
  const [filterLogicalId, filter] = filterEntry
  assert.doesNotMatch(filter.Properties.FunctionCode, /Authorization|console\./)
  const handler = new Function(`${filter.Properties.FunctionCode}; return handler`)()
  const accepted = ['GET', 'PUT', 'OPTIONS']
  const allMethods = ['GET', 'HEAD', 'OPTIONS', 'PUT', 'PATCH', 'POST', 'DELETE']
  for (const method of allMethods) {
    const response = handler({ request: { method, uri: '/api/v1/example' } })
    if (accepted.includes(method)) assert.equal(response.method, method)
    else {
      assert.equal(response.statusCode, 405)
      assert.equal(response.headers.allow.value, 'GET, PUT, OPTIONS')
    }
  }
  const distribution = Object.values(result.findResources('AWS::CloudFront::Distribution'))[0].Properties.DistributionConfig
  const apiBehavior = distribution.CacheBehaviors.find((behavior) => behavior.PathPattern === 'api/*')
  assert.ok(apiBehavior.FunctionAssociations.some(({ FunctionARN }) => FunctionARN['Fn::GetAtt']?.[0] === filterLogicalId))
})
