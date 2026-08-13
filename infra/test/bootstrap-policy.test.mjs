import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createHash } from 'node:crypto'

const policyPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'bootstrap', 'cloudformation-execution-policy.json')
const policy = JSON.parse(readFileSync(policyPath, 'utf8'))
const statements = Object.fromEntries(policy.Statement.map((statement) => [statement.Sid, statement]))
const account = '470447451992'
const region = 'ap-northeast-1'
const sorted = (value) => Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])])) : value

const statement = (Sid, Action, Resource, Condition) => ({ Sid, Effect: 'Allow', Action, Resource, ...(Condition ? { Condition } : {}) })

const reviewedOriginRequestPolicyActions = [
  'cloudfront:CreateOriginRequestPolicy', 'cloudfront:UpdateOriginRequestPolicy',
  'cloudfront:DeleteOriginRequestPolicy', 'cloudfront:GetOriginRequestPolicy', 'cloudfront:ListOriginRequestPolicies',
]

const committedV3Statements = {
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

const candidateV4Statements = {
  ...committedV3Statements,
  ...reviewedV4Statements,
  PreviewCloudFront: statement('PreviewCloudFront', [
    ...committedV3Statements.PreviewCloudFront.Action.slice(0, committedV3Statements.PreviewCloudFront.Action.indexOf('cloudfront:TagResource')),
    ...reviewedOriginRequestPolicyActions,
    ...committedV3Statements.PreviewCloudFront.Action.slice(committedV3Statements.PreviewCloudFront.Action.indexOf('cloudfront:TagResource')),
  ], committedV3Statements.PreviewCloudFront.Resource),
}

const candidateV5Statements = {
  ...candidateV4Statements,
  PreviewHttpApiStageTags: statement('PreviewHttpApiStageTags', 'apigateway:TagResource', `arn:aws:apigateway:${region}::/apis/*/stages`),
}
const committedV6Statements = {
  ...candidateV5Statements,
  PreviewScheduleLambdaRole: statement('PreviewScheduleLambdaRole', candidateV4Statements.PreviewScheduleLambdaRole.Action, [
    `arn:aws:iam::${account}:role/ItsRunPreviewHosting-ScheduleApiRole*`,
    `arn:aws:iam::${account}:role/itsrun-preview-github-web-deploy`,
  ]),
  PreviewGitHubOidcProviderLifecycle: statement('PreviewGitHubOidcProviderLifecycle', [
    'iam:CreateOpenIDConnectProvider', 'iam:GetOpenIDConnectProvider',
    'iam:ListOpenIDConnectProviderTags', 'iam:TagOpenIDConnectProvider',
  ], `arn:aws:iam::${account}:oidc-provider/token.actions.githubusercontent.com`),
}

const candidateV7Statements = {
  ...candidateV5Statements,
  PreviewScheduleLambdaRole: statement('PreviewScheduleLambdaRole', candidateV4Statements.PreviewScheduleLambdaRole.Action,
    `arn:aws:iam::${account}:role/ItsRunPreviewHosting-ScheduleApiRole*`),
  PreviewAdminApi5xxAlarm: statement('PreviewAdminApi5xxAlarm', [
    'cloudwatch:PutMetricAlarm', 'cloudwatch:DeleteAlarms', 'cloudwatch:DescribeAlarms',
  ], `arn:aws:cloudwatch:${region}:${account}:alarm:itsrun-preview-admin-api-5xx`),
}

test('candidate v7 has the exact reviewed statement contract', () => {
  assert.equal(policy.Version, '2012-10-17')
  const baselineStatements = Object.fromEntries(Object.entries(statements).filter(([sid]) => sid !== 'GitHubTrust'))
  assert.deepEqual(Object.keys(baselineStatements).sort(), [
    ...Object.keys(candidateV7Statements),
  ].sort())
  for (const [sid, expected] of Object.entries(candidateV7Statements)) {
    assert.deepEqual(baselineStatements[sid], expected, sid)
  }
})

test('candidate v7 differs from the committed v6 contract only by compact D026 changes', () => {
  const baselineStatements = Object.fromEntries(Object.entries(statements).filter(([sid]) => sid !== 'GitHubTrust'))
  assert.deepEqual(Object.keys(baselineStatements).sort(), Object.keys(candidateV7Statements).sort())
  assert.deepEqual(Object.keys(committedV6Statements).filter((sid) => !Object.hasOwn(candidateV7Statements, sid)), ['PreviewGitHubOidcProviderLifecycle'])
  assert.deepEqual(Object.keys(candidateV7Statements).filter((sid) => !Object.hasOwn(committedV6Statements, sid)), ['PreviewAdminApi5xxAlarm'])
  for (const sid of Object.keys(committedV6Statements).filter((sid) => sid !== 'PreviewGitHubOidcProviderLifecycle' && sid !== 'PreviewScheduleLambdaRole')) {
    assert.deepEqual(baselineStatements[sid], committedV6Statements[sid], sid)
  }
  for (const [sid, expected] of Object.entries(candidateV5Statements)) {
    if (sid !== 'PreviewScheduleLambdaRole') assert.deepEqual(baselineStatements[sid], expected, sid)
  }
  assert.deepEqual(baselineStatements.PreviewHttpApiStageTags, {
    Sid: 'PreviewHttpApiStageTags',
    Effect: 'Allow',
    Action: 'apigateway:TagResource',
    Resource: `arn:aws:apigateway:${region}::/apis/*/stages`,
  })
  assert.equal(baselineStatements.PreviewHttpApiStageTags.Action, 'apigateway:TagResource')
  assert.equal(baselineStatements.PreviewHttpApiStageTags.Resource, 'arn:aws:apigateway:ap-northeast-1::/apis/*/stages')
  assert.deepEqual(baselineStatements.PreviewScheduleLambdaRole, candidateV7Statements.PreviewScheduleLambdaRole)
  assert.equal(baselineStatements.PreviewGitHubOidcProviderLifecycle, undefined)
  assert.deepEqual(baselineStatements.PreviewScheduleLambdaRole.Resource,
    `arn:aws:iam::${account}:role/ItsRunPreviewHosting-ScheduleApiRole*`)
  assert.deepEqual(baselineStatements.PreviewAdminApi5xxAlarm, candidateV7Statements.PreviewAdminApi5xxAlarm)
})

test('compact D026 candidate has the exact policy-size budget', () => {
  const nonWhitespace = readFileSync(policyPath, 'utf8').replace(/\s/g, '')
  assert.equal(nonWhitespace.length, 6124)
  assert.ok(nonWhitespace.length <= 6144)
  assert.deepEqual(statements.PreviewScheduleLambdaRole.Action, candidateV4Statements.PreviewScheduleLambdaRole.Action)
  assert.ok(nonWhitespace.length <= 6144)
  assert.deepEqual(statements.PreviewAdminApi5xxAlarm.Action, [
    'cloudwatch:PutMetricAlarm', 'cloudwatch:DeleteAlarms', 'cloudwatch:DescribeAlarms',
  ])
  assert.equal(statements.PreviewAdminApi5xxAlarm.Resource,
    `arn:aws:cloudwatch:${region}:${account}:alarm:itsrun-preview-admin-api-5xx`)
})

test('committed v4 differs from the committed v3 contract only by reviewed additions', () => {
  const addedStatementIds = Object.keys(candidateV4Statements).filter((sid) => !Object.hasOwn(committedV3Statements, sid))
  assert.deepEqual(addedStatementIds.sort(), Object.keys(reviewedV4Statements).sort())
  for (const [sid, expected] of Object.entries(committedV3Statements)) {
    if (sid === 'PreviewCloudFront') continue
    assert.deepEqual(candidateV4Statements[sid], expected, sid)
  }
  const candidateCloudFrontActions = candidateV4Statements.PreviewCloudFront.Action
  assert.deepEqual(candidateCloudFrontActions.filter((action) => !reviewedOriginRequestPolicyActions.includes(action)),
    committedV3Statements.PreviewCloudFront.Action)
  const originStart = candidateCloudFrontActions.indexOf(reviewedOriginRequestPolicyActions[0])
  assert.deepEqual(candidateCloudFrontActions.slice(originStart, originStart + reviewedOriginRequestPolicyActions.length),
    reviewedOriginRequestPolicyActions)
  assert.deepEqual(candidateV4Statements.PreviewCloudFront.Resource, committedV3Statements.PreviewCloudFront.Resource)
})

test('candidate v7 has no wildcard action or forbidden privilege surface', () => {
  const actions = policy.Statement.flatMap(({ Action }) => Array.isArray(Action) ? Action : [Action])
  assert.equal(actions.includes('*'), false)
  assert.equal(actions.some((action) => action.endsWith(':*')), false)
  const serialized = JSON.stringify(policy)
  assert.equal(policy.Statement.filter(({ Action }) => Action === 'apigateway:TagResource').length, 1)
  assert.equal(serialized.includes('apigateway:UntagResource'), false)
  assert.equal(serialized.includes('/apis/*/stages/*'), false)
  assert.equal(serialized.includes('arn:aws:apigateway:us-east-1::/apis/*/stages'), false)
  assert.equal(serialized.includes('arn:aws:execute-api:'), false)
  assert.equal(statements.PreviewAdminApi5xxAlarm.Action.includes('iam:PassRole'), false)
  assert.equal(statements.PreviewScheduleLambdaRole.Action.includes('iam:PassRole'), false)
  assert.equal(serialized.includes('iam:ListOpenIDConnectProviders'), false)
  assert.equal(serialized.includes('iam:AttachRolePolicy'), false)
  assert.equal(serialized.includes('iam:DetachRolePolicy'), false)
  assert.equal(serialized.includes('arn:aws:iam::123456789012:'), false)
  for (const forbidden of [
    'kms:', 'ec2:', 'vpc:', 'efs:', 'elasticfilesystem:', 'firehose:', 's3files:', 'secretsmanager:', 'dynamodb:', 'sqs:', 'sns:', 'cognito-identity:',
    'cognito-idp:CreateIdentityPool', 'cognito-idp:DeleteIdentityPool', 'cognito-idp:CreateIdentityProvider',
    'cognito-idp:DeleteIdentityProvider', 's3:DeleteObject', 's3:PutObject', 's3:PutObjectAcl',
    'iam:AttachRolePolicy', 'iam:DetachRolePolicy', 'iam:PutRolePermissionsBoundary', 'iam:DeleteRolePermissionsBoundary',
    'AdministratorAccess', 'PowerUserAccess', 'arn:aws:iam::123456789012:', 'itsrun-prod', 'iam:CreateOpenIDConnectProvider',
  ]) assert.equal(serialized.includes(forbidden), false, forbidden)
  const wildcardResourceSids = policy.Statement.filter(({ Resource }) => Resource === '*').map(({ Sid }) => Sid).sort()
  assert.deepEqual(wildcardResourceSids, [
    'CloudFrontServiceLinkedRoleOnly', 'PreviewCognitoGlobalCreationAndLookup', 'PreviewCloudFront',
    'PreviewScheduleLambdaList', 'PreviewScheduleLogGroupLookup',
  ].sort())
  assert.equal(serialized.includes(`arn:aws:s3:::itsrun-preview-web-${account}-${region}/*`), false)
  assert.equal(serialized.includes(`arn:aws:s3:::itsrun-preview-data-${account}-${region}/*`), false)
  for (const resource of policy.Statement.flatMap(({ Resource }) => Array.isArray(Resource) ? Resource : [Resource])) {
    if (resource === '*') continue
    assert.match(resource, new RegExp(`(^arn:aws:[^:]+:${region}:(?:${account})?:)|(^arn:aws:iam::${account}:)|(^arn:aws:s3:::)`), resource)
  }
})

test('PT01 GitHubTrust is the exact bounded trust update permission', () => {
  assert.deepEqual(statements.GitHubTrust, {
    Sid: 'GitHubTrust', Effect: 'Allow',
    Action: ['iam:GetRole', 'iam:UpdateAssumeRolePolicy'],
    Resource: `arn:aws:iam::${account}:role/itsrun-preview-github-web-deploy`,
  })
  const serialized = JSON.stringify(statements.GitHubTrust)
  assert.equal(serialized.includes('iam:CreateRole'), false)
  assert.equal(serialized.includes('iam:DeleteRole'), false)
  assert.equal(serialized.includes('iam:PutRolePolicy'), false)
  assert.equal(serialized.includes('iam:DeleteRolePolicy'), false)
  assert.equal(serialized.includes('iam:CreateOpenIDConnectProvider'), false)
  assert.equal(serialized.includes('iam:DeleteOpenIDConnectProvider'), false)
  assert.equal(serialized.includes('"*"'), false)
  assert.equal(createHash('sha256').update(`${JSON.stringify(sorted(policy), null, 2)}\n`).digest('hex'), '7c1a4c623e986fb6ad4b7841cdf7e3f2e920e6cfd6887fc4d927972b19b644e0')
})
