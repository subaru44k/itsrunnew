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
  const code = Object.values(functions)[0].Properties.FunctionCode
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
