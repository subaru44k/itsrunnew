import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const policyPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'bootstrap', 'cloudformation-execution-policy.json')
const policy = JSON.parse(readFileSync(policyPath, 'utf8'))
const statements = Object.fromEntries(policy.Statement.map((statement) => [statement.Sid, statement]))
const account = '470447451992'
const region = 'ap-northeast-1'

const statement = (Sid, Action, Resource, Condition) => ({ Sid, Effect: 'Allow', Action, Resource, ...(Condition ? { Condition } : {}) })

const immutableV3Statements = {
  PreviewBuckets: statement('PreviewBuckets', [
    's3:CreateBucket', 's3:DeleteBucket', 's3:GetBucketLocation', 's3:GetBucketPolicy', 's3:PutBucketPolicy',
    's3:DeleteBucketPolicy', 's3:GetBucketPublicAccessBlock', 's3:PutBucketPublicAccessBlock',
    's3:GetBucketOwnershipControls', 's3:PutBucketOwnershipControls', 's3:GetEncryptionConfiguration',
    's3:PutEncryptionConfiguration', 's3:GetBucketVersioning', 's3:PutBucketVersioning', 's3:GetBucketTagging',
    's3:PutBucketTagging', 's3:ListBucket',
  ], [
    `arn:aws:s3:::itsrun-preview-web-${account}-${region}`,
    `arn:aws:s3:::itsrun-preview-data-${account}-${region}`,
  ]),
  PreviewCloudFront: statement('PreviewCloudFront', [
    'cloudfront:CreateDistribution', 'cloudfront:UpdateDistribution', 'cloudfront:DeleteDistribution',
    'cloudfront:GetDistribution', 'cloudfront:GetDistributionConfig', 'cloudfront:ListDistributions',
    'cloudfront:CreateOriginAccessControl', 'cloudfront:UpdateOriginAccessControl', 'cloudfront:DeleteOriginAccessControl',
    'cloudfront:GetOriginAccessControl', 'cloudfront:ListOriginAccessControls', 'cloudfront:CreateFunction',
    'cloudfront:UpdateFunction', 'cloudfront:PublishFunction', 'cloudfront:DeleteFunction', 'cloudfront:DescribeFunction',
    'cloudfront:GetFunction', 'cloudfront:CreateCachePolicy', 'cloudfront:UpdateCachePolicy', 'cloudfront:DeleteCachePolicy',
    'cloudfront:GetCachePolicy', 'cloudfront:CreateResponseHeadersPolicy', 'cloudfront:UpdateResponseHeadersPolicy',
    'cloudfront:DeleteResponseHeadersPolicy', 'cloudfront:GetResponseHeadersPolicy',
    'cloudfront:CreateOriginRequestPolicy', 'cloudfront:UpdateOriginRequestPolicy',
    'cloudfront:DeleteOriginRequestPolicy', 'cloudfront:GetOriginRequestPolicy', 'cloudfront:ListOriginRequestPolicies',
    'cloudfront:TagResource', 'cloudfront:UntagResource', 'cloudfront:ListTagsForResource',
  ], '*'),
  ReadBootstrapVersion: statement('ReadBootstrapVersion', ['ssm:GetParameter', 'ssm:GetParameters'],
    `arn:aws:ssm:${region}:${account}:parameter/cdk-bootstrap/hnb659fds/version`),
  CloudFrontServiceLinkedRoleOnly: statement('CloudFrontServiceLinkedRoleOnly', ['iam:CreateServiceLinkedRole'], '*', {
    StringEquals: { 'iam:AWSServiceName': 'cloudfront.amazonaws.com' },
  }),
}

const reviewedV4Statements = {
  PreviewCognitoGlobalCreationAndLookup: statement('PreviewCognitoGlobalCreationAndLookup', [
    'cognito-idp:CreateUserPool', 'cognito-idp:ListUserPools', 'cognito-idp:DescribeUserPoolDomain',
  ], '*'),
  PreviewCognitoUserPoolResources: statement('PreviewCognitoUserPoolResources', [
    'cognito-idp:DescribeUserPool', 'cognito-idp:GetUserPoolMfaConfig', 'cognito-idp:UpdateUserPool',
    'cognito-idp:DeleteUserPool', 'cognito-idp:TagResource', 'cognito-idp:UntagResource', 'cognito-idp:ListTagsForResource',
    'cognito-idp:CreateUserPoolClient', 'cognito-idp:DescribeUserPoolClient', 'cognito-idp:UpdateUserPoolClient',
    'cognito-idp:DeleteUserPoolClient', 'cognito-idp:ListUserPoolClients', 'cognito-idp:CreateResourceServer',
    'cognito-idp:DescribeResourceServer', 'cognito-idp:UpdateResourceServer', 'cognito-idp:DeleteResourceServer',
    'cognito-idp:ListResourceServers', 'cognito-idp:CreateGroup', 'cognito-idp:GetGroup', 'cognito-idp:UpdateGroup',
    'cognito-idp:DeleteGroup', 'cognito-idp:ListGroups', 'cognito-idp:CreateUserPoolDomain',
    'cognito-idp:UpdateUserPoolDomain', 'cognito-idp:DeleteUserPoolDomain',
  ], `arn:aws:cognito-idp:${region}:${account}:userpool/*`),
  PreviewHttpApi: statement('PreviewHttpApi', ['apigateway:GET', 'apigateway:POST', 'apigateway:PUT', 'apigateway:PATCH', 'apigateway:DELETE'], [
    `arn:aws:apigateway:${region}::/apis`, `arn:aws:apigateway:${region}::/apis/*`,
  ]),
  PreviewScheduleLambda: statement('PreviewScheduleLambda', [
    'lambda:CreateFunction', 'lambda:GetFunction', 'lambda:GetFunctionCodeSigningConfig', 'lambda:GetFunctionRecursionConfig',
    'lambda:GetRuntimeManagementConfig', 'lambda:UpdateFunctionCode', 'lambda:UpdateFunctionConfiguration',
    'lambda:DeleteFunction', 'lambda:TagResource', 'lambda:UntagResource', 'lambda:AddPermission',
    'lambda:RemovePermission', 'lambda:GetPolicy',
  ], `arn:aws:lambda:${region}:${account}:function:itsrun-preview-schedule-api`),
  PreviewScheduleLambdaList: statement('PreviewScheduleLambdaList', 'lambda:ListFunctions', '*'),
  PreviewScheduleLambdaRole: statement('PreviewScheduleLambdaRole', [
    'iam:CreateRole', 'iam:GetRole', 'iam:DeleteRole', 'iam:UpdateAssumeRolePolicy', 'iam:UpdateRole',
    'iam:UpdateRoleDescription', 'iam:PutRolePolicy', 'iam:GetRolePolicy', 'iam:DeleteRolePolicy',
    'iam:ListRolePolicies', 'iam:ListAttachedRolePolicies', 'iam:TagRole', 'iam:UntagRole',
  ], `arn:aws:iam::${account}:role/ItsRunPreviewHosting-ScheduleApiRole*`),
  PassPreviewScheduleLambdaRoleOnly: statement('PassPreviewScheduleLambdaRoleOnly', 'iam:PassRole',
    `arn:aws:iam::${account}:role/ItsRunPreviewHosting-ScheduleApiRole*`, {
      StringEquals: { 'iam:PassedToService': 'lambda.amazonaws.com' },
    }),
  PreviewScheduleLogGroup: statement('PreviewScheduleLogGroup', [
    'logs:CreateLogGroup', 'logs:DeleteLogGroup', 'logs:PutRetentionPolicy', 'logs:DeleteRetentionPolicy',
    'logs:ListTagsForResource', 'logs:TagResource', 'logs:UntagResource',
  ], [
    `arn:aws:logs:${region}:${account}:log-group:/aws/lambda/itsrun-preview-schedule-api`,
    `arn:aws:logs:${region}:${account}:log-group:/aws/lambda/itsrun-preview-schedule-api:*`,
  ]),
  PreviewScheduleLogGroupLookup: statement('PreviewScheduleLogGroupLookup', 'logs:DescribeLogGroups', '*'),
  ReadPreviewLambdaAsset: statement('ReadPreviewLambdaAsset', ['s3:GetObject', 's3:GetObjectVersion'],
    `arn:aws:s3:::cdk-hnb659fds-assets-${account}-${region}/*`),
}

test('candidate v4 has the exact reviewed statement contract', () => {
  assert.equal(policy.Version, '2012-10-17')
  assert.deepEqual(Object.keys(statements).sort(), [
    ...Object.keys(immutableV3Statements), ...Object.keys(reviewedV4Statements),
  ].sort())
  for (const [sid, expected] of Object.entries({ ...immutableV3Statements, ...reviewedV4Statements })) {
    assert.deepEqual(statements[sid], expected, sid)
  }
})

test('candidate v4 differs from the committed v3 contract only by reviewed additions', () => {
  const baseline = Object.fromEntries(Object.entries(immutableV3Statements).map(([sid, expected]) => [sid, expected]))
  const additions = Object.keys(statements).filter((sid) => !Object.hasOwn(baseline, sid))
  assert.deepEqual(additions.sort(), Object.keys(reviewedV4Statements).sort())
  assert.deepEqual(Object.fromEntries(Object.entries(statements).filter(([sid]) => Object.hasOwn(baseline, sid))), baseline)
  assert.deepEqual(statements.PreviewCloudFront.Action.filter((action) => action.includes('OriginRequestPolicy')), [
    'cloudfront:CreateOriginRequestPolicy', 'cloudfront:UpdateOriginRequestPolicy',
    'cloudfront:DeleteOriginRequestPolicy', 'cloudfront:GetOriginRequestPolicy',
  ])
  assert.equal(statements.PreviewCloudFront.Action.includes('cloudfront:ListOriginRequestPolicies'), true)
})

test('candidate v4 has no wildcard action or forbidden privilege surface', () => {
  const actions = policy.Statement.flatMap(({ Action }) => Array.isArray(Action) ? Action : [Action])
  assert.equal(actions.includes('*'), false)
  assert.equal(actions.some((action) => action.endsWith(':*')), false)
  const serialized = JSON.stringify(policy)
  for (const forbidden of [
    'kms:', 'ec2:', 'vpc:', 'efs:', 'secretsmanager:', 'dynamodb:', 'sqs:', 'sns:', 'cognito-identity:',
    'cognito-idp:CreateIdentityPool', 'cognito-idp:DeleteIdentityPool', 'cognito-idp:CreateIdentityProvider',
    'cognito-idp:DeleteIdentityProvider', 's3:DeleteObject', 's3:PutObject', 's3:PutObjectAcl',
    'AdministratorAccess', 'PowerUserAccess', 'arn:aws:iam::123456789012:', 'itsrun-prod',
  ]) assert.equal(serialized.includes(forbidden), false, forbidden)
  assert.equal(serialized.includes(`arn:aws:s3:::itsrun-preview-web-${account}-${region}/*`), false)
  assert.equal(serialized.includes(`arn:aws:s3:::itsrun-preview-data-${account}-${region}/*`), false)
  for (const resource of policy.Statement.flatMap(({ Resource }) => Array.isArray(Resource) ? Resource : [Resource])) {
    if (resource === '*') continue
    assert.match(resource, new RegExp(`(^arn:aws:[^:]+:${region}:(?:${account})?:)|(^arn:aws:iam::${account}:)|(^arn:aws:s3:::)`), resource)
  }
})
