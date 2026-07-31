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

test('T11 auth is parameterized, code-only, and has no identity pool', () => {
  const result = template()
  const templateJson = result.toJSON()
  assert.equal(templateJson.Parameters.GoogleClientId.Type, 'String')
  assert.equal(templateJson.Parameters.GoogleClientSecretReference.Default, 'itsrun/preview/google-oauth-client-secret')
  assert.equal(templateJson.Parameters.CognitoDomainPrefix.Default, 'itsrun-preview-470447451992')
  assert.equal(templateJson.Parameters.CallbackUrls.Default, 'https://d2via50thoheqm.cloudfront.net/manage/callback')
  assert.equal(templateJson.Parameters.LogoutUrls.Default, 'https://d2via50thoheqm.cloudfront.net/manage')
  assert.equal(templateJson.Resources.AdminUserPoolD0AF18CF.Properties.AdminCreateUserConfig.AllowAdminCreateUserOnly, true)
  assert.equal(templateJson.Resources.AdminAppClientE1A03F22.Properties.GenerateSecret, false)
  assert.deepEqual(templateJson.Resources.AdminAppClientE1A03F22.Properties.AllowedOAuthFlows, ['code'])
  assert.deepEqual(templateJson.Resources.AdminAppClientE1A03F22.Properties.SupportedIdentityProviders, ['Google'])
  assert.equal(templateJson.Resources.AdminsGroup06B46644.Properties.GroupName, 'admins')
  assert.equal(Object.keys(result.findResources('AWS::Cognito::IdentityPool')).length, 0)
  const providerJson = JSON.stringify(templateJson.Resources.GoogleIdentityProvider5AA1A9DD)
  assert.match(providerJson, /resolve:secretsmanager/)
  assert.doesNotMatch(providerJson, /client-secret-value|dummy|placeholder/i)
})

test('T11 protects API routes with Cognito JWT and disables API caching', () => {
  const result = template()
  const templateJson = result.toJSON()
  const authorizer = templateJson.Resources.AdminApiJwtAuthorizer
  assert.equal(authorizer.Properties.AuthorizerType, 'JWT')
  assert.deepEqual(authorizer.Properties.IdentitySource, ['$request.header.Authorization'])
  assert.ok(authorizer.Properties.JwtConfiguration.Audience)
  assert.ok(authorizer.Properties.JwtConfiguration.Issuer)
  const routes = Object.values(result.findResources('AWS::ApiGatewayV2::Route'))
  assert.equal(routes.length, 2)
  for (const route of routes) {
    assert.equal(route.Properties.AuthorizationType, 'JWT')
    assert.deepEqual(route.Properties.AuthorizationScopes, ['itsrun/schedule.write'])
    assert.ok(route.Properties.AuthorizerId)
  }
  const distribution = Object.values(result.findResources('AWS::CloudFront::Distribution'))[0].Properties.DistributionConfig
  const apiBehavior = distribution.CacheBehaviors.find((behavior) => behavior.PathPattern === 'api/*')
  assert.ok(apiBehavior)
  assert.ok(apiBehavior.CachePolicyId.Ref)
  assert.equal(apiBehavior.ViewerProtocolPolicy, 'redirect-to-https')
  assert.ok(apiBehavior.OriginRequestPolicyId)
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
